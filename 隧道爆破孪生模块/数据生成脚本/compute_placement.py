# -*- coding: utf-8 -*-
"""
从平台隧道段 GLB(tunnel000.glb) 求出一个断面的精确放置变换(段局部系)。
隧道在段内是弯曲的, 必须让断面垂直于该桩号的真实切线, 否则会歪。
输出一个 4x4 局部矩阵 LOCAL(列优先, 供 Cesium): 平台侧
    modelMatrix = M_i * LOCAL,  M_i = HPR2Fixed(段锚点, heading=90)
使爆破断面(设计原点=底板中心, +X=进尺, +Y=上, +Z=横向)贴到隧道内该桩号处。
"""
import struct, json, math
from pathlib import Path
import numpy as np

TUN = Path(__file__).resolve().parents[2] / "孪生平台" / "project" / "public" / "data" / "tunnel" / "tunnel000.glb"
SEG_INDEX = 0
STATION = 250.0          # 段内沿轴桩号(米)
DESIGN_CROWN = 9.08      # 设计断面拱顶高(与 build_design 一致)


def load_positions(path):
    with open(path, "rb") as f:
        f.read(4); struct.unpack("<II", f.read(8)); clen, _ = struct.unpack("<II", f.read(8))
        js = json.loads(f.read(clen)); blen, _ = struct.unpack("<II", f.read(8)); bind = f.read(blen)
    out = []
    for m in js["meshes"]:
        for p in m["primitives"]:
            ai = p["attributes"]["POSITION"]; acc = js["accessors"][ai]; bv = js["bufferViews"][acc["bufferView"]]
            off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
            out.append(np.frombuffer(bind, "<f4", acc["count"] * 3, off).reshape(-1, 3))
    return np.vstack(out)   # columns: local X(axis), Y(up), Z(lateral)


def bore_at(P, s, half=0.6):
    sl = P[np.abs(P[:, 0] - s) < half]
    zc = (np.percentile(sl[:, 2], 2) + np.percentile(sl[:, 2], 98)) / 2
    crown = np.percentile(sl[:, 1], 99)
    invert = np.percentile(sl[:, 1], 1)
    return zc, crown, invert, len(sl)


def main():
    P = load_positions(TUN)
    zc, crown, invert, n = bore_at(P, STATION)
    # 局部切线: 中心Y、横向Z 随 X 的斜率(取 ±20m 窗口线性拟合)
    win = (P[:, 0] > STATION - 20) & (P[:, 0] < STATION + 20)
    xs = np.arange(STATION - 18, STATION + 18, 1.0)
    cy, cz = [], []
    for x0 in xs:
        s2 = P[np.abs(P[:, 0] - x0) < 0.6]
        if len(s2) < 50:
            continue
        cy.append([(np.percentile(s2[:,1],1)+np.percentile(s2[:,1],99))/2, x0])
        cz.append([(np.percentile(s2[:,2],2)+np.percentile(s2[:,2],98))/2, x0])
    cy = np.array(cy); cz = np.array(cz)
    gY = np.polyfit(cy[:,1], cy[:,0], 1)[0]     # dCenterY/dX  (纵坡)
    gZ = np.polyfit(cz[:,1], cz[:,0], 1)[0]     # dZc/dX       (平面弯曲)

    # 切线 t、上 u -> 右手正交基(段局部系), 保证 det(R)=+1(不镜像)
    t = np.array([1.0, gY, gZ]); t /= np.linalg.norm(t)
    u = np.array([0.0, 1.0, 0.0])
    lat = np.cross(t, u); lat /= np.linalg.norm(lat)   # 设计 +Z(横向)
    up2 = np.cross(lat, t); up2 /= np.linalg.norm(up2)  # 设计 +Y(上) ≈ 世界上
    # 设计轴 -> 段局部: 进尺X->t, 上Y->up2, 横向Z->lat  => R 列为 [t, up2, lat], 右手系
    R = np.column_stack([t, up2, lat])
    assert np.linalg.det(R) > 0.99, f"R 非正交旋转 det={np.linalg.det(R)}"

    # 原点(设计底板中心): 横向=zc, 竖向使拱顶对齐 -> Yorigin = crown - DESIGN_CROWN
    Yorigin = crown - DESIGN_CROWN
    origin = np.array([STATION, Yorigin, zc])

    LOCAL = np.eye(4)
    LOCAL[:3, :3] = R
    LOCAL[:3, 3] = origin

    # Cesium Matrix4 为列优先的 16 元数组
    colmajor = LOCAL.flatten(order="F").tolist()
    cfg = {
        "segmentIndex": SEG_INDEX, "station": STATION,
        "boreZc": float(zc), "crownY": float(crown), "invertY": float(invert),
        "gradeSlope": float(gY), "planDriftSlope": float(gZ),
        "yawDeg": float(math.degrees(math.atan2(gZ, 1))),
        "pitchDeg": float(math.degrees(math.atan2(gY, 1))),
        "originLocal": origin.tolist(),
        "LOCAL_colmajor": [round(v, 6) for v in colmajor],
    }
    outp = Path(__file__).resolve().parents[1] / "build" / "placement.json"
    outp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(cfg, ensure_ascii=False, indent=2))
    print("\n段内切片点数:", n, " 拱顶", round(crown,2), " 仰拱", round(invert,2), " 横向中心", round(zc,2))
    print("写出", outp)


if __name__ == "__main__":
    main()
