"""仅从 OCR 文本提取；不访问图片文件名或标准答案，不补工程经验值。"""
import re
import unicodedata

PARSER_VERSION = '1.1'

def clean(text):
    text = unicodedata.normalize('NFKC', text)
    return re.sub(r'\s+', '', text).replace('′', "'").replace('″', '"').replace('’', "'").replace('”', '"')

def parse_params(records, source_image=None):
    texts = [clean(r['text']) for r in records]
    result = dict(source_image=source_image, support_type=None,
                  radii={'R1_mm': None, 'R2_mm': None}, angles=[], segments=[],
                  joint_types=[], steel_section=None)
    supports, radii, segments, steels = set(), {}, {}, set()
    for t in texts:
        for m in re.finditer(r'(?<![A-Za-z])([A-Z]{1,4})[-—–]([IVX]+)([a-z]?)(?![A-Za-z])', t):
            supports.add(f'{m[1]}-{m[2]}{m[3]}')
        for m in re.finditer(r'[Rr]([12lI])(?:=|[-—:])([0-9Oo]{3,6})(?![0-9Oo])', t):
            key = 'R' + ('1' if m[1] in 'lI' else m[1]) + '_mm'
            radii.setdefault(key, set()).add(int(m[2].replace('O', '0').replace('o', '0')))
        # 实际OCR会把秒的双引号识别为单引号；完整DMS上下文内才允许此修正。
        for m in re.finditer(r'(?<!\d)(\d{1,3})°(\d{1,2})\'(\d{1,2})(?:"|\'{1,2})(?!\d)', t):
            d, minute, second = map(int, m.group(1, 2, 3))
            if d <= 360 and minute < 60 and second < 60:
                angle = f'{d}°{minute}′{second}″'
                if angle not in result['angles']:
                    result['angles'].append(angle)
        for m in re.finditer(r'(?<!\d)([0-9Oo]{3,6})\(([A-Z])单元\)', t):
            segments.setdefault(m[2], set()).add(int(m[1].replace('O', '0').replace('o', '0')))
        for m in re.finditer(r'(?<![A-Za-z])(III|II|I)型接头', t):
            if m[0] not in result['joint_types']:
                result['joint_types'].append(m[0])
        for m in re.finditer(r'(?:工字钢(?:型号)?[:：]?|I)(\d{2}[abc]?)(?=工字钢|$)', t):
            steels.add('I' + m[1])
    result['support_type'] = next(iter(supports)) if len(supports) == 1 else None
    for key, values in radii.items():
        result['radii'][key] = next(iter(values)) if len(values) == 1 else None
    result['segments'] = [{'name': key, 'length_mm': next(iter(values)) if len(values) == 1 else None}
                          for key, values in sorted(segments.items())]
    result['steel_section'] = next(iter(steels)) if len(steels) == 1 else None
    return result
