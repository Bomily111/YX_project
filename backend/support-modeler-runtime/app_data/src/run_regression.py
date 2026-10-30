"""对一次全量JSON执行baseline_support_extractor_v1统一回归。"""
import argparse,json
from pathlib import Path
from baseline_regression import compare_regression

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--results",type=Path,default=ROOT/"outputs/final/support_parameters_all.json")
parser.add_argument("--expected",type=Path,default=ROOT/"baseline/baseline_support_extractor_v1/regression_expected.json")
args=parser.parse_args()
result=compare_regression(json.loads(args.results.read_text(encoding="utf-8")),args.expected)
print(json.dumps(result,ensure_ascii=False,indent=2))
raise SystemExit(0 if result["all_passed"] else 1)

