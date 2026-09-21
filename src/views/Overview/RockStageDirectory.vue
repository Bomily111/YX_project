<template>
  <transition name="rock-directory-slide">
    <aside v-if="show" class="rock-stage-directory" aria-label="隧洞围岩目录">
      <button type="button" class="rsd-home rsd-home-link" @click="$emit('home')">
        <span>⌂</span>
        <strong>首页</strong>
      </button>
      <button type="button" class="rsd-context rsd-context-link" @click="$emit('worksite')"><span>◎</span> 工点概览</button>
      <header class="rsd-header">
        <span class="rsd-symbol">⬡</span>
        <span class="rsd-title">隧洞围岩</span>
        <span class="rsd-chevron">⌄</span>
      </header>

      <nav class="rsd-tree">
        <button
          v-for="(item, index) in stages"
          :key="item.key"
          type="button"
          class="rsd-node"
          :class="{ active: modelValue === item.key }"
          :aria-current="modelValue === item.key ? 'page' : undefined"
          @click="$emit('update:modelValue', item.key)"
        >
          <span class="rsd-branch" aria-hidden="true"></span>
          <span class="rsd-node-copy">
            <strong>{{ item.label }}</strong>
          </span>
          <span v-if="modelValue === item.key" class="rsd-current">当前</span>
        </button>
      </nav>
      <div class="rsd-module-divider"></div>
      <button
        v-for="module in otherModules"
        :key="module.key"
        type="button"
        class="rsd-module-link"
        @click="$emit('navigate', module.key)"
      >
        <span>{{ module.icon }}</span><strong>{{ module.label }}</strong><em>›</em>
      </button>
    </aside>
  </transition>
</template>

<script setup lang="ts">
type RockDirectoryNode = 'baseline' | 'prediction' | 'correction' | 'monitoring'

defineProps<{
  show: boolean
  modelValue: RockDirectoryNode
}>()

defineEmits<{
  'update:modelValue': [node: RockDirectoryNode]
  home: []
  worksite: []
  navigate: [module: PlatformModule]
}>()

type PlatformModule = 'workface' | 'blast' | 'support' | 'vent' | 'dispatch'
const otherModules: { key: PlatformModule; label: string; icon: string }[] = [
  { key: 'blast', label: '开挖爆破', icon: '✹' },
  { key: 'support', label: '围岩支护', icon: '◈' },
  { key: 'vent', label: '通风除尘', icon: '≋' },
  { key: 'dispatch', label: '装备调度', icon: '◎' },
]

const stages: { key: RockDirectoryNode; label: string; description: string }[] = [
  { key: 'baseline', label: '设计基准', description: '勘察设计资料与分级区段' },
  { key: 'prediction', label: '超前预测', description: '属性维度与超前地质预报' },
  { key: 'correction', label: '揭露校正', description: '掌子面揭露与模型修正' },
  { key: 'monitoring', label: '监测预警', description: '实时监测数据与风险预警' },
]

</script>

<style scoped lang="scss">
.rock-stage-directory {
  position: absolute;
  left: 0;
  top: 60px;
  bottom: 0;
  width: 216px;
  z-index: 18;
  color: #c7d5ea;
  background: rgba(2, 10, 22, 0.94);
  border-right: 1px solid rgba(0, 170, 255, 0.24);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  font-family: system-ui, "Microsoft YaHei", sans-serif;
}

