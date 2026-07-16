import { Router } from 'express'
import { query } from '../db/pool.js'

const router = Router()

// GET /api/config — 获取前端所需的全部公共配置（替代 Application.json）
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT config_key, config_value FROM system_config WHERE is_public = true`
  )
  const config = {}
  for (const r of rows) config[r.config_key] = r.config_value
  res.json(config)
})

// GET /api/config/admin — 管理员获取全部配置
router.get('/admin', async (req, res) => {
  const { rows } = await query(`SELECT * FROM system_config ORDER BY category, config_key`)
  res.json(rows)
})

export default router
