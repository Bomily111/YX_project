"""钢架建模参数。输入OCR文本；半径mm，beta十进制度；未知/冲突保留None。"""
import json
import math
import re
import unicodedata
from pathlib import Path

VERSION = '2.0'
DATABASE = Path(__file__).resolve().parents[1] / 'database' / 'steel_profiles.json'
DMS = r'(\d{1,3})°(\d{1,2})\'(\d{1,2})(?:"|\'{1,2})'

def clean(text):
    text = unicodedata.normalize('NFKC', str(text))
    return re.sub(r'\s+', '', text).replace('′', "'").replace('″', '"').replace('’', "'").replace('”', '"')

def parse_angle(value):
    """DMS/十进制度转float，四位小数；非法输入抛ValueError，不截取残缺数字。"""
    if isinstance(value, bool) or value is None:
        raise ValueError('角度不能为空或布尔值')
    text = clean(value)
    match = re.fullmatch(DMS, text)
    if match:
        degrees, minutes, seconds = map(int, match.groups())
        if minutes >= 60 or seconds >= 60:
            raise ValueError('分和秒必须小于60')
        result = degrees + minutes / 60 + seconds / 3600
    elif re.fullmatch(r'\d+(?:\.\d+)?', text):
        result = float(text)
    else:
        raise ValueError(f'无效角度: {value}')
    if not math.isfinite(result) or not 0 <= result <= 360:
        raise ValueError('角度必须在0至360度之间')
    return round(result, 4)

def lines_from(text):
    """接受多行字符串、字符串列表或OCR记录列表；不同框不盲目拼接。"""
    if isinstance(text, str):
        return text.splitlines()
    return [r['text'] if isinstance(r, dict) else str(r) for r in text]

def unique(values):
    values = set(values)
    return next(iter(values)) if len(values) == 1 else None

def extract_with_diagnostics(text, beta_angle=None):
    """beta_angle仅选择OCR已出现的角度，不能补入OCR缺失数值。

    默认只有beta/β/侧拱夹角明确标签才建立语义。未标注的角度无论多少都不自动选。
    """
    candidates = {'R1': set(), 'R2': set(), 'beta': set(), 'steel_profile': set()}
    angle_values, supports = set(), set()
    evidence = []
    for index, raw in enumerate(lines_from(text)):
        t = clean(raw)
        found = {}
        for m in re.finditer(r'(?<![A-Za-z0-9])[Rr]([12lI])(?:=|[-—:])([0-9Oo]{3,6})(?![0-9Oo.])', t):
            key = 'R1' if m[1] in '1lI' else 'R2'
            value = int(m[2].replace('O', '0').replace('o', '0'))
            if value > 0:
                candidates[key].add(value)
                found[key] = value
        for m in re.finditer(r'(?<![A-Za-z0-9])I(\d{1,2}(?:\.\d+)?[a-c]?)(?![A-Za-z0-9.])', t, re.I):
            profile = 'I' + m[1].lower()
            candidates['steel_profile'].add(profile)
            found['steel_profile'] = profile
        for m in re.finditer(r'(?<!\d)' + DMS + r'(?!\d)', t):
            try:
                angle_values.add(parse_angle(m[0]))
            except ValueError:
                pass
        # 纯十进制度文本允许被显式人工选择；不把图上任意整数当角度。
        if re.fullmatch(r'\d+\.\d+', t):
            try:
                angle_values.add(parse_angle(t))
            except ValueError:
                pass
        for m in re.finditer(r'(?:beta|β|侧拱夹角)[:=：]?(' + DMS + r'|\d+(?:\.\d+)?)(?![\d.°\'"])', t, re.I):
            try:
                value = parse_angle(m[1])
                candidates['beta'].add(value)
                angle_values.add(value)
                found['beta'] = value
            except ValueError:
                pass
        for m in re.finditer(r'(?<![A-Za-z])([A-Z]{1,4})[-—–]([IVX]+)([a-z]?)(?![A-Za-z])', t):
            supports.add(f'{m[1]}-{m[2]}{m[3]}')
        if found:
            evidence.append({'line': index, 'text': raw, 'fields': found})
    selection = 'explicit_label'
    issues = []
    if beta_angle is not None:
        chosen = parse_angle(beta_angle)
        selection = 'human_assigned_ocr_angle'
        if chosen not in angle_values:
            issues.append('指定beta未在本次OCR文本中出现，未补值')
        elif candidates['beta'] and candidates['beta'] != {chosen}:
            candidates['beta'].add(chosen)
            issues.append('人工指定beta与OCR标签冲突')
        else:
            candidates['beta'].add(chosen)
    result = {'type': 'steel_arch', **{key: unique(values) for key, values in candidates.items()}}
    for key, values in candidates.items():
        if len(values) > 1:
            issues.append(f'{key}有冲突候选，需人工确认')
        elif not values:
            issues.append(f'{key}未确定，需人工输入或确认')
    audit = dict(version=VERSION, support_type=unique(supports), beta_selection=selection,
                 candidates={k: sorted(v) for k, v in candidates.items()},
                 angle_candidates=sorted(angle_values), evidence=evidence, issues=issues)
    return result, audit

def extract(text, beta_angle=None):
    """公开的文本→四项建模参数接口。"""
    return extract_with_diagnostics(text, beta_angle)[0]

def to_model_parameters(extracted, support_type=None, database_path=DATABASE):
    """半径mm→m；截面数据库尺寸保留mm。未收录的型号保留名称但尺寸为空。"""
    profiles = json.loads(Path(database_path).read_text(encoding='utf-8-sig'))
    profile = extracted['steel_profile']
    dims = profiles.get(profile, {})
    steel = {'type': profile, **{key: dims.get(key) for key in
             ('height', 'width', 'web_thickness', 'flange_thickness')}}
    return {'support_type': support_type,
            'geometry': {'R1': extracted['R1'] / 1000 if extracted['R1'] is not None else None,
                         'R2': extracted['R2'] / 1000 if extracted['R2'] is not None else None,
                         'beta': extracted['beta']}, 'steel': steel}
