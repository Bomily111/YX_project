"""保守预处理；所有变体保留完整人工裁剪区域。"""
from PIL import Image, ImageOps, ImageEnhance

MODES = ('original', 'scale2', 'gray2', 'contrast2', 'binary2', 'rotate90', 'rotate270')
DEFAULT_MODES = MODES

def preprocess(image, mode):
    image = image.convert('RGB')
    if mode not in MODES:
        raise ValueError(f'Unknown mode: {mode}')
    if mode == 'original':
        return image
    image = image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS)
    if mode in ('rotate90', 'rotate270'):
        return image.transpose(Image.Transpose.ROTATE_90 if mode == 'rotate90' else Image.Transpose.ROTATE_270)
    if mode == 'scale2':
        return image
    image = ImageOps.grayscale(image)
    if mode == 'contrast2':
        image = ImageEnhance.Contrast(image).enhance(1.4)
    elif mode == 'binary2':
        image = image.point(lambda p: 255 if p > 190 else 0)
    return image.convert('RGB')
