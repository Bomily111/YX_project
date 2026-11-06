import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
const root = process.env.SOAK_OUTPUT_DIR || 'docs/verification/soak-2026-11-06'
await mkdir(root, { recursive: true })
const deadline = Number(process.env.SOAK_DEADLINE_MS)
if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new Error('Set a future SOAK_DEADLINE_MS')
const report = { startedAt: new Date().toISOString(), rounds: [], passed: false }
while (Date.now() < deadline) {
  const round = report.rounds.length + 1
  const started = Date.now()
  const output = `${root}/round-${round}`
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, ['scripts/verify-agent-acceptance.mjs'], {
      env: { ...process.env, ACCEPTANCE_OUTPUT_DIR: output, ACCEPTANCE_NO_SCREENSHOTS: '1' }, stdio: 'inherit', windowsHide: true,
    })
    const timer = setTimeout(() => { child.kill(); }, 420000)
    child.on('exit', code => { clearTimeout(timer); resolve(code) })
  })
  report.rounds.push({ round, code, elapsedMs: Date.now() - started, report: `${output}/report.json` })
  await writeFile(`${root}/report.json`, JSON.stringify(report, null, 2))
  console.log(`SOAK round=${round} exit=${code} remainingSeconds=${Math.max(0, Math.round((deadline-Date.now())/1000))}`)
  if (code !== 0) { report.failure = `Round ${round} failed`; break }
}
report.finishedAt = new Date().toISOString()
report.passed = !report.failure && report.rounds.length > 0
await writeFile(`${root}/report.json`, JSON.stringify(report, null, 2))
if (!report.passed) process.exitCode = 1
