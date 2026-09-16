<template>
  <div class="fs-root">
    <section class="fs-section">
      <div class="fs-title-row"><span>掌子面里程</span><small>{{ records.length }} 期揭露成果</small></div>
      <div class="fs-mileages">
        <button
          v-for="record in records"
          :key="record.mileage"
          type="button"
          :class="{ active: record.mileage === selected.mileage }"
          @click="selectRecord(record)"
        >{{ shortMileage(record.mileage) }}</button>
      </div>
    </section>

    <section class="fs-section fs-photo-card">
      <div class="fs-photo-head"><b>{{ selected.mileage }}</b><span>{{ selected.date }}</span></div>
      <img :src="selected.photoUrl" :alt="`${selected.mileage}掌子面现场照片`" @click="photoOpen = true" />
      <div class="fs-photo-foot"><span>已按里程插入隧道断面</span><em>点击照片放大</em></div>
    </section>

    <section class="fs-section">
      <div class="fs-title">素描基础信息</div>
      <div class="fs-metrics">
        <div><span>开挖宽度</span><b>{{ selected.width.toFixed(2) }} m</b></div>
        <div><span>开挖高度</span><b>{{ selected.height.toFixed(2) }} m</b></div>
        <div><span>开挖面积</span><b>{{ selected.area.toFixed(2) }} m²</b></div>
        <div><span>距洞口</span><b>{{ selected.distanceFromPortal.toFixed(1) }} m</b></div>
      </div>
      <div class="fs-kv"><span>开挖方式</span><b>{{ selected.excavation }}</b></div>
      <div class="fs-kv"><span>掌子面状态</span><b>{{ selected.faceState }}</b></div>
    </section>

    <section class="fs-section">
      <div class="fs-title">地质揭露</div>
      <div class="fs-tags">
        <span>{{ selected.rockType }}</span><span>{{ selected.rockHardness }}</span>
        <span>{{ selected.weathering }}</span><span>{{ selected.integrity }}</span>
      </div>
      <div class="fs-kv"><span>结构面</span><b>{{ selected.structureGroups }} 组 / 平均 {{ selected.averageSpacing }} m</b></div>
      <div class="fs-kv"><span>主要产状</span><b>{{ selected.orientations.join('；') }}</b></div>
      <div class="fs-kv"><span>围岩级别</span><b class="grade">{{ selected.basicGrade }} → {{ selected.correctedGrade }}</b></div>
      <div class="fs-kv"><span>地下水</span><b class="water">{{ selected.waterInflow }} L/(min·10m) · {{ selected.waterState }}</b></div>
      <div class="fs-kv"><span>埋深/应力</span><b>{{ selected.buriedDepth.toFixed(2) }} m · {{ selected.stressState }}</b></div>
    </section>

    <section class="fs-section fs-conclusion">
      <div class="fs-title">素描结论</div>
      <p>{{ selected.summary }}</p>
    </section>

    <div v-if="photoOpen" class="fs-modal" @click.self="photoOpen = false">
      <div><button type="button" @click="photoOpen = false">×</button><img :src="selected.photoUrl" :alt="`${selected.mileage}掌子面现场照片`" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FACE_SKETCH_RECORDS, type FaceSketchRecord } from '@/modules/face-sketch/data'

const emit = defineEmits<{ selectMileage: [mileage: string] }>()
const records = FACE_SKETCH_RECORDS
const selected = ref<FaceSketchRecord>(records[records.length - 1])
const photoOpen = ref(false)

function shortMileage(mileage: string) { return mileage.replace('X1DK2+', '+') }
function selectRecord(record: FaceSketchRecord) {
  selected.value = record
  emit('selectMileage', record.mileage)
}
</script>

<style scoped lang="scss">
.fs-root { color:#aec5d7; font-size:10px; }
.fs-section { margin-bottom:9px; padding:9px 10px; border:1px solid rgba(0,180,255,.09); border-radius:6px; background:rgba(0,180,255,.04); }
.fs-title,.fs-title-row { margin-bottom:7px; color:#5f91b8; font-size:10px; font-weight:600; letter-spacing:.4px; }
.fs-title-row { display:flex; justify-content:space-between; align-items:center; small { color:#4c7088; font-size:8px; font-weight:400; } }
.fs-mileages { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; button { padding:5px 2px; border:1px solid rgba(42,139,175,.2); border-radius:3px; color:#718da3; background:#071a28; cursor:pointer; font:9px Consolas; &:hover,&.active { border-color:#29cce6; color:#69e4f3; background:rgba(25,153,177,.16); } } }
.fs-photo-card { padding:7px; }
.fs-photo-head,.fs-photo-foot { display:flex; justify-content:space-between; align-items:center; }
.fs-photo-head { padding:1px 2px 6px; b { color:#8fe4ee; font:600 11px Consolas; } span { color:#62829a; font-size:8px; } }
.fs-photo-card img { width:100%; height:116px; display:block; object-fit:cover; border-radius:4px; cursor:zoom-in; }
.fs-photo-foot { padding:5px 2px 0; color:#5e8198; font-size:8px; em { color:#43879e; font-style:normal; } }
.fs-metrics { display:grid; grid-template-columns:1fr 1fr; gap:1px; margin-bottom:5px; border:1px solid rgba(44,127,157,.12); background:rgba(44,127,157,.12); div { padding:5px 6px; background:#071a28; } span,b { display:block; } span { color:#55758c; font-size:8px; } b { margin-top:2px; color:#bad1dd; font:600 10px Consolas; } }
.fs-kv { display:grid; grid-template-columns:60px 1fr; gap:7px; padding:4px 0; border-bottom:1px solid rgba(44,127,157,.08); &:last-child { border-bottom:0; } span { color:#56778f; } b { color:#aac2d1; font-size:9px; font-weight:500; line-height:1.45; text-align:right; } b.grade { color:#f3cf69; } b.water { color:#55c9ee; } }
.fs-tags { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:5px; span { padding:3px 5px; border-radius:3px; color:#71b8c8; background:rgba(29,144,162,.12); font-size:8px; } }
.fs-conclusion { border-color:rgba(44,194,151,.16); p { margin:0; color:#829eaf; font-size:9px; line-height:1.65; text-align:justify; } }
.fs-modal { position:fixed; z-index:1300; inset:0; display:grid; place-items:center; padding:5vh 370px 5vh 24px; background:rgba(1,7,12,.78); backdrop-filter:blur(4px); > div { position:relative; width:min(980px,75vw); padding:8px; border:1px solid rgba(51,193,216,.4); border-radius:7px; background:#071724; box-shadow:0 18px 60px rgba(0,0,0,.55); } img { width:100%; max-height:82vh; display:block; object-fit:contain; } button { position:absolute; z-index:2; top:12px; right:12px; width:28px; height:28px; border:1px solid rgba(255,255,255,.25); border-radius:4px; color:#fff; background:rgba(2,13,21,.78); cursor:pointer; font-size:20px; line-height:22px; } }
@media (max-width:1100px) { .fs-modal { padding-right:330px; } }
</style>
