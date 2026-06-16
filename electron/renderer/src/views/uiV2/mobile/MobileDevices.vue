<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="设备快查" subtitle="扫码或搜索资产编号，快速判断可租状态">
        <template #actions><BaseButton variant="secondary" size="sm" @click="scanMock = true">{{ scanMock ? '已扫码' : '扫码' }}</BaseButton></template>
      </MobileAppBar>
      <BaseInput v-model="keyword" search clearable placeholder="搜索资产编号、型号、位置" />
      <div class="chip-row">
        <FilterChip v-for="item in statuses" :key="item" :label="item" :selected="status === item" @click="status = item" />
      </div>
      <section class="device-summary">
        <div><span>可租</span><strong>{{ countStatus('可租') }}</strong></div>
        <div><span>在租</span><strong>{{ countStatus('在租') }}</strong></div>
        <div><span>维修/异常</span><strong>{{ countStatus('维修中') + countStatus('异常') }}</strong></div>
      </section>
      <div class="ui-v2-stack">
        <DeviceCard v-for="device in filteredDevices" :key="device.id" :device="device" />
        <EmptyState v-if="filteredDevices.length === 0" state="no-result" compact />
      </div>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import EmptyState from '../../../components/EmptyState.vue'
import FilterChip from '../../../components/FilterChip.vue'
import { DeviceCard } from '../../../components/business'
import { MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const devices = uiV2MockAdapter.getDevices()
const statuses = ['全部', '可租', '在租', '待清洁', '维修中', '异常']
const keyword = ref('')
const status = ref('全部')
const scanMock = ref(false)
const filteredDevices = computed(() => devices.filter((device) => {
  const text = `${device.assetNo}${device.model}${device.location}${device.serialNo}`
  return (status.value === '全部' || device.status === status.value) && (!keyword.value || text.includes(keyword.value))
}).slice(0, 18))
function countStatus(nextStatus) {
  return devices.filter((device) => device.status === nextStatus).length
}
</script>

<style scoped>
.chip-row {
  display: flex;
  gap: var(--space-token-8);
  overflow-x: auto;
  padding-bottom: 2px;
}
.device-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-token-8);
}
.device-summary div {
  min-height: 66px;
  display: grid;
  place-items: center;
  align-content: center;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
}
.device-summary span {
  color: var(--ui-text-muted);
  font-size: 12px;
}
.device-summary strong {
  color: var(--ui-brand-strong);
  font-size: 22px;
}
</style>
