<template>
  <div class="workface-panel" :class="{ collapsed: isCollapsed }">
    <!-- 折叠/展开按钮 -->
    <button class="panel-collapse-btn" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? '展开信息面板' : '收起信息面板'">
      <span>{{ isCollapsed ? '◀' : '▶' }}</span>
    </button>

    <transition name="panel-slide">
      <div v-show="!isCollapsed" class="panel-body">
        <!-- ① 当前掌子面状态卡 -->
        <div class="info-card workface-card">
          <div class="card-header">
            <span class="card-icon">⬡</span>
            <span class="card-title">当前掌子面</span>
            <span class="status-dot pulsing" :class="workfaceStatus.color"></span>
          </div>
          <div class="card-content">
            <div class="mileage-row">
              <span class="mileage-label">桩号</span>
              <span class="mileage-value">{{ workface.mileage }}</span>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">围岩等级</div>
                <div class="info-value rock-grade" :class="rockGradeClass">{{ workface.rockGrade }}</div>
              </div>
              <div class="info-item">
                <div class="info-label">循环进尺</div>
                <div class="info-value highlight">{{ workface.cycleAdvance }}<span class="unit">m</span></div>
              </div>
              <div class="info-item">
                <div class="info-label">开挖方式</div>
                <div class="info-value">{{ workface.excavationMethod }}</div>
              </div>
              <div class="info-item">
                <div class="info-label">断面面积</div>
                <div class="info-value">{{ workface.area }}<span class="unit">m²</span></div>
              </div>
            </div>
            <div class="procedure-row">
              <span class="procedure-label">当前工序</span>
              <span class="procedure-badge" :class="procedureClass">
                <span class="procedure-dot"></span>
                {{ workface.currentProcedure }}
              </span>
            </div>
          </div>
        </div>

        <!-- ② 风险预警卡 -->
        <div class="info-card alert-card" :class="{ 'has-alert': alerts.length > 0 }">
          <div class="card-header">
            <span class="card-icon alert-icon">⚠</span>
            <span class="card-title">风险预警</span>
            <span v-if="alerts.length > 0" class="alert-count">{{ alerts.length }}</span>
          </div>
          <div class="card-content">
            <div v-if="alerts.length === 0" class="no-alert">
              <span class="safe-icon">✓</span> 当前无活跃预警
            </div>
            <div v-for="alert in alerts" :key="alert.id" class="alert-item" :class="alert.level">
              <span class="alert-level-dot"></span>
              <div class="alert-text">
                <div class="alert-title">{{ alert.title }}</div>
                <div class="alert-desc">{{ alert.desc }}</div>
              </div>
            </div>
            <div class="tsp-conclusion">
              <span class="tsp-label">TSP结论</span>
              <span class="tsp-text">前方30m地质条件总体稳定，关注富水断裂</span>
            </div>
          </div>
        </div>

      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
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
  if (g.includes('V')) return 'grade-v';
  if (g.includes('IV')) return 'grade-iv';
  if (g.includes('III')) return 'grade-iii';
  return 'grade-ii';
});

const procedureClass = computed(() => {
  const p = workface.currentProcedure;
  if (p.includes('爆破')) return 'proc-blast';
  if (p.includes('出渣')) return 'proc-slag';
  if (p.includes('支护')) return 'proc-support';
  if (p.includes('钻孔')) return 'proc-drill';
  return 'proc-normal';
});

const alerts = [
  { id: 1, level: 'warn', title: '前方富水断裂带', desc: '前方约 25m，建议超前注浆' },
  { id: 2, level: 'info', title: '高地应力区段', desc: '本段 σ₁ ≈ 32 MPa，关注变形' },
];

</script>

<style scoped lang="scss">
.workface-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 260px;
  max-height: calc(100vh - 160px);
  z-index: 15;
  display: flex;
  flex-direction: row;
  gap: 0;
  transition: all 0.3s ease;

  &.collapsed {
    width: 36px;
  }
}

