<template>
  <UiV2Page title="设备中心" description="以资产视角管理设备状态、当前订单、下一预约、收益和维护状态。">
    <template #actions>
      <BaseButton variant="secondary">导出设备台账</BaseButton>
      <BaseButton>新增设备</BaseButton>
    </template>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in deviceMetrics" :key="metric.key" :metric="metric" />
    </section>

    <FilterBar title="资产筛选" hint="点击设备行查看右侧资产详情">
      <StatusTabs v-model="status" :items="statusTabs" />
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索资产编号、型号、位置" />
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...options.deviceModels]" />
        <BaseSelect v-model="location" label="门店" :options="['全部门店', ...locations]" />
        <BaseButton variant="secondary">重置</BaseButton>
      </div>
    </FilterBar>

    <DataTable
      :columns="columns"
      :rows="pagedDevices"
      row-key="id"
      :selected-key="selectedDevice?.id || ''"
      compact
      min-width="980px"
      @row-click="openDevice"
    >
      <template #assetNo="{ row }"><strong class="asset-link">{{ row.assetNo }}</strong></template>
      <template #model="{ row }">
        <div class="ui-v2-cell-stack">
          <strong>{{ row.model }}</strong>
          <small>{{ row.category }}</small>
        </div>
      </template>
      <template #status="{ row }"><StatusBadge :label="row.status" size="sm" /></template>
      <template #currentOrderId="{ row }">{{ row.currentOrderId || '空闲中' }}</template>
      <template #revenue30d="{ row }">¥{{ row.revenue30d.toLocaleString() }}</template>
      <template #utilization="{ row }">{{ row.utilization }}%</template>
      <template #action>...</template>
    </DataTable>
    <Pagination v-model:page="page" :total="filteredDevices.length" :page-size="pageSize" />

    <BaseDrawer v-model="drawerOpen" :title="selectedDevice?.assetNo || '设备详情'" :subtitle="selectedDevice?.model || ''" width="640" test-id="device-detail-drawer">
      <div v-if="selectedDevice" class="ui-v2-stack">
        <DrawerSummary
          :status="selectedDevice.status"
          :title="selectedDevice.model"
          :description="`${selectedDevice.location} · ${selectedDevice.serialNo}`"
          :meta="`近30天收益 ¥${selectedDevice.revenue30d.toLocaleString()} · 利用率 ${selectedDevice.utilization}%`"
          primary-label="安排维护"
          secondary-label="查看档期"
        />
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>当前订单</span><strong>{{ selectedDevice.currentOrderId || '无' }}</strong></div>
          <div><span>下一预约</span><strong>{{ selectedDevice.nextBookingDate }}</strong></div>
          <div><span>维护状态</span><strong>{{ selectedDevice.maintenanceStatus }}</strong></div>
          <div><span>最近检查</span><strong>{{ selectedDevice.lastCheckedAt }}</strong></div>
        </section>
        <UiV2Section title="未来档期">
          <TrackingTimeline :steps="deviceTimeline" />
        </UiV2Section>
        <UiV2Section title="操作建议">
          <p>{{ selectedDevice.conditionNote || '状态正常，可继续分配给符合租期的新订单。' }}</p>
        </UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard, Pagination, StatusTabs, TrackingTimeline } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const devices = uiV2MockAdapter.getDevices()
const schedule = uiV2MockAdapter.getSchedule()
const options = uiV2MockAdapter.getOptions()
const statusTabs = uiV2MockAdapter.getDeviceStatusTabs()
const status = ref('全部')
const model = ref('全部型号')
const location = ref('全部门店')
const keyword = ref('')
const page = ref(1)
const pageSize = 10
const selectedDevice = ref(null)
const drawerOpen = ref(false)
const locations = [...new Set(devices.map((device) => device.location))]
const columns = [
  { key: 'assetNo', label: '设备编号' },
  { key: 'model', label: '设备名称 / 型号' },
  { key: 'category', label: '分类' },
  { key: 'status', label: '当前状态' },
  { key: 'location', label: '所在门店' },
  { key: 'currentOrderId', label: '租用情况' },
  { key: 'serialNo', label: '序列号' },
  { key: 'lastCheckedAt', label: '最近维护时间' },
  { key: 'utilization', label: '利用率' },
  { key: 'revenue30d', label: '近30天收益' },
  { key: 'action', label: '操作', width: '64px' },
]

const deviceMetrics = computed(() => [
  { key: 'total', label: '总设备', value: devices.length, unit: '台', trend: '资产台账', tone: 'info' },
  { key: 'free', label: '可租', value: countStatus('可租'), unit: '台', trend: '可立即分配', tone: 'success' },
  { key: 'rent', label: '在租', value: countStatus('在租'), unit: '台', trend: '履约中', tone: 'info' },
  { key: 'clean', label: '待清洁', value: countStatus('待清洁'), unit: '台', trend: '归还后处理', tone: 'warning' },
  { key: 'repair', label: '维修', value: countStatus('维修中'), unit: '台', trend: '暂不可租', tone: 'warning' },
  { key: 'error', label: '异常', value: countStatus('异常'), unit: '台', trend: '优先复核', tone: 'danger' },
])

const filteredDevices = computed(() => devices.filter((device) => {
  const text = `${device.assetNo}${device.model}${device.location}${device.serialNo}`
  return (status.value === '全部' || device.status === status.value)
    && (model.value === '全部型号' || device.model === model.value)
    && (location.value === '全部门店' || device.location === location.value)
    && (!keyword.value || text.includes(keyword.value))
}))

const pagedDevices = computed(() => filteredDevices.value.slice((page.value - 1) * pageSize, page.value * pageSize))

const deviceTimeline = computed(() => {
  if (!selectedDevice.value) return []
  return schedule.filter((slot) => slot.deviceId === selectedDevice.value.id).slice(0, 5).map((slot) => ({
    label: `${slot.date} · ${slot.status}`,
    desc: slot.orderId || slot.conflictType || '可安排',
    done: slot.status === '可租',
    current: slot.status === '占用',
  }))
})

function countStatus(nextStatus) {
  return devices.filter((device) => device.status === nextStatus).length
}

function openDevice(device) {
  selectedDevice.value = device
  drawerOpen.value = true
}
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(2, minmax(180px, 0.6fr)) auto;
  gap: 10px;
  align-items: end;
}

.asset-link {
  color: var(--ui-brand);
}
</style>
