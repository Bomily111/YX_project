import * as Cesium from 'cesium'

export interface ScreenSpaceEventRecord {
  owner: string
  createdAt: number
  handler: Cesium.ScreenSpaceEventHandler
}

export type ScreenSpaceEventHandlerFactory = (
  canvas: HTMLCanvasElement,
) => Cesium.ScreenSpaceEventHandler

/**
 * 给所有额外创建的 Cesium 输入处理器分配稳定 owner，并统一跟踪销毁。
 * 同一 owner 再次创建时先释放旧实例，避免页面重挂载或数据重载产生幽灵监听。
 */
export class ScreenSpaceEventRegistry {
  private readonly records = new Map<string, ScreenSpaceEventRecord>()

  constructor(
    private readonly factory: ScreenSpaceEventHandlerFactory = (canvas) => (
      new Cesium.ScreenSpaceEventHandler(canvas)
    ),
  ) {}

  create(owner: string, canvas: HTMLCanvasElement): Cesium.ScreenSpaceEventHandler {
    const normalizedOwner = owner.trim()
    if (!normalizedOwner) throw new Error('[ScreenSpaceEventRegistry] owner 不能为空')
    this.release(normalizedOwner)

    const handler = this.factory(canvas)
    const nativeDestroy = handler.destroy.bind(handler)
    let destroyed = false
    const managedDestroy = () => {
      if (destroyed) return
      destroyed = true
      try {
        nativeDestroy()
      } finally {
        // Cesium.destroyObject 会把实例方法替换成抛错函数；重新装回包装器，保证重复清理幂等。
        handler.destroy = managedDestroy
        if (this.records.get(normalizedOwner)?.handler === handler) {
          this.records.delete(normalizedOwner)
        }
      }
    }
    handler.destroy = managedDestroy
    this.records.set(normalizedOwner, {
      owner: normalizedOwner,
      createdAt: Date.now(),
      handler,
    })
    return handler
  }

  release(owner: string): void {
    this.records.get(owner)?.handler.destroy()
  }

  releasePrefix(prefix: string): void {
    for (const owner of [...this.records.keys()]) {
      if (owner.startsWith(prefix)) this.release(owner)
    }
  }

  disposeAll(): void {
    for (const owner of [...this.records.keys()]) this.release(owner)
  }

  get(owner: string): ScreenSpaceEventRecord | undefined {
    return this.records.get(owner)
  }

  list(): readonly ScreenSpaceEventRecord[] {
    return [...this.records.values()]
  }
}

export const screenSpaceEventRegistry = new ScreenSpaceEventRegistry()

export const createScreenSpaceEventHandler = (
  owner: string,
  canvas: HTMLCanvasElement,
): Cesium.ScreenSpaceEventHandler => screenSpaceEventRegistry.create(owner, canvas)
