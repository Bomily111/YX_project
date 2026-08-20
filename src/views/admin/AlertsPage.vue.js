import { ref, onMounted } from 'vue';
import { alertsApi } from '@/services/api/client';
const list = ref([]);
const loading = ref(true);
const activeOnly = ref(true);
async function load() {
    loading.value = true;
    list.value = await alertsApi.list(activeOnly.value);
    loading.value = false;
}
async function ack(id) { await alertsApi.acknowledge(id); load(); }
async function resolve(id) {
    const note = prompt('解决备注（可选）:') || '';
    await alertsApi.resolve(id, note);
    load();
}
function formatTime(t) { return new Date(t).toLocaleString('zh-CN'); }
onMounted(load);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['data-table']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['resolve']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page" },
});
/** @type {__VLS_StyleScopedClasses['page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-header" },
});
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "filter" },
});
/** @type {__VLS_StyleScopedClasses['filter']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.load) },
    type: "checkbox",
});
(__VLS_ctx.activeOnly);
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
}
else if (__VLS_ctx.list.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "data-table" },
    });
    /** @type {__VLS_StyleScopedClasses['data-table']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [a] of __VLS_vFor((__VLS_ctx.list))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (a.id),
            ...{ class: ({ resolved: !a.is_active }) },
        });
        /** @type {__VLS_StyleScopedClasses['resolved']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "level-tag" },
            ...{ class: ('lvl-' + a.level) },
        });
        /** @type {__VLS_StyleScopedClasses['level-tag']} */ ;
        (a.level);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (a.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (a.entity_type);
        (a.entity_id?.slice(0, 8));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (a.dk_number ? 'DK' + (a.dk_number / 1000).toFixed(3).replace('.', '+') : '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (__VLS_ctx.formatTime(a.created_at));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: (a.is_active ? 'status-live' : 'status-done') },
        });
        (a.is_active ? '活跃' : '已解决');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (a.is_active && !a.acknowledged_at) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!(__VLS_ctx.list.length))
                            return;
                        if (!(a.is_active && !a.acknowledged_at))
                            return;
                        __VLS_ctx.ack(a.id);
                        // @ts-ignore
                        [load, activeOnly, loading, list, list, formatTime, ack,];
                    } },
                ...{ class: "btn-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        }
        if (a.is_active) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!(__VLS_ctx.list.length))
                            return;
                        if (!(a.is_active))
                            return;
                        __VLS_ctx.resolve(a.id);
                        // @ts-ignore
                        [resolve,];
                    } },
                ...{ class: "btn-sm resolve" },
            });
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['resolve']} */ ;
        }
        // @ts-ignore
        [];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "empty" },
    });
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
