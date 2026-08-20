import { DTScopeEngine } from '@/utils/Common/Viewer';
import { loadMap } from '@/utils/Maps/MapSource';
import { ref, reactive, getCurrentInstance, onBeforeMount, onBeforeUnmount } from 'vue';
import { nextTick } from "vue";
// 3. 确保这个路径对应你刚才创建的文件
import { throttle, debounce } from "@/utils/Performance";
import Cesium, { ScreenSpaceEventHandler, ScreenSpaceEventType, defined, Cartographic } from 'cesium';
const ctx = getCurrentInstance();
const _this = ctx.appContext.config.globalProperties;
const cursorTypeStyle = ref('');
const isCustom = ref(false);
const lonlat = reactive({
    lon: '0.00',
    lat: '0.00',
});
onBeforeUnmount(() => {
    DTScopeEngine.destroy();
});
onBeforeMount(() => {
    nextTick(() => {
        DTScopeEngine.getInstance(_this);
        let viewer = DTScopeEngine.viewer;
        loadMap(viewer);
        let handler = new ScreenSpaceEventHandler(viewer.canvas);
        // 左键拖动样式
        handler.setInputAction((movement) => {
            cursorTypeStyle.value = 'panStyle';
        }, ScreenSpaceEventType.LEFT_DOWN);
        handler.setInputAction((movement) => {
            cursorTypeStyle.value = '';
        }, ScreenSpaceEventType.LEFT_UP);
        // 只在最后用户停止缩放的时候执行
        const wheelDebounce = debounce(() => {
            cursorTypeStyle.value = ''; // 恢复正常
        }, 300);
        // 更新界面的标签
        const positionThrottle = throttle((movement) => {
            const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
            if (defined(cartesian)) {
                const cartographic = Cartographic.fromCartesian(cartesian);
                const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(2);
                const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(2);
                lonlat.lat = latitudeString;
                lonlat.lon = longitudeString;
            }
        }, 300);
        handler.setInputAction((movement) => {
            cursorTypeStyle.value = 'zoomStyle';
            wheelDebounce();
        }, ScreenSpaceEventType.WHEEL);
        // 右键缩放样式
        handler.setInputAction((movement) => {
            let fixedPosition = movement.position;
            cursorTypeStyle.value = 'hiddenStyle';
            isCustom.value = true;
            let zoomCustomContainer = document.getElementsByClassName('customCursor')[0];
            zoomCustomContainer.style.left = fixedPosition.x + 'px';
            zoomCustomContainer.style.top = fixedPosition.y + 'px';
        }, ScreenSpaceEventType.RIGHT_DOWN);
        // 右键抬起恢复样式
        handler.setInputAction((movement) => {
            cursorTypeStyle.value = '';
            isCustom.value = false;
        }, ScreenSpaceEventType.RIGHT_UP);
        // 更新 DTGlobe下侧的鼠标位置信息
        handler.setInputAction((movement) => {
            positionThrottle(movement);
        }, ScreenSpaceEventType.MOUSE_MOVE);
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
    ...{ class: "cesiumdiv" },
});
/** @type {__VLS_StyleScopedClasses['cesiumdiv']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    id: "cesiumContainer",
    ...{ class: (__VLS_ctx.cursorTypeStyle) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "customCursor" },
    ...{ class: (__VLS_ctx.cursorTypeStyle) },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.isCustom) }, null, null);
/** @type {__VLS_StyleScopedClasses['customCursor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "position-container" },
});
/** @type {__VLS_StyleScopedClasses['position-container']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.lonlat.lon);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pos-sep" },
});
/** @type {__VLS_StyleScopedClasses['pos-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.lonlat.lat);
// @ts-ignore
[cursorTypeStyle, cursorTypeStyle, isCustom, lonlat, lonlat,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
