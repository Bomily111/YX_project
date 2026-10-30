"""RapidOCR 中文 CPU 封装；框坐标相对于传入图像。"""
import numpy as np

class OCREngine:
    def __init__(self, det_side=2400, max_side=2000):
        from rapidocr_onnxruntime import RapidOCR
        self.engine = RapidOCR(det_limit_side_len=det_side, max_side_len=max_side, intra_op_num_threads=4,
                               inter_op_num_threads=1)

    def recognize(self, image):
        try:
            result, elapsed = self.engine(np.asarray(image.convert('RGB'))[:, :, ::-1].copy())
            return [{'text': str(text), 'confidence': float(score),
                     'box': np.asarray(box).tolist()} for box, text, score in (result or [])]
        except Exception as exc:
            raise RuntimeError(f'OCR调用失败: {exc}') from exc
