"""ZZ-Va 基础内轮廓来源审计。

本脚本只生成审计中间结果，不修改生产 JSON、Ground Truth 或几何公式。
PDF 密码仅从 SUPPORT_PDF_PASSWORD 环境变量读取，并且不会写入日志。
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from ocr_engine import OCREngine  # noqa: E402
from pdf_io import open_pdf, render_page  # noqa: E402


KEYWORDS = [
    "内轮廓", "隧道内轮廓", "衬砌内轮廓", "二衬内轮廓", "净空", "建筑限界",
    "标准断面", "断面", "衬砌断面", "拱墙", "顶拱", "侧拱", "仰拱", "仰拱半径",
    "半径", "R=", "R1", "R2", "圆心", "曲线要素", "轮廓参数", "设计轮廓",
    "开挖轮廓", "开挖断面", "预留变形量", "详见", "见图", "采用", "适用于",
    "内轮廓同", "同心", "等厚", "偏移", "衬砌厚度",
    "ZZ-Va", "Va", "Ⅴa", "V-a", "V级", "Ⅴ级",
]


def normalized(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text)).upper()


def dump_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def extract_docx(docx_path: Path, out_dir: Path, engine: OCREngine) -> dict:
    """抽取 Word 文本、表格可见文字和媒体图片，并对图片做 OCR。"""
    media_dir = out_dir / "parameter_docx_media"
    media_dir.mkdir(parents=True, exist_ok=True)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(docx_path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        paragraphs = []
        for p in root.findall(".//w:p", ns):
            text = "".join((t.text or "") for t in p.findall(".//w:t", ns)).strip()
            if text:
                paragraphs.append(text)
        media_names = sorted(
            name for name in archive.namelist()
            if name.startswith("word/media/") and not name.endswith("/")
        )
        for name in media_names:
            target = media_dir / Path(name).name
            target.write_bytes(archive.read(name))

    raw_text = "\n".join(paragraphs)
    (out_dir / "parameter_recognition_docx_text.txt").write_text(raw_text, encoding="utf-8")
    image_results = []
    for index, image_path in enumerate(sorted(media_dir.iterdir()), start=1):
        try:
            with Image.open(image_path) as image:
                width, height = image.size
                records = engine.recognize(image.convert("RGB"))
            text = "\n".join(record["text"] for record in records)
            image_results.append({
                "image": image_path.name,
                "width": width,
                "height": height,
                "text": text,
                "ocr": records,
                "matched_keywords": [word for word in KEYWORDS if normalized(word) in normalized(text)],
            })
            print(f"Word 图片 OCR {index}/{len(media_names)}: {image_path.name}", flush=True)
        except Exception as exc:  # 保留单图失败，不中断整个审计
            image_results.append({"image": image_path.name, "error": str(exc), "ocr": []})
    result = {
        "source": docx_path.name,
        "paragraph_count": len(paragraphs),
        "raw_text": raw_text,
        "images": image_results,
        "notice": "Word 中的示例值仅用于字段定义和公式理解，不作为 ZZ-Va 工程真值。",
    }
    dump_json(out_dir / "parameter_recognition_docx_audit.json", result)
    return result


def text_layer_index(pdf_path: Path, out_dir: Path) -> tuple[list[dict], dict]:
    doc, auth = open_pdf(pdf_path)
    pages = []
    try:
        for index, page in enumerate(doc):
            text = page.get_text("text", sort=True)
            compact = normalized(text)
            pages.append({
                "page": index + 1,
                "text": text,
                "text_chars": len(compact),
                "matched_keywords": [word for word in KEYWORDS if normalized(word) in compact],
                "radius_tokens": sorted(set(re.findall(r"(?i)R\s*[0-9A-Z]?(?:\s*[=＝-]\s*)?\d{3,5}", text))),
                "angle_tokens": sorted(set(re.findall(r"\d{1,3}\s*[°º]\s*\d{0,2}\s*[′']?\s*\d{0,2}\s*[″\"]?", text))),
                "size_pt": [page.rect.width, page.rect.height],
            })
            if (index + 1) % 50 == 0:
                print(f"PDF 文本层索引 {index + 1}/{len(doc)}", flush=True)
    finally:
        doc.close()
    dump_json(out_dir / "page_text_layer_index.json", {"authentication": auth, "pages": pages})
    return pages, auth


def ocr_pages(pdf_path: Path, page_numbers: list[int], out_dir: Path, dpi: int, engine: OCREngine) -> list[dict]:
    """对指定页做低/中分辨率 OCR；高分辨率候选页另由 render-high 执行。"""
    doc, _ = open_pdf(pdf_path)
    results = []
    try:
        for position, page_number in enumerate(page_numbers, start=1):
            page = doc[page_number - 1]
            image = render_page(page, dpi=dpi, screening=dpi not in (300, 400, 500, 600))
            records = engine.recognize(image)
            text = "\n".join(record["text"] for record in records)
            compact = normalized(text)
            result = {
                "page": page_number,
                "dpi": dpi,
                "text": text,
                "ocr": records,
                "matched_keywords": [word for word in KEYWORDS if normalized(word) in compact],
                "radius_tokens": sorted(set(re.findall(r"(?i)R\s*[0-9A-Z]?(?:\s*[=＝-]\s*)?\d{3,5}", text))),
                "angle_tokens": sorted(set(re.findall(r"\d{1,3}\s*[°º]\s*\d{0,2}\s*[′']?\s*\d{0,2}\s*[″\"]?", text))),
            }
            dump_json(out_dir / "page_ocr" / f"page_{page_number:04d}_{dpi}dpi.json", result)
            results.append(result)
            print(f"PDF OCR {position}/{len(page_numbers)}: page {page_number}", flush=True)
    finally:
        doc.close()
    return results


def render_high(pdf_path: Path, page_numbers: list[int], out_dir: Path, dpi: int) -> None:
    doc, _ = open_pdf(pdf_path)
    try:
        for position, page_number in enumerate(page_numbers, start=1):
            target = out_dir / f"page_{page_number:03d}.png"
            render_page(doc[page_number - 1], dpi=dpi, output=target)
            print(f"高清渲染 {position}/{len(page_numbers)}: {target.name}", flush=True)
    finally:
        doc.close()


def parse_pages(spec: str) -> list[int]:
    values: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = (int(x) for x in part.split("-", 1))
            values.update(range(start, end + 1))
        else:
            values.add(int(part))
    return sorted(values)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--docx", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "base_profile_candidates")
    parser.add_argument("--text-index", action="store_true")
    parser.add_argument("--docx-audit", action="store_true")
    parser.add_argument("--ocr-pages", default="")
    parser.add_argument("--ocr-dpi", type=int, default=120)
    parser.add_argument("--render-pages", default="")
    parser.add_argument("--render-dpi", type=int, default=350)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    engine = None
    if args.docx_audit or args.ocr_pages:
        engine = OCREngine(1800, 2200)
    if args.docx_audit:
        if not args.docx:
            parser.error("--docx-audit 需要 --docx")
        extract_docx(args.docx, args.output, engine)
    if args.text_index:
        text_layer_index(args.pdf, args.output)
    if args.ocr_pages:
        ocr_pages(args.pdf, parse_pages(args.ocr_pages), args.output, args.ocr_dpi, engine)
    if args.render_pages:
        render_high(args.pdf, parse_pages(args.render_pages), args.output, args.render_dpi)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
