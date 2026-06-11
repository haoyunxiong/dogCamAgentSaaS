<template>
  <div ref="rootRef" class="range-picker" :class="{ open: panelOpen, disabled }">
    <button class="range-trigger" type="button" :disabled="disabled" @click="togglePanel">
      <div class="range-trigger-label">{{ label }}</div>
      <div class="range-trigger-value" :class="{ placeholder: !displayValue }">
        {{ displayValue || placeholder }}
      </div>
    </button>

    <div v-if="panelOpen" class="range-panel cardish">
      <div class="range-panel-head">
        <div>
          <div class="range-panel-title">{{ selectingEnd ? '选择结束日期' : '选择开始日期' }}</div>
          <div class="range-panel-sub">{{ draftStart && !draftEnd ? `已选开始 ${draftStart}` : '点击开始和结束日期即可完成' }}</div>
        </div>
        <div class="range-head-actions">
          <button class="mini-btn" type="button" @click="clearRange">清空</button>
          <button class="mini-btn" type="button" @click="closePanel">关闭</button>
        </div>
      </div>

      <div class="range-months">
        <section v-for="month in visibleMonths" :key="month.key" class="range-month">
          <div class="range-month-bar">
            <button v-if="month.offset === 0" class="month-nav" type="button" @click="shiftMonth(-1)">‹</button>
            <div class="range-month-title">{{ month.title }}</div>
            <button v-if="month.offset === 1" class="month-nav" type="button" @click="shiftMonth(1)">›</button>
          </div>
          <div class="range-weekdays">
            <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
          </div>
          <div class="range-days">
            <button
              v-for="day in month.days"
              :key="day.key"
              type="button"
              class="range-day"
              :class="dayClass(day)"
              :disabled="!day.date"
              @mouseenter="hoverDate = day.date || ''"
              @mouseleave="hoverDate = ''"
              @click="day.date && selectDate(day.date)"
            >
              {{ day.label }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  label: { type: String, default: '租期' },
  placeholder: { type: String, default: '选择开始和结束日期' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:startDate', 'update:endDate', 'change'])

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const rootRef = ref(null)
const panelOpen = ref(false)
const visibleMonthBase = ref('')
const draftStart = ref(props.startDate || '')
const draftEnd = ref(props.endDate || '')
const hoverDate = ref('')

const selectingEnd = computed(() => Boolean(draftStart.value && !draftEnd.value))
const displayValue = computed(() => {
  if (!props.startDate && !props.endDate) return ''
  if (props.startDate && props.endDate) return `${props.startDate} 至 ${props.endDate}`
  return props.startDate || props.endDate
})

watch(
  () => [props.startDate, props.endDate],
  ([nextStart, nextEnd]) => {
    if (panelOpen.value && draftStart.value && !draftEnd.value && nextStart === draftStart.value && nextEnd) {
      return
    }
    draftStart.value = nextStart || ''
    draftEnd.value = nextEnd || ''
    if (!panelOpen.value) {
      visibleMonthBase.value = monthBaseFor(nextStart || nextEnd || todayText())
    }
  },
  { immediate: true },
)

function todayText() {
  return formatDate(new Date())
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthBaseFor(dateText) {
  const normalized = String(dateText || '').slice(0, 7)
  if (/^\d{4}-\d{2}$/.test(normalized)) return normalized
  return todayText().slice(0, 7)
}

function parseDate(dateText) {
  return new Date(`${dateText}T00:00:00`)
}

function monthTitle(base) {
  const [year, month] = base.split('-')
  return `${year}年${Number(month)}月`
}

function shiftMonth(offset) {
  const [yearText, monthText] = visibleMonthBase.value.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1 + offset, 1)
  visibleMonthBase.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthDays(base, offset = 0) {
  const [yearText, monthText] = base.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1 + offset
  const monthDate = new Date(year, monthIndex, 1)
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const firstWeekday = (monthStart.getDay() + 6) % 7
  const days = []

  for (let i = 0; i < firstWeekday; i += 1) {
    days.push({ key: `blank-${offset}-${i}`, date: '', label: '' })
  }
  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
    const dateText = formatDate(date)
    days.push({ key: dateText, date: dateText, label: String(day) })
  }
  while (days.length % 7 !== 0) {
    days.push({ key: `tail-${offset}-${days.length}`, date: '', label: '' })
  }

  return {
    key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
    title: monthTitle(`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`),
    offset,
    days,
  }
}

const visibleMonths = computed(() => {
  const base = visibleMonthBase.value || monthBaseFor(props.startDate || props.endDate || todayText())
  return [buildMonthDays(base, 0), buildMonthDays(base, 1)]
})

function normalizedRange() {
  if (!draftStart.value) return { start: '', end: '' }
  if (!draftEnd.value) return { start: draftStart.value, end: '' }
  return draftStart.value <= draftEnd.value
    ? { start: draftStart.value, end: draftEnd.value }
    : { start: draftEnd.value, end: draftStart.value }
}

function previewEndDate() {
  if (!draftStart.value || draftEnd.value || !hoverDate.value) return ''
  return hoverDate.value >= draftStart.value ? hoverDate.value : ''
}

function isInRange(dateText) {
  const { start, end } = normalizedRange()
  const previewEnd = previewEndDate()
  const activeEnd = end || previewEnd
  if (!start || !activeEnd) return false
  return dateText >= start && dateText <= activeEnd
}

function dayClass(day) {
  if (!day.date) return 'blank'
  const { start, end } = normalizedRange()
  const previewEnd = previewEndDate()
  const activeEnd = end || previewEnd
  return {
    today: day.date === todayText(),
    selected: day.date === start || day.date === end,
    'range-start': day.date === start,
    'range-end': day.date === activeEnd && !!activeEnd,
    'in-range': isInRange(day.date),
  }
}

function emitRange(start, end) {
  emit('update:startDate', start)
  emit('update:endDate', end)
  emit('change', { startDate: start, endDate: end })
}

function selectDate(dateText) {
  if (!draftStart.value || (draftStart.value && draftEnd.value)) {
    draftStart.value = dateText
    draftEnd.value = ''
    emitRange(dateText, '')
    return
  }

  if (dateText < draftStart.value) {
    draftEnd.value = draftStart.value
    draftStart.value = dateText
  } else {
    draftEnd.value = dateText
  }

  const { start, end } = normalizedRange()
  emitRange(start, end)
  closePanel()
}

function clearRange() {
  draftStart.value = ''
  draftEnd.value = ''
  hoverDate.value = ''
  emitRange('', '')
}

function openPanel() {
  if (props.disabled) return
  draftStart.value = props.startDate || ''
  draftEnd.value = props.endDate || ''
  visibleMonthBase.value = monthBaseFor(props.startDate || props.endDate || todayText())
  panelOpen.value = true
  document.addEventListener('mousedown', handleOutsideClick)
}

function closePanel() {
  panelOpen.value = false
  hoverDate.value = ''
  document.removeEventListener('mousedown', handleOutsideClick)
}

function togglePanel() {
  if (panelOpen.value) closePanel()
  else openPanel()
}

function handleOutsideClick(event) {
  if (!rootRef.value?.contains(event.target)) closePanel()
}

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<style scoped>
.range-picker {
  position: relative;
}

.range-trigger {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--border-light);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-main);
  border-radius: var(--radius-sm);
  padding: 10px 13px;
  text-align: left;
}

