<template>
  <aside class="right-panel">
    <div id="rp-resize-handle" style="
      position:absolute; left:0; top:0; bottom:0; width:5px;
      cursor:col-resize; z-index:10; background:transparent;
    " title="拖动调整面板宽度"></div>

    <!-- 断面信息 -->
    <div class="rp-section">
      <div class="rp-title">断面信息</div>
      <div class="kv-row"><span class="kv-key">桩号</span><span class="kv-val">K35+120</span></div>
      <div class="kv-row"><span class="kv-key">开挖部位</span><span class="kv-val">上台阶</span></div>
      <div class="kv-row"><span class="kv-key">净宽</span><span class="kv-val">9.11 m</span></div>
      <div class="kv-row"><span class="kv-key">开挖高度</span><span class="kv-val">9.98 m</span></div>
      <div class="kv-row"><span class="kv-key">开挖面积</span><span class="kv-val">77.33 m²</span></div>
      <div class="kv-row"><span class="kv-key">围岩等级</span><span class="kv-val">Ⅳ级围岩</span></div>
      <div class="kv-row"><span class="kv-key">爆破方式</span><span class="kv-val">光面爆破</span></div>
    </div>

    <!-- 掌子面素描 -->
    <div class="rp-section">
      <div class="rp-title">掌子面素描</div>
      <p class="face-sketch-text">掌子面地层岩性为侏罗系中统桑卡拉佣组灰岩，矿物成分以方解石为主，隐晶质结构，中薄层状构造，新鲜面呈灰色，弱风化，锤击声较清脆，轻微回弹，稍振手，较难击碎，判定围岩为硬岩。 层理产状：N51°W/47°N 主要结构面发育3组，产状如下： J1：N58°W/45°S，d=0.4～1.0m，L＞5m，平直粗糙、微张、泥质胶结，结合度差； J2：N46°W/13°N，d=0.4～1.0m，L＞5m，平直粗糙、微张、泥质胶结，结合度差； J3：N65°W/70°S，d=0.4～1.0m，L＞5m，平直粗糙、微张、泥质胶结，结合度差； 根据结构面组数及结合度判定结构面发育程度为较发育，结合差。综合结构面发育特征及结合程度，判定围岩完整程度为较破碎，掌子面拱顶区域相对破碎，掌子面溶蚀裂隙发育，见黄褐色泥质物充填；掌子面见渗滴水，受开挖扰动，掌子面存在薄层脱落掉块风险。综合分析，判定为Ⅳ级围岩。</p>
    </div>

    <!-- 炮孔参数 -->
    <div class="rp-section">
      <div class="rp-title">炮孔参数</div>
      <div class="kv-row"><span class="kv-key">孔径</span><span class="kv-val">φ 42 mm</span></div>
      <div class="kv-row"><span class="kv-key">孔深</span><span class="kv-val">3.5 m</span></div>
      <div class="kv-row"><span class="kv-key">超深</span><span class="kv-val">0.2 m</span></div>
      <div class="kv-row"><span class="kv-key">外插角</span><span class="kv-val">3°</span></div>
      <div class="kv-row"><span class="kv-key">不耦合系数</span><span class="kv-val">2.8</span></div>
    </div>

    <!-- 可调参数 -->
    <div class="rp-section">
      <div class="rp-title">可调参数</div>

      <div class="param-row">
        <label>周边孔数量</label>
        <input type="number" v-model.number="form.perimCount" min="1" step="1" placeholder="0">
        <span class="param-unit">个</span>
      </div>
      <div class="param-row">
        <label>周边孔间距</label>
        <input type="number" v-model.number="form.perimSpacing" min="1" step="1" placeholder="0">
        <span class="param-unit">cm</span>
      </div>
      <div class="param-row">
        <label>周边孔装药量</label>
        <input type="number" v-model.number="form.perimCharge" min="0" step="1" placeholder="0">
        <span class="param-unit">支</span>
      </div>

      <div class="param-divider"></div>

      <div class="param-row">
        <label>内圈孔数量</label>
        <input type="number" v-model.number="form.innerCount" min="1" step="1" placeholder="0">
        <span class="param-unit">个</span>
      </div>
      <div class="param-row">
        <label>内圈孔间距</label>
        <input type="number" v-model.number="form.innerSpacing" min="1" step="1" placeholder="0">
        <span class="param-unit">cm</span>
      </div>
      <div class="param-row">
        <label>内圈孔装药量</label>
        <input type="number" v-model.number="form.innerCharge" min="0" step="1" placeholder="0">
        <span class="param-unit">支</span>
      </div>

      <button class="param-btn" @click="handleDesign">▶ 参数设计</button>
      <button class="param-btn-reset" @click="handleReset">↺ 重置孔位</button>
      <button class="param-btn-eval" @click="handleEval">◈ 评估结果</button>
    </div>

    <!-- 爆破效果 -->
    <div class="rp-section">
      <div class="rp-title">爆破效果</div>
      <div class="effect-row">
        <span class="effect-key">半孔残留率</span>
        <span class="effect-val" :class="{ pending: !evalDone }">
          {{ evalDone ? halfhole : '— %' }}
        </span>
      </div>
      <div class="effect-row">
        <span class="effect-key">线性平均超挖</span>
        <span class="effect-val" :class="{ pending: !evalDone }">
          {{ evalDone ? overbreak : '— m' }}
        </span>
      </div>
    </div>
  </aside>
</template>

<script setup>
// @ts-nocheck
import { reactive, ref, onMounted } from 'vue'

