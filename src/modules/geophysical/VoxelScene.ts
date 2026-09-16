import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { PreparedVoxelModel, RenderStatistics } from './types'

export type LayerKey = 'resistivity' | 'water' | 'grade2' | 'grade3' | 'grade4' | 'grade5'
export type PaletteName = 'viridis' | 'jet'
export type SliceAxis = 'none' | 'x' | 'y' | 'z'

const MAX_RENDER_INSTANCES_PER_LAYER = 180_000

const VIRIDIS_STOPS = [
  [0.0, 0x440154],
  [0.25, 0x3b528b],
  [0.5, 0x21918c],
  [0.75, 0x5ec962],
  [1.0, 0xfde725],
] as const

const JET_STOPS = [
  [0.0, 0x000080],
  [0.2, 0x006cff],
  [0.4, 0x00ffff],
  [0.6, 0x7dff00],
  [0.8, 0xffff00],
  [1.0, 0xff0000],
] as const

const GRADE_COLORS: Record<2 | 3 | 4 | 5, number> = {
  2: 0x5a9fc6,
  3: 0x244b78,
  4: 0xe8bd35,
  5: 0x8f3f20,
}

interface LayerRecord {
  mesh: THREE.InstancedMesh
  material: THREE.MeshBasicMaterial
}

function interpolateStops(value: number, stops: readonly (readonly [number, number])[], target: THREE.Color): THREE.Color {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  for (let index = 1; index < stops.length; index++) {
    const left = stops[index - 1]
    const right = stops[index]
    if (t <= right[0]) {
      const span = right[0] - left[0]
      const local = span > 0 ? (t - left[0]) / span : 0
      return target.setHex(left[1]).lerp(new THREE.Color(right[1]), local)
    }
  }
  return target.setHex(stops[stops.length - 1][1])
}

function scalarColor(value: number, min: number, max: number, palette: PaletteName, target: THREE.Color): THREE.Color {
  const normalized = max > min ? (value - min) / (max - min) : 0.5
  return interpolateStops(normalized, palette === 'jet' ? JET_STOPS : VIRIDIS_STOPS, target)
}

function emptyRenderStatistics(): RenderStatistics {
  return {
    resistivity: { available: 0, rendered: 0 },
    water: { available: 0, rendered: 0 },
    grades: {
      2: { available: 0, rendered: 0 },
      3: { available: 0, rendered: 0 },
      4: { available: 0, rendered: 0 },
      5: { available: 0, rendered: 0 },
    },
  }
}

