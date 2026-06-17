<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="档期中心" subtitle="">
        <template #actions><BaseButton variant="secondary" size="sm" @click="sheetOpen = true">筛选</BaseButton></template>
      </MobileAppBar>
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
          <strong>6月9日 - 6月15日</strong>
          <button type="button">›</button>
        </div>
        <div class="date-strip">
          <button v-for="date in dates.slice(0, 7)" :key="date" type="button" :class="{ active: selectedDate === date }" @click="selectedDate = date">
            <span>{{ weekLabel(date) }}</span>
            <strong>{{ date.slice(5) }}</strong>
          </button>
        </div>
        <div class="legend-line"><span>可安排</span><span>已预订</span><span>满租</span><span>不可用</span></div>
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
import { computed, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { BottomSheet, MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const options = uiV2MockAdapter.getOptions()
const dates = uiV2MockAdapter.getScheduleDates()
const schedule = uiV2MockAdapter.getSchedule()
const selectedDate = ref(dates[0])
const model = ref('全部型号')
const tab = ref('本周')
const sheetOpen = ref(false)
const scheduleStats = [
  { label: '设备总数', value: 182, unit: '台' },
  { label: '可安排', value: 48, unit: '台' },
  { label: '满租', value: 96, unit: '台' },
  { label: '余量不足', value: 38, unit: '台' },
]
const availability = computed(() => options.deviceModels.map((item) => {
  const slots = schedule.filter((slot) => slot.date === selectedDate.value && slot.model === item)
  const free = slots.filter((slot) => slot.status === '可租').length
  const busy = slots.filter((slot) => ['占用', '冲突'].includes(slot.status)).length
  const repair = slots.filter((slot) => slot.status === '维修').length
  return { model: item, total: slots.length, free, busy, repair, status: free === 0 ? '满租' : free < 3 ? '余量不足' : '可租' }
}).filter((item) => model.value === '全部型号' || item.model === model.value))
function weekLabel(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return week[new Date(`${date}T00:00:00`).getDay()]
}
function heatClass(item, n) {
  if ((item.free + n) % 5 === 0) return 'is-full'
  if ((item.busy + n) % 4 === 0) return 'is-booked'
  if ((item.repair + n) % 6 === 0) return 'is-off'
  return 'is-free'
}
</script>

<style scoped>
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
