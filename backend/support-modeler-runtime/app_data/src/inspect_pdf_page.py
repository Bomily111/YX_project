"""开发诊断：指定物理页检查两级OCR；正式自动流程使用run_pdf.py。"""
import argparse
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from run_pdf import allocate, file_hash
from pdf_io import open_pdf, render_page
from pdf_export import save_json
from pdf_screen import load_config
from pdf_regions import find_arch_regions, local_ocr
from ocr_engine import OCREngine
from extractor.steel_arch_pdf import infer_beta

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--pdf', type=Path, required=True)
    p.add_argument('--page', type=int, required=True)
    a = p.parse_args()
    run = allocate(ROOT / 'outputs')
    folder = run / f'page_{a.page:04d}'
    folder.mkdir()
    doc, auth = open_pdf(a.pdf)
    image = render_page(doc[a.page - 1], 400, folder / 'page.png')
    doc.close()
    preview = image.copy()
    preview.thumbnail((1600, 1200))
    preview.save(folder / 'preview_for_inspection.png')
    save_json(run / 'manifest.json', {**auth, 'pdf_sha256': file_hash(a.pdf), 'dpi':400, 'diagnostic_only':True})
    records = [{**r, 'page': a.page, 'stage':'whole_page'} for r in OCREngine(2400,4000).recognize(image)]
    save_json(folder / 'whole_ocr.json', records)
    config = load_config(ROOT / 'config/target_drawings.yaml')
    regions = find_arch_regions(records, image.size, config['arch_anchors'])
    save_json(folder / 'regions.json', regions)
    print('output:', run, 'size:',image.size, 'regions:',regions, flush=True)
    engine = OCREngine(2400,6000)
    for index, region in enumerate(regions):
        crop, rows = local_ocr(image, engine, a.page, region['bbox'])
        crop.save(folder / f'arch_{index}.png')
        save_json(folder / f'arch_{index}_ocr.json', rows)
        beta, angles, geometry = infer_beta(image, region['bbox'], rows, 400)
        save_json(folder / f'arch_{index}_beta.json', {'selected':beta, 'candidates':angles,'geometry':geometry})
        print('beta:',beta,'geometry:',geometry, flush=True)
