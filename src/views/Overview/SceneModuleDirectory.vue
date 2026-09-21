<template>
  <transition name="module-directory-slide">
    <aside v-if="show" class="module-directory" :aria-label="`${sceneName}目录`">
      <button type="button" class="directory-row home-row" @click="$emit('home')">
        <span class="row-icon">⌂</span><strong>首页</strong>
      </button>
      <button type="button" class="directory-row context-row" @click="$emit('worksite')"><span class="row-icon">◎</span>工点概览</button>

      <template v-for="module in modules" :key="module.key">
        <template v-if="module.key === sceneKey">
          <header class="directory-header">
            <span class="header-icon">{{ module.icon }}</span>
            <span>{{ module.label }}</span>
            <span class="header-arrow">⌄</span>
          </header>
          <nav class="directory-tree">
            <button
              v-for="item in items"
              :key="item.key"
              type="button"
              class="directory-node"
              :class="{ active: modelValue === item.key }"
              :aria-current="modelValue === item.key ? 'page' : undefined"
              @click="$emit('update:modelValue', item.key)"
            >
              <span class="branch" aria-hidden="true"></span>
              <strong>{{ item.label }}</strong>
              <em v-if="modelValue === item.key">当前</em>
            </button>
          </nav>
        </template>
        <button v-else type="button" class="module-link" @click="$emit('navigate', module.key)">
          <span>{{ module.icon }}</span><strong>{{ module.label }}</strong><em>›</em>
        </button>
      </template>
    </aside>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type SceneModuleSection = 'functions' | 'monitoring'

const props = defineProps<{
  show: boolean
  sceneKey: 'support' | 'dispatch'
  modelValue: SceneModuleSection
}>()

defineEmits<{
  home: []
  worksite: []
  'update:modelValue': [section: SceneModuleSection]
  navigate: [module: PlatformModule]
}>()

const sceneMeta = computed(() => props.sceneKey === 'support'
  ? { name: '围岩支护', icon: '◈' }
  : { name: '装备调度', icon: '◎' })
const sceneName = computed(() => sceneMeta.value.name)
const sceneIcon = computed(() => sceneMeta.value.icon)
const items: { key: SceneModuleSection; label: string }[] = [
  { key: 'functions', label: '功能中心' },
  { key: 'monitoring', label: '监测数据' },
]
type PlatformModule = 'workface' | 'blast' | 'support' | 'vent' | 'dispatch'
const modules: { key: PlatformModule; label: string; icon: string }[] = [
  { key: 'workface', label: '隧洞围岩', icon: '⬡' },
  { key: 'blast', label: '开挖爆破', icon: '✹' },
  { key: 'support', label: '围岩支护', icon: '◈' },
  { key: 'vent', label: '通风除尘', icon: '≋' },
  { key: 'dispatch', label: '装备调度', icon: '◎' },
]
</script>

<style scoped lang="scss">
.module-directory {
  position: absolute; inset: 60px auto 0 0; z-index: 18; width: 216px;
  color: #c7d5ea; background: rgba(2, 10, 22, .94);
  border-right: 1px solid rgba(0, 170, 255, .24);
  box-shadow: 4px 0 24px rgba(0, 0, 0, .5); backdrop-filter: blur(16px);
  font-family: system-ui, "Microsoft YaHei", sans-serif;
}
.directory-row { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 44px; padding: 0 18px; box-sizing: border-box; color: #7892aa; font-family: inherit; font-size: 12px; text-align: left; border: 0; border-bottom: 1px solid rgba(0, 150, 220, .07); background: transparent; }
.home-row { cursor: pointer; transition: .18s ease; }
.home-row strong { color: #b9cee0; font-size: 12px; font-weight: 600; }
.home-row:hover { background: rgba(0, 170, 235, .08); }
.home-row:hover strong { color: #69dff2; }
.row-icon { width: 18px; color: #4e85aa; text-align: center; }
.context-row { cursor:pointer;transition:.18s ease}.context-row:hover{color:#c9edfa;background:rgba(0,170,235,.06)}
.directory-header { display: flex; align-items: center; gap: 9px; min-height: 47px; padding: 0 15px; color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 1px; background: linear-gradient(90deg, rgba(0, 116, 218, .92), rgba(0, 174, 235, .72)); border-top: 1px solid rgba(64, 207, 255, .38); border-bottom: 1px solid rgba(64, 207, 255, .35); box-shadow: inset 3px 0 0 #7de9ff, 0 0 14px rgba(0, 140, 255, .15); }
.header-icon { display: grid; place-items: center; width: 22px; font-size: 16px; }
.header-arrow { margin-left: auto; color: rgba(255,255,255,.8); }
.directory-tree { padding: 5px 0 7px; background: rgba(0, 35, 67, .25); }
.directory-node { position: relative; display: grid; grid-template-columns: 18px minmax(0,1fr) auto; align-items: center; width: 100%; min-height: 40px; padding: 0 14px 0 25px; color: #829bb4; text-align: left; font-family: inherit; border: 0; background: transparent; cursor: pointer; transition: .18s ease; }
.directory-node:hover { color: #c9edfa; background: rgba(0, 170, 235, .06); }
.directory-node.active { color: #e6fbff; background: linear-gradient(90deg, rgba(0, 135, 230, .28), rgba(0, 105, 175, .1)); box-shadow: inset 3px 0 0 #37dfff; }
.directory-node strong { color: inherit; font-size: 12px; font-weight: 500; }
.directory-node em { color: #69dff2; font-size: 9px; font-style: normal; }
.branch { position: relative; width: 12px; height: 100%; }
.branch::before { content: ''; position: absolute; left: 4px; inset-block: 0; width: 1px; background: rgba(80, 155, 200, .24); }
.branch::after { content: ''; position: absolute; left: 4px; top: 50%; width: 8px; height: 1px; background: rgba(80, 155, 200, .35); }
.module-link { display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;width:100%;min-height:43px;padding:0 16px;color:#7892aa;text-align:left;font-family:inherit;border:0;border-bottom:1px solid rgba(0,150,220,.07);background:transparent;cursor:pointer;transition:.18s ease; }
.module-link span{color:#4e85aa;text-align:center}.module-link strong{font-size:12px;font-weight:500}.module-link em{color:#456b87;font-size:16px;font-style:normal}.module-link:hover{color:#dffaff;background:rgba(0,170,235,.07)}.module-link:hover span,.module-link:hover em{color:#69dff2}
.module-directory-slide-enter-active,.module-directory-slide-leave-active { transition: transform .28s ease, opacity .22s ease; }
.module-directory-slide-enter-from,.module-directory-slide-leave-to { transform: translateX(-100%); opacity: 0; }
</style>
