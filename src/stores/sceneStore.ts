import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { scenesApi, type SceneConfig } from '@/services/api/client'

export const useSceneStore = defineStore('scene', () => {
  const scenes = ref<Record<string, SceneConfig>>({})
  const loading = ref(false)

  async function fetchScenes() {
    loading.value = true
    try {
      scenes.value = await scenesApi.all()
    } finally {
      loading.value = false
    }
  }

  function getScene(sceneKey: string): SceneConfig | null {
    return scenes.value[sceneKey] || null
  }

  const sceneList = computed(() => Object.values(scenes.value))

  return { scenes, loading, fetchScenes, getScene, sceneList }
})
