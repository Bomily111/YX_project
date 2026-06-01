<!--
 * @Author: LNX222
 * @Date: 2025-07-01 14:54:00
 * @LastEditors: LNX222
 * @LastEditTime: 2025-07-01 14:54:00
 * @FilePath: Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\TSPComponents\Modules\TSPConclusionPanel.vue
-->

<template>
  <div class="legend-panel tsp-conclusion-panel">
    <div class="legend-panel-head">
      <span>结论</span>
    </div>
    <div class="legend-panel-scroll">
      <table class="tsp-conclusion-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>里程范围</th>
            <th>探测结论</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in fdinfoList" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>
              起:{{ formatEdkilo(item.sdkilo, dkname) }}<br />
              止:{{ formatEdkilo(item.edkilo, dkname) }}
            </td>
            <td>{{ item.jlresult }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({ fdinfo: Array, dkname: String });

const fdinfoList = computed(() => props.fdinfo ?? []);

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
  max-height: 270px;
  margin: 24px 0 0;
  border: 4px solid rgb(8 117 117);
  border-radius: 20px;
  flex-direction: column;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  background: #09313a;
  box-shadow: 0 0 10px rgb(0 0 0 / 30%);
}

.tsp-conclusion-panel {
  /* no margin-left */
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

/* .legend-close {
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
} */

.legend-panel-scroll {
  max-height: 300px;
  margin-bottom: 0;
  padding: 0 10px 10px;
  overflow-y: auto;
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

.tsp-conclusion-table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
}

.tsp-conclusion-table th,
.tsp-conclusion-table td {
  padding: 2px 6px;
  border: 2px solid rgb(8 117 117);
  color: #fff;
  font-size: 15px;
  text-align: center;
  vertical-align: top;
  background: transparent;
}

.tsp-conclusion-table th {
  color: #fff;
  font-weight: bold;
  background: transparent;
}
</style>
