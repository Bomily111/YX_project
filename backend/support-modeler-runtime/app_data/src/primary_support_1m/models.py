"""ZZ-Va 1m 初支短节的关系与纵向布置参数。"""
from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class PrimaryMeshSteelRelation:
    connection_required: bool = True
    connection_type: str = "TIED_OR_WELDED"
    connection_side: str = "ROCK_SIDE"
    connection_side_status: str = "PROVISIONAL"
    engineering_confirmation: str = "PENDING"
    reference_source: str = "FIELD_REFERENCE_IMAGE"
    switchable: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class SteelArchLayoutParameters:
    profile: str = "I20a"
    spacing_mm: float = 800.0
    scope: str = "ARCH_AND_WALL_ONLY"
    support_type: str = "ZZ-Va"
    window_length_mm: float = 1000.0
    positions_mm: tuple[float, float] = (100.0, 900.0)
    status: str = "FOUND_CONFIRMED"
    source_document: str = "施工方案"
    source_table: str = "4.7-1"
    layout_window_convention: str = "1m演示窗内保留一个完整800mm设计间距；不代表实际施工段起点"

    def to_dict(self) -> dict:
        value = asdict(self)
        value["positions_mm"] = list(self.positions_mm)
        value["source"] = {"document": value.pop("source_document"), "table": value.pop("source_table")}
        return value
