"""完整PDF入口及实验工具；实际分流逻辑位于run_supports。"""
import hashlib
from pathlib import Path


def allocate(folder):
    folder=Path(folder)
    folder.mkdir(parents=True,exist_ok=True)
    for i in range(1,100000):
        run=folder/f'pdf_exp{i:02d}'
        try:
            run.mkdir()
            return run
        except FileExistsError:
            continue
    raise RuntimeError('实验编号耗尽')


def file_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def main():
    from run_supports import main as run
    return run()


if __name__=='__main__':
    raise SystemExit(main())
