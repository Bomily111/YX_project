import * as Cesium from 'cesium'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneResource } from '@/platform/resources/types'
import { modelerSectionFrame } from './modeler-resources'
import { planAlternatingSupportSections } from './alternating-layout'

export const ALTERNATING_SUPPORT_ID = 'support.alternating-zz-va-z-pm'
const TUNNEL_SEGMENT_LENGTH = 500
const SUPPORT_WINDOW_LENGTH = 50
const START_CHAINAGE = 1116
const END_CHAINAGE = 9400
const urls = {
  'ZZ-Va': '/support-modeler/outputs/master_demo/ZZ-Va_support_1m_current.glb',
  'Z-PM': '/support-modeler/outputs/master_demo/Z-PM_support_1m_partial.glb',
} as const

export function tunnelSegmentSpanAt(chainage: number): { index: number; start: number; end: number } {
  if (!Number.isFinite(chainage) || chainage < START_CHAINAGE || chainage > END_CHAINAGE) {
    throw new Error(`目标里程不在平台隧道模型范围：${chainage}`)
  }
  const index = Math.min(16, Math.floor((chainage - START_CHAINAGE) / TUNNEL_SEGMENT_LENGTH))
  const start = START_CHAINAGE + index * TUNNEL_SEGMENT_LENGTH
  return { index, start, end: Math.min(start + TUNNEL_SEGMENT_LENGTH, END_CHAINAGE) }
}

/** Keep a 50 m assembly centered on the target, inside its one loaded tunnel segment. */
export function supportAssemblySpanAt(chainage: number): { index: number; start: number; end: number } {
  const segment = tunnelSegmentSpanAt(chainage)
  const start = Math.max(segment.start,
    Math.min(Math.floor(chainage) - SUPPORT_WINDOW_LENGTH / 2, segment.end - SUPPORT_WINDOW_LENGTH))
  return { index: segment.index, start, end: start + SUPPORT_WINDOW_LENGTH }
}

export function preparedMeshes(root: THREE.Group, type: keyof typeof urls): THREE.Mesh[] {
  root.updateMatrixWorld(true)
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return
    if (Array.isArray(object.material)) throw new Error(`${type} 含多材质网格，暂不能实例化`)
    const geometry = object.geometry.clone()
    geometry.applyMatrix4(object.matrixWorld)
    // Z-PM editor coordinates use design elevation y=0; ZZ-Va uses y=-2.1.
    if (type === 'Z-PM') geometry.translate(0, -2.1, 0)
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name)
    }
    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()
    // mergeGeometries requires a common index mode. Preserve indexed source
    // meshes so the 1 m section does not expand into repeated triangle vertices.
    if (!geometry.index) {
      const count = geometry.getAttribute('position').count
      geometry.setIndex(Array.from({ length: count }, (_, index) => index))
    }
    const geometries = buckets.get(object.material) ?? []
    geometries.push(geometry)
    buckets.set(object.material, geometries)
  })
  return [...buckets].map(([material, geometries], index) => {
    const geometry = mergeGeometries(geometries, false)
    if (!geometry) throw new Error(`${type} 第 ${index + 1} 组几何无法合并`)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `${type}-component-${index + 1}`
    return mesh
  })
}

