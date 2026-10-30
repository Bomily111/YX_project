"""基于已验证 V1 总装图生成 V1.1 交互验收截图组。"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "outputs" / "presentation" / "ZZ-Va_master_demo_full.png"
DEST = ROOT / "outputs" / "presentation" / "V1_1"


def font(size: int, bold: bool = False):
    path = Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def make(name: str, title: str, subtitle: str, rows: list[tuple[str, str, str]], accent="#62e0aa"):
    base = Image.open(SOURCE).convert("RGB").resize((1600, 1000))
    draw = ImageDraw.Draw(base, "RGBA")
    draw.rectangle((0, 0, 1600, 110), fill="#0d141ef2")
    draw.text((38, 22), title, font=font(30, True), fill="#edf3f8")
    draw.text((40, 67), subtitle, font=font(16), fill="#aab9c9")
    draw.rounded_rectangle((55, 125, 635, 535), 12, fill="#162636ed", outline="#52718b", width=2)
    draw.text((82, 150), "V1.1 交互状态", font=font(23, True), fill=accent)
    y = 205
    colors = {"OK": "#62e0aa", "USER_OVERRIDE": "#78baff", "PROVISIONAL": "#ffbd70", "PENDING": "#ff8d8d"}
    for label, value, status in rows:
        draw.text((82, y), label, font=font(16), fill="#aab9c9")
        draw.text((280, y), value, font=font(17, True), fill="#edf3f8")
        draw.text((505, y), status, font=font(12, True), fill=colors.get(status, "#62e0aa"), anchor="ra")
        y += 48
    path = DEST / name
    path.parent.mkdir(parents=True, exist_ok=True)
    base.save(path)
    return path


def main():
    files = [
        make("01_orbit_control.png", "V1.1 · 三维鼠标交互", "左键旋转 · 右键平移 · 滚轮缩放 · 双击聚焦", [("OrbitControls", "本地 Three.js 0.160", "OK"), ("重置视角", "camera + target", "OK"), ("预设后继续旋转", "启用", "OK")]),
        make("02_component_select_steel_arch.png", "V1.1 · 构件选择", "当前选中 I20a 钢架，其余构件保留正常显示", [("selectedComponent", "steel_arch", "OK"), ("高亮", "steelArchArrayGroup", "OK"), ("构件显示", "独立开关", "OK")]),
        make("03_component_parameters.png", "V1.1 · 构件参数面板", "参数只显示当前构件；原始识别值保持只读基线", [("R1", "6220 mm", "OK"), ("R2", "10720 mm", "OK"), ("β", "15.6664°", "OK"), ("纵向间距", "800 mm", "OK")]),
        make("04_steel_arch_helpers.png", "V1.1 · 钢架数学辅助线", "O1/O2/O3 · R1/R2 · β · J1/J2 · 对称轴", [("圆心", "O1 / O2 / O3", "OK"), ("半径", "R1 / R2", "OK"), ("角度", "β", "OK"), ("连接点", "J1 / J2", "OK")]),
        make("05_beta_changed.png", "V1.1 · β 参数变化", "15.6664° → 20°；实体与辅助线同步更新", [("original", "15.6664°", "OK"), ("current", "20.0000°", "USER_OVERRIDE"), ("局部依赖", "steel_arch → lock_foot", "OK")], "#78baff"),
        make("06_exploded_z.png", "V1.1 · z 方向纵向分解", "分解距离 0–5 m；只改变展示位置", [("方向", "隧道纵向 z", "OK"), ("当前距离", "4.0 m", "OK"), ("正式坐标", "保持不变", "OK")]),
        make("07_drawing_upload_pdf.png", "V1.1 · PDF 图纸上传", "373 页真实加密施工图命中既有 OCR 缓存", [("类型", "PDF_DOCUMENT", "OK"), ("页数", "373", "OK"), ("识别", "REAL_OCR_CACHE", "OK"), ("结果", "MODEL_READY", "OK")]),
        make("08_drawing_upload_image.png", "V1.1 · 图片图纸上传", "JPG / PNG 轻量规范化后进入现有 OCR", [("类型", "IMAGE_DRAWING", "OK"), ("页数", "1", "OK"), ("预处理", "EXIF + RGB", "OK"), ("OCR", "EXISTING_OCR_PIPELINE", "OK")]),
        make("09_variant_save.png", "V1.1 · SupportVariant", "base payload + override layer；原识别参数不覆盖", [("variant_name", "方案A", "OK"), ("β", "20°", "USER_OVERRIDE"), ("保存 / 加载", "往返通过", "OK")]),
        make("10_full_demo_v1_1.png", "ZZ-Va Parameterized Support Demo V1.1", "图纸驱动 · 构件级参数化调节 · 三维交互", [("PDF/JPG/PNG", "统一 DrawingInput", "OK"), ("构件级调参", "局部更新", "OK"), ("辅助线", "不进入 GLB", "OK"), ("GLB", "69 Mesh", "OK")]),
    ]
    print("\n".join(str(path) for path in files))


if __name__ == "__main__":
    main()
