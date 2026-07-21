import { Router } from 'express'
import { query } from '../db/pool.js'
import multer from 'multer'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = Router()

const TEMP_UPLOADS = path.resolve(__dirname, '../../temp/uploads')
const TEMP_INPUTS = path.resolve(__dirname, '../../temp/inputs')
fs.mkdirSync(TEMP_UPLOADS, { recursive: true })
fs.mkdirSync(TEMP_INPUTS, { recursive: true })

const upload = multer({ dest: TEMP_UPLOADS })
const PUBLIC_DATA = path.resolve(__dirname, '../../../public/data/tem_output')
const PYTHON_SCRIPT = path.resolve(__dirname, '../workers/tem/run_tem.py')

fs.mkdirSync(PUBLIC_DATA, { recursive: true })

// ── 运行中的子进程跟踪 ──────────────────────────────────
const runningJobs = new Map() // jobId → { proc, logLines }

// POST /api/process/tem — 上传文件并发起处理
router.post('/tem', upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files
    console.log('[process] 收到上传:', files?.length, '个文件')
    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请上传 .dat 数据文件' })
    }

    const jobId = crypto.randomUUID()
    const inputDir = path.join(TEMP_INPUTS, jobId)
    fs.mkdirSync(inputDir, { recursive: true })

    for (const f of files) {
      const dest = path.join(inputDir, f.originalname)
      fs.renameSync(f.path, dest)
    }
    console.log('[process] 文件已移至:', inputDir)

    const { rows } = await query(
      `INSERT INTO processing_jobs (model_type_code, input_files, status, status_message)
       VALUES ($1, $2, 'pending', '等待处理...') RETURNING id`,
      ['tem', JSON.stringify(files.map(f => f.originalname))]
    )
    const { id } = rows[0]
    console.log('[process] 任务创建:', id)

    await query(
      `UPDATE processing_jobs SET status='processing', progress=0, status_message='正在初始化Python处理...', started_at=NOW() WHERE id=$1`,
      [id]
    )

    const outputDir = path.join(PUBLIC_DATA, id)
    fs.mkdirSync(outputDir, { recursive: true })
    console.log('[process] 启动 Python:', PYTHON_SCRIPT)

    const proc = spawn('python', [
      PYTHON_SCRIPT,
      '--input', inputDir,
      '--job-id', id,
      '--output', PUBLIC_DATA,
    ], {
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    })

    const logs = []
    runningJobs.set(id, { proc, logs })

    let stdoutBuf = ''
    proc.stdout.on('data', (data) => {
      stdoutBuf += data.toString()
      const lines = stdoutBuf.split('\n')
      stdoutBuf = lines.pop() // 保留不完整的最后一行
      for (const line of lines) {
        if (!line.trim()) continue
        const trimmed = line.trim()
        if (trimmed.startsWith('LOG:')) {
          const msg = trimmed.slice(4)
          logs.push(msg)
          updateJobLog(id, logs).catch(() => {})
        } else if (trimmed.startsWith('PROGRESS:')) {
          const pct = parseInt(trimmed.slice(9)) || 0
          query(
            `UPDATE processing_jobs SET progress=$1 WHERE id=$2`,
            [pct, id]
          ).catch(() => {})
        } else if (trimmed === 'COMPLETE') {
          handleComplete(id, outputDir, logs)
        } else if (trimmed.startsWith('ERROR:')) {
          const msg = trimmed.slice(6)
          handleError(id, msg, logs)
        }
      }
    })

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim()
      if (msg) { logs.push(`[stderr] ${msg}`); updateJobLog(id, logs).catch(() => {}) }
    })

    proc.on('close', (code) => {
      if (code !== 0 && runningJobs.has(id)) {
        handleError(id, `Python 进程退出码: ${code}`, logs)
      }
      runningJobs.delete(id)
    })

    proc.on('error', (err) => {
      handleError(id, `无法启动 Python: ${err.message}`, logs)
      runningJobs.delete(id)
    })

    res.json({ jobId: id })
  } catch (err) {
    console.error('[process] POST /tem error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/process/status/:jobId — 查询任务状态
router.get('/status/:jobId', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT status, progress, status_message, processing_logs, error_message, output_files
       FROM processing_jobs WHERE id = $1`,
      [req.params.jobId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })

    const job = rows[0]
    const logLines = (job.processing_logs || [])
    const lastLog = Array.isArray(logLines) && logLines.length > 0
      ? logLines[logLines.length - 1]
      : ''

    res.json({
      status: job.status,
      progress: job.progress || 0,
      message: job.status_message || '',
      log: typeof lastLog === 'string' ? lastLog : '',
      error: job.error_message || '',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── 辅助函数 ──────────────────────────────────────────
async function updateJobLog(jobId, logs) {
  await query(
    `UPDATE processing_jobs SET processing_logs=$1 WHERE id=$2`,
    [JSON.stringify(logs.slice(-100)), jobId] // 保留最近100行
  )
}

async function handleComplete(jobId, outputDir, logs) {
  try {
    logs.push('处理完成!')

    const latestDir = path.join(PUBLIC_DATA, 'latest')
    try {
      fs.rmSync(latestDir, { recursive: true, force: true })
      fs.cpSync(outputDir, latestDir, { recursive: true })
      logs.push('已同步到 latest 目录')
    } catch (e) {
      logs.push(`[warn] 同步latest目录失败: ${e.message}`)
    }

    // 读 meta.json 获取摘要信息
    let meta = {}
    try { meta = JSON.parse(fs.readFileSync(path.join(outputDir, 'meta.json'), 'utf-8')) } catch {}

    await query(
      `UPDATE processing_jobs SET
         status='complete', progress=100,
         status_message='瞬变电磁数据处理完成',
         processing_logs=$1,
         output_files=$2,
         completed_at=NOW()
       WHERE id=$3`,
      [JSON.stringify(logs.slice(-100)), JSON.stringify({ output_dir: outputDir }), jobId]
    )

    // 更新数据集索引
    const indexPath = path.join(PUBLIC_DATA, 'index.json')
    let index = []
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) } catch {}
    index.unshift({
      jobId,
      createdAt: new Date().toISOString(),
      xRange: meta.x_range || [],
      yRange: meta.y_range || [],
      zRange: meta.z_range || [],
      anomalyCount: (meta.anomalies || []).length,
      kMean: meta.k_stats?.mean || 0,
    })
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2))
    // 清理临时上传文件
    const inputDir = path.join(TEMP_INPUTS, jobId)
    try { fs.rmSync(inputDir, { recursive: true, force: true }) } catch {}

    console.log(`[process] index.json updated with ${index.length} entries`)
    console.log(`[process] job ${jobId} complete → ${outputDir}`)
  } catch (e) {
    console.error(`[process] handleComplete error:`, e)
    logs.push(`完成处理出错: ${e.message}`)
    await query(
      `UPDATE processing_jobs SET status='error', error_message=$1, processing_logs=$2, completed_at=NOW() WHERE id=$3`,
      [e.message, JSON.stringify(logs.slice(-100)), jobId]
    )
  }
}

async function handleError(jobId, msg, logs) {
  logs.push(`错误: ${msg}`)
  await query(
    `UPDATE processing_jobs SET
       status='error', error_message=$1,
       processing_logs=$2,
       status_message='处理失败',
       completed_at=NOW()
     WHERE id=$3`,
    [msg, JSON.stringify(logs.slice(-100)), jobId]
  )
  console.error(`[process] job ${jobId} error: ${msg}`)
}

export default router
