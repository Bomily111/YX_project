<template>
  <div class="td-root">
    <!-- 返回列表 -->
    <button v-if="selected" class="td-back" @click="selected = null">‹ 返回数据集列表</button>

    <!-- Level 1: Dataset List -->
    <div v-if="!selected">
      <div class="td-toolbar">
        <input v-model="searchQuery" class="td-search" placeholder="搜索里程段..." @input="doSearch" />
        <button class="td-refresh" @click="loadIndex()" title="刷新">↻</button>
      </div>
      <div v-if="loading" class="td-empty">加载中...</div>
      <div v-else-if="filteredDatasets.length === 0" class="td-empty">
        {{ searchQuery ? '无匹配结果' : '暂无处理数据' }}
      </div>
      <div v-else class="td-list">
        <div v-for="ds in filteredDatasets" :key="ds.jobId" class="td-card" @click="selected = ds">
          <div class="td-card-top">
            <span class="td-card-mileage">{{ ds.mileage || '前向 ' + (ds.xRange?.map((v:number) => v.toFixed(0)).join('~') || '—') + 'm' }}</span>
            <button class="td-card-del" @click.stop="deleteDataset(ds)">×</button>
          </div>
          <div class="td-card-meta">
            <span>{{ ds.createdAt ? ds.createdAt.slice(0, 16).replace('T', ' ') : '—' }}</span>
            <span class="td-card-badge">{{ ds.anomalyCount }} 异常体</span>
          </div>
          <div class="td-card-meta">
            <span>k 均值 {{ ds.kMean?.toFixed(1) || '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Level 2: Dataset Detail -->
    <div v-else>
      <a :href="`${baseUrl}/tem_voxel_full.csv`" download class="td-download-btn">⬇ 下载结果数据</a>

      <!-- k≈570 等值面 & 异常体 -->
      <div class="td-section">
        <button class="td-toggle" @click="open.anomaly = !open.anomaly">
          <span :class="{ rotate: open.anomaly }">▸</span> k≈570 等值面 & 异常体
          <span class="td-badge">{{ anomalies.length }}</span>
        </button>
        <div v-show="open.anomaly" class="td-body">
          <div class="td-kv"><span>模型</span><b>anomaly_k570_4x.glb</b></div>
          <div class="td-kv"><span>三角面</span><b>860 顶点 / 1,664 面</b></div>
          <button class="td-view-btn" @click="$emit('viewInScene')">
            <span>📍</span> 在场景中查看
          </button>
          <div class="td-section-divider"></div>
          <div v-if="anomalies.length === 0" class="td-empty">暂无检测到显著异常体</div>
          <div v-else class="td-anomaly-list">
            <div v-for="a in anomalies" :key="a.id" class="td-anomaly-card">
              <div class="td-anomaly-header">
                <span class="td-anomaly-id">#{{ a.id }}</span>
                <span class="td-anomaly-k" :style="{ color: kColor(a.k_mean) }">k={{ a.k_mean.toFixed(1) }}</span>
              </div>
              <div class="td-anomaly-meta">
                <span>{{ a.voxels }} 体素</span>
                <span>中心 ({{ a.cx.toFixed(1) }}, {{ a.cy.toFixed(1) }}, {{ a.cz.toFixed(1) }})m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 密集点云分布图 -->
      <div class="td-section">
        <button class="td-toggle" @click="open.denseCloud = !open.denseCloud">
          <span :class="{ rotate: open.denseCloud }">▸</span> 密集点云三维分布
        </button>
        <div v-show="open.denseCloud" class="td-body">
          <img :src="`${baseUrl}/fig3d_1_dense_cloud.png`"
               class="td-full-img" @click="zoomImage = `${baseUrl}/fig3d_1_dense_cloud.png`" />
        </div>
      </div>

      <!-- 多深度 YZ 断面 -->
      <div class="td-section">
        <button class="td-toggle" @click="open.depthSlices = !open.depthSlices">
          <span :class="{ rotate: open.depthSlices }">▸</span> 多深度 YZ 断面
        </button>
        <div v-show="open.depthSlices" class="td-body">
          <img :src="`${baseUrl}/fig3d_3_depth_slices.png`"
               class="td-full-img" @click="zoomImage = `${baseUrl}/fig3d_3_depth_slices.png`" />
        </div>
      </div>

      <!-- 等值线扇面图 -->
      <div class="td-section">
        <button class="td-toggle" @click="open.fanContour = !open.fanContour">
          <span :class="{ rotate: open.fanContour }">▸</span> 等值线扇面图
          <span class="td-badge">4</span>
        </button>
        <div v-show="open.fanContour" class="td-body">
          <div class="td-gallery">
            <div v-for="img in contourImages" :key="img.name" class="td-thumb" @click="zoomImage = img.url">
              <img :src="img.url" :alt="img.name" />
              <span class="td-thumb-label">{{ img.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 体素数据下载 -->
      <div class="td-section">
        <button class="td-toggle" @click="open.voxelCsv = !open.voxelCsv">
          <span :class="{ rotate: open.voxelCsv }">▸</span> 体素数据 (CSV)
        </button>
        <div v-show="open.voxelCsv" class="td-body">
          <div class="td-kv"><span>文件</span><b>tem_voxel_full.csv</b></div>
          <a :href="`${baseUrl}/tem_voxel_full.csv`" download class="td-download-btn">⬇ 下载完整数据</a>
        </div>
      </div>
    </div>

    <!-- Zoom Modal -->
    <Teleport to="body">
      <div v-if="zoomImage" class="td-modal" @click="zoomImage = null">
        <img :src="zoomImage" class="td-modal-img" @click.stop />
        <button class="td-modal-close" @click="zoomImage = null">×</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'

interface Dataset {
  jobId: string; createdAt: string; mileage?: string
  xRange: number[]; yRange: number[]; zRange: number[]
  anomalyCount: number; kMean: number
}

interface Anomaly {
  id: number; voxels: number; cx: number; cy: number; cz: number; k_mean: number
}

defineEmits<{ viewInScene: [] }>()

const props = defineProps<{ dataDir: string }>()

const datasets = ref<Dataset[]>([])
const loading = ref(true)
const selected = ref<Dataset | null>(null)
const searchQuery = ref('')
const filteredDatasets = ref<Dataset[]>([])

function doSearch() {
  const q = searchQuery.value.toLowerCase()
  filteredDatasets.value = q
    ? datasets.value.filter(ds => (ds.mileage || '').toLowerCase().includes(q))
    : datasets.value
}
const baseUrl = computed(() => selected.value ? `${props.dataDir}/${selected.value.jobId}` : '')

const open = reactive({
  anomaly: false, denseCloud: false, depthSlices: false, fanContour: false, voxelCsv: false,
})
const anomalies = ref<Anomaly[]>([])
const contourImages = ref<{ name: string; url: string }[]>([])
const zoomImage = ref<string | null>(null)

async function loadIndex() {
  loading.value = true
  try {
    const r = await fetch(`${props.dataDir}/index.json`)
    datasets.value = await r.json()
  } catch { datasets.value = [] }
  doSearch()
  loading.value = false
}

async function loadDataset(ds: Dataset) {
  const url = `${props.dataDir}/${ds.jobId}/meta.json`
  try {
    const r = await fetch(url)
    const meta = await r.json()
    anomalies.value = meta.anomalies || []
    const names = ['线1', '线2', '线3', '线4']
    contourImages.value = names.map(n => ({
      name: `${n} (φ=${n === '线1' ? '+30' : n === '线2' ? '+15' : n === '线3' ? '0' : '-15'}°)`,
      url: `${props.dataDir}/${ds.jobId}/fan_contour_${n.replace('线', 'line')}.png`,
    }))
  } catch { anomalies.value = []; contourImages.value = [] }
}

async function deleteDataset(ds: Dataset) {
  if (!confirm(`删除数据集 ${ds.createdAt?.slice(0,16).replace('T',' ') || ds.jobId}？`)) return
  try {
    await fetch(`/api/process/tem/${ds.jobId}`, { method: 'DELETE' })
    if (selected.value?.jobId === ds.jobId) selected.value = null
    loadIndex()
  } catch (e) { console.warn('删除失败:', e) }
}

watch(() => props.dataDir, val => { if (val) loadIndex() }, { immediate: true })
watch(selected, ds => { if (ds) loadDataset(ds) })

function kColor(k: number): string {
  if (k < 570) return '#4488ff'
  if (k < 590) return '#44ccff'
  if (k < 610) return '#44dd66'
  return '#dd8800'
}
</script>

<style scoped lang="scss">
.td-root { font-size: 13px; }

.td-toolbar { display: flex; gap: 6px; margin-bottom: 8px; }
.td-search {
  flex: 1; padding: 6px 10px; border: 1px solid rgba(0,180,255,.15); border-radius: 4px;
  background: rgba(0,20,40,.6); color: #c7d5ea; font-size: 12px; outline: none;
  &::placeholder { color: #4a6a8a; }
  &:focus { border-color: rgba(0,234,255,.4); }
}
.td-refresh {
  background: none; border: 1px solid rgba(0,180,255,.15);
  color: #7dd3fc; font-size: 16px; cursor: pointer; padding: 2px 10px; border-radius: 4px;
  flex-shrink: 0; transition: .15s;
  &:hover { background: rgba(0,200,255,.1); color: #fff; }
}

.td-back {
  background: none; border: none; color: #7dd3fc; font-size: 14px;
  cursor: pointer; padding: 4px 0; margin-bottom: 8px;
  &:hover { color: #fff; }
}

.td-empty { font-size: 12px; color: #5a7a9a; text-align: center; padding: 20px; }

.td-list { display: flex; flex-direction: column; gap: 6px; }
.td-card {
  padding: 10px 12px; border-radius: 6px; cursor: pointer;
  background: rgba(0, 180, 255, 0.04); border: 1px solid rgba(0, 180, 255, 0.08);
  transition: .15s;
  &:hover { background: rgba(0, 200, 255, 0.08); border-color: rgba(0, 200, 255, 0.2); }
}
.td-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.td-card-mileage { font-size: 13px; color: #c7d5ea; font-weight: 600; }
.td-card-time { font-size: 11px; color: #5a7a9a; }
.td-card-badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(0,200,255,.12); color: #7dd3fc; }
.td-card-del {
  background: none; border: none; color: #5a3a3a; font-size: 18px; cursor: pointer;
  padding: 0 4px; line-height: 1; transition: .15s;
  &:hover { color: #f87171; }
}
.td-card-meta { display: flex; gap: 12px; font-size: 11px; color: #5a7a9a; }

.td-section {
  margin-bottom: 6px; border-radius: 6px;
  background: rgba(0, 180, 255, 0.03); border: 1px solid rgba(0, 180, 255, 0.06);
  overflow: hidden;
}
.td-toggle {
  width: 100%; padding: 9px 12px; background: none; border: none;
  color: #a9bcd6; font-size: 13px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 6px; text-align: left;
  &:hover { color: #cfe4fb; }
  span { display: inline-block; transition: transform .2s; font-size: 10px; color: #00eaff; }
  span.rotate { transform: rotate(90deg); }
}
.td-badge { margin-left: auto; font-size: 10px; padding: 1px 6px; border-radius: 8px; background: rgba(0,200,255,.12); color: #7dd3fc; font-weight: 400; }
.td-body { padding: 8px 12px 12px; }

.td-kv { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; color: #8aa0bd; b { color: #d7e3f5; font-weight: 600; } }

.td-view-btn {
  margin-top: 8px; width: 100%; padding: 8px; border: none; border-radius: 5px;
  background: linear-gradient(135deg, rgba(56,189,248,.12), rgba(0,234,255,.08));
  color: #00eaff; font-size: 13px; font-weight: 600; cursor: pointer;
  border: 1px solid rgba(0, 234, 255, 0.15);
  &:hover { background: rgba(0, 234, 255, 0.15); }
}

.td-section-divider { height: 1px; background: rgba(0, 180, 255, 0.1); margin: 10px 0; }
.td-anomaly-list { display: flex; flex-direction: column; gap: 4px; }
.td-anomaly-card { padding: 6px 8px; border-radius: 4px; background: rgba(0, 180, 255, 0.04); border: 1px solid rgba(0, 180, 255, 0.06); }
.td-anomaly-header { display: flex; justify-content: space-between; align-items: center; }
.td-anomaly-id { font-size: 12px; font-weight: 700; color: #c7d5ea; }
.td-anomaly-k { font-size: 13px; font-weight: 700; }
.td-anomaly-meta { font-size: 10px; color: #5a7a9a; margin-top: 2px; display: flex; justify-content: space-between; }

.td-gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.td-thumb {
  cursor: pointer; border-radius: 4px; overflow: hidden;
  border: 1px solid rgba(0, 180, 255, 0.08); position: relative;
  &:hover { border-color: rgba(0, 234, 255, 0.3); }
  img { width: 100%; height: auto; display: block; }
  .td-thumb-label { position: absolute; bottom: 0; left: 0; right: 0; padding: 2px 4px; background: rgba(0,0,0,0.6); font-size: 10px; color: #8aa0bd; text-align: center; }
}

.td-full-img { width: 100%; border-radius: 4px; cursor: pointer; border: 1px solid rgba(0, 180, 255, 0.08); &:hover { border-color: rgba(0, 234, 255, 0.3); } }

.td-download-btn { display: block; text-align: center; margin-top: 8px; padding: 8px; background: rgba(68, 255, 136, 0.08); border: 1px solid rgba(68, 255, 136, 0.2); border-radius: 5px; color: #44ff88; font-size: 13px; text-decoration: none; cursor: pointer; &:hover { background: rgba(68, 255, 136, 0.15); } }

.td-modal { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.td-modal-img { max-width: 90vw; max-height: 90vh; object-fit: contain; cursor: default; }
.td-modal-close { position: fixed; top: 16px; right: 24px; background: none; border: none; color: #fff; font-size: 32px; cursor: pointer; z-index: 10000; }
</style>
