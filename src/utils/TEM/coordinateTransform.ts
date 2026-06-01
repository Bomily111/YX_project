/**
 * TEM 数据解析与精确坐标转换
 *
 * 公式: X = Depth·cos(β)·cos(α), Y = Depth·cos(β)·sin(α), Z = Depth·sin(β)
 *
 * 4 个剖面:
 *   线1 (上倾30°):  β=30°,  α = 150° - (LineID-1)·15°
 *   线2 (水平0°):   β=0°,   α = 150° - (LineID-1)·15°
 *   线3 (下倾30°):  β=-30°, α = 150° - (LineID-1)·15°
 *   线4 (垂向):     α=90°,  β = 60° - (LineID-1)·15°
 *
 * LineID 范围 1-9, Depth 为径向距离 (列2), Value 为电阻率 (列3)
 */

const DEG = Math.PI / 180;

export interface ScatteredPoint {
  x: number;
  y: number;
  z: number;
  value: number;
}

/** 将 .dat 文件文本内容解析为散点云 */
export function parseDatToScattered(
  text: string,
  profileIndex: number, // 0=线1(上倾30°), 1=线2(水平), 2=线3(下倾30°), 3=线4(垂向)
): ScatteredPoint[] {
  const points: ScatteredPoint[] = [];
  const lines = text.trim().split(/\r?\n/);

  for (const line of lines) {
    const parts = line.split('\t').map(Number);
    const lineId = parts[0];   // 1-9
    const depth  = parts[1];   // 径向距离
    const value  = parts[2];   // 电阻率

    if (!Number.isFinite(lineId) || !Number.isFinite(depth) || !Number.isFinite(value)) continue;

    const { x, y, z } = profileToCartesian(profileIndex, lineId, depth);
    points.push({ x, y, z, value });
  }

  return points;
}

/** 单个测点的极坐标→笛卡尔坐标转换 */
function profileToCartesian(
  profileIndex: number,
  lineId: number,
  depth: number,
): { x: number; y: number; z: number } {
  let alphaDeg: number; // 方位角 (水平面内, 从 +X 轴测量)
  let betaDeg: number;  // 仰俯角 (水平面为 0, 向上为正)

  if (profileIndex === 3) {
    // 线4 — 中央垂向剖面: α 固定 90° (正前方), β = 60° → -60°
    alphaDeg = 90;
    betaDeg  = 60 - (lineId - 1) * 15;
  } else {
    // 线1/2/3 — 水平/斜向剖面
    const betaValues = [30, 0, -30];
    betaDeg  = betaValues[profileIndex];
    alphaDeg = 150 - (lineId - 1) * 15; // 150° → 30°
  }

  const alpha = alphaDeg * DEG;
  const beta  = betaDeg  * DEG;

  const cosBeta = Math.cos(beta);
  return {
    x: depth * cosBeta * Math.cos(alpha),
    y: depth * cosBeta * Math.sin(alpha),
    z: depth * Math.sin(beta),
  };
}

/** 一次性解析全部 4 个 .dat 文件, 返回完整散点云 */
export function parseAllProfiles(
  texts: [string, string, string, string],
): ScatteredPoint[] {
  const all: ScatteredPoint[] = [];
  for (let i = 0; i < 4; i++) {
    all.push(...parseDatToScattered(texts[i], i));
  }
  return all;
}
