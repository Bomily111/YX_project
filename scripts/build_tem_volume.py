#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
  TEM 3D Voxel Model — .dat-Calibrated Pipeline
=============================================================================

  1. Parse .dat files → exact 3D scattered points (coordinateTransform.ts formulas)
  2. Extract dense PNG pixels with per-beam delta calibration
  3. Merge .dat + calibrated PNG → scattered point cloud
  4. 3D IDW voxelization (k=32, max_dist=25m, power=2.5)
  5. Gaussian smooth → normalize → export raw + PNG atlas + JSON

  Input:  public/data/TEM/1/线[1-4].dat  +  线[1-4].png
  Output: public/data/tem_new/tem_volume.raw  (128^3 uint8, 2 MB)
          public/data/tem_new/tem_volume.png  (PNG slice atlas)
          public/data/tem_new/tem_model.json  (LavaVu config)
=============================================================================
"""

import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter
from PIL import Image
import argparse, json, math, os, sys, time

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

DEG = math.pi / 180.0

PROFILE_FILES = ['线1.dat', '线2.dat', '线3.dat', '线4.dat']
PNG_FILES     = ['线1.png', '线2.png', '线3.png', '线4.png']
PROFILE_NAMES = ['线1 (上仰30°)', '线2 (水平)',   '线3 (下俯30°)', '线4 (垂向)']

BETA_FIXED   = [30.0, 0.0, -30.0]
ALPHA_FIXED  = 90.0


# ====================================================================
#  Coordinate transform — matches src/utils/TEM/coordinateTransform.ts
# ====================================================================

def lid_to_angles(profile_idx, line_id):
    """Convert (profile_index, LineID) → (alpha_deg, beta_deg)."""
    if profile_idx == 3:
        return ALPHA_FIXED, 60.0 - (line_id - 1) * 15.0
    else:
        return 150.0 - (line_id - 1) * 15.0, BETA_FIXED[profile_idx]


def spherical_to_cartesian(R, alpha_deg, beta_deg):
    """R, azimuth, elevation → (x, y, z). +X=forward, +Y=right, +Z=up."""
    a = alpha_deg * DEG
    b = beta_deg * DEG
    cb = math.cos(b)
    return (R * cb * math.cos(a), R * cb * math.sin(a), R * math.sin(b))


def parse_dat_file(dat_path, profile_idx):
    """Parse .dat → (M, 4) array [x, y, z, V_ohm]."""
    pts = []
    with open(dat_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            parts = line.split('\t')
            if len(parts) < 3: continue
            lid = int(float(parts[0]))
            R = float(parts[1])
            V = float(parts[2])
            if not (1 <= lid <= 9 and R > 0): continue
            alpha, beta = lid_to_angles(profile_idx, lid)
            x, y, z = spherical_to_cartesian(R, alpha, beta)
            pts.append([x, y, z, V])
    return np.array(pts, dtype=np.float64)


# ====================================================================
#  PNG extraction with per-beam calibration
# ====================================================================

def rgb_to_hue(rgb):
    """rgb (N,3) float64 → hue (N,) [0,360)."""
    r, g, b = rgb[:, 0] / 255.0, rgb[:, 1] / 255.0, rgb[:, 2] / 255.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    delta = mx - mn
    hue = np.full(len(rgb), np.nan)
    m = (mx == r) & (delta > 1e-6)
    hue[m] = 60.0 * np.fmod((g[m] - b[m]) / delta[m], 6.0)
    m = (mx == g) & (delta > 1e-6) & ~(mx == r)
    hue[m] = 60.0 * ((b[m] - r[m]) / delta[m] + 2.0)
    m = (mx == b) & (delta > 1e-6) & ~(mx == r) & ~(mx == g)
    hue[m] = 60.0 * ((r[m] - g[m]) / delta[m] + 4.0)
    return np.fmod(hue + 360.0, 360.0)


def extract_profile_dense(png_path, dat_path, profile_idx, sub_sample=2):
    """
    Extract dense calibrated (x,y,z,V) from a profile.
    Per-beam mean delta calibration.
    """
    # ── Parse .dat for calibration ──
    beam_deltas = {}
    beam_thetas = {}
    R_max = 65.0
    dat_list = []
    with open(dat_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            parts = line.split('\t')
            if len(parts) < 3: continue
            lid = int(float(parts[0])); R = float(parts[1]); V = float(parts[2])
            if not (1 <= lid <= 9): continue
            if R > R_max: R_max = R
            alpha, beta = lid_to_angles(profile_idx, lid)
            th = alpha if profile_idx != 3 else 90.0 + beta
            beam_thetas[lid] = th
            dat_list.append((lid, R, th, V))
    R_max += 2.0

    # ── Read PNG ──
    im = np.array(Image.open(png_path))
    rgb = im[:, :, :3].astype(np.float64)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    rows, cols = np.where(sat > 25)
    if len(rows) == 0:
        return np.zeros((0, 4))
    r_min, r_max = rows.min(), rows.max()
    c_min, c_max = cols.min(), cols.max()

    # ── Compute per-beam deltas ──
    for lid in range(1, 10):
        if lid not in beam_thetas: continue
        th_b = beam_thetas[lid]
        col_frac = (150.0 - th_b) / 120.0
        col_b = int(round(c_min + col_frac * (c_max - c_min)))
        col_b = max(c_min, min(c_max, col_b))
        deltas = []
        for dlid, Rref, thref, Vtrue in dat_list:
            if dlid != lid: continue
            row_r = int(round(r_min + Rref / R_max * (r_max - r_min)))
            row_r = max(0, min(im.shape[0] - 1, row_r))
            p = rgb[row_r, col_b]; d = p.max() - p.min()
            if d < 25: continue
            h = rgb_to_hue(p.reshape(1, 3))[0]
            if np.isfinite(h):
                t = max(0, min(1, (240 - h) / 240)); Vp = 550 + t * 150
                deltas.append(Vtrue - Vp)
        if len(deltas) > 0:
            beam_deltas[lid] = np.mean(deltas)

    if beam_deltas:
        beam_lids = sorted(beam_deltas.keys())
        beam_ths = np.array([beam_thetas[l] for l in beam_lids])
        beam_ds = np.array([beam_deltas[l] for l in beam_lids])
        print(f'      {len(beam_deltas)} beams calibrated, mean delta={beam_ds.mean():+.1f} Ohm.m')
    else:
        beam_lids, beam_ths, beam_ds = [], np.array([]), np.array([])

    # ── Subsample pixels ──
    if sub_sample > 1:
        keep = (rows % sub_sample == 0) & (cols % sub_sample == 0)
        rows = rows[keep]; cols = cols[keep]
    n_px = len(rows)

    # ── Map pixel → (R, theta_equiv) ──
    px_R = (rows - r_min) / (r_max - r_min) * R_max
    px_th = 150.0 - (cols - c_min) / (c_max - c_min) * 120.0

    # Filter near origin
    valid = px_R > 0.5
    rows = rows[valid]; cols = cols[valid]
    px_R = px_R[valid]; px_th = px_th[valid]

    # ── Compute V_png from hue (vectorized) ──
    px_rgb = rgb[rows, cols]
    px_hue = rgb_to_hue(px_rgb.reshape(-1, 3))
    valid2 = np.isfinite(px_hue)
    px_R = px_R[valid2]; px_th = px_th[valid2]
    px_hue = px_hue[valid2]
    t = np.clip((240.0 - px_hue) / 240.0, 0, 1)
    px_V = 550.0 + t * 150.0

    # ── Apply per-beam delta calibration ──
    if len(beam_deltas) >= 3:
        d_theta = np.abs(px_th[:, None] - beam_ths[None, :])
        k_use = min(5, len(beam_lids))
        nearest = np.argpartition(d_theta, k_use - 1, axis=1)[:, :k_use]
        nearest_d = np.take_along_axis(d_theta, nearest, axis=1)
        nearest_delta = beam_ds[nearest]
        w = 1.0 / np.maximum(nearest_d, 1e-6)**2
        px_delta = (w * nearest_delta).sum(axis=1) / w.sum(axis=1)
    elif len(beam_deltas) > 0:
        px_delta = np.full(len(px_R), beam_ds.mean())
    else:
        px_delta = np.zeros(len(px_R))
    px_V = np.clip(px_V + px_delta, 550.0, 710.0)

    # ── Convert to 3D Cartesian ──
    n = len(px_R)
    xyzV = np.zeros((n, 4), dtype=np.float64)
    for i in range(n):
        R = px_R[i]; th = px_th[i]
        if profile_idx == 3:
            beta = (th - 90.0) * DEG
            alpha = ALPHA_FIXED * DEG
        else:
            alpha = th * DEG
            beta = BETA_FIXED[profile_idx] * DEG
        cb = math.cos(beta)
        xyzV[i, 0] = R * cb * math.cos(alpha)
        xyzV[i, 1] = R * cb * math.sin(alpha)
        xyzV[i, 2] = R * math.sin(beta)
        xyzV[i, 3] = px_V[i]

    # ── Merge with .dat points ──
    dat_xyzV = parse_dat_file(dat_path, profile_idx)
    combined = np.vstack([dat_xyzV, xyzV])
    print(f'      {len(dat_xyzV)} .dat + {n} PNG = {len(combined)} points')
    return combined


# ====================================================================
#  3D IDW voxelization
# ====================================================================

def voxelize_idw(points_3d, resolution=128, k_nn=32, max_dist=25.0, power=2.5):
    """IDW interpolate scattered 3D points → uniform grid."""
    coords = points_3d[:, :3]
    values = points_3d[:, 3]

    xyz_min = coords.min(axis=0)
    xyz_max = coords.max(axis=0)
    span = xyz_max - xyz_min

    print(f'\n  Bounds: X[{xyz_min[0]:.1f},{xyz_max[0]:.1f}] Y[{xyz_min[1]:.1f},{xyz_max[1]:.1f}] Z[{xyz_min[2]:.1f},{xyz_max[2]:.1f}]')
    print(f'  Span: {span} m, voxel: ({span[0]/resolution:.3f}, {span[1]/resolution:.3f}, {span[2]/resolution:.3f}) m')
    print(f'  IDW: k={k_nn}, max_dist={max_dist}m, power={power}')

    xs = np.linspace(xyz_min[0] + span[0]/resolution/2, xyz_max[0] - span[0]/resolution/2, resolution)
    ys = np.linspace(xyz_min[1] + span[1]/resolution/2, xyz_max[1] - span[1]/resolution/2, resolution)
    zs = np.linspace(xyz_min[2] + span[2]/resolution/2, xyz_max[2] - span[2]/resolution/2, resolution)

    XX, YY, ZZ = np.meshgrid(xs, ys, zs, indexing='ij')
    queries = np.column_stack([XX.ravel(), YY.ravel(), ZZ.ravel()])

    tree = cKDTree(coords)
    t0 = time.time()
    print(f'  Querying {len(queries):,} voxels vs {len(coords):,} points ...')
    dists, idxs = tree.query(queries, k=k_nn, distance_upper_bound=max_dist)
    print(f'  Query done in {time.time()-t0:.1f}s')

    grid_flat = np.full(len(queries), 700.0, dtype=np.float64)
    has_nbr = np.isfinite(dists[:, 0])

    if has_nbr.any():
        v_dists = dists[has_nbr]; v_idxs = idxs[has_nbr]
        ok = v_idxs < len(coords)
        safe = v_idxs.copy(); safe[~ok] = 0
        eps = 1e-30
        w = 1.0 / np.maximum(v_dists, eps)**power
        w[~ok] = 0
        vv = values[safe]; vv[~ok] = 0
        w_sum = w.sum(axis=1); vw_sum = (w * vv).sum(axis=1)
        ok2 = w_sum > 0
        grid_flat[np.where(has_nbr)[0][ok2]] = vw_sum[ok2] / w_sum[ok2]

    grid = grid_flat.reshape(resolution, resolution, resolution)
    n_fill = has_nbr.sum(); n_blind = len(queries) - n_fill
    print(f'  Interpolated: {n_fill:,} ({n_fill/len(queries)*100:.1f}%) | Blind: {n_blind:,}')

    return grid, xyz_min, span


# ====================================================================
#  Normalize & export
# ====================================================================

def normalize_and_export(grid, out_dir, origin, extent, smooth_sigma=2.0):
    """Smooth, normalize to uint8, export raw + atlas + JSON."""
    if smooth_sigma > 0:
        print(f'\n  Gaussian smooth sigma={smooth_sigma}...')
        grid = gaussian_filter(grid, sigma=smooth_sigma)

    norm = np.clip((grid - 550.0) / 150.0 * 255.0, 0, 255)
    vox = norm.astype(np.uint8)
    print(f'  Uint8: [{vox.min()}, {vox.max()}], non-zero: {(vox>0).sum():,} ({(vox>0).sum()/vox.size*100:.1f}%)')

    # Raw file (Fortran order via ravel)
    raw_path = os.path.join(out_dir, 'tem_volume.raw')
    vox.ravel(order='F').tofile(raw_path)
    print(f'  [OK] {raw_path} ({os.path.getsize(raw_path)/1024/1024:.2f} MB)')

    # PNG atlas
    res = vox.shape[0]; nz = vox.shape[2]
    cols = int(math.ceil(math.sqrt(nz)))
    rows = int(math.ceil(nz / cols))
    atlas = np.zeros((res*rows, res*cols), dtype=np.uint8)
    for z in range(nz):
        c = z % cols; r = z // cols
        atlas[r*res:(r+1)*res, c*res:(c+1)*res] = vox[:, :, z].T

    png_path = os.path.join(out_dir, 'tem_volume.png')
    Image.fromarray(atlas, mode='L').save(png_path, compress_level=9)
    print(f'  [OK] {png_path} ({atlas.shape[1]}x{atlas.shape[0]}, {os.path.getsize(png_path)/1024:.0f} KB, {cols}x{rows} slices)')

    # JSON config
    config = {
        "properties": {"background": "rgba(0,0,0,0)", "nogui": True},
        "views": [{"axes": False, "border": False, "translate": [0,0,0], "rotate": [0,0,0,0]}],
        "objects": [{
            "name": "volume",
            "volume": {
                "url": "data/tem_new/tem_volume.png",
                "res": [res, res, res],
                "scale": [float(extent[0]), float(extent[1]), float(extent[2])],
                "autoscale": True
            },
            "samples": 256, "density": 5.0, "power": 1.5,
            "isovalue": 0.30, "isowalls": False,
            "isoalpha": 0.65, "isosmooth": 1.0,
            "colour": [0, 70, 200],
            "tricubicfilter": True, "usecolourmap": True,
            "xmin": 0.0, "xmax": 1.0, "ymin": 0.0, "ymax": 1.0, "zmin": 0.0, "zmax": 1.0
        }],
        "colourmaps": [{"colours": [
            {"position": 0.0, "colour": "rgba(0,60,180,0.95)"},
            {"position": 0.15,"colour": "rgba(0,140,230,0.75)"},
            {"position": 0.35,"colour": "rgba(0,200,220,0.50)"},
            {"position": 0.55,"colour": "rgba(30,210,180,0.25)"},
            {"position": 0.75,"colour": "rgba(50,160,150,0.08)"},
            {"position": 1.0, "colour": "rgba(0,0,0,0.0)"}
        ]}]
    }
    cfg_path = os.path.join(out_dir, 'tem_model.json')
    with open(cfg_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    print(f'  [OK] {cfg_path} ({os.path.getsize(cfg_path)/1024:.0f} KB)')


# ====================================================================
#  Main
# ====================================================================

def main():
    parser = argparse.ArgumentParser(description='TEM 3D Voxel Pipeline')
    parser.add_argument('--input',  default='public/data/TEM/1')
    parser.add_argument('--output', default='public/data/tem_new')
    parser.add_argument('--res',    type=int, default=128)
    parser.add_argument('--sub',    type=int, default=2)
    parser.add_argument('--max-dist', type=float, default=25.0)
    parser.add_argument('--k',      type=int, default=32)
    parser.add_argument('--power',  type=float, default=2.5)
    parser.add_argument('--smooth', type=float, default=2.0)
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    print('=' * 65)
    print('  TEM .dat-Calibrated 3D Voxel Pipeline')
    print('=' * 65)

    # ── Extract points from all 4 profiles ──
    print('\n[1/3] Extract & calibrate data points')
    all_pts = []
    for pidx, (png_fn, dat_fn, label) in enumerate(zip(PNG_FILES, PROFILE_FILES, PROFILE_NAMES)):
        png_path = os.path.join(args.input, png_fn)
        dat_path = os.path.join(args.input, dat_fn)
        if not os.path.exists(png_path) or not os.path.exists(dat_path):
            print(f'  [WARN] Missing: {label}')
            continue
        print(f'  {label}:')
        pts = extract_profile_dense(png_path, dat_path, pidx, args.sub)
        all_pts.append(pts)

    points = np.vstack(all_pts)
    print(f'\n  Total: {len(points):,} points')
    print(f'  V range: [{points[:,3].min():.1f}, {points[:,3].max():.1f}] Ohm.m')

    # ── IDW voxelization ──
    print(f'\n[2/3] 3D IDW voxelization')
    grid, origin, extent = voxelize_idw(points, resolution=args.res,
                                         k_nn=args.k, max_dist=args.max_dist,
                                         power=args.power)

    # ── Normalize & export ──
    print(f'\n[3/3] Normalize & export')
    normalize_and_export(grid, args.output, origin, extent, smooth_sigma=args.smooth)

    print('\n' + '=' * 65)
    print(f'  Done -> {args.output}/')
    print('=' * 65)


if __name__ == '__main__':
    main()
