"""锁脚小导管工程确认参数和可调建模参数。"""
from __future__ import annotations
from dataclasses import asdict, dataclass, field


@dataclass
class ConfirmedParameters:
    outer_diameter_mm: float = 42.0
    wall_thickness_mm: float = 4.0
    length_mm: float = 3500.0
    count_per_arch: int = 8
    count_left: int = 4
    count_right: int = 4
    levels_per_side: int = 2
    pipes_per_level: int = 2
    grouted: bool = True
    installed_per_steel_arch: bool = True
    steel_arch_spacing_mm: float = 800.0
    connection_type: str = "SINGLE_SIDE_WELDED"
    weld_length_min_mm: float = 180.0
    straight_hook_mm: float = 200.0


@dataclass
class ProvisionalParameters:
    upper_install_height_mm: float = 250.0
    lower_install_height_mm: float = 100.0
    upper_angle_deg: float = 7.5
    lower_angle_deg: float = 45.0
    pair_spread_angle_deg: float = 10.0
    connection_location_on_section: str = "WEB_SIDE_APPROX"


@dataclass
class LockFootAnchorParameters:
    confirmed: ConfirmedParameters = field(default_factory=ConfirmedParameters)
    provisional: ProvisionalParameters = field(default_factory=ProvisionalParameters)

    def to_dict(self) -> dict:
        return {
            "component": "lock_foot_anchor",
            "support_type": "ZZ-Va",
            "confirmed": {k: {"value": v, "status": "CONFIRMED"} for k, v in asdict(self.confirmed).items()},
            "provisional": {k: {"value": v, "status": "PROVISIONAL"} for k, v in asdict(self.provisional).items()},
            "geometry_status": "PROVISIONAL",
            "warning": "当前为建模参考默认值，待项目节点图/现场参数校核。",
        }
