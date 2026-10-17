import { TaskDataProvenance, type DataVersion } from './TaskDataProvenance'

/** Blob URL 不稳定；以逻辑来源、实际 GLB 字节和生成参数标识参数化资产。 */
export async function fingerprintGeneratedAsset(
  sourceId: string,
  bytes: ArrayBuffer,
  parameters: unknown,
): Promise<DataVersion[]> {
  const locator = `generated://${sourceId}`
  const provenance = new TaskDataProvenance()
  if (!globalThis.crypto?.subtle) {
    // 普通 HTTP 局域网环境沿用 JSON 指纹回退，不阻断模型加载；算法名如实记录。
    await provenance.capture(sourceId, locator, Array.from(new Uint8Array(bytes)))
    await provenance.capture(`${sourceId}:parameters`, locator, parameters)
    return provenance.list()
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  await provenance.capture(`${sourceId}:parameters`, locator, parameters)
  return [{
    sourceId,
    locator,
    algorithm: 'sha256-bytes-v1',
    digest: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
    capturedAt: new Date().toISOString(),
  }, ...provenance.list()]
}