.rsd-home,
.rsd-context,
.rsd-static-item {
  display: flex; align-items: center; gap: 11px;
  min-height: 44px; padding: 0 18px;
  color: #7892aa; font-size: 12px;
  border-bottom: 1px solid rgba(0, 150, 220, .07);
}
.rsd-home-link {
  width: 100%;
  font-family: inherit;
  text-align: left;
  border-top: 0;
  border-right: 0;
  border-left: 0;
  background: transparent;
  cursor: pointer;
  transition: .18s ease;
}
.rsd-home-link strong { flex: 1; color: #b9cee0; font-size: 12px; font-weight: 600; }
.rsd-home-link:hover { background: rgba(0, 170, 235, .08); }
.rsd-home-link:hover strong { color: #69dff2; }
.rsd-context-link { width:100%;font-family:inherit;text-align:left;border-top:0;border-right:0;border-left:0;background:transparent;cursor:pointer;transition:.18s ease; }
.rsd-context-link:hover { color:#c9edfa;background:rgba(0,170,235,.06); }
.rsd-section-link {
  width: 100%;
  font-family: inherit;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.rsd-section-link strong { flex: 1; color: inherit; font-size: 12px; font-weight: 500; }
.rsd-section-link em { color: #69dff2; font-size: 9px; font-style: normal; }
.rsd-section-link:hover { color: #c9edfa; background: rgba(0, 170, 235, .06); }
.rsd-section-link.active {
  color: #e6fbff;
  background: linear-gradient(90deg, rgba(0, 135, 230, .28), rgba(0, 105, 175, .1));
  box-shadow: inset 3px 0 0 #37dfff;
}
.rsd-home span,
.rsd-context span,
.rsd-static-item span { width: 18px; color: #4e85aa; text-align: center; }

.rsd-header {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 47px;
  padding: 0 15px;
  background: linear-gradient(90deg, rgba(0, 116, 218, .92), rgba(0, 174, 235, .72));
  border-top: 1px solid rgba(64, 207, 255, .38);
  border-bottom: 1px solid rgba(64, 207, 255, .35);
  box-shadow: inset 3px 0 0 #7de9ff, 0 0 14px rgba(0, 140, 255, .15);
}

.rsd-symbol {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  color: #e5fbff;
  font-size: 16px;
}

.rsd-title { flex: 1; color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 1px; }
.rsd-chevron { color: rgba(255,255,255,.8); font-size: 14px; }

.rsd-tree { padding: 5px 0 7px; background: rgba(0, 35, 67, .25); }

.rsd-node {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  width: 100%;
  min-height: 38px;
  padding: 0 14px 0 25px;
  color: #829bb4;
  text-align: left;
  font-family: inherit;
  border: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  transition: .18s ease;
}

.rsd-node:hover {
  color: #c9edfa;
  background: rgba(0, 170, 235, 0.06);
}

.rsd-node.active {
  color: #e6fbff;
  border-color: transparent;
  background: linear-gradient(90deg, rgba(0, 135, 230, .28), rgba(0, 105, 175, .1));
  box-shadow: inset 3px 0 0 #37dfff;
}

.rsd-branch { position: relative; width: 12px; height: 100%; }
.rsd-branch::before { content: ''; position: absolute; left: 4px; top: 0; bottom: 0; width: 1px; background: rgba(80, 155, 200, .24); }
.rsd-branch::after { content: ''; position: absolute; left: 4px; top: 50%; width: 8px; height: 1px; background: rgba(80, 155, 200, .35); }

.rsd-node-copy { min-width: 0; }
.rsd-node-copy strong { display: block; color: inherit; font-size: 12px; font-weight: 500; }
.rsd-node.active .rsd-node-copy strong { color: #dffaff; font-weight: 600; }
.rsd-current { color: #69dff2; font-size: 9px; }
.rsd-module-divider { height: 1px; margin: 8px 14px; background: rgba(0, 150, 220, .14); }
.rsd-module-link { display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;width:100%;min-height:43px;padding:0 16px;color:#7892aa;text-align:left;font-family:inherit;border:0;border-bottom:1px solid rgba(0,150,220,.07);background:transparent;cursor:pointer;transition:.18s ease; }
.rsd-module-link span{color:#4e85aa;text-align:center}.rsd-module-link strong{font-size:12px;font-weight:500}.rsd-module-link em{color:#456b87;font-size:16px;font-style:normal}.rsd-module-link:hover{color:#dffaff;background:rgba(0,170,235,.07)}.rsd-module-link:hover span,.rsd-module-link:hover em{color:#69dff2}

.rock-directory-slide-enter-active,
.rock-directory-slide-leave-active { transition: transform .28s ease, opacity .22s ease; }
.rock-directory-slide-enter-from,
.rock-directory-slide-leave-to { transform: translateX(-100%); opacity: 0; }
</style>
