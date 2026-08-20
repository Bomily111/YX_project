import { ref, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';
const emit = defineEmits();
const today = new Date().toLocaleDateString('zh-CN');
const pos = ref({ x: Math.max(0, window.innerWidth - 620), y: Math.max(0, window.innerHeight - 340) });
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
        x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 580)),
        y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 100)),
    };
};
const stopDrag = () => {
    dragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};
onBeforeUnmount(() => { stopDrag(); });
const ganttEl = ref(null);
let chart = null;
const tasks = [
    { name: '出渣作业', start: 6, dur: 2, color: '#ffaa00', done: true },
    { name: '找顶安全', start: 8, dur: 1, color: '#44ff88', done: true },
    { name: '上台阶钻孔', start: 9, dur: 2.5, color: '#00aaff', done: true },
    { name: '装药连线', start: 11.5, dur: 1, color: '#ff9900', done: true },
    { name: '爆破作业', start: 12.5, dur: 0.5, color: '#ff4444', done: true },
    { name: '通风散烟', start: 13, dur: 1.5, color: '#00eaff', done: false },
    { name: '初喷支护', start: 14.5, dur: 2.5, color: '#88ff44', done: false },
    { name: '系统锚杆', start: 17, dur: 2, color: '#44aaff', done: false },
    { name: '下台阶出渣', start: 19, dur: 2, color: '#ffaa00', done: false },
];
onMounted(() => {
    if (!ganttEl.value)
        return;
    chart = echarts.init(ganttEl.value, 'dark');
    const seriesData = tasks.map((t, i) => ({
        name: t.name,
        value: [i, t.start, t.start + t.dur, t.done ? 1 : 0],
        itemStyle: { color: t.done ? t.color : t.color + '55', borderColor: t.color, borderWidth: 1 },
    }));
    const nowH = new Date().getHours() + new Date().getMinutes() / 60;
    chart.setOption({
        backgroundColor: 'transparent',
        grid: { top: 8, right: 16, bottom: 24, left: 80 },
        xAxis: {
            type: 'value', min: 6, max: 22,
            axisLabel: { color: 'rgba(180,220,255,0.45)', fontSize: 10, formatter: (v) => `${Math.floor(v)}:00` },
            splitLine: { lineStyle: { color: 'rgba(0,150,255,0.06)', type: 'dashed' } },
            axisLine: { lineStyle: { color: 'rgba(0,150,255,0.15)' } },
        },
        yAxis: {
            type: 'category',
            data: tasks.map(t => t.name),
            axisLabel: { color: 'rgba(180,220,255,0.55)', fontSize: 10 },
            axisLine: { lineStyle: { color: 'rgba(0,150,255,0.12)' } },
            axisTick: { show: false },
        },
        series: [
            {
                type: 'custom',
                renderItem: (_, api) => {
                    const categoryIndex = api.value(0);
                    const start = api.coord([api.value(1), categoryIndex]);
                    const end = api.coord([api.value(2), categoryIndex]);
                    const height = api.size([0, 1])[1] * 0.5;
                    return {
                        type: 'rect',
                        shape: { x: start[0], y: start[1] - height / 2, width: end[0] - start[0], height },
                        style: api.style(),
                    };
                },
                encode: { x: [1, 2], y: 0 },
                data: seriesData,
            },
            {
                type: 'line',
                markLine: {
                    symbol: 'none',
                    data: [{ xAxis: nowH }],
                    lineStyle: { color: '#ffdd00', width: 1.5, type: 'solid' },
                    label: { formatter: '现在', color: '#ffdd00', fontSize: 9 },
                },
                data: [],
            },
        ],
        tooltip: {
            backgroundColor: 'rgba(0,10,24,0.9)', borderColor: 'rgba(0,200,255,0.3)',
            textStyle: { color: '#00eaff', fontSize: 11 },
            formatter: (p) => {
                const t = tasks[p.data.value[0]];
                return `<b>${t.name}</b><br/>${t.start}:00 → ${(t.start + t.dur).toFixed(1).replace('.0', '')}:00<br/>${t.done ? '✅ 完成' : '⏳ 进行中'}`;
            },
        },
    });
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dg-float" },
    ...{ style: ({ left: __VLS_ctx.pos.x + 'px', top: __VLS_ctx.pos.y + 'px' }) },
});
/** @type {__VLS_StyleScopedClasses['dg-float']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousedown: (__VLS_ctx.startDrag) },
    ...{ class: "dgf-header" },
});
/** @type {__VLS_StyleScopedClasses['dgf-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dgf-icon" },
});
/** @type {__VLS_StyleScopedClasses['dgf-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dgf-title" },
});
/** @type {__VLS_StyleScopedClasses['dgf-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dgf-date" },
});
/** @type {__VLS_StyleScopedClasses['dgf-date']} */ ;
(__VLS_ctx.today);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [pos, pos, startDrag, today, emit,];
        } },
    ...{ class: "dgf-close" },
});
/** @type {__VLS_StyleScopedClasses['dgf-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dgf-body" },
});
/** @type {__VLS_StyleScopedClasses['dgf-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "ganttEl",
    ...{ class: "gantt-chart" },
});
/** @type {__VLS_StyleScopedClasses['gantt-chart']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
