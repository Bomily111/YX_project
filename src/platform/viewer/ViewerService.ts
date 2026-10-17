import * as Cesium from 'cesium'

export type ViewerContainer = string | HTMLElement

export interface ViewerCreateOptions {
  cesium?: Cesium.Viewer.ConstructorOptions
  configure?: (viewer: Cesium.Viewer) => void
  owner?: string
}

type ViewerListener = (viewer: Cesium.Viewer | undefined) => void

/**
 * Cesium Viewer 的唯一创建入口。
 *
 * 迁移期仍允许不同路由先后持有 Viewer，但任何时刻只允许一个存活实例。
 * 后续把 Viewer 宿主提升到应用根组件时，业务模块只需要改为 get/wait，
 * 不需要再次修改唯一实例和生命周期规则。
 */
export class ViewerService {
  private creationSequence = 0
  private viewer?: Cesium.Viewer
  private owner?: string
  private readonly listeners = new Set<ViewerListener>()

  get current(): Cesium.Viewer | undefined {
    if (this.viewer?.isDestroyed()) {
      this.clearDestroyedReference()
    }
    return this.viewer
  }

  get currentOwner(): string | undefined {
    void this.current
    return this.owner
  }

  create(container: ViewerContainer, options: ViewerCreateOptions = {}): Cesium.Viewer {
    const active = this.current
    if (active) {
      const nextOwner = options.owner ?? 'unknown'
      const message = `[ViewerService] 拒绝创建第二个 Cesium Viewer：当前由 ${this.owner ?? 'unknown'} 持有，请求方为 ${nextOwner}`
      if (import.meta.env.DEV) console.error(message)
      throw new Error(message)
    }

    const viewer = new Cesium.Viewer(container, options.cesium)
    viewer.container.setAttribute('data-viewer-instance-id', String(++this.creationSequence))
    this.viewer = viewer
    this.owner = options.owner ?? 'unknown'

    try {
      options.configure?.(viewer)
    } catch (error) {
      this.destroy(viewer)
      throw error
    }

    this.publish(viewer)
    return viewer
  }

  require(): Cesium.Viewer {
    const viewer = this.current
    if (!viewer) throw new Error('[ViewerService] Cesium Viewer 尚未初始化')
    return viewer
  }

  /** 将当前 Viewer 的 DOM 容器移动到新的页面宿主，Viewer 实例保持不变。 */
  attachTo(host: HTMLElement, owner?: string): Cesium.Viewer {
    const viewer = this.require()
    if (viewer.container.parentElement !== host) host.appendChild(viewer.container)
    if (owner) this.owner = owner
    viewer.resize()
    viewer.scene.requestRender()
    return viewer
  }

  wait(): Promise<Cesium.Viewer> {
    const viewer = this.current
    if (viewer) return Promise.resolve(viewer)
    return new Promise((resolve) => {
      const stop = this.subscribe((next) => {
        if (!next) return
        stop()
        resolve(next)
      })
    })
  }

  subscribe(listener: ViewerListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 仅销毁当前服务持有的实例；传入其他实例会被拒绝。 */
  destroy(expected?: Cesium.Viewer): void {
    const active = this.current
    if (!active) return
    if (expected && expected !== active) {
      throw new Error('[ViewerService] 拒绝销毁非当前 Viewer 实例')
    }

    this.viewer = undefined
    this.owner = undefined
    if (!active.isDestroyed()) active.destroy()
    this.publish(undefined)
  }

  /**
   * 兼容迁移期仍直接调用 viewer.destroy() 的旧模块，及时清理服务引用。
   */
  releaseDestroyed(viewer: Cesium.Viewer): void {
    if (this.viewer !== viewer || !viewer.isDestroyed()) return
    this.clearDestroyedReference()
  }

  private clearDestroyedReference(): void {
    this.viewer = undefined
    this.owner = undefined
    this.publish(undefined)
  }

  private publish(viewer: Cesium.Viewer | undefined): void {
    for (const listener of this.listeners) listener(viewer)
  }
}

export const viewerService = new ViewerService()
