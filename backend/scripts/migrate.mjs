/**
 * 数据库迁移脚本
 * 读取项目现有数据文件，写入 PostgreSQL 数据库
 *
 * 用法: node scripts/migrate.mjs
 *
 * 前提:
 *   1. PostgreSQL 已运行，数据库 tunnel_dt 已创建
 *   2. 已执行 src/db/001_schema.sql 和 002_seed.sql
 *   3. 环境变量 DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD 可选
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')

const { Pool } = pg
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'tunnel_dt',
  user:     process.env.DB_USER     || 'tunnel_admin',
  password: process.env.DB_PASSWORD || 'tunnel_admin',
})

async function main() {
  console.log('=== 隧道数字孪生系统 — 数据迁移 ===\n')

  // 1. 检查数据库连接
  await pool.query('SELECT 1')
  console.log('✓ 数据库连接正常\n')

  // 2. 迁移中心线数据
  await migrateCenterline()

  // 3. 迁移工作面数据
  await migrateWorksites()

  // 4. 迁移地质模型配置
  await migrateModelConfigs()

  // 5. 迁移支护结构配置
  await migrateSupportComponents()

  console.log('\n=== 迁移完成 ===')
  await pool.end()
}

// ── 中心线 → tunnels + mileage_reference_points ──────────
async function migrateCenterline() {
  console.log('--- 迁移中心线数据 ---')

  // 读取 centerLine.json
  const centerlinePath = resolve(PROJECT_ROOT, 'src', 'assets', 'data', 'centerLine.json')
  let geojson
  try {
    geojson = JSON.parse(readFileSync(centerlinePath, 'utf-8'))
  } catch {
    console.warn('  ⚠ centerLine.json 未找到，跳过')
    return
  }

  // 创建默认项目
  const { rows: [project] } = await pool.query(
    `INSERT INTO projects (name, code, description, status, region)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['拉月隧道', 'Layue', '钻爆法隧洞群施工数字孪生项目', 'under_construction', '西藏']
  )
  console.log(`  项目: ${project.id}`)

  // 提取 LineString 坐标
  const coords = geojson.features?.[0]?.geometry?.coordinates || geojson.coordinates
  if (!coords?.length) {
    console.warn('  ⚠ 无法从 centerLine.json 提取坐标')
    return
  }

  const startDk = 278100
  const endDk   = 286400

  // 构建 EWKT 格式 LINESTRINGZ
  const points = coords.map((c) => `${c[0]} ${c[1]} ${c[2] || 0}`).join(',')
  const ewkt = `SRID=4326;LINESTRINGZ(${points})`

  const { rows: [tunnel] } = await pool.query(
    `INSERT INTO tunnels (project_id, name, code, type, construction_method,
       centerline, start_mileage, end_mileage, status)
     VALUES ($1, $2, $3, $4, $5, ST_GeomFromEWKT($6), $7, $8, $9)
     ON CONFLICT (project_id, code) DO UPDATE SET centerline = EXCLUDED.centerline
     RETURNING id`,
    [project.id, '主洞', 'main_tunnel', 'main', 'drill_blast',
     ewkt, startDk, endDk, 'excavating']
  )
  console.log(`  隧道: ${tunnel.id}\n`)
}

// ── 工作面数据 ────────────────────────────────────────────
async function migrateWorksites() {
  console.log('--- 迁移工点数据 ---')

  const { rows: [tunnel] } = await pool.query(`SELECT id FROM tunnels WHERE code = 'main_tunnel'`)
  if (!tunnel) { console.warn('  ⚠ 隧道未找到，跳过'); return }

  const worksites = [
    { code: 'DK-A', name: 'DK工点A', dk: 279200, lon: 94.905619, lat: 29.533374, h: 2945.5,
      rock: 'IV', area: 76.5, method: 'bench_method', risk: 'medium' },
    { code: 'DK-B', name: 'DK工点B', dk: 283100, lon: 94.938499, lat: 29.513774, h: 2965.0,
      rock: 'V',  area: 82.3, method: 'full_face',    risk: 'high' },
  ]

  for (const w of worksites) {
    await pool.query(
      `INSERT INTO worksites (tunnel_id, name, code, dk_number, location,
         rock_classification, cross_section_area_m2, excavation_method, risk_level, status)
       VALUES ($1, $2, $3, $4,
         ST_SetSRID(ST_MakePoint($5, $6, $7), 4326),
         $8, $9, $10, $11, $12)
       ON CONFLICT (tunnel_id, code) DO NOTHING`,
      [tunnel.id, w.name, w.code, w.dk, w.lon, w.lat, w.h, w.rock, w.area, w.method, w.risk, 'active']
    )
    console.log(`  ✓ ${w.name} (DK${w.dk})`)
  }
  console.log()
}

// ── 地质模型配置 ──────────────────────────────────────────
async function migrateModelConfigs() {
  console.log('--- 迁移地质模型配置 ---')

  const { rows: [tunnel] } = await pool.query(`SELECT id FROM tunnels WHERE code = 'main_tunnel'`)
  if (!tunnel) { console.warn('  ⚠ 隧道未找到，跳过'); return }

  const models = [
    {
      code: 'water_zone', name: '富水带', start_dk: 278100, end_dk: 286400,
      volume_url: 'data/WATER/Water.json',
      anchor_lon: 94.9417636, anchor_lat: 29.5114813, anchor_height: 2967.04,
      heading_deg: 128.80,
      fly_dest_x: -478759.0, fly_dest_y: 5537054.9, fly_dest_z: 3124823.9,
      fly_heading: 5.5, fly_pitch: -0.55,
      look_at_lon: 94.9417636, look_at_lat: 29.5114813, look_at_height: 2967.04,
      look_at_offset_x: 125, look_at_offset_y: -150, look_at_offset_z: 125,
    },
    {
      code: 'fracture_zone', name: '破碎带', start_dk: 278100, end_dk: 286400,
      volume_url: 'data/POSUI/posui.json',
      anchor_lon: 94.9417636, anchor_lat: 29.5114813, anchor_height: 2967.04,
      heading_deg: 128.80,
      fly_dest_x: -478759.0, fly_dest_y: 5537054.9, fly_dest_z: 3124823.9,
      fly_heading: 5.5, fly_pitch: -0.55,
      look_at_lon: 94.9417636, look_at_lat: 29.5114813, look_at_height: 2967.04,
      look_at_offset_x: 125, look_at_offset_y: -150, look_at_offset_z: 125,
    },
    {
      code: 'tsp', name: 'TSP反演(默认VS)', sub_type: 'vs', start_dk: 278100, end_dk: 286400,
      volume_url: 'data/tsp_new/vs_3.json',
      anchor_lon: 94.9056136, anchor_lat: 29.5333802, anchor_height: 2945.51,
      rotation_x: 0.0, rotation_y: -1.5, rotation_z: 168.5,
      translate_x: 25, translate_y: 45, translate_z: -50,
      scale_x: 0.0065, scale_y: 0.00921, scale_z: 0.00921,
      heading_deg: 100.08,
      fly_dest_x: -475447.3, fly_dest_y: 5536370.3, fly_dest_z: 3126656.9,
      fly_heading: 5.6439, fly_pitch: -0.1861,
      look_at_lon: 94.9056136, look_at_lat: 29.5333802, look_at_height: 2945.51,
      look_at_offset_x: 265, look_at_offset_y: -357, look_at_offset_z: 84,
    },
    {
      code: 'tem', name: '瞬变电磁', sub_type: 'tem', start_dk: 278100, end_dk: 286400,
      volume_url: 'data/tem_new/tem_model.json',
      anchor_lon: 94.9056136, anchor_lat: 29.5333802, anchor_height: 2945.51,
      rotation_x: 0.0, rotation_y: 1.5, rotation_z: -11.5,
      translate_x: 35, translate_y: -35, translate_z: -30,
      scale_x: 0.012, scale_y: 0.012, scale_z: 0.012,
      heading_deg: 100.08,
      fly_dest_x: -475447.3, fly_dest_y: 5536370.3, fly_dest_z: 3126656.9,
      fly_heading: 5.6439, fly_pitch: -0.1861,
      look_at_lon: 94.9056136, look_at_lat: 29.5333802, look_at_height: 2945.51,
      look_at_offset_x: 265, look_at_offset_y: -357, look_at_offset_z: 84,
    },
    {
      code: 'weak_rock', name: '软弱围岩', start_dk: 278100, end_dk: 286400,
      glb_urls: JSON.stringify([{ url: 'data/weiyan/model.glb', mileage: 0 }]),
      anchor_lon: 94.9044380, anchor_lat: 29.5323360, anchor_height: 2978.00,
      glb_heading: 1.5708, heading_deg: 128.80,
      fly_dest_x: -475111.5, fly_dest_y: 5536216.1, fly_dest_z: 3126872.5,
      fly_heading: 0.5322, fly_pitch: -0.3723,
      look_at_lon: 94.9044380, look_at_lat: 29.5323360, look_at_height: 2978.00,
      look_at_offset_x: 125, look_at_offset_y: -150, look_at_offset_z: 125,
      skip_look_at: true,
    },
    {
      code: 'gpr', name: '地质雷达', start_dk: 278100, end_dk: 286400,
      glb_urls: JSON.stringify([{ url: 'data/gpr/gpr1/1665832_1.glb', mileage: 0 }]),
      anchor_lon: 94.9056136, anchor_lat: 29.5333802, anchor_height: 2945.51,
      glb_heading: 1.7467, glb_y_rot: -1.5708, heading_deg: 100.08,
      reference_mileage: 0,
      fly_dest_x: -475447.3, fly_dest_y: 5536370.3, fly_dest_z: 3126656.9,
      fly_heading: 5.6439, fly_pitch: -0.1861,
      look_at_lon: 94.9056136, look_at_lat: 29.5333802, look_at_height: 2945.51,
      look_at_offset_x: 265, look_at_offset_y: -357, look_at_offset_z: 84,
    },
    {
      code: 'horiz_drill', name: '超前水平钻+掌子面素描', start_dk: 278100, end_dk: 286400,
      glb_urls: JSON.stringify([
        { url: 'data/ahd/ahd1/2320835.glb', mileage: 5, heightOffset: 5 },
        { url: 'data/ahd/ahd2/2336197.glb', mileage: 15, heightOffset: 5 },
        { url: 'data/tfs_new/tfs3/2322196.glb', mileage: 0 },
        { url: 'data/tfs_new/tfs1/2322509.glb', mileage: 10 },
        { url: 'data/tfs_new/tfs2/2322518.glb', mileage: 20 },
        { url: 'data/tfs_new/tfs4/2326775.glb', mileage: 25 },
      ]),
      anchor_lon: 94.9056136, anchor_lat: 29.5333802, anchor_height: 2945.51,
      glb_heading: 1.7467, glb_y_rot: -1.5708, heading_deg: 100.08,
      reference_mileage: 0,
      fly_dest_x: -475447.3, fly_dest_y: 5536370.3, fly_dest_z: 3126656.9,
      fly_heading: 5.6439, fly_pitch: -0.1861,
      look_at_lon: 94.9056136, look_at_lat: 29.5333802, look_at_height: 2945.51,
      look_at_offset_x: 265, look_at_offset_y: -357, look_at_offset_z: 84,
    },
    {
      code: 'face_sketch', name: '掌子面素描', start_dk: 278100, end_dk: 286400,
      glb_urls: JSON.stringify([
        { url: 'data/tfs_new/tfs3/2322196.glb', mileage: 0 },
        { url: 'data/tfs_new/tfs1/2322509.glb', mileage: 10 },
        { url: 'data/tfs_new/tfs2/2322518.glb', mileage: 20 },
        { url: 'data/tfs_new/tfs4/2326775.glb', mileage: 30 },
      ]),
      anchor_lon: 94.9056136, anchor_lat: 29.5333802, anchor_height: 2945.51,
      glb_heading: 1.7467, glb_y_rot: -1.5708, heading_deg: 100.08,
      reference_mileage: 0,
      fly_dest_x: -475447.3, fly_dest_y: 5536370.3, fly_dest_z: 3126656.9,
      fly_heading: 5.6439, fly_pitch: -0.1861,
      look_at_lon: 94.9056136, look_at_lat: 29.5333802, look_at_height: 2945.51,
      look_at_offset_x: 265, look_at_offset_y: -357, look_at_offset_z: 84,
    },
  ]

  for (const m of models) {
    await pool.query(
      `INSERT INTO geological_model_instances (
         tunnel_id, model_type_code, name, start_dk, end_dk, sub_type,
         volume_url, glb_urls,
         anchor_lon, anchor_lat, anchor_height,
         rotation_x, rotation_y, rotation_z,
         translate_x, translate_y, translate_z,
         scale_x, scale_y, scale_z,
         heading_deg, glb_heading, glb_y_rot, glb_z_rot, reference_mileage,
         fly_dest_x, fly_dest_y, fly_dest_z, fly_heading, fly_pitch,
         look_at_lon, look_at_lat, look_at_height,
         look_at_offset_x, look_at_offset_y, look_at_offset_z,
         skip_look_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8,
         $9, $10, $11,
         $12, $13, $14,
         $15, $16, $17,
         $18, $19, $20,
         $21, $22, $23, $24, $25,
         $26, $27, $28, $29, $30,
         $31, $32, $33,
         $34, $35, $36,
         $37
       ) ON CONFLICT DO NOTHING`,
      [tunnel.id, m.code, m.name, m.start_dk, m.end_dk, m.sub_type || null,
       m.volume_url || null, m.glb_urls || null,
       m.anchor_lon, m.anchor_lat, m.anchor_height,
       m.rotation_x || 0, m.rotation_y || 0, m.rotation_z || 0,
       m.translate_x || 0, m.translate_y || 0, m.translate_z || 0,
       m.scale_x || 1, m.scale_y || 1, m.scale_z || 1,
       m.heading_deg, m.glb_heading || null, m.glb_y_rot || null, m.glb_z_rot || null, m.reference_mileage || null,
       m.fly_dest_x, m.fly_dest_y, m.fly_dest_z, m.fly_heading, m.fly_pitch,
       m.look_at_lon, m.look_at_lat, m.look_at_height,
       m.look_at_offset_x, m.look_at_offset_y, m.look_at_offset_z,
       m.skip_look_at || false]
    )
    console.log(`  ✓ ${m.name} (${m.code})`)
  }
  console.log()
}

// ── 支护结构配置 ──────────────────────────────────────────
async function migrateSupportComponents() {
  console.log('--- 迁移支护结构配置 ---')

  const { rows: [tunnel] } = await pool.query(`SELECT id FROM tunnels WHERE code = 'main_tunnel'`)
  if (!tunnel) { console.warn('  ⚠ 隧道未找到，跳过'); return }

  const components = [
    { type: 'pipe_shed',    spec: 'ZZ-QJsx-φ76中管棚',            glb: 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-中管棚.glb', start_dk: 278100, end_dk: 286400 },
    { type: 'anchor',       spec: 'ZZ-QJsx-φ25自进式中空注浆锚杆',  glb: 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-锚杆.glb', start_dk: 278100, end_dk: 286400 },
    { type: 'conduit',      spec: 'ZZ-QJsx-φ42注浆小导管',          glb: 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-小导管.glb', start_dk: 278100, end_dk: 286400 },
    { type: 'lock_anchor',  spec: 'ZZ-QJsx-φ42锁脚锚杆',           glb: 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-锁脚锚杆.glb', start_dk: 278100, end_dk: 286400 },
    { type: 'rebar',        spec: 'Z-PM-洞口钢筋网',                glb: 'data/zhihu/Z-PM-23m/钢筋第一层.glb', start_dk: 278100, end_dk: 286400 },
    { type: 'lining_rebar', spec: 'ZZ-QJsx-二衬钢筋',              glb: 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-二衬钢筋.glb', start_dk: 278100, end_dk: 286400 },
    { type: 'steel_frame',  spec: 'ZZ-QJsx-钢架',                 glb: 'data/zhihu/ZZ-QJsx-44m/ZZ-QJsx-钢架.glb', start_dk: 278100, end_dk: 286400 },
  ]

  for (const c of components) {
    await pool.query(
      `INSERT INTO support_components (tunnel_id, component_type, material_spec, start_dk, end_dk, glb_model_url)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [tunnel.id, c.type, c.spec, c.start_dk, c.end_dk, c.glb]
    )
    console.log(`  ✓ ${c.spec}`)
  }
  console.log()
}

main().catch((err) => {
  console.error('迁移失败:', err)
  process.exit(1)
})
