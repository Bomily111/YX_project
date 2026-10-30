"""ZZ-Va锁脚锚管专项审计；只输出证据和状态，不在缺少角度时生成几何。"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _field(value, status, source_page, source_text, source_method="PDF_TEXT_AND_DRAWING_REVIEW"):
    return {"value": value, "status": status, "source_page": source_page, "source_text": source_text, "source_method": source_method}


def build_audit() -> dict:
    page_path = ROOT / "outputs/base_profile/source_pages/page_0111_text.txt"
    plan_path = ROOT / "outputs/construction_plan/construction_plan_full_text.txt"
    page = page_path.read_text(encoding="utf-8")
    plan = plan_path.read_text(encoding="utf-8")
    assert re.search(r"φ42注浆锁脚小导管", page, re.I)
    assert re.search(r"L=3\.5m|L=3500mm", page, re.I)
    assert "L=3500mm\n8\n28000mm" in page
    wall_confirmed = "Φ42×4mm 小导管" in plan
    protected = [
        ROOT / "outputs/primary_support/ZZ-Va_primary_support_1m_state.json",
        ROOT / "outputs/system_anchor/ZZ-Va_system_anchor_state.json",
        ROOT / "outputs/I20a_validation/ZZ-Va_I20a_steel_arch.glb",
        ROOT / "outputs/secondary_rebar_assembly/ZZ-Va_secondary_rebar_assembly_state.json",
    ]
    hashes = {p.relative_to(ROOT).as_posix(): _sha(p) for p in protected}
    fields = {
        "official_name": _field("φ42注浆锁脚小导管", "FOUND_CONFIRMED", 111, "工字钢钢架锁脚锚杆采用φ42注浆小导管，每根长3.5m"),
        "component_class": _field("LOCK_FOOT_GROUTING_SMALL_PIPE", "FOUND_CONFIRMED", 111, "锁脚小导管安装平面示意图"),
        "pipe_outer_diameter_mm": _field(42, "FOUND_CONFIRMED", 111, "φ42注浆锁脚小导管"),
        "pipe_wall_thickness_mm": _field(4 if wall_confirmed else None, "FOUND_CONFIRMED" if wall_confirmed else "NOT_FOUND", None, "本项目锁脚锚管采用Φ42×4mm小导管", "CONSTRUCTION_PLAN_TEXT"),
        "length_mm": _field(3500, "FOUND_CONFIRMED", 111, "L=3500mm；每根长3.5m"),
        "count_per_steel_arch": _field(8, "FOUND_CONFIRMED", 111, "每榀型钢钢架工程数量表：锁脚锚杆，件数8，28000mm"),
        "count_left": _field(4, "FOUND_CONFIRMED", 111, "组合安装图左右对称；总数8；每侧两处连接、每处平面图示两根"),
        "count_right": _field(4, "FOUND_CONFIRMED", 111, "组合安装图左右对称；总数8；每侧两处连接、每处平面图示两根"),
        "grouted": _field(True, "FOUND_CONFIRMED", 111, "φ42注浆锁脚小导管；注浆量0.07m3"),
        "follows_each_steel_arch": _field(True, "FOUND_CONFIRMED", 111, "每榀型钢钢架工程数量表"),
        "longitudinal_pitch_mm": _field(800, "FOUND_CONFIRMED", 109, "型钢钢架纵向间距80cm；锁脚构件随每榀设置", "DRAWING_RELATION_DERIVED"),
        "reference_component": _field("steel_arch", "FOUND_CONFIRMED", 111, "锁脚锚杆单面焊，焊缝长不小于18cm"),
        "connection_detail": _field({"method": "SINGLE_SIDE_WELD", "minimum_weld_length_mm": 180, "straight_hook_mm": 200}, "FOUND_CONFIRMED", 111, "锁脚锚杆单面焊，焊缝长不小于18cm；注浆小导管直弯钩20cm"),
        "reference_location": _field("TWO_LEVELS_PER_SIDE_ON_STEEL_ARCH", "FOUND_CANDIDATE", 111, "组合安装图示每侧上、下两处；分节与锁脚位置可按施工工法调整"),
        "installation_height_mm": _field(None, "NOT_FOUND", 111, "图示两级位置但无唯一高度尺寸，且注9允许调整锁脚锚杆位置"),
        "installation_angle_deg": _field(None, "NOT_FOUND", 111, "未标注固定角度"),
        "inclination": _field("OUTWARD_AND_DOWNWARD_IN_SCHEMATIC", "FOUND_CANDIDATE", 111, "组合安装图示向围岩外侧并下倾，但图名/局部图标注为示意"),
        "direction_rule": _field("INTO_SURROUNDING_ROCK_AND_LARGE_ANGLE_TO_ROCK_STRUCTURE_PLANE", "FOUND_CONFIRMED", 111, "锚杆孔向应与岩体结构面大角度相交；另一端锚入围岩", "DRAWING_AND_CONSTRUCTION_PLAN"),
        "angle_control": _field("SITE_ADJUSTED_NEEDS_CONFIRMATION", "AMBIGUOUS", 111, "大角度相交不是固定设计角度；图中无数值或范围"),
    }
    blocking = ["installation_height_mm", "installation_angle_deg", "reference_location_exact_coordinate", "pair_divergence_angle_in_plan"]
    return {
        "support_type": "ZZ-Va",
        "status": "LOCK_FOOT_ANCHOR_BLOCKED",
        "readiness": {"LOCK_FOOT_PARAMETERS_READY": False, "LOCK_FOOT_GEOMETRY_READY": False, "LOCK_FOOT_LAYOUT_READY": False},
        "fields": fields,
        "distinction_from_system_anchor": {"system_anchor": "Φ25、L=4000mm、拱墙径向、1200×800mm", "lock_foot": "Φ42×4注浆小导管、L=3500mm、钢架脚部稳定构件、每榀8根"},
        "blocking_parameters": blocking,
        "geometry_generated": False,
        "glb_generated": False,
        "reason": "固定安装角度、精确安装高度/连接坐标及平面双管张开角均未给出；禁止由示意图像素或经验角度补值",
        "protected_source_hashes": hashes,
    }


def _font(size, bold=False):
    p = Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc")
    return ImageFont.truetype(str(p), size) if p.exists() else ImageFont.load_default()


def render_evidence(path: Path):
    source = Image.open(ROOT / "outputs/base_profile/source_pages/page_0111_250dpi.png").convert("RGB")
    canvas = Image.new("RGB", (1800, 1200), "#101821"); draw = ImageDraw.Draw(canvas)
    draw.text((45, 25), "ZZ-Va 锁脚锚管证据页（施工图第111页）", font=_font(34, True), fill="#eef4fa")
    draw.text((48, 75), "图纸明确Φ42、L=3.5m、每榀8根及钢架焊接；固定安装角度和精确高度未标注", font=_font(19), fill="#ffca7a")
    crops = [
        (source.crop((250, 120, 2150, 1450)), (40, 125, 1160, 825), "钢架组合安装图：左右对称、每侧两级连接"),
        (source.crop((2100, 350, 3300, 1450)), (1190, 125, 1760, 650), "安装平面示意：每个连接点为双管"),
        (source.crop((300, 1750, 2100, 2730)), (40, 850, 880, 1160), "每榀工程数量表：8根、L=3500mm"),
        (source.crop((2100, 1750, 4000, 2840)), (920, 690, 1760, 1160), "注8/9：管径长度确认；位置允许随工法调整"),
    ]
    for crop, box, label in crops:
        crop.thumbnail((box[2]-box[0], box[3]-box[1]-32)); canvas.paste(crop, (box[0], box[1]+30)); draw.rectangle(box, outline="#536a80", width=3); draw.text((box[0]+8, box[1]+3), label, font=_font(16, True), fill="#dce8f3")
    path.parent.mkdir(parents=True, exist_ok=True); canvas.save(path)


def main() -> int:
    out = ROOT / "outputs/lock_foot_anchor"; out.mkdir(parents=True, exist_ok=True)
    audit = build_audit(); target = out / "ZZ-Va_lock_foot_anchor_parameter_audit.json"
    target.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    render_evidence(ROOT / "outputs/presentation/ZZ-Va_lock_foot_evidence.png")
    print(json.dumps({"status": audit["status"], "audit": str(target), "evidence": str(ROOT / "outputs/presentation/ZZ-Va_lock_foot_evidence.png"), "blocking_parameters": audit["blocking_parameters"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
