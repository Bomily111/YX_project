<template>
  <div class="mileage-search-wrap">
    <el-autocomplete
      v-model="query"
      :fetch-suggestions="fetchSuggestions"
      placeholder="搜索里程 (如 YK3+200)"
      :trigger-on-focus="true"
      clearable
      size="small"
      popper-class="mileage-popper"
      @select="handleSelect"
    >
      <template #prefix>
        <span class="search-prefix">⌕</span>
      </template>
    </el-autocomplete>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import * as Cesium from 'cesium'
import { DTScopeEngine } from '@/utils/Common/Viewer'
import mileageData from '@/assets/data/centerline_mileage.json'

interface MileageEntry {
  index: number
  mileage: string
  lng: number
  lat: number
  alt: number
}

const entries = mileageData as MileageEntry[]
const query = ref('')
let markerEntity: Cesium.Entity | null = null

function computeHeading(entry: MileageEntry): number {
  const nextIdx = entry.index + 1
  const next = nextIdx < entries.length ? entries[nextIdx] : entries[entry.index - 1]

  const pos = Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat, entry.alt)
  const lookAt = Cesium.Cartesian3.fromDegrees(next.lng, next.lat, next.alt)

  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos)
  const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4())
  const dir = Cesium.Cartesian3.subtract(lookAt, pos, new Cesium.Cartesian3())
  const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3())

  let heading = Math.atan2(localDir.x, localDir.y)
  if (nextIdx >= entries.length) {
    heading += Math.PI
  }
  return heading
}

function fetchSuggestions(qs: string, cb: (results: { value: string; entry: MileageEntry }[]) => void) {
  if (!qs || !qs.trim()) {
    cb([])
    return
  }
  const q = qs.trim().toUpperCase()
  const results = entries
    .filter(e => e.mileage.toUpperCase().includes(q))
    .slice(0, 20)
    .map(e => ({ value: e.mileage, entry: e }))
  cb(results)
}

function placeMarker(entry: MileageEntry) {
  const viewer = DTScopeEngine.viewer
  if (!viewer) return

  if (markerEntity) {
    viewer.entities.remove(markerEntity)
    markerEntity = null
  }

  markerEntity = viewer.entities.add({
    id: 'mileage-search-marker',
    position: Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat, entry.alt + 2),
    point: {
      pixelSize: 14,
      color: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: entry.mileage,
      font: 'bold 14px Microsoft YaHei',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })

  setTimeout(() => {
    const v = DTScopeEngine.viewer
    if (v && markerEntity) {
      v.entities.remove(markerEntity)
      markerEntity = null
    }
  }, 10000)
}

function handleSelect(item: { value: string; entry: MileageEntry }) {
  const viewer = DTScopeEngine.viewer
  if (!viewer) return

  const entry = item.entry

  const H = Cesium.Math.toRadians(26.57)
  const P = Cesium.Math.toRadians(-11.57)
  const heightOffset = 32   // 参考相机距地面高度
  const horizDist = heightOffset / Math.tan(Math.abs(P)) // 水平距离 ≈ 156m

  // 标记点 ECEF
  const markerPos = Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat, entry.alt)

  // 相机在标记点后方（heading 反方向），水平距离 156m，高 32m
  const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(markerPos)
  const camLocal = new Cesium.Cartesian3(
    -Math.sin(H) * horizDist,
    -Math.cos(H) * horizDist,
     heightOffset,
  )
  const camPos = Cesium.Matrix4.multiplyByPoint(enuMatrix, camLocal, new Cesium.Cartesian3())

  viewer.scene.camera.flyTo({
    destination: camPos,
    orientation: {
      heading: H,
      pitch: P,
      roll: 0,
    },
    duration: 1.5,
    easingFunction: Cesium.EasingFunction.QUINTIC_IN_OUT,
  })

  placeMarker(entry)
}

onBeforeUnmount(() => {
  const viewer = DTScopeEngine.viewer
  if (viewer && markerEntity) {
    viewer.entities.remove(markerEntity)
    markerEntity = null
  }
})
</script>

<style lang="scss">
/* 下拉面板全局样式 */
.mileage-popper {
  background: rgba(0, 15, 30, 0.95) !important;
  border: 1px solid rgba(0, 234, 255, 0.4) !important;
  border-radius: 4px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 234, 255, 0.1) !important;

  .el-autocomplete-suggestion__list {
    padding: 4px 0;
  }

  .el-autocomplete-suggestion__item {
    padding: 6px 14px;
    color: rgba(180, 220, 255, 0.9);
    font-size: 13px;
    font-family: 'Consolas', 'Microsoft YaHei', monospace;

    &:hover,
    &.highlighted {
      background: rgba(0, 234, 255, 0.12);
      color: #00eaff;
    }
  }
}
</style>

<style scoped lang="scss">
.mileage-search-wrap {
  position: absolute;
  left: 50%;
  top: 68px;
  transform: translateX(-50%);
  z-index: 11;
}

:deep(.el-autocomplete) {
  width: 240px;
}

:deep(.el-input__wrapper) {
  height: 28px;
  padding: 0 10px;
  background: linear-gradient(135deg, rgba(0, 80, 150, 0.35), rgba(0, 120, 200, 0.2));
  border: 1px solid rgba(0, 234, 255, 0.45);
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(0, 234, 255, 0.1);
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover,
  &:focus-within {
    border-color: rgba(0, 234, 255, 0.75);
    box-shadow: 0 0 14px rgba(0, 234, 255, 0.3);
  }
}

:deep(.el-input__inner) {
  color: #00eaff;
  font-size: 13px;
  font-family: 'Consolas', 'Microsoft YaHei', monospace;

  &::placeholder {
    color: rgba(0, 234, 255, 0.4);
  }
}

:deep(.el-input__suffix) {
  .el-icon {
    color: rgba(0, 234, 255, 0.5);
  }
}

.search-prefix {
  color: rgba(0, 234, 255, 0.55);
  font-size: 14px;
  margin-right: 2px;
}
</style>
