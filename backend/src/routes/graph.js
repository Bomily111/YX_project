import { Router } from 'express'
import { run, verify } from '../db/neo4j.js'

const router = Router()

// GET /api/graph/health
router.get('/health', async (req, res) => {
  const ok = await verify()
  if (ok) return res.json({ neo4j: 'connected' })
  // 重试一次获取具体错误信息
  try {
    const neo4j = await import('../db/neo4j.js')
    await neo4j.run('MATCH (n) RETURN count(n) AS c LIMIT 1')
  } catch (e) {
    return res.json({ neo4j: 'disconnected', error: e.message })
  }
  res.json({ neo4j: 'disconnected' })
})

// GET /api/graph/risks/:worksiteId — 工作面前方地质风险
router.get('/risks/:worksiteId', async (req, res) => {
  try {
    const records = await run(
      `MATCH (gm:GeoModel)-[:AFFECTS]->(w:Worksite {id: $id})
       WHERE gm.endDk >= w.dkNumber
       RETURN gm.name AS name, gm.typeName AS type, gm.typeCode AS code,
              gm.startDk AS startDk, gm.endDk AS endDk,
              gm.startDk - w.dkNumber AS aheadByM
       ORDER BY aheadByM`,
      { id: req.params.worksiteId }
    )
    res.json(records)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/graph/topology/:tunnelId — 隧道拓扑
router.get('/topology/:tunnelId', async (req, res) => {
  try {
    const records = await run(
      `MATCH (t:Tunnel {id: $id})
       OPTIONAL MATCH (t)<-[:BELONGS_TO]-(w:Worksite)
       OPTIONAL MATCH (t)<-[:IN_TUNNEL]-(gm:GeoModel)
       RETURN t.name AS tunnel,
              collect(DISTINCT {name: w.name, dk: w.dkNumber}) AS worksites,
              collect(DISTINCT {name: gm.name, type: gm.typeCode, range: toString(gm.startDk) + '~' + toString(gm.endDk)}) AS geoModels`,
      { id: req.params.tunnelId }
    )
    res.json(records[0] || {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/graph/intersections — 相邻/相交的地质特征
router.get('/intersections', async (req, res) => {
  try {
    const records = await run(
      `MATCH (a:GeoModel)-[r:ADJACENT_TO]->(b:GeoModel)
       RETURN a.name AS modelA, a.typeCode AS typeA,
              b.name AS modelB, b.typeCode AS typeB,
              r.overlap AS overlapM`
    )
    res.json(records)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/graph/near-face/:worksiteId — 掌子面前方 n 米内所有地质特征
router.get('/near-face/:worksiteId', async (req, res) => {
  try {
    const radius = parseFloat(req.query.radius) || 50
    const records = await run(
      `MATCH (w:Worksite {id: $id})
       MATCH (gm:GeoModel)-[:IN_TUNNEL]->(t:Tunnel)<-[:BELONGS_TO]-(w)
       WHERE gm.startDk <= w.dkNumber + $radius AND gm.endDk >= w.dkNumber - $radius
       RETURN gm.name AS name, gm.typeName AS typeName, gm.typeCode AS typeCode,
              gm.startDk AS startDk, gm.endDk AS endDk,
              gm.startDk - w.dkNumber AS aheadByM
       ORDER BY aheadByM`,
      { id: req.params.worksiteId, radius }
    )
    res.json(records)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
