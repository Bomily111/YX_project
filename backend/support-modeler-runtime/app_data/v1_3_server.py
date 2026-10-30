"""V1.3 交付包本地服务：静态演示资源与真实图纸识别 API。"""
from __future__ import annotations

import argparse
import json
import logging
import os
import socket
import threading
import urllib.request
import uuid
import webbrowser
from pathlib import Path

if getattr(__import__("sys"), "frozen", False):
    ROOT = Path(__import__("sys").executable).resolve().parent / "app_data"
else:
    ROOT = Path(__file__).resolve().parent
os.environ["SUPPORT_DEMO_ROOT"] = str(ROOT)

from flask import Flask, jsonify, request, send_from_directory

from demo_server.drawing_input import prepare_drawing_input, run_existing_image_pipeline
from demo_server.master_pipeline import load_latest_real_cache, process_master_pdf
from demo_server.pipeline_adapter import PipelineError, run_existing_pipeline
from src.master_support_demo.payload import SupportParameterPayloadBuilder

TEMP_ROOT = ROOT / "runtime" / "requests"
LOG_ROOT = ROOT / "runtime" / "logs"
MAX_UPLOAD_BYTES = 1024 * 1024 * 1024
SERVICE_NAME = "SupportParameterExtractorV13"


def _service_health(port: int):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=0.7) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None


def _port_available(port: int) -> bool:
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def _safe_text(value: object) -> str:
    text = str(value)
    password = os.getenv("SUPPORT_PDF_PASSWORD", "")
    return text.replace(password, "[REDACTED]") if password else text


def _error(code: str, message: str, status_code: int, details=None, request_id=None):
    payload = {"status": "error", "error_code": code, "message": message}
    if details:
        payload["details"] = _safe_text(details)
    if request_id:
        payload["request_id"] = request_id
    return jsonify(payload), status_code


def _append_request_log(request_dir: Path, record: dict) -> None:
    request_dir.mkdir(parents=True, exist_ok=True)
    safe_record = {key: _safe_text(value) for key, value in record.items()}
    with (request_dir / "run.log").open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(safe_record, ensure_ascii=False) + "\n")


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES)
    TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    LOG_ROOT.mkdir(parents=True, exist_ok=True)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "ok", "service": SERVICE_NAME, "version": "1.3",
            "drawing_api": True, "ocr_entry": (ROOT / "src" / "main.py").is_file(),
            "password_configured": bool(os.getenv("SUPPORT_PDF_PASSWORD")),
        })

    @app.post("/api/master/drawing")
    def master_drawing_extract():
        upload = request.files.get("file")
        if upload is None:
            return _error("FILE_MISSING", "请选择需要识别的图纸。", 400)
        source_name = Path(upload.filename or "").name
        suffix = Path(source_name).suffix.lower()
        if not source_name or suffix not in {".pdf", ".jpg", ".jpeg", ".png"}:
            return _error("INVALID_FILE_TYPE", "图纸仅支持 PDF、JPG、JPEG 和 PNG。", 400)

        request_id = uuid.uuid4().hex
        request_dir = TEMP_ROOT / request_id
        request_dir.mkdir(parents=True)
        source_path = request_dir / ("original" + suffix)
        upload.save(source_path)
        try:
            if source_path.stat().st_size == 0:
                raise PipelineError("INVALID_DRAWING", "上传图纸为空文件。")
            pdf_password = request.form.get("pdf_password") or None
            drawing = prepare_drawing_input(source_path, request_dir, source_name, pdf_password)
            if drawing.source_type == "PDF_DOCUMENT":
                runner = lambda pdf, folder, dpi: run_existing_pipeline(pdf, folder, dpi, pdf_password)
                result = process_master_pdf(source_path, source_name, request_dir, runner)
            else:
                extraction, cache_status = run_existing_image_pipeline(
                    drawing, request_dir, ROOT / "outputs" / "master_demo" / "drawing_cache"
                )
                source = "EXISTING_OCR_PIPELINE" if cache_status == "OCR_RUN" else "PREVIOUS_REAL_OCR_CACHE"
                payloads = SupportParameterPayloadBuilder(ROOT).build_all(extraction, drawing.hash, source)
                if not payloads:
                    raise PipelineError("NO_SUPPORT_TYPE", "图片 OCR 未能生成可用支护参数。")
                selected = "ZZ-Va" if "ZZ-Va" in payloads else next(iter(payloads))
                result = {
                    "status": "ok",
                    "processing_state": "MODEL_READY" if payloads[selected]["model_ready"] else "PARAMETER_INCOMPLETE",
                    "cache_status": cache_status, "pdf_sha256": drawing.hash,
                    "source_file": source_name, "support_types": list(payloads),
                    "selected_support_type": selected, "payload": payloads[selected],
                    "payloads": payloads, "model": None,
                }
            result["drawing_input"] = drawing.public_dict()
            result["drawing_hash"] = drawing.hash
            if result.get("cache_status") == "OCR_RUN":
                result["recognition_method"] = "EXISTING_OCR_PIPELINE"
                result["recognition_state"] = "REAL_OCR_RUN"
            else:
                result["recognition_method"] = "REAL_OCR_CACHE"
                result["recognition_state"] = "REAL_OCR_CACHE"
            return jsonify(result)
        except PipelineError as exc:
            _append_request_log(request_dir, {"request_id": request_id, "file_name": source_name,
                                                "error_code": exc.code, "detail": exc.message})
            return _error(exc.code, exc.message, 422, exc.details, request_id)
        except Exception as exc:
            app.logger.exception("drawing pipeline failed: %s", type(exc).__name__)
            _append_request_log(request_dir, {"request_id": request_id, "file_name": source_name,
                                                "error_code": "DRAWING_PIPELINE_ERROR", "detail": exc})
            return _error("DRAWING_PIPELINE_ERROR",
                          "图纸识别服务发生异常，请查看 runtime/requests 下本次请求日志。",
                          500, type(exc).__name__, request_id)

    @app.get("/api/master/demo-cache")
    def master_demo_cache():
        try:
            result = load_latest_real_cache()
            if result.get("status") == "ok":
                result["recognition_method"] = "REAL_OCR_CACHE"
                result["recognition_state"] = "REAL_OCR_CACHE"
            return jsonify(result)
        except PipelineError as exc:
            return _error(exc.code, exc.message, 404, exc.details)
        except Exception as exc:
            app.logger.warning("demo-cache compatibility check failed: %s", type(exc).__name__)
            return jsonify({"status": "unavailable", "processing_state": "CACHE_UNAVAILABLE",
                            "cache_status": "CACHE_SCHEMA_INCOMPATIBLE",
                            "message": "OCR缓存无法读取，可上传图纸重新识别。", "payloads": {}})

    @app.errorhandler(413)
    def too_large(_error_value):
        return _error("FILE_TOO_LARGE", "图纸文件超过 1 GB 上传限制。", 413)

    @app.get("/")
    def index():
        return send_from_directory(ROOT, "index.html")

    @app.get("/<path:asset_name>")
    def static_asset(asset_name: str):
        path = ROOT / asset_name
        if not path.is_file():
            return _error("RESOURCE_NOT_FOUND", "请求的演示资源不存在。", 404)
        response = send_from_directory(ROOT, asset_name)
        if path.suffix.lower() in {".js", ".mjs"}:
            response.mimetype = "text/javascript"
        elif path.suffix.lower() == ".glb":
            response.mimetype = "model/gltf-binary"
        return response

    return app


