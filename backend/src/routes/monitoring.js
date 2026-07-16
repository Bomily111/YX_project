import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/monitoring/configs?worksite_id= — 监测配置列表
router.get('/configs', async (req, res) => {
  try {
    const { worksite_id, scene_key } = req.query
    let sql = `SELECT * FROM monitoring_configs WHERE is_active = true`
    const params = []

    if (worksite_id) { sql += ` AND worksite_id = $${params.length + 1}`; params.push(worksite_id) }
    if (scene_key)    { sql += ` AND scene_key = $${params.length + 1}`; params.push(scene_key) }

    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/monitoring/readings/latest?config_id= — 最新读数
router.get('/readings/latest', async (req, res) => {
  try {
    const { config_id } = req.query
    const { rows } = await query(
      `SELECT DISTINCT ON (config_id) config_id, time, value, quality
       FROM monitoring_readings
       WHERE config_id = ANY($1::uuid[])
       ORDER BY config_id, time DESC`,
      [config_id.split(',')]
    )
    const result = {}
    for (const r of rows) result[r.config_id] = r
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/monitoring/readings?config_id=&from=&to=&bucket= — 历史读数
router.get('/readings', async (req, res) => {
  try {
    const { config_id, from, to, bucket } = req.query
    if (!config_id) return res.status(400).json({ error: 'config_id required' })

    const fromTime = from || new Date(Date.now() - 7 * 864e5).toISOString()
    const toTime = to || new Date().toISOString()

    if (bucket === '1 hour') {
      const { rows } = await query(
        `SELECT bucket AS time, avg_value, min_value, max_value, sample_count
         FROM monitoring_hourly_agg
         WHERE config_id = $1 AND bucket >= $2 AND bucket <= $3
         ORDER BY bucket`, [config_id, fromTime, toTime]
      )
      return res.json(rows)
    }

    const { rows } = await query(
      `SELECT time, value, quality
       FROM monitoring_readings
       WHERE config_id = $1 AND time >= $2 AND time <= $3
       ORDER BY time`,
      [config_id, fromTime, toTime]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/monitoring/readings — 写入监测数据（传感器/模拟用）
router.post('/readings', async (req, res) => {
  try {
    const { readings } = req.body
    if (!readings?.length) return res.status(400).json({ error: 'readings array required' })

    const values = []
    const params = []
    let i = 1
    for (const r of readings) {
      values.push(`($${i}, $${i + 1}, $${i + 2}, $${i + 3})`)
      params.push(r.config_id, r.time || new Date().toISOString(), r.value, r.quality || 0)
      i += 4
    }

    await query(
      `INSERT INTO monitoring_readings (config_id, time, value, quality) VALUES ${values.join(',')}`,
      params
    )
    res.status(201).json({ inserted: readings.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
