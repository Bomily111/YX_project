"""Build tunnel-overlay volume assets from the comprehensive geophysical TEM field."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "tem_voxel_full.csv"
OUTPUT = ROOT / "public" / "data" / "geophysical_tem"
LOW_RESISTIVITY_THRESHOLD = 570.0
DISPLAY_PERCENTILES = (2.0, 98.0)


def pack_slices(volume: np.ndarray) -> Image.Image:
    """Pack Z slices into a square atlas expected by ShareVolume."""
    nx, ny, nz = volume.shape
    columns = int(np.ceil(np.sqrt(nz)))
    rows = int(np.ceil(nz / columns))
    atlas = np.zeros((rows * ny, columns * nx), dtype=np.uint8)
    for zi in range(nz):
        row, column = divmod(zi, columns)
        atlas[row * ny:(row + 1) * ny, column * nx:(column + 1) * nx] = volume[:, :, zi].T
    return Image.fromarray(atlas, mode="L")


def volume_config(
    name: str,
    image_name: str,
    shape: list[int],
    colours: list[dict],
    density: float,
    contrast: float = 1.0,
) -> dict:
    return {
        "properties": {"background": "rgba(0,0,0,0)", "nogui": True},
        "objects": [{
            "name": name,
            "brightness": 0,
            "contrast": contrast,
            "density": density,
            "power": 1.2,
            "samples": 256,
            "colourmap": 0,
            "tricubicfilter": True,
            "volume": {"url": image_name, "res": shape, "scale": [1, 1, 1], "autoscale": True},
            "xmin": 0.01, "xmax": 0.99,
            "ymin": 0.01, "ymax": 0.99,
            "zmin": 0.01, "zmax": 0.99,
        }],
        "colourmaps": [{"colours": colours}],
        "views": [{"axes": False, "border": False, "rotate": [0, 0, 0, 0], "translate": [0, 0, 0, 0]}],
    }


def main() -> None:
    points = np.loadtxt(SOURCE, delimiter=",", skiprows=1, dtype=np.float32)
    xs, ys, zs = (np.unique(points[:, axis]) for axis in range(3))
    shape = [len(xs), len(ys), len(zs)]
    expected = int(np.prod(shape))
    if len(points) != expected:
        raise ValueError(f"Source is not a complete regular grid: {len(points)} != {expected}")

    resistivity = points[:, 3].reshape(shape)
    value_min = float(resistivity.min())
    value_max = float(resistivity.max())
    # Use a robust display stretch so sparse extrema do not compress most of
    # the field into a narrow teal band. Source values and interpretation
    # thresholds remain untouched; this only controls voxel colour encoding.
    display_min, display_max = np.percentile(resistivity, DISPLAY_PERCENTILES)
    normalized = np.clip((resistivity - display_min) / (display_max - display_min), 0, 1)
    resistivity_u8 = np.round(1 + normalized * 254).astype(np.uint8)
    water_u8 = np.where(resistivity < LOW_RESISTIVITY_THRESHOLD, 255, 0).astype(np.uint8)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    pack_slices(resistivity_u8).save(OUTPUT / "resistivity_contrast_volume.png", optimize=True)
    pack_slices(water_u8).save(OUTPUT / "water_volume.png", optimize=True)

    # Keep the comprehensive workbench Viridis family, but give the low end
    # enough opacity and separate the stops more decisively for tunnel overlay.
    viridis = [
        {"colour": "rgba(68,1,84,0.22)", "position": 0.0},
        {"colour": "rgba(55,62,142,0.25)", "position": 0.20},
        {"colour": "rgba(24,146,153,0.29)", "position": 0.46},
        {"colour": "rgba(83,206,103,0.34)", "position": 0.72},
        {"colour": "rgba(253,231,37,0.39)", "position": 1.0},
    ]
    water_colours = [
        {"colour": "rgba(0,0,0,0.0)", "position": 0.0},
        {"colour": "rgba(0,0,0,0.0)", "position": 0.49},
        {"colour": "rgba(22,185,255,0.16)", "position": 0.5},
        {"colour": "rgba(22,185,255,0.34)", "position": 1.0},
    ]
    (OUTPUT / "resistivity_contrast.json").write_text(
        json.dumps(volume_config("TEM apparent resistivity", "resistivity_contrast_volume.png", shape, viridis, 2.8, 1.35), ensure_ascii=False),
        encoding="utf-8",
    )
    (OUTPUT / "water.json").write_text(
        json.dumps(volume_config("TEM water-rich anomaly", "water_volume.png", shape, water_colours, 4.2), ensure_ascii=False),
        encoding="utf-8",
    )

    water_count = int(np.count_nonzero(water_u8))
    water_points = points[resistivity.ravel() < LOW_RESISTIVITY_THRESHOLD, :3]
    metadata = {
        "source": "data/tem_voxel_full.csv",
        "coordinateSystem": "TEM local: X forward, Y transverse, Z elevation",
        "shape": shape,
        "voxelSize": [float(np.median(np.diff(axis))) for axis in (xs, ys, zs)],
        "bounds": {"min": [float(xs[0]), float(ys[0]), float(zs[0])], "max": [float(xs[-1]), float(ys[-1]), float(zs[-1])]},
        "resistivity": {
            "count": len(points),
            "valueRange": [value_min, value_max],
            "displayRange": [float(display_min), float(display_max)],
            "displayStretch": f"P{DISPLAY_PERCENTILES[0]:g}–P{DISPLAY_PERCENTILES[1]:g}",
            "unit": "Ω·m",
        },
        "water": {
            "rule": "ρs < 570 Ω·m",
            "threshold": LOW_RESISTIVITY_THRESHOLD,
            "count": water_count,
            "percentage": water_count / len(points) * 100,
            "bounds": {"min": water_points.min(axis=0).tolist(), "max": water_points.max(axis=0).tolist()},
        },
        "outputs": {"resistivity": "resistivity_contrast.json", "water": "water.json"},
    }
    (OUTPUT / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Built {shape} TEM volume: {len(points):,} voxels, {water_count:,} water-rich")


if __name__ == "__main__":
    main()
