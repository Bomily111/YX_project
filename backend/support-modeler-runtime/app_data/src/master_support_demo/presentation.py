"""生成统一总控 Demo 的五张可复核演示图。"""
from pathlib import Path
from typing import Any
from PIL import Image, ImageDraw, ImageFont
from primary_support.geometry import build_primary_profiles, sample_open_profile

BG="#0d141e"; PANEL="#1b2937"; FG="#edf3f8"; MUTED="#aab9c9"
COL={"concrete":"#c7a96f","mesh":"#35c38f","steel":"#596574","anchor":"#ed9133","lock":"#d14386","lining":"#9caabd","N1":"#8b3f2e","N2":"#356080","N3":"#aab2ba","N4":"#c09c38"}
def _font(n,b=False):
    p=Path("C:/Windows/Fonts/msyhbd.ttc" if b else "C:/Windows/Fonts/msyh.ttc"); return ImageFont.truetype(str(p),n) if p.exists() else ImageFont.load_default()
def _profile(r1,r2,z=0): return [[x,y,z] for x,y in sample_open_profile(build_primary_profiles(r1,r2,r1,r2,15.6664)["inner"],100)]
def _pt(p,off=(0,0),scale=.048):
    x,y,z=p; return (590+(x+z*1.1)*scale+off[0],790-(y+z*.35)*scale+off[1])
def _base(title,sub):
    im=Image.new("RGB",(1600,1000),BG); d=ImageDraw.Draw(im,"RGBA"); d.text((40,28),title,font=_font(30,True),fill=FG); d.text((42,72),sub,font=_font(16),fill=MUTED); d.rounded_rectangle((1190,110,1570,960),12,fill=PANEL,outline="#40566c"); return im,d
def _curve(d,pts,color,w=5,off=(0,0)): d.line([_pt(p,off) for p in pts],fill=color,width=w,joint="curve")
def _model(d,result,primary=True,secondary=True,exploded=False):
    offs={"concrete":(-70,20),"mesh":(-25,8),"steel":(25,-8),"anchor":(-80,0),"lock":(70,0),"lining":(120,-15),"rebar":(170,-30)} if exploded else {k:(0,0) for k in ("concrete","mesh","steel","anchor","lock","lining","rebar")}
    if primary:
        for z in (0,1000): _curve(d,_profile(6100,10600,z),COL["concrete"],4,offs["concrete"]); _curve(d,_profile(6360,10860,z),COL["concrete"],4,offs["concrete"])
        for z in (100,900): _curve(d,_profile(6220,10720,z),COL["steel"],10,offs["steel"])
        for z in (100,300,500,700,900): _curve(d,_profile(6324,10824,z),COL["mesh"],2,offs["mesh"])
        for a in result["assembly"]["geometry"]["anchors"]: d.line([_pt(a["start_mm"],offs["lock"]),_pt(a["end_mm"],offs["lock"])],fill=COL["lock"],width=5)
    if secondary:
        for z in (0,1000): _curve(d,_profile(5500,10000,z),COL["lining"],7,offs["lining"]); _curve(d,_profile(6000,10500,z),COL["lining"],7,offs["lining"])
        _curve(d,_profile(5939,10439,500),COL["N1"],5,offs["rebar"]); _curve(d,_profile(5561,10061,500),COL["N2"],5,offs["rebar"])
def _panel(d,result):
    x=1220; d.text((x,135),"ZZ-Va · 1.0 m",font=_font(22,True),fill=FG); y=185
    for name,count in result["state"]["component_counts"].items():
        d.text((x,y),name,font=_font(14),fill=MUTED); d.text((1510,y),str(count),font=_font(14,True),fill=FG,anchor="ra"); y+=28
    d.line((x,y+5,1535,y+5),fill="#41566a",width=2); y+=28
    for text,color in [("CONFIRMED 工程参数","#62e0aa"),("PROVISIONAL 可调参数","#ffbd70"),("PENDING 项目确认","#ff8d8d")]: d.text((x,y),text,font=_font(15,True),fill=color); y+=35
    d.text((x,y+10),"正式GLB使用原始装配坐标",font=_font(14),fill=FG)
def _save(root,result,name,title,sub,primary=True,secondary=True,exploded=False):
    im,d=_base(title,sub); _model(d,result,primary,secondary,exploded); _panel(d,result); out=root/"outputs/presentation"/name; out.parent.mkdir(parents=True,exist_ok=True); im.save(out); return out
def _parameter(root,result):
    im,d=_base("ZZ-Va 总控参数面板","工程参数、参考参数和待确认事项分区展示"); cols=[(70,"初支参数","#62e0aa",["初支厚度 260 mm","钢筋网 Φ8 @200×200","钢架 I20a @800","系统锚杆 Φ25 L=4000","锚杆间距 1200×800"]),(575,"锁脚参考参数","#ffbd70",["φ42×4，L=3500","8根/榀","上/下高度 250/100","上/下角 7.5°/45°","双管张角 10°"])]
    for x,title,color,rows in cols:
        d.rounded_rectangle((x,145,x+450,710),12,fill=PANEL,outline="#40566c"); d.text((x+30,175),title,font=_font(22,True),fill=color)
        for i,s in enumerate(rows): d.text((x+30,240+i*65),s,font=_font(18),fill=FG)
    d.text((70,760),"PENDING：钢筋网连接侧、锁脚项目安装几何待项目确认",font=_font(18,True),fill="#ff8d8d")
    out=root/"outputs/presentation/ZZ-Va_master_demo_parameter_panel.png"; im.save(out); return out
def render_all(root:Path,result:dict[str,Any]):
    return [
        _save(root,result,"ZZ-Va_master_demo_full.png","ZZ-Va Parameterized Support Demo V1","完整1m初支 + 二衬统一总装"),
        _save(root,result,"ZZ-Va_master_demo_primary.png","ZZ-Va 总控 Demo · 初支体系","混凝土、网片、I20a、系统锚杆、锁脚锚管",True,False),
        _save(root,result,"ZZ-Va_master_demo_secondary.png","ZZ-Va 总控 Demo · 二衬体系","二衬混凝土与 N1–N4",False,True),
        _save(root,result,"ZZ-Va_master_demo_exploded.png","ZZ-Va 总控 Demo · 分解视图","分解仅用于展示，不写入正式GLB",True,True,True),
        _parameter(root,result),
    ]