.panel-collapse-btn {
  flex-shrink: 0;
  width: 22px;
  align-self: flex-start;
  margin-top: 8px;
  background: rgba(0, 30, 60, 0.85);
  border: 1px solid rgba(0, 170, 255, 0.4);
  border-radius: 3px 0 0 3px;
  color: #00aaff;
  font-size: 11px;
  cursor: pointer;
  padding: 8px 0;
  line-height: 1;
  transition: background 0.2s;

  &:hover { background: rgba(0, 80, 160, 0.6); }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 160px);
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 170, 255, 0.4) transparent;

  &::-webkit-scrollbar { width: 3px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 170, 255, 0.4); }
}

// ── 信息卡片基础样式 ────────────────────────────────────
.info-card {
  background: rgba(0, 10, 24, 0.82);
  border: 1px solid rgba(0, 150, 255, 0.25);
  border-radius: 4px;
  backdrop-filter: blur(12px);
  overflow: hidden;
  transition: border-color 0.3s;

  &:hover { border-color: rgba(0, 200, 255, 0.45); }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(0, 60, 120, 0.35);
  border-bottom: 1px solid rgba(0, 150, 255, 0.15);
}

.card-icon {
  font-size: 14px;
  color: #00aaff;
}

.card-title {
  flex: 1;
  font-size: 12px;
  font-weight: bold;
  color: rgba(200, 240, 255, 0.9);
  letter-spacing: 1px;
}

.card-content {
  padding: 10px;
}

// ── 状态点 ──────────────────────────────────────────────
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.pulsing { animation: pulse-dot 1.5s ease-in-out infinite; }
  &.status-red { background: #ff4444; box-shadow: 0 0 6px #ff4444; }
  &.status-green { background: #44ff88; box-shadow: 0 0 6px #44ff88; }
  &.status-yellow { background: #ffcc00; box-shadow: 0 0 6px #ffcc00; }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

// ── 掌子面卡片 ──────────────────────────────────────────
.mileage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 150, 255, 0.1);
}

.mileage-label {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.6);
}

.mileage-value {
  font-size: 15px;
  font-weight: bold;
  color: #00eaff;
  font-family: 'Consolas', monospace;
  text-shadow: 0 0 8px rgba(0, 234, 255, 0.5);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}

.info-item {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 3px;
  padding: 5px 7px;
}

.info-label {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.5);
  margin-bottom: 2px;
}

