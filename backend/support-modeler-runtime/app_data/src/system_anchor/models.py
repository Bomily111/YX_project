"""ZZ-Va 系统锚杆参数对象。"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class EvidenceValue:
    value: Any
    unit: str
    status: str
    source_text: str
    source_method: str
    source_page: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SystemAnchorParameters:
    support_type: str
    anchor_type: EvidenceValue
    diameter_mm: EvidenceValue
    length_mm: EvidenceValue
    circumferential_spacing_mm: EvidenceValue
    longitudinal_spacing_mm: EvidenceValue
    scope: EvidenceValue
    reference_surface: EvidenceValue
    direction_rule: EvidenceValue
    layout_rule: EvidenceValue
    source_pages: list[int] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "support_type": self.support_type,
            "status": "SYSTEM_ANCHOR_PARAMETERS_READY",
            "type": self.anchor_type.to_dict(),
            "diameter_mm": self.diameter_mm.to_dict(),
            "length_mm": self.length_mm.to_dict(),
            "circumferential_spacing_mm": self.circumferential_spacing_mm.to_dict(),
            "longitudinal_spacing_mm": self.longitudinal_spacing_mm.to_dict(),
            "scope": self.scope.to_dict(),
            "reference_surface": self.reference_surface.to_dict(),
            "direction_rule": self.direction_rule.to_dict(),
            "layout_rule": self.layout_rule.to_dict(),
            "source_pages": self.source_pages,
        }
