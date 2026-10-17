export interface DataVersion {
  sourceId: string
  locator: string
  algorithm: 'sha256-json-v1' | 'fnv1a64-json-v1' | 'sha256-bytes-v1'
  digest: string
  capturedAt: string
}

const canonicalJson = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item
  return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
})

const fallbackDigest = (bytes: Uint8Array): string => {
  let hash = 0xcbf29ce484222325n
  for (const byte of bytes) hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn
  return hash.toString(16).padStart(16, '0')
}

/** 对业务实际读取到的 JSON 值取内容指纹，不保存整份敏感业务数据。 */
export class TaskDataProvenance {
  private readonly versions = new Map<string, DataVersion>()

  async capture(sourceId: string, locator: string, value: unknown): Promise<void> {
    const bytes = new TextEncoder().encode(canonicalJson(value))
    const strongDigest = globalThis.crypto?.subtle
      ? await globalThis.crypto.subtle.digest('SHA-256', bytes)
      : undefined
    this.versions.set(sourceId, {
      sourceId,
      locator,
      algorithm: strongDigest ? 'sha256-json-v1' : 'fnv1a64-json-v1',
      digest: strongDigest
        ? Array.from(new Uint8Array(strongDigest), byte => byte.toString(16).padStart(2, '0')).join('')
        : fallbackDigest(bytes),
      capturedAt: new Date().toISOString(),
    })
  }

  list(): DataVersion[] {
    return [...this.versions.values()].map(item => ({ ...item }))
  }

  clear(): void {
    this.versions.clear()
  }
}
