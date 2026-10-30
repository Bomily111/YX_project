"""独立评价：真值有构件才进入参数准确率分母，不能按预测状态筛分母。"""
from pathlib import Path
from openpyxl import load_workbook

def read_truth(path):
    book = load_workbook(Path(path), read_only=True, data_only=True)
    result = {}
    try:
        for sheet in book:
            rows = iter(sheet.values)
            headers = [str(v).strip() for v in next(rows, [])]
            for values in rows:
                row = dict(zip(headers, values))
                name = row.get('support_type', row.get('支护类型'))
                if not name:
                    continue
                has = row.get('has_steel_arch')
                if not isinstance(has, bool):
                    if has in (0,1):
                        has = bool(has)
                    elif str(has).lower() in ('true','false'):
                        has = str(has).lower() == 'true'
                    else:
                        has = None
                result[name] = {'has_steel_arch':has, 'R1_mm':row.get('R1_mm',row.get('R1')),
                                'R2_mm':row.get('R2_mm',row.get('R2')), 'beta_deg':row.get('beta_deg',row.get('beta')),
                                'steel_profile':row.get('steel_profile',row.get('工字钢'))}
    finally:
        book.close()
    return result

def evaluate_supports(results, truth):
    counters = {k:{'correct':0,'total':0} for k in
                ('steel_arch_presence_accuracy','R1_accuracy','R2_accuracy','beta_accuracy','steel_profile_accuracy')}
    mapping = {'R1_mm':'R1_accuracy','R2_mm':'R2_accuracy','beta_deg':'beta_accuracy','steel_profile':'steel_profile_accuracy'}
    rows = []
    for r in results:
        expected = truth.get(r['support_type'], {})
        has = expected.get('has_steel_arch')
        check = {'support_type':r['support_type'], 'presence_expected':has,
                 'presence_actual':r['has_steel_arch'], 'fields':{}, 'evaluation_status':'UNLABELED'}
        if has is not None:
            ok = has == r['has_steel_arch']
            count = counters['steel_arch_presence_accuracy']
            count['total'] += 1
            count['correct'] += int(ok)
            check['evaluation_status'] = 'PRESENCE_MISMATCH' if not ok else ('CORRECT_NOT_APPLICABLE' if not has else 'ALL_CORRECT')
        if has is True:
            for field, metric in mapping.items():
                value = expected.get(field)
                actual = r.get(field)
                if value is None:
                    check['fields'][field] = {'status':'UNLABELED'}
                    if check['evaluation_status']=='ALL_CORRECT':
                        check['evaluation_status']='PARTIALLY_LABELED'
                    continue
                ok = actual is not None and (abs(float(actual)-float(value)) <= .00005 if field=='beta_deg' else actual==value)
                counters[metric]['total'] += 1
                counters[metric]['correct'] += int(ok)
                check['fields'][field] = {'expected':value,'actual':actual,'correct':ok}
                if not ok and check['evaluation_status']!='PRESENCE_MISMATCH':
                    check['evaluation_status']='PARAMETER_MISMATCH'
        rows.append(check)
    for count in counters.values():
        count['accuracy'] = count['correct']/count['total'] if count['total'] else None
    return {'metrics':counters, 'types':rows,
            'parameter_denominator_policy':'仅使用ground truth has_steel_arch=true的已标注字段；漏检仍计错误；真实无构件排除'}
