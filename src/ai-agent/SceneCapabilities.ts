export interface SceneCapability {
  id: string
  module: string
  type: string
  declaredRange?: { start: number; end: number }
  state: string
}
export interface SceneCapabilityReport {
  scope: 'registered-platform-capabilities'
  targetDataVerified: false
  resources: SceneCapability[]
}
let provider: (() => SceneCapabilityReport) | undefined
export function registerSceneCapabilityProvider(value: () => SceneCapabilityReport): () => void {
  provider = value
  return () => { if (provider === value) provider = undefined }
}
export function readSceneCapabilities(): SceneCapabilityReport | undefined { return provider?.() }
