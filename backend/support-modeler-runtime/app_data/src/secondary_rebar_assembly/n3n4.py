"""ZZ-Va 第110页 N3纵向筋与N4连接筋的正式参数、布局和实体网格。"""
from __future__ import annotations
import math
from typing import Any
from .geometry import build_rebar_profile, sample_profile

N3_PARAMETERS={
 "diameter_mm":12,"length_mm":1000,"circumferential_spacing_mm":250,"longitudinal_spacing_mm":None,
 "layout_mode":"CENTER_ALIGNED_TWO_LAYERS","layers":["N1_OUTER","N2_INNER"],
 "source_page":110,"source_method":"PDF_TEXT_AND_DRAWING_REVIEW","status":"N3_IMPLEMENTED"}
N4_PARAMETERS={
 "diameter_mm":8,"length_mm":552,"circumferential_spacing_mm":500,"longitudinal_spacing_mm":250,
 "hook_angle_deg":135,"hook_length_mm":87,"hook_straight_mm":40,"bend_radius_mm":20,
 "layout_mode":"STAGGERED_GRID","connection":"N1_TO_N2","source_page":110,
 "source_method":"PDF_TEXT_AND_DRAWING_REVIEW","status":"N4_IMPLEMENTED"}

def _polyline_metrics(points):
    pts=points+[points[0]]; lengths=[math.dist(pts[i],pts[i+1]) for i in range(len(points))]
    cumulative=[0.0]
    for x in lengths:cumulative.append(cumulative[-1]+x)
    return pts,cumulative,cumulative[-1]

def _point_tangent(points,distance):
    pts,cum,total=_polyline_metrics(points); d=distance%total
    i=next((i for i in range(len(cum)-1) if d<=cum[i+1]),len(cum)-2); span=cum[i+1]-cum[i]; t=(d-cum[i])/span
    p=[pts[i][0]+(pts[i+1][0]-pts[i][0])*t,pts[i][1]+(pts[i+1][1]-pts[i][1])*t]
    tx=(pts[i+1][0]-pts[i][0])/span;ty=(pts[i+1][1]-pts[i][1])/span
    return p,[tx,ty],total

def _append_cylinder(mesh,a,b,radius_m,sides=8):
    ax,ay,az=a;bx,by,bz=b;dx,dy,dz=bx-ax,by-ay,bz-az;L=math.sqrt(dx*dx+dy*dy+dz*dz)
    ux,uy,uz=dx/L,dy/L,dz/L; ref=(0,0,1) if abs(uz)<.9 else (1,0,0)
    vx=uy*ref[2]-uz*ref[1];vy=uz*ref[0]-ux*ref[2];vz=ux*ref[1]-uy*ref[0];vl=math.sqrt(vx*vx+vy*vy+vz*vz);vx,vy,vz=vx/vl,vy/vl,vz/vl
    wx=uy*vz-uz*vy;wy=uz*vx-ux*vz;wz=ux*vy-uy*vx;base=len(mesh['vertices'])
    for p in (a,b):
      for j in range(sides):
       q=2*math.pi*j/sides;c=math.cos(q)*radius_m;s=math.sin(q)*radius_m
       mesh['vertices'].append([p[0]+c*vx+s*wx,p[1]+c*vy+s*wy,p[2]+c*vz+s*wz])
    for j in range(sides):
      k=(j+1)%sides;mesh['indices'] += [base+j,base+sides+j,base+sides+k,base+j,base+sides+k,base+k]

def _finish(mesh):
    mesh['bbox_m']={'min':[min(v[k] for v in mesh['vertices']) for k in range(3)],'max':[max(v[k] for v in mesh['vertices']) for k in range(3)]}
    mesh['vertex_count']=len(mesh['vertices']);mesh['triangle_count']=len(mesh['indices'])//3;return mesh

def build_n3(profile_n1,profile_n2):
    mesh={'vertices':[],'indices':[]}; layouts=[]
    for layer,profile,drawing_length in [('N1_OUTER',profile_n1,35849),('N2_INNER',profile_n2,33474)]:
      points=sample_profile(profile,64); count=math.ceil(drawing_length/N3_PARAMETERS['circumferential_spacing_mm']); _,_,sampled_length=_polyline_metrics(points)
      actual=sampled_length/count
      for i in range(count):
        p,_,_=_point_tangent(points,i*actual);_append_cylinder(mesh,(p[0]/1000,p[1]/1000,0),(p[0]/1000,p[1]/1000,1),.006)
      layouts.append({'layer':layer,'count':count,'actual_spacing_mm':actual,'target_spacing_mm':250,'center_started':True,'symmetric':True})
    return _finish(mesh),layouts

def _n4_local_polyline():
    # u为由N2指向N1的径向，v为隧道纵向；R20圆弧+5d直段构成每端135°弯钩。
    r=20.0; central=378.0; half=central/2
    outer=[]
    for i in range(10):
      a=math.radians(90-135*i/9);outer.append([half+r*math.cos(a),-r+r*math.sin(a)])
    a=math.radians(-45);end=outer[-1];outer.append([end[0]-40/math.sqrt(2),end[1]-40/math.sqrt(2)])
    inner=[[-u,v] for u,v in outer]
    return list(reversed(inner))+[[-half,0],[half,0]]+outer

def build_n4(profile_mid):
    mesh={'vertices':[],'indices':[]};points=sample_profile(profile_mid,64);_,_,L=_polyline_metrics(points); local=_n4_local_polyline(); layouts=[]
    counts=[70,69,70,69]
    for plane,(z,count) in enumerate(zip((125,375,625,875),counts)):
      spacing=L/count;shift=0 if plane%2==0 else spacing/2
      for i in range(count):
        mid,t,_=_point_tangent(points,shift+i*spacing);normal=[-t[1],t[0]]
        path=[]
        for u,v in local:path.append(((mid[0]+u*normal[0])/1000,(mid[1]+u*normal[1])/1000,(z+v)/1000))
        for a,b in zip(path,path[1:]):
          if math.dist(a,b)>1e-9:_append_cylinder(mesh,a,b,.004)
      layouts.append({'z_mm':z,'count':count,'actual_circumferential_spacing_mm':spacing,'stagger_offset_mm':shift})
    return _finish(mesh),layouts

def build_n3n4_geometry():
    angles=[22+24/60+33/3600,11+41/60+58/3600,55+53/60+29/3600]
    n1=build_rebar_profile([5939,10439,1639,12439],angles);n2=build_rebar_profile([5561,10061,1261,12061],angles)
    mid=build_rebar_profile([5750,10250,1450,12250],angles)
    m3,l3=build_n3(n1,n2);m4,l4=build_n4(mid)
    developed=378+2*(math.radians(135)*20+40)
    return {'N3':{'parameters':N3_PARAMETERS,'mesh':m3,'layout':l3},'N4':{'parameters':N4_PARAMETERS,'mesh':m4,'layout':l4,'developed_length_mm':developed}}
