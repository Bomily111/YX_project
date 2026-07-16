import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tunnelsApi, type ModelInstance } from '@/services/api/client'

export const useModelStore = defineStore('model', () => {
  const models = ref<ModelInstance[]>([])
  const loading = ref(false)

  async function fetchModels(tunnelId: string, nearDk?: number) {
    loading.value = true
    try {
      models.value = await tunnelsApi.models(tunnelId, nearDk)
    } finally {
      loading.value = false
    }
  }

  async function fetchModelsByType(tunnelId: string, modelKey: string) {
    return tunnelsApi.modelsByType(tunnelId, modelKey)
  }

  /** 获取某个模型类型的实例列表（从本地缓存） */
  function getModelsByType(modelTypeCode: string): ModelInstance[] {
    return models.value.filter((m) => m.model_type_code === modelTypeCode)
  }

  /** 查找某个里程附近的模型实例 */
  function findNearDk(dk: number, margin: number = 50): ModelInstance[] {
    return models.value.filter(
      (m) => m.start_dk - margin <= dk && m.end_dk + margin >= dk
    )
  }

  return { models, loading, fetchModels, fetchModelsByType, getModelsByType, findNearDk }
})
