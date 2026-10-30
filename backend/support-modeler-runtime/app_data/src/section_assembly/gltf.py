from __future__ import annotations
import json,struct
from pathlib import Path
COLORS={'steelArchMesh':[.32,.36,.40,1],'secondaryLiningMesh':[.55,.58,.62,.52],'N1Mesh':[.50,.22,.12,1],'N2Mesh':[.18,.34,.48,1],'N3Mesh':[.62,.66,.70,1],'N4Mesh':[.72,.58,.22,1]}
def _pad(x,f):return x+f*((4-len(x)%4)%4)
def write_section_glb(meshes,path:Path):
 binary=b'';views=[];acc=[];gmeshes=[];mats=[]
 for i,(name,m) in enumerate(meshes.items()):
  p=b''.join(struct.pack('<3f',*v) for v in m['vertices']);q=b''.join(struct.pack('<I',x) for x in m['indices']);po=len(binary);binary+=_pad(p,b'\0');io=len(binary);binary+=_pad(q,b'\0')
  views += [{'buffer':0,'byteOffset':po,'byteLength':len(p),'target':34962},{'buffer':0,'byteOffset':io,'byteLength':len(q),'target':34963}]
  ai=len(acc);acc += [{'bufferView':2*i,'componentType':5126,'count':len(m['vertices']),'type':'VEC3','min':m['bbox_m']['min'],'max':m['bbox_m']['max']},{'bufferView':2*i+1,'componentType':5125,'count':len(m['indices']),'type':'SCALAR','min':[min(m['indices'])],'max':[max(m['indices'])]}]
  gmeshes.append({'name':name,'primitives':[{'attributes':{'POSITION':ai},'indices':ai+1,'material':i}]});c=COLORS[name];mats.append({'name':name.replace('Mesh',' material'),'pbrMetallicRoughness':{'baseColorFactor':c,'metallicFactor':.62 if name=='steelArchMesh' else 0 if name=='secondaryLiningMesh' else .42,'roughnessFactor':.36 if name=='steelArchMesh' else .8 if name=='secondaryLiningMesh' else .45},'alphaMode':'BLEND' if name=='secondaryLiningMesh' else 'OPAQUE','doubleSided':name=='secondaryLiningMesh'})
 # Required hierarchy: root -> steel, secondarySystem -> lining, secondaryRebar -> N1..N4.
 nodes=[{'name':'ZZVaSectionAssemblyGroup','children':[1,3]}, {'name':'steelArchGroup','children':[2]}, {'name':'steelArchMesh','mesh':0},
        {'name':'secondarySystemGroup','children':[4,6]}, {'name':'secondaryLiningGroup','children':[5]}, {'name':'secondaryLiningMesh','mesh':1},
        {'name':'secondaryRebarGroup','children':[7,9,11,13]}, {'name':'N1Group','children':[8]}, {'name':'N1Mesh','mesh':2}, {'name':'N2Group','children':[10]}, {'name':'N2Mesh','mesh':3},
        {'name':'N3Group','children':[12]}, {'name':'N3Mesh','mesh':4}, {'name':'N4Group','children':[14]}, {'name':'N4Mesh','mesh':5}]
 extras={'support_type':'ZZ-Va','assembly_scope':'IMPLEMENTED_COMPONENTS_ONLY','contains':['steel_arch','secondary_lining','N1','N2','N3','N4'],'missing':['primary_support_concrete','primary_support_mesh','anchors','advance_support'],'coordinate_system':'x_right_y_up_z_forward_m'}
 doc={'asset':{'version':'2.0','generator':'SupportParameterExtractor implemented-components assembly'},'scene':0,'scenes':[{'name':'ZZVaSectionAssemblyGroup','nodes':[0]}],'nodes':nodes,'meshes':gmeshes,'materials':mats,'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc,'extras':extras}
 jc=_pad(json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode(),b' ');body=struct.pack('<I4s',len(jc),b'JSON')+jc+struct.pack('<I4s',len(binary),b'BIN\0')+binary;payload=struct.pack('<4sII',b'glTF',2,12+len(body))+body;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(payload);return inspect_section_glb(path)
def inspect_section_glb(path):
 p=Path(path).read_bytes();magic,ver,total=struct.unpack_from('<4sII',p,0);n,t=struct.unpack_from('<I4s',p,12);d=json.loads(p[20:20+n].decode().rstrip(' \0'))
 if (magic,ver,total)!=(b'glTF',2,len(p)):raise ValueError('invalid GLB')
 mins=[min(a['min'][k] for a in d['accessors'] if a['type']=='VEC3') for k in range(3)];maxs=[max(a['max'][k] for a in d['accessors'] if a['type']=='VEC3') for k in range(3)]
 return {'path':str(path),'byte_length':len(p),'mesh_count':len(d['meshes']),'mesh_names':[m['name'] for m in d['meshes']],'node_names':[x['name'] for x in d['nodes']],'metadata':d['extras'],'bbox_m':{'min':mins,'max':maxs,'size':[maxs[k]-mins[k] for k in range(3)]}}
