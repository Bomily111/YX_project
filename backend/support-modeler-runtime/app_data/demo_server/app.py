"""本地 PDF → OCR → JSON → 钢架模型桥接服务。"""
from __future__ import annotations

import importlib.util
import json
import logging
import os
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from .pipeline_adapter import DEFAULT_TEMP_ROOT, PipelineError, process_uploaded_pdf, run_existing_pipeline
from .master_pipeline import load_latest_real_cache, process_master_pdf
from .drawing_input import prepare_drawing_input, run_existing_image_pipeline
from src.master_support_demo.payload import SupportParameterPayloadBuilder
from src.steel_profile_database import SteelProfileValidationError, load_steel_profiles, require_steel_profile

ROOT = Path(__file__).resolve().parents[1]
DEMO_FILE = ROOT / "demo" / "pdf_to_steel_arch_demo.html"
BASE_PROFILE_DEMO_FILE = ROOT / "demo" / "ZZ-Va_base_profile_demo.html"
SECONDARY_LINING_DEMO_FILE = ROOT / "demo" / "ZZ-Va_secondary_lining_demo.html"
MASTER_DEMO_FILE = ROOT / "demo" / "ZZ-Va_support_master_demo.html"
MASTER_DEMO_V1_1_FILE = ROOT / "demo" / "ZZ-Va_support_master_demo_v1_1.html"
MASTER_DEMO_V1_2_FILE = ROOT / "demo" / "support_master_demo_v1_2.html"
CENTERLINE_DEMO_FILE = ROOT / "demo" / "tunnel_centerline_demo.html"
REAL_CENTERLINE_DEMO_FILE = ROOT / "demo" / "real_tunnel_1064m_demo.html"
PROFILE_DATABASE = ROOT / "database" / "steel_profiles.json"
MAX_UPLOAD_BYTES = 1024 * 1024 * 1024
VALIDATION_ARTIFACTS = {
    "ZZ-Va_I20a_steel_arch_front.png": ROOT / "outputs" / "presentation" / "ZZ-Va_I20a_steel_arch_front.png",
    "ZZ-Va_I20a_steel_arch_helpers.png": ROOT / "outputs" / "presentation" / "ZZ-Va_I20a_steel_arch_helpers.png",
    "ZZ-Va_I20a_steel_arch_profile_info.png": ROOT / "outputs" / "presentation" / "ZZ-Va_I20a_steel_arch_profile_info.png",
    "ZZ-Va_I20a_steel_arch.glb": ROOT / "outputs" / "I20a_validation" / "ZZ-Va_I20a_steel_arch.glb",
}


