"""把最终N1/N2参数归属画在局部高清图上。"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def visualize_rebar(crop, roi, evidence, output):
    fonts = [Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/msyh.ttc",
             Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    font = next((ImageFont.truetype(str(path), 24) for path in fonts if path.exists()), ImageFont.load_default())
    canvas = crop.convert("RGB").copy()
    draw = ImageDraw.Draw(canvas)
    colors = {"N1": "#dc2626", "N2": "#2563eb", "angle": "#16a34a"}
    for field, item in evidence.items():
        if not isinstance(item, dict) or "bbox" not in item:
            continue
        x0, y0, x1, y1 = item["bbox"]
        box = [x0-roi[0], y0-roi[1], x1-roi[0], y1-roi[1]]
        group = "angle" if field.startswith("angle") else ("N1" if field.startswith("N1") else "N2")
        color = colors[group]
        draw.rectangle(box, outline=color, width=4)
        label = f"{field}={item['value']}"
        tx, ty = box[0], max(0, box[1]-30)
        draw.rectangle([tx, ty, tx+max(180, len(label)*15), ty+30], fill="white", outline=color, width=2)
        draw.text((tx+3, ty+1), label, fill=color, font=font)
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output)

