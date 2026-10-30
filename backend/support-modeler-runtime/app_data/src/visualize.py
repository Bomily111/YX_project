"""框编号绘于原图，中文文字及置信度绘于右侧，避免文字互相覆盖。"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def visualize(image, records, output, font_path=None):
    candidates = [Path(font_path)] if font_path else [Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts' / 'msyh.ttc', Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
    font = next((ImageFont.truetype(str(p), 20) for p in candidates if p.exists()), ImageFont.load_default())
    canvas = Image.new('RGB', (image.width + 720, max(image.height, 32 * (len(records) + 2))), 'white')
    canvas.paste(image.convert('RGB'), (0, 0))
    draw = ImageDraw.Draw(canvas)
    for i, record in enumerate(records, 1):
        points = [tuple(p) for p in record['box']]
        draw.line(points + [points[0]], fill='red', width=2)
        draw.text(points[0], str(i), fill='blue', font=font)
        draw.text((image.width + 12, i * 32), f"{i:02d} [{record['confidence']:.3f}] {record['text']}", fill='black', font=font)
    canvas.save(Path(output))
