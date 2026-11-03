import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('delivered blast effect geometry', () => {
  it('contains a real POINTS cloud as well as blast-hole geometry', () => {
    const buffer = readFileSync('public/data/blast/blast_effect.glb')
    expect(buffer.toString('ascii', 0, 4)).toBe('glTF')
    const jsonLength = buffer.readUInt32LE(12)
    const document = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as {
      meshes: Array<{ name?: string; primitives: Array<{ mode?: number; attributes?: { POSITION?: number } }> }>
      accessors: Array<{ count: number }>
    }
    expect(document.meshes.find(mesh => mesh.name === 'holes')?.primitives.length).toBeGreaterThan(0)
    const cloud = document.meshes.find(mesh => mesh.name === 'pointcloud')
    expect(cloud?.primitives.some(primitive => primitive.mode === 0)).toBe(true)
    expect(document.accessors[cloud!.primitives[0].attributes!.POSITION!].count).toBe(450000)
  })
})
