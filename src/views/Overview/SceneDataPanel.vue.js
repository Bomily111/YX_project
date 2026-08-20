import { computed, reactive, ref, watch } from 'vue';
import { setRebarMeshesVisible, loadRebarMeshes, setRebarHighlight, setSecondRebarVisible, setSecondRebarHighlight, loadSecondRebarMeshes, setSteelFrameVisible, setSteelFrameHighlight, loadSteelFrameMeshes, setPipeShedVisible, setPipeShedHighlight, loadPipeShedMeshes, setAnchorVisible, setAnchorHighlight, loadAnchorMeshes, setConduitVisible, setConduitHighlight, loadConduitMeshes, setLockAnchorVisible, setLockAnchorHighlight, loadLockAnchorMeshes } from '@/utils/Common/DrawLine';
import { startWind, changePower, removeFlowLine, getCurrentPower } from '@/utils/Common/WindFieldSimulation';
import { startVectorField, removeVectorField, changeVectorPower } from '@/utils/Common/WindVectorField';
import { startProceduralWind, removeProceduralWind, changeProceduralPower, setProceduralFlow } from '@/utils/Common/TunnelWindSimulation';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import { useSceneStore } from '@/stores/sceneStore';
import { useMonitorStore } from '@/stores/monitorStore';
import { alertsApi } from '@/services/api/client';
const SCENE_DATA = {
    workface: {
        icon: '⬡', name: '隧洞围岩', color: '#00e5ff',
        chartTitle: '近7天进尺(m)', chartLabels: ['04', '05', '06', '07', '08', '09', '10'],
        chartValues: [2.8, 3.1, 2.5, 3.5, 4.0, 3.2, 3.5],
        metrics: [
            { label: '围岩等级', val: 'V', unit: '级', level: 'level-danger' },
            { label: '循环进尺', val: '3.5', unit: 'm' },
            { label: '断面面积', val: '82.3', unit: 'm²' },
            { label: '当前工序', val: '钻孔', unit: '' },
            { label: '在岗人数', val: '12', unit: '人' },
            { label: '今日进尺', val: '3.5', unit: 'm', level: 'level-good' },
        ],
        statusList: [
            { label: '围岩稳定性', val: '中等', pct: 55, level: 'warn' },
            { label: '超前支护', val: '已施做', pct: 90, level: 'good' },
            { label: '地下水', val: '少量渗水', pct: 30, level: 'info' },
            { label: '瓦斯浓度', val: '0.0%', pct: 0, level: 'good' },
        ],
        alerts: [
            { id: 'a1', text: '前方30m疑似富水断裂带，加强超前探孔', level: 'warn' },
        ],
    },
    support: {
        icon: '◈', name: '支护监测', color: '#aa88ff',
        chartTitle: '拱顶沉降趋势(mm)', chartLabels: ['04', '05', '06', '07', '08', '09', '10'],
        chartValues: [8.1, 9.5, 10.2, 11.0, 11.8, 12.1, 12.4],
        metrics: [
            { label: '监测断面', val: '36', unit: '个' },
            { label: '拱顶沉降', val: '12.4', unit: 'mm', level: 'level-warn' },
            { label: '水平收敛', val: '8.2', unit: 'mm' },
            { label: '净空面积', val: '7.6', unit: 'm²' },
            { label: '初支厚度', val: '20', unit: 'cm' },
            { label: '喷锚完成', val: '98', unit: '%', level: 'level-good' },
        ],
        statusList: [
            { label: '结构稳定性', val: '稳定', pct: 85, level: 'good' },
            { label: '沉降速率', val: '0.3mm/d', pct: 35, level: 'info' },
            { label: '锚杆应力', val: '正常', pct: 70, level: 'good' },
            { label: '二衬进度', val: '72%', pct: 72, level: 'good' },
        ],
        alerts: [],
        structureTree: [
            {
                id: 'advance_support',
                label: '超前支护',
                icon: '⊕',
                defaultExpanded: true,
                children: [
                    { id: 'pipe_shed', label: 'ZZ-QJsx-φ76中管棚', icon: '⬡', visible: false },
                ],
            },
            {
                id: 'primary_support',
                label: '初支',
                icon: '◈',
                defaultExpanded: true,
                children: [
                    { id: 'anchor', label: 'ZZ-QJsx-φ25自进式中空注浆锚杆', icon: '⊙', visible: false },
                    { id: 'conduit', label: 'ZZ-QJsx-φ42注浆小导管', icon: '≋', visible: false },
                    { id: 'lock_anchor', label: 'ZZ-QJsx-φ42锁脚锚杆', icon: '⊕', visible: false },
                ],
            },
            {
                id: 'secondary_lining',
                label: '二衬',
                icon: '⬡',
                defaultExpanded: true,
                children: [
                    { id: 'rebar', label: 'Z-PM-洞口钢筋网', icon: '⬡', visible: false },
                    { id: 'lining_rebar', label: 'ZZ-QJsx-二衬钢筋', icon: '⬡', visible: false },
                    { id: 'steel_frame', label: 'ZZ-QJsx-钢架', icon: '⊞', visible: false },
                ],
            },
        ],
    },
    vent: {
        icon: '≋', name: '通风系统', color: '#44ff88',
        chartTitle: '风速变化(m/s)', chartLabels: ['04', '05', '06', '07', '08', '09', '10'],
        chartValues: [2.8, 3.0, 3.2, 2.9, 3.1, 3.4, 3.2],
        metrics: [
            { label: '风速', val: '3.2', unit: 'm/s' },
            { label: '风量', val: '248', unit: 'm³/min' },
            { label: '隧道温度', val: '18.5', unit: '°C' },
            { label: 'CO浓度', val: '15', unit: 'ppm' },
            { label: '粉尘浓度', val: '12', unit: 'mg/m³' },
            { label: '氧气含量', val: '20.9', unit: '%', level: 'level-good' },
        ],
        statusList: [
            { label: '主风机', val: '运行中', pct: 100, level: 'good' },
            { label: '风筒完好率', val: '96%', pct: 96, level: 'good' },
            { label: 'CO浓度', val: '正常', pct: 15, level: 'info' },
            { label: '粉尘指数', val: '正常', pct: 24, level: 'info' },
        ],
        alerts: [],
    },
    dispatch: {
        icon: '◎', name: '调度中心', color: '#ffaa00',
        chartTitle: '今日出渣量(m³)', chartLabels: ['06h', '08h', '10h', '12h', '14h', '16h', '18h'],
        chartValues: [0, 55, 120, 185, 260, 350, 420],
        metrics: [
            { label: '在岗人员', val: '28', unit: '人' },
            { label: '在用设备', val: '6', unit: '台' },
            { label: '今日出渣', val: '420', unit: 'm³', level: 'level-good' },
            { label: '运渣趟次', val: '14', unit: '趟' },
            { label: '完成工序', val: '5', unit: '道' },
            { label: '当班效率', val: '92', unit: '%', level: 'level-good' },
        ],
        statusList: [
            { label: '挖掘机', val: '作业中', pct: 100, level: 'good' },
            { label: '装载机', val: '作业中', pct: 100, level: 'good' },
            { label: '渣车调度', val: '2台在途', pct: 80, level: 'good' },
            { label: '通道畅通', val: '正常', pct: 100, level: 'good' },
        ],
        alerts: [],
    },
};
const W = 260, H = 70;
const props = defineProps();
const emit = defineEmits();
function apiSceneToSceneData(api) {
    return {
        icon: api.icon, name: api.name_cn, color: api.color,
        metrics: (api.metrics || []).map((m) => ({ label: m.label, val: '--', unit: m.unit || '' })),
        statusList: (api.statusList || []).map((s) => ({ label: s.label, val: s.val, pct: s.pct, level: s.level })),
        alerts: [],
    };
}
const sceneStore = useSceneStore();
const monitorStore = useMonitorStore();
const liveAlerts = ref([]);
const liveChartValues = ref([]);
const liveChartLabels = ref([]);
const liveStructureTree = ref([]);
const SCENE_PRIMARY_METRIC = {
    workface: 'daily_advance', support: 'arch_settlement', vent: 'wind_speed', dispatch: 'muck_volume',
};
// 切换场景时拉取实时监测值 + 告警 + 折线图 + 结构树
watch(() => props.sceneKey, async (key) => {
    if (key) {
        monitorStore.fetchSceneLatest(key);
        // 告警
        try {
            const apiAlerts = await alertsApi.list(true, undefined, undefined, key);
            liveAlerts.value = apiAlerts.map((a) => ({
                id: a.id, text: a.title, level: a.level === 'critical' ? 'warn' : (a.level === 'warn' ? 'warn' : 'info'),
            }));
        }
        catch {
            liveAlerts.value = [];
        }
        // 折线图：拉取主指标近 7 天数据
        const metricKey = SCENE_PRIMARY_METRIC[key];
        if (metricKey) {
            try {
                const configRes = await fetch(`/api/monitoring/configs?scene_key=${key}`);
                const configs = await configRes.json();
                const cfg = configs.find((c) => c.metric_key === metricKey);
                if (cfg) {
                    const from = new Date(Date.now() - 7 * 864e5).toISOString();
                    const readRes = await fetch(`/api/monitoring/readings?config_id=${cfg.id}&from=${from}`);
                    const readings = await readRes.json();
                    const daily = new Map();
                    for (const r of readings) {
                        const day = r.time.slice(5, 10);
                        if (!daily.has(day))
                            daily.set(day, []);
                        daily.get(day).push(r.value);
                    }
                    const labels = [], values = [];
                    for (const [day, vals] of [...daily].sort()) {
                        labels.push(day.slice(3));
                        values.push(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10);
                    }
                    liveChartLabels.value = labels;
                    liveChartValues.value = values;
                }
            }
            catch {
                liveChartValues.value = [];
            }
        }
        // 结构树：支护场景加载
        if (key === 'support') {
            try {
                const suppRes = await fetch('/api/support');
                const comps = await suppRes.json();
                const groups = new Map();
                for (const c of comps) {
                    const type = c.component_type;
                    if (!groups.has(type))
                        groups.set(type, []);
                    groups.get(type).push(c);
                }
                const TYPE_GROUPS = {
                    advance_support: { id: 'advance_support', label: '超前支护', icon: '⊕', types: ['pipe_shed'] },
                    primary_support: { id: 'primary_support', label: '初支', icon: '◈', types: ['anchor', 'conduit', 'lock_anchor'] },
                    secondary_lining: { id: 'secondary_lining', label: '二衬', icon: '⬡', types: ['rebar', 'lining_rebar', 'steel_frame'] },
                };
                liveStructureTree.value = Object.values(TYPE_GROUPS).map(g => ({
                    id: g.id, label: g.label, icon: g.icon, defaultExpanded: true,
                    children: g.types.flatMap(t => (groups.get(t) || []).map(c => {
                        componentTypeMap[c.id] = t;
                        return { id: c.id, label: c.material_spec || t, icon: '⬡', visible: c.is_visible };
                    })),
                }));
            }
            catch {
                liveStructureTree.value = [];
            }
        }
    }
}, { immediate: true });
const data = computed(() => {
    if (!props.sceneKey)
        return null;
    const local = SCENE_DATA[props.sceneKey];
    const apiScene = sceneStore.getScene(props.sceneKey);
    if (!apiScene)
        return local;
    const apiPart = apiSceneToSceneData(apiScene);
    if (!local)
        return { chartTitle: '', chartLabels: [], chartValues: [], ...apiPart, alerts: liveAlerts.value };
    const merged = {
        ...local,
        icon: apiPart.icon ?? local.icon,
        name: apiPart.name ?? local.name,
        color: apiPart.color ?? local.color,
        metrics: apiPart.metrics?.length ? apiPart.metrics : local.metrics,
        statusList: apiPart.statusList?.length ? apiPart.statusList : local.statusList,
        alerts: liveAlerts.value.length ? liveAlerts.value : local.alerts,
    };
    // 用 API 实时监测值覆盖硬编码指标值
    const liveVals = monitorStore.latestByMetricKey;
    if (Object.keys(liveVals).length) {
        merged.metrics = merged.metrics.map(m => {
            const sceneMetric = sceneStore.getScene(props.sceneKey)?.metrics?.find(sm => sm.label === m.label);
            const key = sceneMetric?.metric_key;
            if (key && liveVals[key] !== undefined) {
                return { ...m, val: String(liveVals[key]), level: m.level };
            }
            return m;
        });
    }
    // 用 API 折线图数据覆盖硬编码
    if (liveChartValues.value.length) {
        merged.chartValues = liveChartValues.value;
        merged.chartLabels = liveChartLabels.value;
    }
    // 用 API 结构树覆盖硬编码
    if (liveStructureTree.value.length) {
        merged.structureTree = liveStructureTree.value;
    }
    return merged;
});
const sceneIcon = computed(() => data.value?.icon ?? '');
const sceneName = computed(() => data.value?.name ?? '');
const sceneColor = computed(() => data.value?.color ?? '#00e5ff');
const chartTitle = computed(() => data.value?.chartTitle ?? '');
const chartLabels = computed(() => data.value?.chartLabels ?? []);
const metrics = computed(() => data.value?.metrics ?? []);
const statusList = computed(() => data.value?.statusList ?? []);
const alerts = computed(() => data.value?.alerts ?? []);
const structureTree = computed(() => data.value?.structureTree ?? []);
// 结构树展开/折叠状态
const expandedNodes = reactive({});
// 节点可见性（默认从 tree 定义读取）
const nodeVisible = reactive({});
// ── 风场模拟状态 ─────────────────────────────────────────
const windEnabled = ref(false);
const windPower = ref(getCurrentPower() + 1);
const windFlow = ref(false);
const windMode = ref('streamline');
const setWindMode = (mode) => {
    if (mode === windMode.value)
        return;
    windMode.value = mode;
    const viewer = DTScopeEngine.viewer;
    if (!viewer)
        return;
    removeFlowLine(viewer);
    removeVectorField(viewer);
    removeProceduralWind(viewer);
    if (mode === 'streamline') {
        startWind(viewer);
    }
    else if (mode === 'vectorField') {
        startVectorField(viewer);
    }
    else {
        startProceduralWind(viewer);
        setProceduralFlow(windFlow.value);
    }
};
const onWindToggle = (val) => {
    const viewer = DTScopeEngine.viewer;
    if (!viewer)
        return;
    if (val) {
        if (windMode.value === 'vectorField') {
            startVectorField(viewer);
        }
        else if (windMode.value === 'procedural') {
            startProceduralWind(viewer);
            setProceduralFlow(windFlow.value);
        }
        else {
            startWind(viewer);
        }
    }
    else {
        removeFlowLine(viewer);
        removeVectorField(viewer);
        removeProceduralWind(viewer);
    }
};
const onWindFlowToggle = (val) => {
    windFlow.value = val;
    setProceduralFlow(val);
};
const onWindPowerChange = (e) => {
    const val = parseInt(e.target.value);
    windPower.value = val;
    changePower(val - 1);
    changeVectorPower(val - 1);
    changeProceduralPower(val - 1);
};
// 场景切换时清理风场
watch(() => props.sceneKey, (key) => {
    if (key !== 'vent') {
        const viewer = DTScopeEngine.viewer;
        if (viewer) {
            removeFlowLine(viewer);
            removeVectorField(viewer);
            removeProceduralWind(viewer);
        }
        windEnabled.value = false;
        windFlow.value = false;
    }
});
// 场景切换时重置展开状态
watch(() => props.sceneKey, () => {
    for (const key of Object.keys(expandedNodes))
        delete expandedNodes[key];
});
function toggleNodeExpand(nodeId) {
    expandedNodes[nodeId] = !expandedNodes[nodeId];
}
function isNodeExpanded(node) {
    if (expandedNodes[node.id] !== undefined)
        return expandedNodes[node.id];
    return node.defaultExpanded ?? false;
}
// 节点高亮状态
const nodeHighlight = reactive({});
// node UUID → component_type 映射（API 加载时填充）
const componentTypeMap = reactive({});
const COMP_HANDLERS = {
    rebar: { load: loadRebarMeshes, show: setRebarMeshesVisible, highlight: setRebarHighlight },
    lining_rebar: { load: loadSecondRebarMeshes, show: setSecondRebarVisible, highlight: setSecondRebarHighlight },
    steel_frame: { load: loadSteelFrameMeshes, show: setSteelFrameVisible, highlight: setSteelFrameHighlight },
    pipe_shed: { load: loadPipeShedMeshes, show: setPipeShedVisible, highlight: setPipeShedHighlight },
    anchor: { load: loadAnchorMeshes, show: setAnchorVisible, highlight: setAnchorHighlight },
    conduit: { load: loadConduitMeshes, show: setConduitVisible, highlight: setConduitHighlight },
    lock_anchor: { load: loadLockAnchorMeshes, show: setLockAnchorVisible, highlight: setLockAnchorHighlight },
};
function toggleNodeVisible(nodeId) {
    const current = nodeVisible[nodeId] ?? false;
    nodeVisible[nodeId] = !current;
    const type = componentTypeMap[nodeId] || nodeId; // fallback to nodeId for hardcoded IDs
    const h = COMP_HANDLERS[type];
    if (!h)
        return;
    if (!current) {
        h.load();
        h.show(true);
        if (nodeHighlight[nodeId])
            h.highlight(true);
    }
    else {
        h.show(false);
        nodeHighlight[nodeId] = false;
        h.highlight(false);
    }
}
function toggleNodeHighlight(nodeId) {
    nodeHighlight[nodeId] = !nodeHighlight[nodeId];
    const type = componentTypeMap[nodeId] || nodeId;
    COMP_HANDLERS[type]?.highlight(nodeHighlight[nodeId]);
}
// SVG 折线坐标
const linePoints = computed(() => {
    const vals = data.value?.chartValues ?? [];
    if (!vals.length)
        return '';
    const max = Math.max(...vals) || 1;
    const min = Math.min(...vals);
    const range = max - min || 1;
    const padY = 6;
    return vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * W;
        const y = H - padY - ((v - min) / range) * (H - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
});
// SVG 面积路径
const areaPath = computed(() => {
    const vals = data.value?.chartValues ?? [];
    if (!vals.length)
        return '';
    const max = Math.max(...vals) || 1;
    const min = Math.min(...vals);
    const range = max - min || 1;
    const padY = 6;
    const pts = vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * W;
        const y = H - padY - ((v - min) / range) * (H - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M0,${H} L${pts.join(' L')} L${W},${H} Z`;
});
function statusBarColor(level) {
    switch (level) {
        case 'warn': return '#ffcc00';
        case 'danger': return '#ff4444';
        case 'info': return '#00aaff';
        default: return '#44ff88';
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['sdp-m-val']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-m-val']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-m-val']} */ ;
/** @type {__VLS_StyleScopedClasses['st-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['st-label']} */ ;
/** @type {__VLS_StyleScopedClasses['on']} */ ;
/** @type {__VLS_StyleScopedClasses['warn']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['open']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-text']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-model-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['layer-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['sdp-workface-actions']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "panel-slide-left",
}));
const __VLS_2 = __VLS_1({
    name: "panel-slide-left",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.show) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scene-data-panel" },
        ...{ style: ({ '--sc': __VLS_ctx.sceneColor }) },
    });
    /** @type {__VLS_StyleScopedClasses['scene-data-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-header" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sdp-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-icon']} */ ;
    (__VLS_ctx.sceneIcon);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-title-group" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-title-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-title" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-title']} */ ;
    (__VLS_ctx.sceneName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sdp-live-dot" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-live-dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-metrics" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-metrics']} */ ;
    for (const [m] of __VLS_vFor((__VLS_ctx.metrics))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (m.label),
            ...{ class: "sdp-metric-item" },
            ...{ class: (m.level) },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-metric-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-m-val" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-m-val']} */ ;
        (m.val);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sdp-m-unit" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-m-unit']} */ ;
        (m.unit);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-m-label" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-m-label']} */ ;
        (m.label);
        // @ts-ignore
        [show, sceneColor, sceneIcon, sceneName, metrics,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-chart-section" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-chart-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-chart-title" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-chart-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sdp-chart-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-chart-icon']} */ ;
    (__VLS_ctx.chartTitle);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-mini-chart" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-mini-chart']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: (`0 0 ${__VLS_ctx.W} ${__VLS_ctx.H}`),
        preserveAspectRatio: "none",
    });
    for (const [i] of __VLS_vFor((4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.line)({
            key: (i),
            y1: (__VLS_ctx.H / 4 * i),
            y2: (__VLS_ctx.H / 4 * i),
            x1: "0",
            x2: (__VLS_ctx.W),
            stroke: "rgba(0,180,255,0.08)",
            'stroke-width': "1",
        });
        // @ts-ignore
        [chartTitle, W, W, H, H, H,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: (__VLS_ctx.areaPath),
        fill: (`url(#grad_${__VLS_ctx.sceneKey})`),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.polyline)({
        points: (__VLS_ctx.linePoints),
        fill: "none",
        stroke: (__VLS_ctx.sceneColor),
        'stroke-width': "2",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.defs, __VLS_intrinsics.defs)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.linearGradient, __VLS_intrinsics.linearGradient)({
        id: (`grad_${__VLS_ctx.sceneKey}`),
        x1: "0",
        y1: "0",
        x2: "0",
        y2: "1",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
        offset: "0%",
        'stop-color': (__VLS_ctx.sceneColor),
        'stop-opacity': "0.35",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.stop)({
        offset: "100%",
        'stop-color': (__VLS_ctx.sceneColor),
        'stop-opacity': "0.02",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-chart-labels" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-chart-labels']} */ ;
    for (const [l] of __VLS_vFor((__VLS_ctx.chartLabels))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (l),
            ...{ class: "sdp-chl" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-chl']} */ ;
        (l);
        // @ts-ignore
        [sceneColor, sceneColor, sceneColor, areaPath, sceneKey, sceneKey, linePoints, chartLabels,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-status-list" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-status-list']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sdp-list-title" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-list-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sdp-chart-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['sdp-chart-icon']} */ ;
    for (const [s] of __VLS_vFor((__VLS_ctx.statusList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (s.label),
            ...{ class: "sdp-status-row" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-status-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sdp-status-key" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-status-key']} */ ;
        (s.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-status-bar-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-status-bar-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-status-bar" },
            ...{ style: ({ width: s.pct + '%', background: __VLS_ctx.statusBarColor(s.level) }) },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-status-bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sdp-status-val" },
            ...{ class: (s.level) },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-status-val']} */ ;
        (s.val);
        // @ts-ignore
        [statusList, statusBarColor,];
    }
    if (props.sceneKey === 'vent') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-wind-sim" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-wind-sim']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-list-title" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-list-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sdp-chart-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-chart-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wind-toggle-row" },
        });
        /** @type {__VLS_StyleScopedClasses['wind-toggle-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wind-toggle-label" },
        });
        /** @type {__VLS_StyleScopedClasses['wind-toggle-label']} */ ;
        let __VLS_6;
        /** @ts-ignore @type {typeof __VLS_components.elSwitch | typeof __VLS_components.ElSwitch} */
        elSwitch;
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
            ...{ 'onChange': {} },
            modelValue: (__VLS_ctx.windEnabled),
            activeColor: "#1b91ff",
            inactiveColor: "#406a9b",
            size: "small",
        }));
        const __VLS_8 = __VLS_7({
            ...{ 'onChange': {} },
            modelValue: (__VLS_ctx.windEnabled),
            activeColor: "#1b91ff",
            inactiveColor: "#406a9b",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        let __VLS_11;
        const __VLS_12 = ({ change: {} },
            { onChange: (__VLS_ctx.onWindToggle) });
        var __VLS_9;
        var __VLS_10;
        if (__VLS_ctx.windEnabled) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "wind-mode-row" },
            });
            /** @type {__VLS_StyleScopedClasses['wind-mode-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "wind-mode-label" },
            });
            /** @type {__VLS_StyleScopedClasses['wind-mode-label']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "wind-mode-tabs" },
            });
            /** @type {__VLS_StyleScopedClasses['wind-mode-tabs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(props.sceneKey === 'vent'))
                            return;
                        if (!(__VLS_ctx.windEnabled))
                            return;
                        __VLS_ctx.setWindMode('streamline');
                        // @ts-ignore
                        [windEnabled, windEnabled, onWindToggle, setWindMode,];
                    } },
                ...{ class: ({ active: __VLS_ctx.windMode === 'streamline' }) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(props.sceneKey === 'vent'))
                            return;
                        if (!(__VLS_ctx.windEnabled))
                            return;
                        __VLS_ctx.setWindMode('vectorField');
                        // @ts-ignore
                        [setWindMode, windMode,];
                    } },
                ...{ class: ({ active: __VLS_ctx.windMode === 'vectorField' }) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(props.sceneKey === 'vent'))
                            return;
                        if (!(__VLS_ctx.windEnabled))
                            return;
                        __VLS_ctx.setWindMode('procedural');
                        // @ts-ignore
                        [setWindMode, windMode,];
                    } },
                ...{ class: ({ active: __VLS_ctx.windMode === 'procedural' }) },
            });
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            if (__VLS_ctx.windMode === 'procedural') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "wind-mode-row" },
                });
                /** @type {__VLS_StyleScopedClasses['wind-mode-row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "wind-mode-label" },
                });
                /** @type {__VLS_StyleScopedClasses['wind-mode-label']} */ ;
                let __VLS_13;
                /** @ts-ignore @type {typeof __VLS_components.elSwitch | typeof __VLS_components.ElSwitch} */
                elSwitch;
                // @ts-ignore
                const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
                    ...{ 'onChange': {} },
                    modelValue: (__VLS_ctx.windFlow),
                    activeColor: "#1b91ff",
                    inactiveColor: "#406a9b",
                    size: "small",
                }));
                const __VLS_15 = __VLS_14({
                    ...{ 'onChange': {} },
                    modelValue: (__VLS_ctx.windFlow),
                    activeColor: "#1b91ff",
                    inactiveColor: "#406a9b",
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_14));
                let __VLS_18;
                const __VLS_19 = ({ change: {} },
                    { onChange: (__VLS_ctx.onWindFlowToggle) });
                var __VLS_16;
                var __VLS_17;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "wind-power-row" },
            });
            /** @type {__VLS_StyleScopedClasses['wind-power-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onInput: (__VLS_ctx.onWindPowerChange) },
                type: "range",
                ...{ class: "wind-power-slider" },
                value: (__VLS_ctx.windPower),
                min: (1),
                max: (12),
                step: (1),
                ...{ style: ({ background: `linear-gradient(to right, #059cfa 0%, #059cfa ${(__VLS_ctx.windPower - 1) / 11 * 100}%, rgba(0,50,100,0.3) ${(__VLS_ctx.windPower - 1) / 11 * 100}%, rgba(0,50,100,0.3) 100%)` }) },
            });
            /** @type {__VLS_StyleScopedClasses['wind-power-slider']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "wind-power-val" },
            });
            /** @type {__VLS_StyleScopedClasses['wind-power-val']} */ ;
            (__VLS_ctx.windPower);
        }
    }
    if (__VLS_ctx.structureTree.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-structure-tree" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-structure-tree']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-list-title" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-list-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sdp-chart-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-chart-icon']} */ ;
        for (const [node] of __VLS_vFor((__VLS_ctx.structureTree))) {
            (node.id);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "st-group" },
            });
            /** @type {__VLS_StyleScopedClasses['st-group']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(__VLS_ctx.structureTree.length))
                            return;
                        __VLS_ctx.toggleNodeExpand(node.id);
                        // @ts-ignore
                        [windMode, windMode, windFlow, onWindFlowToggle, onWindPowerChange, windPower, windPower, windPower, windPower, structureTree, structureTree, toggleNodeExpand,];
                    } },
                ...{ class: "st-parent" },
            });
            /** @type {__VLS_StyleScopedClasses['st-parent']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "st-arrow" },
                ...{ class: ({ open: __VLS_ctx.isNodeExpanded(node) }) },
            });
            /** @type {__VLS_StyleScopedClasses['st-arrow']} */ ;
            /** @type {__VLS_StyleScopedClasses['open']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "st-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['st-icon']} */ ;
            (node.icon);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "st-label" },
            });
            /** @type {__VLS_StyleScopedClasses['st-label']} */ ;
            (node.label);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "st-children" },
            });
            __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.isNodeExpanded(node)) }, null, null);
            /** @type {__VLS_StyleScopedClasses['st-children']} */ ;
            for (const [child] of __VLS_vFor((node.children))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.show))
                                return;
                            if (!(__VLS_ctx.structureTree.length))
                                return;
                            __VLS_ctx.toggleNodeVisible(child.id);
                            // @ts-ignore
                            [isNodeExpanded, isNodeExpanded, toggleNodeVisible,];
                        } },
                    key: (child.id),
                    ...{ class: "st-leaf" },
                });
                /** @type {__VLS_StyleScopedClasses['st-leaf']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "st-check" },
                    ...{ class: ({ on: __VLS_ctx.nodeVisible[child.id] ?? child.visible }) },
                });
                /** @type {__VLS_StyleScopedClasses['st-check']} */ ;
                /** @type {__VLS_StyleScopedClasses['on']} */ ;
                ((__VLS_ctx.nodeVisible[child.id] ?? child.visible) ? '✓' : '');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "st-icon" },
                });
                /** @type {__VLS_StyleScopedClasses['st-icon']} */ ;
                (child.icon);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "st-label" },
                });
                /** @type {__VLS_StyleScopedClasses['st-label']} */ ;
                (child.label);
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.show))
                                return;
                            if (!(__VLS_ctx.structureTree.length))
                                return;
                            __VLS_ctx.toggleNodeHighlight(child.id);
                            // @ts-ignore
                            [nodeVisible, nodeVisible, toggleNodeHighlight,];
                        } },
                    ...{ class: "st-hl" },
                    ...{ class: ({ on: __VLS_ctx.nodeHighlight[child.id] }) },
                });
                /** @type {__VLS_StyleScopedClasses['st-hl']} */ ;
                /** @type {__VLS_StyleScopedClasses['on']} */ ;
                // @ts-ignore
                [nodeHighlight,];
            }
            if (!node.children?.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "st-empty" },
                });
                /** @type {__VLS_StyleScopedClasses['st-empty']} */ ;
            }
            // @ts-ignore
            [];
        }
    }
    if (__VLS_ctx.alerts.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-alerts" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-alerts']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sdp-alert-title" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-alert-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sdp-alert-dot" },
        });
        /** @type {__VLS_StyleScopedClasses['sdp-alert-dot']} */ ;
        for (const [a] of __VLS_vFor((__VLS_ctx.alerts))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (a.id),
                ...{ class: "sdp-alert-item" },
                ...{ class: (a.level) },
            });
            /** @type {__VLS_StyleScopedClasses['sdp-alert-item']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sdp-alert-lv" },
            });
            /** @type {__VLS_StyleScopedClasses['sdp-alert-lv']} */ ;
            (a.level === 'warn' ? '⚠' : '●');
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sdp-alert-text" },
            });
            /** @type {__VLS_StyleScopedClasses['sdp-alert-text']} */ ;
            (a.text);
            // @ts-ignore
            [alerts, alerts,];
        }
    }
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
