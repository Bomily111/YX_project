<!--
 * @Author: LNX222
 * @Date: 2025-06-30 15:04:00
 * @LastEditors: LNX222
 * @LastEditTime: 2025-06-30 15:04:00
 * @FilePath: Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\ADHComponents\Modules\panel.vue
-->

<template>
  <div class="legend-panel">
    <div class="legend-panel-head">
      <span>掌子面素描</span>
      <button class="legend-close" @click="$emit('close')">
        <span class="legend-close-x">&times;</span>
      </button>
    </div>
    <div class="legend-panel-scroll">
      <table>
        <thead>
          <tr>
            <th class="legend-th">属性名</th>
            <th class="legend-th">属性值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in tableData" :key="item.label">
            <td class="legend-label">{{ item.label }}</td>
            <td class="legend-value">{{ item.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({ row: Object });
const field = [
  { label: '开挖宽度', key: 'dzsm_kwkd' },
  { label: '开挖高度', key: 'dzsm_kwgd' },
  { label: '开挖面积', key: 'dzsm_kwmj' },
  { label: '掌子面状态', key: 'dzsm_zzmzt' },
  { label: '地质构造应力状态', key: 'dzgzyl' },
  { label: '探测结论', key: 'dzsm_zzmms' },
];
console.log('props.row', props.row);
const tableData = computed(() => {
  const attr = props.row?.value ?? {};
  return field.map(({ label, key }) => ({
    label,
    value: attr[key] ?? '无',
  }));
});

function formatEdkilo(edkilo, dkname) {
  if (edkilo == null || !dkname) {
    return '';
  }
  const num = Number(edkilo);
  if (isNaN(num)) {
    return '';
  }
  const km = Math.floor(num / 1000);
  const m = (num - km * 1000).toFixed(2).padStart(6, '0'); // 保留两位小数，自动补零
  return `${dkname}${km}+${m}`;
}
</script>

<style scoped>
.legend-panel {
  display: flex;
  position: relative;
  right: -25px;
  width: 100%;
  padding: 0 0 10px;
  border: 4px solid rgb(8 117 117);
  border-radius: 20px;
  overflow: hidden;
  flex-direction: column;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  background: #09313a;
  box-shadow: 0 0 10px rgb(0 0 0 / 30%);
}

.legend-panel-head {
  display: flex;
  margin-bottom: 8px;
  padding: 10px 18px 6px 22px;
  border-bottom: none;
  border-radius: 16px 16px 0 0;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  font-size: 20px;
  font-weight: bold;
  background: rgb(8 117 117);
}

.legend-close {
  display: flex;
  width: 20px;
  height: 20px;
  margin-left: 8px;
  padding: 0;
  border: none;
  border-radius: 20px;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  background: transparent;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgb(9 21 35);
}

.legend-close-x {
  display: block;
  width: 16px;
  height: 16px;
  line-height: 1;
  color: #fff;
  font-size: 20px;
  text-align: center;
}

.legend-panel-scroll {
  flex: 1;
  max-height: 550px;
  padding: 0 10px;
  overflow-y: auto;
}

.legend-panel-scroll table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
}

.legend-panel-scroll th,
.legend-panel-scroll td {
  padding: 8px 6px;
  border: 2px solid rgb(8 117 117);
  font-size: 15px;
}

.legend-th {
  padding: 8px 6px;
  color: #fff;
  font-weight: bold;
  background: transparent;
}

.legend-panel-scroll td {
  color: #fff;
  word-break: break-all;
  vertical-align: top;
  background: transparent;
}

.legend-label {
  width: 130px;
}

.legend-value {
  width: 240px;
}

.legend-panel-scroll tr {
  background: transparent;
}

.legend-panel-scroll::-webkit-scrollbar {
  width: 8px;
}

.legend-panel-scroll::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgb(8 117 117);
}

.legend-panel-scroll::-webkit-scrollbar-track {
  background: transparent;
}
</style>
