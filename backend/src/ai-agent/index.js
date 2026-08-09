// ── AI Agent 后端入口 ────────────────────────────────────
// 注册 /api/ai-agent/* 路由到 Express

import { Router } from 'express'
import chatRouter from './routes/chat.js'

const router = Router()

// 聊天路由
router.use('/', chatRouter)

// 后续扩展：
// import conversationsRouter from './routes/conversations.js'
// import knowledgeRouter from './routes/knowledge.js'
// router.use('/conversations', conversationsRouter)
// router.use('/knowledge', knowledgeRouter)

export default router