def create_app(temp_root: Path | None = None, pipeline_runner=None) -> Flask:
    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES,
        TEMP_ROOT=Path(temp_root or DEFAULT_TEMP_ROOT),
        PIPELINE_RUNNER=pipeline_runner or run_existing_pipeline,
    )
    app.config["TEMP_ROOT"].mkdir(parents=True, exist_ok=True)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    @app.get("/")
    @app.get("/demo/pdf_to_steel_arch_demo.html")
    def demo_page():
        return send_from_directory(DEMO_FILE.parent, DEMO_FILE.name)

    @app.get("/demo/ZZ-Va_base_profile_demo.html")
    def base_profile_demo_page():
        return send_from_directory(BASE_PROFILE_DEMO_FILE.parent, BASE_PROFILE_DEMO_FILE.name)

    @app.get("/demo/ZZ-Va_secondary_lining_demo.html")
    def secondary_lining_demo_page():
        return send_from_directory(SECONDARY_LINING_DEMO_FILE.parent, SECONDARY_LINING_DEMO_FILE.name)

    @app.get("/demo/ZZ-Va_support_master_demo.html")
    def master_demo_page():
        return send_from_directory(MASTER_DEMO_FILE.parent, MASTER_DEMO_FILE.name)

    @app.get("/demo/ZZ-Va_support_master_demo_v1_1.html")
    def master_demo_v1_1_page():
        return send_from_directory(MASTER_DEMO_V1_1_FILE.parent, MASTER_DEMO_V1_1_FILE.name)

    @app.get("/demo/support_master_demo_v1_2.html")
    def master_demo_v1_2_page():
        return send_from_directory(MASTER_DEMO_V1_2_FILE.parent, MASTER_DEMO_V1_2_FILE.name)

    @app.get("/demo/tunnel_centerline_demo.html")
    def centerline_demo_page():
        return send_from_directory(CENTERLINE_DEMO_FILE.parent, CENTERLINE_DEMO_FILE.name)

    @app.get("/demo/real_tunnel_1064m_demo.html")
    def real_centerline_demo_page():
        return send_from_directory(REAL_CENTERLINE_DEMO_FILE.parent, REAL_CENTERLINE_DEMO_FILE.name)

    @app.get("/demo/centerline/<path:asset_name>")
    def centerline_demo_asset(asset_name: str):
        response = send_from_directory(ROOT / "demo" / "centerline", asset_name)
        if Path(asset_name).suffix.lower() in {".js", ".mjs"}:
            response.mimetype = "text/javascript"
        return response

    @app.get("/demo/v1_1/<path:asset_name>")
    def master_demo_v1_1_asset(asset_name: str):
        response = send_from_directory(ROOT / "demo" / "v1_1", asset_name)
        if Path(asset_name).suffix.lower() in {".js", ".mjs"}:
            response.mimetype = "text/javascript"
        return response

    @app.get("/demo/v1_2/<path:asset_name>")
    def master_demo_v1_2_asset(asset_name: str):
        response = send_from_directory(ROOT / "demo" / "v1_2", asset_name)
        if Path(asset_name).suffix.lower() in {".js", ".mjs"}:
            response.mimetype = "text/javascript"
        return response

    @app.get("/demo/vendor/<path:asset_name>")
    def master_demo_vendor_asset(asset_name: str):
        response = send_from_directory(ROOT / "demo" / "vendor_runtime" / "node_modules" / "three", asset_name)
        if Path(asset_name).suffix.lower() in {".js", ".mjs"}:
            response.mimetype = "text/javascript"
        return response

    @app.get("/outputs/master_demo/<artifact_name>")
    def master_demo_artifact(artifact_name: str):
        allowed = {
            "ZZ-Va_support_1m_current.glb", "ZZ-Va_support_1m_current_metadata.json", "ZZ-Va_support_master_state.json",
            "latest_support_payload.json", "ZZ-Va_from_pdf_support_1m.glb", "ZZ-Va_from_pdf_support_1m_metadata.json",
            "support_payloads_v1_2.json",
        }
        if artifact_name not in allowed:
            return _error("MASTER_ARTIFACT_NOT_ALLOWED", "总控Demo产物名称不在白名单中。", 404)
        return send_from_directory(ROOT / "outputs" / "master_demo", artifact_name)

    @app.get("/outputs/multi_support/<artifact_name>")
    def multi_support_artifact(artifact_name: str):
        allowed = {
            "ZZ-IVa_support_1m.glb",
            "ZZ-IVa_support_1m_metadata.json",
            "ZZ-IVa_parameter_inventory.json",
            "ZZ-IVb_support_1m.glb",
            "ZZ-IVb_support_1m_metadata.json",
            "ZZ-IVb_parameter_inventory.json",
            "ZZ-S_support_1m.glb",
            "ZZ-S_support_1m_metadata.json",
            "ZZ-S_parameter_inventory.json",
            "ZZ-II_support_1m.glb", "ZZ-II_support_1m_metadata.json",
            "ZZ-III_support_1m.glb", "ZZ-III_support_1m_metadata.json",
            "ZZ-IIIx_support_1m.glb", "ZZ-IIIx_support_1m_metadata.json",
            "ZZ-Y1_support_1m.glb", "ZZ-Y1_support_1m_metadata.json",
            "ZZ-IVc_support_1m.glb", "ZZ-IVc_support_1m_metadata.json",
            "ZZ-IVx_support_1m.glb", "ZZ-IVx_support_1m_metadata.json",
            "ZZ-IVsx_support_1m.glb", "ZZ-IVsx_support_1m_metadata.json",
            "ZZ-Vsx_support_1m.glb", "ZZ-Vsx_support_1m_metadata.json",
            "ZZ-QJsx_support_1m.glb", "ZZ-QJsx_support_1m_metadata.json",
        }
        if artifact_name not in allowed:
            return _error("MULTI_SUPPORT_ARTIFACT_NOT_ALLOWED", "多支护类型产物名称不在白名单中。", 404)
        return send_from_directory(ROOT / "outputs" / "multi_support", artifact_name)

    @app.get("/outputs/centerline/<artifact_name>")
    def centerline_artifact(artifact_name: str):
        allowed = {
            "tunnel_support_0_100m.glb",
            "tunnel_support_0_100m.metadata.json",
            "real_centerline_0_1064m.json",
            "real_YK1+098_YK2+162_support.glb",
            "real_YK1+098_YK2+162_support.metadata.json",
        }
        if artifact_name not in allowed:
            return _error("CENTERLINE_ARTIFACT_NOT_ALLOWED", "CenterLine产物名称不在白名单中。", 404)
        return send_from_directory(ROOT / "outputs" / "centerline", artifact_name)

    @app.get("/config/centerLine_demo_0_100m.json")
    def centerline_demo_input():
        return send_from_directory(ROOT / "config", "centerLine_demo_0_100m.json")

    @app.get("/outputs/lock_foot_anchor/ZZ-Va_lock_foot_anchor_geometry.json")
    def master_lock_geometry():
        return send_from_directory(ROOT / "outputs" / "lock_foot_anchor", "ZZ-Va_lock_foot_anchor_geometry.json")

    @app.get("/outputs/base_profile/<artifact_name>")
    def base_profile_artifact(artifact_name: str):
        allowed = {"ZZ-Va_base_profile_parameters.json", "ZZ-Va_section_geometry.json", "ZZ-Va_inner_profile_geometry.json"}
        if artifact_name not in allowed:
            return _error("BASE_PROFILE_ARTIFACT_NOT_ALLOWED", "基础断面产物名称不在白名单中。", 404)
        return send_from_directory(ROOT / "outputs" / "base_profile", artifact_name)

    @app.get("/outputs/secondary_lining/<artifact_name>")
    def secondary_lining_artifact(artifact_name: str):
        allowed = {"ZZ-Va_secondary_lining_parameters.json", "ZZ-Va_secondary_lining_geometry.json", "ZZ-Va_secondary_lining.glb"}
        if artifact_name not in allowed:
            return _error("SECONDARY_LINING_ARTIFACT_NOT_ALLOWED", "二衬产物名称不在白名单中。", 404)
        return send_from_directory(ROOT / "outputs" / "secondary_lining", artifact_name)

    @app.post("/api/secondary-lining-artifacts/ZZ-Va_secondary_lining.glb")
    def save_secondary_lining_glb():
        """接收本地Demo中Three.js GLTFExporter生成的最终GLB。"""
        from src.secondary_lining.gltf import inspect_glb

        payload = request.get_data(cache=False)
        if not payload.startswith(b"glTF"):
            return _error("SECONDARY_LINING_GLB_INVALID", "Three.js导出的GLB格式无效。", 400)
        destination = ROOT / "outputs" / "secondary_lining" / "ZZ-Va_secondary_lining.glb"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
        try:
            metadata = inspect_glb(destination)
        except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
            destination.unlink(missing_ok=True)
            return _error("SECONDARY_LINING_GLB_INVALID", str(exc), 400)
        metadata.update({"path": destination.relative_to(ROOT).as_posix(), "exporter": "THREE.GLTFExporter r128", "status": "EXPORTED"})
        geometry_path = ROOT / "outputs" / "secondary_lining" / "ZZ-Va_secondary_lining_geometry.json"
        integrated_path = ROOT / "outputs" / "base_profile" / "ZZ-Va_section_geometry.json"
        if geometry_path.is_file():
            geometry = json.loads(geometry_path.read_text(encoding="utf-8"))
            geometry["glb"] = metadata
            geometry["status"] = "SECONDARY_LINING_IMPLEMENTED"
            geometry_path.write_text(json.dumps(geometry, ensure_ascii=False, indent=2), encoding="utf-8")
        if integrated_path.is_file():
            integrated = json.loads(integrated_path.read_text(encoding="utf-8"))
            if geometry_path.is_file():
                integrated["secondary_lining"] = geometry
            integrated_path.write_text(json.dumps(integrated, ensure_ascii=False, indent=2), encoding="utf-8")
        return jsonify(metadata)

    @app.get("/database/steel_profiles.json")
    @app.get("/api/steel-profiles")
    def steel_profiles():
        """把共享数据库原样提供给前端，同时执行严格字段校验。"""
        try:
            profiles = load_steel_profiles(PROFILE_DATABASE)
            for profile_name in profiles:
                require_steel_profile(profile_name, PROFILE_DATABASE)
            return jsonify(profiles)
        except (OSError, json.JSONDecodeError, SteelProfileValidationError) as exc:
            code = exc.code if isinstance(exc, SteelProfileValidationError) else "STEEL_PROFILE_DATABASE_INVALID"
            return _error(code, str(exc), 500)

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "service": "SupportParameterExtractor",
            "api_version": "1.1",
            "ocr_available": (ROOT / "src" / "main.py").is_file() and importlib.util.find_spec("rapidocr_onnxruntime") is not None,
            "model_demo_available": DEMO_FILE.is_file(),
            "master_demo_v1_1_available": MASTER_DEMO_V1_1_FILE.is_file(),
            "master_demo_v1_2_available": MASTER_DEMO_V1_2_FILE.is_file(),
        })

    @app.post("/api/validation-artifacts/<artifact_name>")
    def save_validation_artifact(artifact_name: str):
        """仅保存白名单中的本地回归产物，不参与生产识别或建模。"""
        destination = VALIDATION_ARTIFACTS.get(artifact_name)
        if destination is None:
            return _error("VALIDATION_ARTIFACT_NOT_ALLOWED", "验证产物名称不在白名单中。", 400)
        payload = request.get_data(cache=False)
        expected_magic = b"glTF" if destination.suffix == ".glb" else b"\x89PNG\r\n\x1a\n"
        if not payload.startswith(expected_magic):
            return _error("VALIDATION_ARTIFACT_INVALID", "验证产物格式无效。", 400)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
        return jsonify({"status": "saved", "path": destination.relative_to(ROOT).as_posix(), "byte_length": len(payload)})

    @app.get("/api/results/<request_id>")
    def request_result(request_id: str):
        if len(request_id) != 32 or any(char not in "0123456789abcdef" for char in request_id.lower()):
            return _error("INVALID_REQUEST_ID", "请求编号无效。", 400)
        result_path = app.config["TEMP_ROOT"] / request_id / "extracted_parameters.json"
        if not result_path.is_file():
            return _error("RESULT_NOT_FOUND", "没有找到该次识别结果。", 404)
        try:
            return jsonify(json.loads(result_path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            return _error("JSON_ADAPTER_FAILED", "本次识别结果无法读取。", 500)

    @app.post("/api/extract")
    def extract():
        started = time.perf_counter()
        upload = request.files.get("file")
        if upload is None:
            return _error("FILE_MISSING", "请选择需要识别的 PDF 文件。", 400)
        source_name = Path(upload.filename or "").name
        if not source_name or Path(source_name).suffix.lower() != ".pdf":
            return _error("INVALID_FILE_TYPE", "只接受 PDF 文件。", 400)

        request_id = uuid.uuid4().hex
        request_dir = app.config["TEMP_ROOT"] / request_id
        request_dir.mkdir(parents=True)
        pdf_path = request_dir / "input.pdf"
        upload.save(pdf_path)
        try:
            if pdf_path.stat().st_size == 0:
                raise PipelineError("EMPTY_PDF", "PDF 文件为空。")
            with pdf_path.open("rb") as stream:
                if stream.read(5) != b"%PDF-":
                    raise PipelineError("INVALID_PDF", "文件内容不是有效 PDF。")
            result = process_uploaded_pdf(
                pdf_path,
                request_dir,
                request_id,
                source_name,
                runner=app.config["PIPELINE_RUNNER"],
            )
            summary = [item.get("support_type") for item in result["supports"] if item.get("page_numbers")]
            _append_request_log(request_dir, {
                "request_id": request_id,
                "file_name": source_name,
                "timestamp": result["timestamp"],
                "support_types": summary,
                "ocr_status": "ok",
                "elapsed_seconds": round(time.perf_counter() - started, 3),
                "errors": [],
            })
            return jsonify(result)
        except PipelineError as exc:
            pdf_path.unlink(missing_ok=True)
            _append_request_log(request_dir, {
                "request_id": request_id,
                "file_name": source_name,
                "ocr_status": "error",
                "elapsed_seconds": round(time.perf_counter() - started, 3),
                "errors": [exc.code],
            })
            return _error(exc.code, exc.message, 422, exc.details, request_id)
        except Exception:
            pdf_path.unlink(missing_ok=True)
            _append_request_log(request_dir, {"request_id": request_id, "file_name": source_name, "ocr_status": "error", "errors": ["BACKEND_ERROR"]})
            return _error("BACKEND_ERROR", "本地识别服务发生异常，请查看本次请求日志。", 500, request_id=request_id)

    @app.post("/api/master/extract")
    def master_extract():
        upload = request.files.get("file")
        if upload is None:
            return _error("FILE_MISSING", "请选择需要识别的 PDF 文件。", 400)
        source_name = Path(upload.filename or "").name
        if not source_name or Path(source_name).suffix.lower() != ".pdf":
            return _error("INVALID_FILE_TYPE", "只接受 PDF 文件。", 400)
        request_id = uuid.uuid4().hex; request_dir = app.config["TEMP_ROOT"] / request_id; request_dir.mkdir(parents=True)
        pdf_path = request_dir / "input.pdf"; upload.save(pdf_path)
        try:
            with pdf_path.open("rb") as stream:
                header = stream.read(5)
            if pdf_path.stat().st_size == 0 or header != b"%PDF-":
                raise PipelineError("INVALID_PDF", "文件内容不是有效 PDF。")
            return jsonify(process_master_pdf(pdf_path, source_name, request_dir, app.config["PIPELINE_RUNNER"]))
        except PipelineError as exc:
            return _error(exc.code, exc.message, 422, exc.details, request_id)
        except Exception as exc:
            _append_request_log(request_dir, {"request_id": request_id, "file_name": source_name, "errors": ["MASTER_PIPELINE_ERROR"], "detail": str(exc)})
            return _error("MASTER_PIPELINE_ERROR", "PDF到总控模型流程失败，请查看本次请求日志。", 500, request_id=request_id)
        finally:
            pdf_path.unlink(missing_ok=True)

    @app.post("/api/master/drawing")
    def master_drawing_extract():
        upload = request.files.get("file")
        if upload is None:
            return _error("FILE_MISSING", "请选择需要识别的图纸。", 400)
        source_name = Path(upload.filename or "").name
        if not source_name or Path(source_name).suffix.lower() not in {".pdf", ".jpg", ".jpeg", ".png"}:
            return _error("INVALID_FILE_TYPE", "图纸仅支持 PDF、JPG、JPEG 和 PNG。", 400)
        request_id = uuid.uuid4().hex
        request_dir = app.config["TEMP_ROOT"] / request_id
        request_dir.mkdir(parents=True)
        source_path = request_dir / ("original" + Path(source_name).suffix.lower())
        upload.save(source_path)
        try:
            if source_path.stat().st_size == 0:
                raise PipelineError("INVALID_DRAWING", "上传图纸为空文件。")
            drawing = prepare_drawing_input(source_path, request_dir, source_name)
            if drawing.source_type == "PDF_DOCUMENT":
                result = process_master_pdf(Path(drawing.pipeline_input), source_name, request_dir, app.config["PIPELINE_RUNNER"])
            else:
                extraction, cache_status = run_existing_image_pipeline(
                    drawing, request_dir, ROOT / "outputs" / "master_demo" / "drawing_cache"
                )
                payloads = SupportParameterPayloadBuilder(ROOT).build_all(
                    extraction, drawing.hash, "EXISTING_OCR_PIPELINE" if cache_status == "OCR_RUN" else "PREVIOUS_REAL_OCR_CACHE"
                )
                if not payloads:
                    raise PipelineError("NO_SUPPORT_TYPE", "图片 OCR 未能生成可用支护参数。")
                selected = "ZZ-Va" if "ZZ-Va" in payloads else next(iter(payloads))
                result = {"status": "ok", "processing_state": "MODEL_READY" if payloads[selected]["model_ready"] else "PARAMETER_INCOMPLETE",
                          "cache_status": cache_status, "pdf_sha256": drawing.hash, "source_file": source_name,
                          "support_types": list(payloads), "selected_support_type": selected, "payload": payloads[selected],
                          "payloads": payloads, "model": {"glb_url": "/outputs/master_demo/ZZ-Va_support_1m_current.glb",
                          "metadata_url": "/outputs/master_demo/ZZ-Va_support_1m_current_metadata.json"} if selected == "ZZ-Va" else None}
            result["drawing_input"] = drawing.public_dict()
            result["drawing_hash"] = drawing.hash
            result["recognition_method"] = "EXISTING_OCR_PIPELINE" if result["cache_status"] == "OCR_RUN" else "REAL_OCR_CACHE"
            return jsonify(result)
        except PipelineError as exc:
            return _error(exc.code, exc.message, 422, exc.details, request_id)
        except Exception as exc:
            _append_request_log(request_dir, {"request_id": request_id, "file_name": source_name,
                                              "errors": ["DRAWING_PIPELINE_ERROR"], "detail": str(exc)})
            return _error("DRAWING_PIPELINE_ERROR", "图纸到总控模型流程失败，请查看本次请求日志。", 500,
                          request_id=request_id)

    @app.get("/api/master/demo-cache")
    def master_demo_cache():
        try:
            return jsonify(load_latest_real_cache())
        except PipelineError as exc:
            return _error(exc.code, exc.message, 404, exc.details)
        except Exception as exc:
            # 缓存只是演示入口，损坏缓存不能让整个 Demo 或 Flask 服务失败。
            app.logger.warning("demo-cache compatibility check failed: %s", type(exc).__name__)
            return jsonify({
                "status": "unavailable",
                "processing_state": "CACHE_UNAVAILABLE",
                "cache_status": "CACHE_SCHEMA_INCOMPATIBLE",
                "message": "OCR缓存无法读取，可上传图纸重新识别。",
                "payloads": {},
            })

    @app.errorhandler(413)
    def too_large(_error_value):
        return _error("FILE_TOO_LARGE", "PDF 文件超过 1 GB 上传限制。", 413)

    return app


def _append_request_log(request_dir: Path, record: dict) -> None:
    with (request_dir / "run.log").open("a", encoding="utf-8") as stream:
        stream.write("\nDEMO_REQUEST " + json.dumps(record, ensure_ascii=False) + "\n")


def _error(code: str, message: str, status_code: int, details: str | None = None, request_id: str | None = None):
    payload = {"status": "error", "error_code": code, "message": message, "details": details}
    if request_id:
        payload["request_id"] = request_id
    return jsonify(payload), status_code


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("DEMO_PORT", "8000")), debug=False)