export class VoxelScene {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10_000_000)
  private readonly renderer: THREE.WebGLRenderer
  private readonly controls: OrbitControls
  private readonly root = new THREE.Group()
  private readonly layers = new Map<LayerKey, LayerRecord>()
  private readonly visibility: Record<LayerKey, boolean> = {
    resistivity: true,
    water: false,
    grade2: false,
    grade3: false,
    grade4: false,
    grade5: false,
  }
  private readonly clippingPlane = new THREE.Plane()
  private readonly resizeObserver: ResizeObserver
  private animationFrame = 0
  private model: PreparedVoxelModel | null = null
  private geometry: THREE.BoxGeometry | null = null
  private boundsHelper: THREE.Box3Helper | null = null
  private palette: PaletteName = 'viridis'
  private sliceAxis: SliceAxis = 'none'
  private sliceFraction = 1

  constructor(private readonly container: HTMLElement) {
    this.scene.background = new THREE.Color(0x050b14)
    this.scene.add(this.root)
    this.scene.add(new THREE.HemisphereLight(0xd7f3ff, 0x17202b, 1.5))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6)
    keyLight.position.set(1, -1, 2)
    this.scene.add(keyLight)

    this.camera.up.set(0, 0, 1)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.localClippingEnabled = true
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.screenSpacePanning = true

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    this.resize()
    this.animate()
  }

  setModel(model: PreparedVoxelModel): RenderStatistics {
    this.clearModel()
    this.model = model
    this.geometry = new THREE.BoxGeometry(
      model.voxelSize[0] * 0.9,
      model.voxelSize[1] * 0.9,
      model.voxelSize[2] * 0.9,
    )

    const result = emptyRenderStatistics()
    result.resistivity = this.createLayer('resistivity', () => true, 0.68)
    result.water = this.createLayer('water', index => model.waterMask[index] === 1, 0.32)
    for (const grade of [2, 3, 4, 5] as const) {
      result.grades[grade] = this.createLayer(
        `grade${grade}`,
        index => model.grades[index] === grade,
        0.82,
      )
    }

    const half = new THREE.Vector3(
      Math.max((model.field.bounds.max[0] - model.field.bounds.min[0]) / 2, model.voxelSize[0] / 2),
      Math.max((model.field.bounds.max[1] - model.field.bounds.min[1]) / 2, model.voxelSize[1] / 2),
      Math.max((model.field.bounds.max[2] - model.field.bounds.min[2]) / 2, model.voxelSize[2] / 2),
    )
    const box = new THREE.Box3(half.clone().multiplyScalar(-1), half)
    this.boundsHelper = new THREE.Box3Helper(box, 0x31546c)
    this.root.add(this.boundsHelper)
    this.fitCamera(half)
    this.updateClipping()
    return result
  }

  setLayerVisible(layer: LayerKey, visible: boolean) {
    this.visibility[layer] = visible
    const record = this.layers.get(layer)
    if (record) record.mesh.visible = visible
  }

  setPalette(palette: PaletteName) {
    this.palette = palette
    const record = this.layers.get('resistivity')
    if (!record || !this.model) return
    const color = new THREE.Color()
    const range = this.model.field.valueRange
    for (let instance = 0; instance < record.mesh.count; instance++) {
      const sourceIndex = Number(record.mesh.userData.sourceIndices[instance])
      const rho = this.model.field.data[sourceIndex * 4 + 3]
      record.mesh.setColorAt(instance, scalarColor(rho, range[0], range[1], palette, color))
    }
    if (record.mesh.instanceColor) record.mesh.instanceColor.needsUpdate = true
  }

  setOpacity(layer: 'resistivity' | 'water' | 'grades', opacity: number) {
    const keys: LayerKey[] = layer === 'grades'
      ? ['grade2', 'grade3', 'grade4', 'grade5']
      : [layer]
    for (const key of keys) {
      const material = this.layers.get(key)?.material
      if (!material) continue
      material.opacity = THREE.MathUtils.clamp(opacity, 0.02, 1)
      material.transparent = material.opacity < 0.999
      material.needsUpdate = true
    }
  }

  setSlice(axis: SliceAxis, fraction: number) {
    this.sliceAxis = axis
    this.sliceFraction = THREE.MathUtils.clamp(fraction, 0, 1)
    this.updateClipping()
  }

  resetCamera() {
    if (!this.model) return
    const half = new THREE.Vector3(
      (this.model.field.bounds.max[0] - this.model.field.bounds.min[0]) / 2,
      (this.model.field.bounds.max[1] - this.model.field.bounds.min[1]) / 2,
      (this.model.field.bounds.max[2] - this.model.field.bounds.min[2]) / 2,
    )
    this.fitCamera(half)
  }

  dispose() {
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver.disconnect()
    this.clearModel()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private createLayer(
    key: LayerKey,
    predicate: (index: number) => boolean,
    opacity: number,
  ): { available: number; rendered: number } {
    if (!this.model || !this.geometry) return { available: 0, rendered: 0 }
    let available = 0
    for (let index = 0; index < this.model.field.count; index++) {
      if (predicate(index)) available++
    }
    if (available === 0) return { available: 0, rendered: 0 }

    const stride = Math.max(1, Math.ceil(available / MAX_RENDER_INSTANCES_PER_LAYER))
    const rendered = Math.ceil(available / stride)
    const material = new THREE.MeshBasicMaterial({
      transparent: opacity < 1,
      opacity,
      depthWrite: true,
      clippingPlanes: [],
    })
    const mesh = new THREE.InstancedMesh(this.geometry, material, rendered)
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    mesh.visible = this.visibility[key]
    mesh.renderOrder = key === 'water' ? 3 : key === 'resistivity' ? 1 : 2
    const sourceIndices = new Uint32Array(rendered)
    const transform = new THREE.Object3D()
    const color = new THREE.Color()
    const center = this.model.center
    const range = this.model.field.valueRange
    let matched = 0
    let instance = 0
    for (let index = 0; index < this.model.field.count && instance < rendered; index++) {
      if (!predicate(index)) continue
      if (matched++ % stride !== 0) continue
      const offset = index * 4
      transform.position.set(
        this.model.field.data[offset] - center[0],
        this.model.field.data[offset + 1] - center[1],
        this.model.field.data[offset + 2] - center[2],
      )
      transform.updateMatrix()
      mesh.setMatrixAt(instance, transform.matrix)
      if (key === 'resistivity') {
        mesh.setColorAt(instance, scalarColor(this.model.field.data[offset + 3], range[0], range[1], this.palette, color))
      } else if (key === 'water') {
        mesh.setColorAt(instance, color.setHex(0x16b9ff))
      } else {
        const grade = Number(key.slice(-1)) as 2 | 3 | 4 | 5
        mesh.setColorAt(instance, color.setHex(GRADE_COLORS[grade]))
      }
      sourceIndices[instance] = index
      instance++
    }
    mesh.count = instance
    mesh.userData.sourceIndices = sourceIndices.subarray(0, instance)
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    this.root.add(mesh)
    this.layers.set(key, { mesh, material })
    return { available, rendered: instance }
  }

  private clearModel() {
    for (const { mesh, material } of this.layers.values()) {
      this.root.remove(mesh)
      material.dispose()
    }
    this.layers.clear()
    if (this.boundsHelper) {
      this.root.remove(this.boundsHelper)
      this.boundsHelper.geometry.dispose()
      if (Array.isArray(this.boundsHelper.material)) {
        this.boundsHelper.material.forEach(material => material.dispose())
      } else {
        this.boundsHelper.material.dispose()
      }
      this.boundsHelper = null
    }
    this.geometry?.dispose()
    this.geometry = null
    this.model = null
  }

  private updateClipping() {
    if (!this.model || this.sliceAxis === 'none') {
      for (const record of this.layers.values()) record.material.clippingPlanes = []
      return
    }
    const component = this.sliceAxis === 'x' ? 0 : this.sliceAxis === 'y' ? 1 : 2
    const min = this.model.field.bounds.min[component] - this.model.center[component]
    const max = this.model.field.bounds.max[component] - this.model.center[component]
    const threshold = min + (max - min) * this.sliceFraction
    const normal = new THREE.Vector3()
    normal.setComponent(component, -1)
    this.clippingPlane.set(normal, threshold)
    for (const record of this.layers.values()) {
      record.material.clippingPlanes = [this.clippingPlane]
      record.material.needsUpdate = true
    }
  }

  private fitCamera(half: THREE.Vector3) {
    const radius = Math.max(half.length(), 1)
    this.camera.near = Math.max(radius / 10_000, 0.001)
    this.camera.far = radius * 100
    this.camera.position.set(radius * 1.55, -radius * 1.75, radius * 1.25)
    this.camera.updateProjectionMatrix()
    this.controls.target.set(0, 0, 0)
    this.controls.minDistance = radius * 0.05
    this.controls.maxDistance = radius * 20
    this.controls.update()
  }

  private resize() {
    const width = Math.max(this.container.clientWidth, 1)
    const height = Math.max(this.container.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private animate = () => {
    this.animationFrame = requestAnimationFrame(this.animate)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}
