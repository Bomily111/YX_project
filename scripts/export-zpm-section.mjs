import { build } from 'esbuild'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

// Reuse the support editor's geometry source; this export is its existing partial Z-PM section.
const temp = await mkdtemp(join(tmpdir(), 'zpm-section-'))
try {
  const modulePath = join(temp, 'geometry.mjs')
  await build({
    entryPoints: ['public/support-modeler/demo/v1_2/zpm_lining_geometry.js'],
    outfile: modulePath, bundle: true, platform: 'node', format: 'esm',
  })
  const { createZpmAssembly } = await import(pathToFileURL(modulePath).href)
  const { group, validation } = createZpmAssembly()
  if (validation.status !== 'PARTIAL') throw new Error('Unexpected Z-PM assembly status')
  globalThis.FileReader = class {
    result = null
    onloadend = null
    async readAsArrayBuffer(blob) {
      this.result = await blob.arrayBuffer()
      this.onloadend?.()
    }
  }
  const binary = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: true })
  await writeFile('public/support-modeler/outputs/master_demo/Z-PM_support_1m_partial.glb', Buffer.from(binary))
  console.log(`Exported Z-PM partial section: ${binary.byteLength} bytes`)
} finally {
  await rm(temp, { recursive: true, force: true })
}
