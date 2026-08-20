import { ref, reactive, watch, computed } from 'vue';
const __VLS_emit = defineEmits();
const props = defineProps();
const datasets = ref([]);
const loading = ref(true);
const selected = ref(null);
const searchQuery = ref('');
const filteredDatasets = ref([]);
function doSearch() {
    const q = searchQuery.value.toLowerCase();
    filteredDatasets.value = q
        ? datasets.value.filter(ds => (ds.mileage || '').toLowerCase().includes(q))
        : datasets.value;
}
const baseUrl = computed(() => selected.value ? `${props.dataDir}/${selected.value.jobId}` : '');
const open = reactive({
    anomaly: false, denseCloud: false, depthSlices: false, fanContour: false, voxelCsv: false,
});
const anomalies = ref([]);
const contourImages = ref([]);
const zoomImage = ref(null);
async function loadIndex() {
    loading.value = true;
    try {
        const r = await fetch(`${props.dataDir}/index.json`);
        datasets.value = await r.json();
    }
    catch {
        datasets.value = [];
    }
    doSearch();
    loading.value = false;
}
async function loadDataset(ds) {
    const url = `${props.dataDir}/${ds.jobId}/meta.json`;
    try {
        const r = await fetch(url);
        const meta = await r.json();
        anomalies.value = meta.anomalies || [];
        const names = ['线1', '线2', '线3', '线4'];
        contourImages.value = names.map(n => ({
            name: `${n} (φ=${n === '线1' ? '+30' : n === '线2' ? '+15' : n === '线3' ? '0' : '-15'}°)`,
            url: `${props.dataDir}/${ds.jobId}/fan_contour_${n.replace('线', 'line')}.png`,
        }));
    }
    catch {
        anomalies.value = [];
        contourImages.value = [];
    }
}
async function deleteDataset(ds) {
    if (!confirm(`删除数据集 ${ds.createdAt?.slice(0, 16).replace('T', ' ') || ds.jobId}？`))
        return;
    try {
        await fetch(`/api/process/tem/${ds.jobId}`, { method: 'DELETE' });
        if (selected.value?.jobId === ds.jobId)
            selected.value = null;
        loadIndex();
    }
    catch (e) {
        console.warn('删除失败:', e);
    }
}
watch(() => props.dataDir, val => { if (val)
    loadIndex(); }, { immediate: true });
watch(selected, ds => { if (ds)
    loadDataset(ds); });
