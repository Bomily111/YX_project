"""PDF认证及原生分辨率渲染；绝不记录密码或导出解密PDF。"""
import os
from pathlib import Path
import pymupdf
from PIL import Image

class PDFPasswordError(RuntimeError):
    pass

def open_pdf(path):
    doc = pymupdf.open(Path(path))
    needed = bool(doc.needs_pass)
    authenticated = False
    if needed:
        password = os.getenv('SUPPORT_PDF_PASSWORD')
        if not password:
            doc.close()
            raise PDFPasswordError('PDF需要密码，但环境变量SUPPORT_PDF_PASSWORD未设置')
        try:
            authenticated = bool(doc.authenticate(password))
        finally:
            password = None
        if not authenticated:
            doc.close()
            raise PDFPasswordError('PDF密码认证失败，请检查SUPPORT_PDF_PASSWORD')
    return doc, {'needs_password': needed, 'authenticated': authenticated,
                 'page_count': len(doc), 'accessible': not doc.is_encrypted}

def render_page(page, dpi=400, output=None, screening=False):
    if not screening and dpi not in (300, 400, 500, 600):
        raise ValueError('高清渲染DPI仅支持300/400/500/600')
    # 直接从原始页面生成像素；无先缩小再放大。
    pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csRGB, alpha=False)
    image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    if output:
        image.save(Path(output), dpi=(dpi, dpi))
    return image
