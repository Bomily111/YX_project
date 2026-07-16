<template>
  <div class="page">
    <div class="page-header">
      <h1>工点管理</h1>
      <button class="btn-primary" @click="showForm = !showForm">{{ showForm ? '取消' : '+ 新增工点' }}</button>
    </div>

    <div v-if="showForm" class="form-card">
      <div class="form-row">
        <label>名称 <input v-model="form.name" /></label>
        <label>编号 <input v-model="form.code" /></label>
        <label>里程 DK <input v-model.number="form.dk_number" type="number" step="0.001" /></label>
      </div>
      <div class="form-row">
        <label>经度 <input v-model.number="form.lon" type="number" step="0.000001" /></label>
        <label>纬度 <input v-model.number="form.lat" type="number" step="0.000001" /></label>
        <label>高程 <input v-model.number="form.height" type="number" step="0.1" /></label>
      </div>
      <div class="form-row">
        <label>围岩等级
          <select v-model="form.rock_classification">
            <option v-for="r in ['I','II','III','IV','V','VI']" :key="r" :value="r">{{ r }}级</option>
          </select>
        </label>
        <label>开挖工法
          <select v-model="form.excavation_method">
            <option value="drill_blast">钻爆法</option>
            <option value="bench_method">台阶法</option>
            <option value="full_face">全断面法</option>
          </select>
        </label>
        <label>风险等级
          <select v-model="form.risk_level">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">极高</option>
          </select>
        </label>
      </div>
      <button class="btn-primary" @click="createWorksite" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
    </div>

    <table v-if="list.length" class="data-table">
      <thead>
        <tr>
          <th>名称</th><th>编号</th><th>里程</th><th>围岩</th><th>工法</th><th>风险</th><th>状态</th><th>当前工序</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="w in list" :key="w.id">
          <td>{{ w.name }}</td>
          <td>{{ w.code }}</td>
          <td>DK{{ formatDk(w.dk_number) }}</td>
          <td><span class="tag" :class="'rock-' + w.rock_classification">{{ w.rock_classification }}级</span></td>
          <td>{{ w.excavation_method }}</td>
          <td><span class="tag" :class="w.risk_level === 'high' || w.risk_level === 'critical' ? 'risk-high' : 'risk-ok'">{{ w.risk_level }}</span></td>
          <td><span class="tag" :class="w.status === 'active' ? 'status-on' : 'status-off'">{{ w.status === 'active' ? '施工中' : '停工' }}</span></td>
          <td>{{ w.current_procedure || '-' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">暂无工点数据</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { tunnelsApi } from '@/services/api/client'
import { useTunnelStore } from '@/stores/tunnelStore'

const list = ref<any[]>([])
const showForm = ref(false)
const saving = ref(false)
const form = reactive({ name: '', code: '', dk_number: 279200, lon: 94.905619, lat: 29.533374, height: 2945.5, rock_classification: 'IV', excavation_method: 'drill_blast', risk_level: 'medium' })

async function load() {
  const tunnelStore = useTunnelStore()
  if (!tunnelStore.currentTunnelId) await tunnelStore.fetchTunnels()
  if (tunnelStore.currentTunnelId) {
    list.value = await tunnelsApi.worksites(tunnelStore.currentTunnelId)
  }
}

async function createWorksite() {
  saving.value = true
  const tunnelStore = useTunnelStore()
  // 简化：直接用 fetch POST
  await fetch('/api/tunnels/' + tunnelStore.currentTunnelId + '/worksites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: form.name, code: form.code, dk_number: form.dk_number,
      lon: form.lon, lat: form.lat, height: form.height,
      rock_classification: form.rock_classification,
      excavation_method: form.excavation_method, risk_level: form.risk_level,
    }),
  })
  showForm.value = false
  saving.value = false
  load()
}

function formatDk(dk: number) { return (dk / 1000).toFixed(3).replace('.', '+') }

onMounted(load)
</script>

<style scoped>
.page { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { margin: 0; font-size: 22px; color: #e0f0ff; }
.btn-primary { padding: 8px 20px; background: #0060b0; color: #e0f0ff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn-primary:hover { background: #0080d0; }
.form-card { background: #101828; border: 1px solid #1a2a44; border-radius: 8px; padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; gap: 16px; }
.form-row label { flex: 1; font-size: 12px; color: #7a9aba; }
.form-row input, .form-row select { width: 100%; margin-top: 4px; padding: 8px 12px; background: #0a0f1a; border: 1px solid #1a2a44; color: #c8d8f0; border-radius: 4px; font-size: 13px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { text-align: left; padding: 10px 12px; font-size: 12px; color: #5a7a9a; border-bottom: 1px solid #1a2a44; }
.data-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #0f1a2c; }
.tag { padding: 2px 8px; border-radius: 3px; font-size: 11px; }
.rock-IV { background: #1a3a1a; color: #88cc88; }
.rock-V { background: #3a2a0a; color: #ffcc44; }
.risk-high { background: #3a1010; color: #ff5555; }
.risk-ok { background: #1a2a1a; color: #88cc88; }
.status-on { background: #0a2a2a; color: #44ff88; }
.status-off { background: #1a1a1a; color: #666; }
.empty { padding: 40px; text-align: center; color: #5a7a9a; font-size: 14px; }
</style>
