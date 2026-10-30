import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'public/data/task-asset-manifest.json')
const modelerTypes = ['ZZ-II', 'ZZ-III', 'ZZ-IIIx', 'ZZ-IVa', 'ZZ-IVb', 'ZZ-IVc',
  'ZZ-IVsx', 'ZZ-IVx', 'ZZ-QJsx', 'ZZ-S', 'ZZ-Vsx', 'ZZ-Y1']
const paths = [
  '/data/geophysical_grade/fused_rock_grade_2345.json',
  '/data/geophysical_grade/fused_rock_grade_2345_volume.png',
  '/data/tsp_actual/hardness.json', '/data/tsp_actual/hardness_volume.png',
  '/data/tsp_actual/integrity.json', '/data/tsp_actual/integrity_volume.png',
  '/data/geophysical_tem/resistivity_contrast.json',
  '/data/geophysical_tem/resistivity_contrast_volume.png',
  ...modelerTypes.map(type => `/support-modeler/outputs/multi_support/${type}_support_1m.glb`),
  '/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb',
  ...Array.from({ length: 17 }, (_, index) =>
    `/data/tunnel/tunnel${String(index).padStart(3, '0')}.glb`),
  '/data/blast/blast_effect.glb',
  ...[
    'tunnel-assembled.glb',
    'cfd_cell_data_lite.json', 'cfd_arrows.json', 'co_transport_results.json',
    'transient_fan_ramp_up.json', 'transient_fan_oscillation.json',
    'transient_damper_close.json', 'transient_fan_shutdown.json', 'transient_combined.json',
    'cfd_transient_index.json', 'transient_thermal_monitors.json',
    ...[0, 100, 200, 300, 400, 600, 800, 1000].map(time => `cfd_transient_t${time}s.json`),
    'mid_tunnel_contour.png', 'axial_temperature_profile.png', 'cross_section_contours.png',
  ].map(name => `/data/ventilation/${name}`),
]

const digest = async (path) => {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(resolve(root, `public${path}`))) hash.update(chunk)
  return hash.digest('hex')
}

const assets = []
for (const path of paths) assets.push({ path, algorithm: 'sha256-bytes-v1', digest: await digest(path) })
const content = `${JSON.stringify({ schemaVersion: 1, assets }, null, 2)}\n`

if (process.argv.includes('--check')) {
  let existing
  try { existing = readFileSync(output, 'utf8') } catch { /* missing manifest */ }
  if (existing !== content) {
    console.error('Task asset manifest is missing or stale; run npm run assets:manifest')
    process.exitCode = 1
  } else {
    console.log(`Task asset manifest verified (${assets.length} files)`)
  }
} else {
  writeFileSync(output, content)
  console.log(`Task asset manifest updated (${assets.length} files)`)
}
