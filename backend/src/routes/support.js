import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/support?tunnel_id=
router.get('/', async (req, res) => {
  const { tunnel_id } = req.query
  let sql = `SELECT * FROM support_components`
  const params = []
  if (tunnel_id) { sql += ` WHERE tunnel_id = $1`; params.push(tunnel_id) }
  sql += ` ORDER BY start_dk, component_type`
  const { rows } = await query(sql, params)
  res.json(rows)
})

// GET /api/support/:id
router.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM support_components WHERE id = $1`, [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// POST /api/support
router.post('/', async (req, res) => {
  const s = req.body
  const { rows } = await query(
    `INSERT INTO support_components (tunnel_id, component_type, material_spec, dimensions, quantity,
     install_date, install_crew, start_dk, end_dk, completion_pct, glb_model_url, is_visible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [s.tunnel_id, s.component_type, s.material_spec, JSON.stringify(s.dimensions || {}), s.quantity,
     s.install_date, s.install_crew, s.start_dk, s.end_dk, s.completion_pct || 0,
     s.glb_model_url, s.is_visible || false]
  )
  res.status(201).json(rows[0])
})

// PUT /api/support/:id
router.put('/:id', async (req, res) => {
  const s = req.body
  const { rows } = await query(
    `UPDATE support_components SET completion_pct=$2, quality_grade=$3, measured_mean=$4,
     measured_min=$5, inspection_date=$6, is_visible=$7
     WHERE id=$1 RETURNING *`,
    [req.params.id, s.completion_pct, s.quality_grade, s.measured_mean, s.measured_min,
     s.inspection_date, s.is_visible]
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

export default router
