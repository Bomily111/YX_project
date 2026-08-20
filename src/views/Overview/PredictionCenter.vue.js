import { ref, computed, watch, onMounted } from 'vue';
import ProcessTab from './PredictionCenter/ProcessTab.vue';
import MethodPreview from './PredictionCenter/MethodPreview.vue';
import { loadTemAnomalyGlb, deactivateGeoModel } from '@/utils/Common/GeoModelController';
import { loadTemVoxelCloud } from '@/utils/Common/TemVoxelCloud';
const props = defineProps();
const emit = defineEmits();
const selectedMethod = ref(null);
const activeVersion = ref('design');
const activeTab = ref('preview');
const refreshKey = ref(0);
const historyDatasets = ref([]);
const historyLoading = ref(false);
const designSegments = ref([]);
const designGradeColors = ref({});
const selectedDesignSegmentIndex = ref(null);
const versions = [
    { key: 'design', label: '设计版', icon: '▤' },
    { key: 'forecast', label: '超报版', icon: '⌁' },
];
const designFlow = ['读取勘察报告', '提取围岩分级表', '匹配里程区段', '生成分级模型'];
const rockGrades = [
    { level: 'Ⅱ', description: '完整—较完整', color: '#44ff88' },
    { level: 'Ⅲ', description: '较完整—较破碎', color: '#7dd3fc' },
    { level: 'Ⅳ', description: '较破碎', color: '#ffcc00' },
    { level: 'Ⅴ', description: '破碎—极破碎', color: '#ff6655' },
];
async function loadDesignSegments() {
    if (designSegments.value.length)
        return;
    try {
        const response = await fetch('/data/tunnel/design-rock-grades.json');
        if (!response.ok)
            return;
        const data = await response.json();
        designSegments.value = data.segments || [];
        designGradeColors.value = data.gradeColors || {};
    }
    catch {
        designSegments.value = [];
    }
}
function gradeColor(grade) {
    return designGradeColors.value[grade] || '#7dd3fc';
}
function romanGrade(grade) {
    return { II: 'Ⅱ', III: 'Ⅲ', IV: 'Ⅳ', V: 'Ⅴ' }[grade] || grade;
}
async function loadHistory() {
    historyLoading.value = true;
    try {
        const r = await fetch('/data/tem_output/index.json');
        if (r.ok)
            historyDatasets.value = await r.json();
    }
    catch {
        historyDatasets.value = [];
    }
    historyLoading.value = false;
}
const tabs = [
    { key: 'preview', label: '数据预览' },
    { key: 'process', label: '新建处理' },
    { key: 'history', label: '历史记录' },
];
const METHODS = [
    { key: 'face_sketch', label: '掌子面素描', icon: '⬡', category: '超前预报', dataStatus: 'pending' },
    { key: 'gpr', label: '地质雷达', icon: '≋', category: '超前预报', dataStatus: 'pending' },
    { key: 'horiz_drill', label: '超前水平钻', icon: '⊕', category: '超前预报', dataStatus: 'pending' },
    { key: 'deep_hole', label: '加深炮孔', icon: '⦿', category: '超前预报', dataStatus: 'pending' },
    { key: 'tsp', label: 'TSP反演', icon: '▦', category: '超前预报', dataStatus: 'pending' },
    { key: 'tem', label: '瞬变电磁', icon: '⚡', category: '超前预报', dataStatus: 'pending' },
    { key: 'weak_rock', label: '软弱围岩', icon: '◈', category: '不良地质', dataStatus: 'pending' },
    { key: 'high_stress', label: '高地应力', icon: '♨', category: '不良地质', dataStatus: 'pending' },
    { key: 'water_zone', label: '富水带', icon: '💧', category: '不良地质', dataStatus: 'pending' },
    { key: 'fracture_zone', label: '破碎带', icon: '▓', category: '不良地质', dataStatus: 'pending' },
];
const methodGroups = computed(() => {
    const groups = [];
    const seen = new Set();
    for (const m of METHODS) {
        if (!seen.has(m.category)) {
            seen.add(m.category);
            groups.push({ title: m.category, methods: METHODS.filter(x => x.category === m.category) });
        }
    }
    return groups;
});
function handleViewInScene(jobId) {
    if (selectedMethod.value?.key === 'tem') {
        const dir = jobId ? `data/tem_output/${jobId}` : 'data/tem_output/latest';
        deactivateGeoModel();
        loadTemAnomalyGlb(undefined, dir);
    }
    else if (selectedMethod.value) {
        emit('action', { key: selectedMethod.value.key, label: selectedMethod.value.label, icon: selectedMethod.value.icon }, 'view');
    }
}
function handleViewVoxelCloud(jobId) {
    const dir = jobId ? `data/tem_output/${jobId}` : 'data/tem_output/latest';
    deactivateGeoModel();
    loadTemVoxelCloud(dir);
}
function selectMethod(m) {
    selectedMethod.value = m;
    activeTab.value = 'preview';
}
function switchVersion(version) {
    activeVersion.value = version;
    selectedMethod.value = null;
    selectedDesignSegmentIndex.value = null;
    activeTab.value = 'preview';
    if (version === 'design')
        loadDesignSegments();
    emit('versionChange', version);
}
function viewDesignModel() {
    emit('versionChange', 'design');
}
function selectDesignSegment(segment) {
    selectedDesignSegmentIndex.value = segment.modelIndex;
    emit('segmentSelect', segment);
}
function onProcessComplete() {
    if (selectedMethod.value) {
        selectedMethod.value.dataStatus = 'available';
    }
    refreshKey.value++;
    loadHistory();
    activeTab.value = 'preview';
}
// 切换到历史 Tab 时加载
watch(activeTab, (tab) => {
    if (tab === 'history')
        loadHistory();
});
loadDesignSegments();
async function checkDataAvailability() {
    const checks = {
        face_sketch: '/data/tfs_new/tfs1/2322509.glb',
        gpr: '/data/gpr/gpr1/1665832_1.glb',
        horiz_drill: '/data/ahd/ahd1/2320835.glb',
        tsp: '/data/tsp_new/vs_3.json',
        tem: '/data/tem_output/index.json',
    };
    for (const m of METHODS) {
        const url = checks[m.key];
        if (!url)
            continue;
        try {
            const r = await fetch(url, { method: 'HEAD' });
            if (r.ok)
                m.dataStatus = 'available';
        }
        catch { /* no data, stays pending */ }
    }
}
onMounted(() => {
    checkDataAvailability();
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
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['pc-segment-row']} */ ;
/** @type {__VLS_StyleScopedClasses['pc-segment-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['pc-segment-row']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['pc-segment-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "panel-slide-right",
}));
const __VLS_2 = __VLS_1({
    name: "panel-slide-right",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.show) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pred-center-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['pred-center-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pc-header" },
    });
    /** @type {__VLS_StyleScopedClasses['pc-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pc-title-group" },
    });
    /** @type {__VLS_StyleScopedClasses['pc-title-group']} */ ;
    if (__VLS_ctx.activeVersion === 'forecast' && __VLS_ctx.selectedMethod) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.show))
                        return;
                    if (!(__VLS_ctx.activeVersion === 'forecast' && __VLS_ctx.selectedMethod))
                        return;
                    __VLS_ctx.selectedMethod = null;
                    // @ts-ignore
                    [show, activeVersion, selectedMethod, selectedMethod,];
                } },
            ...{ class: "pc-back-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-back-btn']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pc-title" },
    });
    /** @type {__VLS_StyleScopedClasses['pc-title']} */ ;
    (__VLS_ctx.selectedMethod ? __VLS_ctx.selectedMethod.label : '围岩分级模型');
    if (!__VLS_ctx.selectedMethod) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-subtitle" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-subtitle']} */ ;
        (__VLS_ctx.activeVersion === 'design' ? '勘察设计成果' : '超前预报动态成果');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.$emit('close');
                // @ts-ignore
                [activeVersion, selectedMethod, selectedMethod, selectedMethod, $emit,];
            } },
        ...{ class: "pc-close" },
        title: "关闭",
    });
    /** @type {__VLS_StyleScopedClasses['pc-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pc-version-switch" },
        role: "tablist",
        'aria-label': "围岩模型版本",
    });
    /** @type {__VLS_StyleScopedClasses['pc-version-switch']} */ ;
    for (const [version] of __VLS_vFor((__VLS_ctx.versions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.show))
                        return;
                    __VLS_ctx.switchVersion(version.key);
                    // @ts-ignore
                    [versions, switchVersion,];
                } },
            key: (version.key),
            ...{ class: "pc-version-btn" },
            ...{ class: ({ active: __VLS_ctx.activeVersion === version.key }) },
            role: "tab",
            'aria-selected': (__VLS_ctx.activeVersion === version.key),
        });
        /** @type {__VLS_StyleScopedClasses['pc-version-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-version-icon" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-version-icon']} */ ;
        (version.icon);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (version.label);
        // @ts-ignore
        [activeVersion, activeVersion,];
    }
    if (__VLS_ctx.activeVersion === 'design') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-body pc-design-body" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-body']} */ ;
        /** @type {__VLS_StyleScopedClasses['pc-design-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-version-intro" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-version-intro']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-intro-mark" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-intro-mark']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-intro-title" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-intro-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-intro-desc" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-intro-desc']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-design-section" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-design-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-gi" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-gi']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-source-card" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-source-row" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-source-label" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-source-value" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-value']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-source-row" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-source-label" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-source-value" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-value']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-source-row" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-source-label" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-source-value" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-source-value']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-design-section" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-design-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-gi" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-gi']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-flow" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-flow']} */ ;
        for (const [step, index] of __VLS_vFor((__VLS_ctx.designFlow))) {
            (step);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-flow-step" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-flow-step']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-flow-index" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-flow-index']} */ ;
            (index + 1);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (step);
            if (index < __VLS_ctx.designFlow.length - 1) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "pc-flow-arrow" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-flow-arrow']} */ ;
            }
            // @ts-ignore
            [activeVersion, designFlow, designFlow,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-design-section" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-design-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-gi" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-gi']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-grade-legend" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-grade-legend']} */ ;
        for (const [grade] of __VLS_vFor((__VLS_ctx.rockGrades))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (grade.level),
                ...{ class: "pc-grade-item" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-grade-item']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-grade-color" },
                ...{ style: ({ background: grade.color, boxShadow: `0 0 7px ${grade.color}` }) },
            });
            /** @type {__VLS_StyleScopedClasses['pc-grade-color']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-grade-level" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-grade-level']} */ ;
            (grade.level);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-grade-desc" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-grade-desc']} */ ;
            (grade.description);
            // @ts-ignore
            [rockGrades,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.viewDesignModel) },
            ...{ class: "pc-model-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-model-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-model-arrow" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-model-arrow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-design-section pc-segment-section" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-design-section']} */ ;
        /** @type {__VLS_StyleScopedClasses['pc-segment-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-section-title" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-section-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-gi" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-gi']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-section-count" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-section-count']} */ ;
        (__VLS_ctx.designSegments.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-segment-list" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-segment-list']} */ ;
        for (const [segment] of __VLS_vFor((__VLS_ctx.designSegments))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(__VLS_ctx.activeVersion === 'design'))
                            return;
                        __VLS_ctx.selectDesignSegment(segment);
                        // @ts-ignore
                        [viewDesignModel, designSegments, designSegments, selectDesignSegment,];
                    } },
                ...{ onKeydown: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(__VLS_ctx.activeVersion === 'design'))
                            return;
                        __VLS_ctx.selectDesignSegment(segment);
                        // @ts-ignore
                        [selectDesignSegment,];
                    } },
                key: (segment.modelIndex),
                ...{ class: "pc-segment-row" },
                ...{ class: ({ active: __VLS_ctx.selectedDesignSegmentIndex === segment.modelIndex }) },
                role: "button",
                tabindex: "0",
                'aria-label': (`跳转到${segment.startMileage}至${segment.endMileage}，${__VLS_ctx.romanGrade(segment.grade)}级围岩`),
            });
            /** @type {__VLS_StyleScopedClasses['pc-segment-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-grade-color" },
                ...{ style: ({ background: __VLS_ctx.gradeColor(segment.grade), boxShadow: `0 0 7px ${__VLS_ctx.gradeColor(segment.grade)}` }) },
            });
            /** @type {__VLS_StyleScopedClasses['pc-grade-color']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-segment-mileage" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-segment-mileage']} */ ;
            (segment.startMileage);
            (segment.endMileage);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-segment-grade" },
                ...{ style: ({ color: __VLS_ctx.gradeColor(segment.grade) }) },
            });
            /** @type {__VLS_StyleScopedClasses['pc-segment-grade']} */ ;
            (__VLS_ctx.romanGrade(segment.grade));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-segment-arrow" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-segment-arrow']} */ ;
            // @ts-ignore
            [selectedDesignSegmentIndex, romanGrade, romanGrade, gradeColor, gradeColor, gradeColor,];
        }
    }
    else if (!__VLS_ctx.selectedMethod) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-body" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-version-intro pc-forecast-intro" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-version-intro']} */ ;
        /** @type {__VLS_StyleScopedClasses['pc-forecast-intro']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pc-intro-mark forecast" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-intro-mark']} */ ;
        /** @type {__VLS_StyleScopedClasses['forecast']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-intro-title" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-intro-title']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-intro-desc" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-intro-desc']} */ ;
        for (const [group] of __VLS_vFor((__VLS_ctx.methodGroups))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (group.title),
                ...{ class: "pc-group" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-group']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-group-title" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-group-title']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pc-gi" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-gi']} */ ;
            (group.title);
            for (const [m] of __VLS_vFor((group.methods))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.show))
                                return;
                            if (!!(__VLS_ctx.activeVersion === 'design'))
                                return;
                            if (!(!__VLS_ctx.selectedMethod))
                                return;
                            __VLS_ctx.selectMethod(m);
                            // @ts-ignore
                            [selectedMethod, methodGroups, selectMethod,];
                        } },
                    key: (m.key),
                    ...{ class: "pc-card" },
                    ...{ class: ({ active: __VLS_ctx.activeAction === m.key }) },
                });
                /** @type {__VLS_StyleScopedClasses['pc-card']} */ ;
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "pc-card-icon" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-card-icon']} */ ;
                (m.icon);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pc-card-info" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-card-info']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pc-card-label" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-card-label']} */ ;
                (m.label);
                if (m.dataStatus === 'available') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "pc-card-dot" },
                    });
                    /** @type {__VLS_StyleScopedClasses['pc-card-dot']} */ ;
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "pc-card-arrow" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-card-arrow']} */ ;
                // @ts-ignore
                [activeAction,];
            }
            // @ts-ignore
            [];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-body" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-tabs" },
        });
        /** @type {__VLS_StyleScopedClasses['pc-tabs']} */ ;
        for (const [t] of __VLS_vFor((__VLS_ctx.tabs))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!!(__VLS_ctx.activeVersion === 'design'))
                            return;
                        if (!!(!__VLS_ctx.selectedMethod))
                            return;
                        __VLS_ctx.activeTab = t.key;
                        // @ts-ignore
                        [tabs, activeTab,];
                    } },
                key: (t.key),
                ...{ class: "pc-tab" },
                ...{ class: ({ active: __VLS_ctx.activeTab === t.key }) },
            });
            /** @type {__VLS_StyleScopedClasses['pc-tab']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            (t.label);
            // @ts-ignore
            [activeTab,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-tab-content" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'preview') }, null, null);
        /** @type {__VLS_StyleScopedClasses['pc-tab-content']} */ ;
        if (__VLS_ctx.selectedMethod.dataStatus === 'available' || __VLS_ctx.selectedMethod.key === 'tem') {
            const __VLS_6 = MethodPreview;
            // @ts-ignore
            const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
                ...{ 'onViewInScene': {} },
                ...{ 'onViewVoxelCloud': {} },
                key: (`${__VLS_ctx.selectedMethod.key}-${__VLS_ctx.refreshKey}`),
                method: (__VLS_ctx.selectedMethod),
                dataDir: (__VLS_ctx.selectedMethod.key === 'tem' ? '/data/tem_output/latest' : undefined),
            }));
            const __VLS_8 = __VLS_7({
                ...{ 'onViewInScene': {} },
                ...{ 'onViewVoxelCloud': {} },
                key: (`${__VLS_ctx.selectedMethod.key}-${__VLS_ctx.refreshKey}`),
                method: (__VLS_ctx.selectedMethod),
                dataDir: (__VLS_ctx.selectedMethod.key === 'tem' ? '/data/tem_output/latest' : undefined),
            }, ...__VLS_functionalComponentArgsRest(__VLS_7));
            let __VLS_11;
            const __VLS_12 = ({ viewInScene: {} },
                { onViewInScene: ((jobId) => __VLS_ctx.handleViewInScene(jobId)) });
            const __VLS_13 = ({ viewVoxelCloud: {} },
                { onViewVoxelCloud: ((jobId) => __VLS_ctx.handleViewVoxelCloud(jobId)) });
            var __VLS_9;
            var __VLS_10;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-preview-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-preview-empty']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-empty-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-empty-icon']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-empty-text" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-empty-text']} */ ;
            (__VLS_ctx.selectedMethod.label);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-empty-hint" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-empty-hint']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-tab-content" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'process') }, null, null);
        /** @type {__VLS_StyleScopedClasses['pc-tab-content']} */ ;
        const __VLS_14 = ProcessTab;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            ...{ 'onProcessComplete': {} },
            modelKey: (__VLS_ctx.selectedMethod.key),
            modelLabel: (__VLS_ctx.selectedMethod.label),
        }));
        const __VLS_16 = __VLS_15({
            ...{ 'onProcessComplete': {} },
            modelKey: (__VLS_ctx.selectedMethod.key),
            modelLabel: (__VLS_ctx.selectedMethod.label),
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        let __VLS_19;
        const __VLS_20 = ({ processComplete: {} },
            { onProcessComplete: (__VLS_ctx.onProcessComplete) });
        var __VLS_17;
        var __VLS_18;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pc-tab-content" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'history') }, null, null);
        /** @type {__VLS_StyleScopedClasses['pc-tab-content']} */ ;
        if (__VLS_ctx.historyLoading) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-history-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-history-empty']} */ ;
        }
        else if (__VLS_ctx.historyDatasets.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-history-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-history-empty']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-empty-icon" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-empty-icon']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-empty-text" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-empty-text']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "pc-history-list" },
            });
            /** @type {__VLS_StyleScopedClasses['pc-history-list']} */ ;
            for (const [ds] of __VLS_vFor((__VLS_ctx.historyDatasets))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (ds.jobId),
                    ...{ class: "pc-history-card" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-history-card']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pc-hist-main" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-hist-main']} */ ;
                (ds.xRange?.map((v) => v.toFixed(0)).join('~') || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "pc-hist-time" },
                });
                /** @type {__VLS_StyleScopedClasses['pc-hist-time']} */ ;
                (ds.createdAt ? ds.createdAt.slice(0, 16).replace('T', ' ') : '—');
                // @ts-ignore
                [selectedMethod, selectedMethod, selectedMethod, selectedMethod, selectedMethod, selectedMethod, selectedMethod, selectedMethod, activeTab, activeTab, activeTab, refreshKey, handleViewInScene, handleViewVoxelCloud, onProcessComplete, historyLoading, historyDatasets, historyDatasets,];
            }
        }
    }
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
