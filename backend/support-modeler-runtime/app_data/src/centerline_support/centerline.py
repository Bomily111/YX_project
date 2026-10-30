"""CenterLine规范化、WGS84/UTM兼容和稳定局部坐标系。

历史HTML接受GeoJSON LineString，经纬高坐标使用首点所在WGS84 UTM分区，
再转换为 Three.js 的 x横向、y竖向、z纵向。本模块保持相同约定，同时接受
已经是米制局部坐标的规范CenterLine结构。
"""
from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Any

import numpy as np


def _unit(vector: np.ndarray) -> np.ndarray:
    length = float(np.linalg.norm(vector))
    if length <= 1e-12:
        raise ValueError("中心线包含重合点，无法计算方向。")
    return vector / length


@dataclass(frozen=True)
class LocalFrame:
    chainage: float
    position: tuple[float, float, float]
    tangent: tuple[float, float, float]
    right: tuple[float, float, float]
    up: tuple[float, float, float]


@dataclass
class CenterLine:
    points: np.ndarray
    chainage: np.ndarray
    coordinate_system: dict[str, Any]
    source: str

    @property
    def length(self) -> float:
        return float(self.chainage[-1])

    def position_at(self, value: float) -> np.ndarray:
        value = float(np.clip(value, self.chainage[0], self.chainage[-1]))
        index = min(int(np.searchsorted(self.chainage, value, side="right") - 1), len(self.points) - 2)
        start, end = self.chainage[index], self.chainage[index + 1]
        ratio = 0.0 if end == start else (value - start) / (end - start)
        return self.points[index] * (1.0 - ratio) + self.points[index + 1] * ratio

    def tangent_at(self, value: float) -> np.ndarray:
        value = float(np.clip(value, self.chainage[0], self.chainage[-1]))
        index = min(int(np.searchsorted(self.chainage, value, side="right") - 1), len(self.points) - 2)
        if 0 < index < len(self.points) - 2:
            vector = self.points[index + 1] - self.points[index - 1]
        else:
            vector = self.points[index + 1] - self.points[index]
        return _unit(vector)

    def frame_at(self, value: float, previous_right: np.ndarray | None = None) -> LocalFrame:
        tangent = self.tangent_at(value)
        global_up = np.array([0.0, 1.0, 0.0])
        right = np.cross(global_up, tangent)
        if np.linalg.norm(right) < 1e-8:
            right = previous_right if previous_right is not None else np.array([1.0, 0.0, 0.0])
        right = _unit(right)
        if previous_right is not None and float(np.dot(right, previous_right)) < 0:
            right = -right
        up = _unit(np.cross(tangent, right))
        position = self.position_at(value)
        return LocalFrame(
            chainage=float(value),
            position=tuple(float(x) for x in position),
            tangent=tuple(float(x) for x in tangent),
            right=tuple(float(x) for x in right),
            up=tuple(float(x) for x in up),
        )


def _utm_forward(lon_deg: float, lat_deg: float, zone: int) -> tuple[float, float]:
    """WGS84经纬度转UTM，等价于历史页面的proj4 UTM定义。"""
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    lon = math.radians(lon_deg)
    lat = math.radians(lat_deg)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    sin_lat, cos_lat, tan_lat = math.sin(lat), math.cos(lat), math.tan(lat)
    n = a / math.sqrt(1 - e2 * sin_lat * sin_lat)
    t = tan_lat * tan_lat
    c = ep2 * cos_lat * cos_lat
    aa = cos_lat * (lon - lon0)
    m = a * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * lat
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * lat)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * lat)
        - (35 * e2**3 / 3072) * math.sin(6 * lat)
    )
    easting = 500000 + k0 * n * (aa + (1 - t + c) * aa**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * ep2) * aa**5 / 120)
    northing = k0 * (m + n * tan_lat * (aa**2 / 2 + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24 + (61 - 58 * t + t**2 + 600 * c - 330 * ep2) * aa**6 / 720))
    if lat_deg < 0:
        northing += 10000000
    return easting, northing


def _from_geojson(data: dict[str, Any], source: str) -> CenterLine:
    feature = data["features"][0]
    if feature.get("geometry", {}).get("type") != "LineString":
        raise ValueError("centerLine GeoJSON首个要素必须是LineString。")
    coords = feature["geometry"]["coordinates"]
    if len(coords) < 2 or any(len(item) < 2 for item in coords):
        raise ValueError("centerLine至少需要两个经纬度点。")
    origin = coords[0]
    zone = math.floor((float(origin[0]) + 180) / 6) + 1
    origin_e, origin_n = _utm_forward(float(origin[0]), float(origin[1]), zone)
    origin_h = float(origin[2]) if len(origin) > 2 else 0.0
    points = []
    for item in coords:
        easting, northing = _utm_forward(float(item[0]), float(item[1]), zone)
        height = float(item[2]) if len(item) > 2 else origin_h
        points.append([easting - origin_e, height - origin_h, -(northing - origin_n)])
    return _finish(points, {
        "kind": "WGS84_UTM_LOCAL",
        "source_crs": "EPSG:4326",
        "utm_zone": zone,
        "axis": "x=easting, y=elevation, z=-northing",
        "unit": "m",
    }, source)


def _finish(points: Any, coordinate_system: dict[str, Any], source: str, supplied_chainage: Any = None) -> CenterLine:
    array = np.asarray(points, dtype=float)
    if array.ndim != 2 or array.shape[1] != 3 or len(array) < 2:
        raise ValueError("CenterLine.points必须是至少两个[x,y,z]点。")
    steps = np.linalg.norm(np.diff(array, axis=0), axis=1)
    if np.any(steps <= 1e-9):
        raise ValueError("CenterLine不能包含连续重合点。")
    computed = np.concatenate(([0.0], np.cumsum(steps)))
    if supplied_chainage is not None:
        supplied = np.asarray(supplied_chainage, dtype=float)
        if len(supplied) != len(array) or np.any(np.diff(supplied) <= 0):
            raise ValueError("CenterLine.chainage必须与points等长并严格递增。")
        if not np.allclose(np.diff(supplied), steps, rtol=2e-3, atol=2e-3):
            raise ValueError("CenterLine.chainage与三维点间距离不一致。")
        computed = supplied - supplied[0]
    return CenterLine(array, computed, coordinate_system, source)


def load_centerline(path: Path) -> CenterLine:
    path = Path(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("type") == "FeatureCollection":
        return _from_geojson(data, path.as_posix())
    if "points" not in data:
        raise ValueError("不支持的centerLine结构；需要规范CenterLine或GeoJSON FeatureCollection。")
    return _finish(data["points"], data.get("coordinate_system", {}), path.as_posix(), data.get("chainage"))

