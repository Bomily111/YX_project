import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tunnelsApi } from '@/services/api/client';
export const useModelStore = defineStore('model', () => {
    const models = ref([]);
    const loading = ref(false);
    async function fetchModels(tunnelId, nearDk) {
        loading.value = true;
        try {
            models.value = await tunnelsApi.models(tunnelId, nearDk);
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchModelsByType(tunnelId, modelKey) {
        return tunnelsApi.modelsByType(tunnelId, modelKey);
    }
    /** 获取某个模型类型的实例列表（从本地缓存） */
    function getModelsByType(modelTypeCode) {
        return models.value.filter((m) => m.model_type_code === modelTypeCode);
    }
    /** 查找某个里程附近的模型实例 */
    function findNearDk(dk, margin = 50) {
        return models.value.filter((m) => m.start_dk - margin <= dk && m.end_dk + margin >= dk);
    }
    return { models, loading, fetchModels, fetchModelsByType, getModelsByType, findNearDk };
});
