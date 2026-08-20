import { ref, onMounted, onBeforeUnmount } from 'vue';
import TunnelModule from '@/views/tunnel-module/TunnelModule.vue';
import { AgentChat, registerTools, unregisterModule } from '@/ai-agent';
import { blastTools } from '@/ai-agent/tools/blast.tools';
const ready = ref(false);
const loadPercent = ref(0);
onMounted(() => {
    // 注册爆破专项工具到 AI Agent
    registerTools('blast', blastTools);
    const interval = setInterval(() => {
        if (loadPercent.value < 90) {
            loadPercent.value += Math.floor(Math.random() * 15) + 5;
            if (loadPercent.value > 90)
                loadPercent.value = 90;
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
onBeforeUnmount(() => {
    unregisterModule('blast');
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "blast-twin-wrapper" },
});
/** @type {__VLS_StyleScopedClasses['blast-twin-wrapper']} */ ;
if (!__VLS_ctx.ready) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-overlay" },
    });
    /** @type {__VLS_StyleScopedClasses['loading-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-box" },
    });
    /** @type {__VLS_StyleScopedClasses['loading-box']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-bar-track" },
    });
    /** @type {__VLS_StyleScopedClasses['loading-bar-track']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-bar-fill" },
        ...{ style: ({ width: __VLS_ctx.loadPercent + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['loading-bar-fill']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "loading-text" },
    });
    /** @type {__VLS_StyleScopedClasses['loading-text']} */ ;
    (__VLS_ctx.loadPercent);
}
const __VLS_0 = TunnelModule;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.ready) }, null, null);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$router.push('/');
            // @ts-ignore
            [ready, ready, loadPercent, loadPercent, $router,];
        } },
    ...{ class: "back-btn" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.ready) }, null, null);
/** @type {__VLS_StyleScopedClasses['back-btn']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.AgentChat} */
AgentChat;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    context: ({ scene: 'blast' }),
}));
const __VLS_7 = __VLS_6({
    context: ({ scene: 'blast' }),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
// @ts-ignore
[ready,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
