-- 任务运行及工具/面板操作审计。task_id 使用前端已有的稳定字符串 ID。
CREATE TABLE IF NOT EXISTS task_runs (
  task_id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  description TEXT NOT NULL,
  tunnel_id TEXT NOT NULL,
  chainage_start DOUBLE PRECISION NOT NULL,
  chainage_end DOUBLE PRECISION NOT NULL,
  task_context JSONB NOT NULL,
  workflow_plan JSONB NOT NULL,
  scene_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_audit_events (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('agent', 'panel', 'system')),
  action TEXT NOT NULL,
  call_id TEXT,
  step_id TEXT,
  status TEXT NOT NULL,
  duration_ms DOUBLE PRECISION,
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_audit_task_time ON task_audit_events(task_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_audit_call_id ON task_audit_events(call_id) WHERE call_id IS NOT NULL;

-- 每次推进后的不可变结果视图；复位只追加新快照，不删除历史。
CREATE TABLE IF NOT EXISTS task_run_snapshots (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES task_runs(task_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('prepared', 'step-completed', 'step-failed', 'retry', 'reset')),
  step_id TEXT,
  workflow_state JSONB NOT NULL,
  scene_plan JSONB,
  enhancement_plan JSONB,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_snapshot_task_time ON task_run_snapshots(task_id, id);
ALTER TABLE task_run_snapshots ADD COLUMN IF NOT EXISTS data_versions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE task_run_snapshots DROP CONSTRAINT IF EXISTS task_run_snapshots_event_type_check;
ALTER TABLE task_run_snapshots ADD CONSTRAINT task_run_snapshots_event_type_check
  CHECK (event_type IN ('prepared', 'step-completed', 'step-failed', 'retry', 'reset', 'asset-selection'));