export async function buildInstancedGlb(start: number, lengthM = SUPPORT_WINDOW_LENGTH): Promise<ArrayBuffer> {
  const placements = planAlternatingSupportSections(start, lengthM, ['ZZ-Va', 'Z-PM'])
  const loader = new GLTFLoader()
  const [va, zpm] = await Promise.all([loader.loadAsync(urls['ZZ-Va']), loader.loadAsync(urls['Z-PM'])])
  const root = new THREE.Group()
  const inverseStart = Cesium.Matrix4.inverseTransformation(modelerSectionFrame(start), new Cesium.Matrix4())
  for (const [type, source] of [['ZZ-Va', va], ['Z-PM', zpm]] as const) {
    const entries = placements.filter(row => row.supportType === type)
    const transforms = entries.map(entry => {
      const relative = Cesium.Matrix4.multiply(inverseStart, modelerSectionFrame(entry.chainage), new Cesium.Matrix4())
      return new THREE.Matrix4().fromArray(Cesium.Matrix4.toArray(relative, []))
    })
    const meshes = preparedMeshes(source.scene, type)
    for (const mesh of meshes) {
      const instances = new THREE.InstancedMesh(mesh.geometry, mesh.material, entries.length)
      instances.name = mesh.name
      transforms.forEach((matrix, index) => instances.setMatrixAt(index, matrix))
      instances.instanceMatrix.needsUpdate = true
      root.add(instances)
    }
  }
  return await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true }) as ArrayBuffer
}

let active: Cesium.Model | undefined
let activeViewer: Cesium.Viewer | undefined
let activeSpan: ReturnType<typeof supportAssemblySpanAt> | undefined
export const getActiveAlternatingSupportModel = (): Cesium.Model | undefined => active
export const getActiveAlternatingSupportSpan = (): { start: number; end: number; sections: number; zzVa: number; zPm: number } | undefined =>
  activeSpan ? { start: activeSpan.start, end: activeSpan.end,
    sections: activeSpan.end - activeSpan.start,
    zzVa: Math.ceil((activeSpan.end - activeSpan.start) / 2),
    zPm: Math.floor((activeSpan.end - activeSpan.start) / 2) } : undefined

export const alternatingSupportResource: SceneResource = {
  id: ALTERNATING_SUPPORT_ID, module: 'support', type: 'alternating-modeler-sections',
  chainageRange: { start: START_CHAINAGE, end: END_CHAINAGE },
  processes: ['support-design'], states: ['demonstration-assembly'], lifetime: 'task',
  estimatedMemoryMb: 80,
  async load(context) {
    const span = supportAssemblySpanAt(context.task?.chainageRange.start ?? START_CHAINAGE)
    const buffer = await buildInstancedGlb(span.start, span.end - span.start)
    if (context.signal?.aborted) throw new DOMException('支护装配已取消', 'AbortError')
    const objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }))
    try {
      const model = await Cesium.Model.fromGltfAsync({
        url: objectUrl, modelMatrix: modelerSectionFrame(span.start),
        upAxis: Cesium.Axis.Z, forwardAxis: Cesium.Axis.X,
      })
      if (context.signal?.aborted) { model.destroy(); throw new DOMException('支护装配已取消', 'AbortError') }
      if (active && activeViewer && !activeViewer.isDestroyed()) activeViewer.scene.primitives.remove(active)
      context.viewer.scene.primitives.add(model)
      active = model
      activeViewer = context.viewer
      activeSpan = span
      context.viewer.scene.requestRender()
    } finally { URL.revokeObjectURL(objectUrl) }
  },
  async activate() {},
  async update() {},
  async unload() {
    if (active && activeViewer && !activeViewer.isDestroyed()) activeViewer.scene.primitives.remove(active)
    active = undefined
    activeViewer = undefined
    activeSpan = undefined
  },
  getEnhanceTargets: () => active ? [{ id: ALTERNATING_SUPPORT_ID, type: 'support-segment', object: active,
    metadata: { supportTypes: ['ZZ-Va', 'Z-PM'], alternatingEveryM: 1,
      startChainage: activeSpan?.start, endChainage: activeSpan?.end,
      lengthM: activeSpan ? activeSpan.end - activeSpan.start : undefined,
      sectionCount: activeSpan ? activeSpan.end - activeSpan.start : undefined,
      zpmComponents: 'secondary lining and N1–N7 rebar; partial editor assembly',
      generatedForTask: false } }] : [],
  getActiveAssetPaths: () => active ? Object.values(urls) : [],
}
