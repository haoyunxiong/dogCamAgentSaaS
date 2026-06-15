<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">档期中心</h1>
          <p class="page-desc">按型号查看未来 7 天可租、占用、冲突和维修状态。</p>
        </div>
      </header>

      <section class="schedule-command">
        <div>
          <BaseBadge :label="`方案 ${variantMeta.label} · ${variantMeta.shortName}`" tone="info" />
          <h2>{{ scheduleHeadline }}</h2>
          <p>{{ scheduleCopy }}</p>
        </div>
        <div class="schedule-radar">
          <span v-for="item in availabilitySummary" :key="item.model" :style="{ '--rate': `${Math.round((item.free / item.total) * 100)}%` }">
            {{ item.short }}
          </span>
        </div>
      </section>

      <section class="availability-row">
        <article v-for="item in availabilitySummary" :key="item.model" class="availability-card">
          <span>{{ item.short }}</span>
          <strong>{{ item.free }} / {{ item.total }}</strong>
          <small>今日可租 / 总数</small>
        </article>
      </section>

      <section class="panel">
        <div class="panel-body schedule-filters">
          <BaseSelect v-model="model" label="型号" :options="['全部型号', ...deviceModels]" />
          <BaseSelect v-model="status" label="档期状态" :options="['全部状态', '可租', '占用', '冲突', '维修']" />
          <div class="date-strip">
            <FilterChip v-for="date in sevenDates" :key="date" :label="date.slice(5)" :active="activeDate === date" @click="activeDate = date" />
          </div>
        </div>
      </section>

      <ScheduleGrid :dates="sevenDates" :groups="filteredGroups" :schedule="filteredSchedule" @slot-click="selectedSlot = $event" />
    </div>

    <Drawer
      :open="Boolean(selectedSlot)"
      title="档期详情"
      :description="selectedSlot ? `${selectedSlot.assetNo} · ${selectedSlot.date}` : ''"
      width="480px"
      @close="selectedSlot = null"
    >
      <div v-if="selectedSlot" class="drawer-stack">
        <section class="detail-hero">
          <BaseBadge :label="selectedSlot.status" />
          <h3>{{ selectedSlot.model }}</h3>
          <p>{{ selectedSlot.assetNo }} · {{ selectedSlot.date }}</p>
        </section>
        <section class="detail-grid">
          <div>
            <span>关联订单</span>
            <strong>{{ selectedSlot.orderId || '无' }}</strong>
            <small>{{ selectedOrder?.customerName || '当前可分配' }}</small>
          </div>
          <div>
            <span>建议动作</span>
            <strong>{{ actionText }}</strong>
            <small>{{ selectedSlot.status === '冲突' ? '请调整发货或更换设备' : '可继续处理' }}</small>
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
import BaseSelect from '../../components/BaseSelect.vue'
import BaseBadge from '../../components/BaseBadge.vue'
import BaseButton from '../../components/BaseButton.vue'
import FilterChip from '../../components/FilterChip.vue'
import ScheduleGrid from '../../components/ScheduleGrid.vue'
import Drawer from '../../components/Drawer.vue'
import { deviceModels } from '../../mock/devices.js'
import { schedule, scheduleDates, scheduleModelGroups } from '../../mock/schedule.js'
import { orders } from '../../mock/orders.js'
import { useExperienceVariant } from '../../composables/useExperienceVariant.js'

const { variant, variantMeta } = useExperienceVariant()
const model = ref('全部型号')
const status = ref('全部状态')
const activeDate = ref(scheduleDates[0])
const selectedSlot = ref(null)
const sevenDates = scheduleDates.slice(0, 7)

const availabilitySummary = computed(() => deviceModels.slice(0, 4).map((item) => {
  const todaySlots = schedule.filter((slot) => slot.date === sevenDates[0] && slot.model === item)
  return {
    model: item,
    short: item.replace('Canon ', '').replace(' Mark II', '').replace('大疆 ', '').replace('富士 ', ''),
    free: todaySlots.filter((slot) => slot.status === '可租').length,
    total: todaySlots.length
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

const scheduleHeadline = computed(() => variant.value === 'c'
  ? '先看今天能不能接单，再看哪台设备最稳'
  : '把未来 7 天设备占用压缩成可调度资源图'
)

const scheduleCopy = computed(() => variant.value === 'c'
  ? '移动运营优先看可租数量、冲突提醒和可立即分配设备。'
  : 'PC 端保留设备 × 日期结构，但把冲突、维修、占用关系产品化表达。'
)
</script>

<style scoped>
.schedule-command {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 32%),
    linear-gradient(90deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--brand-soft) 62%, transparent));
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 18px;
  align-items: center;
}

.schedule-command h2 {
  margin: 10px 0 4px;
  font-size: 23px;
}

.schedule-command p {
  margin: 0;
  color: var(--text-soft);
}

.schedule-radar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.schedule-radar span {
  min-height: 42px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--brand) 17%, transparent) var(--rate), rgba(255, 255, 255, 0.5) var(--rate)),
    color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 780;
}

.availability-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.availability-card {
  padding: 12px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(251, 251, 250, 0.86);
  display: grid;
  gap: 5px;
}

.availability-card span,
.availability-card small {
  color: var(--text-muted);
  font-size: 12px;
}

.availability-card strong {
  color: var(--brand-strong);
  font-size: 23px;
}

.schedule-filters {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
}

.date-strip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 1px;
  flex-wrap: wrap;
}

.drawer-stack {
  display: grid;
  gap: 12px;
}

.detail-hero {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--brand-soft);
}

.detail-hero h3 {
  margin: 10px 0 4px;
}

.detail-hero p,
.panel p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.detail-grid div {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.detail-grid span,
.detail-grid small {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
}

.detail-grid strong {
  display: block;
  margin: 4px 0 2px;
}

:global([data-experience="c"]) .schedule-command {
  grid-template-columns: minmax(0, 1fr) 260px;
  border-radius: 18px;
}

:global([data-experience="c"]) .schedule-radar span {
  border-radius: 14px;
}
</style>
