"""把既有识别结果和构件参数适配为统一 SupportParameterPayload。"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def merge_by_status(confirmed: dict, provisional: dict, pending: dict) -> dict:
    """统一优先级：CONFIRMED > PROVISIONAL > PENDING。"""
    result = dict(pending)
    result.update(provisional)
    result.update(confirmed)
    return result


class SupportParameterPayloadBuilder:
    def __init__(self, root: Path): self.root = Path(root)
    def _json(self, relative: str) -> dict:
        return json.loads((self.root / relative).read_text(encoding="utf-8"))

    def build(self, extraction: dict[str, Any], support_type: str, source_hash: str | None = None, extraction_source: str = "OCR_RUN") -> dict[str, Any]:
        support = next((x for x in extraction.get("supports", []) if x.get("support_type") == support_type), None)
        if support is None: raise ValueError(f"识别结果中不存在支护类型 {support_type}")
        meta = extraction.get("metadata", {})
        steel = support.get("steel_arch") or {}
        steel_fields = steel.get("fields") or {}
        steel_values = {k: v.get("value") if isinstance(v, dict) else v for k, v in steel_fields.items()}
        confirmed: dict[str, Any] = {"steel_arch": {**steel_values, "status": steel.get("status", "PARAMETER_INCOMPLETE"), "source_pages": steel.get("source_pages", [])}}
        provisional: dict[str, Any] = {}
        pending: dict[str, Any] = {}
        component_status = {
            "steel_arch": steel.get("status", "PARAMETER_INCOMPLETE"),
            "primary_support": "PARAMETER_INCOMPLETE", "system_anchor": "PARAMETER_INCOMPLETE",
            "lock_foot": "PARAMETER_INCOMPLETE", "secondary_lining": "PARAMETER_INCOMPLETE",
            "secondary_rebar": "PARAMETER_INCOMPLETE",
        }
        sources = {"extraction": "existing support_parameters.json"}
        if steel.get("status") == "NOT_APPLICABLE" or steel.get("has_component") is False:
            confirmed["steel_arch"] = {"status": "NOT_APPLICABLE", "has_component": False}
            component_status["steel_arch"] = "NOT_APPLICABLE"

        # 目前只有 ZZ-Va 完成全部构件验证；其他类型保留识别结果但不伪造构件参数。
        if support_type == "ZZ-Va":
            primary = self._json("outputs/primary_support/ZZ-Va_primary_support_parameters.json")
            anchor = self._json("outputs/system_anchor/ZZ-Va_system_anchor_parameters.json")
            lock = self._json("outputs/lock_foot_anchor/ZZ-Va_lock_foot_anchor_parameters.json")
            lining = self._json("outputs/secondary_lining/ZZ-Va_secondary_lining_parameters.json")
            n12 = self._json("outputs/secondary_rebar_assembly/ZZ-Va_N1_N2_assembly_state.json")
            n34 = self._json("outputs/secondary_rebar_assembly/ZZ-Va_N3_N4_parameters.json")
            mesh = self._json("outputs/primary_mesh/ZZ-Va_primary_mesh_parameters.json")
            confirmed.update({
                "primary_support": primary,
                "primary_mesh": mesh,
                "system_anchor": anchor,
                "secondary_lining": lining,
                "secondary_rebar": {"N1": n12["sectionAssemblyState"]["rebar"]["N1"], "N2": n12["sectionAssemblyState"]["rebar"]["N2"], "N3": n34["N3"], "N4": n34["N4"]},
                "lock_foot": {k: v["value"] for k, v in lock["confirmed"].items()},
            })
            provisional = {
                "primary_mesh_connection_side": "ROCK_SIDE",
                "lock_foot": {k: v["value"] for k, v in lock["provisional"].items()},
            }
            pending = {
                "primary_mesh_connection_side_project_confirmation": None,
                "lock_foot_project_geometry_confirmation": None,
            }
            component_status.update({
                "steel_arch": "IMPLEMENTED", "primary_support": "IMPLEMENTED", "primary_mesh": "PARTIAL",
                "system_anchor": "IMPLEMENTED", "lock_foot": "PROVISIONAL_COMPONENT",
                "secondary_lining": "IMPLEMENTED", "secondary_rebar": "IMPLEMENTED",
            })
            sources.update({
                "primary_support": "outputs/primary_support/ZZ-Va_primary_support_parameters.json",
                "primary_mesh": "outputs/primary_mesh/ZZ-Va_primary_mesh_parameters.json",
                "system_anchor": "outputs/system_anchor/ZZ-Va_system_anchor_parameters.json",
                "lock_foot": "outputs/lock_foot_anchor/ZZ-Va_lock_foot_anchor_parameters.json",
                "secondary_lining": "outputs/secondary_lining/ZZ-Va_secondary_lining_parameters.json",
                "secondary_rebar_N1_N2": "outputs/secondary_rebar_assembly/ZZ-Va_N1_N2_assembly_state.json",
                "secondary_rebar_N3_N4": "outputs/secondary_rebar_assembly/ZZ-Va_N3_N4_parameters.json",
            })
        pages = support.get("page_numbers") or []
        return {
            "schema": "SupportParameterPayload/V1", "support_type": support_type,
            "source": {"pdf_name": Path(meta.get("source_pdf") or "uploaded.pdf").name, "pdf_sha256": source_hash or meta.get("pdf_sha256"), "pages": pages, "extraction_time": datetime.now(timezone.utc).isoformat(), "extraction_source": extraction_source},
            "confirmed": confirmed, "provisional": provisional, "pending": pending,
            "resolved_parameters": merge_by_status(confirmed, provisional, pending),
            "component_status": component_status, "parameter_sources": sources,
            "model_ready": support_type == "ZZ-Va",
        }

    def build_all(self, extraction: dict[str, Any], source_hash: str | None = None, extraction_source: str = "OCR_RUN") -> dict[str, dict]:
        return {s["support_type"]: self.build(extraction, s["support_type"], source_hash, extraction_source) for s in extraction.get("supports", []) if s.get("page_numbers")}
