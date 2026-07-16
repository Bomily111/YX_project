import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/blast?worksite_id= — 爆破设计列表
router.get('/', async (req, res) => {
  const { worksite_id } = req.query
  let sql = `SELECT * FROM blast_designs`
  const params = []
  if (worksite_id) { sql += ` WHERE worksite_id = $1`; params.push(worksite_id) }
  sql += ` ORDER BY created_at DESC`
  const { rows } = await query(sql, params)
  res.json(rows)
})

// GET /api/blast/:id
router.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM blast_designs WHERE id = $1`, [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// POST /api/blast
router.post('/', async (req, res) => {
  const b = req.body
  const { rows } = await query(
    `INSERT INTO blast_designs (worksite_id, tunnel_id, dk_number, name, excavation_step,
     hole_depth_m, hole_diameter_mm, perimeter_holes, inner_holes, cut_holes, total_holes,
     charge_weight_kg, specific_charge_kgm3, detonation_sequence, risk_eval_score, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [b.worksite_id, b.tunnel_id, b.dk_number, b.name, b.excavation_step,
     b.hole_depth_m, b.hole_diameter_mm, b.perimeter_holes, b.inner_holes, b.cut_holes, b.total_holes,
     b.charge_weight_kg, b.specific_charge_kgm3, JSON.stringify(b.detonation_sequence || {}),
     b.risk_eval_score, b.status || 'draft']
  )
  res.status(201).json(rows[0])
})

// PUT /api/blast/:id
router.put('/:id', async (req, res) => {
  const b = req.body
  const { rows } = await query(
    `UPDATE blast_designs SET name=$2, hole_depth_m=$3, hole_diameter_mm=$4, total_holes=$5,
     charge_weight_kg=$6, specific_charge_kgm3=$7, detonation_sequence=$8,
     risk_eval_score=$9, risk_eval_result=$10, hole_diagram_url=$11, status=$12
     WHERE id=$1 RETURNING *`,
    [req.params.id, b.name, b.hole_depth_m, b.hole_diameter_mm, b.total_holes,
     b.charge_weight_kg, b.specific_charge_kgm3, JSON.stringify(b.detonation_sequence || {}),
     b.risk_eval_score, b.risk_eval_result, b.hole_diagram_url, b.status]
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

export default router
