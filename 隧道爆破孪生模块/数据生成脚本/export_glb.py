# -*- coding: utf-8 -*-
"""
把 正洞爆破设计(炮孔+轮廓) 与 爆后点云(3.las) 打包成一个 GLB, 供平台 Cesium 加载。
- 输入: build/blast-design-zhengdong.json, build/pointcloud_zhengdong.npy
- 坐标重映射到"隧道模型局部系"(与 tunnel00x.glb 一致): 局部X=沿轴/进尺, Y=竖向上, Z=横向
    design(x=横向, y=进尺, z=上)  ->  glb(X=design.y, Y=design.z, Z=design.x)
  这样用与隧道段相同的放置变换 + 一个局部平移, 即可套进洞内且朝向一致。
- 点云导出为 glTF POINTS 图元(带顶点色); 炮孔/轮廓为细圆柱网格(带顶点色)。
"""
import json
from pathlib import Path
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "build" / "blast-design-zhengdong.json"
PTS = ROOT / "build" / "pointcloud_zhengdong.npy"
PLACEMENT = ROOT / "build" / "placement.json"
OUT = ROOT / "build" / "blast_effect.glb"

HOLE_R = 0.042
CONTOUR_R = 0.05

# 段局部放置矩阵(把断面放到隧道000段桩号250处), 直接烘焙进几何 ->
# GLB 原始坐标落在 tunnel000.glb 的原始坐标空间, 平台用与该段完全相同的 modelMatrix 加载即可对齐。
_pl = json.loads(PLACEMENT.read_text(encoding="utf-8"))
_L = np.array(_pl["LOCAL_colmajor"]).reshape(4, 4, order="F")
_R, _ORIGIN = _L[:3, :3], _L[:3, 3]


# 沿隧道方向翻转 180°(绕竖轴): 让掌子面朝掘进方向(进入山体/远离施工入口seg0),
# 空腔开口朝洞口。嵌套关系不变, 只反转沿轴朝向。
FLIP_ALONG_TUNNEL = True


def remap(p):
    """design(x,y,z) -> 隧道局部约定(X=进尺,Y=上,Z=横向) -> 烘焙段内放置 -> tunnel000 原始坐标"""
    px, py, pz = float(p[0]), float(p[1]), float(p[2])
    if FLIP_ALONG_TUNNEL:
        px, py = -px, -py    # 绕竖轴180°
    mylocal = np.array([py, pz, px], dtype=float)
    return _R @ mylocal + _ORIGIN


def cyl(a, b, r, color):
    a, b = remap(a), remap(b)
    seg = np.linalg.norm(b - a)
    if seg < 1e-6:
        return None
    m = trimesh.creation.cylinder(radius=r, segment=[a, b], sections=8)
    m.visual.vertex_colors = np.tile(np.array(color, dtype=np.uint8), (len(m.vertices), 1))
    return m


def hexrgb(h):
    h = h.lstrip("#")
    return [int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255]


def main():
    d = json.loads(DESIGN.read_text(encoding="utf-8"))
    meshes = []

    # 炮孔(圆柱) —— 直接用设计里的类别颜色(已加深)
    for h in d["holes"]:
        col = hexrgb(h["color"])
        m = cyl(h["collar"], h["toe"], HOLE_R, col)
        if m is not None:
            meshes.append(m)

    # 轮廓(闭合细管)
    c = d["contour"]
    ycol = [250, 204, 21, 255]
    for i in range(len(c)):
        m = cyl(c[i], c[(i + 1) % len(c)], CONTOUR_R, ycol)
        if m is not None:
            meshes.append(m)

    holes_mesh = trimesh.util.concatenate(meshes)

    # 点云 -> POINTS
    arr = np.load(PTS)
    pos = np.array([remap(p) for p in arr[:, :3]])
    rgb = (np.clip(arr[:, 3:6], 0, 1) * 255).astype(np.uint8)
    rgba = np.column_stack([rgb, np.full(len(rgb), 255, np.uint8)])
    cloud = trimesh.PointCloud(pos, colors=rgba)

    scene = trimesh.Scene()
    scene.add_geometry(holes_mesh, geom_name="holes")
    scene.add_geometry(cloud, geom_name="pointcloud")
    scene.export(OUT)
    print(f"写出 {OUT}")
    print(f"炮孔管网格顶点 {len(holes_mesh.vertices)}, 点云点数 {len(pos)}")

    # 回读校核
    g = trimesh.load(OUT)
    geoms = g.geometry if hasattr(g, "geometry") else {"_": g}
    print("GLB 内含几何:")
    for name, geom in geoms.items():
        kind = type(geom).__name__
        n = len(geom.vertices)
        b = geom.bounds
        print(f"  {name}: {kind}  顶点/点={n}  bounds X[{b[0][0]:.2f},{b[1][0]:.2f}] Y[{b[0][1]:.2f},{b[1][1]:.2f}] Z[{b[0][2]:.2f},{b[1][2]:.2f}]")


if __name__ == "__main__":
    main()
