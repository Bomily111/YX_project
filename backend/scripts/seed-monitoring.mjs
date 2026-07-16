/**
 * 自动创建监测配置 + 生成模拟传感器数据
 * 用法: npm run db:seed-monitor
 */

import pg from 'pg'

const pool = new pg.Pool({
  host: '127.0.0.1', port: 5432, database: 'tunnel_dt',
  user: 'postgres', password: 'postgres',
})

const SCENES = {
  workface: [
    { key: 'rock_level',        name: '围岩等级',       unit: '级',    min: 3, max: 6, round: true },
    { key: 'cycle_advance',     name: '循环进尺',       unit: 'm',     min: 2.5, max: 4.5 },
    { key: 'cross_section',     name: '断面面积',       unit: 'm²',  min: 76, max: 83 },
    { key: 'personnel_count',   name: '在岗人数',       unit: '人',    min: 8, max: 15, round: true },
    { key: 'daily_advance',     name: '今日进尺',       unit: 'm',     min: 2.0, max: 4.5 },
  ],
  support: [
    { key: 'arch_settlement',   name: '拱顶沉降',       unit: 'mm',    min: 8, max: 15 },
    { key: 'horiz_convergence', name: '水平收敛',       unit: 'mm',    min: 5, max: 10 },
    { key: 'shotcrete_pct',     name: '喷锚完成',       unit: '%',     min: 80, max: 99 },
  ],
  vent: [
    { key: 'wind_speed',        name: '风速',           unit: 'm/s',   min: 2.5, max: 3.8 },
    { key: 'air_volume',        name: '风量',           unit: 'm3/min',min: 200, max: 300, round: true },
    { key: 'temperature',       name: '隧道温度',       unit: 'C',     min: 15, max: 22 },
    { key: 'co_concentration',  name: 'CO浓度',        unit: 'ppm',   min: 8, max: 25, round: true },
    { key: 'dust_concentration',name: '粉尘浓度',       unit: 'mg/m3', min: 5, max: 20 },
    { key: 'o2_level',          name: '氧气含量',       unit: '%',     min: 20.5, max: 21 },
  ],
  dispatch: [
    { key: 'personnel_count',   name: '在岗人员',       unit: '人',    min: 20, max: 35, round: true },
    { key: 'equipment_count',   name: '在用设备',       unit: '台',    min: 4, max: 8, round: true },
    { key: 'muck_volume',       name: '今日出渣',       unit: 'm3',   min: 0, max: 500 },
    { key: 'muck_trips',        name: '运渣趟次',       unit: '趟',    min: 0, max: 18, round: true },
    { key: 'shift_efficiency',  name: '当班效率',       unit: '%',     min: 85, max: 98 },
  ],
}

function round(v, r) { return r ? Math.round(v) : Math.round(v * 10) / 10 }

async function main() {
  console.log('=== 创建监测配置 + 生成7天模拟数据 ===\n')

  // 取隧道和工点
  const { rows: [tunnel] } = await pool.query(`SELECT id FROM tunnels LIMIT 1`)
  const { rows: worksites } = await pool.query(`SELECT id, code, dk_number FROM worksites WHERE tunnel_id = $1`, [tunnel.id])

  if (!worksites.length) {
    // 没有工点先建一个
    const { rows: [ws] } = await pool.query(
      `INSERT INTO worksites (tunnel_id, name, code, dk_number, location)
       VALUES ($1, 'Default', 'WS-1', 279200, ST_SetSRID(ST_MakePoint(94.905619, 29.533374, 2945.5), 4326))
       ON CONFLICT DO NOTHING RETURNING id`,
      [tunnel.id]
    )
    worksites.push(ws || (await pool.query(`SELECT id, code, dk_number FROM worksites WHERE tunnel_id = $1`, [tunnel.id])).rows[0])
  }

  const ws = worksites[0]
  console.log(`隧道: ${tunnel.id}`)
  console.log(`工点: ${ws.code} (${ws.id})\n`)

  let configCount = 0
  const configIds = []

  for (const [scene, metrics] of Object.entries(SCENES)) {
    for (const m of metrics) {
      const { rows: [cfg] } = await pool.query(
        `INSERT INTO monitoring_configs (worksite_id, scene_key, metric_key, metric_name_cn, unit)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (worksite_id, scene_key, metric_key) DO UPDATE SET metric_name_cn = EXCLUDED.metric_name_cn
         RETURNING id`,
        [ws.id, scene, m.key, m.name, m.unit]
      )
      configCount++
      configIds.push({ id: cfg.id, scene, ...m })
    }
  }
  console.log(`监测配置: ${configCount} 条\n`)

  // 生成7天模拟数据 (每5分钟一条)
  const now = Date.now()
  const readings = []
  for (let h = 0; h < 7 * 24; h++) {
    for (const cfg of configIds) {
      const time = new Date(now - (7 * 24 - h) * 3600 * 1000).toISOString()
      const range = cfg.max - cfg.min
      const base = cfg.min + Math.random() * range
      // 加趋势：某些指标随时间递增
      let trend = 0
      if (cfg.key === 'daily_advance' || cfg.key === 'muck_volume') {
        trend = (h / (7 * 24)) * range * 0.3 // 慢慢涨
      }
      readings.push({
        config_id: cfg.id,
        time,
        value: round(base + trend, cfg.round),
        quality: Math.random() > 0.95 ? 1 : 0,
      })
    }
  }

  // 批量写入（每100条一批）
  const BATCH = 100
  for (let i = 0; i < readings.length; i += BATCH) {
    const batch = readings.slice(i, i + BATCH)
    const values = []
    const params = []
    let idx = 1
    for (const r of batch) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`)
      params.push(r.config_id, r.time, r.value, r.quality)
      idx += 4
    }
    await pool.query(
      `INSERT INTO monitoring_readings (config_id, time, value, quality) VALUES ${values.join(',')}`,
      params
    )
    process.stdout.write(`\r写入: ${Math.min(i + BATCH, readings.length)} / ${readings.length}`)
  }

  // 刷新物化视图
  await pool.query(`REFRESH MATERIALIZED VIEW monitoring_hourly_agg`)
  console.log(`\n\n完成! ${readings.length} 条模拟数据已写入`)
  console.log(`\n测试: curl http://localhost:3000/api/monitoring/configs?worksite_id=${ws.id}`)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
