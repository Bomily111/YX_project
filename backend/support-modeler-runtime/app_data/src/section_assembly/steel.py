"""只读复用已验证I20a GLB，并映射到统一断面坐标。"""
from __future__ import annotations
import json,math,struct
from pathlib import Path
from typing import Any

def _document_and_binary(path:Path):
 p=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',p,0)
 if (magic,version,total)!=(b'glTF',2,len(p)):raise ValueError('无效钢架GLB')
 n,t=struct.unpack_from('<I4s',p,12);doc=json.loads(p[20:20+n].decode().rstrip(' \0'));off=20+n;bn,bt=struct.unpack_from('<I4s',p,off);return doc,p[off+8:off+8+bn]

def read_steel_arch_mesh(path:Path,z_center_m=.5)->dict[str,Any]:
 doc,binary=_document_and_binary(Path(path));primitive=doc['meshes'][0]['primitives'][0];acc=doc['accessors'][primitive['attributes']['POSITION']];view=doc['bufferViews'][acc['bufferView']]
 stride=view.get('byteStride',12);start=view.get('byteOffset',0)+acc.get('byteOffset',0);vertices=[]
 for i in range(acc['count']):
  x,y,z=struct.unpack_from('<3f',binary,start+i*stride);vertices.append([x,y,z+z_center_m])
 indices=list(range(len(vertices)));mins=[min(v[k] for v in vertices) for k in range(3)];maxs=[max(v[k] for v in vertices) for k in range(3)]
 return {'vertices':vertices,'indices':indices,'bbox_m':{'min':mins,'max':maxs},'vertex_count':len(vertices),'triangle_count':len(indices)//3,
         'source_glb':str(path),'source_generator':doc['asset']['generator'],'transform':{'axis_mapping':'identity','translation_m':[0,0,z_center_m]},'source_extras':doc['nodes'][0].get('extras',{})}

def _steel_points(samples=800):
 r1,r2,b=6220.0,10720.0,math.radians(15.6664);cx=r1-r2;points=[]
 for i in range(samples//4+1):
  a=-b+b*i/(samples//4);points.append([cx+r2*math.cos(a),r2*math.sin(a)])
 for i in range(samples//2+1):
  a=math.pi*i/(samples//2);points.append([r1*math.cos(a),r1*math.sin(a)])
 for i in range(samples//4+1):
  a=math.pi+b*i/(samples//4);points.append([-cx+r2*math.cos(a),r2*math.sin(a)])
 return points

def steel_to_secondary_distances(inner_points,outer_points):
 steel=_steel_points();minimum=lambda target:min(math.dist(a,b) for a in steel for b in target)
 ci,co=minimum(inner_points),minimum(outer_points);half_height=100.0
 return {'steel_centerline_to_secondary_inner_mm':ci,'steel_entity_to_secondary_inner_mm':ci-half_height,
         'steel_centerline_to_secondary_outer_mm':co,'steel_entity_to_secondary_outer_mm':co-half_height,
         'measurement':'minimum sampled Euclidean section distance','interpretation':'GEOMETRIC_DISTANCE_ONLY'}
