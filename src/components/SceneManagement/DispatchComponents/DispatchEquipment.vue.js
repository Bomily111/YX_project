import { ref, computed, onBeforeUnmount } from 'vue';
const emit = defineEmits();
const pos = ref({ x: window.innerWidth - 690, y: 80 });
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
        x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 300)),
        y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 100)),
    };
};
const stopDrag = () => {
    dragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};
onBeforeUnmount(() => { stopDrag(); });
const selectedItem = ref(6);
const equipment = [
    { id: 6, name: '三臂凿岩台车 #1', status: 'working', location: 'DK289+450', task: '上台阶钻孔' },
    { id: 7, name: '装载机 #2', status: 'idle', location: 'DK287+000', task: '待机' },
    { id: 8, name: '混凝土喷射机', status: 'working', location: 'DK287+800', task: '初喷支护' },
    { id: 9, name: '通风机 #1', status: 'working', location: 'DK278+200', task: '主通风运行' },
    { id: 10, name: '自卸车 #3', status: 'idle', location: 'DK289+300', task: '等待出渣' },
    { id: 14, name: '注浆机 #2', status: 'working', location: 'DK283+000', task: '围岩注浆' },
    { id: 15, name: '挖掘机 #1', status: 'working', location: 'DK289+450', task: '上台阶开挖' },
    { id: 16, name: '自卸车 #5', status: 'working', location: 'DK289+450', task: '运输出渣' },
];
const activeCount = computed(() => equipment.filter(e => e.status === 'working').length);
const statusCls = (s) => s === 'working' ? 'st-working' : 'st-idle';
const statusLabel = (s) => s === 'working' ? '作业中' : '待机';
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
    ...{ class: "dp-float" },
    ...{ style: ({ left: __VLS_ctx.pos.x + 'px', top: __VLS_ctx.pos.y + 'px' }) },
});
/** @type {__VLS_StyleScopedClasses['dp-float']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousedown: (__VLS_ctx.startDrag) },
    ...{ class: "dpf-header" },
});
/** @type {__VLS_StyleScopedClasses['dpf-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dpf-icon" },
});
/** @type {__VLS_StyleScopedClasses['dpf-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dpf-title" },
});
/** @type {__VLS_StyleScopedClasses['dpf-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "dpf-badge" },
});
/** @type {__VLS_StyleScopedClasses['dpf-badge']} */ ;
(__VLS_ctx.activeCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [pos, pos, startDrag, activeCount, emit,];
        } },
    ...{ class: "dpf-close" },
});
/** @type {__VLS_StyleScopedClasses['dpf-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dpf-body" },
});
/** @type {__VLS_StyleScopedClasses['dpf-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "resource-list" },
});
/** @type {__VLS_StyleScopedClasses['resource-list']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.equipment))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedItem = item.id;
                // @ts-ignore
                [equipment, selectedItem,];
            } },
        key: (item.id),
        ...{ class: "resource-item" },
        ...{ class: ({ selected: __VLS_ctx.selectedItem === item.id }) },
    });
    /** @type {__VLS_StyleScopedClasses['resource-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['selected']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ri-head" },
    });
    /** @type {__VLS_StyleScopedClasses['ri-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ri-name" },
    });
    /** @type {__VLS_StyleScopedClasses['ri-name']} */ ;
    (item.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ri-status" },
        ...{ class: (__VLS_ctx.statusCls(item.status)) },
    });
    /** @type {__VLS_StyleScopedClasses['ri-status']} */ ;
    (__VLS_ctx.statusLabel(item.status));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ri-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['ri-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ri-loc" },
    });
    /** @type {__VLS_StyleScopedClasses['ri-loc']} */ ;
    (item.location);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ri-task" },
    });
    /** @type {__VLS_StyleScopedClasses['ri-task']} */ ;
    (item.task);
    // @ts-ignore
    [selectedItem, statusCls, statusLabel,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
