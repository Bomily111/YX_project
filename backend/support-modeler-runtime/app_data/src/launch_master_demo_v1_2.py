"""可靠启动或复用 Parameterized Support Demo V1.2 本地服务。"""
from __future__ import annotations

import sys
from pathlib import Path

from launch_master_demo_v1_1 import HOST, choose_port, classify_port, start_service, wait_for_project_service


ROOT = Path(__file__).resolve().parents[1]
DEMO_PATH = "/demo/support_master_demo_v1_2.html"


def launch(open_browser: bool = True) -> tuple[str, int, str]:
    import webbrowser

    port, state = choose_port()
    if state == "PROJECT_SERVICE":
        print("[INFO] Existing SupportParameterExtractor service detected")
        print("[OK] Reusing existing local service")
        outcome = "EXISTING_SERVICE_REUSED"
    else:
        if state == "PORT_8000_OCCUPIED_BY_OTHER_PROCESS":
            print("[WARN] PORT_8000_OCCUPIED_BY_OTHER_PROCESS")
            print(f"[INFO] Using available port {port}")
        else:
            print("[OK] Port 8000 available")
        print("Starting local service...")
        process = start_service(port)
        if not wait_for_project_service(port, process):
            raise RuntimeError("本项目服务未通过 /api/health 检查。")
        print("[OK] Local service ready")
        outcome = "SERVICE_STARTED"
    url = f"http://{HOST}:{port}{DEMO_PATH}"
    print(f"[OK] Opening V1.2 Demo: {url}")
    print(outcome)
    print("READY")
    if open_browser:
        webbrowser.open(url)
    return outcome, port, url


if __name__ == "__main__":
    try:
        launch(open_browser="--no-browser" not in sys.argv[1:])
    except Exception as exc:
        print(f"[ERROR] {exc}")
        raise SystemExit(1)
