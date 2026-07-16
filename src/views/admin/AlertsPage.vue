<template>
  <div class="page">
    <div class="page-header">
      <h1>告警管理</h1>
      <label class="filter"><input type="checkbox" v-model="activeOnly" @change="load" /> 仅活跃</label>
    </div>

    <div v-if="loading">加载中...</div>
    <table v-else-if="list.length" class="data-table">
      <thead>
        <tr>
          <th>级别</th><th>标题</th><th>关联实体</th><th>里程</th><th>创建时间</th><th>状态</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in list" :key="a.id" :class="{ resolved: !a.is_active }">
          <td><span class="level-tag" :class="'lvl-' + a.level">{{ a.level }}</span></td>
          <td>{{ a.title }}</td>
          <td>{{ a.entity_type }} / {{ a.entity_id?.slice(0, 8) }}</td>
          <td>{{ a.dk_number ? 'DK' + (a.dk_number / 1000).toFixed(3).replace('.', '+') : '-' }}</td>
          <td>{{ formatTime(a.created_at) }}</td>
          <td><span :class="a.is_active ? 'status-live' : 'status-done'">{{ a.is_active ? '活跃' : '已解决' }}</span></td>
          <td>
            <button v-if="a.is_active && !a.acknowledged_at" class="btn-sm" @click="ack(a.id)">确认</button>
            <button v-if="a.is_active" class="btn-sm resolve" @click="resolve(a.id)">解决</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">暂无告警</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { alertsApi } from '@/services/api/client'

const list = ref<any[]>([])
const loading = ref(true)
const activeOnly = ref(true)

async function load() {
  loading.value = true
  list.value = await alertsApi.list(activeOnly.value)
  loading.value = false
}

async function ack(id: string) { await alertsApi.acknowledge(id); load() }
async function resolve(id: string) {
  const note = prompt('解决备注（可选）:') || ''
  await alertsApi.resolve(id, note)
  load()
}

function formatTime(t: string) { return new Date(t).toLocaleString('zh-CN') }

onMounted(load)
</script>

<style scoped>
.page { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { margin: 0; font-size: 22px; color: #e0f0ff; }
.filter { font-size: 13px; color: #5a7a9a; display: flex; align-items: center; gap: 6px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { text-align: left; padding: 10px 12px; font-size: 12px; color: #5a7a9a; border-bottom: 1px solid #1a2a44; }
.data-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #0f1a2c; }
tr.resolved td { opacity: 0.5; }
.level-tag { padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
.lvl-critical { background: #3a1010; color: #ff4444; }
.lvl-warn { background: #3a2a0a; color: #ffcc00; }
.lvl-info { background: #0a2a3a; color: #44aaee; }
.status-live { color: #ff8844; font-size: 12px; }
.status-done { color: #5a7a5a; font-size: 12px; }
.btn-sm { padding: 4px 12px; font-size: 11px; border: 1px solid #1a3a5a; border-radius: 3px; background: #0a1a2a; color: #7ab8e0; cursor: pointer; margin-right: 4px; }
.btn-sm:hover { background: #1a3a5a; }
.btn-sm.resolve { border-color: #2a4a1a; color: #88cc88; }
.btn-sm.resolve:hover { background: #1a2a1a; }
.empty { padding: 40px; text-align: center; color: #5a7a9a; }
</style>
