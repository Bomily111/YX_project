"""可靠启动或复用 ZZ-Va Master Demo V1.1 本地服务。"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"
DEFAULT_PORT = 8000
SERVICE_NAME = "SupportParameterExtractor"
DEMO_PATH = "/demo/ZZ-Va_support_master_demo_v1_1.html"


def port_is_available(port: int) -> bool:
    """通过独占 bind 判断端口是否可用，避免 connect 权限错误被误判为空闲。"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        try:
            connection.bind((HOST, port))
        except OSError:
            return False
        return True


def read_health(port: int, timeout: float = 1.0) -> dict | None:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/api/health", timeout=timeout) as response:
            if response.status != 200:
                return None
            value = json.loads(response.read().decode("utf-8"))
            return value if isinstance(value, dict) else None
    except (OSError, ValueError, json.JSONDecodeError, urllib.error.URLError):
        return None


def classify_port(port: int) -> str:
    """返回 FREE、PROJECT_SERVICE 或 OTHER_PROCESS。"""
    health = read_health(port)
    if health and health.get("status") == "ok" and health.get("service") == SERVICE_NAME:
        return "PROJECT_SERVICE"
    return "FREE" if port_is_available(port) else "OTHER_PROCESS"


def choose_port(preferred: int = DEFAULT_PORT) -> tuple[int, str]:
    state = classify_port(preferred)
    if state != "OTHER_PROCESS":
        return preferred, state
    for port in range(preferred + 1, preferred + 11):
        if classify_port(port) == "FREE":
            return port, "PORT_8000_OCCUPIED_BY_OTHER_PROCESS"
    raise RuntimeError("PORT_8000_OCCUPIED_BY_OTHER_PROCESS：8001-8010也没有可用端口。")


def start_service(port: int) -> subprocess.Popen:
    environment = os.environ.copy()
    environment["DEMO_PORT"] = str(port)
    log_path = ROOT / "outputs" / "master_demo" / "logs" / "v1_1_service.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    # 独立后台进程避免第二个 cmd/Flask 窗口抢占同一控制台；日志仍可审计。
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    log_stream = log_path.open("a", encoding="utf-8")
    try:
        return subprocess.Popen(
            [sys.executable, "-m", "demo_server.app"],
            cwd=ROOT,
            env=environment,
            creationflags=flags,
            stdout=log_stream,
            stderr=subprocess.STDOUT,
        )
    finally:
        log_stream.close()


def wait_for_project_service(port: int, process: subprocess.Popen, timeout: float = 20.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return False
        if classify_port(port) == "PROJECT_SERVICE":
            return True
        time.sleep(0.25)
    return False


def launch(open_browser: bool = True) -> tuple[str, int, str]:
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
            log_path = ROOT / "outputs" / "master_demo" / "logs" / "v1_1_service.log"
            raise RuntimeError(f"本项目服务启动后未能通过 /api/health 检查。日志：{log_path}")
        print("[OK] Local service ready")
        outcome = "SERVICE_STARTED"

    url = f"http://{HOST}:{port}{DEMO_PATH}"
    print(f"[OK] Opening V1.1 Demo: {url}")
    print(outcome)
    print("READY")
    if open_browser:
        webbrowser.open(url)
    return outcome, port, url


def main() -> int:
    try:
        launch(open_browser="--no-browser" not in sys.argv[1:])
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
