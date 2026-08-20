import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';
const emit = defineEmits();
// ── 拖拽 ──────────────────────────────────────────────────
const pos = ref({ x: window.innerWidth - 460, y: 80 });
const dragging = ref(false);
let dragStart = { x: 0, y: 0 };
const startDrag = (e) => {
    dragging.value = true;
    dragStart = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
};
const onDrag = (e) => {
    if (!dragging.value)
        return;
    pos.value = {
        x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 420)),
        y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 100)),
    };
};
const stopDrag = () => {
    dragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};
onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
});
// ── 里程数据 ─────────────────────────────────────────────
const mileages = [
    'DK278+200', 'DK280+500', 'DK283+000', 'DK285+400',
    'DK287+800', 'DK289+450', 'DK291+200', 'DK293+600',
];
const mileageIdx = ref(5);
const currentMileage = computed(() => mileages[mileageIdx.value]);
const prevMileage = () => { if (mileageIdx.value > 0)
    mileageIdx.value--; };
const nextMileage = () => { if (mileageIdx.value < mileages.length - 1)
    mileageIdx.value++; };
const liningData = [
    { shotcrete: 26, boltSpacing: 100, boltLength: 3.5, archSpacing: 0.8, progress: 100, liningThick: 45, concreteVol: 128, liningMileage: 'DK278+200' },
    { shotcrete: 24, boltSpacing: 100, boltLength: 3.0, archSpacing: 1.0, progress: 100, liningThick: 45, concreteVol: 115, liningMileage: 'DK280+500' },
    { shotcrete: 22, boltSpacing: 120, boltLength: 3.0, archSpacing: 1.0, progress: 100, liningThick: 40, concreteVol: 108, liningMileage: 'DK283+000' },
    { shotcrete: 26, boltSpacing: 100, boltLength: 3.5, archSpacing: 0.8, progress: 100, liningThick: 45, concreteVol: 132, liningMileage: 'DK285+400' },
    { shotcrete: 26, boltSpacing: 80, boltLength: 4.0, archSpacing: 0.6, progress: 85, liningThick: 45, concreteVol: 96, liningMileage: 'DK287+800' },
    { shotcrete: 28, boltSpacing: 80, boltLength: 4.5, archSpacing: 0.5, progress: 42, liningThick: 50, concreteVol: 0, liningMileage: '-' },
    { shotcrete: 0, boltSpacing: 0, boltLength: 0, archSpacing: 0, progress: 0, liningThick: 0, concreteVol: 0, liningMileage: '-' },
    { shotcrete: 0, boltSpacing: 0, boltLength: 0, archSpacing: 0, progress: 0, liningThick: 0, concreteVol: 0, liningMileage: '-' },
];
const current = computed(() => liningData[mileageIdx.value]);
const progressCls = (v) => v >= 100 ? 'green' : v > 60 ? 'orange' : v > 0 ? 'yellow' : 'gray';
const qualityCls = computed(() => current.value.progress >= 100 ? 'green' : 'orange');
const qualityLabel = computed(() => current.value.progress >= 100 ? '合格' : '施工中');
const statusLegend = [
    { label: '已完成二衬', color: '#44ff88' },
    { label: '初支完成', color: '#ffaa00' },
    { label: '施工中', color: '#ff6633' },
    { label: '未施工', color: '#444' },
];
// ── 图表 ─────────────────────────────────────────────────
const chartEl = ref(null);
const progressChartEl = ref(null);
let radarChart = null;
let barChart = null;
const radarIndicators = [
    { name: 'P1', max: 60 }, { name: 'P2', max: 60 }, { name: 'P3', max: 60 }, { name: 'P4', max: 60 },
    { name: 'P5', max: 60 }, { name: 'P6', max: 60 }, { name: 'P7', max: 60 }, { name: 'P8', max: 60 },
];
const initCharts = () => {
    if (chartEl.value) {
        radarChart = echarts.init(chartEl.value, 'dark');
        radarChart.setOption({
            backgroundColor: 'transparent',
            radar: {
                indicator: radarIndicators,
                radius: '62%',
                axisLine: { lineStyle: { color: 'rgba(0,150,255,0.2)' } },
                splitLine: { lineStyle: { color: 'rgba(0,150,255,0.1)' } },
                splitArea: { areaStyle: { color: ['rgba(0,60,120,0.15)', 'rgba(0,40,90,0.1)'] } },
                name: { textStyle: { color: 'rgba(180,220,255,0.6)', fontSize: 10 } },
            },
            series: [{
                    type: 'radar',
                    data: [{ value: [46.2, 47.1, 45.8, 38.5, 44.9, 48.3, 46.7, 45.2], name: '厚度' }],
                    lineStyle: { color: '#00eaff', width: 1.5 },
                    areaStyle: { color: 'rgba(0,200,255,0.12)' },
                    itemStyle: { color: '#00eaff' },
                    label: { show: true, color: '#00eaff', fontSize: 9, formatter: (p) => p.value + '' },
                }],
            tooltip: { backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)', textStyle: { color: '#00eaff' } },
        });
    }
    if (progressChartEl.value) {
        barChart = echarts.init(progressChartEl.value, 'dark');
        barChart.setOption({
            backgroundColor: 'transparent',
            grid: { top: 6, right: 10, bottom: 24, left: 36 },
            xAxis: {
                type: 'category',
                data: mileages.map(m => m.replace('DK', '')),
                axisLabel: { color: 'rgba(180,220,255,0.45)', fontSize: 8, rotate: 30 },
                axisLine: { lineStyle: { color: 'rgba(0,150,255,0.15)' } },
                axisTick: { show: false },
            },
            yAxis: {
                type: 'value', min: 0, max: 100,
                axisLabel: { color: 'rgba(180,220,255,0.45)', fontSize: 9, formatter: '{value}%' },
                splitLine: { lineStyle: { color: 'rgba(0,150,255,0.06)', type: 'dashed' } },
            },
            series: [{
                    type: 'bar',
                    data: liningData.map(d => d.progress),
                    itemStyle: {
                        color: (p) => {
                            const v = p.value;
                            if (v >= 100)
                                return '#44ff88';
                            if (v > 60)
                                return '#ffaa00';
                            if (v > 0)
                                return '#ff6633';
                            return 'rgba(60,60,80,0.4)';
                        },
                        borderRadius: [3, 3, 0, 0],
                    },
                    barMaxWidth: 24,
                    markLine: {
                        data: [{ yAxis: 100 }],
                        lineStyle: { color: 'rgba(68,255,136,0.25)', type: 'dashed' },
                        label: { color: 'rgba(68,255,136,0.5)', fontSize: 9 },
                    },
                }],
            tooltip: {
                backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)',
                textStyle: { color: '#00eaff', fontSize: 11 },
                formatter: (p) => `${mileages[p.dataIndex]}<br/>完成率：<b>${p.value}%</b>`,
            },
        });
    }
};
onMounted(initCharts);
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
/** @type {__VLS_StyleScopedClasses['green']} */ ;
/** @type {__VLS_StyleScopedClasses['orange']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lining-float" },
    ...{ style: ({ left: __VLS_ctx.pos.x + 'px', top: __VLS_ctx.pos.y + 'px' }) },
});
/** @type {__VLS_StyleScopedClasses['lining-float']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousedown: (__VLS_ctx.startDrag) },
    ...{ class: "lf-header" },
});
/** @type {__VLS_StyleScopedClasses['lf-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "lf-icon" },
});
/** @type {__VLS_StyleScopedClasses['lf-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "lf-title" },
});
/** @type {__VLS_StyleScopedClasses['lf-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [pos, pos, startDrag, emit,];
        } },
    ...{ class: "lf-close" },
});
/** @type {__VLS_StyleScopedClasses['lf-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lf-body" },
});
/** @type {__VLS_StyleScopedClasses['lf-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lf-section" },
});
/** @type {__VLS_StyleScopedClasses['lf-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sec-label" },
});
/** @type {__VLS_StyleScopedClasses['sec-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mileage-select-row" },
});
/** @type {__VLS_StyleScopedClasses['mileage-select-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.prevMileage) },
    ...{ class: "mile-btn" },
});
/** @type {__VLS_StyleScopedClasses['mile-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mile-val" },
});
/** @type {__VLS_StyleScopedClasses['mile-val']} */ ;
(__VLS_ctx.currentMileage);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.nextMileage) },
    ...{ class: "mile-btn" },
});
/** @type {__VLS_StyleScopedClasses['mile-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lf-cols" },
});
/** @type {__VLS_StyleScopedClasses['lf-cols']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lf-section" },
});
/** @type {__VLS_StyleScopedClasses['lf-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sec-label" },
});
/** @type {__VLS_StyleScopedClasses['sec-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-list" },
});
/** @type {__VLS_StyleScopedClasses['kv-list']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.current.shotcrete);
__VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.current.boltSpacing);
__VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.current.boltLength);
__VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.current.archSpacing);
__VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
    ...{ class: (__VLS_ctx.progressCls(__VLS_ctx.current.progress)) },
});
(__VLS_ctx.current.progress);
__VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lf-section" },
});
/** @type {__VLS_StyleScopedClasses['lf-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sec-label" },
});
/** @type {__VLS_StyleScopedClasses['sec-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-list" },
});
/** @type {__VLS_StyleScopedClasses['kv-list']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.current.liningThick);
__VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.current.concreteVol);
__VLS_asFunctionalElement1(__VLS_intrinsics.em, __VLS_intrinsics.em)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kv-row" },
});
/** @type {__VLS_StyleScopedClasses['kv-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
    ...{ class: "highlight" },
});
/** @type {__VLS_StyleScopedClasses['highlight']} */ ;
(__VLS_ctx.current.liningMileage);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "legend-mini" },
});
/** @type {__VLS_StyleScopedClasses['legend-mini']} */ ;
for (const [l] of __VLS_vFor((__VLS_ctx.statusLegend))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (l.label),
        ...{ class: "legend-dot" },
        ...{ style: ({ background: l.color }) },
        title: (l.label),
    });
    /** @type {__VLS_StyleScopedClasses['legend-dot']} */ ;
    // @ts-ignore
    [prevMileage, currentMileage, nextMileage, current, current, current, current, current, current, current, current, current, progressCls, statusLegend,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lf-section" },
});
/** @type {__VLS_StyleScopedClasses['lf-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sec-label" },
});
/** @type {__VLS_StyleScopedClasses['sec-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "chartEl",
    ...{ class: "lining-chart" },
});
/** @type {__VLS_StyleScopedClasses['lining-chart']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "thickness-stats" },
});
/** @type {__VLS_StyleScopedClasses['thickness-stats']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-val green" },
});
/** @type {__VLS_StyleScopedClasses['stat-val']} */ ;
/** @type {__VLS_StyleScopedClasses['green']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-lbl" },
});
/** @type {__VLS_StyleScopedClasses['stat-lbl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-val cyan" },
});
/** @type {__VLS_StyleScopedClasses['stat-val']} */ ;
/** @type {__VLS_StyleScopedClasses['cyan']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-lbl" },
});
/** @type {__VLS_StyleScopedClasses['stat-lbl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-val orange" },
});
/** @type {__VLS_StyleScopedClasses['stat-val']} */ ;
/** @type {__VLS_StyleScopedClasses['orange']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-lbl" },
});
/** @type {__VLS_StyleScopedClasses['stat-lbl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-val" },
    ...{ class: (__VLS_ctx.qualityCls) },
});
/** @type {__VLS_StyleScopedClasses['stat-val']} */ ;
(__VLS_ctx.qualityLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-lbl" },
});
/** @type {__VLS_StyleScopedClasses['stat-lbl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lf-section" },
});
/** @type {__VLS_StyleScopedClasses['lf-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sec-label" },
});
/** @type {__VLS_StyleScopedClasses['sec-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "progressChartEl",
    ...{ class: "progress-chart" },
});
/** @type {__VLS_StyleScopedClasses['progress-chart']} */ ;
// @ts-ignore
[qualityCls, qualityLabel,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
