"""只读提取施工方案 DOCX 的正文、表格和关键词证据。"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from typing import Any

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


KEYWORDS = [
    "表4.7-1", "表 4.7-1", "主线隧道主要衬砌支护参数表", "ZZ-Va", "Ⅴa", "Va", "V级",
    "仰拱初支", "仰拱支护", "仰拱钢架", "仰拱喷射混凝土", "封闭成环", "钢架落底", "钢架基础", "钢架接腿",
    "钢筋网", "绑扎", "焊接", "固定", "联结", "钎钉", "喷射混凝土", "仰拱混凝土", "填充混凝土",
    "开挖轮廓", "仰拱开挖", "预留变形", "超欠挖", "仰拱底", "台阶法", "全断面法",
]


def _clean(text: str) -> str:
    return " ".join(text.replace("\u3000", " ").split())


def _table_payload(table: Table, index: int) -> dict[str, Any]:
    rows = []
    for row in table.rows:
        rows.append([_clean(cell.text) for cell in row.cells])
    return {"table_index": index, "rows": rows, "row_count": len(rows), "column_count": max((len(r) for r in rows), default=0)}


def audit(docx_path: Path, output_dir: Path) -> dict[str, Any]:
    docx_path = Path(docx_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    document = Document(docx_path)
    paragraphs = []
    tables = []
    ordered = []
    table_index = 0
    paragraph_index = 0
    for item in document.iter_inner_content():
        if isinstance(item, Paragraph):
            text = _clean(item.text)
            record = {"kind": "paragraph", "paragraph_index": paragraph_index, "style": item.style.name, "text": text}
            paragraphs.append(record)
            ordered.append(record)
            paragraph_index += 1
        elif isinstance(item, Table):
            payload = _table_payload(item, table_index)
            tables.append(payload)
            ordered.append({"kind": "table", "table_index": table_index, "text": " | ".join(" / ".join(r) for r in payload["rows"])})
            table_index += 1

    hits = []
    for order_index, item in enumerate(ordered):
        text = item.get("text", "")
        matched = [keyword for keyword in KEYWORDS if keyword in text]
        if matched:
            hits.append({"order_index": order_index, **item, "matched_keywords": matched})

    core = document.core_properties
    metadata = {
        "source_file": docx_path.name,
        "byte_length": docx_path.stat().st_size,
        "paragraph_count": len(paragraphs),
        "table_count": len(tables),
        "section_count": len(document.sections),
        "core_properties": {
            "title": core.title, "subject": core.subject, "author": core.author,
            "created": core.created.isoformat() if core.created else None,
            "modified": core.modified.isoformat() if core.modified else None,
            "last_modified_by": core.last_modified_by,
        },
    }
    with zipfile.ZipFile(docx_path) as archive:
        metadata["embedded_media"] = [name for name in archive.namelist() if name.startswith("word/media/")]
        app_xml = archive.read("docProps/app.xml").decode("utf-8", errors="replace")
        page_match = re.search(r"<Pages>(\d+)</Pages>", app_xml)
        metadata["reported_pages"] = int(page_match.group(1)) if page_match else None

    (output_dir / "construction_plan_metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "construction_plan_tables.json").write_text(json.dumps(tables, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "construction_plan_keyword_hits.json").write_text(json.dumps(hits, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "construction_plan_full_text.txt").write_text("\n".join(f"P{x['paragraph_index']:04d}\t{x['style']}\t{x['text']}" for x in paragraphs if x["text"]), encoding="utf-8")
    return {"metadata": metadata, "tables": tables, "hits": hits, "ordered": ordered}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    result = audit(args.docx, args.output_dir)
    print(json.dumps({"paragraphs": result["metadata"]["paragraph_count"], "tables": result["metadata"]["table_count"], "hits": len(result["hits"]), "reported_pages": result["metadata"]["reported_pages"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
