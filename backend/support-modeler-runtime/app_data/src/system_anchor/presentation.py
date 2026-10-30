"""生成系统锚杆二维、三维、布局和统一断面验证图。"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from primary_support.geometry import build_primary_profiles, sample_open_profile


def _font(size: int, bold: bool = False):
    path = Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def _base(title: str, subtitle: str):
    image = Image.new("RGB", (1600, 1000), "#0e141d")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((55, 35), title, font=_font(32, True), fill="#edf4fb")
    draw.text((58, 82), subtitle, font=_font(17), fill="#aab9c9")
    return image, draw


def _map(points, box=(50, 120, 1220, 940), bounds=(-11000, 11000, -7000, 10800)):
    x0, y0, x1, y1 = box; xmin, xmax, ymin, ymax = bounds
    scale = min((x1 - x0) / (xmax - xmin), (y1 - y0) / (ymax - ymin))
    cx = (x0 + x1) / 2; cy = y0 + ymax * scale
    return [(cx + x * scale, cy - y * scale) for x, y in points]


def _curve(r1, r2):
    return sample_open_profile(build_primary_profiles(r1, r2, r1, r2, 15.6664)["inner"], 90)


def _line(draw, points, color, width=4):
    draw.line(_map(points), fill=color, width=width, joint="curve")


def _legend(draw, rows, x=1250, y=150):
    for color, text in rows:
        draw.rounded_rectangle((x, y, x + 32, y + 18), 4, fill=color)
        draw.text((x + 45, y - 4), text, font=_font(17), fill="#dbe6f1")
        y += 42


def render_2d(path: Path, geometry: dict[str, Any]):
    image, draw = _base("ZZ-Va 系统锚杆二维断面", "Φ25，L=4.0m，拱顶中心起布并左右对称；锚杆沿开挖轮廓径向向围岩外侧")
    inner, outer, steel, mesh = _curve(6100, 10600), _curve(6360, 10860), _curve(6220, 10720), _curve(6140, 10640)
    draw.polygon(_map(outer) + list(reversed(_map(inner))), fill="#c7a96f55")
    _line(draw, inner, "#e8c77e", 3); _line(draw, outer, "#f28b55", 4); _line(draw, steel, "#414b57", 12); _line(draw, mesh, "#35c38f", 3)
    first = [a for a in geometry["anchors"] if a["layer_index"] == 0]
    for anchor in first:
        p = _map([anchor["start_mm"][:2], anchor["end_mm"][:2]])
        draw.line(p, fill="#ed9133", width=5)
        x, y = p[-1]; draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill="#ffd07a")
    _legend(draw, [("#c7a96f", "初支混凝土"), ("#414b57", "I20a钢架"), ("#35c38f", "初支钢筋网"), ("#ed9133", "系统锚杆")])
    draw.text((1250, 365), f"本层数量：{len(first)}", font=_font(18, True), fill="#62e0aa")
    draw.text((1250, 410), "仰拱：NOT APPLICABLE", font=_font(16, True), fill="#ffbd70")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def _project(point, box=(50, 125, 1220, 935)):
    x, y, z = point; return _map([[x + z * 1.45, y + z * 0.8]], box=box, bounds=(-11000, 12500, -7000, 11500))[0]


def render_3d(path: Path, geometry: dict[str, Any]):
    image, draw = _base("ZZ-Va 系统锚杆 1m 三维短节", "两道纵向锚杆层：z=100mm / 900mm；实际纵向间距800mm")
    for anchor in geometry["anchors"]:
        draw.line([_project(anchor["start_mm"]), _project(anchor["end_mm"])], fill="#ed9133", width=4)
    for z in (100.0, 900.0):
        points = [[x, y, z] for x, y in _curve(6360, 10860)]
        draw.line([_project(p) for p in points], fill="#f28b55", width=3, joint="curve")
    _legend(draw, [("#ed9133", "Φ25×4.0m系统锚杆"), ("#f28b55", "开挖边界")])
    draw.text((1250, 280), f"总数：{geometry['count']}", font=_font(20, True), fill="#62e0aa")
    draw.text((1250, 330), f"分层：{' + '.join(str(x['count']) for x in geometry['layers'])}", font=_font(18), fill="#dbe6f1")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def render_layout(path: Path, geometry: dict[str, Any]):
    image, draw = _base("ZZ-Va 系统锚杆展开布局", "横轴为拱墙开挖轮廓弧长；相邻纵向层采用梅花形错排，单层环向间距保持1200mm")
    x0, y0, x1, y1 = 120, 180, 1450, 820
    total = geometry["profile_length_mm"]
    draw.rectangle((x0, y0, x1, y1), outline="#405368", width=2)
    for layer in geometry["layers"]:
        y = y0 + 130 + layer["index"] * 310
        draw.line((x0, y, x1, y), fill="#52687e", width=2)
        for d in layer["arc_distances_mm"]:
            x = x0 + d / total * (x1 - x0)
            draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill="#ed9133", outline="#ffd18a", width=2)
        draw.text((x0, y - 55), f"z={layer['z_mm']:.0f}mm · {layer['count']}根 · {'错排600mm' if layer['staggered'] else '拱顶中心起布'}", font=_font(18, True), fill="#dbe6f1")
    draw.text((x0, 865), f"展开弧长：{total:.2f}mm    纵向间距：800mm    总锚杆：{geometry['count']}", font=_font(19), fill="#62e0aa")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def render_section(path: Path, geometry: dict[str, Any]):
    image, draw = _base("ZZ-Va 支护统一总装（含系统锚杆）", "初支混凝土 + 钢筋网 + I20a + 系统锚杆 + 二衬 + N1/N2/N3/N4")
    inner, outer = _curve(6100, 10600), _curve(6360, 10860)
    draw.polygon(_map(outer) + list(reversed(_map(inner))), fill="#c7a96f55")
    _line(draw, _curve(6000, 10500), "#74b9de", 8); _line(draw, _curve(6220, 10720), "#414b57", 12); _line(draw, _curve(6140, 10640), "#35c38f", 3)
    _line(draw, _curve(5939, 10439), "#c66f40", 3); _line(draw, _curve(5561, 10061), "#3d98c5", 3)
    for anchor in [a for a in geometry["anchors"] if a["layer_index"] == 0]:
        draw.line(_map([anchor["start_mm"][:2], anchor["end_mm"][:2]]), fill="#ed9133", width=4)
    _legend(draw, [("#c7a96f", "初支混凝土"), ("#35c38f", "初支钢筋网"), ("#414b57", "I20a钢架"), ("#ed9133", "系统锚杆"), ("#74b9de", "二衬混凝土"), ("#c66f40", "N1"), ("#3d98c5", "N2")])
    draw.text((1250, 500), "SYSTEM ANCHOR", font=_font(18, True), fill="#62e0aa")
    draw.text((1250, 545), "IMPLEMENTED", font=_font(18, True), fill="#62e0aa")
    path.parent.mkdir(parents=True, exist_ok=True); image.save(path)


def render_all(root: Path, geometry: dict[str, Any]) -> list[Path]:
    out = root / "outputs/presentation"
    paths = [out / "ZZ-Va_system_anchor_2d.png", out / "ZZ-Va_system_anchor_3d.png", out / "ZZ-Va_system_anchor_layout.png", out / "ZZ-Va_section_with_system_anchor.png"]
    render_2d(paths[0], geometry); render_3d(paths[1], geometry); render_layout(paths[2], geometry); render_section(paths[3], geometry)
    return paths
