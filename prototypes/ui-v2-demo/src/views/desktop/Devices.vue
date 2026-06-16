<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">设备中心</h1>
          <p class="page-desc">统一查看设备状态、位置、维护状态和当前占用关系。</p>
        </div>
        <BaseButton variant="secondary">导入设备台账</BaseButton>
      </header>

      <section class="metric-grid">
        <MetricCard v-for="metric in deviceMetrics" :key="metric.key" :metric="metric" />
      </section>

      <FilterBar>
        <BaseInput v-model="keyword" placeholder="搜索设备编号、型号、序列号" />
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...deviceModels]" />
        <StatusTabs v-model="status" :items="statusTabs" />
      </FilterBar>

      <BaseTable
        :columns="columns"
        :rows="pagedDevices"
        row-key="id"
        :selected-key="selectedDevice?.id || ''"
        @row-click="selectedDevice = $event"
      >
        <template #assetNo="{ row }">
          <strong class="mono">{{ row.assetNo }}</strong>
        </template>
        <template #model="{ row }">
          <div class="cell-stack">
            <strong>{{ row.model }}</strong>
            <small>{{ row.category }}</small>
          </div>
        </template>
        <template #status="{ row }">
          <StatusTag :label="row.status" />
        </template>
        <template #currentOrderId="{ row }">
          {{ row.currentOrderId || '无' }}
        </template>
        <template #utilization="{ row }">
          {{ row.utilization }}%
        </template>
      </BaseTable>

      <Pagination v-model:page="page" :page-size="pageSize" :total="filteredDevices.length" />
    </div>

    <Drawer
      :open="Boolean(selectedDevice)"
      :title="selectedDevice?.assetNo || '设备详情'"
      :description="selectedDevice?.model || ''"
      @close="selectedDevice = null"
    >
      <div v-if="selectedDevice" class="drawer-stack">
        <DrawerSummary
          :status="selectedDevice.status"
          :title="selectedDevice.model"
          :description="`${selectedDevice.location} · 序列号 ${selectedDevice.serialNo}`"
          :meta="`资产编号 ${selectedDevice.assetNo}`"
          primary-label="标记清洁完成"
          secondary-label="查看订单"
        />
        <section class="detail-grid">
          <div><span>当前订单</span><strong>{{ selectedDevice.currentOrderId || '无' }}</strong></div>
          <div><span>下一预约</span><strong>{{ selectedDevice.nextBookingDate }}</strong></div>
          <div><span>维护状态</span><strong>{{ selectedDevice.maintenanceStatus }}</strong></div>
          <div><span>利用率</span><strong>{{ selectedDevice.utilization }}%</strong></div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h3 class="section-title">近 7 天档期</h3>
          </div>
          <div class="panel-body mini-slots">
            <span v-for="slot in deviceSlots" :key="slot.id" :class="slot.status">{{ slot.date.slice(5) }} {{ slot.label }}</span>
          </div>
        </section>
        <section class="panel">
          <div class="panel-body action-note">{{ deviceAction }}</div>
        </section>
      </div>
    </Drawer>
  </AppShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseInput from '../../components/BaseInput.vue'
import BaseSelect from '../../components/BaseSelect.vue'
import BaseTable from '../../components/BaseTable.vue'
import Drawer from '../../components/Drawer.vue'
import DrawerSummary from '../../components/DrawerSummary.vue'
import FilterBar from '../../components/FilterBar.vue'
import MetricCard from '../../components/MetricCard.vue'
import Pagination from '../../components/Pagination.vue'
import StatusTabs from '../../components/StatusTabs.vue'
import StatusTag from '../../components/StatusTag.vue'
import { devices, deviceModels, deviceStatuses } from '../../mock/devices.js'
import { schedule, scheduleDates } from '../../mock/schedule.js'

const keyword = ref('')
const model = ref('全部型号')
const status = ref('全部')
const page = ref(1)
const pageSize = 10
const selectedDevice = ref(null)

const columns = [
  { key: 'assetNo', label: '设备编号' },
  { key: 'model', label: '型号/品类' },
  { key: 'status', label: '状态' },
  { key: 'location', label: '位置' },
  { key: 'currentOrderId', label: '当前订单' },
  { key: 'nextBookingDate', label: '下一预约' },
  { key: 'maintenanceStatus', label: '维护状态' },
  { key: 'utilization', label: '利用率' }
]

const statusTabs = computed(() => ['全部', ...deviceStatuses].map((item) => ({
  label: item,
  value: item,
  count: item === '全部' ? devices.length : devices.filter((device) => device.status === item).length
})))

const deviceMetrics = computed(() => [
  { key: 'all', label: '设备总数', value: devices.length, unit: '台', trend: '资产池', tone: 'info' },
  { key: 'free', label: '可租', value: devices.filter((item) => item.status === '可租').length, unit: '台', trend: '可立即分配', tone: 'success' },
  { key: 'rented', label: '在租', value: devices.filter((item) => item.status === '在租').length, unit: '台', trend: '租期中', tone: 'info' },
  { key: 'clean', label: '待清洁', value: devices.filter((item) => item.status === '待清洁').length, unit: '台', trend: '待回池', tone: 'warning' },
  { key: 'repair', label: '维修/异常', value: devices.filter((item) => ['维修中', '异常'].includes(item.status)).length, unit: '台', trend: '不可分配', tone: 'danger' }
])

const filteredDevices = computed(() => devices.filter((device) => {
  const matchStatus = status.value === '全部' || device.status === status.value
  const matchModel = model.value === '全部型号' || device.model === model.value
  const text = `${device.assetNo}${device.model}${device.serialNo}${device.location}`
  return matchStatus && matchModel && (!keyword.value || text.includes(keyword.value))
}))

const pagedDevices = computed(() => filteredDevices.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch([keyword, model, status], () => {
  page.value = 1
})

const deviceSlots = computed(() => {
  if (!selectedDevice.value) return []
  return schedule.filter((item) => item.deviceId === selectedDevice.value.id && scheduleDates.slice(0, 7).includes(item.date))
})

const deviceAction = computed(() => {
  if (!selectedDevice.value) return ''
  const map = {
    可租: '设备可直接分配给新订单，建议优先匹配今日待分配订单。',
    已预订: '设备已有预约，请核对归还与发货间隔。',
    在租: '设备租赁中，重点关注归还时间和客户提醒。',
    待清洁: '归还后待清洁，完成清洁后可重新进入可租池。',
    维修中: '维修中设备不可分配，需等待维护完成。',
    异常: '异常设备需先处理赔付或复检，暂不建议分配。',
    停用: '停用设备不进入履约分配。'
  }
  return map[selectedDevice.value.status] || '查看设备状态。'
})
</script>

<style scoped>
.mono {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.cell-stack strong,
.cell-stack small {
  display: block;
}

.cell-stack small {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: var(--font-caption-size);
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

.detail-hero p {
  margin: 0;
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

.mini-slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-8);
}

.mini-slots span {
  padding: var(--space-8);
  border-radius: var(--radius-8);
  color: var(--text-soft);
  background: var(--surface-soft);
  font-size: var(--font-caption-size);
  font-weight: 720;
}

.mini-slots .可租 {
  color: var(--success);
  background: var(--success-soft);
}

.mini-slots .占用 {
  color: var(--info);
  background: var(--info-soft);
}

.mini-slots .冲突 {
  color: var(--danger);
  background: var(--danger-soft);
}

.mini-slots .维修 {
  color: var(--warning);
  background: var(--warning-soft);
}

.action-note {
  color: var(--text-soft);
}
</style>
