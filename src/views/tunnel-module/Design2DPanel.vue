<template>
  <div v-if="visible" class="d2d">
    <div class="d2d-h">
      <span class="d2d-title">二维炮孔设计图</span>
    </div>
    <div class="d2d-sub">正洞 Ⅳ级全断面光面爆破 · 桩号断面</div>

    <svg v-if="loaded" :viewBox="vb" class="d2d-svg" preserveAspectRatio="xMidYMid meet">
      <polygon :points="contourPts" fill="none" stroke="#34d399" stroke-width="0.055"
        stroke-dasharray="0.22 0.16" stroke-linejoin="round" />
      <circle v-for="(h, i) in holes" :key="i" :cx="h.x" :cy="h.y" r="0.12" :fill="h.color" />
    </svg>
    <div v-else class="d2d-loading">加载中…</div>

    <div class="d2d-legend">
      <span v-for="c in cats" :key="c.key"><i :style="{ background: c.color }"></i>{{ c.label }} {{ c.count }}</span>
    </div>

    <div class="d2d-params">
      <div v-for="p in params" :key="p[0]"><label>{{ p[0] }}</label><b>{{ p[1] }}</b></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
defineProps<{ visible: boolean }>()

const loaded = ref(false)
const contourPts = ref('')
const holes = ref<{ x: number; y: number; color: string }[]>([])
const cats = ref<{ key: string; label: string; color: string; count: number }[]>([])
const vb = ref('-6.6 -9.6 13.2 10.2')
const params = ref<[string, string][]>([])

onMounted(async () => {
  try {
    const d = await fetch('data/blast/blast-design.json').then(r => r.json())
    // 二维正视: svgX = x(横向), svgY = -z(上, SVG向下为正故取负)
    contourPts.value = d.contour.map((p: number[]) => `${p[0].toFixed(3)},${(-p[2]).toFixed(3)}`).join(' ')
    holes.value = d.holes.map((h: any) => ({ x: h.collar[0], y: -h.collar[2], color: h.color }))
    cats.value = Object.entries(d.categories).map(([k, v]: any) => ({ key: k, label: v.label, color: v.color, count: v.count }))
    const xs = d.contour.map((p: number[]) => p[0])
    const zs = d.contour.map((p: number[]) => p[2])
    const minx = Math.min(...xs) - 0.4, maxx = Math.max(...xs) + 0.4
    const minz = Math.min(...zs) - 0.4, maxz = Math.max(...zs) + 0.4
    vb.value = `${minx.toFixed(2)} ${(-maxz).toFixed(2)} ${(maxx - minx).toFixed(2)} ${(maxz - minz).toFixed(2)}`
    const m = d.metadata, sp = m.sectionSpec
    params.value = [
      ['开挖宽', sp.excavationWidthM + ' m'],
      ['拱顶高', sp.crownHeightM + ' m'],
      ['循环进尺', m.advanceM + ' m'],
      ['炮孔总数', m.totalCharged + ' 个'],
      ['孔径', 'φ45 mm'],
      ['坐标系', '单循环相对(X=0 中线)'],
    ]
    loaded.value = true
  } catch (e) {
    console.error('[Design2D] 加载设计失败', e)
  }
})
</script>

<style scoped>
.d2d {
  position: absolute; left: 18px; top: 232px;
  width: 340px; max-height: calc(100vh - 252px); overflow: auto;
  background: rgba(11, 16, 26, 0.94); border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 12px; padding: 14px 16px; backdrop-filter: blur(8px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5); z-index: 20;
  color: #e6eefb; font-family: system-ui, "Microsoft YaHei", sans-serif;
}
.d2d-h { display: flex; align-items: center; justify-content: space-between; }
.d2d-title { font-size: 15px; font-weight: 700; color: #7dd3fc; }
.d2d-sub { font-size: 12px; color: #8aa0bd; margin: 4px 0 10px; }

.d2d-svg { width: 100%; height: 250px; display: block;
  background: radial-gradient(ellipse at center, #0e1524 0%, #080c14 100%);
  border: 1px solid rgba(56, 189, 248, 0.12); border-radius: 8px; }
.d2d-loading { height: 250px; display: flex; align-items: center; justify-content: center; color: #8aa0bd; font-size: 13px; }

.d2d-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 10px 2px; }
.d2d-legend span { display: inline-flex; align-items: center; font-size: 12px; color: #c7d5ea; }
.d2d-legend i { width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; display: inline-block; }

.d2d-params { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 4px; }
.d2d-params > div { background: rgba(56, 189, 248, 0.06); border-radius: 6px; padding: 6px 9px; }
.d2d-params label { display: block; font-size: 11px; color: #8aa0bd; margin-bottom: 2px; }
.d2d-params b { font-size: 13px; color: #eaf2ff; font-weight: 600; }
</style>
