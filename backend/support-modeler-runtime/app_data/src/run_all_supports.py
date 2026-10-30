"""对配置中的全部目标类型执行钢架与N1/N2钢筋批量盲提取。"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(os.getenv("SUPPORT_DEMO_ROOT",Path(__file__).resolve().parents[1])).resolve()
sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/"src"))

from baseline_regression import compare_regression
from component_presence import apply_steel_status
from full_export import export_all
from full_run_model import (REBAR_FIELDS,STEEL_FIELDS,model_rebar,model_steel,
                            not_applicable_fields,review_items)
from full_visualize import annotate_steel,copy_rebar_visual
from ocr_engine import OCREngine
from pdf_export import save_json
from pdf_io import open_pdf
from pdf_screen import load_config
from rebar_pipeline import process_rebar_page
from run_pdf import file_hash
from run_supports import reclassify_pages
from support_pipeline import process_support


def allocate(root):
    root=Path(root);root.mkdir(parents=True,exist_ok=True)
    for index in range(1,100):
        folder=root/f"full_exp{index:02d}"
        try:folder.mkdir();return folder
        except FileExistsError:continue
    raise RuntimeError("全量实验编号耗尽")


def radius_indices(records,roi=None):
    counts={}
    for row in records:
        if roi:
            points=row.get("box",[])
            if not points:continue
            cx=sum(p[0] for p in points)/len(points);cy=sum(p[1] for p in points)/len(points)
            if not (roi[0]<=cx<=roi[2] and roi[1]<=cy<=roi[3]):continue
        text=str(row.get("text",""))
        for match in re.finditer(r"[Rr]\s*([1-9])\s*[=＝\-]",text):
            index=int(match.group(1));counts[index]=counts.get(index,0)+1
    return counts


def steel_schema_mismatch(run,raw):
    indices={}
    for page in raw.get("steel_arch_pages",[]):
        folder=Path(run)/f"page_{page:04d}"
        for path in folder.glob("arch_*_ocr.json"):
            for index,count in radius_indices(json.loads(path.read_text(encoding="utf-8"))).items():
                indices[index]=indices.get(index,0)+count
    explicit=set(indices)
    return bool(explicit-{1,2}) or (bool(explicit) and explicit!={1,2} and all(count>=2 for count in indices.values()))


def rebar_schema_mismatch(folder,result):
    rows=json.loads((Path(folder)/"pdf_text_records.json").read_text(encoding="utf-8"))
    indices=radius_indices(rows,result["roi"])
    explicit=set(indices)
    angle_values={candidate["value"] for candidate in result.get("candidates",{}).get("angle",[])
                  if abs(candidate["value"]-90)>0.05}
    radius_mismatch=bool(explicit-{1,2,3,4}) or (
        bool(explicit) and explicit!={1,2,3,4} and all(count>=2 for count in indices.values()))
    return radius_mismatch or len(angle_values)>3


def empty_component(status,fields):
    return {"has_component":False,"status":status,"source_pages":[],
            "fields":not_applicable_fields(fields),"raw":None}


def rebar_signature(result):
    return tuple((field,(result.get("evidence",{}).get(field) or {}).get("value")) for field in REBAR_FIELDS)


def main():
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,"reconfigure"):stream.reconfigure(encoding="utf-8")
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf",type=Path,required=True)
    parser.add_argument("--screen-cache",type=Path,required=True)
    parser.add_argument("--config",type=Path,default=ROOT/"config/target_drawings.yaml")
    parser.add_argument("--dpi",type=int,choices=(400,500,600),default=400)
    parser.add_argument("--reuse-render",type=Path)
    parser.add_argument("--output-root",type=Path,default=ROOT/"outputs")
    parser.add_argument("--baseline",type=Path,default=ROOT/"baseline/baseline_support_extractor_v1/regression_expected.json")
    args=parser.parse_args()
    run=allocate(args.output_root);doc=None
    manifest={"time":datetime.now(timezone.utc).isoformat(),"status":"running","mode":"blind_full_run",
              "pipeline_version":"baseline_support_extractor_v1+batch_orchestrator","dpi":args.dpi}
    try:
        config=load_config(args.config);targets=config["target_types"]
        pdf_hash=file_hash(args.pdf);cache=json.loads(args.screen_cache.read_text(encoding="utf-8"))
        if cache["pdf_sha256"]!=pdf_hash:raise ValueError("筛页缓存PDF指纹不符")
        doc,auth=open_pdf(args.pdf);pages=reclassify_pages(cache["pages"],config,len(doc))
        groups={target:[page for page in pages if page["types"]==[target]] for target in targets}
        manifest.update(auth,pdf_sha256=pdf_hash,targets=targets,page_groups={k:[p["page"] for p in v] for k,v in groups.items()})
        for name in ("src","extractor","config"):
            shutil.copytree(ROOT/name,run/f"{name}_snapshot",ignore=shutil.ignore_patterns("__pycache__"))
        save_json(run/"screen_index_reclassified.json",{"pdf_sha256":pdf_hash,"pages":pages})
        print(f"PDF认证={auth['authenticated']}，总页数={len(doc)}，目标类型={len(targets)}，实验={run.name}",flush=True)
        reuse=args.reuse_render
        if reuse:
            old=json.loads((reuse/"manifest.json").read_text(encoding="utf-8"))
            if old.get("pdf_sha256")!=pdf_hash or old.get("dpi")!=args.dpi:
                raise ValueError("渲染复用目录PDF/DPI不匹配")
        engines=(OCREngine(2400,4000),OCREngine(3000,6000))
        supports=[];extra_review=[]
        for target in targets:
            infos=groups[target]
            print(f"[{targets.index(target)+1}/{len(targets)}] {target}：关联页={[p['page'] for p in infos]}",flush=True)
            if not infos:
                support={"support_type":target,"page_numbers":[],
                         "steel_arch":empty_component("PAGE_ASSIGNMENT_UNCERTAIN",STEEL_FIELDS),
                         "rebar":empty_component("PAGE_ASSIGNMENT_UNCERTAIN",REBAR_FIELDS),"ocr_artifacts":[]}
                extra_review.append({"support_type":target,"component":"page_assignment","field":"*","predicted_value":None,
                                     "status":"AMBIGUOUS","reason":"PAGE_ASSIGNMENT_UNCERTAIN","source_page":None,"source_text":None})
                supports.append(support);continue
            try:
                raw=process_support(doc,infos,target,config,engines,run,args.dpi,args.pdf.name,reuse)
            except Exception as exc:
                support={"support_type":target,"page_numbers":[p["page"] for p in infos],
                         "steel_arch":empty_component("PRESENT_BUT_FAILED",STEEL_FIELDS),
                         "rebar":empty_component("PRESENT_BUT_FAILED",REBAR_FIELDS),"error":str(exc),"ocr_artifacts":[]}
                extra_review.append({"support_type":target,"component":"pipeline","field":"*","predicted_value":None,
                                     "status":"AMBIGUOUS","reason":"OTHER","source_page":None,"source_text":str(exc)})
                supports.append(support);continue
            steel=model_steel(raw,steel_schema_mismatch(run,raw) if raw.get("has_steel_arch") else False)
            rebar=None;rebar_folder=None
            if raw.get("has_n1n2_rebar"):
                results=[]
                for page in raw.get("rebar_pages",[]):
                    page_folder=run/"rebar"/target.replace("-","_")/f"page_{page:04d}"
                    try:
                        item=process_rebar_page(doc,page,target,None,engines,page_folder,args.dpi)
                        results.append((item,page_folder))
                    except Exception as exc:
                        extra_review.append({"support_type":target,"component":"rebar","field":"*","predicted_value":None,
                                             "status":"NOT_FOUND","reason":"OTHER","source_page":page,"source_text":str(exc)})
                if results:
                    signatures={rebar_signature(item) for item,_ in results}
                    if len(signatures)>1:
                        extra_review.append({"support_type":target,"component":"rebar","field":"*","predicted_value":None,
                                             "status":"AMBIGUOUS","reason":"PAGE_ASSIGNMENT_UNCERTAIN",
                                             "source_page":"、".join(map(str,raw.get("rebar_pages",[]))),"source_text":None})
                    selected,rebar_folder=results[0]
                    rebar=model_rebar(selected,rebar_schema_mismatch(rebar_folder,selected))
                else:
                    rebar={"has_component":True,"status":"PRESENT_BUT_FAILED","source_pages":raw.get("rebar_pages",[]),
                           "fields":not_applicable_fields(REBAR_FIELDS),"raw":None}
            else:
                rebar=empty_component("NOT_APPLICABLE",REBAR_FIELDS)
            artifact_paths=[]
            for page in [p["page"] for p in infos]:
                folder=run/f"page_{page:04d}"
                artifact_paths.append({"page":page,"whole_ocr":str(folder/"whole_ocr.json"),
                                       "pdf_text":str(folder/"pdf_text_records.json"),"presence":str(folder/"page_presence.json")})
            support={"support_type":target,"page_numbers":[p["page"] for p in infos],
                     "steel_arch":steel,"rebar":rebar,"ocr_artifacts":artifact_paths,
                     "rebar_artifact_folder":str(rebar_folder) if rebar_folder else None}
            supports.append(support)
        payload={"metadata":{**auth,"source_pdf":args.pdf.name,"pdf_sha256":pdf_hash,"dpi":args.dpi,
                             "experiment":run.name,"mode":"blind_full_run","target_types":targets},
                 "supports":supports}
        review=extra_review[:]
        for support in supports:review.extend(review_items(support))
        payload["review"]=review
        payload["regression"]=compare_regression(payload,args.baseline)
        if not payload["regression"]["all_passed"]:
            print("警告：已验收基线回归失败，详见JSON",file=sys.stderr,flush=True)
        final_run=run/"final";visuals=final_run/"visualizations"
        for support in supports:
            target=support["support_type"];folder=visuals/target
            if support["steel_arch"].get("has_component"):
                annotate_steel(run,target,support["steel_arch"],folder/"steel_arch.png")
            if support["rebar"] and support["rebar"].get("has_component") and support.get("rebar_artifact_folder"):
                copy_rebar_visual(support["rebar_artifact_folder"],folder/"rebar.png")
        export_all(payload,final_run)
        final=args.output_root/"final";final.mkdir(exist_ok=True)
        for file in final_run.iterdir():
            destination=final/file.name
            if file.is_dir():shutil.copytree(file,destination,dirs_exist_ok=True)
            else:shutil.copyfile(file,destination)
        save_json(final/"full_run_reference.json",{"experiment":run.name})
        manifest.update(status="completed",regression_passed=payload["regression"]["all_passed"],review_count=len(review))
        print(f"完成：review={len(review)}，回归={'PASS' if payload['regression']['all_passed'] else 'FAIL'}",flush=True)
        print(f"Excel：{final/'support_parameters_all.xlsx'}",flush=True)
        return 0
    except Exception as exc:
        manifest.update(status="failed",error=str(exc));print(f"失败：{exc}",file=sys.stderr,flush=True);return 1
    finally:
        if doc:doc.close()
        save_json(run/"manifest.json",manifest)


if __name__=="__main__":raise SystemExit(main())

