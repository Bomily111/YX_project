#!/usr/bin/env python3
"""Build TSP combination, anomaly and integrity-indicator voxel layers."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter

from generate_tsp_hardness import DATA_DIR, pack_atlas, unpack_atlas


ROOT = Path(__file__).resolve().parents[1]
MILEAGE_START = 2244.0
MILEAGE_LENGTH = 100.0


def robust_scale(values: np.ndarray, low_q: float, high_q: float) -> tuple[np.ndarray, list[float]]:
    low, high = (float(v) for v in np.percentile(values, [low_q, high_q]))
    scaled = np.clip((values - low) / max(high - low, 1e-6), 0.0, 1.0)
    return scaled.astype(np.float32), [low, high]


def write_volume_config(
    key: str,
    name: str,
    shape: list[int],
    volume: np.ndarray,
    colours: list[dict],
    density: float = 4.0,
    discrete: bool = False,
) -> None:
    pack_atlas(volume, DATA_DIR / f"{key}_volume.png")
    nx, ny, nz = shape
    config = {
        "properties": {"background": "rgba(0,0,0,0)", "nogui": True},
        "objects": [{
            "name": name,
            "brightness": 0,
            "contrast": 1,
            "density": density,
            "power": 1,
            "samples": 256,
            "colourmap": 0,
            "tricubicfilter": not discrete,
            "volume": {
                "url": f"{key}_volume.png?v=1",
                "res": [nx, ny, nz],
                "scale": [1, 1, 1],
                "autoscale": True,
            },
            "xmin": 0.01, "xmax": 0.99,
            "ymin": 0.01, "ymax": 0.99,
            "zmin": 0.01, "zmax": 0.99,
        }],
        "colourmaps": [{"colours": colours}],
        "views": [{"axes": False, "border": False, "rotate": [0, 0, 0, 0], "translate": [0, 0, 0, 0]}],
    }
    (DATA_DIR / f"{key}.json").write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")


def mileage_label(value: float) -> str:
    km = int(value // 1000)
    metres = value - km * 1000
    return f"YK{km}+{metres:06.2f}"


def identify_anomaly_zones(
    anomaly: np.ndarray,
    components: dict[str, np.ndarray],
    coordinate_range: dict,
) -> list[dict]:
    # A robust longitudinal trace: upper-decile anomaly intensity per cross-section.
    trace = np.percentile(anomaly, 90, axis=(0, 2))
    active = trace >= 0.55
    runs: list[tuple[int, int]] = []
    start = None
    for index, flag in enumerate(active):
        if flag and start is None:
            start = index
        if start is not None and (not flag or index == len(active) - 1):
            end = index if flag and index == len(active) - 1 else index - 1
            if end - start + 1 >= 4:
                runs.append((start, end))
            start = None

    x0, x1 = coordinate_range["x"]
    z0, z1 = coordinate_range["z"]
    nz, ny, nx = anomaly.shape
    zones = []
    for number, (yi0, yi1) in enumerate(runs, start=1):
        block = anomaly[:, yi0:yi1 + 1, :]
        mask = block >= 0.55
        zz, yy, xx = np.where(mask)
        if len(xx) == 0:
            continue
        scores = {key: float(value[:, yi0:yi1 + 1, :][mask].mean()) for key, value in components.items()}
        dominant = max(scores, key=scores.get)
        labels = {
            "lowVelocity": "低波速区",
            "velocityMutation": "波速突变区",
            "strongGradient": "强速度梯度区",
            "ratioAnomaly": "VP/VS组合异常区",
        }
        start_distance = yi0 / (ny - 1) * MILEAGE_LENGTH
        end_distance = yi1 / (ny - 1) * MILEAGE_LENGTH
        zones.append({
            "id": f"TSP-A{number:02d}",
            "type": labels[dominant],
            "startMileage": mileage_label(MILEAGE_START + start_distance),
            "endMileage": mileage_label(MILEAGE_START + end_distance),
            "distanceFromFace": [round(start_distance, 2), round(end_distance, 2)],
            "spatialRange": {
                "x": [round(x0 + xx.min() / (nx - 1) * (x1 - x0), 2), round(x0 + xx.max() / (nx - 1) * (x1 - x0), 2)],
                "z": [round(z0 + zz.min() / (nz - 1) * (z1 - z0), 2), round(z0 + zz.max() / (nz - 1) * (z1 - z0), 2)],
            },
            "intensity": round(float(block[mask].mean()), 3),
            "peakIntensity": round(float(block.max()), 3),
            "componentScores": {key: round(value, 3) for key, value in scores.items()},
        })
    return zones


def main() -> None:
    metadata_path = DATA_DIR / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    vp_meta, vs_meta = metadata["channels"]["vp"], metadata["channels"]["vs"]
    if vp_meta["shape"] != vs_meta["shape"]:
        raise ValueError("VP and VS voxel grids must have identical shapes")

    vp = unpack_atlas(DATA_DIR / "vp_volume.png", vp_meta["shape"], vp_meta["valueRange"])
    vs = unpack_atlas(DATA_DIR / "vs_volume.png", vs_meta["shape"], vs_meta["valueRange"])
    shape = vp_meta["shape"]
    spacing_xyz = vp_meta["voxelSize"]
    spacing_zyx = (spacing_xyz[2], spacing_xyz[1], spacing_xyz[0])

    vp_s = gaussian_filter(vp, sigma=1.0)
    vs_s = gaussian_filter(vs, sigma=1.0)
    ratio = vp_s / np.maximum(vs_s, 1e-6)

    # Low-velocity score: joint VP/VS deficit relative to the median and lower quintile.
    vp20, vp50 = (float(v) for v in np.percentile(vp_s, [20, 50]))
    vs20, vs50 = (float(v) for v in np.percentile(vs_s, [20, 50]))
    low_vp = np.clip((vp50 - vp_s) / max(vp50 - vp20, 1e-6), 0.0, 1.0)
    low_vs = np.clip((vs50 - vs_s) / max(vs50 - vs20, 1e-6), 0.0, 1.0)
    low_velocity = (0.6 * low_vp + 0.4 * low_vs).astype(np.float32)

    # Strong-gradient score: combined physical gradient magnitude of smoothed VP and VS.
    vp_grad = np.sqrt(sum(component ** 2 for component in np.gradient(vp_s, *spacing_zyx)))
    vs_grad = np.sqrt(sum(component ** 2 for component in np.gradient(vs_s, *spacing_zyx)))
    vp_grad_s, vp_grad_thresholds = robust_scale(vp_grad, 85, 99)
    vs_grad_s, vs_grad_thresholds = robust_scale(vs_grad, 85, 99)
    strong_gradient = np.maximum(vp_grad_s, vs_grad_s)

    # Mutation score: local departure from a broader (3-voxel sigma) velocity background.
    vp_mutation_raw = np.abs(vp_s - gaussian_filter(vp_s, sigma=3.0))
    vs_mutation_raw = np.abs(vs_s - gaussian_filter(vs_s, sigma=3.0))
    vp_mutation, vp_mutation_thresholds = robust_scale(vp_mutation_raw, 85, 99)
    vs_mutation, vs_mutation_thresholds = robust_scale(vs_mutation_raw, 85, 99)
    velocity_mutation = np.maximum(vp_mutation, vs_mutation)

    # VP/VS combination anomaly: robust deviation from the global median ratio.
    ratio_median = float(np.median(ratio))
    ratio_deviation = np.abs(ratio - ratio_median)
    ratio_anomaly, ratio_thresholds = robust_scale(ratio_deviation, 85, 99)

    anomaly = np.clip(
        0.40 * low_velocity
        + 0.25 * velocity_mutation
        + 0.25 * strong_gradient
        + 0.10 * ratio_anomaly,
        0.0,
        1.0,
    ).astype(np.float32)
    integrity = (1.0 - anomaly).astype(np.float32)

    ratio_encoded = np.rint((ratio - ratio.min()) / max(float(ratio.max() - ratio.min()), 1e-6) * 255).astype(np.uint8)
    anomaly_encoded = np.rint(anomaly * 255).astype(np.uint8)
    integrity_class = np.select(
        [integrity < 0.2, integrity < 0.4, integrity < 0.6, integrity < 0.8],
        [0, 1, 2, 3],
        default=4,
    ).astype(np.uint8)
    integrity_encoded = np.asarray([0, 64, 128, 191, 255], dtype=np.uint8)[integrity_class]

    blue_red = [
        {"colour": "rgba(49,54,149,1.0)", "position": 0.0},
        {"colour": "rgba(255,255,191,1.0)", "position": 0.5},
        {"colour": "rgba(165,0,38,1.0)", "position": 1.0},
    ]
    green_red = [
        {"colour": "rgba(40,160,90,1.0)", "position": 0.0},
        {"colour": "rgba(255,220,70,1.0)", "position": 0.5},
        {"colour": "rgba(220,45,35,1.0)", "position": 1.0},
    ]
    integrity_colours = [
        {"colour": "rgba(215,48,39,1.0)", "position": 0.0},
        {"colour": "rgba(252,141,89,1.0)", "position": 0.25},
        {"colour": "rgba(254,224,139,1.0)", "position": 0.5},
        {"colour": "rgba(102,194,165,1.0)", "position": 0.75},
        {"colour": "rgba(43,131,186,1.0)", "position": 1.0},
    ]
    write_volume_config("vp_vs_ratio", "TSP VP/VS combination", shape, ratio_encoded, blue_red)
    write_volume_config("tsp_anomaly", "TSP anomaly indicator", shape, anomaly_encoded, green_red)
    write_volume_config("integrity", "TSP integrity indicator", shape, integrity_encoded, integrity_colours, density=5.0, discrete=True)

    counts = np.bincount(integrity_class.ravel(), minlength=5)
    total = int(integrity_class.size)
    class_defs = [
        ("extremely_fractured", "极破碎", "I < 0.2", "#d73027"),
        ("fractured", "破碎", "0.2 ≤ I < 0.4", "#fc8d59"),
        ("relatively_fractured", "较破碎", "0.4 ≤ I < 0.6", "#fee08b"),
        ("relatively_intact", "较完整", "0.6 ≤ I < 0.8", "#66c2a5"),
        ("intact", "完整", "I ≥ 0.8", "#2b83ba"),
    ]
    categories = [
        {"key": key, "label": label, "rule": rule, "color": color,
         "voxelCount": int(count), "percentage": round(int(count) / total * 100.0, 2)}
        for (key, label, rule, color), count in zip(class_defs, counts)
    ]
    components = {
        "lowVelocity": low_velocity,
        "velocityMutation": velocity_mutation,
        "strongGradient": strong_gradient,
        "ratioAnomaly": ratio_anomaly,
    }
    zones = identify_anomaly_zones(anomaly, components, vp_meta["coordinateRange"])

    common = {
        "shape": shape,
        "voxelCount": total,
        "voxelSize": spacing_xyz,
        "coordinateRange": vp_meta["coordinateRange"],
    }
    metadata["channels"]["ratio"] = {
        **common,
        "configUrl": "/data/tsp_actual/vp_vs_ratio.json?v=1",
        "textureUrl": "/data/tsp_actual/vp_vs_ratio_volume.png?v=1",
        "valueRange": [float(ratio.min()), float(ratio.max())],
        "unit": "VP/VS",
        "description": "纵横波速度组合指标 VP/VS。",
    }
    metadata["channels"]["anomaly"] = {
        **common,
        "configUrl": "/data/tsp_actual/tsp_anomaly.json?v=1",
        "textureUrl": "/data/tsp_actual/tsp_anomaly_volume.png?v=1",
        "valueRange": [0.0, 1.0],
        "unit": "异常指数",
        "description": "低波速、波速突变、强速度梯度和VP/VS异常的加权组合。",
        "weights": {"lowVelocity": 0.40, "velocityMutation": 0.25, "strongGradient": 0.25, "ratioAnomaly": 0.10},
        "anomalyZones": zones,
    }
    metadata["channels"]["integrity"] = {
        **common,
        "configUrl": "/data/tsp_actual/integrity.json?v=1",
        "textureUrl": "/data/tsp_actual/integrity_volume.png?v=1",
        "valueRange": [float(integrity.min()), float(integrity.max())],
        "unit": "完整程度指示 I",
        "description": "I=1−异常指数；属于TSP波速解释指标，不等同于规范岩体完整性系数Kv。",
        "categories": categories,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    feature_layer = {
        "schemaVersion": "1.0",
        "source": metadata["source"],
        "method": {
            "combination": "VP/VS",
            "anomalyIndicator": "0.40×低波速 + 0.25×波速突变 + 0.25×强速度梯度 + 0.10×VP/VS异常",
            "integrityIndicator": "I = 1 − 异常指数",
            "thresholdMethod": "数据分位数自适应",
        },
        "thresholds": {
            "lowVelocity": {"vpP20P50": [vp20, vp50], "vsP20P50": [vs20, vs50]},
            "strongGradient": {"vpP85P99": vp_grad_thresholds, "vsP85P99": vs_grad_thresholds},
            "velocityMutation": {"vpP85P99": vp_mutation_thresholds, "vsP85P99": vs_mutation_thresholds},
            "ratioDeviationP85P99": ratio_thresholds,
        },
        "featureRanges": {
            "vpVsRatio": [float(ratio.min()), float(ratio.max())],
            "anomalyIndicator": [float(anomaly.min()), float(anomaly.max())],
            "integrityIndicator": [float(integrity.min()), float(integrity.max())],
        },
        "integrityCategories": categories,
        "anomalyZones": zones,
    }
    (DATA_DIR / "tsp_feature_layer.json").write_text(
        json.dumps(feature_layer, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"zones": len(zones), "categories": categories}, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
