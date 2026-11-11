"""Blender 4.5: editable demonstration geometry, not a surveyed excavation."""
import bpy, json, math, random
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/tunnel'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
profile = json.loads((ROOT/'src/modules/face-sketch/tunnel-normal-sections.json').read_text())
outline = profile['sections'][0]['outline']
source_origin=profile['sourceGltfOrigin']
center_x=source_origin[2]

def clip(points, height, above):
    result = []
    for a,b in zip(points, points[1:]+points[:1]):
        ia,ib = (a[1]>=height)==above, (b[1]>=height)==above
        if ia: result.append(a)
        if ia != ib:
            t = (height-a[1])/(b[1]-a[1])
            result.append([a[0]+t*(b[0]-a[0]),height])
    return result

materials=[]
for i in range(9):
    mat=bpy.data.materials.new(f'Rock matte {i}')
    mat.diffuse_color=(.30+i*.012,.29+i*.011,.26+i*.010,1)
    mat.use_nodes=True
    bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if bsdf is None:
        bsdf=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output=mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
        mat.node_tree.links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value=mat.diffuse_color
    bsdf.inputs['Roughness'].default_value=.94
    materials.append(mat)

def solid(name, low, high, front, end):
    vertices=[]; rings=[]
    for station in profile['sections'][front:end+1]:
        contour=station['outline']
        lo=max(low,min(p[1] for p in contour))+.00001
        hi=min(high,max(p[1] for p in contour))-.00001
        left=[];right=[]
        for i in range(65):
            h=lo+(hi-lo)*i/64
            hits=[]
            for a,b in zip(contour,contour[1:]+contour[:1]):
                if (a[1]<h)!=(b[1]<h): hits.append(a[0]+(h-a[1])/(b[1]-a[1])*(b[0]-a[0]))
            if len(hits)<2: raise RuntimeError('Incomplete tunnel opening intersection')
            left.append((min(hits),h));right.append((max(hits),h))
        p=right+list(reversed(left));rings.append(p)
        frame=station['frame']
        for x,h in p:
            point=[frame['center'][i]+frame['lateral'][i]*x+frame['up'][i]*h for i in range(3)]
            vertices.append((point[2]-source_origin[2],point[0]-source_origin[0],point[1]-source_origin[1]))
    n=len(rings[0]);p=rings[0]
    ring=[Vector((x,h,0)) for x,h in p]
    triangles=tessellate_polygon([ring])
    lookup={(v.x,v.y):i for i,v in enumerate(ring)}
    faces=[]
    for triangle in triangles:
        ids=[v if isinstance(v,int) else lookup[(v.x,v.y)] for v in triangle]
        faces.append(tuple(reversed(ids)))
    last=(len(rings)-1)*n
    # The final cap is triangulated from its own contour.
    endring=[Vector((x,h,0)) for x,h in rings[-1]]
    endlookup={(v.x,v.y):i for i,v in enumerate(endring)}
    for triangle in tessellate_polygon([endring]):faces.append(tuple(last+(v if isinstance(v,int) else endlookup[(v.x,v.y)]) for v in triangle))
    for j in range(len(rings)-1):
        faces += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    for mat in materials: mesh.materials.append(mat)
    rng=random.Random(name)
    for face in mesh.polygons: face.material_index=4
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)
    obj['demonstration_only']=True;obj['front_offset_m']=front
    return obj

bottom=min(p[1] for s in profile['sections'] for p in s['outline']); top=max(p[1] for s in profile['sections'] for p in s['outline'])
objects=[solid('Lower bench remaining rock',bottom,0,0,22),solid('Middle bench remaining rock',0,2.8,6,22),solid('Upper bench remaining rock',2.8,top,12,22)]
for obj in objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'三台阶.glb'),export_format='GLB',use_selection=True,export_extras=True)

metadata={'demonstration':True,'profileSource':profile['source'],'profileMethod':profile['method'],'sourceGltfOrigin':source_origin,'advanceAxis':'source-centerline arc-length; asset coordinates retain source basis','units':'m','upperFront':12,'middleFront':6,'lowerFront':0,'end':22,'elevations':[bottom,0,2.8,top],'stationCount':len(profile['sections']),'stationSpacingM':1,'centerlineFitResidualM':profile['centerlineFitResidualM'],'note':'Section planes follow the fitted source centerline normal. Not surveyed excavation. Illustrative bench heights and offsets; no invented surveyed relief.'}
(OUT/'三台阶.metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(ROOT/'src/modules/rock/three-bench.metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

world=bpy.context.scene.world or bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.075,.10,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6
def aim(obj, target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(24,-30,22));camera=bpy.context.object;aim(camera,(0,9,1));camera.data.type='ORTHO';camera.data.ortho_scale=36;bpy.context.scene.camera=camera
for location,energy,size in [((5,-12,25),3500,15),((-15,8,14),2200,12),((8,24,18),2500,10)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;aim(light,(0,8,0))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/'三台阶.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'三台阶.blend'))
bpy.ops.render.render(write_still=True)
