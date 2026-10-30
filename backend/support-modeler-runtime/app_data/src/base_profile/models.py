"""基础断面运行对象；所有数值保留来源与参数类型。"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class ParameterValue:
    schema_id: str
    value: float | bool | None
    unit: str
    parameter_type: str
    source_page: int | None = None
    source_method: str | None = None
    source_text: str | None = None
    confidence: float | None = None
    drawing_reference: str | None = None
    formula: str | None = None
    depends_on: list[str] = field(default_factory=list)
    status: str = "BASE_PROFILE_PARAMETER_MISSING"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GeometryTolerance:
    """数值运算阈值与工程图纸闭合阈值采用不同语义。"""

    numerical_epsilon: float = 1e-9
    drawing_closure_tolerance_mm: float = 0.1
    status: str = "EXPERIMENTAL_PENDING_ENGINEERING_CONFIRMATION"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class LayerThicknessParameters:
    primary_support_thickness: ParameterValue
    secondary_lining_thickness: ParameterValue
    reserved_deformation: ParameterValue

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class BaseProfileParameters:
    support_type: str
    has_invert: ParameterValue
    top: dict[str, ParameterValue]
    side: dict[str, ParameterValue]
    invert_transition: dict[str, ParameterValue]
    invert_bottom: dict[str, ParameterValue]
    thickness: LayerThicknessParameters
    geometry_relation_status: str
    geometry_tolerance: GeometryTolerance
    source_pages: list[int]
    context_dimensions: list[dict[str, Any]] = field(default_factory=list)
    prohibited_substitutions: list[str] = field(default_factory=list)

    def all_profile_parameters(self) -> list[ParameterValue]:
        result = [self.has_invert]
        for segment in (self.top, self.side, self.invert_transition, self.invert_bottom):
            result.extend(segment.values())
        return result

    def to_dict(self) -> dict[str, Any]:
        return {
            "support_type": self.support_type,
            "has_invert": self.has_invert.to_dict(),
            "inner_profile": {
                "top": {key: value.to_dict() for key, value in self.top.items()},
                "side": {key: value.to_dict() for key, value in self.side.items()},
                "invert_transition": {key: value.to_dict() for key, value in self.invert_transition.items()},
                "invert_bottom": {key: value.to_dict() for key, value in self.invert_bottom.items()},
            },
            "thickness": {
                "primary_support_thickness": self.thickness.primary_support_thickness.to_dict(),
                "secondary_lining_thickness": self.thickness.secondary_lining_thickness.to_dict(),
                "reserved_deformation": self.thickness.reserved_deformation.to_dict(),
            },
            "geometry_relation_status": self.geometry_relation_status,
            "geometry_tolerance": self.geometry_tolerance.to_dict(),
            "source_pages": self.source_pages,
            "context_dimensions": self.context_dimensions,
            "prohibited_substitutions": self.prohibited_substitutions,
        }
