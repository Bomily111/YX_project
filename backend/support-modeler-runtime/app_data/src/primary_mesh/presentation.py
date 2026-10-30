"""生成初支钢筋网工程验证图。"""
from __future__ import annotations
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from primary_support.geometry import build_primary_profiles,sample_open_profile
from .geometry import build_primary_mesh_geometry

def _font(n,b=False):
 p=Path('C:/Windows/Fonts/msyhbd.ttc' if b else 'C:/Windows/Fonts/msyh.ttc');return ImageFont.truetype(str(p),n) if p.exists() else ImageFont.load_default()
def _base(title,sub):
 im=Image.new('RGB',(1600,1000),'#0e141d');d=ImageDraw.Draw(im,'RGBA');d.text((55,35),title,font=_font(32,True),fill='#edf4fb');d.text((58,82),sub,font=_font(17),fill='#aab9c9');return im,d
def _map(points,box=(70,125,1210,930),bounds=(-7000,7000,-3600,6900)):
 x0,y0,x1,y1=box;xmin,xmax,ymin,ymax=bounds;s=min((x1-x0)/(xmax-xmin),(y1-y0)/(ymax-ymin));cx=(x0+x1)/2;cy=y0+ymax*s;return [(cx+x*s,cy-y*s) for x,y in points]
def _line(d,p,c,w=4):d.line(_map(p),fill=c,width=w,joint='curve')
def _curve(r1,r2):return sample_open_profile(build_primary_profiles(r1,r2,r1,r2,15.6664)['inner'],96)
def _legend(d,items,x=1250,y=155):
 for c,t in items:d.rounded_rectangle((x,y,x+32,y+18),4,fill=c);d.text((x+46,y-4),t,font=_font(17),fill='#dbe6f1');y+=41
def render_2d(path):
 im,d=_base('ZZ-Va 初支钢筋网二维布置','φ8@200×200 mm，中心线距初支内表面40 mm；仅顶拱和侧拱')
 inner,outer,mesh,steel,secondary=_curve(6100,10600),_curve(6360,10860),_curve(6140,10640),_curve(6220,10720),_curve(6000,10500)
 d.polygon(_map(outer)+list(reversed(_map(inner))),fill='#c7a96f55');_line(d,secondary,'#6eb5db',4);_line(d,inner,'#e9c77e',3);_line(d,outer,'#f28b55',4);_line(d,steel,'#3c4652',13);_line(d,mesh,'#35c38f',4)
 g=build_primary_mesh_geometry();pts=_map(g['longitudinal']['points_mm']);
 for x,y in pts:d.ellipse((x-2.5,y-2.5,x+2.5,y+2.5),fill='#51aee0')
 _legend(d,[('#6eb5db','二衬外表面'),('#c7a96f','初支混凝土'),('#3c4652','I20a钢架'),('#35c38f','环向钢筋'),('#51aee0','纵向钢筋截面')]);d.text((1250,400),'TOP / SIDE READY',font=_font(18,True),fill='#62e0aa');d.text((1250,450),'INVERT NOT READY',font=_font(17,True),fill='#ffb769');path.parent.mkdir(parents=True,exist_ok=True);im.save(path)
