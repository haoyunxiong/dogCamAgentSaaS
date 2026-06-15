<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="mobile-header">
        <div>
          <span>设备快查</span>
          <h1>搜索 / 扫码</h1>
        </div>
        <BaseButton variant="secondary" @click="keyword = 'DEV-001'">扫码 mock</BaseButton>
      </header>

      <BaseInput v-model="keyword" placeholder="输入设备编号、型号或序列号" />

      <section class="scan-panel">
        <strong>{{ filteredDevices.length }}</strong>
        <span>台匹配设备</span>
        <p>扫码或搜索后优先判断是否可租、是否在租、是否维修。</p>
      </section>

      <div class="chip-row">
        <FilterChip v-for="item in statuses" :key="item" :label="item" :active="status === item" @click="status = item" />
      </div>

      <RiskAlert v-if="abnormalDevice" :risk="deviceRisk" />

      <section class="stack">
        <DeviceCard v-for="device in filteredDevices" :key="device.id" :device="device" />
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import MobileShell from '../../components/MobileShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseInput from '../../components/BaseInput.vue'
import FilterChip from '../../components/FilterChip.vue'
import DeviceCard from '../../components/DeviceCard.vue'
import RiskAlert from '../../components/RiskAlert.vue'
import { devices } from '../../mock/devices.js'

const statuses = ['全部', '可租', '在租', '待清洁', '维修中', '异常']
const keyword = ref('')
const status = ref('全部')

const filteredDevices = computed(() => devices.filter((device) => {
  const matchStatus = status.value === '全部' || device.status === status.value
  const text = `${device.id}${device.assetNo}${device.model}${device.serialNo}`
  return matchStatus && (!keyword.value || text.includes(keyword.value))
}).slice(0, 12))

const abnormalDevice = computed(() => filteredDevices.value.find((device) => ['异常', '维修中'].includes(device.status)))
const deviceRisk = computed(() => ({
  level: abnormalDevice.value?.status === '异常' ? 'high' : 'medium',
  type: abnormalDevice.value?.status || '设备异常',
  title: `${abnormalDevice.value?.assetNo || '设备'} 当前不可直接分配`,
  relatedOrderId: abnormalDevice.value?.currentOrderId || '无',
  description: abnormalDevice.value?.conditionNote || '设备需要先完成维护或复检。',
  suggestedAction: '查看设备'
}))
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: 12px;
}

.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mobile-header span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 720;
}

.mobile-header h1 {
  margin: 3px 0 0;
  font-size: 23px;
}

.chip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.scan-panel {
  padding: 12px 13px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.scan-panel strong {
  color: var(--brand-strong);
  font-size: 24px;
}

.scan-panel span {
  margin-left: 6px;
  color: var(--text-soft);
  font-weight: 760;
}

.scan-panel p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
