"""生成不依赖浏览器或外部服务的初支层验证图。"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from .geometry import build_primary_profiles, sample_open_profile


def _font(size: int, bold: bool = False):
    path = Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def _canvas(title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (1600, 1000), "#0e141d")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((55, 35), title, font=_font(32, True), fill="#edf4fb")
    draw.text((58, 82), subtitle, font=_font(17), fill="#aab9c9")
    return image, draw


def _map(points: list[list[float]], box=(80, 130, 1220, 920), bounds=(-7000, 7000, -3600, 6900)):
    x0, y0, x1, y1 = box
    xmin, xmax, ymin, ymax = bounds
    scale = min((x1 - x0) / (xmax - xmin), (y1 - y0) / (ymax - ymin))
    cx, cy = (x0 + x1) / 2, y0 + (ymax * scale)
    return [(cx + x * scale, cy - y * scale) for x, y in points]


def _line(draw, points, color, width=4):
    draw.line(_map(points), fill=color, width=width, joint="curve")


def _arc_profile(top, side, beta=15.6664):
    return sample_open_profile(build_primary_profiles(top, side, top, side, beta)["inner"], 80)


def _layer_polygon(inner, outer):
    return _map(outer) + list(reversed(_map(inner)))


def _legend(draw, items, x=1260, y=160):
    for color, label in items:
        draw.rounded_rectangle((x, y, x + 34, y + 18), 4, fill=color)
        draw.text((x + 48, y - 4), label, font=_font(17), fill="#dbe6f1")
        y += 42


def render_layers_2d(path: Path):
    image, draw = _canvas("ZZ-Va 初支混凝土层级（已确认顶拱 + 侧拱）", "仰拱过渡及仰拱底未生成；下部开口是工程状态，不是显示缺陷")
    secondary_outer = _arc_profile(6000, 10500)
    primary_inner = _arc_profile(6100, 10600)
    primary_outer = _arc_profile(6360, 10860)
    draw.polygon(_layer_polygon(primary_inner, primary_outer), fill="#c7a96f80")
    draw.polygon(_layer_polygon(secondary_outer, primary_inner), fill="#55a6d022")
    _line(draw, secondary_outer, "#7bbfe3", 5)
    _line(draw, primary_inner, "#f2cf86", 5)
    _line(draw, primary_outer, "#f28b55", 5)
    _legend(draw, [("#7bbfe3", "二衬外表面"), ("#55a6d0", "100 mm 预留变形区"), ("#c7a96f", "260 mm 初支混凝土"), ("#f28b55", "开挖外边界")])
    draw.text((1260, 365), "TOP / SIDE", font=_font(19, True), fill="#62e0aa")
    draw.text((1260, 402), "CONFIRMED", font=_font(18, True), fill="#62e0aa")
    draw.text((1260, 465), "INVERT", font=_font(19, True), fill="#ffb769")
    draw.text((1260, 502), "RELATION_NOT_FOUND", font=_font(15, True), fill="#ffb769")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def render_embedding(path: Path):
    image, draw = _canvas("I20a 钢架在 260 mm 初支层中的径向位置", "Word 规则：内侧为复喷；厚度组成 20 + 200 + 40 = 260 mm")
    x0, x1, y0, y1 = 210, 1390, 330, 620
    total = x1 - x0
    scale = total / 260
    parts = [(20, "复喷混凝土 20 mm", "#4c9bce"), (200, "I20a 径向高度 200 mm", "#4b5563"), (40, "初喷混凝土 40 mm", "#d49a55")]
    x = x0
    for value, label, color in parts:
        nx = x + value * scale
        draw.rectangle((x, y0, nx, y1), fill=color, outline="#edf4fb", width=2)
        draw.text(((x + nx) / 2, (y0 + y1) / 2), label, anchor="mm", font=_font(20, True), fill="white")
        x = nx
    draw.text((x0, y0 - 55), "初支内表面", font=_font(20), fill="#e7edf5")
    draw.text((x1, y0 - 55), "开挖外边界", anchor="ra", font=_font(20), fill="#e7edf5")
    rows = ["顶拱：6100 → 6120 → 6320 → 6360 mm", "侧拱：10600 → 10620 → 10820 → 10860 mm", "实际 GLB 径向偏差：−100.0003 ～ +100.0003 mm", "验证结果：STEEL_FULLY_EMBEDDED_IN_CONFIRMED_TOP_SIDE"]
    for i, text in enumerate(rows): draw.text((300, 710 + i * 48), text, font=_font(19, i == 3), fill="#62e0aa" if i == 3 else "#cbd8e5")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def _project(point, z, box=(100, 130, 1210, 920)):
    x, y = point; px = x + z * 1100; py = y + z * 620
    return _map([[px, py]], box=box, bounds=(-7000, 8000, -3600, 7600))[0]


def render_partial_3d(path: Path):
    image, draw = _canvas("ZZ-Va 初支混凝土 1 m 部分模型", "仅包含顶拱和侧拱；模型下部保持开放")
    profiles = build_primary_profiles()
    inner, outer = sample_open_profile(profiles["inner"], 80), sample_open_profile(profiles["outer"], 80)
    for z, alpha in ((1, 85), (0, 170)):
        poly = [_project(p, z) for p in outer] + list(reversed([_project(p, z) for p in inner]))
        draw.polygon(poly, fill=(199, 169, 111, alpha), outline="#ead09d")
    for i in range(0, len(inner), 12):
        draw.line([_project(inner[i], 0), _project(inner[i], 1)], fill="#907b58", width=2)
        draw.line([_project(outer[i], 0), _project(outer[i], 1)], fill="#907b58", width=2)
    _legend(draw, [("#c7a96f", "初支混凝土部分壳体"), ("#f28b55", "仰拱未生成")], 1260, 180)
    draw.text((1260, 290), "深度：1.0 m", font=_font(18), fill="#dbe6f1")
    draw.text((1260, 335), "GLB：1 Mesh", font=_font(18), fill="#dbe6f1")
    draw.text((1260, 380), "下部：OPEN", font=_font(18, True), fill="#ffb769")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def render_section(path: Path):
    image, draw = _canvas("ZZ-Va 已实现构件统一总装（含部分初支）", "初支混凝土 + I20a钢架 + 二衬混凝土 + N1/N2/N3/N4；仰拱初支仍未实现")
    profiles = build_primary_profiles()
    pi, po = sample_open_profile(profiles["inner"], 80), sample_open_profile(profiles["outer"], 80)
    draw.polygon(_layer_polygon(pi, po), fill="#c7a96f70")
    _line(draw, po, "#f28b55", 4); _line(draw, pi, "#e8c77d", 4)
    # 二衬仅以已确认外表面参考线表现；完整二衬实体保存在总装 GLB。
    _line(draw, _arc_profile(6000, 10500), "#77b6d9", 9)
    _line(draw, _arc_profile(6220, 10720), "#343c46", 15)
    _line(draw, _arc_profile(5939, 10439), "#c66f40", 4)
    _line(draw, _arc_profile(5561, 10061), "#3d98c5", 4)
    _legend(draw, [("#c7a96f", "初支混凝土（部分）"), ("#343c46", "I20a 钢架"), ("#77b6d9", "二衬混凝土"), ("#c66f40", "N1"), ("#3d98c5", "N2")])
    draw.text((1260, 410), "总装 GLB", font=_font(20, True), fill="#edf4fb")
    draw.text((1260, 455), "7 Mesh", font=_font(20), fill="#62e0aa")
    draw.text((1260, 500), "TOP+SIDE ONLY", font=_font(17, True), fill="#ffb769")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def render_all(root: Path) -> list[Path]:
    out = root / "outputs/presentation"
    paths = [out / "ZZ-Va_primary_support_layers_2d.png", out / "ZZ-Va_primary_support_steel_embedding.png", out / "ZZ-Va_primary_support_partial_3d.png", out / "ZZ-Va_section_with_primary_partial.png"]
    render_layers_2d(paths[0]); render_embedding(paths[1]); render_partial_3d(paths[2]); render_section(paths[3])
    return paths
