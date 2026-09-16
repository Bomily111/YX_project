"""Build the prediction-stage fused rock-grade volume from TEM + TSP data."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.interpolate import RegularGridInterpolator

from build_geophysical_tem_volumes import pack_slices, volume_config


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "geophysical_grade"
TEM_SOURCE = ROOT / "data" / "tem_voxel_full.csv"
VP_SOURCE = ROOT / "data" / "Vp.csv"
VS_SOURCE = ROOT / "data" / "Vs.csv"


def sample_tsp(path: Path, targets: np.ndarray) -> np.ndarray:
    frame = pd.read_csv(path, dtype=np.float32)
    columns = list(frame.columns)
    xs = np.sort(frame[columns[0]].unique())
    ys = np.sort(frame[columns[1]].unique())
    zs = np.sort(frame[columns[2]].unique())
    grid = np.full((len(xs), len(ys), len(zs)), np.nan, dtype=np.float32)
    xi = np.searchsorted(xs, frame[columns[0]].to_numpy())
    yi = np.searchsorted(ys, frame[columns[1]].to_numpy())
    zi = np.searchsorted(zs, frame[columns[2]].to_numpy())
    grid[xi, yi, zi] = frame[columns[3]].to_numpy()
    interpolator = RegularGridInterpolator(
        (xs, ys, zs), grid, method="linear", bounds_error=False, fill_value=np.nan,
    )
    return interpolator(targets).astype(np.float32)


def main() -> None:
    tem = np.loadtxt(TEM_SOURCE, delimiter=",", skiprows=1, dtype=np.float32)
    axes = [np.unique(tem[:, axis]) for axis in range(3)]
    shape = [len(axis) for axis in axes]
    if len(tem) != int(np.prod(shape)):
        raise ValueError("TEM source is not a complete regular grid")

    # Same axis semantics as modules/geophysical/model.ts:
    # TEM(x forward, y transverse, z elevation) -> TSP(x transverse,
    # y first section + forward, z elevation).
    first_tsp_section = 26.0
    targets = np.column_stack((tem[:, 1], first_tsp_section + tem[:, 0], tem[:, 2])).astype(np.float32)
    vp = sample_tsp(VP_SOURCE, targets)
    vs = sample_tsp(VS_SOURCE, targets)
    rho = tem[:, 3]
    valid = np.isfinite(vp) & np.isfinite(vs) & (vp > 0) & (vs > 0)
    ratio = np.divide(vp, vs, out=np.full_like(vp, np.nan), where=valid)

    grades = np.zeros(len(tem), dtype=np.uint8)
    grades[valid & (ratio < 1.7)] = 2
    grades[valid & (ratio >= 1.7) & (ratio < 2.0)] = 3
    grades[valid & (ratio >= 2.0)] = 4
    low_resistivity = valid & (rho < 570.0)
    grades[low_resistivity] = np.minimum(5, grades[low_resistivity] + 1)

    encoded = np.zeros_like(grades)
    for grade, value in ((2, 64), (3, 128), (4, 192), (5, 255)):
        encoded[grades == grade] = value

    OUTPUT.mkdir(parents=True, exist_ok=True)
    colours = [
        {"colour": "rgba(0,0,0,0)", "position": 0.0},
        {"colour": "rgba(0,0,0,0)", "position": 0.20},
        {"colour": "rgba(90,159,198,0.34)", "position": 0.245},
        {"colour": "rgba(90,159,198,0.34)", "position": 0.255},
        {"colour": "rgba(36,75,120,0.38)", "position": 0.495},
        {"colour": "rgba(36,75,120,0.38)", "position": 0.505},
        {"colour": "rgba(232,189,53,0.42)", "position": 0.745},
        {"colour": "rgba(232,189,53,0.42)", "position": 0.755},
        {"colour": "rgba(143,63,32,0.46)", "position": 0.995},
        {"colour": "rgba(143,63,32,0.46)", "position": 1.0},
    ]
    def write_volume(name: str, values: np.ndarray) -> None:
        image_name = f"fused_rock_grade_{name}_volume.png"
        pack_slices(values.reshape(shape)).save(OUTPUT / image_name, optimize=True)
        config = volume_config(
            f"Fused geophysical rock grade ({name})", image_name, shape, colours, 4.0, 1.1,
        )
        config["objects"][0]["tricubicfilter"] = False
        (OUTPUT / f"fused_rock_grade_{name}.json").write_text(
            json.dumps(config, ensure_ascii=False), encoding="utf-8",
        )

    # Prebuild every visibility combination. ShareVolume uses one global colour map,
    # so masked atlases make arbitrary multi-select grade filtering deterministic.
    for mask in range(16):
        enabled = [grade for bit, grade in enumerate(range(2, 6)) if mask & (1 << bit)]
        name = "".join(str(grade) for grade in enabled) or "none"
        masked = np.where(np.isin(grades, enabled), encoded, 0).astype(np.uint8)
        write_volume(name, masked)

    # Keep the original names for existing links and external integrations.
    pack_slices(encoded.reshape(shape)).save(OUTPUT / "fused_rock_grade_volume.png", optimize=True)
    compatibility_config = volume_config(
        "Fused geophysical rock grade", "fused_rock_grade_volume.png", shape, colours, 4.0, 1.1,
    )
    compatibility_config["objects"][0]["tricubicfilter"] = False
    (OUTPUT / "fused_rock_grade.json").write_text(
        json.dumps(compatibility_config, ensure_ascii=False), encoding="utf-8",
    )

    counts = {str(grade): int(np.count_nonzero(grades == grade)) for grade in range(2, 6)}

    # Reduce the fused volume to a longitudinal prediction profile for the
    # design / prediction / observed comparison strip.  The scene stretches
    # the source x range onto the report's 100 m forecast interval
    # YK2+244--YK2+344 (see GeoModelController.ts), so use the same mapping
    # here instead of treating the source-grid x values as chainage metres.
    grade_grid = grades.reshape(shape)
    axial_grades: list[int] = []
    for x_index in range(shape[0]):
        classified = grade_grid[x_index][grade_grid[x_index] > 0]
        if classified.size == 0:
            axial_grades.append(0)
            continue
        axial_grades.append(int(np.bincount(classified, minlength=6).argmax()))

    forecast_start = 2244.0
    forecast_end = 2344.0
    cell_edges = np.linspace(forecast_start, forecast_end, shape[0] + 1)
    axial_segments = []
    segment_start = 0
    for index in range(1, len(axial_grades) + 1):
        if index < len(axial_grades) and axial_grades[index] == axial_grades[segment_start]:
            continue
        grade = axial_grades[segment_start]
        axial_segments.append({
            "start": round(float(cell_edges[segment_start]), 3),
            "end": round(float(cell_edges[index]), 3),
            "grade": str(grade) if grade else None,
        })
        segment_start = index

    metadata = {
        "sources": ["data/tem_voxel_full.csv", "data/Vp.csv", "data/Vs.csv"],
        "shape": shape,
        "classified": int(np.count_nonzero(grades)),
        "rejectedDuringAlignment": int(np.count_nonzero(~valid)),
        "gradeCounts": counts,
        "rule": "Vp/Vs < 1.7 => II; < 2.0 => III; otherwise IV; rho < 570 Ω·m degrades one class",
        "colours": {"2": "#5a9fc6", "3": "#244b78", "4": "#e8bd35", "5": "#8f3f20"},
        "axialProfile": {
            "method": "cross-section majority grade",
            "mileageRange": [forecast_start, forecast_end],
            "mileagePrefix": "YK",
            "segments": axial_segments,
        },
    }
    (OUTPUT / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Built fused grade volume {shape}: {metadata['classified']:,} classified, {counts}")


if __name__ == "__main__":
    main()
