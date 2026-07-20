import neo4j from 'neo4j-driver'

let _password = null

async function getPassword() {
  if (_password) return _password
  // 先从数据库 system_config 取
  try {
    const { default: pgPool } = await import('./pool.js')
    const { rows } = await pgPool.query(`SELECT config_value FROM system_config WHERE config_key = 'neo4j_password'`)
    if (rows.length) { _password = rows[0].config_value; return _password }
  } catch {}
  // 再读环境变量
  _password = process.env.NEO4J_PASSWORD || 'neo4j'
  return _password
}

let driver = null

async function getDriver() {
  if (driver) return driver
  const pwd = await getPassword()
  driver = neo4j.driver(
    process.env.NEO4J_URL || 'bolt://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', pwd)
  )
  return driver
}

export async function run(cypher, params = {}) {
  const d = await getDriver()
  const session = d.session()
  try {
    const result = await session.run(cypher, params)
    return result.records.map(r => {
      const obj = {}
      for (const key of r.keys) {
        const val = r.get(key)
        obj[key] = val?.properties
          ? { _type: val.labels?.[0], ...val.properties }
          : val
      }
      return obj
    })
  } finally {
    await session.close()
  }
}

export async function verify() {
  try {
    await run('MATCH (n) RETURN count(n) AS c LIMIT 1')
    return true
  } catch {
    return false
  }
}

export default { run, verify }
