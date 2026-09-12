<template>
  <div class="vent-mileage-search">
    <span class="tool-group-title">里程</span>
    <select v-model="tunnel" aria-label="选择隧道">
      <option value="left">左主洞</option>
      <option value="right">右主洞</option>
      <option value="ddk">DDK 探洞</option>
    </select>
    <el-autocomplete
      ref="autocompleteRef"
      v-model="query"
      :fetch-suggestions="fetchSuggestions"
      placeholder="搜索里程，如 K3+200"
      :trigger-on-focus="false"
      clearable
      size="small"
      popper-class="vent-mileage-popper"
      @select="handleSelect"
      @keydown.enter.prevent="submitQuery"
    >
      <template #prefix><span class="search-prefix">⌕</span></template>
    </el-autocomplete>
    <button type="button" title="定位到输入里程" @click="submitQuery">定位</button>
    <span v-if="error" class="search-error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

type TunnelKey = 'left' | 'right' | 'ddk'
interface LocatePayload { tunnel: TunnelKey; chainage: number }
interface Suggestion { value: string; tunnel: TunnelKey; chainage: number; detail: string }

const props = defineProps<{ activeTunnel: TunnelKey }>()
const emit = defineEmits<{ locate: [payload: LocatePayload] }>()
const tunnel = ref<TunnelKey>(props.activeTunnel)
const query = ref('')
const error = ref('')
const autocompleteRef = ref<{ blur?: () => void }>()

watch(() => props.activeTunnel, value => { tunnel.value = value })
watch(query, () => { error.value = '' })

const maxMileage = (key: TunnelKey) => key === 'left' ? 6800 : key === 'right' ? 7800 : 6800
const tunnelName = (key: TunnelKey) => ({ left: '左主洞', right: '右主洞', ddk: 'DDK 探洞' })[key]
const formatMileage = (value: number) => {
  const rounded = Math.round(value)
  return `K${Math.floor(rounded / 1000)}+${String(rounded % 1000).padStart(3, '0')}`
}

function parseMileage(value: string): LocatePayload | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '')
  if (!normalized) return null
  let selected = tunnel.value
  if (normalized.startsWith('DDK')) selected = 'ddk'
  else if (normalized.startsWith('LK')) selected = 'left'
  else if (normalized.startsWith('RK') || normalized.startsWith('YK')) selected = 'right'
  const raw = normalized.replace(/^(DDK|LK|RK|YK|DK|K)/, '')
  let chainage: number
  const match = raw.match(/^(\d+)\+(\d+(?:\.\d+)?)$/)
  if (match) chainage = Number(match[1]) * 1000 + Number(match[2])
  else if (/^\d+(?:\.\d+)?$/.test(raw)) chainage = Number(raw)
  else return null
  if (!Number.isFinite(chainage) || chainage < 0 || chainage > maxMileage(selected)) return null
  return { tunnel: selected, chainage }
}

function fetchSuggestions(qs: string, cb: (results: Suggestion[]) => void) {
  const q = qs.trim().toUpperCase()
  if (!q) { cb([]); return }
  const parsed = parseMileage(q)
  const candidates: Suggestion[] = []
  if (parsed) {
    candidates.push({
      value: formatMileage(parsed.chainage),
      tunnel: parsed.tunnel,
      chainage: parsed.chainage,
      detail: tunnelName(parsed.tunnel),
    })
  }
  for (let chainage = 0; chainage <= maxMileage(tunnel.value); chainage += 100) {
    const value = formatMileage(chainage)
    if (value.includes(q.replace(/^(DDK|LK|RK|YK|DK)/, ''))) {
      candidates.push({ value, tunnel: tunnel.value, chainage, detail: tunnelName(tunnel.value) })
    }
    if (candidates.length >= 12) break
  }
  const unique = candidates.filter((item, index, list) =>
    list.findIndex(candidate => candidate.tunnel === item.tunnel && candidate.chainage === item.chainage) === index)
  cb(unique.slice(0, 12))
}

function locate(payload: LocatePayload) {
  tunnel.value = payload.tunnel
  query.value = formatMileage(payload.chainage)
  error.value = ''
  emit('locate', payload)
  void nextTick(() => autocompleteRef.value?.blur?.())
}

function handleSelect(item: Suggestion) { locate({ tunnel: item.tunnel, chainage: item.chainage }) }
function submitQuery() {
  const parsed = parseMileage(query.value)
  if (!parsed) {
    error.value = `请输入 0～${formatMileage(maxMileage(tunnel.value))}`
    return
  }
  locate(parsed)
}
</script>

<style lang="scss">
.vent-mileage-popper{
  background:rgba(0,15,30,.97)!important;
  border:1px solid rgba(0,234,255,.4)!important;
  border-radius:3px!important;
  box-shadow:0 5px 22px rgba(0,0,0,.65),0 0 14px rgba(0,234,255,.12)!important;
  .el-autocomplete-suggestion__list{padding:4px 0}
  .el-autocomplete-suggestion__item{color:rgba(190,225,248,.9);font:12px Consolas,"Microsoft YaHei",monospace}
  .el-autocomplete-suggestion__item:hover,.el-autocomplete-suggestion__item.highlighted{background:rgba(0,234,255,.12);color:#00eaff}
}
</style>

<style scoped lang="scss">
.vent-mileage-search{position:relative;display:flex;align-items:center;gap:5px}
.tool-group-title{padding:0 4px;color:#659bb4;font-size:10px;letter-spacing:.5px;white-space:nowrap}
select{height:27px;padding:0 22px 0 7px;border:1px solid rgba(0,174,255,.3);border-radius:2px;background:#00213a;color:#a9d8ed;font-size:11px;outline:none;cursor:pointer}
:deep(.el-autocomplete){width:190px}
:deep(.el-input__wrapper){height:25px;padding:0 8px;background:linear-gradient(135deg,rgba(0,80,150,.35),rgba(0,120,200,.18));border:1px solid rgba(0,234,255,.4);border-radius:2px;box-shadow:none}
:deep(.el-input__wrapper:hover),:deep(.el-input__wrapper:focus-within){border-color:#00eaff;box-shadow:0 0 9px rgba(0,234,255,.2)}
:deep(.el-input__inner){color:#00eaff;font:11px Consolas,"Microsoft YaHei",monospace}
:deep(.el-input__inner::placeholder){color:rgba(0,234,255,.38)}
.search-prefix{color:rgba(0,234,255,.62)}
button{height:27px;padding:0 9px;border:1px solid rgba(0,174,255,.3);border-radius:2px;background:rgba(0,46,79,.52);color:#83aec4;font-size:11px;cursor:pointer}
button:hover{color:#00eaff;border-color:#00eaff;background:rgba(0,174,255,.18);box-shadow:0 0 9px rgba(0,234,255,.2)}
.search-error{position:absolute;left:78px;top:31px;padding:3px 7px;border:1px solid rgba(239,83,80,.45);background:rgba(45,8,12,.92);color:#ff8a80;font-size:9px;white-space:nowrap}
@media(max-width:900px){:deep(.el-autocomplete){width:150px}.tool-group-title{display:none}}
</style>
