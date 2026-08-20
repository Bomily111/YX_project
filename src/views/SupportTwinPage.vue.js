import { ref, onMounted } from 'vue';
import SupportModule from '@/views/support-module/SupportModule.vue';
const ready = ref(false);
const loadPercent = ref(0);
onMounted(() => {
    const interval = setInterval(() => {
        if (loadPercent.value < 85) {
            loadPercent.value += Math.floor(Math.random() * 12) + 3;
            if (loadPercent.value > 85)
                loadPercent.value = 85;
        }
    }, 200);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            clearInterval(interval);
            loadPercent.value = 100;
            setTimeout(() => {
                ready.value = true;
            }, 150);
        });
    });
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stp-wrapper" },
});
/** @type {__VLS_StyleScopedClasses['stp-wrapper']} */ ;
if (!__VLS_ctx.ready) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stp-loading-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['stp-loading-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stp-loading-box" },
    });
    /** @type {__VLS_StyleScopedClasses['stp-loading-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stp-loading-bar-track" },
    });
    /** @type {__VLS_StyleScopedClasses['stp-loading-bar-track']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stp-loading-bar-fill" },
        ...{ style: ({ width: __VLS_ctx.loadPercent + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['stp-loading-bar-fill']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stp-loading-text" },
    });
    /** @type {__VLS_StyleScopedClasses['stp-loading-text']} */ ;
    (__VLS_ctx.loadPercent);
}
const __VLS_0 = SupportModule;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.ready) }, null, null);
// @ts-ignore
[ready, ready, loadPercent, loadPercent,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