def open_url(url: str) -> None:
    try:
        if os.name == "nt":
            os.startfile(url)
        else:
            webbrowser.open(url)
    except Exception as exc:
        print("[WARNING] 浏览器未能自动打开：{}".format(exc))
        print("请手动访问：{}".format(url))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--open-browser", action="store_true")
    args = parser.parse_args()
    ports = range(args.port, args.port + 11)
    for candidate in ports:
        current = _service_health(candidate)
        if current and current.get("service") == SERVICE_NAME:
            url = "http://127.0.0.1:{}/index.html".format(candidate)
            print("[OK] 检测到已运行的 V1.3 服务，直接复用：{}".format(url))
            if args.open_browser:
                open_url(url)
            return
    port = next((candidate for candidate in ports if _port_available(candidate)), None)
    if port is None:
        raise RuntimeError("端口 {}-{} 均不可用。".format(args.port, args.port + 10))
    if port != args.port:
        print("[INFO] {} 端口被其他程序占用，自动改用 {}。".format(args.port, port))
    url = "http://127.0.0.1:{}/index.html".format(port)
    print("[OK] Local service ready")
    print("[OK] Drawing recognition API ready")
    print("[OK] Opening V1.3 Demo: {}".format(url))
    print("READY")
    print("服务运行中。关闭此窗口或按 Ctrl+C 可停止服务。")
    if args.open_browser:
        threading.Timer(0.8, lambda: open_url(url)).start()
    create_app().run(host="127.0.0.1", port=port, threaded=True, use_reloader=False)


if __name__ == "__main__":
    import sys
    if "--ocr-worker" in sys.argv:
        marker = sys.argv.index("--ocr-worker")
        sys.argv = [sys.argv[0], *sys.argv[marker + 1:]]
        from src.main import main as ocr_main
        raise SystemExit(ocr_main())
    main()
