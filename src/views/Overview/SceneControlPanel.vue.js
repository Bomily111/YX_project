import { computed, onMounted, reactive, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
const SCENE_CFG = {
    workface: {
        color: '#00e5ff', name: '超报处理',
        actions: [],
        actionGroups: [
            {
                title: '超前预报',
                actions: [
                    { key: 'face_sketch', label: '掌子面素描', icon: '⬡', type: 'primary' },
                    { key: 'gpr', label: '地质雷达', icon: '≋', type: 'primary' },
                    { key: 'horiz_drill', label: '超前水平钻', icon: '⊕', type: 'secondary' },
                    { key: 'deep_hole', label: '加深炮孔', icon: '⦿', type: 'secondary' },
                    { key: 'tsp', label: 'TSP反演', icon: '▦', type: 'secondary' },
                    { key: 'tem', label: '瞬变电磁', icon: '⚡', type: 'secondary' },
                ],
            },
            {
                title: '不良地质',
                actions: [
                    { key: 'weak_rock', label: '软弱围岩', icon: '◈', type: 'secondary' },
                    { key: 'high_stress', label: '高地应力', icon: '♨', type: 'secondary' },
                    { key: 'water_zone', label: '富水带', icon: '💧', type: 'secondary' },
                    { key: 'fracture_zone', label: '破碎带', icon: '▓', type: 'secondary' },
                ],
            },
        ],
        params: [
            { key: 'video', label: '实时视频', type: 'toggle' },
            { key: 'alarm', label: '地质预警', type: 'toggle' },
            { key: 'advance', label: '预报范围', type: 'slider', min: 10, max: 60, step: 5, unit: 'm' },
        ],
        entityListTitle: '',
        entityList: [],
        logs: [
            { id: 'l1', time: '15:32', msg: '围岩评级更新：V级', type: 'warn' },
            { id: 'l2', time: '14:45', msg: '超前水平钻完成，取芯2.5m', type: 'info' },
            { id: 'l3', time: '13:20', msg: '掌子面素描已上传', type: 'ok' },
            { id: 'l4', time: '11:00', msg: '当班交接，现场正常', type: 'ok' },
        ],
    },
    support: {
        color: '#aa88ff', name: '支护监测',
        actions: [
            { key: 'experiment', label: '钢架试验', icon: '⛏', type: 'primary' },
            { key: 'monitor', label: '属性面板', icon: '◈', type: 'primary' },
            { key: 'anchor', label: '锚杆状态', icon: '⊙', type: 'primary' },
            { key: 'shotcrete', label: '喷混记录', icon: '≋', type: 'secondary' },
            { key: 'lining', label: '二衬进度', icon: '⬡', type: 'secondary' },
            { key: 'threshold', label: '报警阈值', icon: '⚠', type: 'secondary' },
            { key: 'report', label: '监测报告', icon: '≡', type: 'secondary' },
        ],
        params: [
            { key: 'auto', label: '自动监测', type: 'toggle' },
            { key: 'alarm', label: '超限告警', type: 'toggle' },
            { key: 'interval', label: '监测间隔', type: 'slider', min: 1, max: 24, step: 1, unit: 'h' },
        ],
        entityListTitle: '',
        entityList: [],
        logs: [
            { id: 'l1', time: '16:00', msg: '拱顶沉降本日累计2.3mm，趋于稳定', type: 'info' },
            { id: 'l2', time: '12:00', msg: '二衬浇筑DK289+200~+180段完成', type: 'ok' },
            { id: 'l3', time: '08:00', msg: '监测自动上报，各点正常', type: 'ok' },
        ],
    },
    vent: {
        color: '#44ff88', name: '通风系统',
        actions: [
            { key: 'fan1', label: '主风机 1#', icon: '≋', type: 'primary' },
            { key: 'fan2', label: '主风机 2#', icon: '≋', type: 'secondary' },
            { key: 'boost', label: '加强通风', icon: '⊕', type: 'primary' },
            { key: 'gas', label: '气体检测', icon: '◎', type: 'secondary' },
            { key: 'duct', label: '风筒检查', icon: '≈', type: 'secondary' },
            { key: 'report', label: '通风报告', icon: '≡', type: 'secondary' },
        ],
        params: [
            { key: 'fan1', label: '风机 1#', type: 'toggle' },
            { key: 'fan2', label: '风机 2#', type: 'toggle' },
            { key: 'speed', label: '目标风速', type: 'slider', min: 1, max: 8, step: 0.5, unit: 'm/s' },
        ],
        entityListTitle: '',
        entityList: [],
        logs: [
            { id: 'l1', time: '15:45', msg: '风机运行正常，风速3.2m/s', type: 'ok' },
            { id: 'l2', time: '14:00', msg: '爆破后加强通风30分钟', type: 'info' },
            { id: 'l3', time: '08:00', msg: '交班检查，通风设备状态良好', type: 'ok' },
        ],
    },
    dispatch: {
        color: '#ffaa00', name: '调度中心',
        actions: [
            { key: 'assign', label: '任务派发', icon: '◎', type: 'primary' },
            { key: 'track', label: '人员追踪', icon: '⊙', type: 'primary' },
            { key: 'gantt', label: '工序甘特', icon: '▦', type: 'secondary' },
            { key: 'equip', label: '设备调度', icon: '⊞', type: 'secondary' },
            { key: 'emerg', label: '应急预案', icon: '⚠', type: 'danger' },
            { key: 'report', label: '调度日志', icon: '≡', type: 'secondary' },
        ],
        params: [
            { key: 'realtime', label: '实时追踪', type: 'toggle' },
            { key: 'notify', label: '任务推送', type: 'toggle' },
        ],
        entityListTitle: '在岗人员 & 设备',
        entityList: [
            { id: 'e1', icon: '👷', name: '张工班长', sub: '掌子面 · 凿岩', status: '作业中', statusCls: 'ok' },
            { id: 'e2', icon: '👷', name: '李师傅', sub: '掌子面 · 支护', status: '作业中', statusCls: 'ok' },
            { id: 'e3', icon: '🚧', name: '挖掘机 01', sub: '掌子面开挖', status: '运行', statusCls: 'ok' },
            { id: 'e4', icon: '🚛', name: '渣车 01', sub: 'DK289→出口', status: '运输中', statusCls: 'moving' },
            { id: 'e5', icon: '🚛', name: '渣车 02', sub: '出口→DK289', status: '返回中', statusCls: 'moving' },
            { id: 'e6', icon: '👷', name: '王技术员', sub: '监测点巡检', status: '巡检中', statusCls: 'info' },
        ],
        logs: [
            { id: 'l1', time: '16:10', msg: '渣车01完成第14趟运输', type: 'ok' },
            { id: 'l2', time: '15:30', msg: '今日出渣量已达420m³', type: 'ok' },
            { id: 'l3', time: '14:30', msg: '爆破完成，人员已恢复进场', type: 'info' },
            { id: 'l4', time: '08:00', msg: '当班开始，28名人员在岗', type: 'ok' },
        ],
    },
};
const props = defineProps();
const emit = defineEmits();
const cfg = computed(() => (props.sceneKey ? SCENE_CFG[props.sceneKey] : null));
const sceneColor = computed(() => cfg.value?.color ?? '#00e5ff');
const sceneName = computed(() => cfg.value?.name ?? '');
const actions = computed(() => cfg.value?.actions ?? []);
const params = computed(() => cfg.value?.params ?? []);
const entityListTitle = computed(() => cfg.value?.entityListTitle ?? '');
const entityList = computed(() => cfg.value?.entityList ?? []);
const logs = computed(() => cfg.value?.logs ?? []);
const activeAction = ref(null);
const selectedEntity = ref(null);
const toggleStates = reactive({
    video: true, alarm: true, auto: true, fan1: true, fan2: false,
    siren: true, cam: true, realtime: true, notify: true,
});
const sliderValues = reactive({
    advance: 30, range: 200, interval: 4, speed: 3.5,
});
function handleAction(action, type = 'view') {
    if (type === 'view') {
        activeAction.value = action.key;
        setTimeout(() => { activeAction.value = null; }, 800);
    }
    emit('action', action, type);
}
const isProcessable = (key) => {
    const processableKeys = [
        'face_sketch', 'gpr', 'horiz_drill', 'deep_hole', 'tsp', 'tem',
        'weak_rock', 'high_stress', 'water_zone', 'fracture_zone'
    ];
    return processableKeys.includes(key);
};
// 切换场景时重置选中状态
watch(() => props.sceneKey, (key) => {
    activeAction.value = null;
    selectedEntity.value = null;
    if (key === 'vent') {
        nextTick(() => initVentCharts());
    }
});
// ── 通风监测图表 ─────────────────────────────────────────
const gasChartEl = ref(null);
const windSpeedEl = ref(null);
const windVolEl = ref(null);
let gasChart = null;
let wsGauge = null;
let wvGauge = null;
const hours = Array.from({ length: 12 }, (_, i) => `${(new Date().getHours() - 11 + i + 24) % 24}:00`);
const coTrend = [6, 8, 12, 20, 18, 15, 10, 8, 7, 9, 14, 18];
const o2Trend = [20.9, 20.8, 20.6, 20.2, 20.3, 20.5, 20.7, 20.8, 20.9, 20.7, 20.4, 20.2];
const dustTrend = [0.5, 0.8, 1.2, 3.5, 3.2, 2.8, 1.5, 1.0, 0.8, 1.1, 2.3, 3.5];
const gasCards = computed(() => [
    { name: 'CO', value: 18, unit: 'ppm', limit: 24, pct: Math.min(18 / 24 * 100, 100), valColor: '#ffaa00', barColor: '#ff9900' },
    { name: 'O₂', value: 20.2, unit: '%', limit: 20, pct: Math.min(20.2 / 22 * 100, 100), valColor: '#ff4444', barColor: '#00aaff' },
    { name: '粉尘', value: 3.5, unit: 'mg/m³', limit: 4, pct: Math.min(3.5 / 4 * 100, 100), valColor: '#ffaa00', barColor: '#ff9900' },
    { name: '温度', value: 22, unit: '℃', limit: 28, pct: Math.min(22 / 28 * 100, 100), valColor: '#00eaff', barColor: '#00eaff' },
]);
function initVentCharts() {
    if (gasChartEl.value && !gasChart) {
        gasChart = echarts.init(gasChartEl.value, 'dark');
        gasChart.setOption({
            backgroundColor: 'transparent',
            grid: { top: 10, right: 10, bottom: 22, left: 36 },
            xAxis: { type: 'category', data: hours, axisLabel: { color: 'rgba(180,220,255,0.4)', fontSize: 8 }, axisLine: { lineStyle: { color: 'rgba(0,150,255,0.15)' } }, axisTick: { show: false } },
            yAxis: [
                { type: 'value', name: 'ppm', nameTextStyle: { color: 'rgba(180,220,255,0.35)', fontSize: 8 }, axisLabel: { color: 'rgba(180,220,255,0.4)', fontSize: 8 }, splitLine: { lineStyle: { color: 'rgba(0,150,255,0.06)', type: 'dashed' } } },
                { type: 'value', name: '%', nameTextStyle: { color: 'rgba(180,220,255,0.35)', fontSize: 8 }, axisLabel: { color: 'rgba(180,220,255,0.4)', fontSize: 8 }, splitLine: { show: false }, min: 19.5, max: 21.5 },
            ],
            legend: { data: ['CO', 'O₂', '粉尘'], textStyle: { color: 'rgba(180,220,255,0.5)', fontSize: 9 }, right: 0, top: 0, itemWidth: 10, itemHeight: 6 },
            series: [
                { name: 'CO', type: 'line', data: coTrend, smooth: true, lineStyle: { color: '#ff9900', width: 1.5 }, itemStyle: { color: '#ff9900' } },
                { name: 'O₂', type: 'line', data: o2Trend, smooth: true, lineStyle: { color: '#00aaff', width: 1.5 }, itemStyle: { color: '#00aaff' }, yAxisIndex: 1 },
                { name: '粉尘', type: 'line', data: dustTrend, smooth: true, lineStyle: { color: '#cc44ff', width: 1.5 }, itemStyle: { color: '#cc44ff' } },
            ],
            tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)', textStyle: { color: '#00eaff', fontSize: 10 } },
        });
    }
    const makeGauge = (el, name, value, max, unit, color) => {
        if (!el)
            return null;
        const c = echarts.init(el, 'dark');
        c.setOption({
            backgroundColor: 'transparent',
            series: [{
                    type: 'gauge', radius: '85%',
                    startAngle: 200, endAngle: -20,
                    min: 0, max,
                    splitNumber: 5,
                    axisLine: { lineStyle: { width: 6, color: [[value / max, color], [1, 'rgba(0,50,100,0.3)']] } },
                    pointer: { width: 2, length: '60%', itemStyle: { color } },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: { color: 'rgba(180,220,255,0.35)', fontSize: 8, distance: -14 },
                    detail: { formatter: `{value}`, color: 'rgba(200,240,255,0.7)', fontSize: 12, offsetCenter: [0, '30%'] },
                    title: { color: 'rgba(180,220,255,0.45)', fontSize: 9, offsetCenter: [0, '-18%'] },
                    data: [{ value, name }],
                }],
        });
        return c;
    };
    if (windSpeedEl.value && !wsGauge)
        wsGauge = makeGauge(windSpeedEl.value, '风速 m/s', 0.8, 6, '', '#ff9900');
    if (windVolEl.value && !wvGauge)
        wvGauge = makeGauge(windVolEl.value, '风量 m³/min', 180, 600, '', '#44ff88');
}
onMounted(() => {
    if (props.sceneKey === 'vent')
        nextTick(() => initVentCharts());
});
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
/** @type {__VLS_StyleScopedClasses['special']} */ ;
/** @type {__VLS_StyleScopedClasses['action-group']} */ ;
/** @type {__VLS_StyleScopedClasses['scp-toggle-knob']} */ ;
/** @type {__VLS_StyleScopedClasses['ok']} */ ;
/** @type {__VLS_StyleScopedClasses['warn']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "panel-slide-right",
}));
const __VLS_2 = __VLS_1({
    name: "panel-slide-right",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.show) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scene-ctrl-panel" },
        ...{ style: ({ '--sc': __VLS_ctx.sceneColor }) },
    });
    /** @type {__VLS_StyleScopedClasses['scene-ctrl-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scp-header" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scp-title-group" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-title-group']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scp-title" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scp-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-sub']} */ ;
    (__VLS_ctx.sceneName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.$emit('close');
                // @ts-ignore
                [show, sceneColor, sceneName, $emit,];
            } },
        ...{ class: "scp-close" },
        title: "关闭",
    });
    /** @type {__VLS_StyleScopedClasses['scp-close']} */ ;
    if ((__VLS_ctx.cfg?.actionGroups?.length) || __VLS_ctx.actions.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-actions']} */ ;
        if (__VLS_ctx.cfg?.actionGroups?.length) {
            for (const [group] of __VLS_vFor((__VLS_ctx.cfg.actionGroups))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (group.title),
                    ...{ class: "action-group" },
                });
                /** @type {__VLS_StyleScopedClasses['action-group']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "scp-section-title" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-section-title']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "scp-si" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-si']} */ ;
                (group.title);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "scp-action-grid" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-action-grid']} */ ;
                for (const [action] of __VLS_vFor((group.actions))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        key: (action.key),
                        ...{ class: "scp-action-wrapper" },
                        ...{ class: (action.type) },
                    });
                    /** @type {__VLS_StyleScopedClasses['scp-action-wrapper']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.show))
                                    return;
                                if (!((__VLS_ctx.cfg?.actionGroups?.length) || __VLS_ctx.actions.length))
                                    return;
                                if (!(__VLS_ctx.cfg?.actionGroups?.length))
                                    return;
                                __VLS_ctx.handleAction(action, 'view');
                                // @ts-ignore
                                [cfg, cfg, cfg, actions, handleAction,];
                            } },
                        ...{ class: "scp-action-btn" },
                        ...{ class: ([action.type, { active: __VLS_ctx.activeAction === action.key }]) },
                    });
                    /** @type {__VLS_StyleScopedClasses['scp-action-btn']} */ ;
                    /** @type {__VLS_StyleScopedClasses['active']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "scp-ab-icon" },
                    });
                    /** @type {__VLS_StyleScopedClasses['scp-ab-icon']} */ ;
                    (action.icon);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "scp-ab-label" },
                    });
                    /** @type {__VLS_StyleScopedClasses['scp-ab-label']} */ ;
                    (action.label);
                    if (__VLS_ctx.isProcessable(action.key)) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                            ...{ onClick: (...[$event]) => {
                                    if (!(__VLS_ctx.show))
                                        return;
                                    if (!((__VLS_ctx.cfg?.actionGroups?.length) || __VLS_ctx.actions.length))
                                        return;
                                    if (!(__VLS_ctx.cfg?.actionGroups?.length))
                                        return;
                                    if (!(__VLS_ctx.isProcessable(action.key)))
                                        return;
                                    __VLS_ctx.handleAction(action, 'process');
                                    // @ts-ignore
                                    [handleAction, activeAction, isProcessable,];
                                } },
                            ...{ class: "scp-process-btn" },
                            title: "自动化处理",
                        });
                        /** @type {__VLS_StyleScopedClasses['scp-process-btn']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "process-icon" },
                        });
                        /** @type {__VLS_StyleScopedClasses['process-icon']} */ ;
                    }
                    // @ts-ignore
                    [];
                }
                // @ts-ignore
                [];
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "scp-section-title" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-section-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "scp-si" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-si']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "scp-action-grid" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-action-grid']} */ ;
            for (const [action] of __VLS_vFor((__VLS_ctx.actions))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.show))
                                return;
                            if (!((__VLS_ctx.cfg?.actionGroups?.length) || __VLS_ctx.actions.length))
                                return;
                            if (!!(__VLS_ctx.cfg?.actionGroups?.length))
                                return;
                            __VLS_ctx.handleAction(action, 'view');
                            // @ts-ignore
                            [actions, handleAction,];
                        } },
                    key: (action.key),
                    ...{ class: "scp-action-btn" },
                    ...{ class: ([action.type, { active: __VLS_ctx.activeAction === action.key }]) },
                });
                /** @type {__VLS_StyleScopedClasses['scp-action-btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "scp-ab-icon" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-ab-icon']} */ ;
                (action.icon);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "scp-ab-label" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-ab-label']} */ ;
                (action.label);
                // @ts-ignore
                [activeAction,];
            }
        }
    }
    if (__VLS_ctx.params.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-params" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-params']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "scp-si" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-si']} */ ;
        for (const [p] of __VLS_vFor((__VLS_ctx.params))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (p.key),
                ...{ class: "scp-param-row" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-param-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "scp-param-label" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-param-label']} */ ;
            (p.label);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "scp-param-ctrl" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-param-ctrl']} */ ;
            if (p.type === 'toggle') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.show))
                                return;
                            if (!(__VLS_ctx.params.length))
                                return;
                            if (!(p.type === 'toggle'))
                                return;
                            __VLS_ctx.toggleStates[p.key] = !__VLS_ctx.toggleStates[p.key];
                            // @ts-ignore
                            [params, params, toggleStates, toggleStates,];
                        } },
                    ...{ class: "scp-toggle" },
                    ...{ class: ({ on: __VLS_ctx.toggleStates[p.key] }) },
                });
                /** @type {__VLS_StyleScopedClasses['scp-toggle']} */ ;
                /** @type {__VLS_StyleScopedClasses['on']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "scp-toggle-knob" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-toggle-knob']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "scp-toggle-label" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-toggle-label']} */ ;
                (__VLS_ctx.toggleStates[p.key] ? '开启' : '关闭');
            }
            else if (p.type === 'slider') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "scp-slider" },
                    type: "range",
                    min: (p.min),
                    max: (p.max),
                    step: (p.step ?? 1),
                });
                (__VLS_ctx.sliderValues[p.key]);
                /** @type {__VLS_StyleScopedClasses['scp-slider']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "scp-slider-val" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-slider-val']} */ ;
                (__VLS_ctx.sliderValues[p.key]);
                (p.unit);
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "scp-param-val" },
                });
                /** @type {__VLS_StyleScopedClasses['scp-param-val']} */ ;
                (p.value);
            }
            // @ts-ignore
            [toggleStates, toggleStates, sliderValues, sliderValues,];
        }
    }
    if (props.sceneKey === 'vent') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-vent-monitor" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-vent-monitor']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "scp-si" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-si']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "gasChartEl",
            ...{ class: "vent-gas-chart" },
        });
        /** @type {__VLS_StyleScopedClasses['vent-gas-chart']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "vent-gauge-row" },
        });
        /** @type {__VLS_StyleScopedClasses['vent-gauge-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "windSpeedEl",
            ...{ class: "vent-gauge" },
        });
        /** @type {__VLS_StyleScopedClasses['vent-gauge']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ref: "windVolEl",
            ...{ class: "vent-gauge" },
        });
        /** @type {__VLS_StyleScopedClasses['vent-gauge']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-section-title" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['scp-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "scp-si" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-si']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "vent-gas-cards" },
        });
        /** @type {__VLS_StyleScopedClasses['vent-gas-cards']} */ ;
        for (const [g] of __VLS_vFor((__VLS_ctx.gasCards))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "vent-gas-card" },
                key: (g.name),
            });
            /** @type {__VLS_StyleScopedClasses['vent-gas-card']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "vgc-name" },
            });
            /** @type {__VLS_StyleScopedClasses['vgc-name']} */ ;
            (g.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "vgc-val" },
                ...{ style: ({ color: g.valColor }) },
            });
            /** @type {__VLS_StyleScopedClasses['vgc-val']} */ ;
            (g.value);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (g.unit);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "vgc-bar" },
            });
            /** @type {__VLS_StyleScopedClasses['vgc-bar']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "vgc-fill" },
                ...{ style: ({ width: g.pct + '%', background: g.barColor }) },
            });
            /** @type {__VLS_StyleScopedClasses['vgc-fill']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "vgc-limit" },
            });
            /** @type {__VLS_StyleScopedClasses['vgc-limit']} */ ;
            (g.limit);
            (g.unit);
            // @ts-ignore
            [gasCards,];
        }
    }
    if (__VLS_ctx.entityList.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-entity-list" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-entity-list']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "scp-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "scp-si" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-si']} */ ;
        (__VLS_ctx.entityListTitle);
        for (const [item] of __VLS_vFor((__VLS_ctx.entityList))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(__VLS_ctx.entityList.length))
                            return;
                        __VLS_ctx.selectedEntity = item.id;
                        // @ts-ignore
                        [entityList, entityList, entityListTitle, selectedEntity,];
                    } },
                key: (item.id),
                ...{ class: "scp-entity-row" },
                ...{ class: ({ selected: __VLS_ctx.selectedEntity === item.id }) },
            });
            /** @type {__VLS_StyleScopedClasses['scp-entity-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['selected']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "scp-entity-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-entity-icon']} */ ;
            (item.icon);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "scp-entity-info" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-entity-info']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "scp-entity-name" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-entity-name']} */ ;
            (item.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "scp-entity-loc" },
            });
            /** @type {__VLS_StyleScopedClasses['scp-entity-loc']} */ ;
            (item.sub);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "scp-entity-status" },
                ...{ class: (item.statusCls) },
            });
            /** @type {__VLS_StyleScopedClasses['scp-entity-status']} */ ;
            (item.status);
            // @ts-ignore
            [selectedEntity,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scp-log" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-log']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scp-section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "scp-si" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-si']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "scp-log-list" },
    });
    /** @type {__VLS_StyleScopedClasses['scp-log-list']} */ ;
    for (const [log] of __VLS_vFor((__VLS_ctx.logs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (log.id),
            ...{ class: "scp-log-row" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-log-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "scp-log-time" },
        });
        /** @type {__VLS_StyleScopedClasses['scp-log-time']} */ ;
        (log.time);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "scp-log-msg" },
            ...{ class: (log.type) },
        });
        /** @type {__VLS_StyleScopedClasses['scp-log-msg']} */ ;
        (log.msg);
        // @ts-ignore
        [logs,];
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
