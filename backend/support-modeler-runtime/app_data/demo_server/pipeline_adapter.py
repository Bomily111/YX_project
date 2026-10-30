"""把一次 HTTP 上传安全地转交给现有生产 OCR 入口。"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

ROOT = Path(os.getenv("SUPPORT_DEMO_ROOT", Path(__file__).resolve().parents[1])).resolve()
DEFAULT_TEMP_ROOT = ROOT / "demo_server" / "temp"


@dataclass
class PipelineError(RuntimeError):
    """可安全返回给前端的流水线错误。"""

    code: str
    message: str
    details: str | None = None

    def __str__(self) -> str:
        return self.message


def _safe_log_text(text: str) -> str:
    """日志只保留普通流程文本，不展开环境变量。"""
    password = os.getenv("SUPPORT_PDF_PASSWORD")
    if password:
        text = text.replace(password, "[REDACTED]")
    return text


def _map_failure(output: str) -> PipelineError:
    if "SUPPORT_PDF_PASSWORD未设置" in output:
        return PipelineError("PDF_PASSWORD_NOT_CONFIGURED", "加密 PDF 需要密码，请先设置 SUPPORT_PDF_PASSWORD 环境变量。")
    if "PDF密码认证失败" in output:
        return PipelineError("PDF_DECRYPTION_FAILED", "PDF 密码认证失败，请检查 SUPPORT_PDF_PASSWORD。")
    if "PDF不存在" in output or "输入文件必须是PDF" in output:
        return PipelineError("INVALID_PDF", "上传文件不是可处理的 PDF。")
    return PipelineError("OCR_FAILED", "图纸参数识别失败，请查看本次请求日志。")


def _find_result(output_root: Path) -> Path:
    candidates = sorted(output_root.glob("run_*/support_parameters.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise PipelineError("OCR_OUTPUT_MISSING", "识别流程未生成 support_parameters.json。")
    return candidates[0]


def run_existing_pipeline(pdf_path: Path, request_dir: Path, dpi: int = 400, pdf_password: str | None = None) -> dict:
    """直接调用 src/main.py；输出仅写入当前请求目录。"""
    output_root = request_dir / "pipeline_output"
    if getattr(sys, "frozen", False):
        command = [sys.executable, "--ocr-worker", "--pdf", str(pdf_path),
                   "--dpi", str(dpi), "--output-root", str(output_root)]
    else:
        command = [sys.executable, str(ROOT / "src" / "main.py"), "--pdf", str(pdf_path),
                   "--dpi", str(dpi), "--output-root", str(output_root)]
    env = os.environ.copy()
    if pdf_password is not None:
        env["SUPPORT_PDF_PASSWORD"] = pdf_password
    env["PYTHONIOENCODING"] = "utf-8"
    started = time.perf_counter()
    process = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    output = _safe_log_text(process.stdout or "")
    (request_dir / "run.log").write_text(output, encoding="utf-8")
    if process.returncode:
        raise _map_failure(output)

    source = _find_result(output_root)
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PipelineError("JSON_ADAPTER_FAILED", "识别结果 JSON 无法读取。", str(exc)) from exc
    if not isinstance(payload.get("supports"), list):
        raise PipelineError("JSON_ADAPTER_FAILED", "识别结果缺少 supports 数组。")
    payload.setdefault("metadata", {})["adapter_elapsed_seconds"] = round(time.perf_counter() - started, 3)
    return payload


def process_uploaded_pdf(
    pdf_path: Path,
    request_dir: Path,
    request_id: str,
    source_file: str,
    runner: Callable[[Path, Path, int], dict] = run_existing_pipeline,
    dpi: int = 400,
) -> dict:
    """运行、保存请求级 JSON，并生成前端可直接消费的响应。"""
    started = time.perf_counter()
    try:
        payload = runner(pdf_path, request_dir, dpi)
        supports = payload.get("supports")
        if not isinstance(supports, list):
            raise PipelineError("JSON_ADAPTER_FAILED", "识别结果缺少 supports 数组。")
        detected = [item for item in supports if item.get("page_numbers")]
        if not detected:
            raise PipelineError("NO_SUPPORT_TYPE", "没有识别到目标支护类型。")

        result = {
            "status": "ok",
            "request_id": request_id,
            "source_file": Path(source_file).name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "support_type": detected[0].get("support_type"),
            "parameters": (detected[0].get("steel_arch") or {}).get("fields", {}),
            "supports": supports,
            "metadata": payload.get("metadata", {}),
            "warnings": [],
            "errors": [],
            "elapsed_seconds": round(time.perf_counter() - started, 3),
        }
        (request_dir / "extracted_parameters.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return result
    finally:
        if os.getenv("DEMO_KEEP_UPLOADED_PDF", "0") != "1":
            pdf_path.unlink(missing_ok=True)


def clean_request_artifacts(request_dir: Path) -> None:
    """测试或运维需要时删除完整请求目录。"""
    if request_dir.exists():
        shutil.rmtree(request_dir)
