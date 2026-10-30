"""用Pillow生成1m初支短节的六张可复核演示图。"""
from __future__ import annotations
from pathlib import Path
from typing import Any
from PIL import Image, ImageDraw, ImageFont
from primary_support.geometry import build_primary_profiles, sample_open_profile

BG="#0e141d";FG="#edf4fb";CONCRETE="#c7a96f";MESH="#35c38f";STEEL="#596574";ANCHOR="#ed9133"
def _font(size,bold=False):
    p=Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc");return ImageFont.truetype(str(p),size) if p.exists() else ImageFont.load_default()
def _base(title,subtitle):
    im=Image.new("RGB",(1600,1000),BG);d=ImageDraw.Draw(im,"RGBA");d.text((55,35),title,font=_font(32,True),fill=FG);d.text((58,82),subtitle,font=_font(17),fill="#aab9c9");return im,d
def _curve(r1,r2):return sample_open_profile(build_primary_profiles(r1,r2,r1,r2,15.6664)["inner"],96)
def _map(points,box=(50,130,1210,940),bounds=(-11000,11000,-7000,10800)):
    x0,y0,x1,y1=box;xmin,xmax,ymin,ymax=bounds;s=min((x1-x0)/(xmax-xmin),(y1-y0)/(ymax-ymin));cx=(x0+x1)/2;cy=y0+ymax*s;return [(cx+x*s,cy-y*s) for x,y in points]
def _line(d,points,color,w=4):d.line(_map(points),fill=color,width=w,joint="curve")
def _legend(d,rows,x=1240,y=155):
    for color,text in rows:d.rounded_rectangle((x,y,x+30,y+18),4,fill=color);d.text((x+42,y-4),text,font=_font(16),fill="#dbe6f1");y+=40
def _save(im,path):path.parent.mkdir(parents=True,exist_ok=True);im.save(path)

def _front(result,path,full=False):
    im,d=_base("ZZ-Va 完整断面与1m初支" if full else "ZZ-Va 1m初支短节 · 正面断面","网片按围岩侧暂定关系布置；系统锚杆沿开挖轮廓径向向外")
    inner,outer=_curve(6100,10600),_curve(6360,10860);d.polygon(_map(outer)+list(reversed(_map(inner))),fill="#c7a96f55")
    if full:_line(d,_curve(5500,10000),"#8998aa",5);_line(d,_curve(6000,10500),"#aab7c5",7)
    _line(d,inner,"#e8c77e",3);_line(d,outer,"#f28b55",3);_line(d,_curve(6324,10824),MESH,3);_line(d,_curve(6220,10720),STEEL,13)
    for a in result["anchors"]["anchors"]:
        if a["z_mm"]==100:d.line(_map([a["start_mm"][:2],a["end_mm"][:2]]),fill=ANCHOR,width=4)
    rows=[(CONCRETE,"初支混凝土"),(MESH,"Φ8钢筋网"),(STEEL,"I20a钢架"),(ANCHOR,"系统锚杆")]
    if full:rows += [("#aab7c5","二衬混凝土")]
    _legend(d,rows);d.text((1240,390),"网片侧：ROCK_SIDE",font=_font(17,True),fill="#62e0aa");d.text((1240,430),"状态：PROVISIONAL",font=_font(17,True),fill="#ffbd70");_save(im,path)

def _project(p):
    x,y,z=p;return _map([[x+z*1.45,y+z*.8]],bounds=(-11000,12500,-7000,11500))[0]
def _perspective(result,path):
    im,d=_base("ZZ-Va 1m初支短节 · 透视","两榀I20a：z=100/900mm；两层系统锚杆保持43根")
    for z in (100,900):
        d.line([_project([x,y,z]) for x,y in _curve(6220,10720)],fill=STEEL,width=12,joint="curve");d.line([_project([x,y,z]) for x,y in _curve(6324,10824)],fill=MESH,width=3,joint="curve")
    for x,y in _curve(6324,10824)[::8]:d.line([_project([x,y,0]),_project([x,y,1000])],fill=MESH,width=2)
    for a in result["anchors"]["anchors"]:d.line([_project(a["start_mm"]),_project(a["end_mm"])],fill=ANCHOR,width=3)
    _legend(d,[(STEEL,"I20a钢架×2"),(MESH,"Φ8@200×200网片"),(ANCHOR,"系统锚杆×43")]);_save(im,path)

def _longitudinal(path):
    im,d=_base("ZZ-Va 1m初支短节 · 纵向侧视","钢架与锚杆均为800mm节奏；同相位仅为Demo假设");x0,y0,x1,y1=160,200,1450,800;d.rectangle((x0,y0,x1,y1),fill="#c7a96f44",outline="#e8c77e",width=3)
    x=lambda z:x0+z/1000*(x1-x0);y=lambda r:y1-r/260*(y1-y0);d.line((x0,y(224),x1,y(224)),fill=MESH,width=6)
    for z in (100,900):d.rectangle((x(z)-26,y(220),x(z)+26,y(20)),fill=STEEL);d.line((x(z),y0,x(z),y1),fill=ANCHOR,width=3);d.text((x(z)-55,y1+20),f"z={z}mm",font=_font(16),fill=FG)
    d.line((x(100),y0-30,x(900),y0-30),fill="#ffdf5d",width=3);d.text(((x(100)+x(900))/2-65,y0-70),"800mm",font=_font(20,True),fill="#ffdf5d");_legend(d,[(CONCRETE,"260mm初支层"),(MESH,"网片中心线224mm"),(STEEL,"I20a钢架"),(ANCHOR,"锚杆层")],x=1160,y=230);_save(im,path)

def _relation(path,zone=False):
    im,d=_base("钢筋网/钢架设计连接区" if zone else "钢筋网位于钢架围岩侧 · PROVISIONAL","位置由实体半径计算；不使用人工magic offset");top,bottom=180,850;d.rectangle((220,top,1380,bottom),fill="#c7a96f44",outline=CONCRETE,width=3);yy=lambda r:bottom-r/260*(bottom-top)
    d.rectangle((600,yy(220),1000,yy(20)),fill=STEEL);d.line((250,yy(224),1350,yy(224)),fill=MESH,width=12)
    if zone:d.ellipse((760,yy(220)-55,840,yy(220)+25),outline="#ffdf5d",width=8);d.text((860,yy(220)-45),"DESIGN_CONNECTION_ZONE",font=_font(20,True),fill="#ffdf5d")
    d.text((1070,top+20),"围岩/开挖侧",font=_font(19,True),fill=FG);d.text((1070,bottom-55),"净空侧",font=_font(19,True),fill=FG);d.text((260,900),"I20a外缘=中心+100mm；网片中心=外缘+4mm；实体间距=0mm / CONTACT",font=_font(18),fill="#62e0aa");_save(im,path)

def render_all(root:Path,result:dict[str,Any])->list[Path]:
    out=root/"outputs/presentation";paths=[out/"ZZ-Va_primary_support_1m_perspective.png",out/"ZZ-Va_primary_support_1m_front.png",out/"ZZ-Va_primary_support_1m_longitudinal.png",out/"ZZ-Va_mesh_arch_rock_side.png",out/"ZZ-Va_mesh_arch_connection_zone.png",out/"ZZ-Va_primary_support_1m_full.png"]
    _perspective(result,paths[0]);_front(result,paths[1]);_longitudinal(paths[2]);_relation(paths[3]);_relation(paths[4],True);_front(result,paths[5],True);return paths
