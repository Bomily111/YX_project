"""ZZ-Va N1/N2钢筋大样：标题定位、高清局部OCR、空间归属与证据保存。"""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

from component_presence import pdf_text_records, detect_titles
from extractor.rebar import extract_rebar
from pdf_export import save_json
from pdf_io import render_page
from rebar_visualize import visualize_rebar


def box_rect(box):
    points = np.asarray(box, dtype=float)
    return [float(points[:,0].min()), float(points[:,1].min()),
            float(points[:,0].max()), float(points[:,1].max())]


def rebar_roi(anchor, image_size):
    """大样标题在图下方；按标题宽度向上展开，不使用固定页码或参数值。"""
    width, height = image_size
    x0, y0, x1, _ = anchor["anchor_bbox"]
    title_width = x1 - x0
    cx = (x0 + x1) / 2
    half = min(width * .28, max(title_width * 3.4, width * .17))
    return [max(0, int(cx-half)), max(0, int(y0-title_width*5.6)),
            min(width, int(cx+half)), max(1, int(y0-20))]


def local_ocr_four_rotations(image, engine, page, roi):
    x0, y0, x1, y1 = roi
    crop = image.crop(tuple(roi))
    width, height = crop.size
    observations = []
    transforms = {
        0: None,
        90: Image.Transpose.ROTATE_90,
        180: Image.Transpose.ROTATE_180,
        270: Image.Transpose.ROTATE_270,
    }
    for rotation, transpose in transforms.items():
        view = crop if transpose is None else crop.transpose(transpose)
        for row in engine.recognize(view):
            points = np.asarray(row["box"], dtype=float)
            if rotation == 90:
                points = np.column_stack((width-points[:,1], points[:,0]))
            elif rotation == 180:
                points = np.column_stack((width-points[:,0], height-points[:,1]))
            elif rotation == 270:
                points = np.column_stack((points[:,1], height-points[:,0]))
            points += [x0, y0]
            observations.append({**row, "box": points.tolist(), "page": page,
                                 "rotation": rotation, "stage": "rebar_local", "roi": roi})
    return crop, observations


def pdf_rows_in_roi(rows, roi):
    x0, y0, x1, y1 = roi
    kept = []
    for row in rows:
        bx0, by0, bx1, by1 = box_rect(row["box"])
        cx, cy = (bx0+bx1)/2, (by0+by1)/2
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            kept.append(row)
    return kept


def normalize_result(evidence):
    output = {
        "N1": {"diameter_mm": None, "length_mm": None,
               **{f"R{i}_mm": None for i in range(1,5)}},
        "N2": {"diameter_mm": None, "length_mm": None,
               **{f"r{i}_mm": None for i in range(1,5)}},
        "angles": {f"angle_{name}_raw": None for name in "ABC"} |
                  {f"angle_{name}_deg": None for name in "ABC"},
    }
    for field, item in evidence.items():
        value = item["value"]
        if field.startswith("N1_"):
            output["N1"][field[3:]] = value
        elif field.startswith("N2_"):
            output["N2"][field[3:]] = value
        elif field.startswith("angle_"):
            output["angles"][field+"_raw"] = item.get("raw")
            output["angles"][field+"_deg"] = value
    return output


def process_rebar_page(doc, page_number, support_type, title_anchor, engines, folder, dpi=400):
    whole_engine, local_engine = engines
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    image = render_page(doc[page_number-1], dpi, folder/"page.png")
    whole = [{**row, "page":page_number, "stage":"whole_page"} for row in whole_engine.recognize(image)]
    pdf_rows = pdf_text_records(doc[page_number-1], page_number, dpi)
    save_json(folder/"whole_ocr.json", whole)
    save_json(folder/"pdf_text_records.json", pdf_rows)
    anchors = [a for a in detect_titles(whole+pdf_rows, image.size) if a["component"] == "n1n2_rebar"]
    if not anchors:
        raise RuntimeError(f"第{page_number}页未由高清OCR/PDF文本层确认N1、N2钢筋大样标题")
    anchors.sort(key=lambda item: (item["source"] != "whole_page", -float(item.get("confidence") or 0)))
    anchor = anchors[0]
    roi = rebar_roi(anchor, image.size)
    crop, local = local_ocr_four_rotations(image, local_engine, page_number, roi)
    crop.save(folder/"crop.png", dpi=(dpi,dpi))
    save_json(folder/"local_ocr.json", local)
    pdf_local = pdf_rows_in_roi(pdf_rows, roi)
    combined = local + pdf_local
    diagram_center_x = (roi[0]+roi[2])/2
    evidence, candidates, consistency = extract_rebar(combined, diagram_center_x)
    required = ["N1_diameter_mm", "N1_length_mm", *[f"N1_R{i}_mm" for i in range(1,5)],
                "N2_diameter_mm", "N2_length_mm", *[f"N2_r{i}_mm" for i in range(1,5)],
                "angle_A", "angle_B", "angle_C"]
    missing = [field for field in required if field not in evidence]
    status = "EXTRACTED" if not missing else "PRESENT_BUT_FAILED"
    result = {"support_type":support_type, "source_page":page_number,
              "has_n1n2_rebar":True, "rebar_status":status, "title_anchor":anchor,
              "roi":roi, **normalize_result(evidence), "evidence":evidence,
              "candidates":candidates, "geometry_consistency":consistency,
              "missing_fields":missing,
              "coordinate_system":"400 DPI rendered page pixels; origin top-left; one-based page"}
    save_json(folder/"evidence.json", result)
    visualize_rebar(crop, roi, evidence, folder/"visualized.png")
    image.close()
    return result


def locate_rebar_pages(doc, page_infos, dpi):
    matches = []
    for info in page_infos:
        rows = pdf_text_records(doc[info["page"]-1], info["page"], dpi)
        width = int(round(doc[info["page"]-1].rect.width*dpi/72))
        height = int(round(doc[info["page"]-1].rect.height*dpi/72))
        anchors = [a for a in detect_titles(rows, (width,height)) if a["component"] == "n1n2_rebar"]
        if anchors:
            matches.append({"page":info["page"], "anchors":anchors})
    return matches

