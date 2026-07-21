import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/jobs?status=
router.get('/', async (req, res) => {
  const { status, model_type_code } = req.query
  let sql = `SELECT * FROM processing_jobs WHERE 1=1`
  const params = []
  let n = 1
  if (model_type_code) { sql += ` AND model_type_code = $${n++}`; params.push(model_type_code) }
  if (status) { sql += ` AND status = $${n++}`; params.push(status) }
  sql += ` ORDER BY created_at DESC LIMIT 50`
  const { rows } = await query(sql, params)
  res.json(rows)
})

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  const { rows } = await query(`SELECT * FROM processing_jobs WHERE id = $1`, [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// POST /api/jobs
router.post('/', async (req, res) => {
  const { model_type_code, tunnel_id, input_files } = req.body
  const { rows } = await query(
    `INSERT INTO processing_jobs (model_type_code, tunnel_id, input_files)
     VALUES ($1, $2, $3) RETURNING *`,
    [model_type_code, tunnel_id, JSON.stringify(input_files || [])]
  )
  res.status(201).json(rows[0])
})

// PUT /api/jobs/:id — 更新进度（替代内存 job store）
router.put('/:id', async (req, res) => {
  const { status, progress, status_message, output_files, error_message, result_model_instance_id } = req.body
  const updates = []
  const params = [req.params.id]
  let i = 2

  if (status !== undefined) { updates.push(`status = $${i++}`); params.push(status) }
  if (progress !== undefined) { updates.push(`progress = $${i++}`); params.push(progress) }
  if (status_message !== undefined) { updates.push(`status_message = $${i++}`); params.push(status_message) }
  if (output_files !== undefined) { updates.push(`output_files = $${i++}`); params.push(JSON.stringify(output_files)) }
  if (error_message !== undefined) { updates.push(`error_message = $${i++}`); params.push(error_message) }
  if (result_model_instance_id !== undefined) { updates.push(`result_model_instance_id = $${i++}`); params.push(result_model_instance_id) }

  if (status === 'processing' && !updates.find(u => u.includes('started_at')))
    updates.push(`started_at = COALESCE(started_at, NOW())`)
  if (status === 'complete' || status === 'error')
    updates.push(`completed_at = NOW()`)

  const { rows } = await query(
    `UPDATE processing_jobs SET ${updates.join(', ')} WHERE id = $1 RETURNING *`, params
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

export default router
