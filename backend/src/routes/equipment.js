import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/equipment
router.get('/', async (req, res) => {
  const { rows } = await query(`SELECT * FROM equipment ORDER BY name`)
  res.json(rows)
})

// GET /api/equipment/types
router.get('/types', async (req, res) => {
  const { rows } = await query(`SELECT * FROM equipment_types ORDER BY category, code`)
  res.json(rows)
})

// GET /api/equipment/status/current — 所有设备当前状态
router.get('/status/current', async (req, res) => {
  const { rows } = await query(
    `SELECT e.id, e.name, e.equipment_code, e.equipment_type, e.status AS base_status,
            s.dk_number, s.status, s.current_task, s.operational_params, s.last_update,
            ST_X(s.location::geometry) AS lon, ST_Y(s.location::geometry) AS lat
     FROM equipment_current_status s JOIN equipment e ON s.equipment_id = e.id
     ORDER BY e.equipment_type, e.name`
  )
  res.json(rows)
})

// POST /api/equipment/:id/location — 上报位置
router.post('/:id/location', async (req, res) => {
  const { tunnel_id, dk_number, lon, lat, height, status, current_task, operational_params } = req.body
  const location = lon && lat
    ? `ST_SetSRID(ST_MakePoint(${lon}, ${lat}, ${height || 0}), 4326)`
    : 'NULL'

  await query(
    `INSERT INTO equipment_locations (time, equipment_id, tunnel_id, dk_number, location, status, current_task, operational_params)
     VALUES (NOW(), $1, $2, $3, ${location}, $4, $5, $6)`,
    [req.params.id, tunnel_id, dk_number, status || 'idle', current_task, JSON.stringify(operational_params || {})]
  )
  res.status(201).json({ ok: true })
})

export default router
