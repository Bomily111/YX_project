import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import pool from '../src/db/pool.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(resolve(scriptDir, '../src/db/003_task_audit.sql'), 'utf8')

try {
  await pool.query(sql)
  console.log('Task audit schema is ready')
} finally {
  await pool.end()
}
