#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
STEP → 二进制 STL 转换（原生 OCCT，无 WASM 内存限制）
用法:
  python scripts/step2stl.py --input model.stp --output model.stl [--lin 5.0] [--ang 0.1]
说明:
  - 读取完整 STEP（实体 + 曲面/包络），BRepMesh_IncrementalMesh 网格化，写出全部三角形
  - 输出单位为 STEP 原始单位（Creo 导出为 mm），后续由 stl2glb.cjs 用 --scale 0.001 转米
"""
import sys
import struct
import argparse

from OCP.STEPControl import STEPControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE
from OCP.TopoDS import topods
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location


def triangulate_shape(shape, lin_deflection, ang_deflection):
    # isInParallel=True 提速
    BRepMesh_IncrementalMesh(shape, lin_deflection, False, ang_deflection, True)


def handle_get_obj(handle):
    # 兼容不同 OCP 版本的 Handle 取值方式
    if hasattr(handle, "get"):
        return handle.get()
    if hasattr(handle, "GetObject"):
        return handle.GetObject()
    return handle


def write_binary_stl(shape, out_path, scale):
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    tri_list = []  # (nx,ny,nz, ax,ay,az, bx,by,bz, cx,cy,cz)
    while explorer.More():
        face = topods.Face(explorer.Current())
        loc = TopLoc_Location()
        h = BRep_Tool.Triangulation(face, loc)
        if h is None or h.IsNull():
            explorer.Next()
            continue
        tri = handle_get_obj(h)
        trsf = loc.Transformation()
        n = tri.NbNodes()
        nodes = []
        for i in range(1, n + 1):
            p = tri.Node(i).Transformed(trsf)
            nodes.append((p.X() * scale, p.Y() * scale, p.Z() * scale))
        nt = tri.NbTriangles()
        for i in range(1, nt + 1):
            t = tri.Triangle(i)
            a = nodes[t.Value(1) - 1]
            b = nodes[t.Value(2) - 1]
            c = nodes[t.Value(3) - 1]
            # 面法线
            ux = b[0] - a[0]; uy = b[1] - a[1]; uz = b[2] - a[2]
            vx = c[0] - a[0]; vy = c[1] - a[1]; vz = c[2] - a[2]
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            tri_list.append((nx, ny, nz, a, b, c))
        explorer.Next()

    with open(out_path, "wb") as f:
        f.write(b"\0" * 80)
        f.write(struct.pack("<I", len(tri_list)))
        for (nx, ny, nz, a, b, c) in tri_list:
            f.write(struct.pack("<3f", nx, ny, nz))
            f.write(struct.pack("<3f", a[0], a[1], a[2]))
            f.write(struct.pack("<3f", b[0], b[1], b[2]))
            f.write(struct.pack("<3f", c[0], c[1], c[2]))
            f.write(struct.pack("<H", 0))
    print("三角形数量:", len(tri_list))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--lin", type=float, default=5.0, help="弦高(mm)")
    ap.add_argument("--ang", type=float, default=0.1, help="角度(rad)")
    ap.add_argument("--scale", type=float, default=1.0, help="坐标缩放")
    args = ap.parse_args()

    reader = STEPControl_Reader()
    status = reader.ReadFile(args.input)
    if status != IFSelect_RetDone:
        print("STEP 读取失败:", status)
        sys.exit(1)
    reader.TransferRoots()
    shape = reader.OneShape()
    print("STEP 读取完成，开始网格化 (lin=%s ang=%s)..." % (args.lin, args.ang))

    triangulate_shape(shape, args.lin, args.ang)
    print("网格化完成，写 STL...")

    write_binary_stl(shape, args.output, args.scale)
    print("完成:", args.output)


if __name__ == "__main__":
    main()
