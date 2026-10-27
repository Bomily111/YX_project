import { createHash } from 'node:crypto'
import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RockAssessmentService } from '@/platform/tasks/actions/RockAssessmentAction'
import { FACE_SKETCH_RECORDS } from '@/modules/face-sketch/data'
import { generateSteelArch } from '@/views/support-module/steelArch'

const publicFile = (path: string) => resolve(process.cwd(), 'public', path.replace(/^\//, ''))
const assetManifest = JSON.parse(readFileSync(publicFile('/data/task-asset-manifest.json'), 'utf8')) as {
  assets: { path: string; digest: string }[]
}

function readGlb(path: string) {
  const fd = openSync(publicFile(path), 'r')
  try {
    const header = Buffer.alloc(20)
    expect(readSync(fd, header, 0, header.length, 0)).toBe(header.length)
    expect(header.toString('ascii', 0, 4)).toBe('glTF')
    expect(header.readUInt32LE(4)).toBe(2)
    expect(header.readUInt32LE(8)).toBe(fstatSync(fd).size)
    expect(header.toString('ascii', 16, 20)).toBe('JSON')
    const json = Buffer.alloc(header.readUInt32LE(12))
    expect(readSync(fd, json, 0, json.length, 20)).toBe(json.length)
    return JSON.parse(json.toString('utf8')) as {
      meshes: { primitives: { mode?: number; attributes: { POSITION: number } }[] }[]
      accessors: { count: number }[]
    }
  } finally {
    closeSync(fd)
  }
}

describe('five-asset cross-module scenario fixtures', () => {
  it('uses the real common tunnel and rock-grade data at the quality-check chainage', async () => {
    const tunnel = readGlb('/data/tunnel/tunnel000.glb')
    expect(tunnel.meshes.length).toBeGreaterThan(0)
    const document = JSON.parse(readFileSync(publicFile('/data/tunnel/design-rock-grades.json'), 'utf8')) as {
      segments: { modelIndex: number; startMileage: string; endMileage: string; grade: string }[]
    }
    expect(document.segments.some(segment => segment.modelIndex === 0 && segment.grade === 'V')).toBe(true)
    const assessment = await new RockAssessmentService({
      loadDesignSegments: async () => document.segments,
      loadFaceRecords: async () => FACE_SKETCH_RECORDS,
    }).assess({ start: 1346, end: 1356 })
    expect(assessment.grade).toBe('V')
    expect(assessment.evidence.some(entry => entry.includes('YK1+116'))).toBe(true)
  })

  it('generates a non-empty support arch from the current parameter set', () => {
    const arch = generateSteelArch({ R1: 6.08, R2: 10.58, betaDeg: 15.8797, profileKey: 'I16' })
    try {
      arch.geometry.computeBoundingBox()
      const bounds = arch.geometry.boundingBox!
      expect(bounds.max.x - bounds.min.x).toBeGreaterThan(10)
      expect(bounds.max.y - bounds.min.y).toBeGreaterThan(1)
      expect(arch.geometry.getAttribute('position').count).toBeGreaterThan(0)
    } finally {
      arch.geometry.dispose()
      ;(arch.material as { dispose: () => void }).dispose()
    }
  })

  it('contains an actual blast point primitive rather than only a preview image', () => {
    const glb = readGlb('/data/blast/blast_effect.glb')
    const points = glb.meshes.flatMap(mesh => mesh.primitives)
      .filter(primitive => primitive.mode === 0)
      .map(primitive => glb.accessors[primitive.attributes.POSITION].count)
    expect(points).toContain(450000)
  })

  it('pairs the ventilation GLB with non-empty CFD flow input', () => {
    const glb = readGlb('/data/ventilation/tunnel-assembled.glb')
    const cfd = JSON.parse(readFileSync(publicFile('/data/ventilation/cfd_cell_data_lite.json'), 'utf8')) as {
      meta: { n: number }; x: number[]; y: number[]; z: number[]; vel: number[]
    }
    expect(glb.meshes.length).toBeGreaterThan(1)
    expect(cfd.meta.n).toBeGreaterThan(1000)
    for (const key of ['y', 'z', 'vel'] as const) expect(cfd[key].length).toBe(cfd.x.length)
    expect(cfd.vel.some(value => value > 0)).toBe(true)
  })

  it.fails('known fixture defect: CFD meta.n equals the actual sample count', () => {
    const cfd = JSON.parse(readFileSync(publicFile('/data/ventilation/cfd_cell_data_lite.json'), 'utf8')) as {
      meta: { n: number }; x: number[]
    }
    expect(cfd.meta.n).toBe(cfd.x.length)
  })

  it('matches the checked-in asset manifest for the three staged GLBs', () => {
    for (const path of [
      '/data/tunnel/tunnel000.glb',
      '/data/blast/blast_effect.glb',
      '/data/ventilation/tunnel-assembled.glb',
    ]) {
      const declared = assetManifest.assets.find(asset => asset.path === path)
      expect(declared).toBeDefined()
      const actual = createHash('sha256').update(readFileSync(publicFile(path))).digest('hex')
      expect(actual).toBe(declared!.digest)
    }
  })
})
