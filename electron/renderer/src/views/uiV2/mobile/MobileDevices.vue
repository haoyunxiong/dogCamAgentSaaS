<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="设备中心" subtitle="">
        <template #actions><BaseButton variant="secondary" size="sm" @click="scanMock = true">{{ scanMock ? '已扫码' : '扫码' }}</BaseButton></template>
      </MobileAppBar>
      <div class="mobile-source-row">
        <span class="mobile-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      </div>
      <section class="mobile-dark-hero">
        <div class="mobile-stat-grid is-four">
          <div v-for="item in deviceStats" :key="item.label" class="mobile-stat">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
            <em>{{ item.trend }}</em>
          </div>
        </div>
      </section>
      <section class="mobile-content-sheet">
        <div class="mobile-tabs">
          <button v-for="item in statuses" :key="item" type="button" class="mobile-tab" :class="{ 'is-active': status === item }" @click="status = item">{{ item }}</button>
        </div>
        <BaseInput v-model="keyword" search clearable placeholder="搜索资产编号、型号、位置" />
        <div v-if="loading" class="mobile-adapter-state">设备数据读取中...</div>
        <div v-if="loadError" class="mobile-adapter-state is-error">{{ loadError }}</div>
        <div class="ui-v2-stack">
          <DeviceCard v-for="device in filteredDevices" :key="device.id" :device="device" />
          <EmptyState v-if="!loading && filteredDevices.length === 0" state="no-result" compact />
        </div>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import EmptyState from '../../../components/EmptyState.vue'
import { DeviceCard } from '../../../components/business'
import { MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2Adapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const devices = ref([])
const statuses = ['全部', '可租', '在租', '待清洁', '维修中', '异常']
const keyword = ref('')
const status = ref('全部')
const scanMock = ref(false)
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})
const deviceStats = computed(() => [
  { label: '设备总数', value: devices.value.length, trend: sourceLabel.value },
  { label: '在租', value: countStatus('在租'), trend: '只读' },
  { label: '可用', value: countStatus('可租'), trend: '只读' },
  { label: '维修/异常', value: countStatus('维修中') + countStatus('异常'), trend: '只读' },
])
const filteredDevices = computed(() => devices.value.filter((device) => {
  const text = `${device.assetNo}${device.model}${device.location}${device.serialNo}`
  return (status.value === '全部' || device.status === status.value) && (!keyword.value || text.includes(keyword.value))
}).slice(0, 18))

function countStatus(nextStatus) {
  return devices.value.filter((device) => device.status === nextStatus).length
}

async function loadDevices() {
  loading.value = true
  loadError.value = ''
  try {
    const nextDevices = await uiV2Adapter.getDevices()
    devices.value = Array.isArray(nextDevices) ? nextDevices : []
    sourceMeta.value = uiV2Adapter.getLastMeta('getDevices')
  } catch (error) {
    devices.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '设备只读数据读取失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadDevices)
</script>

<style scoped>
.mobile-source-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 2px;
}
.mobile-source,
.mobile-source__reason {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}
.mobile-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}
.mobile-source.is-mock-fallback,
.mobile-source__reason {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}
.mobile-adapter-state {
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 680;
}
.mobile-adapter-state.is-error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.92);
  color: #b91c1c;
}
</style>
