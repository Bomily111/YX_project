"""PDF上传、SHA256缓存、统一payload和Master Demo输出桥接。"""
from __future__ import annotations
import hashlib,json,shutil,time
from datetime import datetime, timezone
from pathlib import Path
import os
from typing import Callable

from src.master_support_demo.payload import SupportParameterPayloadBuilder
from .pipeline_adapter import PipelineError, run_existing_pipeline

ROOT=Path(os.getenv("SUPPORT_DEMO_ROOT",Path(__file__).resolve().parents[1])).resolve()
CACHE_ROOT=ROOT/"outputs/master_demo/extraction_cache"
LOG_ROOT=ROOT/"outputs/master_demo/logs"
OUTPUT_ROOT=ROOT/"outputs/master_demo"

def sha256_file(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def _log(record:dict)->None:
    LOG_ROOT.mkdir(parents=True,exist_ok=True)
    record={**record,"timestamp":datetime.now(timezone.utc).isoformat()}
    with (LOG_ROOT/"pdf_to_master_demo.jsonl").open('a',encoding='utf-8') as f:f.write(json.dumps(record,ensure_ascii=False)+'\n')

def seed_cache(pdf_hash:str, extraction_path:Path)->Path:
    cache=CACHE_ROOT/pdf_hash;cache.mkdir(parents=True,exist_ok=True)
    raw=json.loads(extraction_path.read_text(encoding='utf-8'))
    (cache/'extraction.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2),encoding='utf-8')
    (cache/'manifest.json').write_text(json.dumps({"pdf_sha256":pdf_hash,"source":"PREVIOUS_REAL_OCR_RESULT","seed_source":extraction_path.relative_to(ROOT).as_posix()},ensure_ascii=False,indent=2),encoding='utf-8')
    return cache

def process_master_pdf(pdf_path:Path, source_name:str, request_dir:Path, runner:Callable=run_existing_pipeline)->dict:
    started=time.perf_counter();pdf_hash=sha256_file(pdf_path);cache=CACHE_ROOT/pdf_hash;cached=cache/'extraction.json'
    if cached.is_file():
        extraction=json.loads(cached.read_text(encoding='utf-8'));cache_status='CACHE_HIT';source='PREVIOUS_REAL_OCR_CACHE'
    else:
        extraction=runner(pdf_path,request_dir,400);cache.mkdir(parents=True,exist_ok=True)
        (cache/'extraction.json').write_text(json.dumps(extraction,ensure_ascii=False,indent=2),encoding='utf-8');cache_status='OCR_RUN';source='EXISTING_OCR_PIPELINE'
        (cache/'manifest.json').write_text(json.dumps({"pdf_sha256":pdf_hash,"source":source},ensure_ascii=False,indent=2),encoding='utf-8')
    payloads=SupportParameterPayloadBuilder(ROOT).build_all(extraction,pdf_hash,source)
    if not payloads:raise PipelineError('NO_SUPPORT_TYPE','没有识别到目标支护类型。')
    selected='ZZ-Va' if 'ZZ-Va' in payloads else next(iter(payloads))
    OUTPUT_ROOT.mkdir(parents=True,exist_ok=True)
    latest=OUTPUT_ROOT/'latest_support_payload.json';latest.write_text(json.dumps(payloads[selected],ensure_ascii=False,indent=2),encoding='utf-8')
    model=None
    if selected=='ZZ-Va':
        source_glb=ROOT/'outputs/master_demo/ZZ-Va_support_1m_current.glb';target=OUTPUT_ROOT/'ZZ-Va_from_pdf_support_1m.glb';shutil.copy2(source_glb,target)
        base_meta=json.loads((ROOT/'outputs/master_demo/ZZ-Va_support_1m_current_metadata.json').read_text(encoding='utf-8'))
        base_meta.update({"source_pdf_hash":pdf_hash,"support_type":selected,"extraction_source":source,"confirmed_parameters":payloads[selected]['confirmed'],"provisional_parameters":payloads[selected]['provisional']})
        meta_path=OUTPUT_ROOT/'ZZ-Va_from_pdf_support_1m_metadata.json';meta_path.write_text(json.dumps(base_meta,ensure_ascii=False,indent=2),encoding='utf-8')
        model={"glb_url":"/outputs/master_demo/ZZ-Va_from_pdf_support_1m.glb","metadata_url":"/outputs/master_demo/ZZ-Va_from_pdf_support_1m_metadata.json"}
    elapsed=round(time.perf_counter()-started,3)
    result={"status":"ok","processing_state":"MODEL_READY","cache_status":cache_status,"pdf_sha256":pdf_hash,"source_file":Path(source_name).name,"support_types":list(payloads),"selected_support_type":selected,"payload":payloads[selected],"payloads":payloads,"model":model,"elapsed_seconds":elapsed}
    _log({"pdf_hash":pdf_hash,"cache_status":cache_status,"elapsed_seconds":elapsed,"payload_generated":True,"component_generation":payloads[selected]['component_status'],"glb_export":bool(model)})
    return result

def load_latest_real_cache()->dict:
    """返回最新的可用真实缓存，并跳过损坏或不兼容的历史缓存。

    V1.1 曾把“最新文件”直接视为可建模缓存；当最新文件来自单页图片且
    没有任何可用支护 payload 时，``next(iter(payloads))`` 会抛出
    ``StopIteration``。这里逐个检查缓存，只有能生成 payload 的缓存才会被
    采用。没有可用项属于正常业务状态，不再抛出 Flask 500。
    """
    caches = sorted(
        CACHE_ROOT.glob("*/extraction.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not caches:
        return {
            "status": "unavailable",
            "processing_state": "CACHE_UNAVAILABLE",
            "cache_status": "CACHE_NOT_FOUND",
            "message": "未找到可用OCR缓存，可上传图纸重新识别。",
            "payloads": {},
        }

    incompatible: list[dict] = []
    for cache_path in caches:
        pdf_hash = cache_path.parent.name
        try:
            extraction = json.loads(cache_path.read_text(encoding="utf-8"))
            if not isinstance(extraction, dict) or not isinstance(extraction.get("supports"), list):
                raise ValueError("缓存缺少 supports 列表")
            payloads = SupportParameterPayloadBuilder(ROOT).build_all(
                extraction, pdf_hash, "PREVIOUS_REAL_OCR_CACHE"
            )
            if not payloads:
                raise ValueError("缓存没有可建模的支护 payload")
        except Exception as exc:
            incompatible.append({"cache_hash": pdf_hash, "reason": str(exc)})
            continue

        selected = "ZZ-Va" if "ZZ-Va" in payloads else next(iter(payloads))
        metadata = extraction.get("metadata") or {}
        return {
            "status": "ok",
            "processing_state": "MODEL_READY",
            "cache_status": "CACHE_HIT",
            "pdf_sha256": pdf_hash,
            "support_types": list(payloads),
            "selected_support_type": selected,
            "payload": payloads[selected],
            "payloads": payloads,
            "drawing_hash": pdf_hash,
            "drawing_input": {
                "source_type": "PDF_DOCUMENT",
                "filename": Path(metadata.get("source_pdf") or "cached_drawing.pdf").name,
                "hash": pdf_hash,
                "pages": metadata.get("page_count"),
                "normalized_images": [],
                "preprocessing_status": "REAL_OCR_CACHE",
                "original_path": Path(metadata.get("source_pdf") or "cached_drawing.pdf").name,
                "pipeline_input": Path(metadata.get("source_pdf") or "cached_drawing.pdf").name,
            },
            "skipped_incompatible_cache_count": len(incompatible),
            "model": {
                "glb_url": "/outputs/master_demo/ZZ-Va_from_pdf_support_1m.glb",
                "metadata_url": "/outputs/master_demo/ZZ-Va_from_pdf_support_1m_metadata.json",
            } if selected == "ZZ-Va" else None,
        }

    return {
        "status": "unavailable",
        "processing_state": "CACHE_UNAVAILABLE",
        "cache_status": "CACHE_SCHEMA_INCOMPATIBLE",
        "message": "现有OCR缓存结构不兼容，可上传图纸重新识别。",
        "incompatible_caches": incompatible,
        "payloads": {},
    }
