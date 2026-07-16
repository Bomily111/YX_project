import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query } from '../db/pool.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'tunnel-dt-secret-change-in-production'
const JWT_EXPIRES = '24h'

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const { rows } = await query(`SELECT * FROM users WHERE username = $1 AND is_active = true`, [username])
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' })

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body
    const hash = await bcrypt.hash(password, 12)
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, display_name, role`,
      [username, hash, display_name || username, role || 'viewer']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' })
    res.status(500).json({ error: err.message })
  }
})

export default router
