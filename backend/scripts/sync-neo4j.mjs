/**
 * PostgreSQL → Neo4j 同步脚本
 * 创建图节点和关系：隧道、工点、地质模型、风险传播
 *
 * 用法: node scripts/sync-neo4j.mjs
 */

import pg from 'pg'
import neo4j from 'neo4j-driver'

const pgPool = new pg.Pool({
  host: '127.0.0.1', port: 5432, database: 'tunnel_dt',
  user: 'postgres', password: process.env.DB_PASSWORD || 'postgres',
})

const neo4jDriver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD || 'neo4j')
)

async function runCypher(cypher, params = {}) {
  const session = neo4jDriver.session()
  try { await session.run(cypher, params) }
  finally { await session.close() }
}

async function main() {
  console.log('=== PG → Neo4j 图数据同步 ===\n')

  // 清空旧图
  await runCypher('MATCH (n) DETACH DELETE n')
  console.log('✓ 清空旧图\n')

  // ── 隧道节点 ──
  const { rows: tunnels } = await pgPool.query(`SELECT id, name, code, start_mileage, end_mileage, length_m, status FROM tunnels`)
  for (const t of tunnels) {
    await runCypher(
      `CREATE (:Tunnel {id: $id, name: $name, code: $code, startDk: $start, endDk: $end, lengthM: $len, status: $status})`,
      { id: t.id, name: t.name, code: t.code, start: t.start_mileage, end: t.end_mileage, len: t.length_m, status: t.status }
    )
  }
  console.log(`✓ 隧道节点: ${tunnels.length}`)

  // ── 工点节点 + 关系 ──
  const { rows: worksites } = await pgPool.query(`SELECT id, tunnel_id, name, code, dk_number FROM worksites`)
  for (const w of worksites) {
    await runCypher(
      `MATCH (t:Tunnel {id: $tid})
       CREATE (w:Worksite {id: $id, name: $name, code: $code, dkNumber: $dk})
       CREATE (w)-[:BELONGS_TO]->(t)`,
      { tid: w.tunnel_id, id: w.id, name: w.name, code: w.code, dk: parseFloat(w.dk_number) }
    )
  }
  console.log(`✓ 工点节点: ${worksites.length}`)

  // ── 地质模型节点 + 关系 ──
  const { rows: models } = await pgPool.query(
    `SELECT gmi.id, gmi.tunnel_id, gmi.model_type_code, gmi.name, gmi.start_dk, gmi.end_dk, gmt.name_cn
     FROM geological_model_instances gmi JOIN geological_model_types gmt ON gmi.model_type_code = gmt.code
     WHERE gmi.is_active = true ORDER BY gmi.start_dk`
  )
  for (const m of models) {
    await runCypher(
      `MATCH (t:Tunnel {id: $tid})
       CREATE (gm:GeoModel {id: $id, name: $name, typeCode: $code, typeName: $cn, startDk: $s, endDk: $e})
       CREATE (gm)-[:IN_TUNNEL]->(t)`,
      { tid: m.tunnel_id, id: m.id, name: m.name, code: m.model_type_code, cn: m.name_cn, s: parseFloat(m.start_dk), e: parseFloat(m.end_dk) }
    )
  }
  console.log(`✓ 地质模型节点: ${models.length}`)

  // ── 地质模型相邻关系（按里程排序，相邻模型连边）──
  for (let i = 0; i < models.length - 1; i++) {
    const a = models[i], b = models[i + 1]
    if (a.tunnel_id === b.tunnel_id) {
      const overlap = parseFloat(a.end_dk) - parseFloat(b.start_dk)
      await runCypher(
        `MATCH (a:GeoModel {id: $a}), (b:GeoModel {id: $b})
         CREATE (a)-[:ADJACENT_TO {overlap: $ov}]->(b)`,
        { a: a.id, b: b.id, ov: Math.round(overlap * 100) / 100 }
      )
    }
  }
  console.log(`✓ 地质模型相邻关系`)

  // ── 风险影响关系（地质模型在工作面前方 → 影响工作面）──
  const highRisk = new Set(['water_zone', 'fracture_zone', 'weak_rock'])
  for (const w of worksites) {
    const wDk = parseFloat(w.dk_number)
    const ahead = models.filter(m => m.tunnel_id === w.tunnel_id && parseFloat(m.start_dk) <= wDk + 100 && parseFloat(m.end_dk) >= wDk)
    for (const m of ahead) {
      const dist = parseFloat(m.start_dk) - wDk
      await runCypher(
        `MATCH (gm:GeoModel {id: $mid}), (ws:Worksite {id: $wid})
         CREATE (gm)-[:AFFECTS {distanceM: $dist, risk: $risk}]->(ws)`,
        { mid: m.id, wid: w.id, dist: Math.round(dist * 100) / 100, risk: highRisk.has(m.model_type_code) ? 'high' : 'medium' }
      )
    }
  }
  console.log(`✓ 风险影响关系\n`)

  // 统计
  const { rows: [stats] } = await pgPool.query(`SELECT count(*) FROM (VALUES (1))`)
  const session = neo4jDriver.session()
  const nodeCount = await session.run('MATCH (n) RETURN count(n) AS c')
  const relCount = await session.run('MATCH ()-[r]->() RETURN count(r) AS c')
  await session.close()

  console.log(`=== 同步完成 ===`)
  console.log(`节点: ${nodeCount.records[0].get('c').toInt()}  /  关系: ${relCount.records[0].get('c').toInt()}`)

  await pgPool.end()
  await neo4jDriver.close()
}

main().catch(err => { console.error('同步失败:', err.message); process.exit(1) })
