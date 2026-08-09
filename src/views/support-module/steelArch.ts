import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export interface IBeamProfile {
  label: string
  h: number   // total height (m)
  b: number   // flange width (m)
  d: number   // web thickness (m)
  t: number   // flange thickness (m)
}

export interface SteelArchParams {
  R1: number
  R2: number
  betaDeg: number
  profileKey: string
}

export const IBEAM_PROFILES: Record<string, IBeamProfile> = {
  I16: { label: 'I16', h: 0.160, b: 0.088, d: 0.0060, t: 0.0099 },
  I20: { label: 'I20', h: 0.200, b: 0.100, d: 0.0070, t: 0.0114 },
}

export function getProfileSummary(key: string): string {
  const p = IBEAM_PROFILES[key]
  if (!p) return ''
  return `${p.label}：高${(p.h * 1000).toFixed(0)}mm　翼缘宽${(p.b * 1000).toFixed(0)}mm　腹板厚${(p.d * 1000).toFixed(1)}mm　翼缘厚${(p.t * 1000).toFixed(1)}mm`
}

function createIBeamShape(profile: IBeamProfile): THREE.Shape {
  const { h, b, d, t } = profile
  const shape = new THREE.Shape()

  shape.moveTo(b / 2, h / 2)
  shape.lineTo(-b / 2, h / 2)
  shape.lineTo(-b / 2, h / 2 - t)
  shape.lineTo(-d / 2, h / 2 - t)
  shape.lineTo(-d / 2, -h / 2 + t)
  shape.lineTo(-b / 2, -h / 2 + t)
  shape.lineTo(-b / 2, -h / 2)
  shape.lineTo(b / 2, -h / 2)
  shape.lineTo(b / 2, -h / 2 + t)
  shape.lineTo(d / 2, -h / 2 + t)
  shape.lineTo(d / 2, h / 2 - t)
  shape.lineTo(b / 2, h / 2 - t)
  shape.lineTo(b / 2, h / 2)

  return shape
}

export function generateSteelArch(params: SteelArchParams): THREE.Mesh {
  const { R1, R2, betaDeg, profileKey } = params
  const profile = IBEAM_PROFILES[profileKey]
  const beta = (betaDeg * Math.PI) / 180

  const shape = createIBeamShape(profile)
  const path = new THREE.Path()

  const deltaR = Math.max(0.1, R2 - R1)
  const cxRight = -deltaR
  const cxLeft = deltaR

  const startX = cxRight + R2 * Math.cos(-beta)
  const startY = R2 * Math.sin(-beta)
  path.moveTo(startX, startY)
  path.absarc(cxRight, 0, R2, -beta, 0, false)

  path.absarc(0, 0, R1, 0, Math.PI, false)

  path.absarc(cxLeft, 0, R2, Math.PI, Math.PI + beta, false)

  const points2d = path.getPoints(250)
  const points3d = points2d.map((p) => new THREE.Vector3(p.x, p.y, 0))
  const curve = new THREE.CatmullRomCurve3(points3d)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 300,
    bevelEnabled: false,
    extrudePath: curve,
  }
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.computeVertexNormals()

  const material = new THREE.MeshStandardMaterial({
    color: '#828b93',
    metalness: 0.6,
    roughness: 0.4,
  })

  return new THREE.Mesh(geometry, material)
}

function buildArchPath(params: SteelArchParams): THREE.Path {
  const { R1, R2, betaDeg } = params
  const beta = (betaDeg * Math.PI) / 180
  const deltaR = Math.max(0.1, R2 - R1)

  const path = new THREE.Path()
  const startX = -deltaR + R2 * Math.cos(-beta)
  const startY = R2 * Math.sin(-beta)
  path.moveTo(startX, startY)
  path.absarc(-deltaR, 0, R2, -beta, 0, false)
  path.absarc(0, 0, R1, 0, Math.PI, false)
  path.absarc(deltaR, 0, R2, Math.PI, Math.PI + beta, false)
  return path
}

export async function generateWorkfaceGLB(params: SteelArchParams): Promise<ArrayBuffer> {
  const path = buildArchPath(params)
  const points = path.getPoints(250)
  let bottomY = Infinity
  for (const p of points) bottomY = Math.min(bottomY, p.y)

  const { R1, R2, betaDeg } = params
  const deltaR = Math.max(0.1, R2 - R1)
  const archWidth = 2 * (deltaR + R2)

  const group = new THREE.Group()

  // 方形底面
  const geoFloor = new THREE.PlaneGeometry(archWidth * 1.2, archWidth * 1.2)
  const matFloor = new THREE.MeshBasicMaterial({
    color: '#1e3a5f',
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const floorMesh = new THREE.Mesh(geoFloor, matFloor)
  floorMesh.rotation.x = -Math.PI / 2
  floorMesh.position.y = bottomY
  group.add(floorMesh)

  // 网格线
  const segs = Math.round(archWidth / 0.5)
  const geoGrid = new THREE.PlaneGeometry(archWidth * 1.2, archWidth * 1.2, segs, segs)
  const matGrid = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
    wireframe: true,
  })
  const gridMesh = new THREE.Mesh(geoGrid, matGrid)
  gridMesh.rotation.x = -Math.PI / 2
  gridMesh.position.y = bottomY + 0.02
  group.add(gridMesh)

  const exportScene = new THREE.Scene()
  exportScene.add(group)

  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      exportScene,
      (gltf: ArrayBuffer) => {
        geoFloor.dispose()
        geoGrid.dispose()
        matFloor.dispose()
        matGrid.dispose()
        resolve(gltf)
      },
      (err: any) => {
        geoFloor.dispose()
        geoGrid.dispose()
        matFloor.dispose()
        matGrid.dispose()
        reject(err)
      },
      { binary: true }
    )
  })
}

export async function generateSteelArchGLB(params: SteelArchParams): Promise<ArrayBuffer> {
  const mesh = generateSteelArch(params)
  const exportScene = new THREE.Scene()
  exportScene.add(mesh)

  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      exportScene,
      (gltf: ArrayBuffer) => {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        resolve(gltf)
      },
      (err: any) => {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        reject(err)
      },
      { binary: true }
    )
  })
}
