<template>
  <UiV2Page title="档期中心" description="未来 7 天设备 × 日期压缩档期视图，展示可租、占用、冲突和维修状态。">
    <template #actions>
      <BaseButton variant="secondary">导出档期</BaseButton>
      <BaseButton>新建占用</BaseButton>
    </template>

    <section class="summary-grid">
      <MetricCard v-for="metric in modelMetrics" :key="metric.key" :metric="metric" />
    </section>

    <FilterBar title="档期筛选" hint="不使用旧版超宽横向表">
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索资产编号 / 型号" />
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...options.deviceModels]" />
        <BaseSelect v-model="status" label="状态" :options="['全部状态', '可租', '占用', '冲突', '维修']" />
      </div>
    </FilterBar>

    <section class="schedule-board">
      <div class="date-head">
        <span>设备</span>
        <strong v-for="date in sevenDates" :key="date">{{ date.slice(5) }}</strong>
      </div>
      <div v-for="group in groupedDevices" :key="group.model" class="model-group">
        <h2>{{ group.model }} <small>{{ group.devices.length }} 台设备</small></h2>
        <div v-for="device in group.devices" :key="device.id" class="schedule-row">
          <div class="device-cell">
            <strong>{{ device.assetNo }}</strong>
            <span>{{ device.location }}</span>
          </div>
          <button
            v-for="date in sevenDates"
            :key="date"
            :class="['slot-cell', `slot-${slotFor(device.id, date)?.status}`]"
            type="button"
            @click="selectedSlot = slotFor(device.id, date)"
          >
            <strong>{{ slotFor(device.id, date)?.label }}</strong>
            <small>{{ slotFor(device.id, date)?.orderId || device.maintenanceStatus }}</small>
          </button>
        </div>
      </div>
    </section>

    <BaseDrawer v-model="drawerOpen" title="档期详情" :subtitle="selectedSlot?.assetNo || ''" width="520">
      <div v-if="selectedSlot" class="ui-v2-stack">
        <DrawerSummary
          :status="selectedSlot.status"
          :title="selectedSlot.assetNo"
          :description="`${selectedSlot.model} · ${selectedSlot.date}`"
          :meta="selectedSlot.orderId || selectedSlot.conflictType || '当前可租'"
          primary-label="分配设备"
          secondary-label="查看订单"
        />
        <section class="ui-v2-detail-grid">
          <div><span>型号</span><strong>{{ selectedSlot.model }}</strong></div>
          <div><span>日期</span><strong>{{ selectedSlot.date }}</strong></div>
          <div><span>状态</span><strong>{{ selectedSlot.status }}</strong></div>
          <div><span>关联订单</span><strong>{{ selectedSlot.orderId || '无' }}</strong></div>
        </section>
        <UiV2Section title="建议动作">
          <p>{{ actionHint }}</p>
        </UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import FilterBar from '../../../components/FilterBar.vue'
import { DrawerSummary, MetricCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const devices = uiV2MockAdapter.getDevices()
const schedule = uiV2MockAdapter.getSchedule()
const sevenDates = uiV2MockAdapter.getScheduleDates().slice(0, 7)
const options = uiV2MockAdapter.getOptions()
const keyword = ref('')
const model = ref('全部型号')
const status = ref('全部状态')
const selectedSlot = ref(null)
const drawerOpen = ref(false)

const modelMetrics = computed(() => options.deviceModels.slice(0, 5).map((item) => {
  const total = devices.filter((device) => device.model === item).length
  const free = schedule.filter((slot) => slot.model === item && slot.date === sevenDates[0] && slot.status === '可租').length
  return { key: item, label: item, value: `${free}/${total}`, unit: '可租', trend: '今日余量', tone: free < 2 ? 'warning' : 'success' }
}))

const filteredDevices = computed(() => devices.filter((device) => {
  const matchModel = model.value === '全部型号' || device.model === model.value
  const matchKeyword = !keyword.value || `${device.assetNo}${device.model}`.includes(keyword.value)
  const matchStatus = status.value === '全部状态' || sevenDates.some((date) => slotFor(device.id, date)?.status === status.value)
  return matchModel && matchKeyword && matchStatus
}))

const groupedDevices = computed(() => options.deviceModels.map((item) => ({
  model: item,
  devices: filteredDevices.value.filter((device) => device.model === item).slice(0, 6),
})).filter((group) => group.devices.length))

const actionHint = computed(() => {
  if (!selectedSlot.value) return ''
  if (selectedSlot.value.status === '可租') return '可以直接分配给待分配设备订单。'
  if (selectedSlot.value.status === '冲突') return selectedSlot.value.conflictType || '建议换同型号其他设备。'
  if (selectedSlot.value.status === '维修') return '维修或异常设备暂不可分配。'
  return '查看关联订单，确认归还和发货时间。'
})

function slotFor(deviceId, date) {
  return schedule.find((item) => item.deviceId === deviceId && item.date === date)
}

watch(selectedSlot, (slot) => {
  drawerOpen.value = Boolean(slot)
})
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-12);
}

.filter-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(2, minmax(180px, 0.7fr));
  gap: var(--space-12);
  align-items: end;
}

.schedule-board {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  background: var(--color-surface);
}

.date-head,
.schedule-row {
  display: grid;
  grid-template-columns: minmax(190px, 1.2fr) repeat(7, minmax(84px, 1fr));
  gap: 1px;
  background: var(--color-border);
}

.date-head span,
.date-head strong,
.device-cell,
.slot-cell {
  background: var(--color-surface);
}

.date-head span,
.date-head strong {
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
}

.model-group h2 {
  margin: 0;
  padding: var(--space-12) var(--space-16);
  background: var(--color-bg-muted);
  color: var(--color-text);
  font-size: 14px;
}

.model-group h2 small {
  color: var(--color-text-muted);
  font-weight: 500;
}

.device-cell {
  display: grid;
  gap: 2px;
  padding: var(--space-12);
}

.device-cell span,
.slot-cell small {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-cell {
  min-height: 58px;
  display: grid;
  align-content: center;
  gap: 2px;
  padding: 8px;
  border: 0;
  text-align: center;
}

.slot-cell strong {
  font-size: 12px;
}

.slot-可租 { color: var(--color-status-success); background: #f0fdf4; }
.slot-占用 { color: var(--color-status-info); background: #eff6ff; }
.slot-冲突 { color: var(--color-status-danger); background: #fef2f2; }
.slot-维修 { color: var(--color-status-warning); background: #fffbeb; }
</style>
