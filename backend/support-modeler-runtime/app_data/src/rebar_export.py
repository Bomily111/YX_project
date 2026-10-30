"""钢筋结果导出，并在既有support_parameters.xlsx中增加rebar工作表。"""
import json
import shutil
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

COLUMNS = ["support_type", "source_page", "has_n1n2_rebar", "rebar_status",
           "N1_diameter_mm", "N1_length_mm", *[f"N1_R{i}_mm" for i in range(1,5)],
           "N2_diameter_mm", "N2_length_mm", *[f"N2_r{i}_mm" for i in range(1,5)],
           "angle_A_raw", "angle_A_deg", "angle_B_raw", "angle_B_deg", "angle_C_raw", "angle_C_deg",
           "evaluation_status"]


def export_rebar(result, evaluation, experiment_folder, final_workbook):
    folder = Path(experiment_folder)
    folder.mkdir(parents=True, exist_ok=True)
    (folder/"parameters.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    (folder/"evaluation.json").write_text(json.dumps(evaluation, ensure_ascii=False, indent=2), encoding="utf-8")
    row = {"support_type": result["support_type"], "source_page": result["source_page"],
           "has_n1n2_rebar": result["has_n1n2_rebar"], "rebar_status": result["rebar_status"],
           "evaluation_status": evaluation["evaluation_status"]}
    for field, item in result["evidence"].items():
        if field.startswith("angle_"):
            row[field+"_raw"] = item.get("raw")
            row[field+"_deg"] = item.get("value")
        else:
            row[field] = item.get("value")
    workbook_path = Path(final_workbook)
    if not workbook_path.exists():
        raise FileNotFoundError("既有钢架工作簿不存在，拒绝创建不完整交付文件")
    backup = folder / "support_parameters_before_rebar.xlsx"
    shutil.copyfile(workbook_path, backup)
    book = load_workbook(workbook_path)
    if "rebar" in book.sheetnames:
        del book["rebar"]
    sheet = book.create_sheet("rebar")
    sheet.append(COLUMNS)
    sheet.append([row.get(column) for column in COLUMNS])
    sheet.freeze_panes = "E2"
    sheet.auto_filter.ref = sheet.dimensions
    sheet.sheet_view.showGridLines = False
    for cell in sheet[1]:
        cell.font = Font(name="微软雅黑", bold=True, color="FFFFFF", size=11)
        cell.fill = PatternFill("solid", fgColor="334155")
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    sheet.row_dimensions[1].height = 42
    sheet.row_dimensions[2].height = 30
    for index, column in enumerate(COLUMNS, 1):
        sheet.column_dimensions[get_column_letter(index)].width = 20 if column not in ("support_type", "evaluation_status") else 24
        sheet.cell(2,index).font = Font(name="微软雅黑", size=11)
        sheet.cell(2,index).alignment = Alignment(vertical="center")
        if column.endswith("_deg"):
            sheet.cell(2,index).number_format = "0.0000"
    if "component_presence" in book.sheetnames:
        presence = book["component_presence"]
        headers = {cell.value:cell.column for cell in presence[1]}
        for row_index in range(2, presence.max_row+1):
            if presence.cell(row_index, headers["support_type"]).value == result["support_type"]:
                presence.cell(row_index, headers["notes"]).value = (
                    "钢筋状态：EXTRACTED。参数及证据见rebar工作表和outputs/rebar/ZZ_Va/evidence.json。"
                )
                break
    book.save(workbook_path)
    book.close()
    # 同步上一阶段的聚合JSON状态，并保留钢筋详情的独立证据文件。
    aggregate = workbook_path.with_suffix(".json")
    if aggregate.exists():
        payload = json.loads(aggregate.read_text(encoding="utf-8"))
        for item in payload.get("results", []):
            if item.get("support_type") == result["support_type"]:
                item["rebar_status"] = result["rebar_status"]
                item["rebar_result_reference"] = "outputs/rebar/ZZ_Va/evidence.json"
        aggregate.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
