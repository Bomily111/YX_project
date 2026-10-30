"""把 Schema V2 与独立来源证据转换为严格的基础断面运行结构。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .geometry import build_offset_profile, build_partial_excavation_profile, build_tangent_profile
from .models import BaseProfileParameters, GeometryTolerance, LayerThicknessParameters, ParameterValue
from .validation import validate_base_profile, validate_section_geometry


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SCHEMA = ROOT / "schema_v2" / "parameter_schema_v2.json"
DEFAULT_SOURCE = ROOT / "config" / "zz_va_base_profile_sources.json"


def _schema_index(path: Path) -> dict[str, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    return {item["id"]: item for item in payload["parameters"]}


def _parameter(schema_id: str, source: dict[str, Any] | None, schema: dict[str, dict[str, Any]]) -> ParameterValue:
    definition = schema.get(schema_id)
    if definition is None:
        raise KeyError(f"Schema ID 不存在：{schema_id}")
    if source is None and definition.get("parameter_type") == "DEFAULT" and "default_value" in definition:
        return ParameterValue(
            schema_id=schema_id,
            value=definition["default_value"],
            unit=definition.get("unit", ""),
            parameter_type="DEFAULT",
            source_method="SCHEMA_V2_DEFAULT",
            source_text=definition.get("notes") or "Schema V2 默认值",
            confidence=1.0,
            status="CONFIRMED",
        )
    source = source or {}
    value = source.get("value")
    return ParameterValue(
        schema_id=schema_id,
        value=value,
        unit=source.get("unit", definition.get("unit", "")),
        parameter_type=source.get("parameter_type", definition.get("parameter_type", "DIRECT")),
        source_page=source.get("source_page"),
        source_method=source.get("source_method"),
        source_text=source.get("source_text"),
        confidence=source.get("confidence"),
        drawing_reference=source.get("drawing_reference"),
        formula=source.get("formula", definition.get("formula")),
        depends_on=list(source.get("depends_on", definition.get("depends_on", []))),
        status=source.get("status", "CONFIRMED" if value is not None else "BASE_PROFILE_PARAMETER_MISSING"),
    )


def build_base_profile_parameters(source_path: Path = DEFAULT_SOURCE, schema_path: Path = DEFAULT_SCHEMA) -> BaseProfileParameters:
    source = json.loads(Path(source_path).read_text(encoding="utf-8-sig"))
    schema = _schema_index(Path(schema_path))
    values = source["parameters"]
    prefix = "inner_profile.with_invert"
    has_invert = _parameter("secondary_lining.concrete.has_invert", values.get("secondary_lining.concrete.has_invert"), schema)
    tolerance_source = source.get("geometry_tolerance", {})
    tolerance = GeometryTolerance(
        numerical_epsilon=float(tolerance_source.get("numerical_epsilon", 1e-9)),
        drawing_closure_tolerance_mm=float(tolerance_source.get("drawing_closure_tolerance_mm", 0.1)),
        status=tolerance_source.get("status", "EXPERIMENTAL_PENDING_ENGINEERING_CONFIRMATION"),
    )
    result = BaseProfileParameters(
        support_type=source["support_type"],
        has_invert=has_invert,
        top={
            "radius_mm": _parameter(f"{prefix}.top.radius", values.get(f"{prefix}.top.radius"), schema),
            "angle_deg": _parameter(f"{prefix}.top.angle", values.get(f"{prefix}.top.angle"), schema),
        },
        side={
            "radius_mm": _parameter(f"{prefix}.side.radius", values.get(f"{prefix}.side.radius"), schema),
            "angle_deg": _parameter(f"{prefix}.side.angle", values.get(f"{prefix}.side.angle"), schema),
        },
        invert_transition={
            "radius_mm": _parameter(f"{prefix}.invert_transition.radius", values.get(f"{prefix}.invert_transition.radius"), schema),
            "angle_deg": _parameter(f"{prefix}.invert_transition.angle", values.get(f"{prefix}.invert_transition.angle"), schema),
        },
        invert_bottom={
            "radius_mm": _parameter(f"{prefix}.invert_bottom.radius", values.get(f"{prefix}.invert_bottom.radius"), schema),
            "angle_deg": _parameter(f"{prefix}.invert_bottom.angle", values.get(f"{prefix}.invert_bottom.angle"), schema),
        },
        thickness=LayerThicknessParameters(
            primary_support_thickness=_parameter("excavation.primary_concrete_thickness", values.get("excavation.primary_concrete_thickness"), schema),
            secondary_lining_thickness=_parameter("excavation.secondary_lining_thickness", values.get("excavation.secondary_lining_thickness"), schema),
            reserved_deformation=_parameter("excavation.deformation_allowance", values.get("excavation.deformation_allowance"), schema),
        ),
        geometry_relation_status=source.get("geometry_relation_status", "DRAWING_DEFINED"),
        geometry_tolerance=tolerance,
        source_pages=list(source.get("source_pages", [])),
        context_dimensions=list(source.get("context_dimensions", [])),
        prohibited_substitutions=list(source.get("prohibited_substitutions", [])),
    )
    return result


def _derived_value(schema_id: str, value: float | None, formula: str, depends_on: list[str], status: str, drawing_reference: str | None = None) -> dict[str, Any]:
    return ParameterValue(
        schema_id=schema_id,
        value=value,
        unit="mm",
        parameter_type="DERIVED",
        source_method="FORMULA",
        formula=formula,
        depends_on=depends_on,
        drawing_reference=drawing_reference,
        status=status,
    ).to_dict()


def build_section_geometry_state(parameters: BaseProfileParameters) -> dict[str, Any]:
    validation = validate_base_profile(parameters)
    complete = not validation["missing_parameters"] and not validation["errors"]
    inner_geometry = build_tangent_profile(parameters, tolerance=parameters.geometry_tolerance) if complete else None
    thickness_values = [
        parameters.thickness.secondary_lining_thickness.value,
        parameters.thickness.reserved_deformation.value,
        parameters.thickness.primary_support_thickness.value,
    ]
    thickness_complete = all(isinstance(value, (int, float)) for value in thickness_values)
    total_offset = float(sum(thickness_values)) if thickness_complete else None

    derived: dict[str, Any] = {}
    for segment in ("top", "side"):
        radius = getattr(parameters, segment)["radius_mm"].value
        deps = [
            getattr(parameters, segment)["radius_mm"].schema_id,
            parameters.thickness.primary_support_thickness.schema_id,
            parameters.thickness.reserved_deformation.schema_id,
            parameters.thickness.secondary_lining_thickness.schema_id,
        ]
        value = float(radius) + total_offset if isinstance(radius, (int, float)) and total_offset is not None else None
        status = "COMPUTED" if value is not None else "BASE_PROFILE_PARAMETER_MISSING"
        derived[segment] = _derived_value(
            f"excavation.{segment}.radius",
            value,
            "inner_radius + primary_support_thickness + reserved_deformation + secondary_lining_thickness",
            deps,
            status,
        )
    derived["invert_transition"] = _derived_value(
        "excavation.invert_transition.radius",
        None,
        "图纸和参数定义文件均未确认仰拱过渡开挖边界派生关系",
        [parameters.invert_transition["radius_mm"].schema_id],
        "RELATION_NOT_FOUND",
    )
    derived["invert_bottom"] = _derived_value(
        "excavation.invert_bottom.radius",
        None,
        "已确认仰拱底不采用内轮廓半径统一外扩860mm；完整构造关系尚未接入",
        [parameters.invert_bottom["radius_mm"].schema_id],
        "CONFIRMED_NOT_860_OFFSET",
        "第76页共用有仰拱内轮廓图 + 第109页ZZ-Va断面层厚关系",
    )

    secondary_offset = float(parameters.thickness.secondary_lining_thickness.value) if isinstance(parameters.thickness.secondary_lining_thickness.value, (int, float)) else None
    secondary_outer = build_offset_profile(parameters, secondary_offset) if complete and secondary_offset is not None else None
    excavation_partial = build_partial_excavation_profile(parameters, total_offset) if complete and total_offset is not None else None
    geometry_validation = validate_section_geometry(
        inner_geometry,
        secondary_outer,
        excavation_partial,
        parameters.has_invert.value is True,
        parameters.geometry_tolerance,
    )
    inner_status = "INNER_PROFILE_IMPLEMENTED" if complete and geometry_validation["valid"] else "INNER_PROFILE_BLOCKED"
    excavation_status = "EXCAVATION_BOUNDARY_PARTIAL" if excavation_partial else "EXCAVATION_BOUNDARY_BLOCKED"
    return {
        "support_type": parameters.support_type,
        "status": inner_status,
        "capability_status": {
            "inner_profile": inner_status,
            "excavation_boundary": excavation_status,
        },
        "readiness": {
            "INNER_PROFILE_READY": inner_status == "INNER_PROFILE_IMPLEMENTED",
            "EXCAVATION_FULL_READY": False,
        },
        "inner_profile": {"status": "IMPLEMENTED", "geometry": inner_geometry} if inner_geometry else {"status": "BLOCKED", "geometry": None},
        "secondary_lining_outer": secondary_outer,
        "primary_support_reference": None,
        "excavation_boundary": {
            "status": "PARTIAL" if excavation_partial else "BLOCKED",
            "top": {"status": "CONFIRMED", "geometry": excavation_partial["right_segments"][0] if excavation_partial else None},
            "side": {"status": "CONFIRMED", "geometry": excavation_partial["right_segments"][1] if excavation_partial else None},
            "invert_transition": None,
            "invert_bottom": None,
            "partial_geometry": excavation_partial,
        },
        "derived_parameters": derived,
        "thickness": {
            "primary_support_thickness": parameters.thickness.primary_support_thickness.to_dict(),
            "secondary_lining_thickness": parameters.thickness.secondary_lining_thickness.to_dict(),
            "reserved_deformation": parameters.thickness.reserved_deformation.to_dict(),
            "total_confirmed_offset_mm": total_offset,
        },
        "source": {
            "pages": parameters.source_pages,
            "geometry_relation_status": parameters.geometry_relation_status,
        },
        "geometry_tolerance": parameters.geometry_tolerance.to_dict(),
        "unresolved_relations": [
            "excavation.invert_transition",
            "excavation.invert_bottom.geometry",
            "engineering_tangent_tolerance",
        ],
        "component_readiness": {
            "secondary_lining_concrete": {"status": "READY", "depends_on": ["INNER_PROFILE_READY", "secondary_lining_thickness"]},
            "N1_N2_assembly": {"status": "READY", "depends_on": ["INNER_PROFILE_READY", "existing_N1_N2_parameters"]},
            "N3_N4": {"status": "PARTIAL_READY", "depends_on": ["N3_N4_parameter_completion"]},
            "primary_support_concrete": {"status": "READY", "scope": "ARCH_AND_WALL_ONLY", "invert": "NOT_APPLICABLE", "depends_on": ["excavation.top.radius", "excavation.side.radius"]},
            "primary_support_rebar_mesh": {"status": "PARTIAL_READY", "scope": "ARCH_AND_WALL_ONLY", "invert": "NOT_APPLICABLE", "blocked_by": ["LOCAL_STEEL_ARCH_CONNECTION_UNRESOLVED"]},
            "system_anchor": {"status": "READY", "scope": "ARCH_AND_WALL_ONLY", "depends_on": ["excavation.top.radius", "excavation.side.radius"]},
        },
        "validation": {"parameters": validation, "geometry": geometry_validation},
    }
