import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/personnel
router.get('/', async (req, res) => {
  const { rows } = await query(`SELECT * FROM persons WHERE is_active = true ORDER BY name`)
  res.json(rows)
})

// GET /api/personnel/:id
router.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM persons WHERE id = $1`, [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// GET /api/personnel/status/current — 所有人员当前位置
router.get('/status/current', async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.name, p.role, p.craft, s.dk_number, s.status, s.current_task, s.last_update,
            ST_X(s.location::geometry) AS lon, ST_Y(s.location::geometry) AS lat
     FROM person_current_status s JOIN persons p ON s.person_id = p.id
     WHERE p.is_active = true ORDER BY p.name`
  )
  res.json(rows)
})

// POST /api/personnel/:id/location — 上报位置
router.post('/:id/location', async (req, res) => {
  const { tunnel_id, dk_number, lon, lat, height, status, current_task } = req.body
  const location = lon && lat
    ? `ST_SetSRID(ST_MakePoint(${lon}, ${lat}, ${height || 0}), 4326)`
    : 'NULL'

  await query(
    `INSERT INTO person_locations (time, person_id, tunnel_id, dk_number, location, status, current_task)
     VALUES (NOW(), $1, $2, $3, ${location}, $4, $5)`,
    [req.params.id, tunnel_id, dk_number, status || 'working', current_task]
  )
  res.status(201).json({ ok: true })
})

export default router
