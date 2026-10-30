from __future__ import annotations
import json,struct
from pathlib import Path

def _pad(x,f):return x+f*((4-len(x)%4)%4)
COLORS={'secondaryLiningMesh':[.55,.58,.62,.58],'N1Mesh':[.50,.22,.12,1],'N2Mesh':[.18,.34,.48,1],'N3Mesh':[.56,.62,.68,1],'N4Mesh':[.72,.58,.22,1]}
def write_full_glb(meshes,path:Path):
 b=b'';views=[];acc=[];ms=[];nodes=[];mats=[]
 for i,(name,m) in enumerate(meshes.items()):
  p=b''.join(struct.pack('<3f',*v) for v in m['vertices']);q=b''.join(struct.pack('<I',x) for x in m['indices']);po=len(b);b+=_pad(p,b'\0');io=len(b);b+=_pad(q,b'\0')
  views += [{'buffer':0,'byteOffset':po,'byteLength':len(p),'target':34962},{'buffer':0,'byteOffset':io,'byteLength':len(q),'target':34963}]
  ai=len(acc);acc += [{'bufferView':2*i,'componentType':5126,'count':len(m['vertices']),'type':'VEC3','min':m['bbox_m']['min'],'max':m['bbox_m']['max']},{'bufferView':2*i+1,'componentType':5125,'count':len(m['indices']),'type':'SCALAR','min':[min(m['indices'])],'max':[max(m['indices'])]}]
  ms.append({'name':name,'primitives':[{'attributes':{'POSITION':ai},'indices':ai+1,'material':i}]});nodes.append({'name':name.replace('Mesh','Group'),'children':[i+6]});nodes.append({'name':name,'mesh':i})
  c=COLORS[name];mats.append({'name':name.replace('Mesh',' material'),'pbrMetallicRoughness':{'baseColorFactor':c,'metallicFactor':0 if i==0 else .45,'roughnessFactor':.8 if i==0 else .45},'alphaMode':'BLEND' if i==0 else 'OPAQUE','doubleSided':i==0})
 # root 0, group nodes 1..5, mesh nodes 6..10
 group_nodes=nodes[::2];mesh_nodes=nodes[1::2];allnodes=[{'name':'secondaryRebarAssemblyGroup','children':list(range(1,6))}]
 for i,g in enumerate(group_nodes):g['children']=[6+i];allnodes.append(g)
 allnodes+=mesh_nodes
 doc={'asset':{'version':'2.0','generator':'SupportParameterExtractor full secondary rebar'},'scene':0,'scenes':[{'name':'secondaryRebarAssemblyGroup','nodes':[0]}],'nodes':allnodes,'meshes':ms,'materials':mats,'buffers':[{'byteLength':len(b)}],'bufferViews':views,'accessors':acc,'extras':{'components':list(meshes),'coordinate_system':'x_right_y_up_z_forward_m'}}
 jc=_pad(json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode(),b' ');body=struct.pack('<I4s',len(jc),b'JSON')+jc+struct.pack('<I4s',len(b),b'BIN\0')+b;payload=struct.pack('<4sII',b'glTF',2,12+len(body))+body;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(payload);return inspect_full_glb(path)
def inspect_full_glb(path):
 p=Path(path).read_bytes();magic,ver,total=struct.unpack_from('<4sII',p,0);n,t=struct.unpack_from('<I4s',p,12);d=json.loads(p[20:20+n].decode().rstrip(' \0'))
 if (magic,ver,total)!=(b'glTF',2,len(p)):raise ValueError('invalid GLB')
 return {'path':str(path),'byte_length':len(p),'mesh_count':len(d['meshes']),'mesh_names':[m['name'] for m in d['meshes']],'node_names':[x['name'] for x in d['nodes']],'generator':d['asset']['generator']}
