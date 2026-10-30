"""生成锁脚小导管的可复核静态演示图。"""
from __future__ import annotations
from pathlib import Path
from typing import Any
from PIL import Image, ImageDraw, ImageFont
from primary_support.geometry import build_primary_profiles, sample_open_profile

BG="#0d141e"; FG="#edf3f8"; STEEL="#596574"; LOCK="#d14386"; ANCHOR="#ed9133"; MESH="#35c38f"
def _font(n,b=False):
    p=Path("C:/Windows/Fonts/msyhbd.ttc" if b else "C:/Windows/Fonts/msyh.ttc"); return ImageFont.truetype(str(p),n) if p.exists() else ImageFont.load_default()
def _base(title, sub):
    im=Image.new("RGB",(1600,1000),BG); d=ImageDraw.Draw(im,"RGBA"); d.text((50,35),title,font=_font(32,True),fill=FG); d.text((53,82),sub,font=_font(17),fill="#aab9c9"); return im,d
def _map(p, mode="front"):
    x,y,z=p
    if mode=="side": return (140+z*.95,820-y*.055)
    if mode=="3d": x=x+z*1.25; y=y+z*.42
    return (800+x*.055,790-y*.055)
def _profile(z): return [[x,y,z] for x,y in sample_open_profile(build_primary_profiles(6220,10720,6220,10720,15.6664)["inner"],100)]
def _draw(d,g,mode,all_components=False):
    for z in (100,900): d.line([_map(p,mode) for p in _profile(z)],fill=STEEL,width=10,joint="curve")
    if all_components:
        for z in (100,300,500,700,900): d.line([_map(p,mode) for p in _profile(z)],fill=MESH,width=2,joint="curve")
    for a in g["anchors"]: d.line([_map(a["start_mm"],mode),_map(a["end_mm"],mode)],fill=LOCK,width=7)
def _save(root,g,name,title,mode,all_components=False):
    im,d=_base(title,"粉色：φ42注浆锁脚小导管；安装高度、下倾角和双管张角为可调参考值")
    _draw(d,g,mode,all_components); d.rounded_rectangle((1130,145,1550,410),12,fill="#1b2937dd",outline="#42576b")
    rows=[("工程确认","φ42×4，L=3500mm，8根/榀"),("参考默认","上/下高度 250/100mm"),("参考默认","上/下角度 7.5°/45°"),("参考默认","双管张角 10°")]
    y=175
    for k,v in rows: d.text((1160,y),k,font=_font(16,True),fill="#62e0aa" if k=="工程确认" else "#ffbd70"); d.text((1160,y+28),v,font=_font(15),fill=FG); y+=58
    out=root/"outputs/presentation"/name; out.parent.mkdir(parents=True,exist_ok=True); im.save(out); return out
def _panel(root):
    im,d=_base("ZZ-Va 锁脚锚管参数面板","CONFIRMED 工程参数与 PROVISIONAL 可调几何参数分区显示")
    d.rounded_rectangle((90,150,760,880),14,fill="#1c2a39",outline="#3d5268",width=2); d.text((125,180),"CONFIRMED",font=_font(24,True),fill="#62e0aa")
    confirmed=["名称  φ42注浆锁脚小导管","外径/壁厚  42 / 4 mm","长度  3500 mm","数量  8根/榀，左右各4根","连接  单侧焊接，焊长≥180mm","直钩  200mm"]
    for i,s in enumerate(confirmed): d.text((125,240+i*72),s,font=_font(19),fill=FG)
    d.rounded_rectangle((840,150,1510,880),14,fill="#1c2a39",outline="#3d5268",width=2); d.text((875,180),"PROVISIONAL · 可调",font=_font(24,True),fill="#ffbd70")
    vals=["上级安装高度  250 mm","下级安装高度  100 mm","上级下倾角  7.5°","下级下倾角  45°","双管张开角  10°","连接位置  WEB_SIDE_APPROX"]
    for i,s in enumerate(vals): d.text((875,240+i*72),s,font=_font(19),fill=FG)
    d.text((875,720),"当前为建模参考默认值，",font=_font(18,True),fill="#ffbd70"); d.text((875,755),"待项目节点图/现场参数校核。",font=_font(18,True),fill="#ffbd70")
    out=root/"outputs/presentation/ZZ-Va_lock_foot_parameter_panel.png"; im.save(out); return out
def render_all(root:Path,result:dict[str,Any])->list[Path]:
    g=result["geometry"]
    return [
        _save(root,g,"ZZ-Va_lock_foot_provisional_front.png","ZZ-Va 锁脚小导管 · 正面","front"),
        _save(root,g,"ZZ-Va_lock_foot_provisional_side.png","ZZ-Va 锁脚小导管 · 纵向侧视","side"),
        _save(root,g,"ZZ-Va_lock_foot_provisional_3d.png","ZZ-Va 锁脚小导管 · 三维示意","3d"),
        _save(root,g,"ZZ-Va_primary_support_with_lock_foot.png","ZZ-Va 1m初支与锁脚小导管","3d",True),
        _panel(root),
    ]
