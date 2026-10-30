"""构件存在性由页面标题及位置决定，不由支护类型、参数或真值决定。"""
import re
import unicodedata
import numpy as np

def normalized(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text)).upper()

def pdf_text_records(page, page_number, dpi):
    """抽取PDF文字行；坐标变换至旋转后的高清页面，供标题证据使用。"""
    import pymupdf
    records = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            text = ''.join(span['text'] for span in line['spans'])
            if not text.strip():
                continue
            r = pymupdf.Rect(line['bbox']) * page.rotation_matrix
            scale = dpi / 72
            records.append({'text': text, 'page': page_number, 'confidence': None,
                            'stage': 'pdf_text', 'box': [[r.x0*scale,r.y0*scale], [r.x1*scale,r.y0*scale],
                                                        [r.x1*scale,r.y1*scale], [r.x0*scale,r.y1*scale]]})
    return records

def title_kind(text):
    """需要独立的图名；排除注释、引用和仅有N1/N2编号的数量表。"""
    t = normalized(text)
    if len(t) > 65 or re.search(r'参见|参照|配合|详见|本图|按.*图|说明|没有|无钢架|未设|不设|取消|[。;；:：]', t):
        return None
    if re.fullmatch(r'.*钢架组合安装图(?:[（(][一二三四五0-9]+[）)])?', t):
        return 'steel_arch'
    if re.fullmatch(r'N[1IL][、,，/&和及·.]*N?2钢筋大[样祥](?:图)?', t):
        return 'n1n2_rebar'
    if re.fullmatch(r'N[1IL]钢筋大[样祥](?:图)?', t):
        return 'n1_rebar'
    if re.fullmatch(r'N2钢筋大[样祥](?:图)?', t):
        return 'n2_rebar'
    return None

def detect_titles(records, image_size):
    width, height = image_size
    anchors = []
    for r in records:
        kind = title_kind(r['text'])
        if not kind:
            continue
        p = np.asarray(r['box'], dtype=float)
        box = [float(p[:,0].min()),float(p[:,1].min()),float(p[:,0].max()),float(p[:,1].max())]
        x0,y0,x1,y1 = box
        # 图框标题栏及极小噪声不视为独立构件图名。
        if not (0 <= x0 < x1 <= width + 2 and height*.04 < (y0+y1)/2 < height*.92 and x1-x0 > (y1-y0)*1.8):
            continue
        if r.get('confidence') is not None and r['confidence'] < .60:
            continue
        anchors.append({'component':kind, 'page':r['page'], 'anchor_text':r['text'],
                        'anchor_bbox':[round(v,2) for v in box], 'confidence':r.get('confidence'),
                        'source':r['stage'], 'record':r, 'decision':'独立图名匹配且位于图纸内容区'})
    return anchors

def summarize_presence(anchors, checked_pages):
    steel = [a for a in anchors if a['component']=='steel_arch']
    rebar = [a for a in anchors if a['component']=='n1n2_rebar']
    singles = {kind:[a for a in anchors if a['component']==kind] for kind in ('n1_rebar','n2_rebar')}
    if singles['n1_rebar'] and singles['n2_rebar']:
        rebar += singles['n1_rebar'] + singles['n2_rebar']
    return {'has_steel_arch': bool(steel), 'steel_arch_pages': sorted({a['page'] for a in steel}),
            'steel_arch_anchors':steel, 'has_n1n2_rebar':bool(rebar),
            'rebar_pages':sorted({a['page'] for a in rebar}), 'rebar_anchors':rebar,
            'rebar_status':'PRESENT_NOT_EXTRACTED' if rebar else 'NOT_APPLICABLE',
            'presence_check':{'checked_pages':checked_pages, 'complete':True,
                              'absence_basis':'全部关联页的PDF文字行及高清整页OCR均未检出符合空间约束的独立标题'}}

def apply_steel_status(result):
    if not result['has_steel_arch']:
        for key in ('R1_mm','R2_mm','beta_raw','beta_deg','steel_profile'):
            result[key] = None
        result['evidence'] = {k:None for k in ('R1','R2','beta','steel_profile')}
        result['parameter_candidates'] = {}
        result['beta_candidates'] = []
        result['steel_arch_status'] = 'NOT_APPLICABLE'
    else:
        result['steel_arch_status'] = 'EXTRACTED' if all(result.get(k) is not None for k in
            ('R1_mm','R2_mm','beta_deg','steel_profile')) else 'PRESENT_BUT_FAILED'
    return result
