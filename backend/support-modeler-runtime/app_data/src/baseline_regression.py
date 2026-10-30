"""统一验证已验收的5类钢架和2类钢筋是否保持基线结果。"""
import json
from pathlib import Path


def regression_actual(payload):
    by_type={item["support_type"]:item for item in payload["supports"]}
    steel={}
    for name in ("ZZ-III","ZZ-IVa","ZZ-IVb","ZZ-Va","ZZ-S"):
        item=by_type.get(name,{}).get("steel_arch",{})
        fields=item.get("fields",{})
        steel[name]={"has_steel_arch":item.get("has_component",False),"steel_arch_status":item.get("status"),
                     "R1_mm":fields.get("R1_mm",{}).get("value"),"R2_mm":fields.get("R2_mm",{}).get("value"),
                     "beta_deg":fields.get("beta_deg",{}).get("value"),
                     "steel_profile":fields.get("steel_profile",{}).get("value")}
    rebar={}
    for name in ("ZZ-Va","ZZ-S"):
        item=by_type.get(name,{}).get("rebar",{})
        fields=item.get("fields",{})
        rebar[name]={
            "N1":{"diameter_mm":fields.get("N1_diameter_mm",{}).get("value"),
                  "length_mm":fields.get("N1_length_mm",{}).get("value"),
                  **{f"R{i}_mm":fields.get(f"N1_R{i}_mm",{}).get("value") for i in range(1,5)}},
            "N2":{"diameter_mm":fields.get("N2_diameter_mm",{}).get("value"),
                  "length_mm":fields.get("N2_length_mm",{}).get("value"),
                  **{f"r{i}_mm":fields.get(f"N2_r{i}_mm",{}).get("value") for i in range(1,5)}},
            "angles":{f"angle_{letter}_deg":fields.get(f"angle_{letter}",{}).get("value") for letter in "ABC"},
            "geometry_consistency":(item.get("geometry_consistency") or {}).get("status")}
    return {"steel_arch":steel,"rebar":rebar}


def compare_regression(payload, expected_path):
    expected=json.loads(Path(expected_path).read_text(encoding="utf-8"))
    actual=regression_actual(payload)
    differences=[]
    for component in expected:
        for support_type,expected_value in expected[component].items():
            actual_value=actual.get(component,{}).get(support_type)
            if actual_value!=expected_value:
                differences.append({"component":component,"support_type":support_type,
                                    "expected":expected_value,"actual":actual_value})
    return {"all_passed":not differences,"cases_total":7,"differences":differences,
            "actual":actual}

