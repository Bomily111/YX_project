"""对人工提供的部分真值进行集合/标量比对；额外项标记未标注，不能判错。"""
import argparse
import json
from pathlib import Path

def evaluate_model(params, truth):
    """只评价4项建模参数。旧角度集合不建立beta语义，null真值不计识别成功。"""
    geometry = truth.get('geometry', {})
    expected = {
        'R1': geometry.get('R1', truth.get('R1_mm', truth.get('radii', {}).get('R1_mm'))),
        'R2': geometry.get('R2', truth.get('R2_mm', truth.get('radii', {}).get('R2_mm'))),
        'beta': geometry.get('beta', truth.get('beta')),
        'steel_profile': truth.get('steel', {}).get('type', truth.get('steel_profile', truth.get('steel_section'))),
    }
    for key in ('R1', 'R2'):
        if key not in geometry and expected[key] is not None:
            expected[key] /= 1000
    actual = {**params['geometry'], 'steel_profile': params['steel']['type']}
    rows = []
    for key, value in expected.items():
        got = actual[key]
        if value is None:
            status = '未标注，无法判断正确性'
        elif got is None:
            status = '未识别'
        elif isinstance(value, (int, float)) and isinstance(got, (int, float)):
            status = '正确识别' if abs(value - got) <= 0.00005 else '识别错误'
        else:
            status = '正确识别' if value == got else '识别错误'
        rows.append(f'{status}: {key} | 标准={value!r} | 识别={got!r}')
    return '\n'.join(rows) + '\n'

def evaluate(params, truth):
    if 'geometry' in params:
        return evaluate_model(params, truth)
    rows = []
    def check(field, expected, actual):
        status = '正确识别' if actual == expected else ('未识别' if actual is None else '识别错误')
        rows.append(f'{status}: {field} | 标准={expected!r} | 识别={actual!r}')
    for key in ('support_type', 'steel_section'):
        if key in truth:
            check(key, truth[key], params.get(key))
    for key, value in truth.get('radii', {k: truth[k] for k in ('R1_mm', 'R2_mm') if k in truth}).items():
        check(key, value, params.get('radii', {}).get(key))
    actual_segments = {r['name']: r['length_mm'] for r in params.get('segments', [])}
    expected_segments = truth.get('segment_lengths_mm', {r['name']: r['length_mm'] for r in truth.get('segments', [])})
    for key, value in expected_segments.items():
        check(f'segment.{key}', value, actual_segments.get(key))
    for key in ('angles', 'joint_types'):
        if key in truth:
            actual = set(params.get(key, []))
            for value in truth[key]:
                check(key, value, value if value in actual else None)
            for value in sorted(actual - set(truth[key])):
                rows.append(f'额外识别（部分真值未标注，需人工核查）: {key}={value}')
    return '\n'.join(rows) + '\n'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--params', type=Path, required=True)
    parser.add_argument('--ground-truth', type=Path, required=True)
    args = parser.parse_args()
    print(evaluate(json.loads(args.params.read_text(encoding='utf-8-sig')), json.loads(args.ground_truth.read_text(encoding='utf-8-sig'))))
