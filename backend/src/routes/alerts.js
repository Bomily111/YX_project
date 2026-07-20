import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/alerts?active=true&tunnel_id=&level=&scene_key=
router.get('/', async (req, res) => {
  const { active, tunnel_id, level, scene_key, limit } = req.query
  const conditions = []
  const params = []
  let join = ''

  if (active === 'true') conditions.push(`a.is_active = true`)
  if (tunnel_id) { conditions.push(`a.tunnel_id = $${params.length + 1}`); params.push(tunnel_id) }
  if (level) { conditions.push(`a.level = $${params.length + 1}`); params.push(level) }
  if (scene_key) {
    join = `JOIN monitoring_configs mc ON a.entity_type = 'monitoring_config' AND a.entity_id::uuid = mc.id`
    conditions.push(`mc.scene_key = $${params.length + 1}`)
    params.push(scene_key)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { rows } = await query(
    `SELECT a.* FROM alerts a ${join} ${where} ORDER BY a.created_at DESC LIMIT $${params.length + 1}`,
    [...params, parseInt(limit) || 50]
  )
  res.json(rows)
})

// POST /api/alerts
router.post('/', async (req, res) => {
  const { entity_type, entity_id, title, description, level, tunnel_id, dk_number } = req.body
  const { rows } = await query(
    `INSERT INTO alerts (entity_type, entity_id, title, description, level, tunnel_id, dk_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [entity_type, entity_id, title, description, level, tunnel_id, dk_number]
  )
  res.status(201).json(rows[0])
})

// PUT /api/alerts/:id/acknowledge
router.put('/:id/acknowledge', async (req, res) => {
  const { rows } = await query(
    `UPDATE alerts SET acknowledged_by = $2, acknowledged_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, req.body.user || 'system']
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', async (req, res) => {
  const { rows } = await query(
    `UPDATE alerts SET is_active = false, resolved_at = NOW(), resolution_note = $2
     WHERE id = $1 RETURNING *`,
    [req.params.id, req.body.note]
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

export default router
