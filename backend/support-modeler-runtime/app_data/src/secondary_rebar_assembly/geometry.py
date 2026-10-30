"""复用已验证的 N1/N2 四圆弧公式，并转换到统一 x/y/z 坐标。"""
from __future__ import annotations
import math
from typing import Any


def _advance(start, tangent, radius, angle, name):
    phi0 = tangent + math.pi / 2
    center = (start[0] - radius * math.cos(phi0), start[1] - radius * math.sin(phi0))
    phi1 = phi0 - angle
    end = (center[0] + radius * math.cos(phi1), center[1] + radius * math.sin(phi1))
    return {"name": name, "center_mm": list(center), "radius_mm": radius,
            "start_angle_deg": math.degrees(phi0), "end_angle_deg": math.degrees(phi1),
            "start_mm": list(start), "end_mm": list(end), "connection": "TANGENT"}, end, tangent-angle


def build_rebar_profile(radii_mm: list[float], angles_deg: list[float]) -> dict[str, Any]:
    """与 rebar_auto.html 等价：顶拱 180°，依次为 B、C、A 单侧圆弧。"""
    start, tangent, right = (0.0, float(radii_mm[0])), 0.0, []
    for name, radius, angle in zip(("top", "side", "invert_transition", "invert_bottom"), radii_mm,
                                   (90.0, angles_deg[1], angles_deg[2], angles_deg[0])):
        arc, start, tangent = _advance(start, tangent, float(radius), math.radians(angle), name)
        right.append(arc)
    left = [{**a, "name": a["name"]+"_mirrored", "center_mm": [-a["center_mm"][0], a["center_mm"][1]],
             "start_mm": [-a["end_mm"][0], a["end_mm"][1]], "end_mm": [-a["start_mm"][0], a["start_mm"][1]],
             "start_angle_deg": 180-a["end_angle_deg"], "end_angle_deg": 180-a["start_angle_deg"]}
            for a in reversed(right)]
    return {"coordinate_system": "x_right_y_up_mm", "construction": "VERIFIED_N1_N2_TANGENT_CHAIN_MIRRORED",
            "right_segments": right, "left_segments": left, "axis_closure_residual_mm": abs(right[-1]["end_mm"][0]),
            "closed": abs(right[-1]["end_mm"][0]) <= 0.1}


def sample_profile(profile: dict[str, Any], samples=48):
    pts=[]
    for seg in profile["right_segments"]+profile["left_segments"]:
        for i in range(samples+1):
            if pts and i == 0: continue
            a=math.radians(seg["start_angle_deg"]+(seg["end_angle_deg"]-seg["start_angle_deg"])*i/samples)
            pts.append([seg["center_mm"][0]+seg["radius_mm"]*math.cos(a), seg["center_mm"][1]+seg["radius_mm"]*math.sin(a)])
    if math.dist(pts[0], pts[-1]) <= .1: pts.pop()
    return pts


def build_tube_mesh(profile: dict[str, Any], diameter_mm: float, z_mm=500.0, ring_segments=10):
    points=sample_profile(profile); n=len(points); r=diameter_mm/2000.0; vertices=[]
    for i,(x,y) in enumerate(points):
        p0=points[i-1]; p1=points[(i+1)%n]; tx,ty=p1[0]-p0[0],p1[1]-p0[1]; length=math.hypot(tx,ty)
        nx,ny=-ty/length,tx/length
        for j in range(ring_segments):
            a=2*math.pi*j/ring_segments
            vertices.append([x/1000+r*math.cos(a)*nx, y/1000+r*math.cos(a)*ny, z_mm/1000+r*math.sin(a)])
    indices=[]
    for i in range(n):
        ni=(i+1)%n
        for j in range(ring_segments):
            nj=(j+1)%ring_segments; a=i*ring_segments+j; b=ni*ring_segments+j; c=ni*ring_segments+nj; d=i*ring_segments+nj
            indices += [a,b,c,a,c,d]
    mins=[min(v[k] for v in vertices) for k in range(3)]; maxs=[max(v[k] for v in vertices) for k in range(3)]
    return {"vertices":vertices,"indices":indices,"bbox_m":{"min":mins,"max":maxs},"vertex_count":len(vertices),"triangle_count":len(indices)//3}
