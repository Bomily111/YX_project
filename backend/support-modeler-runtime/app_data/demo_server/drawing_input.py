"""把 PDF/JPG/PNG 统一为 DrawingInput，并复用现有 PDF OCR 入口。"""
from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path

import fitz
from PIL import Image, ImageOps

from .pipeline_adapter import PipelineError


ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class DrawingInput:
    source_type: str
    filename: str
    hash: str
    pages: int
    original_path: str
    normalized_images: list[dict]
    preprocessing_status: str
    pipeline_input: str

    def public_dict(self) -> dict:
        value = asdict(self)
        # 浏览器只需要请求目录内的相对名称，不泄露本机绝对路径。
        value["original_path"] = Path(value["original_path"]).name
        value["pipeline_input"] = Path(value["pipeline_input"]).name
        return value


def _pdf_pages(path: Path, password: str | None = None) -> int:
    password = password if password is not None else __import__("os").getenv("SUPPORT_PDF_PASSWORD", "")
    with fitz.open(path) as document:
        if document.needs_pass and not document.authenticate(password):
            raise PipelineError("PDF_DECRYPTION_FAILED", "PDF 密码认证失败，请检查 SUPPORT_PDF_PASSWORD。")
        return len(document)


def _normalize_image(source: Path, destination: Path) -> tuple[int, int]:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        if image.mode in {"RGBA", "LA"}:
            background = Image.new("RGB", image.size, "white")
            alpha = image.getchannel("A")
            background.paste(image.convert("RGB"), mask=alpha)
            image = background
        else:
            image = image.convert("RGB")
        max_side = 10000
        if max(image.size) > max_side:
            scale = max_side / max(image.size)
            image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "PNG", optimize=True)
        return image.size


def _image_to_pdf(image_path: Path, pdf_path: Path) -> None:
    with Image.open(image_path) as image:
        image.convert("RGB").save(pdf_path, "PDF", resolution=300.0)


def prepare_drawing_input(source: Path, request_dir: Path, source_name: str, pdf_password: str | None = None) -> DrawingInput:
    suffix = Path(source_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise PipelineError("INVALID_DRAWING", "仅支持 PDF、JPG、JPEG 和 PNG 图纸。")
    digest = sha256_file(source)
    if suffix == ".pdf":
        pages = _pdf_pages(source, pdf_password)
        normalized = [{"page": index, "status": "LAZY_RENDER_BY_EXISTING_PDF_ADAPTER"} for index in range(1, pages + 1)]
        return DrawingInput("PDF_DOCUMENT", Path(source_name).name, digest, pages, str(source), normalized,
                            "PDF_AUTHENTICATED_RENDER_DEFERRED", str(source))

    normalized_path = request_dir / "normalized_images" / "page_001.png"
    width, height = _normalize_image(source, normalized_path)
    pipeline_pdf = request_dir / "normalized_image_drawing.pdf"
    _image_to_pdf(normalized_path, pipeline_pdf)
    normalized = [{"page": 1, "path": normalized_path.relative_to(request_dir).as_posix(), "width": width,
                   "height": height, "status": "EXIF_ROTATED_RGB_NORMALIZED"}]
    return DrawingInput("IMAGE_DRAWING", Path(source_name).name, digest, 1, str(source), normalized,
                        "NORMALIZED", str(pipeline_pdf))


def run_existing_image_pipeline(drawing: DrawingInput, request_dir: Path, cache_root: Path) -> tuple[dict, str]:
    """图片直接调用现有 OCREngine/steel_arch extractor；跳过整册 PDF 目录筛页。"""
    import json
    from extractor.steel_arch import extract_with_diagnostics
    from src.ocr_engine import OCREngine
    from src.preprocess import preprocess

    cache = cache_root / drawing.hash / "extraction.json"
    if cache.is_file():
        return json.loads(cache.read_text(encoding="utf-8")), "CACHE_HIT"
    normalized = request_dir / drawing.normalized_images[0]["path"]
    with Image.open(normalized) as opened:
        image = opened.convert("RGB")
        engine = OCREngine(2400)
        records = []
        for mode in ("original", "scale2", "gray2", "contrast2"):
            records.extend(engine.recognize(preprocess(image, mode)))
    extracted, audit = extract_with_diagnostics(records)
    support_type = audit.get("support_type")
    if not support_type:
        raise PipelineError("NO_SUPPORT_TYPE", "图片 OCR 未能识别目标支护类型；已保留规范化图片和 OCR 证据。")
    mapped = {"R1_mm": extracted.get("R1"), "R2_mm": extracted.get("R2"),
              "beta_deg": extracted.get("beta"), "steel_profile": extracted.get("steel_profile")}
    fields = {key: {"value": value, "source_method": "OCR", "confidence": None,
                    "field_status": "FOUND" if value is not None else "NOT_FOUND"}
              for key, value in mapped.items()}
    status = "EXTRACTED" if all(value is not None for value in mapped.values()) else "PARAMETER_INCOMPLETE"
    extraction = {
        "metadata": {"source_pdf": drawing.filename, "pdf_sha256": drawing.hash, "page_count": 1,
                     "input_type": "IMAGE_DRAWING", "recognition_method": "EXISTING_OCR_PIPELINE"},
        "supports": [{"support_type": support_type, "page_numbers": [1],
                      "steel_arch": {"has_component": True, "status": status, "source_pages": [1],
                                     "fields": fields, "ocr_diagnostics": audit}}],
        "review": audit.get("issues", []),
    }
    evidence = request_dir / "image_ocr_records.json"
    evidence.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(extraction, ensure_ascii=False, indent=2), encoding="utf-8")
    return extraction, "OCR_RUN"
