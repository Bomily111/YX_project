import { defineStore } from 'pinia'
import { ref } from 'vue'
import { monitoringApi } from '@/services/api/client'

export const useMonitorStore = defineStore('monitor', () => {
  const latestValues = ref<Record<string, number>>({})
  const history = ref<{ time: string; value: number }[]>([])
  const loading = ref(false)

  async function fetchLatest(configIds: string[]) {
    if (!configIds.length) return
    const result = await monitoringApi.latest(configIds)
    for (const [id, data] of Object.entries(result)) {
      latestValues.value[id] = data.value
    }
  }

  async function fetchHistory(configId: string, from?: string, to?: string) {
    loading.value = true
    try {
      history.value = await monitoringApi.readings(configId, from, to)
    } finally {
      loading.value = false
    }
  }

  async function pushReadings(readings: { config_id: string; value: number }[]) {
    return monitoringApi.postReadings(readings)
  }

  return { latestValues, history, loading, fetchLatest, fetchHistory, pushReadings }
})
