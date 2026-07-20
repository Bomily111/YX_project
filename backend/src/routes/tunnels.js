import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/tunnels — 所有隧道
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, project_id, name, code, type, construction_method,
              start_mileage, end_mileage, length_m, cross_section_area_m2, status,
              ST_AsGeoJSON(centerline)::json AS centerline_geojson
       FROM tunnels ORDER BY code`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tunnels/:id — 单个隧道详情
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.*, ST_AsGeoJSON(t.centerline)::json AS centerline_geojson,
              p.name AS project_name, p.code AS project_code
       FROM tunnels t JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`, [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Tunnel not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tunnels/:id/worksites — 隧道下所有工作面
router.get('/:id/worksites', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, code, dk_number, rock_classification, excavation_method,
              risk_level, current_procedure, cycle_advance_m, status,
              cross_section_area_m2,
              ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
              ST_Z(location::geometry) AS height
       FROM worksites WHERE tunnel_id = $1 ORDER BY dk_number`, [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tunnels/:id/worksites — 创建工作面
router.post('/:id/worksites', async (req, res) => {
  try {
    const { name, code, dk_number, lon, lat, height, rock_classification, excavation_method, risk_level } = req.body
    const { rows } = await query(
      `INSERT INTO worksites (tunnel_id, name, code, dk_number, location, rock_classification, excavation_method, risk_level)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6, $7), 4326), $8, $9, $10) RETURNING *`,
      [req.params.id, name, code, dk_number, lon, lat, height || 0, rock_classification || 'IV', excavation_method || 'drill_blast', risk_level || 'medium']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tunnels/:id/models — 隧道下所有地质模型（替换硬编码 MODEL_CONFIGS）
router.get('/:id/models', async (req, res) => {
  try {
    const { near_dk, radius_m } = req.query
    let sql = `
      SELECT gmi.*, gmt.name_cn AS model_type_name, gmt.data_type, gmt.render_method
      FROM geological_model_instances gmi
      JOIN geological_model_types gmt ON gmi.model_type_code = gmt.code
      WHERE gmi.tunnel_id = $1 AND gmi.is_active = true`
    const params = [req.params.id]

    if (near_dk) {
      const margin = parseFloat(radius_m) || 50
      sql += ` AND gmi.start_dk - $2 <= $3 AND gmi.end_dk + $2 >= $3`
      params.push(margin, parseFloat(near_dk))
    }

    sql += ` ORDER BY gmi.model_type_code, gmi.start_dk`
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tunnels/:id/models/:modelKey — 按类型获取模型
router.get('/:id/models/:modelKey', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT gmi.*, gmt.name_cn AS model_type_name
       FROM geological_model_instances gmi
       JOIN geological_model_types gmt ON gmi.model_type_code = gmt.code
       WHERE gmi.tunnel_id = $1 AND gmi.model_type_code = $2 AND gmi.is_active = true
       ORDER BY gmi.start_dk`, [req.params.id, req.params.modelKey]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tunnels/:id/mileage — 里程参考点
router.get('/:id/mileage', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, dk_number, label,
              ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
              ST_Z(location::geometry) AS height
       FROM mileage_reference_points
       WHERE tunnel_id = $1 ORDER BY dk_number`, [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tunnels/:id/centerline/snap — 将坐标吸附到最近中心线点
router.get('/:id/centerline/snap', async (req, res) => {
  try {
    const { lon, lat } = req.query
    if (!lon || !lat) return res.status(400).json({ error: 'lon and lat required' })

    const { rows } = await query(
      `SELECT ST_LineLocatePoint(centerline, ST_SetSRID(ST_MakePoint($2, $3), 4326)) AS fraction,
              start_mileage, end_mileage
       FROM tunnels WHERE id = $1`, [req.params.id, parseFloat(lon), parseFloat(lat)]
    )
    if (!rows.length) return res.status(404).json({ error: 'Tunnel not found' })

    const { fraction, start_mileage, end_mileage } = rows[0]
    const dk = parseFloat(start_mileage) + fraction * (parseFloat(end_mileage) - parseFloat(start_mileage))
    res.json({ dk_number: Math.round(dk * 1000) / 1000, fraction })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
