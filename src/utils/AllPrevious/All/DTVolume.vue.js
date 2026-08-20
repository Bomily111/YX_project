import { onMounted } from 'vue';
import { initVolume, updateColourmap } from './ShareVolume01.js';
import Previous from '../index.js';
onMounted(() => {
    initVolume();
});
function colourChanged(params) {
    Previous.SVData[2].read(params);
    updateColourmap();
}
function backgroundChanged(params) {
    Previous.SVData[2].editBackground(params);
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['toolbox']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    id: "volume-container",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    id: "hidden",
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.canvas)({
    id: "gradient",
    width: "2048",
    height: "1",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    id: "info",
    ...{ class: "toolbox" },
});
/** @type {__VLS_StyleScopedClasses['toolbox']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    id: "status",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    id: "colourmap",
    ...{ class: "toolbox" },
});
/** @type {__VLS_StyleScopedClasses['toolbox']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "toolclose" },
    onclick: "window.colourmaps.hide();",
});
/** @type {__VLS_StyleScopedClasses['toolclose']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.hr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onOnchange: (...[$event]) => {
            __VLS_ctx.colourChanged(__VLS_ctx.value);
            // @ts-ignore
            [colourChanged, value,];
        } },
    id: "colourmaps",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
    selected: true,
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "#000000;#ffffff",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "#ffffff;#000000",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "0.0=rgba(59,76,192,1.0);0.117647=rgba(95,127,232,1.0);0.235294=rgba(135,171,253,1.0);0.352941=rgba(176,203,252,1.0);0.5=rgba(220,220,220,1.0);0.529412=rgba(228,217,211,1.0);0.647059=rgba(246,191,165,1.0);0.764706=rgba(243,149,118,1.0);0.882353=rgba(221,94,75,1.0);1.0=rgba(181,11,39,1.0)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "0.0=rgba(0,0,0,1.0);0.5=rgba(255,0,0,1.0);0.75=rgba(255,127,0,1.0);1.000000=rgba(255,255,255,1.0)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "rgba(0,0,0,1.0);rgba(85,0,170,1.0);rgba(5,0,90,1.0);rgba(0,0,159,1.0);rgba(0,0,239,1.0);rgba(0,63,255,1.0);rgba(0,143,196,1.0);rgba(0,223,170,1.0);rgba(0,255,74,1.0);rgba(42,255,42,1.0);rgba(159,255,47,1.0);rgba(255,223,0,1.0);rgba(255,143,0,1.0);rgba(255,71,0,1.0);rgba(255,22,0,1.0);rgba(237,0,0,1.0);rgba(203,0,0,1.0);rgba(0,0,0,1.0)",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "#ff00ff;#0000ff;#00ffff;#00ff00;#ffff00;#ff0000",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.canvas, __VLS_intrinsics.canvas)({
    id: "palette",
    width: "512",
    height: "24",
    ...{ class: "palette checkerboard" },
});
/** @type {__VLS_StyleScopedClasses['palette']} */ ;
/** @type {__VLS_StyleScopedClasses['checkerboard']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    id: "backgroundBG",
    ...{ class: "colourbg checkerboard" },
});
/** @type {__VLS_StyleScopedClasses['colourbg']} */ ;
/** @type {__VLS_StyleScopedClasses['checkerboard']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    id: "backgroundCUR",
    ...{ class: "colour" },
    onmousedown: "backgroundChanged($('backgroundCUR'))",
});
/** @type {__VLS_StyleScopedClasses['colour']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
