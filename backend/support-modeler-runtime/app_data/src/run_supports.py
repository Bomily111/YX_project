"""多支护类型入口：页组→构件存在性→按需钢架提取→独立评价。"""
import argparse
import json
import shutil
import sys
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from run_pdf import allocate,file_hash
from pdf_io import open_pdf
from pdf_screen import load_config,scan_document,support_types,normalize
from pdf_export import save_json
from ocr_engine import OCREngine
from support_pipeline import process_support
from support_evaluate import read_truth,evaluate_supports
from support_export import export_supports

def reclassify_pages(pages, config, page_count):
    if [p['page'] for p in pages]!=list(range(1,page_count+1)):
        raise ValueError('筛页缓存不完整，不能据此判定构件不存在')
    return [{**p,'types':support_types(p['text'],config),
             'keywords':[w for w in config['screen_keywords'] if w in normalize(p['text'])]} for p in pages]

def main():
    for stream in (sys.stdout,sys.stderr):
        if hasattr(stream,'reconfigure'):
            stream.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf',type=Path,required=True)
    parser.add_argument('--config',type=Path,default=ROOT/'config/target_drawings.yaml')
    parser.add_argument('--support-type',nargs='+',help='默认只处理配置中的本批验收类型，可指定其中一个或多个')
    parser.add_argument('--dpi',type=int,choices=(300,400,500,600),default=400)
    parser.add_argument('--output-root',type=Path,default=ROOT/'outputs')
    parser.add_argument('--ground-truth',type=Path,default=ROOT/'data/ground_truth/support_ground_truth.xlsx')
    parser.add_argument('--screen-only',action='store_true')
    parser.add_argument('--screen-cache',type=Path)
    parser.add_argument('--reuse-render',type=Path)
    args=parser.parse_args()
    run=allocate(args.output_root)
    manifest={'time':datetime.now(timezone.utc).isoformat(),'status':'running','source_pdf':args.pdf.name,'dpi':args.dpi,
              'pipeline_version':'4.0-presence-first'}
    doc=None
    try:
        config=load_config(args.config)
        targets=args.support_type or config['validation_types']
        if len(targets)!=len(set(targets)) or any(t not in config['validation_types'] for t in targets):
            raise ValueError('本阶段仅支持配置validation_types中的不重复类型')
        manifest.update(targets=targets,pdf_sha256=file_hash(args.pdf),config_sha256=file_hash(args.config))
        for name in ('src','extractor','config'):
            shutil.copytree(ROOT/name,run/f'{name}_snapshot',ignore=shutil.ignore_patterns('__pycache__'))
        doc,auth=open_pdf(args.pdf)
        manifest.update(auth)
        print(f'PDF认证={auth["authenticated"]}，总页数={len(doc)}，实验={run.name}',flush=True)
        save_json(run/'manifest.json',manifest)
        if args.screen_cache:
            cached=json.loads(args.screen_cache.read_text(encoding='utf-8'))
            if cached['pdf_sha256']!=manifest['pdf_sha256']:
                raise ValueError('筛页缓存PDF指纹不符')
            # 只复用完整原始文本/OCR，不复用旧target或存在性判断；当前配置重新分类。
            pages=reclassify_pages(cached['pages'],config,len(doc))
            manifest['screen_cache']={'path':str(args.screen_cache),'policy':'reuse full raw page text; reclassify using current config'}
        else:
            pages=scan_document(doc,config,targets[0],lambda:OCREngine(1200,1800),run/'screen')
            pages=reclassify_pages(pages,config,len(doc))
        save_json(run/'screen_index.json',{'pdf_sha256':manifest['pdf_sha256'],'config_sha256':manifest['config_sha256'],'pages':pages})
        groups={target:[p for p in pages if p['types']==[target]] for target in targets}
        manifest['page_groups']={t:[p['page'] for p in group] for t,group in groups.items()}
        manifest['mixed_type_pages']=[p['page'] for p in pages if len(p['types'])>1 and any(t in p['types'] for t in targets)]
        print('页面分组：'+json.dumps(manifest['page_groups'],ensure_ascii=False),flush=True)
        if args.screen_only:
            manifest['status']='screen_complete'
            return 0
        reuse=None
        if args.reuse_render:
            old=json.loads((args.reuse_render/'manifest.json').read_text(encoding='utf-8'))
            if old.get('pdf_sha256')!=manifest['pdf_sha256'] or old.get('dpi')!=args.dpi:
                raise ValueError('渲染缓存PDF/DPI不符')
            reuse=args.reuse_render
        engines=(OCREngine(2400,4000),OCREngine(2400,6000))
        results=[]
        for target,infos in groups.items():
            results.append(process_support(doc,infos,target,config,engines,run,args.dpi,args.pdf.name,reuse))
        # 参数结果已经保存后才读取真值；存在性及提取器没有ground_truth输入。
        if not args.ground_truth.exists():
            raise FileNotFoundError('真值文件不存在；已保存识别结果，但未生成评价')
        truth=read_truth(args.ground_truth)
        shutil.copyfile(args.ground_truth,run/'ground_truth_snapshot.xlsx')
        evaluation=evaluate_supports(results,truth)
        export_supports(results,evaluation,run/'final')
        final=args.output_root/'final'
        final.mkdir(exist_ok=True)
        for file in (run/'final').iterdir():
            shutil.copyfile(file,final/file.name)
        save_json(final/'support_run_reference.json',{'experiment':run.name})
        manifest.update(status='completed',types_processed=len(results),
                        steel_arch_status={r['support_type']:r['steel_arch_status'] for r in results})
        print(json.dumps(evaluation,ensure_ascii=False,indent=2),flush=True)
        print('输出：'+str(final/'support_parameters.xlsx'),flush=True)
        return 0
    except Exception as exc:
        manifest.update(status='failed',error=str(exc))
        print(f'失败：{exc}',file=sys.stderr,flush=True)
        return 1
    finally:
        if doc:
            doc.close()
        save_json(run/'manifest.json',manifest)
