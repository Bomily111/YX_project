<!--
 * @Author: LNX222
 * @Date: 2025-07-01 15:41:00
 * @LastEditors: LNX222
 * @LastEditTime: 2025-07-01 15:41:00
 * @FilePath: Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Component\DBHComponents\Modules\DBHConclusionPanel.vue
-->

<template>
  <div class="legend-panel pkinfo-detail-panel">
    <div class="legend-panel-head">
      <span>详细信息</span>
    </div>
    <div class="legend-panel-scroll">
      <table class="pkinfo-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>钻孔位置</th>
            <th>外插角</th>
            <th>钻孔长度(m)</th>
            <th>钻进特征及地质情况简述</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in pkinfoList" :key="idx">
            <td>{{ idx + 1 }}</td>
            <td>{{ item.ZKWZ }}</td>
            <td>{{ item.WCJ }}</td>
            <td>{{ item.ZKCD }}</td>
            <td>{{ item.DZQKJS }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({ pkinfo: Array });
const pkinfoList = computed(() => props.pkinfo ?? []);
</script>

<style scoped>
.legend-panel {
  display: flex;
  position: relative;
  width: 100%;
  max-height: 550px;
  margin: 24px 0 0;
  border: 4px solid rgb(8 117 117);
  border-radius: 20px;
  flex-direction: column;
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  background: #09313a;
  box-shadow: 0 0 10px rgb(0 0 0 / 30%);
}

.pkinfo-detail-panel {
  /* 可自定义样式 */
}

.legend-panel-head {
  display: flex;
  margin-bottom: 8px;
  padding: 10px 18px 6px 22px;
  border-radius: 16px 16px 0 0;
  align-items: center;
  color: #fff;
  font-size: 20px;
  font-weight: bold;
  background: rgb(8 117 117);
}

.legend-panel-scroll {
  max-height: 550px;
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

.pkinfo-table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
}

.pkinfo-table th,
.pkinfo-table td {
  padding: 6px;
  border: 2px solid rgb(8 117 117);
  color: #fff;
  font-size: 15px;
  text-align: center;
  vertical-align: top;
  background: transparent;
}

.pkinfo-table th {
  color: #fff;
  font-weight: bold;
  background: transparent;
}
</style>
