<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="档期中心" subtitle="按日期和型号快速判断可租余量">
        <template #actions><BaseButton variant="secondary" size="sm" @click="sheetOpen = true">筛选</BaseButton></template>
      </MobileAppBar>
      <div class="date-strip">
        <FilterChip v-for="date in dates.slice(0, 7)" :key="date" :label="date.slice(5)" :selected="selectedDate === date" @click="selectedDate = date" />
      </div>
      <section class="ui-v2-mobile-card">
        <h2>{{ selectedDate }} 可租摘要</h2>
        <div class="availability-list">
          <button v-for="item in availability" :key="item.model" type="button" class="availability-card" @click="model = item.model">
            <div class="ui-v2-row-between"><strong>{{ item.model }}</strong><StatusBadge :label="item.status" size="sm" /></div>
            <span>{{ item.free }} 台可租 / {{ item.total }} 台</span>
            <div class="heat-bar"><i :style="{ flex: item.free || 0.2 }" /><em :style="{ flex: item.busy || 0.2 }" /><b :style="{ flex: item.repair || 0.2 }" /></div>
          </button>
        </div>
      </section>
      <section class="ui-v2-stack">
        <DeviceCard v-for="device in availableDevices" :key="device.id" :device="device" />
      </section>
      <BottomSheet v-model="sheetOpen" title="档期筛选">
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...options.deviceModels]" />
        <BaseButton block @click="sheetOpen = false">应用筛选</BaseButton>
      </BottomSheet>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import FilterChip from '../../../components/FilterChip.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DeviceCard } from '../../../components/business'
import { BottomSheet, MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const options = uiV2MockAdapter.getOptions()
const dates = uiV2MockAdapter.getScheduleDates()
const schedule = uiV2MockAdapter.getSchedule()
const devices = uiV2MockAdapter.getDevices()
const selectedDate = ref(dates[0])
const model = ref('全部型号')
const sheetOpen = ref(false)
const availability = computed(() => options.deviceModels.map((item) => {
  const slots = schedule.filter((slot) => slot.date === selectedDate.value && slot.model === item)
  const free = slots.filter((slot) => slot.status === '可租').length
  const busy = slots.filter((slot) => ['占用', '冲突'].includes(slot.status)).length
  const repair = slots.filter((slot) => slot.status === '维修').length
  return { model: item, total: slots.length, free, busy, repair, status: free === 0 ? '满租' : free < 3 ? '余量不足' : '可租' }
}).filter((item) => model.value === '全部型号' || item.model === model.value))
const availableDevices = computed(() => {
  const ids = schedule.filter((slot) => slot.date === selectedDate.value && slot.status === '可租' && (model.value === '全部型号' || slot.model === model.value)).map((slot) => slot.deviceId)
  return devices.filter((device) => ids.includes(device.id)).slice(0, 6)
})
</script>

<style scoped>
.date-strip {
  display: flex;
  gap: var(--space-token-8);
  overflow-x: auto;
  padding-bottom: 2px;
}
.availability-list {
  display: grid;
  gap: var(--space-token-8);
}
.availability-card {
  padding: var(--space-12);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface-soft);
  display: grid;
  gap: var(--space-token-8);
  text-align: left;
}
.availability-card span {
  color: var(--ui-text-muted);
  font-size: 12px;
}
.heat-bar {
  height: 8px;
  display: flex;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--ui-border);
}
.heat-bar i { background: var(--color-status-success); }
.heat-bar em { background: var(--color-status-info); }
.heat-bar b { background: var(--color-status-warning); }
</style>