function kColor(k) {
    if (k < 570)
        return '#4488ff';
    if (k < 590)
        return '#44ccff';
    if (k < 610)
        return '#44dd66';
    return '#dd8800';
}
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
    ...{ class: "td-root" },
});
/** @type {__VLS_StyleScopedClasses['td-root']} */ ;
if (__VLS_ctx.selected) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selected))
                    return;
                __VLS_ctx.selected = null;
                // @ts-ignore
                [selected, selected,];
            } },
        ...{ class: "td-back" },
    });
    /** @type {__VLS_StyleScopedClasses['td-back']} */ ;
}
if (!__VLS_ctx.selected) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-toolbar" },
    });
    /** @type {__VLS_StyleScopedClasses['td-toolbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (__VLS_ctx.doSearch) },
        ...{ class: "td-search" },
        placeholder: "搜索里程段...",
    });
    (__VLS_ctx.searchQuery);
    /** @type {__VLS_StyleScopedClasses['td-search']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.loadIndex();
                // @ts-ignore
                [selected, doSearch, searchQuery, loadIndex,];
            } },
        ...{ class: "td-refresh" },
        title: "刷新",
    });
    /** @type {__VLS_StyleScopedClasses['td-refresh']} */ ;
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "td-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['td-empty']} */ ;
    }
    else if (__VLS_ctx.filteredDatasets.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "td-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['td-empty']} */ ;
        (__VLS_ctx.searchQuery ? '无匹配结果' : '暂无处理数据');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "td-list" },
        });
        /** @type {__VLS_StyleScopedClasses['td-list']} */ ;
        for (const [ds] of __VLS_vFor((__VLS_ctx.filteredDatasets))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.selected))
                            return;
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.filteredDatasets.length === 0))
                            return;
                        __VLS_ctx.selected = ds;
                        // @ts-ignore
                        [selected, searchQuery, loading, filteredDatasets, filteredDatasets,];
                    } },
                key: (ds.jobId),
                ...{ class: "td-card" },
            });
            /** @type {__VLS_StyleScopedClasses['td-card']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "td-card-top" },
            });
            /** @type {__VLS_StyleScopedClasses['td-card-top']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "td-card-mileage" },
            });
            /** @type {__VLS_StyleScopedClasses['td-card-mileage']} */ ;
            (ds.mileage || '前向 ' + (ds.xRange?.map((v) => v.toFixed(0)).join('~') || '—') + 'm');
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.selected))
                            return;
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.filteredDatasets.length === 0))
                            return;
                        __VLS_ctx.deleteDataset(ds);
                        // @ts-ignore
                        [deleteDataset,];
                    } },
                ...{ class: "td-card-del" },
            });
            /** @type {__VLS_StyleScopedClasses['td-card-del']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "td-card-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['td-card-meta']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (ds.createdAt ? ds.createdAt.slice(0, 16).replace('T', ' ') : '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "td-card-badge" },
            });
            /** @type {__VLS_StyleScopedClasses['td-card-badge']} */ ;
            (ds.anomalyCount);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "td-card-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['td-card-meta']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (ds.kMean?.toFixed(1) || '—');
            // @ts-ignore
            [];
        }
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-section" },
    });
    /** @type {__VLS_StyleScopedClasses['td-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.open.anomaly = !__VLS_ctx.open.anomaly;
                // @ts-ignore
                [open, open,];
            } },
        ...{ class: "td-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['td-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ rotate: __VLS_ctx.open.anomaly }) },
    });
    /** @type {__VLS_StyleScopedClasses['rotate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "td-badge" },
    });
    /** @type {__VLS_StyleScopedClasses['td-badge']} */ ;
    (__VLS_ctx.anomalies.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-body" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open.anomaly) }, null, null);
    /** @type {__VLS_StyleScopedClasses['td-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['td-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['td-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.$emit('viewInScene', __VLS_ctx.selected?.jobId);
                // @ts-ignore
                [selected, open, open, anomalies, $emit,];
            } },
        ...{ class: "td-view-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['td-view-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-section-divider" },
    });
    /** @type {__VLS_StyleScopedClasses['td-section-divider']} */ ;
    if (__VLS_ctx.anomalies.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "td-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['td-empty']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "td-anomaly-list" },
        });
        /** @type {__VLS_StyleScopedClasses['td-anomaly-list']} */ ;
        for (const [a] of __VLS_vFor((__VLS_ctx.anomalies))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (a.id),
                ...{ class: "td-anomaly-card" },
            });
            /** @type {__VLS_StyleScopedClasses['td-anomaly-card']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "td-anomaly-header" },
            });
            /** @type {__VLS_StyleScopedClasses['td-anomaly-header']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "td-anomaly-id" },
            });
            /** @type {__VLS_StyleScopedClasses['td-anomaly-id']} */ ;
            (a.id);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "td-anomaly-k" },
                ...{ style: ({ color: __VLS_ctx.kColor(a.k_mean) }) },
            });
            /** @type {__VLS_StyleScopedClasses['td-anomaly-k']} */ ;
            (a.k_mean.toFixed(1));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "td-anomaly-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['td-anomaly-meta']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (a.voxels);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (a.cx.toFixed(1));
            (a.cy.toFixed(1));
            (a.cz.toFixed(1));
            // @ts-ignore
            [anomalies, anomalies, kColor,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-section" },
    });
    /** @type {__VLS_StyleScopedClasses['td-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.open.denseCloud = !__VLS_ctx.open.denseCloud;
                // @ts-ignore
                [open, open,];
            } },
        ...{ class: "td-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['td-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ rotate: __VLS_ctx.open.denseCloud }) },
    });
    /** @type {__VLS_StyleScopedClasses['rotate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-body" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open.denseCloud) }, null, null);
    /** @type {__VLS_StyleScopedClasses['td-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.zoomImage = `${__VLS_ctx.baseUrl}/fig3d_1_dense_cloud.png`;
                // @ts-ignore
                [open, open, zoomImage, baseUrl,];
            } },
        src: (`${__VLS_ctx.baseUrl}/fig3d_1_dense_cloud.png`),
        ...{ class: "td-full-img" },
    });
    /** @type {__VLS_StyleScopedClasses['td-full-img']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-section" },
    });
    /** @type {__VLS_StyleScopedClasses['td-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.open.depthSlices = !__VLS_ctx.open.depthSlices;
                // @ts-ignore
                [open, open, baseUrl,];
            } },
        ...{ class: "td-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['td-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ rotate: __VLS_ctx.open.depthSlices }) },
    });
    /** @type {__VLS_StyleScopedClasses['rotate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-body" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open.depthSlices) }, null, null);
    /** @type {__VLS_StyleScopedClasses['td-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.zoomImage = `${__VLS_ctx.baseUrl}/fig3d_3_depth_slices.png`;
                // @ts-ignore
                [open, open, zoomImage, baseUrl,];
            } },
        src: (`${__VLS_ctx.baseUrl}/fig3d_3_depth_slices.png`),
        ...{ class: "td-full-img" },
    });
    /** @type {__VLS_StyleScopedClasses['td-full-img']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-section" },
    });
    /** @type {__VLS_StyleScopedClasses['td-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.open.fanContour = !__VLS_ctx.open.fanContour;
                // @ts-ignore
                [open, open, baseUrl,];
            } },
        ...{ class: "td-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['td-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ rotate: __VLS_ctx.open.fanContour }) },
    });
    /** @type {__VLS_StyleScopedClasses['rotate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "td-badge" },
    });
    /** @type {__VLS_StyleScopedClasses['td-badge']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-body" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open.fanContour) }, null, null);
    /** @type {__VLS_StyleScopedClasses['td-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-gallery" },
    });
    /** @type {__VLS_StyleScopedClasses['td-gallery']} */ ;
    for (const [img] of __VLS_vFor((__VLS_ctx.contourImages))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.selected))
                        return;
                    __VLS_ctx.zoomImage = img.url;
                    // @ts-ignore
                    [open, open, zoomImage, contourImages,];
                } },
            key: (img.name),
            ...{ class: "td-thumb" },
        });
        /** @type {__VLS_StyleScopedClasses['td-thumb']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            src: (img.url),
            alt: (img.name),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "td-thumb-label" },
        });
        /** @type {__VLS_StyleScopedClasses['td-thumb-label']} */ ;
        (img.name);
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-section" },
    });
    /** @type {__VLS_StyleScopedClasses['td-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.open.voxelCsv = !__VLS_ctx.open.voxelCsv;
                // @ts-ignore
                [open, open,];
            } },
        ...{ class: "td-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['td-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: ({ rotate: __VLS_ctx.open.voxelCsv }) },
    });
    /** @type {__VLS_StyleScopedClasses['rotate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-body" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.open.voxelCsv) }, null, null);
    /** @type {__VLS_StyleScopedClasses['td-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "td-kv" },
    });
    /** @type {__VLS_StyleScopedClasses['td-kv']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selected))
                    return;
                __VLS_ctx.$emit('viewVoxelCloud', __VLS_ctx.selected?.jobId);
                // @ts-ignore
                [selected, open, open, $emit,];
            } },
        ...{ class: "td-view-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['td-view-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.zoomImage) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.zoomImage))
                    return;
                __VLS_ctx.zoomImage = null;
                // @ts-ignore
                [zoomImage, zoomImage,];
            } },
        ...{ class: "td-modal" },
    });
    /** @type {__VLS_StyleScopedClasses['td-modal']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ onClick: () => { } },
        src: (__VLS_ctx.zoomImage),
        ...{ class: "td-modal-img" },
    });
    /** @type {__VLS_StyleScopedClasses['td-modal-img']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.zoomImage))
                    return;
                __VLS_ctx.zoomImage = null;
                // @ts-ignore
                [zoomImage, zoomImage,];
            } },
        ...{ class: "td-modal-close" },
    });
    /** @type {__VLS_StyleScopedClasses['td-modal-close']} */ ;
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
