<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="mobile-header">
        <MobileAppBar eyebrow="移动档期" title="档期中心" subtitle="按日期和型号快速判断可租余量">
          <template #actions>
            <BaseButton variant="secondary" size="sm" @click="sheetOpen = true">筛选</BaseButton>
          </template>
        </MobileAppBar>
      </header>

      <StatusTabs v-model="week" :items="weekTabs" />

      <section class="summary-card">
        <div>
          <span>{{ currentWeekLabel }}</span>
          <strong>{{ selectedModel === '全部型号' ? '全部设备可用热力' : selectedModel }}</strong>
        </div>
        <StatusTag :label="selectedStatus" />
      </section>

      <div class="date-strip">
        <FilterChip
          v-for="date in currentDates"
          :key="date"
          :label="date.slice(5)"
          :active="selectedDate === date"
          @click="selectedDate = date"
        />
      </div>

      <section class="availability-list">
        <button
          v-for="item in filteredAvailability"
          :key="item.model"
          class="availability-card"
          type="button"
          @click="selectedModel = item.model"
        >
          <div class="availability-head">
            <div>
              <strong>{{ item.model }}</strong>
              <span>{{ item.free }} 台可安排 / {{ item.total }} 台</span>
            </div>
            <StatusTag :label="item.status" />
          </div>
          <div class="heat-bar" aria-hidden="true">
            <span class="segment-free" :style="{ flex: item.free || 0.2 }" />
            <span class="segment-busy" :style="{ flex: item.busy || 0.2 }" />
            <span class="segment-repair" :style="{ flex: item.repair || 0.2 }" />
          </div>
          <p>{{ item.note }}</p>
        </button>
      </section>

      <section class="stack">
        <DeviceCard v-for="device in availableDevices" :key="device.id" :device="device" />
      </section>

      <BottomSheet :open="sheetOpen" title="档期筛选" @close="sheetOpen = false">
        <div class="sheet-form">
          <BaseSelect v-model="selectedModel" label="设备型号" :options="['全部型号', ...deviceModels]" />
          <BaseSelect v-model="selectedStatus" label="余量状态" :options="statusOptions" />
          <ScheduleLegend />
        </div>
      </BottomSheet>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import MobileShell from '../../components/MobileShell.vue'
import MobileAppBar from '../../components/MobileAppBar.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseSelect from '../../components/BaseSelect.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import DeviceCard from '../../components/DeviceCard.vue'
import FilterChip from '../../components/FilterChip.vue'
import ScheduleLegend from '../../components/ScheduleLegend.vue'
import StatusTabs from '../../components/StatusTabs.vue'
import StatusTag from '../../components/StatusTag.vue'
import { devices, deviceModels } from '../../mock/devices.js'
import { schedule, scheduleDates } from '../../mock/schedule.js'

const week = ref('this')
const selectedDate = ref(scheduleDates[0])
const selectedModel = ref('全部型号')
const selectedStatus = ref('全部状态')
const sheetOpen = ref(false)
const statusOptions = ['全部状态', '可安排', '余量不足', '满租']

const weekTabs = [
  { label: '本周', value: 'this' },
  { label: '下周', value: 'next' }
]

const currentDates = computed(() => {
  const start = week.value === 'this' ? 0 : 7
  return scheduleDates.slice(start, start + 7)
})

const currentWeekLabel = computed(() => `${currentDates.value[0]} 至 ${currentDates.value.at(-1)}`)

watch(week, () => {
  selectedDate.value = currentDates.value[0]
})

const availability = computed(() => deviceModels.map((model) => {
  const slots = schedule.filter((item) => item.date === selectedDate.value && item.model === model)
  const free = slots.filter((item) => item.status === '可租').length
  const busy = slots.filter((item) => ['占用', '冲突'].includes(item.status)).length
  const repair = slots.filter((item) => item.status === '维修').length
  const status = free === 0 ? '满租' : free < 3 ? '余量不足' : '可安排'

  return {
    model,
    total: slots.length,
    free,
    busy,
    repair,
    status,
    note: status === '可安排'
      ? '可直接分配给新订单。'
      : status === '余量不足'
        ? '建议先确认租期和发货时间。'
        : '当前日期不建议继续接该型号订单。'
  }
}))

const filteredAvailability = computed(() => availability.value.filter((item) => {
  const modelMatch = selectedModel.value === '全部型号' || item.model === selectedModel.value
  const statusMatch = selectedStatus.value === '全部状态' || item.status === selectedStatus.value
  return modelMatch && statusMatch
}))

const availableDevices = computed(() => {
  const models = selectedModel.value === '全部型号'
    ? filteredAvailability.value.map((item) => item.model)
    : [selectedModel.value]
  const availableIds = schedule
    .filter((item) => item.date === selectedDate.value && models.includes(item.model) && item.status === '可租')
    .map((item) => item.deviceId)

  return devices.filter((device) => availableIds.includes(device.id)).slice(0, 5)
})
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: var(--space-12);
}

.mobile-header,
.availability-head {
  gap: var(--space-12);
}

.mobile-header {
  display: block;
}

.availability-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-card,
.availability-card {
  width: 100%;
  padding: var(--space-14, 14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
}

.summary-card {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
}

.summary-card span,
.availability-card span,
.availability-card p {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.summary-card strong,
.availability-card strong {
  display: block;
  color: var(--text);
}

.summary-card strong {
  margin-top: var(--space-4);
  font-size: var(--font-mobile-card-title-size);
}

.date-strip {
  display: flex;
  gap: var(--space-8);
  overflow-x: auto;
  padding-bottom: 2px;
}

.availability-list {
  display: grid;
  gap: var(--space-10, 10px);
}

.availability-card {
  display: grid;
  gap: var(--space-10, 10px);
  text-align: left;
}

.availability-card p {
  margin: 0;
}

.heat-bar {
  height: 10px;
  border-radius: var(--radius-pill);
  overflow: hidden;
  display: flex;
  background: var(--surface-soft);
}

.heat-bar span {
  min-width: 6px;
}

.segment-free {
  background: var(--success);
}

.segment-busy {
  background: var(--info);
}

.segment-repair {
  background: var(--warning);
}

.sheet-form {
  display: grid;
  gap: var(--space-12);
}
</style>
