import { ref } from 'vue';
import TemDetail from './TemDetail.vue';
const __VLS_props = defineProps();
const __VLS_emit = defineEmits();
const tspActive = ref('vs');
const tspTypes = [
    { key: 'vp', label: 'VP 波速' },
    { key: 'vs', label: 'VS 波速' },
    { key: 'depth', label: '深度' },
];
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
    ...{ class: "mp-root" },
});
/** @type {__VLS_StyleScopedClasses['mp-root']} */ ;
if (__VLS_ctx.method.key === 'tsp') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-types" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-types']} */ ;
    for (const [t] of __VLS_vFor((__VLS_ctx.tspTypes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.method.key === 'tsp'))
                        return;
                    __VLS_ctx.tspActive = t.key;
                    // @ts-ignore
                    [method, tspTypes, tspActive,];
                } },
            key: (t.key),
            ...{ class: "mp-type-btn" },
            ...{ class: ({ active: __VLS_ctx.tspActive === t.key }) },
        });
        /** @type {__VLS_StyleScopedClasses['mp-type-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (t.label);
        // @ts-ignore
        [tspActive,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-colorbar-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-colorbar-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
}
else if (__VLS_ctx.method.key === 'horiz_drill') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-card" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-name" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-src" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-src']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-card" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-name" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-src" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-src']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
}
else if (__VLS_ctx.method.key === 'tem') {
    const __VLS_0 = TemDetail;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onViewInScene': {} },
        ...{ 'onViewVoxelCloud': {} },
        dataDir: ('/data/tem_output'),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onViewInScene': {} },
        ...{ 'onViewVoxelCloud': {} },
        dataDir: ('/data/tem_output'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ viewInScene: {} },
        { onViewInScene: ((jobId) => __VLS_ctx.$emit('viewInScene', jobId)) });
    const __VLS_7 = ({ viewVoxelCloud: {} },
        { onViewVoxelCloud: ((jobId) => __VLS_ctx.$emit('viewVoxelCloud', jobId)) });
    var __VLS_3;
    var __VLS_4;
}
else if (__VLS_ctx.method.key === 'face_sketch') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-model-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-model-grid']} */ ;
    for (const [i] of __VLS_vFor((4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mp-model-card" },
            key: (i),
        });
        /** @type {__VLS_StyleScopedClasses['mp-model-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mp-model-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['mp-model-icon']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mp-model-name" },
        });
        /** @type {__VLS_StyleScopedClasses['mp-model-name']} */ ;
        (i);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mp-model-src" },
        });
        /** @type {__VLS_StyleScopedClasses['mp-model-src']} */ ;
        (i);
        // @ts-ignore
        [method, method, method, $emit, $emit,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-section-title" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-section-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-empty-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-empty-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mp-empty-text" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-empty-text']} */ ;
}
if (__VLS_ctx.method.key !== 'tem') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.method.key !== 'tem'))
                    return;
                __VLS_ctx.$emit('viewInScene');
                // @ts-ignore
                [method, $emit,];
            } },
        ...{ class: "mp-view-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['mp-view-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
