"""优先文本层筛页，文本不可用才低DPI OCR；一类型对应多个页。"""
import json
import re
import unicodedata
from pathlib import Path
import yaml
from pdf_io import render_page

def load_config(path):
    return yaml.safe_load(Path(path).read_text(encoding='utf-8-sig'))

def normalize(text):
    text = unicodedata.normalize('NFKC', text)
    return re.sub(r'\s+', '', text).replace('—', '-').replace('–', '-').replace('－', '-').upper()

def support_types(text, config):
    text = normalize(text)
    found = []
    aliases = config.get('type_aliases', {})
    for name in config['target_types']:
        forms = [name, *aliases.get(name, [])]
        if any(re.search(r'(?<![A-Z0-9])' + re.escape(normalize(form)) + r'(?![A-Z0-9])', text)
               for form in forms):
            found.append(name)
    return found

def scan_document(doc, config, target, engine_factory, folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    pages, engine = [], None
    for index in range(len(doc)):
        page = doc[index]
        text = page.get_text('text', sort=True)
        usable = len(re.sub(r'\s+', '', text)) >= 40 and text.count('\ufffd') / max(1, len(text)) < 0.1
        records = None
        if not usable:
            if engine is None:
                engine = engine_factory()
            records = engine.recognize(render_page(page, config['screen_dpi'], screening=True))
            text = '\n'.join(r['text'] for r in records)
        found = support_types(text, config)
        keywords = [word for word in config['screen_keywords'] if word in normalize(text)]
        info = {'page': index + 1, 'method': 'text_layer' if usable else 'low_dpi_ocr',
                'types': found, 'keywords': keywords, 'text': text,
                'direct_target': target in found, 'size_pt': list(page.rect)}
        pages.append(info)
        (folder / f'page_{index + 1:04d}.json').write_text(json.dumps({**info, 'ocr': records}, ensure_ascii=False, indent=2), encoding='utf-8')
        if (index + 1) % 20 == 0 or target in found:
            print(f'筛页 {index + 1}/{len(doc)} | {info["method"]} | 类型={found}', flush=True)
    direct = {p['page'] for p in pages if p['direct_target']}
    for p in pages:
        # 无类型但与目标页相邻且有支护关键词，仅作为待核候选；不直接归属。
        p['neighbor_candidate'] = not p['types'] and bool(p['keywords']) and any(abs(p['page'] - n) <= 1 for n in direct)
        p['candidate'] = p['direct_target'] or p['neighbor_candidate']
    return pages
