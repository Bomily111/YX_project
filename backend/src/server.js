import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import tunnelsRouter from './routes/tunnels.js'
import monitoringRouter from './routes/monitoring.js'
import personnelRouter from './routes/personnel.js'
import equipmentRouter from './routes/equipment.js'
import blastRouter from './routes/blast.js'
import supportRouter from './routes/support.js'
import alertsRouter from './routes/alerts.js'
import jobsRouter from './routes/jobs.js'
import scenesRouter from './routes/scenes.js'
import authRouter from './routes/auth.js'
import configRouter from './routes/config.js'
import { authRequired } from './middleware/auth.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3000')

app.use(cors())
app.use(morgan('short'))
app.use(express.json({ limit: '10mb' }))

// ---- 公开路由 ----
app.use('/api/auth', authRouter)
app.use('/api/config', configRouter)

// ---- 受保护路由（生产环境取消注释）----
// app.use('/api', authRequired)

app.use('/api/tunnels', tunnelsRouter)
app.use('/api/monitoring', monitoringRouter)
app.use('/api/personnel', personnelRouter)
app.use('/api/equipment', equipmentRouter)
app.use('/api/blast', blastRouter)
app.use('/api/support', supportRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/scenes', scenesRouter)

// ---- 健康检查 ----
app.get('/api/health', async (req, res) => {
  try {
    const { default: pool } = await import('./db/pool.js')
    await pool.query('SELECT 1')
    res.json({ status: 'healthy', db: 'connected' })
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'disconnected', error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Tunnel DT backend running on http://localhost:${PORT}`)
  console.log(`API endpoints:`)
  console.log(`  GET  /api/health`)
  console.log(`  GET  /api/config`)
  console.log(`  POST /api/auth/login | /api/auth/register`)
  console.log(`  GET  /api/tunnels | /api/tunnels/:id`)
  console.log(`  GET  /api/tunnels/:id/worksites | /models | /mileage`)
  console.log(`  GET  /api/monitoring/configs | /readings | /readings/latest`)
  console.log(`  POST /api/monitoring/readings`)
  console.log(`  GET  /api/personnel | /personnel/status/current`)
  console.log(`  GET  /api/equipment | /equipment/status/current`)
  console.log(`  GET  /api/blast | POST /api/blast`)
  console.log(`  GET  /api/support | POST /api/support`)
  console.log(`  GET  /api/alerts | POST /api/alerts`)
  console.log(`  GET  /api/jobs | POST /api/jobs | PUT /api/jobs/:id`)
  console.log(`  GET  /api/scenes | /api/scenes/:sceneKey`)
})

export default app
