import { ref, onMounted } from 'vue';
const __VLS_props = defineProps();
const loaded = ref(false);
const contourPts = ref('');
const holes = ref([]);
const cats = ref([]);
const vb = ref('-6.6 -9.6 13.2 10.2');
const params = ref([]);
onMounted(async () => {
    try {
        const d = await fetch('data/blast/blast-design.json').then(r => r.json());
        // 二维正视: svgX = x(横向), svgY = -z(上, SVG向下为正故取负)
        contourPts.value = d.contour.map((p) => `${p[0].toFixed(3)},${(-p[2]).toFixed(3)}`).join(' ');
        holes.value = d.holes.map((h) => ({ x: h.collar[0], y: -h.collar[2], color: h.color }));
        cats.value = Object.entries(d.categories).map(([k, v]) => ({ key: k, label: v.label, color: v.color, count: v.count }));
        const xs = d.contour.map((p) => p[0]);
        const zs = d.contour.map((p) => p[2]);
        const minx = Math.min(...xs) - 0.4, maxx = Math.max(...xs) + 0.4;
        const minz = Math.min(...zs) - 0.4, maxz = Math.max(...zs) + 0.4;
        vb.value = `${minx.toFixed(2)} ${(-maxz).toFixed(2)} ${(maxx - minx).toFixed(2)} ${(maxz - minz).toFixed(2)}`;
        const m = d.metadata, sp = m.sectionSpec;
        params.value = [
            ['开挖宽', sp.excavationWidthM + ' m'],
            ['拱顶高', sp.crownHeightM + ' m'],
            ['循环进尺', m.advanceM + ' m'],
            ['炮孔总数', m.totalCharged + ' 个'],
            ['孔径', 'φ45 mm'],
            ['坐标系', '单循环相对(X=0 中线)'],
        ];
        loaded.value = true;
    }
    catch (e) {
        console.error('[Design2D] 加载设计失败', e);
    }
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
/** @type {__VLS_StyleScopedClasses['d2d-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['d2d-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['d2d-params']} */ ;
/** @type {__VLS_StyleScopedClasses['d2d-params']} */ ;
/** @type {__VLS_StyleScopedClasses['d2d-params']} */ ;
if (__VLS_ctx.visible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "d2d" },
    });
    /** @type {__VLS_StyleScopedClasses['d2d']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "d2d-h" },
    });
    /** @type {__VLS_StyleScopedClasses['d2d-h']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "d2d-title" },
    });
    /** @type {__VLS_StyleScopedClasses['d2d-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "d2d-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['d2d-sub']} */ ;
    if (__VLS_ctx.loaded) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            viewBox: (__VLS_ctx.vb),
            ...{ class: "d2d-svg" },
            preserveAspectRatio: "xMidYMid meet",
        });
        /** @type {__VLS_StyleScopedClasses['d2d-svg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.polygon)({
            points: (__VLS_ctx.contourPts),
            fill: "none",
            stroke: "#34d399",
            'stroke-width': "0.055",
            'stroke-dasharray': "0.22 0.16",
            'stroke-linejoin': "round",
        });
        for (const [h, i] of __VLS_vFor((__VLS_ctx.holes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                key: (i),
                cx: (h.x),
                cy: (h.y),
                r: "0.12",
                fill: (h.color),
            });
            // @ts-ignore
            [visible, loaded, vb, contourPts, holes,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "d2d-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['d2d-loading']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "d2d-legend" },
    });
    /** @type {__VLS_StyleScopedClasses['d2d-legend']} */ ;
    for (const [c] of __VLS_vFor((__VLS_ctx.cats))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (c.key),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.i, __VLS_intrinsics.i)({
            ...{ style: ({ background: c.color }) },
        });
        (c.label);
        (c.count);
        // @ts-ignore
        [cats,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "d2d-params" },
    });
    /** @type {__VLS_StyleScopedClasses['d2d-params']} */ ;
    for (const [p] of __VLS_vFor((__VLS_ctx.params))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (p[0]),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        (p[0]);
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (p[1]);
        // @ts-ignore
        [params,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