const emit = defineEmits(['design', 'reset', 'eval'])

const form = reactive({
  perimCount:   '',
  perimSpacing: '',
  perimCharge:  '',
  innerCount:   '',
  innerSpacing: '',
  innerCharge:  '',
})

const evalDone  = ref(false)
const halfhole  = ref('— %')
const overbreak = ref('— m')

function handleDesign() {
  const perimN = form.perimCount ? parseInt(form.perimCount, 10) : null
  const innerN = form.innerCount ? parseInt(form.innerCount, 10) : null
  emit('design', { perimN, innerN })
}

function handleReset() {
  Object.keys(form).forEach(k => { form[k] = '' })
  evalDone.value  = false
  halfhole.value  = '— %'
  overbreak.value = '— m'
  emit('reset')
}

function handleEval() {
  const allFilled = [
    form.perimCount, form.perimSpacing, form.perimCharge,
    form.innerCount, form.innerSpacing, form.innerCharge,
  ].every(v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v)))

  if (!allFilled) {
    alert('请先填写全部可调参数后再评估。')
    return
  }

  halfhole.value  = '90.32 %'
  overbreak.value = '0.155 m'
  evalDone.value  = true
  emit('eval')
}

onMounted(() => {
  const handle = document.getElementById('rp-resize-handle')
  const panel  = document.querySelector('.right-panel')
  let dragging = false

  handle.addEventListener('mousedown', e => {
    dragging = true
    e.preventDefault()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  })
  document.addEventListener('mousemove', e => {
    if (!dragging) return
    const appRect = document.querySelector('.app-body').getBoundingClientRect()
    const newW = appRect.right - e.clientX
    if (newW >= 180 && newW <= 420) panel.style.width = newW + 'px'
  })
  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })
})
</script>

<style scoped lang="scss">
.right-panel {
  position: relative;
  width: 270px;
  flex-shrink: 0;
  background: rgba(0, 8, 22, 0.88);
  border-left: 1px solid rgba(0, 150, 255, 0.2);
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 150, 255, 0.25) transparent;
  font-family: "Microsoft YaHei", sans-serif;
}

.rp-section {
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 100, 200, 0.1);

  &:last-child { border-bottom: none; }
}

.rp-title {
  font-size: 11px;
  font-weight: bold;
  color: rgba(0, 200, 255, 0.65);
  letter-spacing: 1px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 150, 255, 0.12);
  margin-bottom: 6px;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  font-size: 11px;
}

.kv-key {
  color: rgba(180, 220, 255, 0.45);
  flex-shrink: 0;
}

.kv-val {
  color: rgba(200, 240, 255, 0.85);
  font-family: 'Consolas', monospace;
  text-align: right;
}

.face-sketch-text {
  font-size: 10px;
  line-height: 1.7;
  color: rgba(180, 220, 255, 0.5);
  margin: 0;
  max-height: 100px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 120, 200, 0.2) transparent;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;

  label {
    font-size: 11px;
    color: rgba(180, 220, 255, 0.5);
    width: 88px;
    flex-shrink: 0;
  }

  input[type='number'] {
    flex: 1;
    min-width: 0;
    background: rgba(0, 20, 50, 0.7);
    border: 1px solid rgba(0, 150, 255, 0.3);
    border-radius: 2px;
    color: #a0d4ff;
    font-size: 12px;
    font-family: 'Consolas', monospace;
    padding: 3px 6px;
    outline: none;
    transition: border-color 0.15s;

    &:focus { border-color: rgba(0, 200, 255, 0.6); }
    &::-webkit-inner-spin-button { opacity: 0.5; }
  }
}

.param-unit {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.35);
  width: 16px;
  flex-shrink: 0;
  text-align: right;
}

.param-divider {
  height: 1px;
  background: rgba(0, 100, 200, 0.1);
  margin: 4px 0;
}

.param-btn,
.param-btn-reset,
.param-btn-eval {
  width: 100%;
  margin-top: 6px;
  padding: 6px 0;
  border-radius: 2px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.5px;
}

.param-btn {
  background: rgba(0, 80, 180, 0.55);
  border: 1px solid rgba(0, 150, 255, 0.45);
  color: #60c8ff;

  &:hover { background: rgba(0, 100, 220, 0.7); border-color: #00aaff; color: #00eaff; }
}

.param-btn-reset {
  background: rgba(20, 0, 60, 0.5);
  border: 1px solid rgba(120, 80, 255, 0.35);
  color: rgba(180, 160, 255, 0.7);

  &:hover { background: rgba(40, 0, 100, 0.65); border-color: rgba(160, 120, 255, 0.55); color: #c0a8ff; }
}

.param-btn-eval {
  background: rgba(0, 60, 40, 0.55);
  border: 1px solid rgba(0, 200, 120, 0.35);
  color: rgba(100, 220, 160, 0.75);

  &:hover { background: rgba(0, 90, 60, 0.65); border-color: rgba(0, 220, 140, 0.55); color: #44ffaa; }
}

.effect-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 11px;
  border-bottom: 1px solid rgba(0, 80, 160, 0.08);

  &:last-child { border-bottom: none; }
}

.effect-key {
  color: rgba(180, 220, 255, 0.45);
}

.effect-val {
  font-family: 'Consolas', monospace;
  font-size: 13px;
  font-weight: bold;
  color: #44ffaa;

  &.pending { color: rgba(180, 220, 255, 0.25); font-size: 11px; font-weight: normal; }
}
</style>
