import * as Cesium from 'cesium'
import AppConfig from '@/config/AppConfig'
import { loadMap } from '@/utils/Maps/MapSource'
import { loadTerrain } from '@/utils/Maps/TerrainSource'

/**
 * 为独立的施工模块恢复与主页面一致的影像、地形和地下模型显示方式。
 * 地形保留为背景，但关闭地形深度遮挡与相机碰撞，使洞内模型始终可见。
 */
export function enableUndergroundTerrainBackground(viewer: Cesium.Viewer) {
  const config = new AppConfig().appConfig
  if (config?.ionToken) Cesium.Ion.defaultAccessToken = config.ionToken

  const scene = viewer.scene
  const globe = scene.globe
  globe.show = true
  globe.enableLighting = true
  globe.depthTestAgainstTerrain = false
  globe.baseColor = Cesium.Color.fromCssColorString('#183044')
  globe.maximumScreenSpaceError = 8
  globe.translucency.enabled = true
  globe.translucency.frontFaceAlphaByDistance = new Cesium.NearFarScalar(
    0, 0.88,
    50000, 0.88,
  )

  scene.screenSpaceCameraController.enableCollisionDetection = false
  ;(scene.skyBox as any).show = true
  scene.skyAtmosphere.show = true
  scene.sun.show = true
  scene.moon.show = false
  scene.fog.enabled = true

  loadMap(viewer)
  loadTerrain(viewer)
  scene.requestRender()
}

