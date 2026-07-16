import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/scenes — 所有场景定义 + 指标 + 状态项（替换 SceneDataPanel 硬编码 SCENE_DATA）
router.get('/', async (req, res) => {
  try {
    const [defs, metrics, statuses] = await Promise.all([
      query(`SELECT * FROM scene_definitions WHERE is_active = true ORDER BY sort_order`),
      query(`SELECT * FROM scene_metrics ORDER BY scene_key, display_order`),
      query(`SELECT * FROM scene_status_items ORDER BY scene_key, display_order`),
    ])

    const result = {}
    for (const d of defs.rows) {
      result[d.scene_key] = {
        ...d,
        metrics: metrics.rows.filter(m => m.scene_key === d.scene_key),
        statusList: statuses.rows.filter(s => s.scene_key === d.scene_key),
      }
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/scenes/:sceneKey
router.get('/:sceneKey', async (req, res) => {
  try {
    const [def, metrics, statuses] = await Promise.all([
      query(`SELECT * FROM scene_definitions WHERE scene_key = $1`, [req.params.sceneKey]),
      query(`SELECT * FROM scene_metrics WHERE scene_key = $1 ORDER BY display_order`, [req.params.sceneKey]),
      query(`SELECT * FROM scene_status_items WHERE scene_key = $1 ORDER BY display_order`, [req.params.sceneKey]),
    ])
    if (!def.rows.length) return res.status(404).json({ error: 'Scene not found' })
    res.json({ ...def.rows[0], metrics: metrics.rows, statusList: statuses.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
