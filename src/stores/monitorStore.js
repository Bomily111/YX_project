import { defineStore } from 'pinia';
import { ref } from 'vue';
import { monitoringApi } from '@/services/api/client';
export const useMonitorStore = defineStore('monitor', () => {
    const latestValues = ref({});
    const latestByMetricKey = ref({});
    const sceneConfigs = ref([]);
    const history = ref([]);
    const loading = ref(false);
    async function fetchConfigs(sceneKey) {
        const params = new URLSearchParams();
        if (sceneKey)
            params.set('scene_key', sceneKey);
        const res = await fetch(`/api/monitoring/configs?${params}`);
        sceneConfigs.value = await res.json();
    }
    async function fetchLatest(configIds) {
        if (!configIds.length)
            return;
        const result = await monitoringApi.latest(configIds);
        for (const [id, data] of Object.entries(result)) {
            latestValues.value[id] = data.value;
        }
    }
    /** 拉取某场景下所有指标的最新读数，按 metric_key 索引 */
    async function fetchSceneLatest(sceneKey) {
        await fetchConfigs(sceneKey);
        const ids = sceneConfigs.value.map(c => c.id);
        if (!ids.length)
            return;
        const result = await monitoringApi.latest(ids);
        latestByMetricKey.value = {};
        for (const cfg of sceneConfigs.value) {
            const data = result[cfg.id];
            if (data)
                latestByMetricKey.value[cfg.metric_key] = Math.round(data.value * 10) / 10;
        }
    }
    /** 拉取底部栏关键指标（今日进尺、出渣量、在岗人数） */
    async function fetchOverviewMetrics() {
        const keys = ['daily_advance', 'muck_volume', 'personnel_count'];
        await fetchConfigs();
        const ids = sceneConfigs.value.filter(c => keys.includes(c.metric_key)).map(c => c.id);
        if (!ids.length)
            return;
        const result = await monitoringApi.latest(ids);
        latestByMetricKey.value = {};
        for (const cfg of sceneConfigs.value) {
            const data = result[cfg.id];
            if (data)
                latestByMetricKey.value[cfg.metric_key] = Math.round(data.value * 10) / 10;
        }
    }
    async function fetchHistory(configId, from, to) {
        loading.value = true;
        try {
            history.value = await monitoringApi.readings(configId, from, to);
        }
        finally {
            loading.value = false;
        }
    }
    async function pushReadings(readings) {
        return monitoringApi.postReadings(readings);
    }
    return { latestValues, latestByMetricKey, sceneConfigs, history, loading, fetchConfigs, fetchLatest, fetchSceneLatest, fetchOverviewMetrics, fetchHistory, pushReadings };
});
