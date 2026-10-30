"""ZZ-Va 统一参数化支护总控 Demo。"""
def build_master_demo(*args, **kwargs):
    # 延迟导入，兼容 demo_server 以 ``src.master_support_demo`` 方式加载payload。
    from .assembly import build_master_demo as implementation
    return implementation(*args, **kwargs)

__all__ = ["build_master_demo"]
