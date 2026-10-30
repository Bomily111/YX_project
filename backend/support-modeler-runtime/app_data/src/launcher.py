"""run.bat使用的中文交互启动器；不读取或保存密码内容。"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    if not os.getenv("SUPPORT_PDF_PASSWORD"):
        print("请先设置PDF密码环境变量 SUPPORT_PDF_PASSWORD，然后重新运行。")
        return 2
    if len(sys.argv) > 1:
        pdf = " ".join(sys.argv[1:]).strip('"')
    else:
        pdf = input("请输入需要解析的施工图PDF完整路径：").strip().strip('"')
    if not pdf:
        print("未输入PDF路径。")
        return 2
    result = subprocess.run([sys.executable, str(ROOT / "src" / "main.py"), "--pdf", pdf], cwd=ROOT)
    if result.returncode == 0:
        print("解析完成。最终Excel、证据JSON和人工复核项路径已显示在上方。")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
