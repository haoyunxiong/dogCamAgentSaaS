<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="档期中心" subtitle="">
        <template #actions><BaseButton variant="secondary" size="sm" @click="sheetOpen = true">筛选</BaseButton></template>
      </MobileAppBar>
      <div class="mobile-source-row">
        <span class="mobile-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
        <span v-if="loadError" class="mobile-source__error">{{ loadError }}</span>
      </div>
      <section class="mobile-dark-hero">
        <div class="mobile-stat-grid is-four">
          <div v-for="item in scheduleStats" :key="item.label" class="mobile-stat">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
            <em>{{ item.unit }}</em>
          </div>
        </div>
      </section>
      <section class="mobile-content-sheet">
        <div class="mobile-tabs">
          <button v-for="item in ['本周', '本月', '可安排', '满租']" :key="item" type="button" class="mobile-tab" :class="{ 'is-active': tab === item }" @click="tab = item">{{ item }}</button>
        </div>
        <div class="week-title">
          <button type="button">‹</button>
          <strong>{{ weekRangeLabel }}</strong>
          <button type="button">›</button>
        </div>
        <div class="date-strip">
          <button v-for="date in dates.slice(0, 7)" :key="date" type="button" :class="{ active: selectedDate === date }" @click="selectedDate = date">
            <span>{{ weekLabel(date) }}</span>
            <strong>{{ date.slice(5) }}</strong>
          </button>
        </div>
        <div class="legend-line"><span>可安排</span><span>已预订</span><span>满租</span><span>不可用</span></div>
        <div v-if="loading" class="mobile-adapter-state">档期只读数据读取中...</div>
        <div class="availability-list">
          <button v-for="item in availability" :key="item.model" type="button" class="availability-card" @click="model = item.model">
            <div class="availability-head">
              <strong>{{ item.model }}</strong>
              <StatusBadge :label="`共 ${item.total} 台`" variant="success" size="sm" />
              <span>可安排 {{ item.free }} 台 ›</span>
            </div>
            <div class="heat-bar">
              <i v-for="n in 7" :key="n" :class="heatClass(item, n)" />
            </div>
          </button>
        </div>
        <div class="schedule-actions">
          <BaseButton variant="secondary" block @click="sheetOpen = true">筛选设备</BaseButton>
          <BaseButton block>查看完整表格</BaseButton>
        </div>
      </section>
      <BottomSheet v-model="sheetOpen" title="档期筛选">
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...options.deviceModels]" />
        <BaseButton block @click="sheetOpen = false">应用筛选</BaseButton>
      </BottomSheet>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { BottomSheet, MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2Adapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const options = ref({ deviceModels: [] })
const dates = ref([])
const schedule = ref([])
const selectedDate = ref('')
const model = ref('全部型号')
const tab = ref('本周')
const sheetOpen = ref(false)
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})
const scheduleStats = computed(() => {
  const currentSlots = schedule.value.filter((slot) => slot.date === selectedDate.value)
  return [
    { label: '设备总数', value: uniqueDeviceCount(schedule.value), unit: '台' },
    { label: '可安排', value: countSlots(currentSlots, ['可租']), unit: '台' },
    { label: '满租', value: countSlots(currentSlots, ['占用']), unit: '台' },
    { label: '余量不足', value: countSlots(currentSlots, ['冲突']), unit: '台' },
  ]
})
const weekRangeLabel = computed(() => {
  const nextDates = dates.value.slice(0, 7)
  if (!nextDates.length) return '档期读取中'
  return `${formatShortDate(nextDates[0])} - ${formatShortDate(nextDates[nextDates.length - 1])}`
})
const availability = computed(() => options.value.deviceModels.map((item) => {
  const slots = schedule.value.filter((slot) => slot.date === selectedDate.value && slot.model === item)
  const free = slots.filter((slot) => slot.status === '可租').length
  const busy = slots.filter((slot) => ['占用', '冲突'].includes(slot.status)).length
  const repair = slots.filter((slot) => slot.status === '维修').length
  const days = dates.value.slice(0, 7).map((date) => {
    const daySlots = schedule.value.filter((slot) => slot.date === date && slot.model === item)
    if (daySlots.some((slot) => slot.status === '维修')) return 'is-off'
    if (daySlots.length && daySlots.every((slot) => slot.status === '占用')) return 'is-full'
    if (daySlots.some((slot) => slot.status === '占用' || slot.status === '冲突')) return 'is-booked'
    return 'is-free'
  })
  return { model: item, total: slots.length, free, busy, repair, days, status: free === 0 ? '满租' : free < 3 ? '余量不足' : '可租' }
}).filter((item) => model.value === '全部型号' || item.model === model.value))
function weekLabel(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return week[new Date(`${date}T00:00:00`).getDay()]
}
function heatClass(item, n) {
  return item.days?.[n - 1] || 'is-free'
}
function countSlots(slots, statuses) {
  return slots.filter((slot) => statuses.includes(slot.status)).length
}
function uniqueDeviceCount(slots) {
  return new Set(slots.map((slot) => slot.deviceId).filter(Boolean)).size
}
function formatShortDate(date) {
  return String(date || '').slice(5).replace('-', '月').concat('日')
}
async function loadSchedule() {
  loading.value = true
  loadError.value = ''
  try {
    const nextSchedule = await uiV2Adapter.getSchedule()
    schedule.value = Array.isArray(nextSchedule) ? nextSchedule : []
    const nextDates = await uiV2Adapter.getScheduleDates()
    dates.value = Array.isArray(nextDates) ? nextDates : []
    if (!selectedDate.value) selectedDate.value = dates.value[0] || ''
    const nextOptions = await uiV2Adapter.getOptions()
    const models = Array.from(new Set(schedule.value.map((slot) => slot.model).filter(Boolean)))
    options.value = { deviceModels: [], ...nextOptions, deviceModels: models.length ? models : nextOptions?.deviceModels || [] }
    sourceMeta.value = uiV2Adapter.getLastMeta('getSchedule')
  } catch (error) {
    schedule.value = []
    dates.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '档期只读数据读取失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadSchedule)
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
.mobile-source__reason,
.mobile-source__error {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-pill);
  background: var(--ui-surface);
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
.mobile-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.9);
  color: #b42318;
}
.mobile-adapter-state {
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 760;
}
.date-strip {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}
.date-strip button {
  width: 46px;
  min-height: 54px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--ui-text-muted);
  display: grid;
  place-items: center;
  font-size: 12px;
}
.date-strip button.active {
  background: var(--ui-brand);
  color: #fff;
}
.date-strip span,
.date-strip strong {
  display: block;
}
.week-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  color: var(--ui-text);
}
.week-title button {
  width: 28px;
  height: 28px;
  border: 1px solid #e7edf2;
  border-radius: 50%;
  background: #fff;
}
.legend-line {
  display: flex;
  justify-content: center;
  gap: 16px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.availability-list {
  display: grid;
  gap: 4px;
}
.availability-card {
  padding: 14px 0;
  border: 0;
  border-bottom: 1px solid #edf1f5;
  border-radius: 0;
  background: transparent;
  display: grid;
  gap: 10px;
  text-align: left;
}
.availability-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
}
.availability-head span {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 780;
}
.heat-bar {
  height: 28px;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  background: transparent;
}
.heat-bar i {
  border-radius: 4px;
}
.heat-bar .is-free { background: #10b981; }
.heat-bar .is-booked { background: #f59e0b; }
.heat-bar .is-full { background: #ef4444; }
.heat-bar .is-off { background: #cbd5e1; }
.schedule-actions {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
  padding-top: 8px;
}
</style>
