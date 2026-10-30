"""跨页钢架证据汇总及下部侧拱beta空间判断；不访问ground truth。"""
import re
import cv2
import numpy as np
from extractor.steel_arch import DMS, clean, parse_angle, extract

def bbox(record):
    p = np.asarray(record['box'])
    return [round(float(p[:, 0].min()), 2), round(float(p[:, 1].min()), 2),
            round(float(p[:, 0].max()), 2), round(float(p[:, 1].max()), 2)]

def xy(record):
    x0, y0, x1, y1 = bbox(record)
    return (x0 + x1) / 2, (y0 + y1) / 2

def evidence(record, value, dpi):
    b = bbox(record)
    return {'value': value, 'source_text': record['text'], 'page': record['page'],
            'bbox': b, 'bbox_pdf_pt': [round(v * 72 / dpi, 3) for v in b],
            'confidence': record['confidence'], 'stage': record.get('stage'),
            'rotation': record.get('rotation', 0)}

def confidence_value(item):
    """文本层没有OCR置信度；排序时只把它视为中性证据。"""
    value = item.get('confidence')
    return float(value) if value is not None else 1.0

def angle_candidates(records, dpi):
    result = []
    for r in records:
        normalized = clean(r['text'])
        # 实测细线/箭头会在度符号后多出逗号，分符号会识别成双引号。
        # 仅在完整DMS上下文修正标点，不修正或补入任何数字。
        normalized = re.sub(r'(?<=\d)[%/](?=\d{1,2}(?:[\'"^]))', '°', normalized)
        normalized = re.sub(r'°[,，/](?=\d)', '°', normalized)
        normalized = re.sub(r'(°\d{1,2})\^(?=\d{1,2}["\'])', r"\1'", normalized)
        normalized = re.sub(r'(°\d{1,2})"(?=\d{1,2}["\'])', r"\1'", normalized)
        for m in re.finditer(r'(?<!\d)' + DMS + r'(?!\d)', normalized):
            try:
                value = parse_angle(m[0])
            except ValueError:
                continue
            item = evidence(r, value, dpi)
            item['raw'] = m[0]
            item['normalization_applied'] = normalized != clean(r['text'])
            item['decimal_degree'] = value
            result.append(item)
    return result

