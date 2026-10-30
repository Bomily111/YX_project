"""基础内轮廓、层厚与开挖边界的实验性参数链。"""

from .adapter import build_base_profile_parameters, build_section_geometry_state
from .geometry import build_partial_excavation_profile, build_tangent_profile
from .models import BaseProfileParameters, GeometryTolerance, LayerThicknessParameters, ParameterValue
from .validation import validate_base_profile, validate_section_geometry

__all__ = [
    "BaseProfileParameters",
    "GeometryTolerance",
    "LayerThicknessParameters",
    "ParameterValue",
    "build_base_profile_parameters",
    "build_section_geometry_state",
    "build_tangent_profile",
    "build_partial_excavation_profile",
    "validate_base_profile",
    "validate_section_geometry",
]
