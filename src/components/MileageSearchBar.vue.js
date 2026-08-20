import { ref, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import mileageData from '@/assets/data/centerline_mileage.json';
const entries = mileageData;
const query = ref('');
let markerEntity = null;
function computeHeading(entry) {
    const nextIdx = entry.index + 1;
    const next = nextIdx < entries.length ? entries[nextIdx] : entries[entry.index - 1];
    const pos = Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat, entry.alt);
    const lookAt = Cesium.Cartesian3.fromDegrees(next.lng, next.lat, next.alt);
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
    const invEnu = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());
    const dir = Cesium.Cartesian3.subtract(lookAt, pos, new Cesium.Cartesian3());
    const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, dir, new Cesium.Cartesian3());
    let heading = Math.atan2(localDir.x, localDir.y);
    if (nextIdx >= entries.length) {
        heading += Math.PI;
    }
    return heading;
}
function fetchSuggestions(qs, cb) {
    if (!qs || !qs.trim()) {
        cb([]);
        return;
    }
    const q = qs.trim().toUpperCase();
    const results = entries
        .filter(e => e.mileage.toUpperCase().includes(q))
        .slice(0, 20)
        .map(e => ({ value: e.mileage, entry: e }));
    cb(results);
}
function placeMarker(entry) {
    const viewer = DTScopeEngine.viewer;
    if (!viewer)
        return;
    if (markerEntity) {
        viewer.entities.remove(markerEntity);
        markerEntity = null;
    }
    markerEntity = viewer.entities.add({
        id: 'mileage-search-marker',
        position: Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat, entry.alt + 2),
        point: {
            pixelSize: 14,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.RED,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
            text: entry.mileage,
            font: 'bold 14px Microsoft YaHei',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
    });
    setTimeout(() => {
        const v = DTScopeEngine.viewer;
        if (v && markerEntity) {
            v.entities.remove(markerEntity);
            markerEntity = null;
        }
    }, 10000);
}
function handleSelect(item) {
    const viewer = DTScopeEngine.viewer;
    if (!viewer)
        return;
    const entry = item.entry;
    const H = Cesium.Math.toRadians(26.57);
    const P = Cesium.Math.toRadians(-11.57);
    const heightOffset = 32; // 参考相机距地面高度
    const horizDist = heightOffset / Math.tan(Math.abs(P)); // 水平距离 ≈ 156m
    // 标记点 ECEF
    const markerPos = Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat, entry.alt);
    // 相机在标记点后方（heading 反方向），水平距离 156m，高 32m
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(markerPos);
    const camLocal = new Cesium.Cartesian3(-Math.sin(H) * horizDist, -Math.cos(H) * horizDist, heightOffset);
    const camPos = Cesium.Matrix4.multiplyByPoint(enuMatrix, camLocal, new Cesium.Cartesian3());
    viewer.scene.camera.flyTo({
        destination: camPos,
        orientation: {
            heading: H,
            pitch: P,
            roll: 0,
        },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.QUINTIC_IN_OUT,
    });
    placeMarker(entry);
}
onBeforeUnmount(() => {
    const viewer = DTScopeEngine.viewer;
    if (viewer && markerEntity) {
        viewer.entities.remove(markerEntity);
        markerEntity = null;
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mileage-search-wrap" },
});
/** @type {__VLS_StyleScopedClasses['mileage-search-wrap']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.elAutocomplete | typeof __VLS_components.ElAutocomplete | typeof __VLS_components.elAutocomplete | typeof __VLS_components.ElAutocomplete} */
elAutocomplete;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onSelect': {} },
    modelValue: (__VLS_ctx.query),
    fetchSuggestions: (__VLS_ctx.fetchSuggestions),
    placeholder: "搜索里程 (如 YK3+200)",
    triggerOnFocus: (true),
    clearable: true,
    size: "small",
    popperClass: "mileage-popper",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onSelect': {} },
    modelValue: (__VLS_ctx.query),
    fetchSuggestions: (__VLS_ctx.fetchSuggestions),
    placeholder: "搜索里程 (如 YK3+200)",
    triggerOnFocus: (true),
    clearable: true,
    size: "small",
    popperClass: "mileage-popper",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ select: {} },
    { onSelect: (__VLS_ctx.handleSelect) });
const { default: __VLS_7 } = __VLS_3.slots;
{
    const { prefix: __VLS_8 } = __VLS_3.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "search-prefix" },
    });
    /** @type {__VLS_StyleScopedClasses['search-prefix']} */ ;
    // @ts-ignore
    [query, fetchSuggestions, handleSelect,];
}
// @ts-ignore
[];
var __VLS_3;
var __VLS_4;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
