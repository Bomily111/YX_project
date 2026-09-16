<template>
  <div class="gv-root">
    <header class="gv-header">
      <div class="gv-brand">
        <button class="gv-back" type="button" title="返回平台" @click="router.push('/')">‹</button>
        <div class="gv-brand-mark">GV</div>
        <div>
          <h1>综合物探体素建模</h1>
          <p>视电阻率 · 富水异常体 · 围岩分级</p>
        </div>
      </div>
      <div class="gv-header-actions">
        <span class="gv-safety-badge"><i></i> 仅使用本次对话框输入</span>
        <button class="gv-primary" type="button" @click="dialogOpen = true">{{ model ? '更换数据' : '导入数据' }}</button>
      </div>
    </header>

    <main class="gv-main">
      <aside class="gv-left-panel">
        <section class="gv-panel-section">
          <div class="gv-section-title">模型视图</div>
          <div class="gv-presets">
            <button
              v-for="preset in presets"
              :key="preset.key"
              type="button"
              :class="{ active: activePreset === preset.key }"
              :disabled="!model || (preset.key === 'grades' && !hasClassification)"
              @click="applyPreset(preset.key)"
            >
              <span>{{ preset.icon }}</span>
              <span><b>{{ preset.label }}</b><small>{{ preset.description }}</small></span>
            </button>
          </div>
        </section>

        <section class="gv-panel-section">
          <div class="gv-section-title">图层控制</div>
          <label v-for="layer in layerOptions" :key="layer.key" class="gv-layer-row" :class="{ disabled: !layerAvailable(layer.key) }">
            <input
              v-model="layerVisibility[layer.key]"
              type="checkbox"
              :disabled="!model || !layerAvailable(layer.key)"
              @change="syncLayer(layer.key)"
            />
            <i :style="{ background: layer.color, boxShadow: `0 0 8px ${layer.color}` }"></i>
            <span>{{ layer.label }}</span>
            <em>{{ formatCount(layerCount(layer.key)) }}</em>
          </label>
        </section>

        <section class="gv-panel-section">
          <div class="gv-section-title">显示参数</div>
          <label class="gv-control-row">
            <span>色谱</span>
            <select v-model="palette" :disabled="!model" @change="sceneApi?.setPalette(palette)">
              <option value="viridis">Viridis</option>
              <option value="jet">Jet / Rainbow</option>
            </select>
          </label>
          <label class="gv-slider-row">
            <span>电阻率透明度 <b>{{ Math.round(resistivityOpacity * 100) }}%</b></span>
            <input v-model.number="resistivityOpacity" :disabled="!model" min="0.05" max="1" step="0.01" type="range" @input="updateOpacity('resistivity')" />
          </label>
          <label class="gv-slider-row">
            <span>富水体透明度 <b>{{ Math.round(waterOpacity * 100) }}%</b></span>
            <input v-model.number="waterOpacity" :disabled="!model" min="0.05" max="1" step="0.01" type="range" @input="updateOpacity('water')" />
          </label>
          <label class="gv-slider-row">
            <span>分级体透明度 <b>{{ Math.round(gradeOpacity * 100) }}%</b></span>
            <input v-model.number="gradeOpacity" :disabled="!model" min="0.05" max="1" step="0.01" type="range" @input="updateOpacity('grades')" />
          </label>
        </section>

        <section class="gv-panel-section">
          <div class="gv-section-title">剖切查看</div>
          <div class="gv-axis-tabs">
            <button v-for="axis in sliceAxes" :key="axis.key" type="button" :class="{ active: sliceAxis === axis.key }" :disabled="!model" @click="setSliceAxis(axis.key)">{{ axis.label }}</button>
          </div>
          <label v-if="sliceAxis !== 'none'" class="gv-slider-row compact">
            <span>保留范围 <b>{{ Math.round(sliceFraction * 100) }}%</b></span>
            <input v-model.number="sliceFraction" min="0" max="1" step="0.01" type="range" @input="updateSlice" />
          </label>
          <button class="gv-ghost-btn" type="button" :disabled="!model" @click="sceneApi?.resetCamera()">重置相机</button>
        </section>
      </aside>

      <section ref="canvasHost" class="gv-stage">
        <div class="gv-stage-grid"></div>
        <div v-if="!model && !processing" class="gv-empty-state">
          <div class="gv-empty-cube"><span></span></div>
          <h2>等待有效点位数据</h2>
          <p>当前场景为空，不含默认体素、示例坐标或外部数据。</p>
          <button class="gv-primary" type="button" @click="dialogOpen = true">打开数据对话框</button>
        </div>
        <div v-if="processing" class="gv-processing">
          <div class="gv-spinner"></div>
          <b>{{ progress.phase }}</b>
          <span v-if="progress.total">{{ formatCount(progress.completed) }} / {{ formatCount(progress.total) }}</span>
        </div>
        <div v-if="model" class="gv-coordinate-note">TEM X=前向、Y=横向；TSP Y−首断面=前向、X=横向；Z=高程</div>
        <div v-if="model" class="gv-colorbar">
          <span>{{ formatScalar(model.field.valueRange[0]) }}</span>
          <div :class="palette"></div>
          <span>{{ formatScalar(model.field.valueRange[1]) }} Ω·m</span>
        </div>
      </section>

      <aside class="gv-right-panel">
        <div class="gv-status-head">
          <span>工程自检</span>
          <i :class="{ ready: model }">{{ model ? '模型就绪' : '等待输入' }}</i>
        </div>

        <section class="gv-metric-grid">
          <div><span>电阻率有效点</span><b>{{ formatCount(model?.statistics.resistivityInput ?? 0) }}</b></div>
          <div><span>富水体素</span><b class="water">{{ formatCount(model?.statistics.waterRich ?? 0) }}</b></div>
          <div><span>完成分级</span><b>{{ formatCount(model?.statistics.classified ?? 0) }}</b></div>
          <div><span>对齐剔除</span><b class="warn">{{ formatCount(model?.statistics.rejectedDuringAlignment ?? 0) }}</b></div>
        </section>

        <section class="gv-audit-card">
          <h3>数据流水线</h3>
          <div class="gv-audit-row"><i :class="{ pass: model }"></i><span>未请求或加载预置模型数据</span></div>
          <div class="gv-audit-row"><i :class="{ pass: model }"></i><span>坐标与体素尺寸来自输入或输入推导</span></div>
          <div class="gv-audit-row"><i :class="{ pass: model }"></i><span>前向：TEM X ↔ TSP Y−首断面；横向：TEM Y ↔ TSP X</span></div>
          <div class="gv-audit-row"><i :class="{ pass: model }"></i><span>无效点与缺失插值邻域已剔除</span></div>
        </section>

        <section class="gv-audit-card">
          <h3>边界规则</h3>
          <div class="gv-rule"><span>ρs &lt; 570</span><b>富水</b></div>
          <div class="gv-rule"><span>ρs = 570</span><b>非富水</b></div>
          <div class="gv-rule"><span>Vp/Vs &lt; 1.7</span><b>Ⅱ</b></div>
          <div class="gv-rule"><span>1.7 ≤ Vp/Vs &lt; 2.0</span><b>Ⅲ</b></div>
          <div class="gv-rule"><span>Vp/Vs ≥ 2.0</span><b>Ⅳ</b></div>
          <div class="gv-rule"><span>富水耦合</span><b>劣化一级</b></div>
        </section>

        <section class="gv-audit-card">
          <h3>渲染与内存</h3>
          <p>全部有效体素参与阈值和分级计算；显示层使用 InstancedMesh。超大数据按固定步长选取真实点位作 LOD，不产生新坐标。</p>
          <div v-if="renderStats" class="gv-render-stats">
            <span>电阻率显示</span><b>{{ formatCount(renderStats.resistivity.rendered) }} / {{ formatCount(renderStats.resistivity.available) }}</b>
          </div>
        </section>
      </aside>
    </main>

    <div v-if="dialogOpen" class="gv-dialog-backdrop" @mousedown.self="closeDialog">
      <section class="gv-dialog" role="dialog" aria-modal="true" aria-labelledby="gv-dialog-title">
        <header>
          <div>
            <h2 id="gv-dialog-title">输入体素点位数据</h2>
            <p>仅解析此对话框中粘贴的内容或你明确选择的本地文件。</p>
          </div>
          <button type="button" title="关闭" @click="closeDialog">×</button>
        </header>

        <div class="gv-dialog-notice">
          <b>不补点、不外推、不造坐标</b>
          <span>CSV 支持有/无表头；电阻率按 X=前向/Y=横向，Vp/Vs 按 X=横向/Y=前向解析。</span>
        </div>

        <div class="gv-input-grid">
          <article v-for="definition in inputDefinitions" :key="definition.kind" class="gv-input-card" :class="definition.kind">
            <div class="gv-input-title">
              <span>{{ definition.short }}</span>
              <div><b>{{ definition.label }}</b><small>{{ definition.required }}</small></div>
            </div>
            <textarea
              v-model="inputs[definition.kind].text"
              :disabled="Boolean(inputs[definition.kind].file)"
              :placeholder="definition.placeholder"
              spellcheck="false"
            ></textarea>
            <div class="gv-file-row">
              <label>
                <input type="file" accept=".csv,.txt,.json,application/json,text/csv,text/plain" @change="selectFile(definition.kind, $event)" />
                {{ inputs[definition.kind].file ? '更换文件' : '选择本地文件' }}
              </label>
              <span v-if="inputs[definition.kind].file" :title="inputs[definition.kind].file?.name">{{ inputs[definition.kind].file?.name }}</span>
              <button v-if="inputs[definition.kind].file" type="button" @click="clearFile(definition.kind)">移除</button>
            </div>
          </article>
        </div>

        <details class="gv-format-help">
          <summary>输入格式说明</summary>
          <div>
            <p><b>CSV：</b><code>x,y,z,resistivity</code> / <code>x,y,z,vp</code> / <code>x,y,z,vs</code>；无表头时固定按 x、y、z、标量解析。</p>
            <p><b>JSON：</b><code>[{x, y, z, resistivity}]</code>，或 <code>{ points: [...], voxelSize: [dx, dy, dz] }</code>。单层/单列网格无法推导某轴尺寸时，必须显式提供 voxelSize。</p>
          </div>
        </details>

        <div v-if="buildError" class="gv-build-error">{{ buildError }}</div>

        <footer>
          <button class="gv-secondary" type="button" :disabled="processing" @click="closeDialog">取消</button>
          <button class="gv-primary" type="button" :disabled="processing" @click="buildModel">
            {{ processing ? '正在严格校验…' : '校验并构建模型' }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { parseScalarInput } from '@/modules/geophysical/input'
import { prepareVoxelModel } from '@/modules/geophysical/model'
import { VoxelScene } from '@/modules/geophysical/VoxelScene'
import type { LayerKey, PaletteName, SliceAxis } from '@/modules/geophysical/VoxelScene'
import type {
  InputSelection,
  PreparationProgress,
  PreparedVoxelModel,
  RenderStatistics,
  ScalarKind,
} from '@/modules/geophysical/types'

type PresetKey = 'resistivity' | 'water' | 'grades'

const router = useRouter()
const canvasHost = ref<HTMLElement | null>(null)
const sceneApi = shallowRef<VoxelScene | null>(null)
const model = shallowRef<PreparedVoxelModel | null>(null)
const renderStats = ref<RenderStatistics | null>(null)
const dialogOpen = ref(true)
const processing = ref(false)
const buildError = ref('')
const progress = reactive<PreparationProgress>({ phase: '', completed: 0, total: 0 })
const palette = ref<PaletteName>('viridis')
const sliceAxis = ref<SliceAxis>('none')
const sliceFraction = ref(1)
const activePreset = ref<PresetKey>('resistivity')
const resistivityOpacity = ref(0.68)
const waterOpacity = ref(0.32)
const gradeOpacity = ref(0.82)

const inputs = reactive<Record<ScalarKind, InputSelection>>({
  resistivity: { text: '', file: null },
  vp: { text: '', file: null },
  vs: { text: '', file: null },
})

const inputDefinitions: { kind: ScalarKind; short: string; label: string; required: string; placeholder: string }[] = [
  { kind: 'resistivity', short: 'ρs', label: '视电阻率', required: '必填 · Ω·m', placeholder: '粘贴 CSV / JSON 数据' },
  { kind: 'vp', short: 'Vp', label: '纵波波速', required: '分级时必填', placeholder: '粘贴 CSV / JSON 数据' },
  { kind: 'vs', short: 'Vs', label: '横波波速', required: '分级时必填 · Vs > 0', placeholder: '粘贴 CSV / JSON 数据' },
]

const presets: { key: PresetKey; icon: string; label: string; description: string }[] = [
  { key: 'resistivity', icon: '◫', label: '视电阻率体素', description: '连续色谱映射' },
  { key: 'water', icon: '≈', label: '富水异常体', description: 'ρs < 570 Ω·m' },
  { key: 'grades', icon: '◆', label: '综合围岩分级', description: 'Ⅱ / Ⅲ / Ⅳ / Ⅴ' },
]

const layerOptions: { key: LayerKey; label: string; color: string }[] = [
  { key: 'resistivity', label: '视电阻率', color: '#21b8a6' },
  { key: 'water', label: '富水异常体', color: '#16b9ff' },
  { key: 'grade2', label: 'Grade II · Ⅱ级', color: '#5a9fc6' },
  { key: 'grade3', label: 'Grade III · Ⅲ级', color: '#244b78' },
  { key: 'grade4', label: 'Grade IV · Ⅳ级', color: '#e8bd35' },
  { key: 'grade5', label: 'Grade V · Ⅴ级', color: '#8f3f20' },
]

const layerVisibility = reactive<Record<LayerKey, boolean>>({
  resistivity: true,
  water: false,
  grade2: false,
  grade3: false,
  grade4: false,
  grade5: false,
})

const sliceAxes: { key: SliceAxis; label: string }[] = [
  { key: 'none', label: '关闭' },
  { key: 'x', label: '前向 X' },
  { key: 'y', label: '横向 Y' },
  { key: 'z', label: '高程 Z' },
]

const hasClassification = computed(() => (model.value?.statistics.classified ?? 0) > 0)

function hasSource(kind: ScalarKind): boolean {
  return Boolean(inputs[kind].file || inputs[kind].text.trim())
}

function sourceFor(kind: ScalarKind): string | File {
  const selected = inputs[kind]
  return selected.file ?? selected.text
}

function selectFile(kind: ScalarKind, event: Event) {
  const target = event.target as HTMLInputElement
  inputs[kind].file = target.files?.[0] ?? null
  buildError.value = ''
}

function clearFile(kind: ScalarKind) {
  inputs[kind].file = null
}

function closeDialog() {
  if (!processing.value) dialogOpen.value = false
}

async function buildModel() {
  buildError.value = ''
  if (!hasSource('resistivity')) {
    buildError.value = '请提供视电阻率点位数据。'
    return
  }
  if (hasSource('vp') !== hasSource('vs')) {
    buildError.value = 'Vp 与 Vs 必须同时提供；缺少任一数据时不会执行围岩分级。'
    return
  }

  processing.value = true
  progress.phase = '解析视电阻率有效点位'
  progress.completed = 0
  progress.total = 0
  try {
    const resistivity = await parseScalarInput(sourceFor('resistivity'), 'resistivity')
    let vp = null
    let vs = null
    if (hasSource('vp') && hasSource('vs')) {
      progress.phase = '解析 Vp 有效点位'
      vp = await parseScalarInput(sourceFor('vp'), 'vp')
      progress.phase = '解析 Vs 有效点位并过滤 Vs ≤ 0'
      vs = await parseScalarInput(sourceFor('vs'), 'vs')
    }
    const prepared = await prepareVoxelModel(resistivity, vp, vs, value => Object.assign(progress, value))
    model.value = prepared
    await nextTick()
    if (!sceneApi.value && canvasHost.value) sceneApi.value = new VoxelScene(canvasHost.value)
    renderStats.value = sceneApi.value?.setModel(prepared) ?? null
    sceneApi.value?.setPalette(palette.value)
    sceneApi.value?.setOpacity('resistivity', resistivityOpacity.value)
    sceneApi.value?.setOpacity('water', waterOpacity.value)
    sceneApi.value?.setOpacity('grades', gradeOpacity.value)
    applyPreset('resistivity')
    dialogOpen.value = false
  } catch (error) {
    buildError.value = error instanceof Error ? error.message : String(error)
    dialogOpen.value = true
  } finally {
    processing.value = false
  }
}

function applyPreset(preset: PresetKey) {
  activePreset.value = preset
  const next: Record<LayerKey, boolean> = {
    resistivity: preset === 'resistivity' || preset === 'water',
    water: preset === 'water',
    grade2: preset === 'grades',
    grade3: preset === 'grades',
    grade4: preset === 'grades',
    grade5: preset === 'grades',
  }
  for (const key of Object.keys(next) as LayerKey[]) {
    layerVisibility[key] = next[key] && layerAvailable(key)
    sceneApi.value?.setLayerVisible(key, layerVisibility[key])
  }
  if (preset === 'water') sceneApi.value?.setOpacity('resistivity', Math.min(resistivityOpacity.value, 0.18))
  else sceneApi.value?.setOpacity('resistivity', resistivityOpacity.value)
}

function syncLayer(key: LayerKey) {
  activePreset.value = 'resistivity'
  sceneApi.value?.setLayerVisible(key, layerVisibility[key])
}

function layerAvailable(key: LayerKey): boolean {
  return layerCount(key) > 0
}

function layerCount(key: LayerKey): number {
  if (!model.value) return 0
  if (key === 'resistivity') return model.value.statistics.resistivityInput
  if (key === 'water') return model.value.statistics.waterRich
  const grade = Number(key.slice(-1)) as 2 | 3 | 4 | 5
  return model.value.statistics.grades[grade]
}

function updateOpacity(layer: 'resistivity' | 'water' | 'grades') {
  const value = layer === 'resistivity'
    ? resistivityOpacity.value
    : layer === 'water'
      ? waterOpacity.value
      : gradeOpacity.value
  sceneApi.value?.setOpacity(layer, value)
}

function setSliceAxis(axis: SliceAxis) {
  sliceAxis.value = axis
  updateSlice()
}

function updateSlice() {
  sceneApi.value?.setSlice(sliceAxis.value, sliceFraction.value)
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatScalar(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2)
}

onMounted(() => {
  if (canvasHost.value) sceneApi.value = new VoxelScene(canvasHost.value)
})

onBeforeUnmount(() => sceneApi.value?.dispose())
</script>

<style scoped>
.gv-root {
  --cyan: #27d6f5;
  --cyan-soft: rgba(39, 214, 245, .14);
  --panel: rgba(7, 17, 29, .94);
  width: 100%; height: 100%; color: #d9e8f2; overflow: hidden;
  background: #050b14; font-family: Inter, "Microsoft YaHei", sans-serif;
}
.gv-header {
  position: relative; z-index: 20; height: 68px; padding: 0 18px 0 16px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(79, 177, 215, .2);
  background: linear-gradient(90deg, #0a1726, #07111d 56%, #091724);
  box-shadow: 0 6px 30px rgba(0,0,0,.3);
}
.gv-brand, .gv-header-actions { display: flex; align-items: center; gap: 12px; }
.gv-back { width: 34px; height: 34px; border: 1px solid #23445a; border-radius: 8px; color: #8fb8cd; background: #0b2030; font-size: 26px; cursor: pointer; }
.gv-brand-mark { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #28c6e0; border-radius: 9px; color: #51e3f9; background: rgba(18,142,170,.16); font: 700 12px Consolas; box-shadow: inset 0 0 18px rgba(39,214,245,.12); }
.gv-brand h1 { margin: 0; color: #eefaff; font-size: 17px; letter-spacing: 1px; }
.gv-brand p { margin: 4px 0 0; color: #63859c; font-size: 10px; letter-spacing: .8px; }
.gv-safety-badge { padding: 7px 10px; border: 1px solid rgba(57,195,160,.2); border-radius: 20px; color: #74cbb2; background: rgba(19,108,82,.1); font-size: 11px; }
.gv-safety-badge i { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #38d39f; box-shadow: 0 0 8px #38d39f; }
.gv-primary, .gv-secondary, .gv-ghost-btn { border-radius: 7px; padding: 8px 15px; font-weight: 600; cursor: pointer; }
.gv-primary { border: 1px solid #26bed9; color: #04131b; background: linear-gradient(135deg, #54e5f8, #22bbdc); box-shadow: 0 5px 18px rgba(28,173,206,.2); }
.gv-secondary { border: 1px solid #33495b; color: #a9bdca; background: #152330; }
.gv-primary:disabled, .gv-secondary:disabled, .gv-ghost-btn:disabled { opacity: .45; cursor: default; }
.gv-main { height: calc(100% - 68px); display: grid; grid-template-columns: 286px minmax(0,1fr) 286px; }
.gv-left-panel, .gv-right-panel { position: relative; z-index: 8; min-height: 0; overflow-y: auto; background: var(--panel); scrollbar-width: thin; scrollbar-color: #21465c transparent; }
.gv-left-panel { border-right: 1px solid rgba(75,158,191,.16); }
.gv-right-panel { border-left: 1px solid rgba(75,158,191,.16); padding-bottom: 20px; }
.gv-panel-section { padding: 15px 16px; border-bottom: 1px solid rgba(74,143,171,.12); }
.gv-section-title { margin-bottom: 10px; color: #678ca5; font-size: 10px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; }
.gv-presets { display: grid; gap: 6px; }
.gv-presets button { width: 100%; padding: 9px 10px; display: grid; grid-template-columns: 29px 1fr; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: 7px; color: #7894a7; background: rgba(16,38,55,.6); text-align: left; cursor: pointer; }
.gv-presets button > span:first-child { color: #4d90ad; font-size: 18px; text-align: center; }
.gv-presets b, .gv-presets small { display: block; }
.gv-presets b { color: #afc7d6; font-size: 12px; }
.gv-presets small { margin-top: 2px; color: #506d81; font-size: 9px; }
.gv-presets button.active { border-color: rgba(39,214,245,.4); background: linear-gradient(90deg, rgba(23,128,158,.26), rgba(15,51,70,.6)); }
.gv-presets button.active > span:first-child, .gv-presets button.active b { color: #56def2; }
.gv-presets button:disabled { opacity: .38; cursor: default; }
.gv-layer-row { height: 29px; display: grid; grid-template-columns: 18px 9px 1fr auto; align-items: center; gap: 7px; color: #91a8b8; font-size: 11px; }
.gv-layer-row input { accent-color: #24c8e5; }
.gv-layer-row i { width: 8px; height: 8px; border-radius: 2px; }
.gv-layer-row em { color: #4d697c; font: normal 9px Consolas; }
.gv-layer-row.disabled { opacity: .36; }
.gv-control-row, .gv-slider-row { display: block; margin-bottom: 11px; color: #7e9aac; font-size: 10px; }
.gv-control-row { display: flex; align-items: center; justify-content: space-between; }
.gv-control-row select { width: 126px; padding: 5px 7px; border: 1px solid #26475c; border-radius: 5px; color: #a9c7d8; background: #0b1b28; }
.gv-slider-row span { display: flex; justify-content: space-between; }
.gv-slider-row b { color: #55bfd5; font: 600 9px Consolas; }
.gv-slider-row input { width: 100%; margin: 7px 0 0; accent-color: #28cce8; }
.gv-slider-row.compact { margin-top: 10px; }
.gv-axis-tabs { display: grid; grid-template-columns: repeat(4,1fr); gap: 4px; }
.gv-axis-tabs button { padding: 5px; border: 1px solid #244357; border-radius: 4px; color: #638096; background: #0a1a27; cursor: pointer; }
.gv-axis-tabs button.active { color: #50dbef; border-color: #27bad4; background: rgba(27,147,175,.16); }
.gv-ghost-btn { width: 100%; padding: 7px; border: 1px solid #27465a; color: #7798ab; background: rgba(10,28,41,.7); font-size: 10px; }
.gv-stage { position: relative; min-width: 0; overflow: hidden; background: radial-gradient(circle at 50% 42%, #102437 0, #07111d 48%, #040910 100%); }
.gv-stage > canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; }
.gv-stage-grid { position: absolute; inset: 0; opacity: .15; background-image: linear-gradient(rgba(61,131,159,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(61,131,159,.16) 1px, transparent 1px); background-size: 42px 42px; mask-image: radial-gradient(circle, #000, transparent 72%); }
.gv-empty-state, .gv-processing { position: absolute; z-index: 5; left: 50%; top: 48%; transform: translate(-50%,-50%); display: flex; flex-direction: column; align-items: center; text-align: center; }
.gv-empty-state h2 { margin: 24px 0 7px; color: #a8c8da; font-size: 17px; font-weight: 500; }
.gv-empty-state p { margin: 0 0 20px; color: #557386; font-size: 11px; }
.gv-empty-cube { width: 72px; height: 72px; border: 1px solid rgba(54,199,225,.28); transform: rotate(30deg) skew(-8deg); box-shadow: inset 0 0 30px rgba(34,170,204,.05), 0 0 35px rgba(34,170,204,.08); }
.gv-empty-cube span { display: block; width: 42px; height: 42px; margin: 14px; border: 1px dashed rgba(62,204,230,.22); }
.gv-processing { padding: 22px 28px; border: 1px solid #21485e; border-radius: 10px; color: #82aec1; background: rgba(5,15,24,.9); }
.gv-processing b { margin-top: 12px; color: #b5d7e4; font-size: 12px; }.gv-processing span { margin-top: 5px; font: 10px Consolas; }
.gv-spinner { width: 30px; height: 30px; border: 2px solid rgba(45,198,225,.2); border-top-color: #41d9ef; border-radius: 50%; animation: gv-spin .8s linear infinite; }
@keyframes gv-spin { to { transform: rotate(360deg); } }
.gv-coordinate-note { position: absolute; z-index: 4; left: 14px; bottom: 13px; padding: 5px 8px; border-radius: 4px; color: #557b8e; background: rgba(3,11,18,.72); font-size: 9px; }
.gv-colorbar { position: absolute; z-index: 4; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(420px,60%); display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; color: #7394a6; font: 9px Consolas; }
.gv-colorbar div { height: 8px; border: 1px solid rgba(255,255,255,.15); border-radius: 5px; }.gv-colorbar div.viridis { background: linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725); }.gv-colorbar div.jet { background: linear-gradient(90deg,#000080,#006cff,#00ffff,#7dff00,#ffff00,#ff0000); }
.gv-status-head { height: 49px; padding: 0 15px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(74,143,171,.12); color: #9cb8c8; font-size: 12px; font-weight: 600; }
.gv-status-head i { padding: 3px 7px; border-radius: 10px; color: #6c8290; background: #172632; font: normal 9px Consolas; }.gv-status-head i.ready { color: #4fcea6; background: rgba(36,145,112,.13); }
.gv-metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 14px; border: 1px solid #173245; background: #173245; }
.gv-metric-grid div { padding: 10px; background: #0b1a27; }.gv-metric-grid span { display: block; color: #547185; font-size: 9px; }.gv-metric-grid b { display: block; margin-top: 5px; color: #b4d0dd; font: 600 16px Consolas; }.gv-metric-grid b.water { color: #35bff5; }.gv-metric-grid b.warn { color: #e2a95e; }
.gv-audit-card { margin: 0 14px 11px; padding: 11px 12px; border: 1px solid #173247; border-radius: 6px; background: rgba(10,26,39,.72); }
.gv-audit-card h3 { margin: 0 0 9px; color: #6d9ab4; font-size: 10px; letter-spacing: .8px; }
.gv-audit-card p { margin: 0; color: #587488; font-size: 9px; line-height: 1.65; }
.gv-audit-row { display: grid; grid-template-columns: 8px 1fr; gap: 7px; align-items: center; margin: 6px 0; color: #6a8799; font-size: 9px; }.gv-audit-row i { width: 7px; height: 7px; border: 1px solid #3b5667; border-radius: 50%; }.gv-audit-row i.pass { border: 0; background: #35cd9b; box-shadow: 0 0 6px #35cd9b; }
.gv-rule { display: flex; justify-content: space-between; margin: 6px 0; color: #648397; font: 9px Consolas; }.gv-rule b { color: #abc3d1; }.gv-render-stats { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #173247; color: #5e8296; font-size: 9px; }.gv-render-stats b { color: #8eb7ca; font: 9px Consolas; }
.gv-dialog-backdrop { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(1,6,11,.82); backdrop-filter: blur(9px); }
.gv-dialog { width: min(1040px, calc(100vw - 48px)); max-height: calc(100vh - 48px); overflow-y: auto; border: 1px solid #24506a; border-radius: 13px; background: #091724; box-shadow: 0 28px 90px rgba(0,0,0,.6); }
.gv-dialog > header { padding: 18px 21px; display: flex; justify-content: space-between; border-bottom: 1px solid #19364a; background: linear-gradient(90deg,#0d2232,#0a1927); }.gv-dialog h2 { margin: 0; color: #d7edf5; font-size: 16px; }.gv-dialog header p { margin: 4px 0 0; color: #638196; font-size: 10px; }.gv-dialog header > button { border: 0; color: #7493a6; background: none; font-size: 27px; cursor: pointer; }
.gv-dialog-notice { margin: 14px 18px 0; padding: 10px 12px; display: flex; gap: 12px; align-items: center; border: 1px solid rgba(58,203,164,.18); border-radius: 6px; color: #698e83; background: rgba(28,115,91,.08); font-size: 9px; }.gv-dialog-notice b { color: #55d4ae; font-size: 10px; white-space: nowrap; }
.gv-input-grid { padding: 14px 18px 10px; display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
.gv-input-card { padding: 12px; border: 1px solid #1b3b50; border-radius: 8px; background: #0b1c2a; }.gv-input-card.resistivity { border-color: rgba(45,182,191,.45); }
.gv-input-title { display: grid; grid-template-columns: 34px 1fr; gap: 8px; align-items: center; margin-bottom: 9px; }.gv-input-title > span { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 7px; color: #51dbea; background: rgba(31,149,172,.15); font: 700 11px Consolas; }.gv-input-title b, .gv-input-title small { display: block; }.gv-input-title b { color: #a8c5d4; font-size: 11px; }.gv-input-title small { margin-top: 2px; color: #4f6e81; font-size: 8px; }
.gv-input-card textarea { width: 100%; height: 174px; resize: vertical; padding: 9px; border: 1px solid #18384c; border-radius: 5px; outline: 0; color: #a6c0ce; background: #06131e; font: 9px/1.5 Consolas; }.gv-input-card textarea:focus { border-color: #298ba5; box-shadow: 0 0 0 2px rgba(39,184,213,.08); }.gv-input-card textarea:disabled { opacity: .35; }
.gv-file-row { height: 28px; display: flex; align-items: center; gap: 7px; margin-top: 7px; }.gv-file-row label { padding: 5px 8px; border: 1px solid #23516a; border-radius: 4px; color: #6fa8bf; background: rgba(21,67,88,.4); font-size: 9px; cursor: pointer; }.gv-file-row label input { display: none; }.gv-file-row span { min-width: 0; overflow: hidden; flex: 1; color: #607f91; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.gv-file-row button { border: 0; color: #b47777; background: none; font-size: 8px; cursor: pointer; }
.gv-format-help { margin: 0 18px 10px; padding: 8px 11px; border: 1px solid #17364a; border-radius: 6px; color: #64879b; background: rgba(7,22,34,.7); font-size: 9px; }.gv-format-help summary { cursor: pointer; color: #789db1; }.gv-format-help p { margin: 7px 0; }.gv-format-help code { padding: 2px 4px; border-radius: 3px; color: #7ec8d8; background: #07131d; }
.gv-build-error { margin: 0 18px 10px; padding: 9px 11px; border: 1px solid rgba(239,68,68,.32); border-radius: 6px; color: #f08e8e; background: rgba(127,33,33,.13); font-size: 10px; }
.gv-dialog > footer { padding: 12px 18px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #173347; }
@media (max-width: 1050px) { .gv-main { grid-template-columns: 260px minmax(0,1fr); }.gv-right-panel { display: none; } }
@media (max-width: 760px) { .gv-main { grid-template-columns: 1fr; }.gv-left-panel { position: absolute; z-index: 12; left: 0; top: 68px; bottom: 0; width: 250px; }.gv-safety-badge { display: none; }.gv-input-grid { grid-template-columns: 1fr; }.gv-dialog { width: calc(100vw - 20px); }.gv-dialog-backdrop { padding: 10px; } }
</style>
