import { computed } from 'vue';
const props = defineProps();
const __VLS_emit = defineEmits();
const currentScene = computed(() => props.scenes.find(s => s.key === props.activeScene) ?? null);
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
    ...{ class: "top-nav-container" },
});
/** @type {__VLS_StyleScopedClasses['top-nav-container']} */ ;
if (!__VLS_ctx.activeScene) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "top-nav-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['top-nav-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tn-list" },
    });
    /** @type {__VLS_StyleScopedClasses['tn-list']} */ ;
    for (const [scene] of __VLS_vFor((__VLS_ctx.scenes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.activeScene))
                        return;
                    __VLS_ctx.$emit('select-scene', scene.key);
                    // @ts-ignore
                    [activeScene, scenes, $emit,];
                } },
            key: (scene.key),
            ...{ class: "tn-item" },
        });
        /** @type {__VLS_StyleScopedClasses['tn-item']} */ ;
        (scene.name);
        // @ts-ignore
        [];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "top-nav-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['top-nav-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tn-list" },
    });
    /** @type {__VLS_StyleScopedClasses['tn-list']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.activeScene))
                    return;
                __VLS_ctx.$emit('back-to-overview');
                // @ts-ignore
                [$emit,];
            } },
        ...{ class: "tn-item bc-back" },
    });
    /** @type {__VLS_StyleScopedClasses['tn-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['bc-back']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tn-item bc-scene" },
    });
    /** @type {__VLS_StyleScopedClasses['tn-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['bc-scene']} */ ;
    (__VLS_ctx.currentScene?.name);
}
// @ts-ignore
[currentScene,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
