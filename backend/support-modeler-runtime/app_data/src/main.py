"""隧道支护图纸关键建模参数自动提取工具 V1 统一入口。"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import shutil
import subprocess
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook

ROOT = Path(os.getenv("SUPPORT_DEMO_ROOT", Path(__file__).resolve().parents[1])).resolve()
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

from full_export import REVIEW, style_sheet
from ocr_engine import OCREngine
from pdf_export import save_json
from pdf_io import open_pdf
from pdf_screen import load_config, scan_document
from run_pdf import file_hash


class Tee:
    """同时写入控制台和运行日志。"""

    def __init__(self, *streams):
        self.streams = streams

    def write(self, value):
        for stream in self.streams:
            stream.write(value)
            stream.flush()
        return len(value)

    def flush(self):
        for stream in self.streams:
            stream.flush()


def allocate_run(output_root: Path) -> Path:
    """创建不会覆盖旧结果的时间戳运行目录。"""
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    candidate = output_root / f"run_{stamp}"
    index = 1
    while candidate.exists():
        candidate = output_root / f"run_{stamp}_{index:02d}"
        index += 1
    candidate.mkdir(parents=True)
    (candidate / "logs").mkdir()
    return candidate


def create_screen_cache(pdf: Path, config_path: Path, scratch: Path, dpi: int):
    """读取完整PDF并生成原始筛页缓存；不保存密码。"""
    config = load_config(config_path)
    doc = None
    try:
        doc, auth = open_pdf(pdf)
        print(f"PDF检查通过：总页数={len(doc)}，加密认证={'成功' if auth['authenticated'] else '无需认证'}")
        scratch.mkdir(parents=True, exist_ok=True)
        pages = scan_document(
            doc,
            config,
            config["target_types"][0],
            lambda: OCREngine(1200, 1800),
            scratch / "screen_pages",
        )
        cache = scratch / "screen_index.json"
        save_json(cache, {
            "pdf_sha256": file_hash(pdf),
            "config_sha256": file_hash(config_path),
            "screen_dpi": config.get("screen_dpi", 100),
            "render_dpi": dpi,
            "pages": pages,
        })
        return cache, auth
    finally:
        if doc:
            doc.close()


def run_pipeline(pdf: Path, config: Path, cache: Path, run_dir: Path, dpi: int):
    """调用冻结算法批处理入口，并把输出逐行写入日志。"""
    work = run_dir / "_pipeline_work"
    if getattr(sys, "frozen", False):
        from run_all_supports import main as run_all_main
        original_argv = sys.argv
        sys.argv = [sys.argv[0], "--pdf", str(pdf), "--config", str(config),
                    "--screen-cache", str(cache), "--output-root", str(work), "--dpi", str(dpi)]
        try:
            code = run_all_main()
        finally:
            sys.argv = original_argv
        if code:
            raise RuntimeError(f"参数提取流程失败，退出码={code}")
        return work
    command = [
        sys.executable,
        str(ROOT / "src" / "run_all_supports.py"),
        "--pdf", str(pdf),
        "--config", str(config),
        "--screen-cache", str(cache),
        "--output-root", str(work),
        "--dpi", str(dpi),
    ]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    for line in process.stdout:
        print(line, end="")
    code = process.wait()
    if code:
        raise RuntimeError(f"参数提取流程失败，退出码={code}")
    return work


def create_review_workbook(payload: dict, path: Path):
    book = Workbook()
    sheet = book.active
    sheet.title = "review_items"
    sheet.append(REVIEW)
    for item in payload.get("review", []):
        sheet.append([item.get(column) for column in REVIEW])
    style_sheet(sheet, REVIEW)
    book.save(path)
    book.close()


def create_user_summary(payload: dict, path: Path, elapsed: float):
    supports = payload["supports"]
    steel_count = sum(bool(row["steel_arch"].get("has_component")) for row in supports)
    rebar_count = sum(bool(row.get("rebar") and row["rebar"].get("has_component")) for row in supports)
    steel_ok = sum(row["steel_arch"].get("status") == "EXTRACTED" for row in supports)
    rebar_ok = sum(bool(row.get("rebar")) and row["rebar"].get("status") == "EXTRACTED" for row in supports)
    lines = [
        "# 支护图纸解析结果", "",
        f"- PDF总页数：{payload['metadata']['page_count']}",
        f"- 识别支护类型：{sum(bool(row['page_numbers']) for row in supports)}",
        f"- 存在钢架类型：{steel_count}",
        f"- 存在N1/N2钢筋类型：{rebar_count}",
        f"- 成功钢架参数：{steel_ok}组",
        f"- 成功钢筋参数：{rebar_ok}组",
        f"- 需要人工复核：{len(payload.get('review', []))}项",
        f"- 基线回归：{'PASS' if payload.get('regression', {}).get('all_passed') else 'FAIL'}",
        f"- 运行耗时：{elapsed:.1f}秒", "",
        "## 各支护类型状态", "",
        "| 支护类型 | 相关页码 | 钢架状态 | N1/N2钢筋状态 |", "|---|---|---|---|",
    ]
    for row in supports:
        pages = "、".join(map(str, row["page_numbers"])) or "未定位"
        rebar_status = (row.get("rebar") or {}).get("status", "NOT_APPLICABLE")
        lines.append(f"| {row['support_type']} | {pages} | {row['steel_arch'].get('status')} | {rebar_status} |")
    lines += ["", "## 异常和人工复核项目", ""]
    if payload.get("review"):
        for item in payload["review"]:
            lines.append(
                f"- {item.get('support_type')} / {item.get('component')} / {item.get('field')}："
                f"{item.get('reason')}（页码：{item.get('source_page')}，识别值：{item.get('predicted_value')}）"
            )
    else:
        lines.append("- 无")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def publish_results(work: Path, run_dir: Path, elapsed: float):
    final = work / "final"
    json_source = final / "support_parameters_all.json"
    excel_source = final / "support_parameters_all.xlsx"
    if not json_source.exists() or not excel_source.exists():
        raise FileNotFoundError("底层流程未生成预期Excel或JSON")
    payload = json.loads(json_source.read_text(encoding="utf-8"))
    shutil.copyfile(excel_source, run_dir / "support_parameters.xlsx")
    shutil.copyfile(json_source, run_dir / "support_parameters.json")
    if (final / "visualizations").exists():
        shutil.copytree(final / "visualizations", run_dir / "visualizations")
    else:
        (run_dir / "visualizations").mkdir()
    create_review_workbook(payload, run_dir / "review_items.xlsx")
    create_user_summary(payload, run_dir / "run_summary.md", elapsed)
    return payload


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, required=True, help="需要解析的完整施工图PDF")
    parser.add_argument("--dpi", type=int, choices=(400, 500, 600), default=400, help="正式页面渲染DPI")
    parser.add_argument("--config", type=Path, default=ROOT / "config/target_drawings.yaml")
    parser.add_argument("--output-root", type=Path, default=ROOT / "outputs")
    return parser.parse_args()


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    args = parse_args()
    args.pdf = args.pdf.expanduser().resolve()
    if not args.pdf.is_file():
        print(f"错误：PDF不存在：{args.pdf}", file=sys.stderr)
        return 2
    if args.pdf.suffix.lower() != ".pdf":
        print("错误：输入文件必须是PDF。", file=sys.stderr)
        return 2
    run_dir = allocate_run(args.output_root.resolve())
    log_path = run_dir / "logs" / "run.log"
    started = time.perf_counter()
    with log_path.open("w", encoding="utf-8") as log, \
            contextlib.redirect_stdout(Tee(sys.__stdout__, log)), \
            contextlib.redirect_stderr(Tee(sys.__stderr__, log)):
        try:
            print("隧道支护图纸关键建模参数自动提取工具 V1")
            print(f"运行目录：{run_dir}")
            cache, _ = create_screen_cache(args.pdf, args.config, run_dir / "_pipeline_work", args.dpi)
            work = run_pipeline(args.pdf, args.config, cache, run_dir, args.dpi)
            elapsed = time.perf_counter() - started
            payload = publish_results(work, run_dir, elapsed)
            shutil.rmtree(work)
            print("\n解析完成。")
            print(f"最终Excel：{run_dir / 'support_parameters.xlsx'}")
            print(f"证据JSON：{run_dir / 'support_parameters.json'}")
            print(f"人工复核项：{len(payload.get('review', []))}（{run_dir / 'review_items.xlsx'}）")
            print(f"运行日志：{log_path}")
            return 0
        except Exception as exc:
            print(f"\n解析失败：{exc}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(f"诊断日志：{log_path}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
