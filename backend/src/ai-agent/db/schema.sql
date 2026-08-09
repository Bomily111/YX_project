-- AI Agent 数据库表结构
-- 需要先启用 pgvector 扩展: CREATE EXTENSION IF NOT EXISTS vector;

-- 对话历史
CREATE TABLE IF NOT EXISTS agent_conversations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id),
    title       VARCHAR(300),
    messages    JSONB NOT NULL DEFAULT '[]',
    context     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 知识库文档
CREATE TABLE IF NOT EXISTS agent_kb_documents (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_file VARCHAR(500) NOT NULL,
    title       VARCHAR(300),
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    content_hash VARCHAR(64),
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 知识库向量（需要 pgvector 扩展）
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE TABLE IF NOT EXISTS agent_kb_embeddings (
--     id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     doc_id      UUID NOT NULL REFERENCES agent_kb_documents(id) ON DELETE CASCADE,
--     embedding   VECTOR(1536),
--     model_name  VARCHAR(100) NOT NULL,
--     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS idx_kb_embedding ON agent_kb_embeddings
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- 用户反馈
CREATE TABLE IF NOT EXISTS agent_feedback (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES agent_conversations(id),
    message_index   INTEGER NOT NULL,
    rating          SMALLINT CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 审计日志
CREATE TABLE IF NOT EXISTS agent_audit_log (
    id                  BIGSERIAL PRIMARY KEY,
    conversation_id     UUID,
    user_message        TEXT,
    assistant_response  TEXT,
    tools_called        JSONB,
    rag_chunks_used     JSONB,
    latency_ms          INTEGER,
    token_count         INTEGER,
    model               VARCHAR(50),
    provider            VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_conversations_updated_at ON agent_conversations;
CREATE TRIGGER trg_agent_conversations_updated_at
    BEFORE UPDATE ON agent_conversations
    FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();
