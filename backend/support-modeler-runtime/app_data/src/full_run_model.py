"""把现有钢架/钢筋结果统一为带字段状态和来源的批量数据模型。"""
from __future__ import annotations


FIELD_HIGH = "EXTRACTED_HIGH_CONFIDENCE"
FIELD_LOW = "EXTRACTED_LOW_CONFIDENCE"
FIELD_AMBIGUOUS = "AMBIGUOUS"
FIELD_MISSING = "NOT_FOUND"
FIELD_NA = "NOT_APPLICABLE"


def source_method(item):
    if item.get("source_method"):
        return item["source_method"]
    if item.get("stage") == "pdf_text":
        return "PDF_TEXT"
    return "ROTATED_OCR" if item.get("rotation", 0) else "OCR"


def normalize_evidence(item, candidates=(), geometry_assisted=False):
    if not item:
        values = {candidate.get("value") for candidate in candidates if candidate.get("value") is not None}
        return {"value":None, "raw_text":None, "source_page":None, "bbox":None,
                "source_method":None, "ocr_confidence":None, "assignment_confidence":None,
                "geometry_assisted":geometry_assisted,
                "field_status":FIELD_AMBIGUOUS if len(values)>1 else FIELD_MISSING}
    ocr = item.get("ocr_confidence", item.get("confidence"))
    assignment = item.get("assignment_confidence", item.get("selection_confidence"))
    if assignment is None:
        assignment = ocr if ocr is not None else 0.96
    low = (ocr is not None and float(ocr)<0.85) or float(assignment)<0.85
    return {"value":item.get("value"), "raw_text":item.get("source_text",item.get("raw_text")),
            "source_page":item.get("page"), "bbox":item.get("bbox"),
            "source_method":source_method(item), "ocr_confidence":ocr,
            "assignment_confidence":assignment, "geometry_assisted":geometry_assisted,
            "field_status":FIELD_LOW if low else FIELD_HIGH}


def not_applicable_fields(names):
    return {name:{"value":None,"raw_text":None,"source_page":None,"bbox":None,
                  "source_method":None,"ocr_confidence":None,"assignment_confidence":None,
                  "geometry_assisted":False,"field_status":FIELD_NA} for name in names}


STEEL_FIELDS=("R1_mm","R2_mm","beta_deg","steel_profile")
REBAR_FIELDS=("N1_diameter_mm","N1_length_mm",*[f"N1_R{i}_mm" for i in range(1,5)],
              "N2_diameter_mm","N2_length_mm",*[f"N2_r{i}_mm" for i in range(1,5)],
              "angle_A","angle_B","angle_C")


def model_steel(raw, schema_mismatch=False):
    if not raw.get("has_steel_arch"):
        return {"has_component":False,"status":"NOT_APPLICABLE",
                "source_pages":[],"fields":not_applicable_fields(STEEL_FIELDS),"raw":raw}
    mapping={"R1_mm":"R1","R2_mm":"R2","beta_deg":"beta","steel_profile":"steel_profile"}
    fields={}
    for field,key in mapping.items():
        fields[field]=normalize_evidence(raw.get("evidence",{}).get(key),
                                         raw.get("parameter_candidates",{}).get(key,[]),
                                         geometry_assisted=(field=="beta_deg"))
    status="SCHEMA_MISMATCH" if schema_mismatch else (
        "EXTRACTED" if all(v["field_status"] in (FIELD_HIGH,FIELD_LOW) for v in fields.values())
        else "PRESENT_BUT_FAILED")
    return {"has_component":True,"status":status,"source_pages":raw.get("steel_arch_pages",[]),
            "fields":fields,"schema_mismatch":schema_mismatch,"raw":raw}


def model_rebar(raw, schema_mismatch=False):
    if not raw:
        return None
    fields={}
    for field in REBAR_FIELDS:
        item=raw.get("evidence",{}).get(field)
        kind="angle" if field.startswith("angle_") else (
            "diameter" if field.endswith("diameter_mm") else
            "length" if field.endswith("length_mm") else "radius")
        fields[field]=normalize_evidence(item,raw.get("candidates",{}).get(kind,[]),
                                         geometry_assisted=(kind in ("radius","angle")))
    status="SCHEMA_MISMATCH" if schema_mismatch else (
        "EXTRACTED" if all(v["field_status"] in (FIELD_HIGH,FIELD_LOW) for v in fields.values())
        else "PRESENT_BUT_FAILED")
    return {"has_component":True,"status":status,"source_pages":[raw.get("source_page")],
            "fields":fields,"schema_mismatch":schema_mismatch,
            "geometry_consistency":raw.get("geometry_consistency"),"raw":raw}


def review_items(support):
    output=[]
    for component_name in ("steel_arch","rebar"):
        component=support[component_name]
        if not component or not component.get("has_component"):
            continue
        if component.get("status")=="SCHEMA_MISMATCH":
            output.append({"support_type":support["support_type"],"component":component_name,
                           "field":"*","predicted_value":None,"status":"SCHEMA_MISMATCH",
                           "reason":"SCHEMA_MISMATCH","source_page":"、".join(map(str,component.get("source_pages",[]))),
                           "source_text":None})
        for field,item in component["fields"].items():
            reason=None
            if item["field_status"]==FIELD_LOW: reason="OCR_LOW_CONFIDENCE"
            elif item["field_status"]==FIELD_AMBIGUOUS: reason="AMBIGUOUS_CANDIDATES"
            elif item["field_status"]==FIELD_MISSING: reason="MISSING_FIELD"
            if reason:
                output.append({"support_type":support["support_type"],"component":component_name,
                               "field":field,"predicted_value":item["value"],"status":item["field_status"],
                               "reason":reason,"source_page":item["source_page"],"source_text":item["raw_text"]})
        consistency=component.get("geometry_consistency") or {}
        if consistency.get("status")=="GEOMETRY_CONSISTENCY_WARNING":
            output.append({"support_type":support["support_type"],"component":component_name,
                           "field":"radii","predicted_value":str(consistency.get("deltas_mm")),
                           "status":"AMBIGUOUS","reason":"GEOMETRY_CONSISTENCY_WARNING",
                           "source_page":"、".join(map(str,component.get("source_pages",[]))),"source_text":None})
    return output

