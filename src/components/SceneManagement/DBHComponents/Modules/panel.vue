<!--
 * @Author: LNX222
 * @Date: 2025-06-30 18:06:00
 * @LastEditors: LNX222
 * @LastEditTime: 2025-06-30 18:06:00
 * @FilePath: Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\DBHComponents\Modules\panel.vue
-->

<template>
  <div>
    <div class="legend-panel">
      <div class="legend-panel-head">
        <span>加深炮孔属性</span>
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
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ row: Object });

const tableData = computed(() => [
  { label: '里程范围(起)', value: props.row?.value?.['施工里程'] ?? '' },
  { label: '里程范围(止)', value: formatEdkilo(props.row?.value?.fdinfo?.[0]?.edkilo, props.row?.value?.dkname) },
  { label: '长度(m)', value: props.row?.value?.length ?? '' },
  { label: '探测结论', value: props.row?.value?.conclusionyb ?? '' },
]);

function formatEdkilo(edkilo, dkname) {
  if (edkilo == null || !dkname) {
    return '';
  }
  const num = Number(edkilo);
  if (isNaN(num)) {
    return '';
  }
  const km = Math.floor(num / 1000);
  const m = (num - km * 1000).toFixed(2).padStart(6, '0');
  return `${dkname}${km}+${m}`;
}
</script>

<style scoped>
.legend-panel {
  display: flex;
  position: relative;
  width: 100%;
  max-height: 400px;
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
  max-height: 420px;
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
