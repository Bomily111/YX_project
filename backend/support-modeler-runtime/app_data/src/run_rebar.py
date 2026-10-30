"""从完整加密PDF提取ZZ-Va N1/N2钢筋大样十五个建模字段。"""
import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT/"src"))

import yaml
from ocr_engine import OCREngine
from pdf_export import save_json
from pdf_io import open_pdf
from pdf_screen import load_config
from run_supports import reclassify_pages
from rebar_pipeline import locate_rebar_pages, process_rebar_page
from rebar_evaluate import read_truth, evaluate_rebar
from rebar_export import export_rebar
from rebar_prediction_export import export_prediction


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def allocate(root):
    root = Path(root); root.mkdir(parents=True, exist_ok=True)
    for index in range(1,100):
        folder = root/f"rebar_exp{index:02d}"
        try:
            folder.mkdir()
            return folder
        except FileExistsError:
            continue
    raise RuntimeError("钢筋实验编号耗尽")


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream,"reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--screen-cache", type=Path, required=True,
                        help="完整373页筛页缓存；仍用当前配置重新分类")
    parser.add_argument("--support-type", default="ZZ-Va")
    parser.add_argument("--dpi", type=int, choices=(400,500,600), default=400)
    parser.add_argument("--schema", type=Path, default=ROOT/"config/rebar_schema.yaml")
    parser.add_argument("--target-config", type=Path, default=ROOT/"config/target_drawings.yaml")
    parser.add_argument("--ground-truth", type=Path, default=ROOT/"data/ground_truth/rebar_ground_truth.xlsx")
    parser.add_argument("--prediction-only", action="store_true",
                        help="盲测模式：不读取ground truth、不评价、不改最终总工作簿")
    parser.add_argument("--output-root", type=Path, default=ROOT/"outputs")
    args = parser.parse_args()
    run = allocate(args.output_root)
    manifest = {"time":datetime.now(timezone.utc).isoformat(), "status":"running",
                "source_pdf":args.pdf.name, "support_type":args.support_type, "dpi":args.dpi,
                "ocr_engine":"RapidOCR ONNX Runtime", "local_rotations":[0,90,180,270],
                "evidence_sources":["PDF text layer","400 DPI whole-page OCR","400 DPI local rotated OCR"],
                "pipeline_version":"1.0-rebar-N1-N2"}
    doc = None
    try:
        schema = yaml.safe_load(args.schema.read_text(encoding="utf-8-sig"))
        if args.support_type not in schema["supported_types"]:
            raise ValueError(f"rebar schema尚未允许处理{args.support_type}")
        target_config = load_config(args.target_config)
        for name in ("src", "extractor", "config"):
            shutil.copytree(ROOT/name, run/f"{name}_snapshot", ignore=shutil.ignore_patterns("__pycache__"))
        pdf_hash = digest(args.pdf)
        cache = json.loads(args.screen_cache.read_text(encoding="utf-8"))
        if cache["pdf_sha256"] != pdf_hash:
            raise ValueError("筛页缓存与PDF指纹不符")
        doc, auth = open_pdf(args.pdf)
        pages = reclassify_pages(cache["pages"], target_config, len(doc))
        infos = [page for page in pages if page["types"] == [args.support_type]]
        if not infos:
            raise RuntimeError(f"未找到{args.support_type}关联页")
        manifest.update(auth, pdf_sha256=pdf_hash, page_numbers=[p["page"] for p in infos])
        print(f"PDF认证={auth['authenticated']}，总页数={len(doc)}，关联页={manifest['page_numbers']}，实验={run.name}", flush=True)
        matches = locate_rebar_pages(doc, infos, args.dpi)
        if len(matches) != 1:
            raise RuntimeError(f"N1/N2钢筋大样页无法唯一确定：{[m['page'] for m in matches]}")
        page = matches[0]["page"]
        print(f"N1/N2钢筋大样定位到第{page}页，开始{args.dpi}DPI局部OCR", flush=True)
        output = run/args.support_type.replace("-","_")
        result = process_rebar_page(doc, page, args.support_type, matches[0]["anchors"][0],
                                    (OCREngine(2400,4000), OCREngine(3000,6000)), output, args.dpi)
        if args.prediction_only:
            prediction = export_prediction(result, output)
            evaluation = None
        else:
            # 先保存识别证据，再读取真值评价。
            truth = read_truth(args.ground_truth, args.support_type)
            shutil.copyfile(args.ground_truth, run/"rebar_ground_truth_snapshot.xlsx")
            evaluation = evaluate_rebar(result, truth)
            export_rebar(result, evaluation, output, args.output_root/"final/support_parameters.xlsx")
        final = args.output_root/"rebar"/args.support_type.replace("-","_")
        final.mkdir(parents=True, exist_ok=True)
        for file in output.iterdir():
            if file.is_file():
                shutil.copyfile(file, final/file.name)
        if evaluation is not None:
            save_json(args.output_root/"rebar/rebar_evaluation.json", evaluation)
        save_json(args.output_root/"rebar/run_reference.json", {"experiment":run.name})
        manifest.update(status="completed", rebar_page=page, rebar_status=result["rebar_status"],
                        mode="prediction_only" if args.prediction_only else "evaluated")
        if evaluation is not None:
            manifest["evaluation_status"] = evaluation["evaluation_status"]
            print(json.dumps(evaluation["metrics"], ensure_ascii=False, indent=2), flush=True)
            print(f"输出：{args.output_root/'final/support_parameters.xlsx'}", flush=True)
        else:
            print(json.dumps(prediction, ensure_ascii=False, indent=2), flush=True)
            print(f"盲测输出：{args.output_root/'rebar'/args.support_type.replace('-', '_')/'prediction.json'}", flush=True)
        return 0
    except Exception as exc:
        manifest.update(status="failed", error=str(exc))
        print(f"失败：{exc}", file=sys.stderr, flush=True)
        return 1
    finally:
        if doc:
            doc.close()
        save_json(run/"manifest.json", manifest)


if __name__ == "__main__":
    raise SystemExit(main())
