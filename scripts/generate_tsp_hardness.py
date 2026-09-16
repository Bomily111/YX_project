#!/usr/bin/env python3
"""Derive saturated UCS and rock-hardness voxels from generated TSP VP/VS atlases."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data" / "tsp_actual"

CLASSES = [
    {"key": "very_soft", "label": "极软岩", "rule": "Rc ≤ 5 MPa", "color": "#d73027"},
    {"key": "soft", "label": "软岩", "rule": "5 < Rc ≤ 15 MPa", "color": "#fc8d59"},
    {"key": "relatively_soft", "label": "较软岩", "rule": "15 < Rc ≤ 30 MPa", "color": "#fee08b"},
    {"key": "hard", "label": "硬岩", "rule": "30 < Rc ≤ 60 MPa", "color": "#66c2a5"},
    {"key": "very_hard", "label": "极硬岩", "rule": "Rc > 60 MPa", "color": "#4575b4"},
]


def unpack_atlas(path: Path, shape: list[int], value_range: list[float]) -> np.ndarray:
    nx, ny, nz = shape
    atlas = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
    tiles_x = math.ceil(math.sqrt(nz * ny / nx))
    volume = np.empty((nz, ny, nx), dtype=np.float32)
    for z in range(nz):
        tx, ty = z % tiles_x, z // tiles_x
        volume[z] = atlas[ty * ny:(ty + 1) * ny, tx * nx:(tx + 1) * nx]
    lo, hi = map(float, value_range)
    return lo + volume / 255.0 * (hi - lo)


def pack_atlas(volume: np.ndarray, path: Path) -> None:
    nz, ny, nx = volume.shape
    tiles_x = math.ceil(math.sqrt(nz * ny / nx))
    tiles_y = math.ceil(nz / tiles_x)
    # ShareVolume samples the atlas close to its outer boundary. Leaving unused
    # tiles as zero would therefore bleed the first colour (extremely soft/red)
    # into the last z face even when that class does not exist in the data.
    # Fill every padding tile with the final valid slice instead.
    atlas = np.empty((tiles_y * ny, tiles_x * nx), dtype=np.uint8)
    for tile in range(tiles_x * tiles_y):
        z = min(tile, nz - 1)
        tx, ty = tile % tiles_x, tile // tiles_x
        atlas[ty * ny:(ty + 1) * ny, tx * nx:(tx + 1) * nx] = volume[z]
    Image.fromarray(atlas, mode="L").save(path, compress_level=4)


def main() -> None:
    metadata_path = DATA_DIR / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    vp_meta, vs_meta = metadata["channels"]["vp"], metadata["channels"]["vs"]
    if vp_meta["shape"] != vs_meta["shape"]:
        raise ValueError("VP and VS voxel grids must have identical shapes")

    vp = unpack_atlas(DATA_DIR / "vp_volume.png", vp_meta["shape"], vp_meta["valueRange"])
    vs = unpack_atlas(DATA_DIR / "vs_volume.png", vs_meta["shape"], vs_meta["valueRange"])

    # rho: g/cm3 (velocities in m/s); ED: GPa (velocities converted to km/s); Rc: MPa.
    rho = 0.7 * np.power(vp * vs, 0.08)
    vp_km, vs_km = vp / 1000.0, vs / 1000.0
    denominator = np.maximum(vp_km ** 2 - vs_km ** 2, 1e-6)
    ed = rho * vs_km ** 2 * (3.0 * vp_km ** 2 - 4.0 * vs_km ** 2) / denominator
    ed = np.maximum(ed, 0.0)
    rc = 7.1718 * np.power(ed, 0.6062)

    class_index = np.select(
        [rc <= 5.0, rc <= 15.0, rc <= 30.0, rc <= 60.0],
        [0, 1, 2, 3],
        default=4,
    ).astype(np.uint8)
    encoded = np.asarray([0, 64, 128, 191, 255], dtype=np.uint8)[class_index]
    pack_atlas(encoded, DATA_DIR / "hardness_volume.png")

    colourmap = {
        "colours": [
            {"colour": "rgba(215,48,39,1.0)", "position": 0.0},
            {"colour": "rgba(252,141,89,1.0)", "position": 0.25},
            {"colour": "rgba(254,224,139,1.0)", "position": 0.5},
            {"colour": "rgba(102,194,165,1.0)", "position": 0.75},
            {"colour": "rgba(69,117,180,1.0)", "position": 1.0},
        ]
    }
    nx, ny, nz = vp_meta["shape"]
    config = {
        "properties": {"background": "rgba(0,0,0,0)", "nogui": True},
        "objects": [{
            "name": "TSP rock hardness",
            "brightness": 0,
            "contrast": 1,
            "density": 5.0,
            "power": 1,
            "samples": 256,
            "colourmap": 0,
            "tricubicfilter": False,
            "volume": {
                "url": "hardness_volume.png?v=2",
                "res": [nx, ny, nz],
                "scale": [1, 1, 1],
                "autoscale": True,
            },
            "xmin": 0.01, "xmax": 0.99,
            "ymin": 0.01, "ymax": 0.99,
            "zmin": 0.01, "zmax": 0.99,
        }],
        "colourmaps": [colourmap],
        "views": [{"axes": False, "border": False, "rotate": [0, 0, 0, 0], "translate": [0, 0, 0, 0]}],
    }
    (DATA_DIR / "hardness.json").write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")

    counts = np.bincount(class_index.ravel(), minlength=5)
    total = int(class_index.size)
    categories = []
    for definition, count in zip(CLASSES, counts):
        categories.append({
            **definition,
            "voxelCount": int(count),
            "percentage": round(float(count) / total * 100.0, 2),
        })
    metadata["channels"]["hardness"] = {
        "configUrl": "/data/tsp_actual/hardness.json?v=2",
        "textureUrl": "/data/tsp_actual/hardness_volume.png?v=2",
        "valueRange": [float(rc.min()), float(rc.max())],
        "unit": "MPa",
        "shape": vp_meta["shape"],
        "voxelCount": total,
        "voxelSize": vp_meta["voxelSize"],
        "coordinateRange": vp_meta["coordinateRange"],
        "densityRange": [float(rho.min()), float(rho.max())],
        "dynamicModulusRange": [float(ed.min()), float(ed.max())],
        "categories": categories,
        "formula": {
            "density": "ρ = 0.7(VpVs)^0.08",
            "dynamicModulus": "ED = ρVs²(3Vp²−4Vs²)/(Vp²−Vs²)",
            "ucs": "Rc = 7.1718ED^0.6062",
        },
        "note": "经验关系用于估计空间变化，不能代替岩样试验。",
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(metadata["channels"]["hardness"], ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
