import { Router } from 'express'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const router = Router()
const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../support-modeler-runtime/SupportModelV13.exe')
const port = Number(process.env.SUPPORT_MODELER_PORT || 18080)
const origin = `http://127.0.0.1:${port}`
let child
let startup

async function isReady() {
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })
    const health = await response.json()
    return response.ok && health.service === 'SupportParameterExtractorV13'
  } catch {
    return false
  }
}

async function ensureRuntime() {
  if (await isReady()) return
  if (!existsSync(runtime)) throw new Error('支护建模运行包缺失')
  if (!startup) {
    startup = (async () => {
      child = spawn(runtime, ['--port', String(port)], {
        cwd: path.dirname(runtime),
        windowsHide: true,
        stdio: 'ignore',
      })
      child.once('exit', () => { child = undefined })
      for (let attempt = 0; attempt < 60; attempt++) {
        if (await isReady()) return
        if (!child) break
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      throw new Error('支护建模服务启动失败')
    })().finally(() => { startup = undefined })
  }
  await startup
}

router.all('/master/:action', async (req, res) => {
  const action = req.params.action
  if (!((action === 'drawing' && req.method === 'POST') || (action === 'demo-cache' && req.method === 'GET'))) {
    return res.sendStatus(404)
  }
  try {
    await ensureRuntime()
    const upstream = await fetch(`${origin}/api/master/${action}`, {
      method: req.method,
      headers: req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {},
      body: req.method === 'POST' ? req : undefined,
      duplex: req.method === 'POST' ? 'half' : undefined,
    })
    res.status(upstream.status)
    res.type(upstream.headers.get('content-type') || 'application/json')
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    res.status(503).json({ status: 'error', error_code: 'SUPPORT_MODELER_UNAVAILABLE', message: error.message })
  }
})

router.get('/health', async (_req, res) => {
  try {
    await ensureRuntime()
    const upstream = await fetch(`${origin}/api/health`)
    res.status(upstream.status).json(await upstream.json())
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message })
  }
})

export default router

process.once('exit', () => { child?.kill() })
