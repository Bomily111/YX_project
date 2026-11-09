import { afterEach, expect, it, vi } from 'vitest'
import { readSceneCapabilities, registerSceneCapabilityProvider } from '@/ai-agent/SceneCapabilities'
import { AgentEngine } from '@/ai-agent/AgentEngine'
afterEach(() => vi.unstubAllGlobals())
it('does not let an old view unregister the active capability provider', () => {
  const old = registerSceneCapabilityProvider(() => ({ scope: 'registered-platform-capabilities', targetDataVerified: false, resources: [] }))
  const current = registerSceneCapabilityProvider(() => ({ scope: 'registered-platform-capabilities', targetDataVerified: false, resources: [{ id: 'test-resource', module: 'rock', type: 'reference', state: 'idle' }] }))
  old()
  expect(readSceneCapabilities()?.resources[0].id).toBe('test-resource')
  current()
  expect(readSceneCapabilities()).toBeUndefined()
})
it('injects actual registered capabilities before planning without treating source ranges as target evidence', async () => {
  const release = registerSceneCapabilityProvider(() => ({ scope: 'registered-platform-capabilities', targetDataVerified: false,
    resources: [{ id: 'available-reference', module: 'rock', type: 'reference', state: 'idle', declaredRange: { start: 2244, end: 2344 } }] }))
  let system = ''
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    system = JSON.parse(String(init?.body)).system
    return new Response('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"请明确观察重点？"}}\n\n')
  }))
  try {
    await new AgentEngine('test').chat('准备YK2+244施工场景', {}, { onText: () => {}, onComplete: () => {}, onError: error => { throw error } })
    expect(system).toContain('available-reference')
    expect(system).toContain('"targetDataVerified":false')
    expect(system).toContain('可能是源资料范围')
    expect(system).toContain('不表示文件可读性')
  } finally { release() }
})
