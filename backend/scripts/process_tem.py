# d:/project/backend/scripts/process_tem.py
import time
import sys
import json
import os
import subprocess
import ctypes

# --- 配置区 ---
# 选择您的集成方式: 'EXE' 或 'DLL'
INTEGRATION_METHOD = 'EXE' 

# --- 通信函数 (无需修改) ---

def send_update(update_type, value, message=""):
    """将JSON格式的更新信息打印到标准输出"""
    update = {"type": update_type, "value": value, "message": message}
    # 使用 ensure_ascii=False 以正确处理中文字符
    # flush=True 确保信息被立即发送，而不是被缓冲
    print(json.dumps(update, ensure_ascii=False), flush=True)

def report_error_and_exit(error_message):
    """向 stderr 报告错误并以非零代码退出"""
    print(error_message, file=sys.stderr)
    sys.exit(1)

# --- 方式一：调用 .exe 可执行文件 ---

def run_tem_with_exe(job_id, data_dir):
    """
    通过启动一个外部 .exe 程序来执行处理。
    """
    try:
        # 【修改】替换为您的 .exe 文件路径
        exe_path = os.path.join(os.path.dirname(__file__), '..', 'bin', 'YourTEMProcessor.exe')
        if not os.path.exists(exe_path):
            raise FileNotFoundError(f"处理程序不存在: {exe_path}")

        # 【修改】构建传递给 .exe 的命令行参数
        # 范例: YourTEMProcessor.exe --job-id xxx --data-path "d:/.../uploads/xxx"
        command = [exe_path, '--job-id', job_id, '--data-path', data_dir]
        send_update("log", None, f"即将执行命令: {' '.join(command)}")

        # 启动子进程
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            bufsize=1 # 行缓冲
        )

        # 实时读取 stdout，解析进度信息并转发
        for line in process.stdout:
            line = line.strip()
            if line:
                # 假设 .exe 打印与 send_update() 格式相同的JSON
                print(line, flush=True)

        # 等待进程结束
        process.wait()

        # 检查退出码
        if process.returncode != 0:
            error_output = process.stderr.read()
            raise RuntimeError(f"处理程序执行失败，退出码: {process.returncode}\n{error_output}")

    except Exception as e:
        report_error_and_exit(f"处理过程中发生错误: {str(e)}")

# --- 方式二：调用 .dll 动态链接库 ---

# 定义一个回调函数类型，它必须与DLL中期望的函数指针签名匹配
# C/C++ 签名: void ProgressCallback(const char* jobId, int progress, const char* message)
PROGRESS_CALLBACK = ctypes.CFUNCTYPE(None, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p)

def py_progress_callback(job_id_bytes, progress, message_bytes):
    """这个Python函数会被C++的DLL调用"""
    job_id = job_id_bytes.decode('utf-8')
    message = message_bytes.decode('utf-8')
    send_update("progress", progress, message)

def run_tem_with_dll(job_id, data_dir):
    """
    通过加载 DLL 并调用其导出的函数来执行处理。
    """
    try:
        # 【修改】替换为您的 .dll 文件路径
        dll_path = os.path.join(os.path.dirname(__file__), '..', 'bin', 'YourTEMLibrary.dll')
        if not os.path.exists(dll_path):
            raise FileNotFoundError(f"处理库不存在: {dll_path}")

        # 加载DLL
        tem_lib = ctypes.CDLL(dll_path)

        # 【修改】定义您要调用的DLL导出函数原型
        # 假设DLL导出了一个名为 ProcessTEM 的函数
        # C/C++ 签名: int ProcessTEM(const char* jobId, const char* dataPath, ProgressCallback callback)
        process_tem_func = tem_lib.ProcessTEM
        process_tem_func.argtypes = [ctypes.c_char_p, ctypes.c_char_p, PROGRESS_CALLBACK]
        process_tem_func.restype = ctypes.c_int # 假设返回0表示成功

        # 创建回调函数实例
        callback_instance = PROGRESS_CALLBACK(py_progress_callback)

        send_update("log", None, "正在调用DLL中的处理函数...")

        # 调用DLL函数，注意字符串需要编码为bytes
        result = process_tem_func(
            job_id.encode('utf-8'),
            data_dir.encode('utf-8'),
            callback_instance
        )

        if result != 0:
            raise RuntimeError(f"DLL函数返回错误码: {result}")

    except Exception as e:
        report_error_and_exit(f"调用DLL时发生错误: {str(e)}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        report_error_and_exit("错误: 脚本需要提供 任务ID 和 数据目录 作为命令行参数。")

    job_id = sys.argv[1]
    data_dir = sys.argv[2]

    send_update("log", None, f"开始处理任务 {job_id}，数据位于 {data_dir}")
    
    if INTEGRATION_METHOD == 'EXE':
        run_tem_with_exe(job_id, data_dir)
    elif INTEGRATION_METHOD == 'DLL':
        run_tem_with_dll(job_id, data_dir)
    else:
        report_error_and_exit(f"未知的集成方式: {INTEGRATION_METHOD}")

    # 如果上面的函数没有因错误退出，则表示成功
    sys.exit(0)