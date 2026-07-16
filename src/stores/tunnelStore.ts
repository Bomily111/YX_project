import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { tunnelsApi, type TunnelSummary, type WorksiteSummary } from '@/services/api/client'

export const useTunnelStore = defineStore('tunnel', () => {
  const tunnels = ref<TunnelSummary[]>([])
  const currentTunnelId = ref<string | null>(null)
  const worksites = ref<WorksiteSummary[]>([])
  const loading = ref(false)

  const currentTunnel = computed(() => tunnels.value.find((t) => t.id === currentTunnelId.value))

  const currentWorksite = computed(() => {
    if (!worksites.value.length) return null
    return worksites.value.find((w) => w.status === 'active') || worksites.value[0]
  })

  async function fetchTunnels() {
    loading.value = true
    try {
      tunnels.value = await tunnelsApi.list()
      if (!currentTunnelId.value && tunnels.value.length) {
        currentTunnelId.value = tunnels.value[0].id
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchWorksites(tunnelId?: string) {
    const id = tunnelId || currentTunnelId.value
    if (!id) return
    worksites.value = await tunnelsApi.worksites(id)
  }

  function selectTunnel(id: string) {
    currentTunnelId.value = id
    worksites.value = []
  }

  return {
    tunnels, currentTunnelId, currentTunnel, worksites, currentWorksite, loading,
    fetchTunnels, fetchWorksites, selectTunnel,
  }
})
