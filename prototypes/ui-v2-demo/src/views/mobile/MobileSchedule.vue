<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="mobile-header">
        <div>
          <span>移动档期</span>
          <h1>档期查询</h1>
        </div>
      </header>

      <div class="date-row">
        <FilterChip v-for="date in sevenDates" :key="date" :label="date.slice(5)" :active="date === selectedDate" @click="selectedDate = date" />
      </div>

      <BaseSelect v-model="model" label="设备型号" :options="deviceModels" />

      <section class="summary-card">
        <span>{{ selectedDate }}</span>
        <strong>{{ availableDevices.length }} 台可租</strong>
        <p>{{ model }} · 按日期返回可分配资产，避免横向大表格。</p>
      </section>

      <RiskAlert v-if="conflictSlot" :risk="conflictRisk" />

      <section class="stack">
        <DeviceCard v-for="device in availableDevices" :key="device.id" :device="device" />
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import MobileShell from '../../components/MobileShell.vue'
import FilterChip from '../../components/FilterChip.vue'
import BaseSelect from '../../components/BaseSelect.vue'
import RiskAlert from '../../components/RiskAlert.vue'
import DeviceCard from '../../components/DeviceCard.vue'
import { devices, deviceModels } from '../../mock/devices.js'
import { schedule, scheduleDates } from '../../mock/schedule.js'

const sevenDates = scheduleDates.slice(0, 7)
const selectedDate = ref(sevenDates[0])
const model = ref(deviceModels[0])

const availableDevices = computed(() => {
  const availableIds = schedule
    .filter((item) => item.date === selectedDate.value && item.model === model.value && item.status === '可租')
    .map((item) => item.deviceId)
  return devices.filter((device) => availableIds.includes(device.id)).slice(0, 8)
})

const conflictSlot = computed(() => schedule.find((item) => item.date === selectedDate.value && item.model === model.value && item.status === '冲突'))
const conflictRisk = computed(() => ({
  level: 'medium',
  type: '档期冲突',
  title: `${model.value} 存在档期间隔风险`,
  relatedOrderId: conflictSlot.value?.orderId || 'ORD-10029',
  description: conflictSlot.value?.conflictType || '建议换同型号设备或调整发货时间。',
  suggestedAction: '查看冲突'
}))
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: 12px;
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

.date-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.summary-card {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: linear-gradient(135deg, var(--brand-soft), rgba(251, 251, 250, 0.94));
}

.summary-card span,
.summary-card p {
  display: block;
  margin: 0;
  color: var(--text-soft);
  font-size: 12px;
}

.summary-card strong {
  display: block;
  margin: 5px 0 4px;
  color: var(--brand-strong);
  font-size: 24px;
}
</style>
