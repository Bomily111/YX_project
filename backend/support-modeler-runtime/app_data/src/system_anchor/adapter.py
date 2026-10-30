"""把已审计的施工图、施工方案和参数定义转换为系统锚杆运行参数。"""
from __future__ import annotations

from .models import EvidenceValue, SystemAnchorParameters


def build_system_anchor_parameters() -> SystemAnchorParameters:
    confirmed = "FOUND_CONFIRMED"
    drawing = "ZZ-Va施工图第109页"
    plan = "施工方案表4.7-1（PDF版第69页）"
    return SystemAnchorParameters(
        support_type="ZZ-Va",
        anchor_type=EvidenceValue(
            "low_prestress_resin_cartridge_anchor", "enum", confirmed,
            "Φ25低预应力树脂药卷锚杆", plan, 69,
        ),
        diameter_mm=EvidenceValue(25.0, "mm", confirmed, "Φ25低预应力树脂药卷锚杆", drawing, 109),
        length_mm=EvidenceValue(4000.0, "mm", confirmed, "每根长度L-4.0m", drawing, 109),
        circumferential_spacing_mm=EvidenceValue(1200.0, "mm", confirmed, "环向间距120cm", drawing, 109),
        longitudinal_spacing_mm=EvidenceValue(800.0, "mm", confirmed, "纵向间距80cm", drawing, 109),
        scope=EvidenceValue("ARCH_AND_WALL_ONLY", "enum", confirmed, "锚杆：拱墙设置", drawing, 109),
        reference_surface=EvidenceValue(
            "EXCAVATION_BOUNDARY", "enum", confirmed, "锚杆布设基线：开挖面",
            "参数识别.docx / Schema V2 dependency graph", None,
        ),
        direction_rule=EvidenceValue(
            "LOCAL_RADIAL_OUTWARD_WITH_GEOLOGICAL_OVERRIDE", "enum", confirmed,
            "锚杆设置时一般应沿隧道周边径向布置；结构面或岩层层面明显时，应与主结构面或岩层层面呈大角度布置。",
            drawing, 109,
        ),
        layout_rule=EvidenceValue(
            "CROWN_CENTERED_SYMMETRIC_STAGGERED", "enum", confirmed,
            "梅花形布置；图中系统锚杆仅示一半，另一侧相同布设。", drawing, 109,
        ),
        source_pages=[69, 109],
    )
