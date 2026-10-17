import { Router } from 'express'
import { query } from '../../db/pool.js'

const router = Router()
const text = (value, max = 300) => typeof value === 'string' && value.length > 0 && value.length <= max
const jsonObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const validDataVersion = (value) => jsonObject(value)
  && text(value.sourceId, 120) && text(value.locator, 500)
  && ['sha256-json-v1', 'fnv1a64-json-v1', 'sha256-bytes-v1'].includes(value.algorithm)
  && typeof value.digest === 'string'
  && (value.algorithm === 'fnv1a64-json-v1' ? /^[a-f0-9]{16}$/ : /^[a-f0-9]{64}$/).test(value.digest)
  && text(value.capturedAt, 60) && !Number.isNaN(Date.parse(value.capturedAt))

router.post('/task-runs', async (req, res) => {
  const { task, workflowPlan, scenePlans = [] } = req.body ?? {}
  if (!jsonObject(task) || !text(task.taskId, 120) || !text(task.taskType, 60)
    || !text(task.description, 2000) || !text(task.tunnelId, 120)
    || !finite(task.chainageRange?.start) || !finite(task.chainageRange?.end)
    || !jsonObject(workflowPlan) || workflowPlan.taskId !== task.taskId
    || !Array.isArray(workflowPlan.steps) || !Array.isArray(scenePlans)) {
    return res.status(400).json({ error: '无效的任务运行记录' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO task_runs
       (task_id, task_type, description, tunnel_id, chainage_start, chainage_end,
        task_context, workflow_plan, scene_plans, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,'ready')
       ON CONFLICT (task_id) DO NOTHING
       RETURNING task_id, status, created_at`,
      [task.taskId, task.taskType, task.description, task.tunnelId,
        task.chainageRange.start, task.chainageRange.end,
        JSON.stringify(task), JSON.stringify(workflowPlan), JSON.stringify(scenePlans)],
    )
    if (!rows.length) return res.status(409).json({ error: '任务 ID 已存在' })
    return res.status(201).json(rows[0])
  } catch (error) {
    console.error('[TaskAudit] 保存任务失败:', error)
    return res.status(503).json({ error: '任务审计存储不可用' })
  }
})

router.post('/task-events', async (req, res) => {
  const event = req.body ?? {}
  if ((event.taskId !== undefined && !text(event.taskId, 120))
    || !['agent', 'panel', 'system'].includes(event.source)
    || !text(event.action, 120) || !text(event.status, 60)
    || (event.callId !== undefined && !text(event.callId, 200))
    || (event.stepId !== undefined && !text(event.stepId, 200))
    || (event.durationMs !== undefined && (!finite(event.durationMs) || event.durationMs < 0))
    || (event.rollbackStatus !== undefined && !text(event.rollbackStatus, 60))
    || !jsonObject(event.inputSummary ?? {}) || !jsonObject(event.resultSummary ?? {})) {
    return res.status(400).json({ error: '无效的任务审计事件' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO task_audit_events
       (task_id, source, action, call_id, step_id, status, duration_ms,
        input_summary, result_summary, rollback_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)
       ON CONFLICT (call_id) WHERE call_id IS NOT NULL DO NOTHING
       RETURNING id, created_at`,
      [event.taskId ?? null, event.source, event.action, event.callId ?? null,
        event.stepId ?? null, event.status, event.durationMs ?? null,
        JSON.stringify(event.inputSummary ?? {}), JSON.stringify(event.resultSummary ?? {}),
        event.rollbackStatus ?? null],
    )
    if (!rows.length) return res.status(409).json({ error: '工具调用 ID 已记录' })
    if (event.taskId && ['ready', 'running', 'completed', 'failed'].includes(event.resultSummary?.taskStatus)) {
      await query('UPDATE task_runs SET status=$2, updated_at=NOW() WHERE task_id=$1',
        [event.taskId, event.resultSummary.taskStatus])
    }
    return res.status(201).json(rows[0])
  } catch (error) {
    console.error('[TaskAudit] 保存事件失败:', error)
    return res.status(503).json({ error: '任务审计存储不可用' })
  }
})

router.post('/task-snapshots', async (req, res) => {
  const snapshot = req.body ?? {}
  if (!text(snapshot.taskId, 120)
    || !['prepared', 'step-completed', 'step-failed', 'retry', 'reset', 'asset-selection'].includes(snapshot.eventType)
    || (snapshot.stepId !== undefined && !text(snapshot.stepId, 200))
    || !jsonObject(snapshot.workflowState)
    || !['ready', 'running', 'completed', 'failed'].includes(snapshot.workflowState.status)
    || !Array.isArray(snapshot.workflowState.steps)
    || !jsonObject(snapshot.workflowState.sharedContext)
    || (snapshot.scenePlan !== null && snapshot.scenePlan !== undefined && !jsonObject(snapshot.scenePlan))
    || (snapshot.enhancementPlan !== null && snapshot.enhancementPlan !== undefined && !jsonObject(snapshot.enhancementPlan))
    || !Array.isArray(snapshot.resources)
    || !Array.isArray(snapshot.dataVersions ?? [])
    || !(snapshot.dataVersions ?? []).every(validDataVersion)) {
    return res.status(400).json({ error: '无效的任务结果快照' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO task_run_snapshots
       (task_id, event_type, step_id, workflow_state, scene_plan, enhancement_plan, resources, data_versions)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)
       RETURNING id, created_at`,
      [snapshot.taskId, snapshot.eventType, snapshot.stepId ?? null,
        JSON.stringify(snapshot.workflowState), JSON.stringify(snapshot.scenePlan ?? null),
        JSON.stringify(snapshot.enhancementPlan ?? null), JSON.stringify(snapshot.resources),
        JSON.stringify(snapshot.dataVersions ?? [])],
    )
    return res.status(201).json(rows[0])
  } catch (error) {
    console.error('[TaskAudit] 保存结果快照失败:', error)
    return res.status(503).json({ error: '任务结果快照存储不可用' })
  }
})

router.get('/task-runs', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 30))
  try {
    const { rows } = await query(
      `SELECT task_id, task_type, description, tunnel_id, chainage_start,
              chainage_end, status, created_at, updated_at
       FROM task_runs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    )
    return res.json(rows)
  } catch (error) {
    console.error('[TaskAudit] 查询任务列表失败:', error)
    return res.status(503).json({ error: '任务审计存储不可用' })
  }
})

router.get('/task-runs/:taskId', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM task_runs WHERE task_id=$1', [req.params.taskId])
    if (!rows.length) return res.status(404).json({ error: '任务运行记录不存在' })
    const events = await query(
      'SELECT * FROM task_audit_events WHERE task_id=$1 ORDER BY id ASC',
      [req.params.taskId],
    )
    return res.json({ run: rows[0], events: events.rows })
  } catch (error) {
    console.error('[TaskAudit] 查询任务失败:', error)
    return res.status(503).json({ error: '任务审计存储不可用' })
  }
})

router.get('/task-runs/:taskId/snapshots', async (req, res) => {
  try {
    const run = await query('SELECT task_id FROM task_runs WHERE task_id=$1', [req.params.taskId])
    if (!run.rows.length) return res.status(404).json({ error: '任务运行记录不存在' })
    const { rows } = await query(
      `SELECT id, task_id, event_type, step_id, workflow_state, scene_plan,
              enhancement_plan, resources, data_versions, created_at
       FROM task_run_snapshots WHERE task_id=$1 ORDER BY id ASC`,
      [req.params.taskId],
    )
    return res.json(rows)
  } catch (error) {
    console.error('[TaskAudit] 查询结果快照失败:', error)
    return res.status(503).json({ error: '任务结果快照存储不可用' })
  }
})

export default router
