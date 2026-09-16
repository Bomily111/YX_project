#!/usr/bin/env python3
"""Convert regular-grid TSP VP/VS CSV files to ShareVolume texture atlases."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt


COLOURMAP = {
    "colours": [
        {"colour": "rgba(0,0,255,1.0)", "position": 0.0},
        {"colour": "rgba(255,255,255,1.0)", "position": 0.5},
        {"colour": "rgba(255,0,0,1.0)", "position": 1.0},
    ]
}


def read_csv(path: Path) -> np.ndarray:
    first_line = path.open("r", encoding="utf-8-sig").readline()
    skip_rows = 1 if any(char.isalpha() for char in first_line) else 0
    return np.loadtxt(path, delimiter=",", skiprows=skip_rows, dtype=np.float32)


def build_channel(csv_path: Path, output_dir: Path, key: str) -> dict:
    data = read_csv(csv_path)
    if data.ndim != 2 or data.shape[1] < 4:
        raise ValueError(f"{csv_path} must contain x,y,z,value columns")

    x_values = np.unique(data[:, 0])
    y_values = np.unique(data[:, 1])
    z_values = np.unique(data[:, 2])
    nx, ny, nz = len(x_values), len(y_values), len(z_values)
    expected = nx * ny * nz

    x_index = np.rint((data[:, 0] - x_values[0]) / (x_values[1] - x_values[0])).astype(np.int32)
    y_index = np.rint((data[:, 1] - y_values[0]) / (y_values[1] - y_values[0])).astype(np.int32)
    z_index = np.rint((data[:, 2] - z_values[0]) / (z_values[1] - z_values[0])).astype(np.int32)

    values = data[:, 3]
    value_min = float(values.min())
    value_max = float(values.max())
    volume_values = np.full((nz, ny, nx), np.nan, dtype=np.float32)
    volume_values[z_index, y_index, x_index] = values
    missing = np.isnan(volume_values)
    valid_count = int(np.count_nonzero(~missing))
    if missing.any():
        nearest = distance_transform_edt(missing, return_distances=False, return_indices=True)
        volume_values[missing] = volume_values[tuple(nearest[:, missing])]
    volume = np.rint((volume_values - value_min) / (value_max - value_min) * 255).astype(np.uint8)

    tiles_x = math.ceil(math.sqrt(nz * ny / nx))
    tiles_y = math.ceil(nz / tiles_x)
    atlas = np.zeros((tiles_y * ny, tiles_x * nx), dtype=np.uint8)
    for z in range(nz):
        tile_x = z % tiles_x
        tile_y = z // tiles_x
        atlas[tile_y * ny:(tile_y + 1) * ny, tile_x * nx:(tile_x + 1) * nx] = volume[z]

    texture_name = f"{key}_volume.png"
    Image.fromarray(atlas, mode="L").save(output_dir / texture_name, compress_level=4)

    config = {
        "properties": {"background": "rgba(0,0,0,0)", "nogui": True},
        "objects": [{
            "name": f"TSP {key.upper()}",
            "brightness": 0,
            "contrast": 1,
            "density": 3.5,
            "power": 1,
            "samples": 256,
            "colourmap": 0,
            "tricubicfilter": True,
            "volume": {
                "url": texture_name,
                "res": [nx, ny, nz],
                "scale": [1, 1, 1],
                "autoscale": True,
            },
            "xmin": 0.01, "xmax": 0.99,
            "ymin": 0.01, "ymax": 0.99,
            "zmin": 0.01, "zmax": 0.99,
        }],
        "colourmaps": [COLOURMAP],
        "views": [{"axes": False, "border": False, "rotate": [0, 0, 0, 0], "translate": [0, 0, 0, 0]}],
    }
    (output_dir / f"{key}.json").write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")

    return {
        "configUrl": f"/data/tsp_actual/{key}.json",
        "textureUrl": f"/data/tsp_actual/{texture_name}",
        "valueRange": [value_min, value_max],
        "unit": "m/s",
        "shape": [nx, ny, nz],
        "voxelCount": int(expected),
        "sourceSampleCount": valid_count,
        "filledVoxelCount": int(expected - valid_count),
        "coordinateRange": {
            "x": [float(x_values[0]), float(x_values[-1])],
            "y": [float(y_values[0]), float(y_values[-1])],
            "z": [float(z_values[0]), float(z_values[-1])],
        },
        "voxelSize": [
            float(x_values[1] - x_values[0]),
            float(y_values[1] - y_values[0]),
            float(z_values[1] - z_values[0]),
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vp", required=True, type=Path)
    parser.add_argument("--vs", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    channels = {
        "vp": build_channel(args.vp, args.output, "vp"),
        "vs": build_channel(args.vs, args.output, "vs"),
    }
    metadata = {
        "schemaVersion": "1.0",
        "source": "地震波反射.html / Vp.csv / Vs.csv",
        "report": {
            "projectName": "康定2号隧道2#斜井",
            "forecastDate": "2022-06-05",
            "faceMileage": "X1DK2+937.0",
            "forecastRange": "X1DK2+937.0～X1DK2+837.0",
            "detectionLength": 100.0,
            "device": "TSP303",
            "shotSpacing": 2.5,
            "shotCount": 24,
            "summary": "预报段围岩总体为较完整～较破碎，节理裂隙较发育，存在沿裂隙线状或股状出水。",
        },
        "channels": channels,
    }
    (args.output / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
