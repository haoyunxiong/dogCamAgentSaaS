<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">档期中心</h1>
          <p class="page-desc">按型号和日期查看设备可安排、满租、冲突和维修状态。</p>
        </div>
        <ScheduleLegend />
      </header>

      <section class="metric-grid">
        <MetricCard v-for="metric in scheduleMetrics" :key="metric.key" :metric="metric" />
      </section>

      <FilterBar>
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...deviceModels]" />
        <BaseSelect v-model="status" label="档期状态" :options="['全部状态', '可租', '占用', '冲突', '维修']" />
        <div class="date-strip">
          <FilterChip
            v-for="date in sevenDates"
            :key="date"
            :label="date.slice(5)"
            :active="activeDate === date"
            @click="activeDate = date"
          />
        </div>
      </FilterBar>

      <section class="schedule-layout">
        <ScheduleGrid
          :dates="sevenDates"
          :groups="filteredGroups"
          :schedule="filteredSchedule"
          @slot-click="selectSlot"
        />
        <aside class="summary-panel">
          <h2>今日可用热力</h2>
          <article v-for="item in availabilitySummary" :key="item.model">
            <div class="row-between">
              <strong>{{ item.short }}</strong>
              <StatusTag :label="item.status" />
            </div>
            <div class="heat-bar" aria-hidden="true">
              <span :style="{ width: `${item.rate}%` }" />
            </div>
            <small>{{ item.free }} / {{ item.total }} 台可安排</small>
          </article>
        </aside>
      </section>
    </div>

    <Drawer
      :open="Boolean(selectedSlot)"
      title="档期详情"
      :description="selectedSlot ? `${selectedSlot.assetNo} · ${selectedSlot.date}` : ''"
      width="500px"
      @close="selectedSlot = null"
    >
      <div v-if="selectedSlot" class="drawer-stack">
        <section class="detail-hero">
          <StatusTag :label="selectedSlot.status" />
          <h3>{{ selectedSlot.model }}</h3>
          <p>{{ selectedSlot.assetNo }} · {{ selectedSlot.date }}</p>
        </section>
        <section class="detail-grid">
          <div>
            <span>关联订单</span>
            <strong>{{ selectedSlot.orderId || '无' }}</strong>
          </div>
          <div>
            <span>客户</span>
            <strong>{{ selectedOrder?.customerName || '可分配' }}</strong>
          </div>
          <div>
            <span>档期状态</span>
            <strong>{{ selectedSlot.label }}</strong>
          </div>
          <div>
            <span>建议动作</span>
            <strong>{{ actionText }}</strong>
          </div>
        </section>
        <section v-if="selectedSlot.conflictType" class="panel">
          <div class="panel-body">
            <strong>冲突原因</strong>
            <p>{{ selectedSlot.conflictType }}</p>
          </div>
        </section>
        <BaseButton variant="secondary">查看相关订单</BaseButton>
      </div>
    </Drawer>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseSelect from '../../components/BaseSelect.vue'
import Drawer from '../../components/Drawer.vue'
import FilterBar from '../../components/FilterBar.vue'
import FilterChip from '../../components/FilterChip.vue'
import MetricCard from '../../components/MetricCard.vue'
import ScheduleGrid from '../../components/ScheduleGrid.vue'
import ScheduleLegend from '../../components/ScheduleLegend.vue'
import StatusTag from '../../components/StatusTag.vue'
import { deviceModels } from '../../mock/devices.js'
import { orders } from '../../mock/orders.js'
import { schedule, scheduleDates, scheduleModelGroups } from '../../mock/schedule.js'

const model = ref('全部型号')
const status = ref('全部状态')
const activeDate = ref(scheduleDates[0])
const selectedSlot = ref(null)
const sevenDates = scheduleDates.slice(0, 7)

const scheduleMetrics = computed(() => {
  const todaySlots = schedule.filter((item) => item.date === activeDate.value)
  return [
    { key: 'free', label: '可安排', value: todaySlots.filter((item) => item.status === '可租').length, unit: '台', trend: activeDate.value, tone: 'success' },
    { key: 'busy', label: '已占用', value: todaySlots.filter((item) => item.status === '占用').length, unit: '台', trend: '含在租订单', tone: 'info' },
    { key: 'conflict', label: '冲突', value: todaySlots.filter((item) => item.status === '冲突').length, unit: '项', trend: '需人工调整', tone: 'danger' },
    { key: 'repair', label: '维修', value: todaySlots.filter((item) => item.status === '维修').length, unit: '台', trend: '不可分配', tone: 'warning' }
  ]
})

const availabilitySummary = computed(() => deviceModels.map((item) => {
  const todaySlots = schedule.filter((slot) => slot.date === activeDate.value && slot.model === item)
  const free = todaySlots.filter((slot) => slot.status === '可租').length
  const total = todaySlots.length || 1
  const statusLabel = free === 0 ? '满租' : free < 3 ? '余量不足' : '可安排'
  return {
    model: item,
    short: item.replace('Canon ', '').replace(' Mark II', '').replace('大疆 ', '').replace('富士 ', ''),
    free,
    total,
    status: statusLabel,
    rate: Math.round((free / total) * 100)
  }
}))

const filteredGroups = computed(() => scheduleModelGroups
  .filter((group) => model.value === '全部型号' || group.model === model.value)
)

const filteredSchedule = computed(() => schedule.filter((item) => {
  const modelMatch = model.value === '全部型号' || item.model === model.value
  const statusMatch = status.value === '全部状态' || item.status === status.value
  return modelMatch && statusMatch
}))

const selectedOrder = computed(() => selectedSlot.value?.orderId
  ? orders.find((order) => order.orderNo === selectedSlot.value.orderId)
  : null
)

const actionText = computed(() => {
  const statusMap = {
    可租: '可分配给新订单',
    占用: '查看占用订单',
    冲突: '处理档期冲突',
    维修: '查看维护原因'
  }
  return statusMap[selectedSlot.value?.status] || '查看详情'
})

function selectSlot(slot) {
  if (slot) selectedSlot.value = slot
}
</script>

<style scoped>
.date-strip {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.schedule-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: var(--space-16);
  align-items: start;
}

.summary-panel {
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
  display: grid;
  gap: var(--space-12);
}

.summary-panel h2 {
  margin: 0;
  font-size: var(--font-pc-section-title-size);
}

.summary-panel article {
  display: grid;
  gap: var(--space-8);
}

.summary-panel small {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.heat-bar {
  height: 8px;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: var(--surface-soft);
}

.heat-bar span {
  display: block;
  height: 100%;
  min-width: 8px;
  background: var(--success);
}

.drawer-stack {
  display: grid;
  gap: var(--space-12);
}

.detail-hero {
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
}

.detail-hero h3 {
  margin: var(--space-12) 0 var(--space-4);
}

.detail-hero p,
.panel p {
  margin: var(--space-4) 0 0;
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-10, 10px);
}

.detail-grid div {
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
}

.detail-grid span {
  display: block;
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.detail-grid strong {
  display: block;
  margin-top: var(--space-4);
}

@media (max-width: 1160px) {
  .schedule-layout {
    grid-template-columns: 1fr;
  }
}
</style>
