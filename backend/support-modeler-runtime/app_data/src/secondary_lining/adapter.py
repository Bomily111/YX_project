"""把二衬模型接入统一 sectionGeometryState。"""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from .geometry import build_extruded_shell_mesh, build_normal_offset_profile, sample_profile
from .gltf import inspect_glb, write_glb
from .models import SecondaryLiningParameters
from .validation import validate_secondary_lining


def parameters_from_section_state(section_state: dict[str, Any]) -> SecondaryLiningParameters:
    thickness = section_state["thickness"]["secondary_lining_thickness"]
    value = thickness.get("value")
    if not isinstance(value, (int, float)) or value <= 0:
        raise ValueError("sectionGeometryState缺少有效二衬厚度")
    if not section_state.get("readiness", {}).get("INNER_PROFILE_READY"):
        raise ValueError("sectionGeometryState.inner_profile尚未就绪")
    return SecondaryLiningParameters(
        support_type=section_state["support_type"],
        thickness_mm=float(value),
        inner_profile_source="sectionGeometryState.inner_profile",
        has_invert=True,
        source_page=int(thickness["source_page"]),
        source_text=thickness["source_text"],
        source_method=thickness["source_method"],
        parameter_type=thickness["parameter_type"],
        confidence=float(thickness["confidence"]),
    )


def build_secondary_lining_state(section_state: dict[str, Any], glb_path: Path | None = None) -> dict[str, Any]:
    params = parameters_from_section_state(section_state)
    inner = section_state["inner_profile"]["geometry"]
    inner_before = copy.deepcopy(inner)
    outer = build_normal_offset_profile(inner, params.thickness_mm)
    mesh = build_extruded_shell_mesh(inner, outer, params.extrusion_depth_mm)
    validation = validate_secondary_lining(inner, outer, params.thickness_mm, mesh)
    if inner != inner_before:
        validation["inner_profile_unchanged"] = False
        validation["valid"] = False
        validation["status"] = "SECONDARY_LINING_VALIDATION_FAILED"
    glb = None
    if glb_path is not None and validation["valid"]:
        written = write_glb(mesh, Path(glb_path))
        inspected = inspect_glb(Path(glb_path))
        glb = {**written, **inspected, "status": "EXPORTED"}
    implemented = validation["valid"] and glb is not None and glb["status"] == "EXPORTED"
    return {
        "status": "SECONDARY_LINING_IMPLEMENTED" if implemented else "SECONDARY_LINING_PARTIAL" if validation["valid"] else "SECONDARY_LINING_BLOCKED",
        "parameters": params.to_dict(),
        "inner_profile": {"reference": params.inner_profile_source, "reused": True},
        "outer_profile": outer,
        "profile_points_mm": {
            "inner": sample_profile(inner),
            "outer": sample_profile(outer),
        },
        "three_geometry": {key: value for key, value in mesh.items() if key not in {"vertices", "indices"}},
        "validation": validation,
        "glb": glb,
        "model_object_name": "secondaryLiningGroup",
        "unit_contract": {"engineering_parameters": "mm", "three_js": "m", "conversion": "mm / 1000 exactly once"},
    }