.range-trigger-label {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.2;
}

.range-trigger-value {
  margin-top: 2px;
  font-size: 14px;
  color: var(--text-main);
}

.range-trigger-value.placeholder {
  color: var(--text-faint);
}

.range-picker.open .range-trigger {
  border-color: rgba(15, 118, 110, 0.55);
  box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.12);
  background: #fff;
}

.range-panel {
  position: absolute;
  z-index: 80;
  top: calc(100% + 8px);
  left: 0;
  width: min(680px, 92vw);
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-lg);
}

.range-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.range-panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
}

.range-panel-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.range-head-actions {
  display: flex;
  gap: 8px;
}

.mini-btn {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--bg-panel-muted);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.range-months {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.range-month {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 10px;
  background: #fff;
}

.range-month-bar {
  display: grid;
  grid-template-columns: 28px 1fr 28px;
  align-items: center;
  margin-bottom: 8px;
}

.range-month-title {
  text-align: center;
  font-weight: 700;
  color: var(--text-strong);
}

.month-nav {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--bg-panel-muted);
  color: var(--text-secondary);
}

.range-weekdays,
.range-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.range-weekdays {
  margin-bottom: 6px;
}

.range-weekdays span {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

.range-day {
  min-height: 34px;
  border-radius: 10px;
  background: transparent;
  color: var(--text-main);
}

.range-day.blank {
  pointer-events: none;
  opacity: 0;
}

.range-day.today {
  border: 1px solid rgba(15, 118, 110, 0.28);
}

.range-day.in-range {
  background: rgba(20, 184, 166, 0.12);
  color: var(--text-primary);
}

.range-day.range-start,
.range-day.range-end,
.range-day.selected {
  background: var(--bg-primary);
  color: #fff;
}

@media (max-width: 900px) {
  .range-panel {
    width: min(96vw, 520px);
  }

  .range-months {
    grid-template-columns: 1fr;
  }
}
</style>
