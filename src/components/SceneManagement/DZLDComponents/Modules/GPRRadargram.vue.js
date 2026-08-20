import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
const props = defineProps({
    initialX: { type: Number, default: 310 },
    initialY: { type: Number, default: 480 },
});
// ---- Panel state ----
const visible = ref(true);
const collapsed = ref(false);
const panelRef = ref(null);
const pos = ref({ x: props.initialX, y: props.initialY });
// ---- Data ----
const radarData = ref(null);
const currentLine = ref(1);
const cmap = ref('gray');
const gain = ref(1.0);
const showReflectors = ref(true);
const showWiggle = ref(false);
const radarCanvas = ref(null);
const canvasWrap = ref(null);
const cursorPos = ref(null);
const cursorScan = ref(0);
const cursorDist = ref(0);
const cursorDepth = ref(0);
let rawData = null;
let resizeObserver = null;
// ---- Drag (viewport-clamped, matches DispatchGantt) ----
let dragging = false;
let dragStart = { x: 0, y: 0 };
function onDragStart(e) {
    if (e.button !== 0)
        return;
    dragging = true;
    dragStart = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
}
function onDrag(e) {
    if (!dragging)
        return;
    pos.value = {
        x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 300)),
        y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 60)),
    };
}
function onDragEnd() {
    dragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
}
// ---- Data loading ----
async function switchLine() { await loadData(); }
async function loadData() {
    try {
        const url = `data/GPR_new/output/radargram_line${currentLine.value}.json`;
        const resp = await fetch(url);
        const json = await resp.json();
        const key = Object.keys(json)[0];
        radarData.value = json[key];
        rawData = {
            data: new Float32Array(radarData.value.data),
            shape: radarData.value.ds_shape,
        };
        await nextTick();
        render();
    }
    catch (err) {
        console.error('Failed to load GPR radargram data:', err);
    }
}
// ---- Rendering ----
function getColor(val) {
    const v = Math.max(-1, Math.min(1, val));
    switch (cmap.value) {
        case 'seismic': {
            const t = v * 0.5 + 0.5;
            return [t < 0.5 ? 0 : (t - 0.5) * 2, 1 - 2 * Math.abs(t - 0.5), t < 0.5 ? (0.5 - t) * 2 : 0];
        }
        case 'hot': {
            const t = v * 0.5 + 0.5;
            return [Math.min(1, t * 3), Math.max(0, (t - 0.3) * 3), Math.max(0, (t - 0.6) * 3)];
        }
        case 'terrain': {
            if (v < -0.5)
                return [0, 0, 0.4 + (v + 1) * 1.2];
            if (v < 0)
                return [0, 0.5 + v * 1, 0.3 - v * 0.6];
            if (v < 0.5)
                return [v * 1.6, 0.6 + v * 0.4, 0.15];
            return [0.8 + v * 0.4, 0.8 + v * 0.4, 0.15 + v * 1.7];
        }
        default: {
            const g = v * 0.5 + 0.5;
            return [g, g, g];
        }
    }
}
function render() {
    if (!radarCanvas.value || !canvasWrap.value || !rawData)
        return;
    const canvas = radarCanvas.value;
    const wrap = canvasWrap.value;
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { data, shape } = rawData;
    const [nScans, nSamples] = shape;
    const g = gain.value;
    const img = ctx.createImageData(W, H);
    for (let py = 0; py < H; py++) {
        const dIdx = Math.floor(py / H * nSamples);
        const rowBase = dIdx * nScans;
        for (let px = 0; px < W; px++) {
            const sIdx = Math.floor(px / W * nScans);
            const val = data[rowBase + sIdx] * g;
            const [r, gv, b] = getColor(val);
            const idx = (py * W + px) * 4;
            img.data[idx] = Math.round(r * 255);
            img.data[idx + 1] = Math.round(gv * 255);
            img.data[idx + 2] = Math.round(b * 255);
            img.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    // Reflectors
    if (showReflectors.value && radarData.value?.reflectors) {
        const depthMax = radarData.value.depth_range_m;
        ctx.strokeStyle = 'rgba(0,234,255,0.35)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 5]);
        ctx.font = '9px "Consolas", monospace';
        ctx.fillStyle = 'rgba(0,234,255,0.8)';
        radarData.value.reflectors.forEach((r) => {
            const y = r.depth_m / depthMax * H;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
            ctx.fillText(r.depth_m.toFixed(1) + 'm', 5, y - 3);
        });
        ctx.setLineDash([]);
    }
    // Wiggle
    if (showWiggle.value) {
        const spacing = Math.max(2, Math.floor(nScans / 40));
        const ampScale = W / nScans * 0.5;
        ctx.strokeStyle = 'rgba(200,240,255,0.3)';
        ctx.lineWidth = 0.4;
        for (let s = 0; s < nScans; s += spacing) {
            const x = s / nScans * W;
            ctx.beginPath();
            for (let d = 0; d < nSamples; d++) {
                const val = data[d * nScans + s] * g * ampScale;
                const y = d / nSamples * H;
                if (d === 0)
                    ctx.moveTo(x + val, y);
                else
                    ctx.lineTo(x + val, y);
            }
            ctx.stroke();
        }
    }
}
// ---- Mouse ----
function onMouseMove(e) {
    if (!canvasWrap.value || !rawData)
        return;
    const rect = canvasWrap.value.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const [nScans] = rawData.shape;
    cursorScan.value = Math.floor(relX * nScans);
    cursorDist.value = relX * (radarData.value?.profile_length_m || 4.1);
    cursorDepth.value = relY * (radarData.value?.depth_range_m || 31.82);
    cursorPos.value = { x: e.clientX - rect.left };
}
function onMouseLeave() { cursorPos.value = null; }
// ---- Watchers ----
let renderTimer = null;
function scheduleRender() {
    if (renderTimer)
        clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 50);
}
watch([cmap, gain, showReflectors, showWiggle], scheduleRender);
onMounted(() => {
    loadData();
    if (canvasWrap.value) {
        resizeObserver = new ResizeObserver(scheduleRender);
        resizeObserver.observe(canvasWrap.value);
    }
});
onBeforeUnmount(() => {
    onDragEnd();
    if (resizeObserver)
        resizeObserver.disconnect();
    if (renderTimer)
        clearTimeout(renderTimer);
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['gpr-btn-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-btn-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-btn-close']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-label']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-label']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-label']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-check']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-canvas-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['gpr-header']} */ ;
if (__VLS_ctx.visible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ref: "panelRef",
        ...{ class: "gpr-float" },
        ...{ class: ({ collapsed: __VLS_ctx.collapsed }) },
        ...{ style: ({ left: __VLS_ctx.pos.x + 'px', top: __VLS_ctx.pos.y + 'px' }) },
    });
    /** @type {__VLS_StyleScopedClasses['gpr-float']} */ ;
    /** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ onMousedown: (__VLS_ctx.onDragStart) },
        ...{ class: "gpr-header" },
    });
    /** @type {__VLS_StyleScopedClasses['gpr-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "gpr-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['gpr-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "gpr-title" },
    });
    /** @type {__VLS_StyleScopedClasses['gpr-title']} */ ;
    (__VLS_ctx.radarData?.name || '加载中...');
    if (__VLS_ctx.radarData) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "gpr-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-meta']} */ ;
        (__VLS_ctx.radarData.n_scans);
        (__VLS_ctx.radarData.profile_length_m);
        (__VLS_ctx.radarData.dielectric);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onMousedown: () => { } },
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.visible))
                    return;
                __VLS_ctx.collapsed = !__VLS_ctx.collapsed;
                // @ts-ignore
                [visible, collapsed, collapsed, collapsed, pos, pos, onDragStart, radarData, radarData, radarData, radarData, radarData,];
            } },
        ...{ class: "gpr-btn-collapse" },
        title: (__VLS_ctx.collapsed ? '展开' : '折叠'),
    });
    /** @type {__VLS_StyleScopedClasses['gpr-btn-collapse']} */ ;
    (__VLS_ctx.collapsed ? '▸' : '▾');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onMousedown: () => { } },
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.visible))
                    return;
                __VLS_ctx.visible = false;
                // @ts-ignore
                [visible, collapsed, collapsed,];
            } },
        ...{ class: "gpr-btn-close" },
        title: "关闭",
    });
    /** @type {__VLS_StyleScopedClasses['gpr-btn-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "gpr-body" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.collapsed) }, null, null);
    /** @type {__VLS_StyleScopedClasses['gpr-body']} */ ;
    if (!__VLS_ctx.radarData) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gpr-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-loading']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gpr-controls" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-controls']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gpr-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "gpr-si" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-si']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gpr-ctrl-row" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-ctrl-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "gpr-label" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: (__VLS_ctx.switchLine) },
            value: (__VLS_ctx.currentLine),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (1),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (2),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "gpr-label" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.cmap),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "gray",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "seismic",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "hot",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "terrain",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "gpr-label" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "range",
            min: "0.5",
            max: "4",
            step: "0.1",
        });
        (__VLS_ctx.gain);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "gpr-gain-val" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-gain-val']} */ ;
        (__VLS_ctx.gain);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "gpr-check" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
        });
        (__VLS_ctx.showReflectors);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "gpr-check" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
        });
        (__VLS_ctx.showWiggle);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onMousemove: (__VLS_ctx.onMouseMove) },
            ...{ onMouseleave: (__VLS_ctx.onMouseLeave) },
            ...{ class: "gpr-canvas-wrap" },
            ref: "canvasWrap",
        });
        /** @type {__VLS_StyleScopedClasses['gpr-canvas-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
            ref: "radarCanvas",
        });
        if (__VLS_ctx.cursorPos) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "gpr-cursor" },
                ...{ style: ({ left: __VLS_ctx.cursorPos.x + 'px' }) },
            });
            /** @type {__VLS_StyleScopedClasses['gpr-cursor']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "gpr-cursor-line" },
            });
            /** @type {__VLS_StyleScopedClasses['gpr-cursor-line']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gpr-cursor-tag" },
            });
            /** @type {__VLS_StyleScopedClasses['gpr-cursor-tag']} */ ;
            (__VLS_ctx.cursorScan);
            (__VLS_ctx.cursorDist.toFixed(2));
            (__VLS_ctx.cursorDepth.toFixed(2));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({
            ...{ class: "gpr-footer" },
        });
        /** @type {__VLS_StyleScopedClasses['gpr-footer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.radarData.n_samples);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.radarData.depth_range_m);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.radarData.velocity_m_ns);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.radarData.reflectors?.length || 0);
    }
}
// @ts-ignore
[collapsed, radarData, radarData, radarData, radarData, radarData, switchLine, currentLine, cmap, gain, gain, showReflectors, showWiggle, onMouseMove, onMouseLeave, cursorPos, cursorPos, cursorScan, cursorDist, cursorDepth,];
const __VLS_export = (await import('vue')).defineComponent({
    props: {
        initialX: { type: Number, default: 310 },
        initialY: { type: Number, default: 480 },
    },
});
export default {};
