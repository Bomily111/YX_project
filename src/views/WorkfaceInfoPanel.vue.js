import { ref, computed } from 'vue';
// ── 状态 ──────────────────────────────────────────────────
const isCollapsed = ref(false);
// ── 模拟数据 ─────────────────────────────────────────────
const workface = {
    mileage: 'DK289+450',
    rockGrade: 'IV级',
    cycleAdvance: 3.5,
    excavationMethod: '三台阶法',
    area: '76.5',
    currentProcedure: '爆破作业中',
};
const workfaceStatus = { color: 'status-red' };
const rockGradeClass = computed(() => {
    const g = workface.rockGrade;
    if (g.includes('V'))
        return 'grade-v';
    if (g.includes('IV'))
        return 'grade-iv';
    if (g.includes('III'))
        return 'grade-iii';
    return 'grade-ii';
});
const procedureClass = computed(() => {
    const p = workface.currentProcedure;
    if (p.includes('爆破'))
        return 'proc-blast';
    if (p.includes('出渣'))
        return 'proc-slag';
    if (p.includes('支护'))
        return 'proc-support';
    if (p.includes('钻孔'))
        return 'proc-drill';
    return 'proc-normal';
});
const alerts = [
    { id: 1, level: 'warn', title: '前方富水断裂带', desc: '前方约 25m，建议超前注浆' },
    { id: 2, level: 'info', title: '高地应力区段', desc: '本段 σ₁ ≈ 32 MPa，关注变形' },
];
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['procedure-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['procedure-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['procedure-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['procedure-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['procedure-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-level-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-level-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-title']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-level-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-title']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-title']} */ ;
/** @type {__VLS_StyleScopedClasses['scene-btn-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "workface-panel" },
    ...{ class: ({ collapsed: __VLS_ctx.isCollapsed }) },
});
/** @type {__VLS_StyleScopedClasses['workface-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.isCollapsed = !__VLS_ctx.isCollapsed;
            // @ts-ignore
            [isCollapsed, isCollapsed, isCollapsed,];
        } },
    ...{ class: "panel-collapse-btn" },
    title: (__VLS_ctx.isCollapsed ? '展开信息面板' : '收起信息面板'),
});
/** @type {__VLS_StyleScopedClasses['panel-collapse-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.isCollapsed ? '◀' : '▶');
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.transition | typeof __VLS_components.Transition | typeof __VLS_components.transition | typeof __VLS_components.Transition} */
transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: "panel-slide",
}));
const __VLS_2 = __VLS_1({
    name: "panel-slide",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "panel-body" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.isCollapsed) }, null, null);
/** @type {__VLS_StyleScopedClasses['panel-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-card workface-card" },
});
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['workface-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-header" },
});
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "card-icon" },
});
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "card-title" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "status-dot pulsing" },
    ...{ class: (__VLS_ctx.workfaceStatus.color) },
});
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['pulsing']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-content" },
});
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mileage-row" },
});
/** @type {__VLS_StyleScopedClasses['mileage-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mileage-label" },
});
/** @type {__VLS_StyleScopedClasses['mileage-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "mileage-value" },
});
/** @type {__VLS_StyleScopedClasses['mileage-value']} */ ;
(__VLS_ctx.workface.mileage);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-grid" },
});
/** @type {__VLS_StyleScopedClasses['info-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-item" },
});
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-value rock-grade" },
    ...{ class: (__VLS_ctx.rockGradeClass) },
});
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['rock-grade']} */ ;
(__VLS_ctx.workface.rockGrade);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-item" },
});
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-value highlight" },
});
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
/** @type {__VLS_StyleScopedClasses['highlight']} */ ;
(__VLS_ctx.workface.cycleAdvance);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "unit" },
});
/** @type {__VLS_StyleScopedClasses['unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-item" },
});
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-value" },
});
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
(__VLS_ctx.workface.excavationMethod);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-item" },
});
/** @type {__VLS_StyleScopedClasses['info-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-label" },
});
/** @type {__VLS_StyleScopedClasses['info-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-value" },
});
/** @type {__VLS_StyleScopedClasses['info-value']} */ ;
(__VLS_ctx.workface.area);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "unit" },
});
/** @type {__VLS_StyleScopedClasses['unit']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "procedure-row" },
});
/** @type {__VLS_StyleScopedClasses['procedure-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "procedure-label" },
});
/** @type {__VLS_StyleScopedClasses['procedure-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "procedure-badge" },
    ...{ class: (__VLS_ctx.procedureClass) },
});
/** @type {__VLS_StyleScopedClasses['procedure-badge']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "procedure-dot" },
});
/** @type {__VLS_StyleScopedClasses['procedure-dot']} */ ;
(__VLS_ctx.workface.currentProcedure);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "info-card alert-card" },
    ...{ class: ({ 'has-alert': __VLS_ctx.alerts.length > 0 }) },
});
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-card']} */ ;
/** @type {__VLS_StyleScopedClasses['has-alert']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-header" },
});
/** @type {__VLS_StyleScopedClasses['card-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "card-icon alert-icon" },
});
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "card-title" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
if (__VLS_ctx.alerts.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "alert-count" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-count']} */ ;
    (__VLS_ctx.alerts.length);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-content" },
});
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
if (__VLS_ctx.alerts.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "no-alert" },
    });
    /** @type {__VLS_StyleScopedClasses['no-alert']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "safe-icon" },
    });
    /** @type {__VLS_StyleScopedClasses['safe-icon']} */ ;
}
for (const [alert] of __VLS_vFor((__VLS_ctx.alerts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (alert.id),
        ...{ class: "alert-item" },
        ...{ class: (alert.level) },
    });
    /** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "alert-level-dot" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-level-dot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-text" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-title" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-title']} */ ;
    (alert.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert-desc" },
    });
    /** @type {__VLS_StyleScopedClasses['alert-desc']} */ ;
    (alert.desc);
    // @ts-ignore
    [isCollapsed, isCollapsed, isCollapsed, workfaceStatus, workface, workface, workface, workface, workface, workface, rockGradeClass, procedureClass, alerts, alerts, alerts, alerts, alerts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tsp-conclusion" },
});
/** @type {__VLS_StyleScopedClasses['tsp-conclusion']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tsp-label" },
});
/** @type {__VLS_StyleScopedClasses['tsp-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tsp-text" },
});
/** @type {__VLS_StyleScopedClasses['tsp-text']} */ ;
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
