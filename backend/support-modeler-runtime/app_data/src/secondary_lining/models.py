"""ZZ-Va 二衬混凝土参数对象。"""
from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class SecondaryLiningParameters:
    support_type: str
    thickness_mm: float
    inner_profile_source: str
    has_invert: bool
    source_page: int
    source_text: str
    source_method: str
    parameter_type: str
    confidence: float
    material: str = "C35 reinforced concrete"
    extrusion_depth_mm: float = 1000.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
