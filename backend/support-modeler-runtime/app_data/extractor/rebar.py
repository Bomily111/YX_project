"""N1/N2钢筋大样关键参数提取；仅依赖文字、坐标与工程一致性，不读取真值。"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from statistics import median

from extractor.steel_arch import DMS, clean, parse_angle


def rect(box):
    xs = [float(p[0]) for p in box]
    ys = [float(p[1]) for p in box]
    return [min(xs), min(ys), max(xs), max(ys)]


def center(item):
    x0, y0, x1, y1 = item["bbox"]
    return (x0 + x1) / 2, (y0 + y1) / 2


def make_candidate(record, value, kind, **extra):
    stage = record.get("stage")
    rotation = record.get("rotation", 0)
    if stage == "pdf_text":
        source_method = "PDF_TEXT"
    elif rotation:
        source_method = "ROTATED_OCR"
    else:
        source_method = "OCR"
    return {
        "kind": kind,
        "value": value,
        "raw_text": record["text"],
        "source_text": record["text"],
        "page": record["page"],
        "bbox": [round(v, 2) for v in rect(record["box"])],
        "ocr_confidence": record.get("confidence"),
        "confidence": record.get("confidence"),
        "source_method": source_method,
        "stage": stage,
        "rotation": rotation,
        **extra,
    }


def parse_candidates(records):
    """保存全部原始候选；OCR大小写只作为提示，不直接决定N1/N2归属。"""
    result = {"diameter": [], "length": [], "radius": [], "angle": []}
    for record in records:
        text = clean(record["text"])
        for match in re.finditer(r"N\s*([12])\s*[^0-9]{0,3}\s*(\d{1,3})(?!\d)", text, re.I):
            value = int(match.group(2))
            if 4 <= value <= 50:
                result["diameter"].append(make_candidate(
                    record, value, "diameter", owner=f"N{match.group(1)}"))
        for match in re.finditer(r"L\s*[=＝\-]\s*(\d{3,6})(?!\d)", text, re.I):
            result["length"].append(make_candidate(record, int(match.group(1)), "length"))
        for match in re.finditer(r"([Rr])\s*([1-4lI])\s*[=＝\-]\s*([0-9O]{3,6})(?!\d)", text):
            index_text = match.group(2)
            index = 1 if index_text in "lI" else int(index_text)
            value = int(match.group(3).replace("O", "0"))
            result["radius"].append(make_candidate(
                record, value, "radius", raw_name=match.group(1) + index_text,
                normalized_name=f"{match.group(1)}{index}", index=index,
                case_hint="upper" if match.group(1) == "R" else "lower"))
        normalized = re.sub(r"(?<=\d)[%/](?=\d{1,2}['\"^])", "°", text)
        normalized = re.sub(r"°[,，/](?=\d)", "°", normalized)
        normalized = re.sub(r"(°\d{1,2})\^(?=\d{1,2}[\"'])", r"\1'", normalized)
        normalized = re.sub(r"(°\d{1,2})\"(?=\d{1,2}[\"'])", r"\1'", normalized)
        for match in re.finditer(r"(?<!\d)" + DMS + r"(?!\d)", normalized):
            try:
                value = parse_angle(match.group(0))
            except ValueError:
                continue
            result["angle"].append(make_candidate(
                record, value, "angle", raw=match.group(0), decimal=value))
    return result


def confidence(candidate):
    value = candidate.get("ocr_confidence")
    return float(value) if value is not None else 0.96


def choose_evidence(items):
    """同值时优先保留真实OCR证据，再按置信度选择。"""
    return max(items, key=lambda item: (item.get("ocr_confidence") is not None, confidence(item)))


def assign_diameter_and_length(candidates):
    assigned = {}
    anchors = {}
    for owner in ("N1", "N2"):
        items = [item for item in candidates["diameter"] if item["owner"] == owner]
        if items:
            counts = Counter(item["value"] for item in items)
            value, count = counts.most_common(1)[0]
            if len(counts) == 1 or count > counts.most_common(2)[1][1]:
                chosen = choose_evidence([item for item in items if item["value"] == value])
                assigned[f"{owner}_diameter_mm"] = {**chosen, "assignment_confidence": 0.98,
                                                     "assignment_basis": f"{owner}编号与直径同一文字框"}
                anchors[owner] = chosen
    available = list(candidates["length"])
    for owner in ("N1", "N2"):
        if owner not in anchors or not available:
            continue
        ax, ay = center(anchors[owner])
        ranked = sorted(available, key=lambda item: math.hypot(center(item)[0] - ax, center(item)[1] - ay))
        chosen = ranked[0]
        available.remove(chosen)
        assigned[f"{owner}_length_mm"] = {**chosen, "assignment_confidence": 0.97,
                                           "assignment_basis": f"与{owner}编号/直径框空间最近"}
    return assigned


def assign_radii(candidates):
    assigned = {}
    by_index = defaultdict(list)
    for item in candidates["radius"]:
        by_index[item["index"]].append(item)
    for index in range(1, 5):
        items = by_index[index]
        counts = Counter(item["value"] for item in items)
        # 左右标注及旋转OCR会重复；取证据最多的两个不同轮廓半径。
        values = sorted(counts, key=lambda value: (counts[value], value), reverse=True)[:2]
        if len(values) != 2:
            continue
        outer, inner = max(values), min(values)
        upper = choose_evidence([item for item in items if item["value"] == outer])
        lower = choose_evidence([item for item in items if item["value"] == inner])
        # N1位于外轮廓，N2位于内轮廓；字符大小写只增加或降低置信度。
        upper_agrees = any(i["case_hint"] == "upper" for i in items if i["value"] == outer)
        lower_agrees = any(i["case_hint"] == "lower" for i in items if i["value"] == inner)
        score = 0.97 if upper_agrees and lower_agrees else 0.90
        assigned[f"N1_R{index}_mm"] = {**upper, "normalized_name": f"R{index}", "assignment_confidence": score,
                                        "assignment_basis":"同编号内外轮廓配对；较大半径归N1外轮廓"}
        assigned[f"N2_r{index}_mm"] = {**lower, "normalized_name": f"r{index}", "assignment_confidence": score,
                                        "assignment_basis":"同编号内外轮廓配对；较小半径归N2内轮廓"}
    deltas = {}
    for index in range(1, 5):
        upper = assigned.get(f"N1_R{index}_mm")
        lower = assigned.get(f"N2_r{index}_mm")
        if upper and lower:
            deltas[f"delta_{index}"] = upper["value"] - lower["value"]
    warning = None
    if len(deltas) == 4:
        middle = median(deltas.values())
        tolerance = max(5.0, abs(middle) * 0.05)
        if any(abs(value - middle) > tolerance for value in deltas.values()):
            warning = "GEOMETRY_CONSISTENCY_WARNING"
        else:
            for key in [k for k in assigned if "_R" in k or "_r" in k]:
                assigned[key]["assignment_confidence"] = min(1.0, assigned[key]["assignment_confidence"] + 0.02)
    else:
        warning = "GEOMETRY_CONSISTENCY_WARNING"
    return assigned, {"deltas_mm": deltas, "median_delta_mm": median(deltas.values()) if deltas else None,
                      "status": warning or "CONSISTENT"}


def assign_angles(candidates, diagram_center_x):
    """排除直角基准，以左右对称同值组的垂直位置依次确定A/B/C。"""
    by_value = defaultdict(list)
    for item in candidates["angle"]:
        if abs(item["value"] - 90.0) <= 0.05:
            continue
        by_value[item["value"]].append(item)
    groups = []
    for value, items in by_value.items():
        left = [item for item in items if center(item)[0] < diagram_center_x]
        right = [item for item in items if center(item)[0] > diagram_center_x]
        pairs = []
        for a in left:
            for b in right:
                ax, ay = center(a); bx, by = center(b)
                symmetry_error = abs((diagram_center_x - ax) - (bx - diagram_center_x))
                if abs(ay - by) <= 180 and symmetry_error <= 260:
                    pairs.append((a, b, symmetry_error + abs(ay - by)))
        if pairs:
            a, b, _ = min(pairs, key=lambda pair: pair[2])
            groups.append({"value": value, "items": items, "pair": (a, b),
                           "y": median([center(a)[1], center(b)[1]])})
    groups.sort(key=lambda group: group["y"])
    assigned = {}
    if len(groups) == 3:
        for label, group in zip(("A", "B", "C"), groups):
            chosen = choose_evidence(group["pair"])
            assigned[f"angle_{label}"] = {
                **chosen, "raw": chosen.get("raw") or chosen["raw_text"],
                "decimal": group["value"], "value": group["value"],
                "assignment_confidence": min(0.99, confidence(chosen) + 0.02),
                "assignment_basis": f"左右对称同值角度组，按垂直位置归属angle_{label}",
                "symmetric_evidence": list(group["pair"]),
            }
    return assigned


def extract_rebar(records, diagram_center_x):
    candidates = parse_candidates(records)
    evidence = assign_diameter_and_length(candidates)
    radii, consistency = assign_radii(candidates)
    evidence.update(radii)
    evidence.update(assign_angles(candidates, diagram_center_x))
    return evidence, candidates, consistency
