"""生成 PDF 到总控 Demo 流程截图。"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

def _font(n,b=False):
    p=Path('C:/Windows/Fonts/msyhbd.ttc' if b else 'C:/Windows/Fonts/msyh.ttc');return ImageFont.truetype(str(p),n) if p.exists() else ImageFont.load_default()
def _make(root:Path,name:str,title:str,status:str,color:str,lines:list[str],ready=False):
    base=root/'outputs/presentation/ZZ-Va_master_demo_full.png';im=Image.open(base).convert('RGB').resize((1600,1000))
    d=ImageDraw.Draw(im,'RGBA');d.rounded_rectangle((55,120,650,500),16,fill='#172737ee',outline='#526b82',width=2);d.text((85,150),title,font=_font(26,True),fill='#edf4fa');d.text((85,205),status,font=_font(20,True),fill=color);y=260
    for line in lines:d.text((85,y),line,font=_font(17),fill='#d8e3ed');y+=45
    if ready:d.rounded_rectangle((85,430,610,475),8,fill='#256c55');d.text((210,440),'模型已自动加载',font=_font(18,True),fill='white')
    out=root/'outputs/presentation'/name;im.save(out);return out
def render_pdf_flow(root:Path):
    return [
        _make(root,'ZZ-Va_pdf_upload.png','施工图PDF上传','PDF已选择','#62e0aa',['support_drawings.pdf','只读上传，不保存密码','点击：识别并生成模型']),
        _make(root,'ZZ-Va_pdf_extracting.png','参数识别','EXTRACTING','#ffbd70',['正在计算PDF SHA256','检查真实识别缓存','缓存未命中时调用现有OCR']),
        _make(root,'ZZ-Va_pdf_model_ready.png','识别与建模','MODEL_READY','#62e0aa',['支护类型：ZZ-Va','缓存状态：CACHE_HIT','已生成 SupportParameterPayload'],True),
        _make(root,'ZZ-Va_pdf_to_master_demo.png','完整自动链路','PDF → OCR缓存 → Payload → 3D','#62e0aa',['15种支护类型已识别','ZZ-Va完整模型自动加载','其他类型缺参数时不生成实体'],True),
        _make(root,'ZZ-Va_master_demo_from_pdf.png','ZZ-Va 总控模型','来自真实PDF识别缓存','#62e0aa',['69个Mesh对象','CONFIRMED / PROVISIONAL / PENDING','可调锁脚参数并导出GLB'],True),
    ]

if __name__=='__main__':render_pdf_flow(Path(__file__).resolve().parents[2])
