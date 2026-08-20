import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { DTScopeEngine } from '@/utils/Common/Viewer';
import MileageSelect from '../DZLDComponents/Modules/MileageSelect_D.vue';
import Panel from './Modules/Panel.vue'; // 新增：引入Panel组件
// import store from './store/index' // 如有全局状态管理可打开
import AppConfig from '@/config/AppConfig';
//@ts-ignore
import * as Cesium from 'Cesium';
import AllLine from '../ZZMSMComponents/D3K278+100.000~DK300+800.000.json';
let { zzsmImage } = new AppConfig().appConfig;
let Points = ref([]);
let tunnel_options = reactive([]);
let tunnel_selected = ref('超前水平钻'); //里程选择默认加载
let showGraph = ref(false);
let selectedRow = ref(null); // 新增：保存当前选中的里程
let showPanel = ref(false); // 控制面板显示的变量
function changeTunnel(tunnel) {
    showGraph.value = false;
    tunnel_selected.value = tunnel;
    show(tunnel);
}
function handleSelectRow(row) {
    selectedRow.value = row;
    showPanel.value = true; // 选中行后显示面板
}
// 加载数据
function show(tunnel) {
    DTScopeEngine.getViewer(() => {
        // 设置请求参数
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'attribute',
                tunnelname: tunnel,
                // 里程范围可根据实际需求调整
                mileage_range: ['D3K278+100.00', 'D2K999+999.00'],
            }),
        };
        fetch(zzsmImage + '/geodata/acquire', requestOptions)
            .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
            .then((data) => {
            Points.value = data.data;
            // 如有属性统计、图表等，可在此处理
            // 例如：store.commit('SET_XXX', ...)
            // ...
            // 获取隧道列表
            fetch(zzsmImage + '/geodata/allCollention')
                .then((res) => {
                if (!res.ok) {
                    throw new Error('Network response was not ok');
                }
                return res.json();
            })
                .then((data) => {
                tunnel_options.length = 0;
                for (let i = 0; i < data.data.length; i++) {
                    tunnel_options.push({ label: data.data[i], value: data.data[i] });
                }
                showGraph.value = true;
            })
                .catch((error) => {
                console.error('There was a problem with the fetch operation:', error);
            });
        })
            .catch((error) => {
            console.error('There was a problem with the fetch operation:', error);
        });
    });
}
let allLineEntity = null;
function loadAllLine() {
    DTScopeEngine.getViewer(() => {
        const viewer = DTScopeEngine.viewer;
        const coordinates = AllLine.features[0].geometry.coordinates;
        // 转换为三维坐标（包含高程）
        const positions = coordinates.map((point) => Cesium.Cartesian3.fromDegrees(point[0], // 经度
        point[1], // 纬度
        point[2] // 高程（单位：米）
        ));
        // 移除旧实体（如果存在）
        if (allLineEntity) {
            viewer.entities.remove(allLineEntity);
        }
        // 创建三维折线实体
        allLineEntity = viewer.entities.add({
            polyline: {
                positions: positions,
                width: 5,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Cesium.Color.YELLOW.withAlpha(0.8),
                }),
                clampToGround: false, // 禁用贴地，启用三维空间显示
            },
        });
        // 自动缩放到线路范围
        viewer.zoomTo(allLineEntity);
    });
}
function deleteAllLine() {
    DTScopeEngine.getViewer(() => {
        const viewer = DTScopeEngine.viewer;
        viewer.entities.remove(allLineEntity);
    });
}
onMounted(() => {
    show(tunnel_selected.value);
});
onBeforeUnmount(() => {
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "left" },
});
/** @type {__VLS_StyleScopedClasses['left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "section" },
});
/** @type {__VLS_StyleScopedClasses['section']} */ ;
if (__VLS_ctx.showGraph) {
    const __VLS_0 = MileageSelect || MileageSelect;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onChangeTunnel': {} },
        ...{ 'onSelectRow': {} },
        Points: (__VLS_ctx.Points),
        tunnel_options: (__VLS_ctx.tunnel_options),
        tunnel_selected: (__VLS_ctx.tunnel_selected),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onChangeTunnel': {} },
        ...{ 'onSelectRow': {} },
        Points: (__VLS_ctx.Points),
        tunnel_options: (__VLS_ctx.tunnel_options),
        tunnel_selected: (__VLS_ctx.tunnel_selected),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ changeTunnel: {} },
        { onChangeTunnel: (__VLS_ctx.changeTunnel) });
    const __VLS_7 = ({ selectRow: {} },
        { onSelectRow: (__VLS_ctx.handleSelectRow) });
    var __VLS_3;
    var __VLS_4;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "section" },
});
/** @type {__VLS_StyleScopedClasses['section']} */ ;
if (__VLS_ctx.selectedRow) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "right-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['right-panel']} */ ;
    if (__VLS_ctx.showPanel) {
        const __VLS_8 = Panel;
        // @ts-ignore
        const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
            ...{ 'onClose': {} },
            row: (__VLS_ctx.selectedRow),
        }));
        const __VLS_10 = __VLS_9({
            ...{ 'onClose': {} },
            row: (__VLS_ctx.selectedRow),
        }, ...__VLS_functionalComponentArgsRest(__VLS_9));
        let __VLS_13;
        const __VLS_14 = ({ close: {} },
            { onClose: (...[$event]) => {
                    if (!(__VLS_ctx.selectedRow))
                        return;
                    if (!(__VLS_ctx.showPanel))
                        return;
                    __VLS_ctx.showPanel = false;
                    // @ts-ignore
                    [showGraph, Points, tunnel_options, tunnel_selected, changeTunnel, handleSelectRow, selectedRow, selectedRow, showPanel, showPanel,];
                } });
        var __VLS_11;
        var __VLS_12;
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
