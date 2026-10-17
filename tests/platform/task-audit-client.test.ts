import { afterEach, describe, expect, it, vi } from 'vitest'
import { listTaskRuns, listTaskSnapshots, recordTaskEvent, recordTaskSnapshot, summarizeAuditValue } from '@/platform/telemetry/TaskAuditClient'

afterEach(() => vi.unstubAllGlobals())

describe('task audit client', () => {
  it('sends a structured event and surfaces a failed persistence response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: '任务审计存储不可用' }) })
    vi.stubGlobal('fetch', fetchMock)
    const event = {
      taskId: 'quality-1', source: 'agent' as const, action: 'execute_task_step',
      callId: 'call-1', stepId: 'quality-1:rock', status: 'completed',
      durationMs: 12, inputSummary: { chainage: 278330 },
    }
    await recordTaskEvent(event)
    expect(fetchMock).toHaveBeenCalledWith('/api/ai-agent/task-events', expect.objectContaining({
      method: 'POST', body: JSON.stringify(event),
    }))
    await expect(recordTaskEvent(event)).rejects.toThrow('任务审计存储不可用')
  })

  it('bounds audit payloads and redacts nested credentials', () => {
    expect(summarizeAuditValue({
      description: 'x'.repeat(400),
      nested: { apiKey: 'secret', token: 'secret', valid: 278330 },
      list: Array.from({ length: 25 }, (_, index) => index),
    })).toEqual({
      description: 'x'.repeat(300),
      nested: { apiKey: '[redacted]', token: '[redacted]', valid: 278330 },
      list: Array.from({ length: 20 }, (_, index) => index),
    })
  })

  it('writes a result snapshot and reads ordered history through encoded task IDs', async () => {
    const rows = [{ id: 1, event_type: 'prepared' }, { id: 2, event_type: 'step-completed' }]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ task_id: 'quality/1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => rows })
    vi.stubGlobal('fetch', fetchMock)
    const snapshot = {
      taskId: 'quality/1', eventType: 'prepared' as const,
      workflowState: { status: 'ready' as const, completed: 0, failed: 0, skipped: 0, total: 1, steps: [], sharedContext: {} },
      scenePlan: null, enhancementPlan: null, resources: [], dataVersions: [],
    }
    await recordTaskSnapshot(snapshot)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/ai-agent/task-snapshots', expect.objectContaining({
      method: 'POST', body: JSON.stringify(snapshot),
    }))
    await listTaskRuns()
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/ai-agent/task-runs?limit=20')
    expect(await listTaskSnapshots('quality/1')).toEqual(rows)
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/ai-agent/task-runs/quality%2F1/snapshots')
  })
})
