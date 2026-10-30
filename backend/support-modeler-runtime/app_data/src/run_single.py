"""单图完整流程；自动创建 expNN；每个预处理变体单独保存，不覆盖实验。"""
import argparse
import hashlib
import json
import shutil
import sys
import platform
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from PIL import Image
from preprocess import MODES, DEFAULT_MODES, preprocess
from ocr_engine import OCREngine
from visualize import visualize
from evaluate import evaluate_model

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from extractor.steel_arch import extract_with_diagnostics, to_model_parameters, VERSION, DATABASE

def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def allocate(root):
    root.mkdir(parents=True, exist_ok=True)
    for i in range(1, 100000):
        path = root / f'exp{i:02d}'
        try:
            path.mkdir()
            return path
        except FileExistsError:
            continue
    raise RuntimeError('实验目录数量超出上限')

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, default=ROOT / 'outputs')
    parser.add_argument('--ground-truth', type=Path)
    parser.add_argument('--modes', nargs='+', choices=MODES, default=list(DEFAULT_MODES))
    parser.add_argument('--det-side', '--max-side', dest='det_side', type=int, default=2400,
                        help='OCR检测短边目标；保留--max-side作为旧实验兼容别名')
    parser.add_argument('--note', default='')
    parser.add_argument('--font', type=Path)
    parser.add_argument('--beta-angle', help='人工指定OCR已出现的beta角度；不会补入OCR缺失数值')
    parser.add_argument('--profile-database', type=Path, default=DATABASE)
    args = parser.parse_args()
    experiment = allocate(args.output_root)
    target = experiment / args.image.stem
    target.mkdir()
    # 复制当次代码，确保规则修改后历史实验仍可解释。
    shutil.copytree(Path(__file__).parent, experiment / 'src_snapshot', ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copytree(ROOT / 'extractor', experiment / 'extractor_snapshot', ignore=shutil.ignore_patterns('__pycache__'))
    manifest = dict(time=datetime.now(timezone.utc).isoformat(), image=str(args.image),
                    engine='rapidocr-onnxruntime', python=platform.python_version(),
                    parser_version=VERSION, modes=args.modes, note=args.note, beta_angle=args.beta_angle,
                    engine_config=dict(det_limit_side_len=args.det_side, det_limit_type='min',
                                       max_side_len=2000, intra_op_num_threads=4, inter_op_num_threads=1),
                    models=['ch_PP-OCRv4_det_infer.onnx', 'ch_ppocr_mobile_v2.0_cls_infer.onnx', 'ch_PP-OCRv4_rec_infer.onnx'])
    try:
        manifest['packages'] = {p: version(p) for p in ('rapidocr-onnxruntime', 'onnxruntime', 'numpy', 'opencv-python', 'Pillow')}
        manifest['image_sha256'] = hashlib.sha256(args.image.read_bytes()).hexdigest()
        shutil.copyfile(args.profile_database, experiment / 'steel_profiles_snapshot.json')
        image = Image.open(args.image).convert('RGB')
        engine = OCREngine(args.det_side)
        truth_path = args.ground_truth or ROOT / 'data' / 'ground_truth' / (args.image.stem.removesuffix('_steel_arch') + '.json')
        truth = json.loads(truth_path.read_text(encoding='utf-8-sig')) if truth_path.exists() else None
        if truth is not None:
            save_json(experiment / 'ground_truth_snapshot.json', truth)
        summary, successes = [], []
        for mode in args.modes:
            folder = target / mode
            folder.mkdir()
            try:
                processed = preprocess(image, mode)
                processed.save(folder / 'preprocessed.png')
                records = engine.recognize(processed)
                save_json(folder / 'ocr_raw.json', records)
                (folder / 'ocr_text.txt').write_text('\n'.join(r['text'] for r in records), encoding='utf-8')
                extracted, audit = extract_with_diagnostics(records, beta_angle=args.beta_angle)
                params = to_model_parameters(extracted, audit['support_type'], args.profile_database)
                if extracted['steel_profile'] is not None and params['steel']['height'] is None:
                    audit['issues'].append('已识别工字钢型号，但数据库未收录其尺寸，需补充')
                save_json(folder / 'extracted.json', extracted)
                save_json(folder / 'steel_arch_parameters.json', params)
                save_json(folder / 'extraction_diagnostics.json', audit)
                visualize(processed, records, folder / 'ocr_visualized.png', args.font)
                report = evaluate_model(params, truth or {})
                (folder / 'evaluation.txt').write_text(report, encoding='utf-8')
                # 选择不读取真值；只比较已解析字段覆盖度，置信度作为平局条件。
                coverage = sum(extracted[k] is not None for k in ('R1', 'R2', 'beta', 'steel_profile'))
                summary.append(dict(mode=mode, modeling_coverage=coverage, parameters=params, evaluation=report))
                # 平局时保留先运行变体；不用文字数量或无关文字置信度排序。
                successes.append((coverage, -len(summary), mode))
                print(f'[{mode}] 已提取建模参数 {coverage}/4: {json.dumps(extracted, ensure_ascii=False)}', flush=True)
            except Exception as exc:
                save_json(folder / 'error.json', {'error': str(exc)})
                summary.append(dict(mode=mode, error=str(exc)))
        save_json(target / 'comparison.json', summary)
        if not successes:
            raise RuntimeError('所有预处理方式均失败，详见各 error.json')
        selected = max(successes)[2]
        manifest['selected_mode'] = selected
        manifest['selection_policy'] = 'four modeling fields only; ties use mode order; ground truth excluded'
        manifest['units'] = {'geometry.R1': 'm', 'geometry.R2': 'm', 'geometry.beta': 'deg', 'steel_dimensions': 'mm'}
        for name in ('ocr_raw.json', 'ocr_text.txt', 'extracted.json', 'steel_arch_parameters.json', 'extraction_diagnostics.json', 'preprocessed.png', 'ocr_visualized.png', 'evaluation.txt'):
            shutil.copyfile(target / selected / name, target / name)
        print((target / 'steel_arch_parameters.json').read_text(encoding='utf-8'))
        print((target / 'evaluation.txt').read_text(encoding='utf-8'))
        print(f'实验输出: {target.resolve()}')
    except Exception as exc:
        manifest['error'] = str(exc)
        print(f'失败: {exc}', file=sys.stderr)
        return 1
    finally:
        save_json(experiment / 'manifest.json', manifest)
    return 0

if __name__ == '__main__':
    sys.exit(main())