def infer_beta(image, roi, records, dpi, geometry_records=None):
    """R2文字限定主水平中心线；Hough确认长线，beta取线下内部区域。

    至少需要位置对称且数值一致的左右观测，任何多组有效值均置空。
    旋转重复OCR同一框不计为左右对称。
    """
    angles = angle_candidates(records, dpi)
    r2 = [r for r in (geometry_records or records) if extract([r])['R2'] is not None]
    diagnosis = {'method': 'R2_anchored_horizontal_axis_and_symmetric_lower_angles', 'axis': None}
    if not r2:
        return None, angles, {**diagnosis, 'reason': 'R2空间锚点不足'}
    xs = [xy(r)[0] for r in r2]
    ys = [xy(r)[1] for r in r2]
    left, right = min(xs), max(xs)
    span = right - left
    if span < (roi[2] - roi[0]) * .18:
        # 有些方向只识别到一侧R2。此时只用左右同值、同高度的角度框估计对称轴，
        # 再以该轴到R2文字的距离估计跨度；不使用角度数值选择beta。
        center_pairs = []
        for a in angles:
            ax, ay = (a['bbox'][0]+a['bbox'][2])/2, (a['bbox'][1]+a['bbox'][3])/2
            for b in angles:
                bx, by = (b['bbox'][0]+b['bbox'][2])/2, (b['bbox'][1]+b['bbox'][3])/2
                if bx-ax > (roi[2]-roi[0])*.15 and abs(ay-by) < (roi[3]-roi[1])*.10 and abs(a['value']-b['value']) <= .0003:
                    center_pairs.append((ax+bx)/2)
        if not center_pairs:
            return None, angles, {**diagnosis, 'reason': '左右R2锚点不足，且未找到角度对称轴'}
        cx = float(np.median(center_pairs))
        span = 2*max(abs(x-cx) for x in xs)
        diagnosis['center_source'] = 'symmetric_equal_angle_boxes_with_single_side_R2'
        if span < (roi[2]-roi[0])*.18:
            return None, angles, {**diagnosis, 'reason': '单侧R2与角度对称轴未形成足够跨度'}
        left, right = cx-span/2, cx+span/2
    else:
        cx = (left + right) / 2
    label_y = float(np.median(ys))
    heights = [bbox(r)[3] - bbox(r)[1] for r in r2]
    h = max(8, float(np.median(heights)))
    gray = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2GRAY)
    # 只检查R2行附近，避免把图框或图名下划线当中心线。
    xa, xb = max(0, int(left - span * .4)), min(image.width, int(right + span * .4))
    ya, yb = max(0, int(label_y - h)), min(image.height, int(label_y + h * 3))
    binary = cv2.threshold(gray[ya:yb, xa:xb], 190, 255, cv2.THRESH_BINARY_INV)[1]
    lines = cv2.HoughLinesP(binary, 1, np.pi / 180, threshold=60,
                            minLineLength=int(span * .5), maxLineGap=int(span * .08))
    options = []
    for line in ([] if lines is None else lines[:, 0]):
        x1, y1, x2, y2 = map(float, line)
        if abs(y2 - y1) <= max(3, .01 * abs(x2 - x1)):
            yy = (y1 + y2) / 2 + ya
            if label_y <= yy <= label_y + h * 2:
                options.append((abs(yy - (label_y + h * .6)), yy))
    if not options:
        return None, angles, {**diagnosis, 'reason': '未确认R2主水平中心线'}
    axis_y = min(options)[1]
    diagnosis['axis'] = {'cx': cx, 'y': axis_y, 'R2_span': span}
    lower = []
    for a in angles:
        x0, y0, x1, y1 = a['bbox']
        x, y = (x0 + x1) / 2, (y0 + y1) / 2
        eligible = (.09 * span < abs(x - cx) < .46 * span and
                    h * .5 < y - axis_y < .42 * span)
        a['lower_side_eligible'] = eligible
        if eligible:
            lower.append(a)
    pairs = []
    for a in lower:
        ax = (a['bbox'][0] + a['bbox'][2]) / 2
        ay = (a['bbox'][1] + a['bbox'][3]) / 2
        for b in lower:
            bx = (b['bbox'][0] + b['bbox'][2]) / 2
            by = (b['bbox'][1] + b['bbox'][3]) / 2
            if ax < cx < bx and abs((cx - ax) - (bx - cx)) < span * .08 and abs(ay - by) < span * .08 and abs(a['value'] - b['value']) <= .0003:
                pairs.append((a, b))
    values = {a['value'] for a, b in pairs}
    if len(values) != 1:
        return None, angles, {**diagnosis, 'reason': '无唯一的左右对称一致角度'}
    pair = max(pairs, key=lambda ab: min(confidence_value(ab[0]), confidence_value(ab[1])))
    selected = dict(max(pair, key=confidence_value))
    selected['symmetric_evidence'] = list(pair)
    ocr_confidences = [a['confidence'] for a in pair if a.get('confidence') is not None]
    selected['selection_confidence'] = (min(1.0, min(ocr_confidences) + .05)
                                        if ocr_confidences else None)
    return selected, angles, {**diagnosis, 'reason': '左右对称标注一致，且位于R2中心线下方'}

def select_unique(items):
    values = {i['value'] for i in items}
    if len(values) == 1:
        return max(items, key=confidence_value)
    # 同一细字在不同旋转方向可能偶发漏一位。只有某个完整值获得至少两条
    # 独立识别记录且严格多于其他值时才采用；并列或单次命中仍保持为空。
    groups = {value: [i for i in items if i['value'] == value] for value in values}
    ranked = sorted(groups.items(), key=lambda pair: len(pair[1]), reverse=True)
    if len(ranked[0][1]) >= 2 and len(ranked[0][1]) > len(ranked[1][1]):
        return max(ranked[0][1], key=confidence_value)
    return None

def collect_parameters(arch_records, page_records, beta_results, dpi):
    candidates = {'R1': [], 'R2': [], 'steel_profile': [], 'beta': beta_results}
    for r in arch_records:
        fields = extract([r])
        for key in ('R1', 'R2'):
            if fields[key] is not None:
                candidates[key].append(evidence(r, fields[key], dpi))
    for r in page_records + arch_records:
        profile = extract([r])['steel_profile']
        if profile is not None:
            candidates['steel_profile'].append(evidence(r, profile, dpi))
    return {key: select_unique(values) for key, values in candidates.items()}, candidates
