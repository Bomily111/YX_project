"""汇总剩余支护能力并生成所有可由现有模块表达的批量模型。"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from batch_support import BATCH_DEFINITIONS, build_batch_support_models  # noqa: E402
from batch_support.assembly import REBAR_ANGLES  # noqa: E402


TARGETS = ["Z-PM", "ZB-PM", "ZZ-II", "ZZ-III", "ZZ-IVa", "ZZ-IVb", "ZZ-IVc", "ZZ-Va", "ZZ-S", "ZZ-IIIx", "ZZ-IVx", "ZZ-IVsx", "ZZ-Vsx", "ZZ-QJsx", "ZZ-Y1"]
FIELDS = ["inner_profile", "primary_concrete", "primary_mesh", "steel_arch", "system_anchor", "lock_foot_anchor", "secondary_lining", "secondary_rebar"]


MATRIX: dict[str, dict[str, Any]] = {
    "Z-PM": {"s": ["NOT_IMPLEMENTED", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_IMPLEMENTED", "NOT_IMPLEMENTED"], "c": 1, "p": 0, "m": 10, "note": "特殊明洞轮廓及分段二衬钢筋不属于现有暗洞圆弧模块。"},
    "ZB-PM": {"s": ["NOT_IMPLEMENTED", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_IMPLEMENTED", "NOT_IMPLEMENTED"], "c": 1, "p": 0, "m": 10, "note": "特殊明洞轮廓及分段二衬钢筋不属于现有暗洞圆弧模块。"},
    "ZZ-II": {"s": ["READY", "READY", "NOT_APPLICABLE", "NOT_APPLICABLE", "NOT_IMPLEMENTED", "NOT_APPLICABLE", "READY", "NOT_APPLICABLE"], "c": 14, "p": 0, "m": 2, "note": "局部锚杆未给环向/纵向间距；输出混凝土与二衬模型。"},
    "ZZ-III": {"s": ["READY", "READY", "NOT_IMPLEMENTED", "NOT_APPLICABLE", "NOT_IMPLEMENTED", "NOT_APPLICABLE", "READY", "NOT_APPLICABLE"], "c": 21, "p": 0, "m": 0, "note": "参数完整，但现有网片/锚杆模块尚不支持仅拱部180°裁切。"},
    "ZZ-IVa": {"s": ["READY", "READY", "PARTIAL", "READY", "READY", "NOT_APPLICABLE", "READY", "NOT_APPLICABLE"], "c": 25, "p": 1, "m": 0, "note": "已接入；钢筋网与I16局部连接关系为PROVISIONAL。"},
    "ZZ-IVb": {"s": ["READY", "READY", "PARTIAL", "READY", "READY", "NOT_APPLICABLE", "READY", "NOT_IMPLEMENTED"], "c": 25, "p": 1, "m": 8, "note": "已接入；该页二衬钢筋/格栅语义不同于现有N1–N4模块。"},
    "ZZ-IVc": {"s": ["READY", "READY", "PARTIAL", "NOT_IMPLEMENTED", "READY", "NOT_APPLICABLE", "READY", "PARTIAL"], "c": 45, "p": 1, "m": 8, "note": "I18型号已确认，但项目内缺经确认的4项截面尺寸；N1/N2可生成，N3/N4待适配。"},
    "ZZ-Va": {"s": ["READY", "READY", "PARTIAL", "READY", "READY", "PARTIAL", "READY", "READY"], "c": 49, "p": 6, "m": 0, "note": "已完整验证；网片侧别和锁脚安装几何仍为PROVISIONAL。"},
    "ZZ-S": {"s": ["READY", "READY", "PARTIAL", "READY", "READY", "PARTIAL", "READY", "READY"], "c": 49, "p": 6, "m": 0, "note": "已完整验证；网片侧别和锁脚安装几何仍为PROVISIONAL。"},
    "ZZ-IIIx": {"s": ["READY", "READY", "NOT_IMPLEMENTED", "NOT_APPLICABLE", "NOT_IMPLEMENTED", "NOT_APPLICABLE", "READY", "NOT_APPLICABLE"], "c": 21, "p": 0, "m": 0, "note": "参数完整，但现有网片/锚杆模块尚不支持仅拱部180°裁切。"},
    "ZZ-IVx": {"s": ["READY", "READY", "PARTIAL", "NOT_IMPLEMENTED", "PARTIAL", "NOT_APPLICABLE", "READY", "PARTIAL"], "c": 45, "p": 2, "m": 8, "note": "I18截面尺寸缺失；中夹岩柱与其余区锚杆需要分区布局；N1/N2可生成。"},
    "ZZ-IVsx": {"s": ["READY", "READY", "PARTIAL", "NOT_IMPLEMENTED", "PARTIAL", "NOT_APPLICABLE", "READY", "PARTIAL"], "c": 45, "p": 2, "m": 8, "note": "I18截面尺寸缺失；双侧小净距锚杆需要分区布局；N1/N2可生成。"},
    "ZZ-Vsx": {"s": ["READY", "READY", "PARTIAL", "READY", "PARTIAL", "PARTIAL", "READY", "PARTIAL"], "c": 49, "p": 7, "m": 4, "note": "I20a可生成；锚杆分区、锁脚安装几何及N3/N4仍待确认/适配。"},
    "ZZ-QJsx": {"s": ["READY", "READY", "PARTIAL", "READY", "PARTIAL", "PARTIAL", "READY", "PARTIAL"], "c": 49, "p": 7, "m": 4, "note": "I20a可生成；锚杆分区、锁脚安装几何及N3/N4仍待确认/适配。"},
    "ZZ-Y1": {"s": ["READY", "READY", "NOT_IMPLEMENTED", "NOT_APPLICABLE", "NOT_IMPLEMENTED", "NOT_APPLICABLE", "READY", "NOT_APPLICABLE"], "c": 18, "p": 0, "m": 3, "note": "消能防护网不是现有普通钢筋网；锚杆为仅拱部180°。"},
}


def _component_status(name: str) -> dict[str, str]:
    values = MATRIX[name]["s"]
    status = dict(zip(FIELDS, values))
    return {
        "primary_concrete": status["primary_concrete"], "primary_mesh": status["primary_mesh"],
        "steel_arch": status["steel_arch"], "system_anchor": status["system_anchor"],
        "lock_foot": status["lock_foot_anchor"], "secondary_lining": status["secondary_lining"],
        "N1": "READY" if status["secondary_rebar"] in {"READY", "PARTIAL"} else status["secondary_rebar"],
        "N2": "READY" if status["secondary_rebar"] in {"READY", "PARTIAL"} else status["secondary_rebar"],
        "N3": "READY" if status["secondary_rebar"] == "READY" else ("NOT_APPLICABLE" if status["secondary_rebar"] == "NOT_APPLICABLE" else "NOT_IMPLEMENTED"),
        "N4": "READY" if status["secondary_rebar"] == "READY" else ("NOT_APPLICABLE" if status["secondary_rebar"] == "NOT_APPLICABLE" else "NOT_IMPLEMENTED"),
    }


def _payload(name: str, d: dict[str, Any]) -> dict[str, Any]:
    invert = d["invert"]; angle = 11 + 41/60 + 58/3600 if invert else 16 + 49/60 + 41/3600
    confirmed: dict[str, Any] = {
        "inner_profile": {"top_radius_mm": 5500, "side_radius_mm": 10000, "side_angle_deg": angle, "has_invert": invert, "status": "CONFIRMED", "source_pages": [74, 76]},
        "primary_support": {"material": "C25高性能喷射混凝土", "total_thickness_mm": d["primary"], "reserved_deformation_mm": d["reserve"], "status": "CONFIRMED", "source_pages": [d["pages"][0]]},
        "secondary_lining": {"material": "C35钢筋混凝土" if d["secondary"] >= 450 else "C35混凝土", "thickness_mm": d["secondary"], "has_invert": invert, "status": "CONFIRMED", "source_pages": [d["pages"][0]]},
    }
    provisional: dict[str, Any] = {}; pending: dict[str, Any] = {}
    mesh = d.get("mesh")
    if mesh and "diameter" in mesh:
        confirmed["primary_mesh"] = {"circumferential_bar": {"diameter_mm": mesh["diameter"], "spacing_mm": mesh["spacing"]}, "longitudinal_bar": {"diameter_mm": mesh["diameter"], "spacing_mm": mesh["spacing"]}, "layers": 1, "scope": mesh["scope"], "status": "CONFIRMED"}
        if mesh["scope"] == "ARCH_AND_WALL": provisional["primary_mesh"] = {"reference_side": "PRIMARY_SUPPORT_INNER_PLUS_40MM", "status": "PROVISIONAL"}
        else: pending["primary_mesh"] = {"reason": "CROWN_180_GEOMETRY_MODE_NOT_IMPLEMENTED", "status": "MISSING"}
    elif mesh:
        confirmed["primary_mesh"] = {"type": mesh["type"], "scope": mesh["scope"], "status": "CONFIRMED"}
        pending["primary_mesh"] = {"reason": "ENERGY_ABSORPTION_NET_GENERATOR_NOT_IMPLEMENTED", "status": "MISSING"}
    steel = d.get("steel")
    if steel:
        confirmed["steel_arch"] = {"R1_mm": steel["R1"], "R2_mm": steel["R2"], "beta_deg": steel["beta"], "steel_profile": steel["profile"], "longitudinal_spacing_mm": steel["spacing"], "status": "CONFIRMED", "source_pages": d["pages"][-2:]}
        if steel["profile"] == "I18": pending["steel_arch"] = {"reason": "I18_SECTION_DIMENSIONS_NOT_CONFIRMED", "missing_fields": ["height", "width", "web_thickness", "flange_thickness"], "status": "MISSING"}
    anchor = d.get("anchor")
    if anchor:
        confirmed["system_anchor"] = {"diameter_mm": anchor["diameter"], "length_mm": anchor["length"], "circumferential_spacing_mm": anchor["circ"], "longitudinal_spacing_mm": anchor["long"], "scope": anchor["scope"], "status": "CONFIRMED", "source_pages": [d["pages"][0]]}
        if anchor["scope"].startswith("MIXED_"): provisional["system_anchor"] = {"region_assignment": anchor["scope"], "status": "PROVISIONAL"}
        elif anchor["scope"] == "CROWN_180": pending["system_anchor"] = {"reason": "CROWN_180_GEOMETRY_MODE_NOT_IMPLEMENTED", "status": "MISSING"}
    elif name == "ZZ-II": pending["system_anchor"] = {"reason": "CIRCUMFERENTIAL_AND_LONGITUDINAL_SPACING_MISSING", "status": "MISSING"}
    if d.get("lock"):
        confirmed["lock_foot"] = {"outer_diameter_mm": 42, "wall_thickness_mm": 4, "length_mm": 3500, "count_per_arch": 8, "status": "CONFIRMED"}
        provisional["lock_foot"] = {"upper_height_mm": 250, "lower_height_mm": 100, "upper_angle_deg": 7.5, "lower_angle_deg": 45, "pair_spread_deg": 10, "status": "PROVISIONAL"}
    rebar = d.get("rebar")
    if rebar:
        confirmed["secondary_rebar"] = {
            "N1": {"diameter_mm": rebar["diameter"], **{f"R{i+1}_mm": value for i, value in enumerate(rebar["N1"])}, "status": "CONFIRMED"},
            "N2": {"diameter_mm": rebar["diameter"], **{f"r{i+1}_mm": value for i, value in enumerate(rebar["N2"])}, "status": "CONFIRMED"},
            "angles_deg": {"A": REBAR_ANGLES[0], "B": REBAR_ANGLES[1], "C": REBAR_ANGLES[2]}, "source_pages": [d["pages"][1]],
        }
        pending["secondary_rebar"] = {"reason": "N3_N4_TYPE_SPECIFIC_PARAMETERS_NOT_IN_CURRENT_15_FIELD_SCHEMA", "status": "MISSING"}
    item = {
        "schema": "SupportParameterPayload/V1", "support_type": name,
        "source": {"pdf_name": "support_drawings.pdf", "pages": d["pages"], "extraction_source": "EXISTING_REAL_OCR_AND_PROJECT_EVIDENCE"},
        "confirmed": confirmed, "provisional": provisional, "pending": pending,
        "component_status": _component_status(name), "model_ready": True,
    }
    item["resolved_parameters"] = {**confirmed, **provisional}
    return item


def _portal_payload(name: str, thickness_mm: int, pages: list[int]) -> dict[str, Any]:
    return {
        "schema": "SupportParameterPayload/V1", "support_type": name,
        "source": {"pdf_name": "support_drawings.pdf", "pages": pages, "extraction_source": "EXISTING_REAL_OCR_AND_PROJECT_EVIDENCE"},
        "confirmed": {"secondary_lining": {"thickness_mm": thickness_mm, "status": "CONFIRMED", "source_pages": pages[:1]}},
        "provisional": {},
        "pending": {
            "inner_profile": {"reason": "SPECIAL_PORTAL_PROFILE_GENERATOR_NOT_IMPLEMENTED", "status": "MISSING"},
            "secondary_rebar": {"reason": "SPECIAL_SEGMENTED_REBAR_GENERATOR_NOT_IMPLEMENTED", "status": "MISSING"},
        },
        "component_status": {"primary_concrete": "NOT_APPLICABLE", "primary_mesh": "NOT_APPLICABLE", "steel_arch": "NOT_APPLICABLE", "system_anchor": "NOT_APPLICABLE", "lock_foot": "NOT_APPLICABLE", "secondary_lining": "NOT_IMPLEMENTED", "N1": "NOT_IMPLEMENTED", "N2": "NOT_IMPLEMENTED", "N3": "NOT_IMPLEMENTED", "N4": "NOT_IMPLEMENTED"},
        "resolved_parameters": {"secondary_lining": {"thickness_mm": thickness_mm, "status": "CONFIRMED"}},
        "model_ready": False,
    }


def write_matrix() -> None:
    lines = ["# Remaining Support Capability Matrix", "", "状态仅使用 `READY / PARTIAL / NOT_APPLICABLE / NOT_IMPLEMENTED`；参数仅统计 `CONFIRMED / PROVISIONAL / MISSING`。", "", "| 支护类型 | inner_profile | primary_concrete | primary_mesh | steel_arch | system_anchor | lock_foot_anchor | secondary_lining | secondary_rebar | C/P/M | 结论 |", "|---|---|---|---|---|---|---|---|---|---:|---|"]
    for name in TARGETS:
        row = MATRIX[name]; counts = f"{row['c']}/{row['p']}/{row['m']}"
        lines.append("| " + " | ".join([name, *row["s"], counts, row["note"]]) + " |")
    lines += ["", "## 批量接入结果", "", "本轮新增可切换模型：`ZZ-II、ZZ-III、ZZ-IIIx、ZZ-Y1、ZZ-IVc、ZZ-IVx、ZZ-IVsx、ZZ-Vsx、ZZ-QJsx`。其中只生成现有模块能够正确表达的构件。", "", "`Z-PM、ZB-PM` 保持未接入：它们需要特殊明洞内轮廓和分段二衬钢筋几何，不能用现有暗洞模型代替。I18相关类型没有补猜截面尺寸。", "", "证据：真实OCR缓存、`support_parameters.json`、施工图第74、76、84–138页、施工方案表4.7-1、`参数识别.docx`。"]
    (ROOT / "docs/remaining_support_capability_matrix.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    payload_path = ROOT / "outputs/master_demo/support_payloads_v1_2.json"
    payloads = json.loads(payload_path.read_text(encoding="utf-8"))
    payloads["Z-PM"] = _portal_payload("Z-PM", 550, [84, 85])
    payloads["ZB-PM"] = _portal_payload("ZB-PM", 600, [62, 86, 87, 88, 315])
    for name, definition in BATCH_DEFINITIONS.items(): payloads[name] = _payload(name, definition)
    payload_path.write_text(json.dumps(payloads, ensure_ascii=False, indent=2), encoding="utf-8")
    models = build_batch_support_models(ROOT, ROOT / "outputs/multi_support")
    write_matrix()
    print(json.dumps({"models": {k: v["glb"]["byte_length"] for k, v in models.items()}, "matrix": "docs/remaining_support_capability_matrix.md"}, ensure_ascii=False))


if __name__ == "__main__": main()
