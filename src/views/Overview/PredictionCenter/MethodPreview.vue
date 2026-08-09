<template>
  <div class="mp-root">
    <!-- TSP 反演 -->
    <template v-if="method.key === 'tsp'">
      <div class="mp-section">
        <div class="mp-section-title">体数据模型</div>
        <div class="mp-model-types">
          <button
            v-for="t in tspTypes"
            :key="t.key"
            class="mp-type-btn"
            :class="{ active: tspActive === t.key }"
            @click="tspActive = t.key"
          >{{ t.label }}</button>
        </div>
        <div class="mp-colorbar-hint">VP 波速 / VS 波速 / 深度 三通道可切换</div>
      </div>
      <div class="mp-section">
        <div class="mp-section-title">探测参数</div>
        <div class="mp-kv"><span>里程范围</span><b>D3K278+100 ~ DK300+800</b></div>
        <div class="mp-kv"><span>探测长度</span><b>100 m</b></div>
        <div class="mp-kv"><span>设备</span><b>TSP 303</b></div>
        <div class="mp-kv"><span>激发孔间距</span><b>1.5 m</b></div>
      </div>
    </template>

    <!-- 超前水平钻 -->
    <template v-else-if="method.key === 'horiz_drill'">
      <div class="mp-section">
        <div class="mp-section-title">3D 钻孔模型</div>
        <div class="mp-model-grid">
          <div class="mp-model-card">
            <div class="mp-model-icon">🔩</div>
            <div class="mp-model-name">钻孔 1</div>
            <div class="mp-model-src">ahd1/2320835.glb</div>
          </div>
          <div class="mp-model-card">
            <div class="mp-model-icon">🔩</div>
            <div class="mp-model-name">钻孔 2</div>
            <div class="mp-model-src">ahd2/2336197.glb</div>
          </div>
        </div>
      </div>
      <div class="mp-section">
        <div class="mp-section-title">掌子面切片</div>
        <div class="mp-kv"><span>切片数量</span><b>4 个</b></div>
        <div class="mp-kv"><span>分布间距</span><b>~10 m</b></div>
        <div class="mp-kv"><span>里程范围</span><b>D3K278+100 ~ DK300+800</b></div>
      </div>
    </template>

    <!-- 瞬变电磁 -->
    <TemDetail
      v-else-if="method.key === 'tem'"
      :data-dir="'/data/tem_output'"
      @view-in-scene="(jobId: string) => $emit('viewInScene', jobId)"
    />

    <!-- 掌子面素描 -->
    <template v-else-if="method.key === 'face_sketch'">
      <div class="mp-section">
        <div class="mp-section-title">掌子面纹理切片</div>
        <div class="mp-model-grid">
          <div class="mp-model-card" v-for="i in 4" :key="i">
            <div class="mp-model-icon">🪨</div>
            <div class="mp-model-name">切片 {{ i }}</div>
            <div class="mp-model-src">tfs{{ i }}/232***.glb</div>
          </div>
        </div>
      </div>
      <div class="mp-section">
        <div class="mp-section-title">切片参数</div>
        <div class="mp-kv"><span>切片总数</span><b>4 个</b></div>
        <div class="mp-kv"><span>分布间距</span><b>~10 m</b></div>
        <div class="mp-kv"><span>里程范围</span><b>D3K278+100 ~ DK300+800</b></div>
        <div class="mp-kv"><span>开挖宽度</span><b>~12.4 m</b></div>
        <div class="mp-kv"><span>开挖高度</span><b>~9.0 m</b></div>
      </div>
    </template>

    <!-- 通用空状态 -->
    <div v-else class="mp-empty">
      <div class="mp-empty-icon">📊</div>
      <div class="mp-empty-text">暂无预览数据</div>
    </div>

    <button v-if="method.key !== 'tem'" class="mp-view-btn" @click="$emit('viewInScene')">
      <span>📍</span> 在场景中查看
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface MethodCard {
  key: string
  label: string
  icon: string
  category: string
  dataStatus: 'available' | 'pending'
  latestResult?: string
}

import TemDetail from './TemDetail.vue'

defineProps<{ method: MethodCard; dataDir?: string }>()
defineEmits<{ viewInScene: [jobId: string] }>()

const tspActive = ref('vs')
const tspTypes = [
  { key: 'vp', label: 'VP 波速' },
  { key: 'vs', label: 'VS 波速' },
  { key: 'depth', label: '深度' },
]
</script>

<style scoped lang="scss">
.mp-root { font-size: 13px; }

.mp-section {
  margin-bottom: 14px; padding: 10px 12px;
  border-radius: 6px; background: rgba(0, 180, 255, 0.04);
  border: 1px solid rgba(0, 180, 255, 0.08);
}
.mp-section-title {
  font-size: 12px; color: #5a8ab5; margin-bottom: 8px;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
}

.mp-model-types { display: flex; gap: 4px; margin-bottom: 8px; }
.mp-type-btn {
  padding: 4px 10px; border: 1px solid rgba(0, 180, 255, 0.15); border-radius: 4px;
  background: none; color: #8aa0bd; font-size: 12px; cursor: pointer; transition: .15s;
  &:hover { border-color: rgba(0, 200, 255, 0.3); color: #cfe4fb; }
  &.active { background: rgba(0, 234, 255, 0.12); border-color: #00eaff; color: #00eaff; }
}
.mp-colorbar-hint { font-size: 11px; color: #4a6a8a; margin-top: 4px; }

.mp-kv {
  display: flex; justify-content: space-between; align-items: center;
  padding: 3px 0; font-size: 12px; color: #8aa0bd;
  b { color: #d7e3f5; font-weight: 600; }
}

.mp-model-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mp-model-card {
  padding: 8px; border-radius: 5px;
  background: rgba(0, 180, 255, 0.04); border: 1px solid rgba(0, 180, 255, 0.06);
  text-align: center;
}
.mp-model-icon { font-size: 20px; margin-bottom: 2px; }
.mp-model-name { font-size: 12px; color: #c7d5ea; font-weight: 600; }
.mp-model-src { font-size: 10px; color: #4a6a8a; word-break: break-all; }

.mp-view-btn {
  margin-top: 8px; width: 100%; padding: 10px; border: none; border-radius: 6px;
  background: linear-gradient(135deg, rgba(56,189,248,.15), rgba(0,234,255,.12));
  color: #00eaff; font-size: 14px; font-weight: 600; cursor: pointer; transition: .15s;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid rgba(0, 234, 255, 0.2);
  &:hover { background: rgba(0, 234, 255, 0.18); border-color: rgba(0, 234, 255, 0.4); }
}

.mp-empty { text-align: center; padding: 30px 20px; }
.mp-empty-icon { font-size: 32px; margin-bottom: 8px; }
.mp-empty-text { font-size: 13px; color: #5a7a9a; }
</style>
