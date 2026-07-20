// 从隧道 GLB 文件提取真实截面轮廓，输出为 JSON
// 用法: node scripts/extract-cross-section.cjs
const fs = require('fs');
const path = require('path');

// ── glTF 2.0 GLB 解析 ────────────────────────────────────

function parseGLB(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546C67) throw new Error('不是有效的 GLB 文件');
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error(`glTF 版本 ${version}，期望 2`);

  let offset = 12;
  let json = null, bin = null;

  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkType === 0x4E4F534A) {
      json = JSON.parse(buffer.slice(offset, offset + chunkLength).toString('utf-8'));
    } else if (chunkType === 0x004E4942) {
      bin = buffer.slice(offset, offset + chunkLength);
    }
    offset += chunkLength;
  }
  return { json, bin };
}

function getAccessorData(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const byteOffset = (accessor.byteOffset || 0) + (bufferView.byteOffset || 0);
  if (accessor.componentType !== 5126) throw new Error('顶点不是 FLOAT 类型');

  const count = accessor.count;
  const stride = bufferView.byteStride || 12;
  const vertices = [];
  for (let i = 0; i < count; i++) {
    const off = byteOffset + i * stride;
    vertices.push({
      x: bin.readFloatLE(off),
      y: bin.readFloatLE(off + 4),
      z: bin.readFloatLE(off + 8),
    });
  }
  return vertices;
}

// ── 薄切片 + 径向采样提取外轮廓 ────────────────────────────

function extractOutline(vertices, tunnelAxis, sliceCenter, sliceHalfThickness, numRays, smoothing) {
  // 取薄切片：仅保留隧道走向方向上 sliceCenter ± sliceHalfThickness 内的顶点
  const sliced = [];
  for (const v of vertices) {
    const axisVal = tunnelAxis === 'X' ? v.x : v.z;
    if (Math.abs(axisVal - sliceCenter) < sliceHalfThickness) {
      sliced.push(v);
    }
  }
  console.log('[extract] 切片顶点:', sliced.length, '(厚度', (sliceHalfThickness * 2).toFixed(1), 'm)');

  // 投影到截面平面
  const getU = tunnelAxis === 'X' ? (v) => v.z : (v) => v.x;
  const getV = (v) => v.y;
  const points = sliced.map(v => ({ u: getU(v), v: getV(v) }));

  // 计算质心
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.u; cy += p.v; }
  cx /= points.length;
  cy /= points.length;

  // 径向采样：每个角度取距离质心投影最远的点
  const raw = [];
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let maxProj = -Infinity;
    let bestU = cx, bestV = cy;
    for (const p of points) {
      const proj = (p.u - cx) * dx + (p.v - cy) * dy;
      if (proj > maxProj) {
        maxProj = proj;
        bestU = p.u;
        bestV = p.v;
      }
    }
    // 投影到精确角度方向
    const dist = maxProj;
    raw.push({ u: cx + dist * dx, v: cy + dist * dy });
  }

  // 移动平均平滑
  const smoothed = [];
  for (let i = 0; i < numRays; i++) {
    let su = 0, sv = 0;
    for (let j = -smoothing; j <= smoothing; j++) {
      const idx = (i + j + numRays) % numRays;
      su += raw[idx].u; sv += raw[idx].v;
    }
    const c = 2 * smoothing + 1;
    smoothed.push({ u: su / c, v: sv / c });
  }

  // 去重
  const dedup = [smoothed[0]];
  for (let i = 1; i < smoothed.length; i++) {
    const p = dedup[dedup.length - 1];
    const d = Math.hypot(smoothed[i].u - p.u, smoothed[i].v - p.v);
    if (d > 0.03) dedup.push(smoothed[i]);
  }

  return dedup;
}

// ── 主流程 ─────────────────────────────────────────────────

function main() {
  const glbPath = path.join(__dirname, '..', 'public', 'data', 'tunnel', 'tunnel008.glb');
  console.log('[extract] 读取:', glbPath);

  const buffer = fs.readFileSync(glbPath);
  console.log('[extract] 文件大小:', (buffer.length / 1024 / 1024).toFixed(1), 'MB');

  const { json, bin } = parseGLB(buffer);

  const mesh = json.meshes[0];
  if (!mesh?.primitives?.length) throw new Error('没有找到 primitive');

  const prim = mesh.primitives[0];
  const posAccessorIdx = prim.attributes?.POSITION;
  if (posAccessorIdx === undefined) throw new Error('没有 POSITION 属性');

  console.log('[extract] 顶点总数:', json.accessors[posAccessorIdx].count);
  const vertices = getAccessorData(json, bin, posAccessorIdx);

  // 分析范围
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }
  const rangeX = maxX - minX, rangeY = maxY - minY, rangeZ = maxZ - minZ;
  console.log('[extract] 范围 X:', rangeX.toFixed(1), 'Y:', rangeY.toFixed(1), 'Z:', rangeZ.toFixed(1));

  // 隧道走向 = 水平范围最大的轴
  const tunnelAxis = rangeX > rangeZ ? 'X' : 'Z';
  const sliceCenter = tunnelAxis === 'X' ? (minX + maxX) / 2 : (minZ + maxZ) / 2;
  console.log('[extract] 走向:', tunnelAxis, '切片位置:', sliceCenter.toFixed(1));

  const outline = extractOutline(vertices, tunnelAxis, sliceCenter, 0.5, 360, 3);
  console.log('[extract] 轮廓点数:', outline.length);

  // 转换为以质心为原点的相对坐标
  let cx = 0, cy = 0;
  for (const p of outline) { cx += p.u; cy += p.v; }
  cx /= outline.length;
  cy /= outline.length;

  const output = outline.map(p => [
    Number((p.u - cx).toFixed(4)),
    Number((p.v - cy).toFixed(4)),
  ]);

  const outPath = path.join(__dirname, '..', 'public', 'data', 'tunnel', 'cross-section.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log('[extract] 输出:', outPath);
  console.log('[extract] 质心偏移: U=', cx.toFixed(2), 'V=', cy.toFixed(2));
  console.log('[extract] 完成!');
}

try {
  main();
} catch (e) {
  console.error('[extract] 失败:', e.message);
  process.exit(1);
}
