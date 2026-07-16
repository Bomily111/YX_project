<template>
  <div class="page">
    <div class="page-header"><h1>地质模型配置</h1></div>

    <div v-if="loading">加载中...</div>
    <div v-else-if="!models.length" class="empty">暂无模型数据，请先运行 db:migrate</div>

    <div v-for="m in models" :key="m.id" class="model-card" :class="{ inactive: !m.is_active }">
      <div class="card-header">
        <h3>{{ m.name }}</h3>
        <div class="badges">
          <span class="badge type">{{ m.model_type_code }}</span>
          <span class="badge" :class="m.is_active ? 'on' : 'off'">{{ m.is_active ? '启用' : '停用' }}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="info-grid">
          <div class="info-item"><span class="label">里程范围</span><span>DK{{ fmt(m.start_dk) }} ~ DK{{ fmt(m.end_dk) }}</span></div>
          <div class="info-item"><span class="label">数据类型</span><span>{{ m.data_type }}</span></div>
          <div class="info-item"><span class="label">渲染方式</span><span>{{ m.render_method }}</span></div>
          <div class="info-item"><span class="label">锚点</span><span>{{ m.anchor_lon?.toFixed(6) }}, {{ m.anchor_lat?.toFixed(6) }}, {{ m.anchor_height?.toFixed(1) }}</span></div>
          <div v-if="m.volume_url" class="info-item"><span class="label">体数据</span><span>{{ m.volume_url }}</span></div>
          <div v-if="m.glb_urls?.length" class="info-item"><span class="label">GLB 模型</span><span>{{ m.glb_urls.length }} 个</span></div>
        </div>
        <div v-if="m.glb_urls?.length" class="glb-list">
          <div v-for="(g, i) in m.glb_urls" :key="i" class="glb-item">{{ g.url }} <span class="muted">mileage={{ g.mileage }}</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useModelStore } from '@/stores/modelStore'
import { useTunnelStore } from '@/stores/tunnelStore'

const models = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  const tunnelStore = useTunnelStore()
  if (!tunnelStore.currentTunnelId) await tunnelStore.fetchTunnels()
  const modelStore = useModelStore()
  await modelStore.fetchModels(tunnelStore.currentTunnelId!)
  models.value = modelStore.models
  loading.value = false
})

function fmt(dk: number) { return (dk / 1000).toFixed(3).replace('.', '+') }
</script>

<style scoped>
.page { max-width: 1200px; }
.page-header { margin-bottom: 20px; }
.page-header h1 { margin: 0; font-size: 22px; color: #e0f0ff; }
.model-card { background: #101828; border: 1px solid #1a2a44; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; }
.model-card.inactive { opacity: 0.5; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-header h3 { margin: 0; font-size: 16px; color: #c0e0ff; }
.badges { display: flex; gap: 8px; }
.badge { padding: 3px 10px; border-radius: 3px; font-size: 11px; }
.badge.type { background: #0a2a3a; color: #44bbee; }
.badge.on { background: #0a2a1a; color: #44ff88; }
.badge.off { background: #2a1a0a; color: #ff8844; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.info-item { font-size: 13px; display: flex; gap: 8px; }
.info-item .label { color: #5a7a9a; min-width: 70px; }
.glb-list { margin-top: 8px; }
.glb-item { padding: 4px 12px; font-size: 12px; color: #6a9aaa; background: #0a1220; border-radius: 3px; margin-bottom: 2px; }
.muted { color: #3a5a6a; }
.empty { padding: 40px; text-align: center; color: #5a7a9a; }
</style>
