"""文字锚点定位及高清局部复识别。坐标统一回原生高清页像素。"""
import re
import numpy as np
from PIL import Image

def rect(box):
    p = np.asarray(box)
    return [float(p[:, 0].min()), float(p[:, 1].min()), float(p[:, 0].max()), float(p[:, 1].max())]

def center(box):
    r = rect(box)
    return ((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)

def find_arch_regions(records, image_size, anchors):
    """图名通常位于图下方；以图名宽度/位置确定候选ROI，后续须以R1/R2验证。

    初版为版式启发式，不声称通用检测器；所有ROI及锚点保存供审计。
    """
    width, height = image_size
    regions = []
    for r in records:
        if not any(word in re.sub(r'\s+', '', r['text']) for word in anchors):
            continue
        x0, y0, x1, y1 = rect(r['box'])
        cx = (x0 + x1) / 2
        span = min(width * .65, max((x1 - x0) * 3.1, width * .30))
        bounds = [max(0, int(cx - span / 2)), max(0, int(y0 - span * .86)),
                  min(width, int(cx + span / 2)), min(height, int(y1 + (y1 - y0) * 2))]
        if any(abs(cx - center([ [a['bbox'][0], a['bbox'][1]], [a['bbox'][2], a['bbox'][3]] ])[0]) < span * .1 for a in regions):
            continue
        regions.append({'bbox': bounds, 'anchor': r})
    return regions

def local_ocr(image, engine, page_number, roi, rotations=(0, 90, 270)):
    """多方向OCR保留每个观测，不凭文本去重丢掉左右对称证据。"""
    x0, y0, x1, y1 = roi
    crop = image.crop(tuple(roi))
    width, height = crop.size
    observations = []
    for rotation in rotations:
        view = crop if rotation == 0 else crop.transpose(Image.Transpose.ROTATE_90 if rotation == 90 else Image.Transpose.ROTATE_270)
        for r in engine.recognize(view):
            p = np.asarray(r['box'], dtype=float)
            if rotation == 90:
                p = np.column_stack((width - p[:, 1], p[:, 0]))
            elif rotation == 270:
                p = np.column_stack((p[:, 1], height - p[:, 0]))
            p += [x0, y0]
            observations.append({**r, 'box': p.tolist(), 'page': page_number,
                                 'rotation': rotation, 'stage': 'arch_local', 'roi': roi})
    return crop, observations
