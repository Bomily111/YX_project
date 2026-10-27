import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pool, { query } from '../src/db/pool.js'

const option = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const output = option('--out')
const limit = Number(option('--limit') ?? 1000)
if (!output || !Number.isInteger(limit) || limit < 1 || limit > 10000) {
  console.error('用法：npm run agent:export-trajectories -- --out <本地JSONL路径> [--limit 1..10000]')
  process.exitCode = 2
} else {
  try {
    const { rows } = await query(
      `SELECT r.task_id, r.task_type, r.description, e.id AS event_id,
              e.input_summary, e.result_summary, e.status, e.created_at
       FROM task_audit_events e JOIN task_runs r ON r.task_id=e.task_id
       WHERE e.source='agent' AND e.action='orchestrate_platform_task'
         AND e.input_summary->>'kind'=r.task_type
         AND jsonb_typeof(e.result_summary->'dispatchTrace')='array'
       ORDER BY e.id DESC LIMIT $1`,
      [limit],
    )
    const records = rows.reverse().map(row => ({
      schemaVersion: 1,
      taskId: row.task_id,
      eventId: row.event_id,
      observedAt: row.created_at,
      goal: row.description,
      taskType: row.task_type,
      modelDecision: {
        requestedTool: row.input_summary?.modelTool,
        selectedResources: row.input_summary?.resourceIds ?? [],
        intentRouted: row.input_summary?.intentRouted === true,
      },
      platformFeedback: {
        status: row.status,
        completed: row.result_summary?.completed ?? 0,
        total: row.result_summary?.total ?? 0,
        stopReason: row.result_summary?.stopReason ?? null,
        dispatchTrace: row.result_summary?.dispatchTrace ?? [],
      },
    }))
    await writeFile(resolve(output), records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''), 'utf8')
    console.log(`已导出 ${records.length} 条智能体调度轨迹。`)
  } catch (error) {
    console.error('导出失败：', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