.info-value {
  font-size: 13px;
  color: rgba(200, 240, 255, 0.9);
  font-weight: bold;

  .unit { font-size: 10px; color: rgba(180, 220, 255, 0.5); margin-left: 1px; }

  &.highlight { color: #00eaff; }

  &.rock-grade { font-size: 14px; }

  &.grade-v { color: #ff4444; }
  &.grade-iv { color: #ffaa00; }
  &.grade-iii { color: #ffdd44; }
  &.grade-ii { color: #44ff88; }
}

.procedure-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.procedure-label {
  font-size: 11px;
  color: rgba(180, 220, 255, 0.5);
}

.procedure-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: bold;

  .procedure-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: pulse-dot 1.2s ease-in-out infinite;
  }

  &.proc-blast { background: rgba(255, 60, 0, 0.2); color: #ff6633; border: 1px solid rgba(255, 60, 0, 0.4); .procedure-dot { background: #ff4400; } }
  &.proc-slag { background: rgba(255, 150, 0, 0.2); color: #ffaa44; border: 1px solid rgba(255, 150, 0, 0.4); .procedure-dot { background: #ffaa00; } }
  &.proc-support { background: rgba(0, 200, 100, 0.2); color: #44ff88; border: 1px solid rgba(0, 200, 100, 0.4); .procedure-dot { background: #44ff88; } }
  &.proc-drill { background: rgba(0, 150, 255, 0.2); color: #00aaff; border: 1px solid rgba(0, 150, 255, 0.4); .procedure-dot { background: #00aaff; } }
  &.proc-normal { background: rgba(100, 100, 100, 0.2); color: #aaa; border: 1px solid rgba(100, 100, 100, 0.3); .procedure-dot { background: #888; } }
}

// ── 预警卡 ────────────────────────────────────────────────
.alert-card {
  &.has-alert { border-color: rgba(255, 160, 0, 0.45); }
}

.alert-icon { color: #ffaa00; }

.alert-count {
  background: #ff4444;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 8px;
}

.no-alert {
  color: rgba(100, 200, 150, 0.8);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;

  .safe-icon { color: #44ff88; font-size: 14px; }
}

.alert-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &:last-of-type { border-bottom: none; }

  .alert-level-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }

  &.warn {
    .alert-level-dot { background: #ffaa00; box-shadow: 0 0 4px #ffaa00; }
    .alert-title { color: #ffcc44; }
  }
  &.danger {
    .alert-level-dot { background: #ff4444; box-shadow: 0 0 4px #ff4444; }
    .alert-title { color: #ff6666; }
  }
  &.info {
    .alert-level-dot { background: #00aaff; }
    .alert-title { color: #44aaff; }
  }
}

.alert-title { font-size: 12px; font-weight: bold; margin-bottom: 2px; }
.alert-desc { font-size: 11px; color: rgba(180, 220, 255, 0.55); }

.tsp-conclusion {
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(0, 60, 100, 0.3);
  border-radius: 3px;
  border-left: 2px solid rgba(0, 150, 255, 0.5);
}
.tsp-label { font-size: 10px; color: rgba(0, 200, 255, 0.7); margin-right: 4px; }
.tsp-text { font-size: 11px; color: rgba(180, 220, 255, 0.7); }

// ── 场景导航 ─────────────────────────────────────────────
.scene-nav-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 8px;
}

.scene-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 7px 2px;
  background: rgba(0, 40, 80, 0.4);
  border: 1px solid rgba(0, 150, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: rgba(0, 100, 200, 0.35);
    border-color: rgba(0, 200, 255, 0.5);
    transform: translateY(-1px);
  }

  &.active {
    background: rgba(0, 120, 220, 0.4);
    border-color: #00eaff;
    box-shadow: 0 0 8px rgba(0, 234, 255, 0.25);

    .scene-btn-label { color: #00eaff; }
  }
}

.scene-btn-icon { font-size: 16px; color: #00aaff; }
.scene-btn-label { font-size: 10px; color: rgba(200, 240, 255, 0.7); white-space: nowrap; }

.scene-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 4px;
  font-weight: bold;

  &.badge-warn { background: rgba(255, 150, 0, 0.3); color: #ffaa00; border: 1px solid rgba(255, 150, 0, 0.5); }
  &.badge-info { background: rgba(0, 150, 255, 0.3); color: #44aaff; border: 1px solid rgba(0, 150, 255, 0.5); }
}

// ── 今日摘要 ─────────────────────────────────────────────
.summary-metrics {
  display: flex;
  justify-content: space-around;
  padding: 6px 0;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.metric-value {
  font-size: 20px;
  font-weight: bold;
  font-family: 'Consolas', monospace;
  line-height: 1;

  .metric-unit { font-size: 11px; margin-left: 1px; }

  &.cyan { color: #00eaff; text-shadow: 0 0 8px rgba(0, 234, 255, 0.5); }
  &.orange { color: #ffaa00; text-shadow: 0 0 8px rgba(255, 170, 0, 0.4); }
  &.green { color: #44ff88; text-shadow: 0 0 8px rgba(68, 255, 136, 0.4); }
}

.metric-label {
  font-size: 10px;
  color: rgba(180, 220, 255, 0.5);
}

// ── 过渡动画 ─────────────────────────────────────────────
.panel-slide-enter-active,
.panel-slide-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.panel-slide-enter-from,
.panel-slide-leave-to { opacity: 0; transform: translateX(20px); }
</style>