def render_relation(path):
 im,d=_base('初支钢筋网与 I20a 钢架空间关系','几何位置已确定；图纸未明确绑扎、接触或避让做法，需工程复核')
 x0,x1,y0,y1=210,1390,260,680;s=(x1-x0)/260
 d.rectangle((x0,y0,x1,y1),fill='#c7a96f55',outline='#e8c77e',width=3)
 def xx(v):return x0+v*s
 d.rectangle((xx(20),y0+80,xx(220),y1-80),fill='#3c4652',outline='white',width=2)
 mx=xx(40);d.ellipse((mx-22,y0+185,mx+22,y0+229),fill='#35c38f',outline='white',width=2)
 d.text((x0,y0-48),'初支内表面 0',font=_font(18),fill='#e7edf5');d.text((x1,y0-48),'开挖边界 260 mm',anchor='ra',font=_font(18),fill='#e7edf5')
 d.text((xx(40),y1+35),'钢筋中心 40 mm',anchor='ma',font=_font(18,True),fill='#62e0aa');d.text((xx(120),y0+35),'I20a：20–220 mm',anchor='ma',font=_font(18),fill='white')
 rows=['钢筋实体：36–44 mm','钢架径向包络：20–220 mm','几何结果：存在交叠','设计关系：PRIMARY_MESH_STEEL_RELATION_NEEDS_REVIEW','当前不把设计接触判为错误碰撞']
 for i,t in enumerate(rows):d.text((310,760+i*38),t,font=_font(17,i==3),fill='#ffbd70' if i in (2,3) else '#cbd8e5')
 path.parent.mkdir(parents=True,exist_ok=True);im.save(path)
def _project(p,z):
 x,y=p;return _map([[x+z*1100,y+z*620]],box=(70,125,1210,930),bounds=(-7000,8000,-3600,7600))[0]
def render_3d(path):
 im,d=_base('ZZ-Va 初支钢筋网 1 m 部分模型','5道环向钢筋 + 125根纵向钢筋；真实直径8 mm；仰拱保持开放')
 g=build_primary_mesh_geometry();profile=_curve(6140,10640)
 for z in g['circumferential']['z_positions_mm']:
  d.line([_project(p,z/1000) for p in profile],fill='#35c38f',width=4,joint='curve')
 for p in g['longitudinal']['points_mm']:
  d.line([_project(p,0),_project(p,1)],fill='#4ba8d8',width=2)
 _legend(d,[('#35c38f','环向钢筋（5道）'),('#4ba8d8','纵向钢筋（125根）')]);d.text((1250,270),'φ8@200×200',font=_font(20,True),fill='#edf4fb');d.text((1250,320),'深度 1.0 m',font=_font(18),fill='#dbe6f1');d.text((1250,370),'下部 OPEN',font=_font(18,True),fill='#ffb769');path.parent.mkdir(parents=True,exist_ok=True);im.save(path)
def render_section(path):
 im,d=_base('ZZ-Va 已实现构件总装（含部分初支钢筋网）','初支混凝土 + 初支钢筋网 + I20a + 二衬 + N1/N2/N3/N4')
 inner,outer,mesh,steel=_curve(6100,10600),_curve(6360,10860),_curve(6140,10640),_curve(6220,10720)
 d.polygon(_map(outer)+list(reversed(_map(inner))),fill='#c7a96f55');_line(d,outer,'#f28b55',3);_line(d,mesh,'#35c38f',5);_line(d,steel,'#3c4652',13);_line(d,_curve(6000,10500),'#74b9de',8);_line(d,_curve(5939,10439),'#c66f40',3);_line(d,_curve(5561,10061),'#3d98c5',3)
 _legend(d,[('#c7a96f','初支混凝土（部分）'),('#35c38f','初支钢筋网（部分）'),('#3c4652','I20a钢架'),('#74b9de','二衬混凝土'),('#c66f40','N1'),('#3d98c5','N2')]);d.text((1250,450),'总装：9 Mesh',font=_font(19,True),fill='#62e0aa');d.text((1250,500),'TOP+SIDE ONLY',font=_font(17,True),fill='#ffb769');path.parent.mkdir(parents=True,exist_ok=True);im.save(path)
def render_all(root):
 out=root/'outputs/presentation';paths=[out/'ZZ-Va_primary_mesh_2d.png',out/'ZZ-Va_primary_mesh_relation_to_steel.png',out/'ZZ-Va_primary_mesh_partial_3d.png',out/'ZZ-Va_section_with_primary_mesh.png'];render_2d(paths[0]);render_relation(paths[1]);render_3d(paths[2]);render_section(paths[3]);return paths
