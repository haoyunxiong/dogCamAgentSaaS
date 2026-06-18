<template>
  <UiV2Page title="设备中心" description="以资产视角管理设备状态、当前订单、下一预约、收益和维护状态。">
    <template #actions>
      <BaseButton variant="secondary">导出设备台账</BaseButton>
      <BaseButton @click="previewDeviceUpdate('new-device')">新增设备预览</BaseButton>
    </template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="sourceMeta.fallbackReason" class="adapter-source__reason">{{ sourceMeta.fallbackReason }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section v-if="devicePreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="devices-page-safeops-preview">
      <div><span>操作预览</span><strong>dry-run only</strong></div>
      <div><span>开放状态</span><strong>暂未开放</strong></div>
      <div><span>execute</span><strong>{{ devicePreview.view.executeLabel }}</strong></div>
      <div><span>writeWillExecute</span><strong>{{ devicePreview.view.writeWillExecute }}</strong></div>
      <div><span>externalCallWillExecute</span><strong>{{ devicePreview.view.externalCallWillExecute }}</strong></div>
      <div><span>audit</span><strong>{{ devicePreview.view.auditLabel }}</strong></div>
      <div><span>confirm</span><strong>{{ devicePreview.view.confirmLabel }}</strong></div>
      <div><span>idempotency</span><strong>{{ devicePreview.view.idempotencyLabel }}</strong></div>
      <div><span>说明</span><strong>不会写入 / 不会调用外部服务</strong></div>
    </section>

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

    <div v-if="loading" class="adapter-state">设备数据读取中...</div>

    <DataTable
      :columns="columns"
      :rows="pagedDevices"
      row-key="id"
      :selected-key="selectedDevice?.id || ''"
      compact
      min-width="980px"
      :empty-title="loading ? '设备数据读取中' : '暂无匹配设备'"
      @row-click="openDevice"
    >
      <template #assetNo="{ row }"><strong class="asset-link">{{ row.assetNo }}</strong></template>
      <template #model="{ row }">
        <div class="ui-v2-cell-stack">
          <strong class="text-truncate">{{ row.model }}</strong>
          <small class="text-truncate">{{ row.category }}</small>
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
        <div v-if="detailLoading" class="adapter-state is-compact">设备详情读取中...</div>
        <DrawerSummary
          :status="selectedDevice.status"
          :title="selectedDevice.model"
          :description="`${selectedDevice.location} · ${selectedDevice.serialNo}`"
          :meta="`近30天收益 ¥${selectedDevice.revenue30d.toLocaleString()} · 利用率 ${selectedDevice.utilization}%`"
          primary-label="维护预览"
          secondary-label="停用预览"
          danger-label="删除预览"
          @primary="previewDeviceUpdate('maintenance')"
          @secondary="previewDeviceUpdate('disable')"
          @danger="previewDeviceDelete"
        />
        <section v-if="devicePreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="devices-safeops-preview">
          <div><span>操作预览</span><strong>dry-run only</strong></div>
          <div><span>开放状态</span><strong>暂未开放</strong></div>
          <div><span>execute</span><strong>{{ devicePreview.view.executeLabel }}</strong></div>
          <div><span>writeWillExecute</span><strong>{{ devicePreview.view.writeWillExecute }}</strong></div>
          <div><span>externalCallWillExecute</span><strong>{{ devicePreview.view.externalCallWillExecute }}</strong></div>
          <div><span>audit</span><strong>{{ devicePreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ devicePreview.view.riskLevel }}</strong></div>
          <div><span>confirm</span><strong>{{ devicePreview.view.confirmLabel }}</strong></div>
          <div><span>idempotency</span><strong>{{ devicePreview.view.idempotencyLabel }}</strong></div>
        </section>
        <p v-if="devicePreview.error" class="adapter-source__error">{{ devicePreview.error }}</p>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>当前订单</span><strong>{{ selectedDevice.currentOrderId || '无' }}</strong></div>
          <div><span>下一预约</span><strong>{{ selectedDevice.nextBookingDate }}</strong></div>
          <div><span>维护状态</span><strong>{{ selectedDevice.maintenanceStatus }}</strong></div>
          <div><span>最近检查</span><strong>{{ selectedDevice.lastCheckedAt }}</strong></div>
          <div><span>买入成本</span><strong>¥{{ Number(selectedDevice.purchaseCost || 0).toLocaleString() }}</strong></div>
          <div><span>残值</span><strong>¥{{ Number(selectedDevice.residualValue || 0).toLocaleString() }}</strong></div>
        </section>
        <UiV2Section title="未来档期">
          <TrackingTimeline :steps="deviceTimeline" />
        </UiV2Section>
        <UiV2Section title="操作建议">
          <p>{{ selectedDevice.conditionNote || '状态正常，可继续分配给符合租期的新订单。' }}</p>
          <p class="safeops-note">dry-run only；暂未开放；不会写入；不会调用外部服务。</p>
        </UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard, Pagination, StatusTabs, TrackingTimeline } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { createSafeOpsPreviewState, runSafeOpsPreview } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const devices = ref([])
const options = ref({ deviceModels: [] })
const statusTabs = ref([{ label: '全部', value: '全部', count: 0 }])
const status = ref('全部')
const model = ref('全部型号')
const location = ref('全部门店')
const keyword = ref('')
const page = ref(1)
const pageSize = 10
const selectedDevice = ref(null)
const drawerOpen = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const loadError = ref('')
const devicePreview = ref(createSafeOpsPreviewState())
const sourceMeta = ref(uiV2Adapter.getMeta())
const locations = computed(() => [...new Set(devices.value.map((device) => device.location).filter(Boolean))])
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

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})

const deviceMetrics = computed(() => [
  { key: 'total', label: '总设备', value: devices.value.length, unit: '台', trend: sourceLabel.value, tone: 'info' },
  { key: 'free', label: '可租', value: countStatus('可租'), unit: '台', trend: '可立即分配', tone: 'success' },
  { key: 'rent', label: '在租', value: countStatus('在租'), unit: '台', trend: '履约中', tone: 'info' },
  { key: 'clean', label: '待清洁', value: countStatus('待清洁'), unit: '台', trend: '归还后处理', tone: 'warning' },
  { key: 'repair', label: '维修', value: countStatus('维修中'), unit: '台', trend: '暂不可租', tone: 'warning' },
  { key: 'error', label: '异常', value: countStatus('异常'), unit: '台', trend: '优先复核', tone: 'danger' },
])

const filteredDevices = computed(() => devices.value.filter((device) => {
  const text = `${device.assetNo}${device.model}${device.location}${device.serialNo}`
  return (status.value === '全部' || device.status === status.value)
    && (model.value === '全部型号' || device.model === model.value)
    && (location.value === '全部门店' || device.location === location.value)
    && (!keyword.value || text.includes(keyword.value))
}))

const pagedDevices = computed(() => filteredDevices.value.slice((page.value - 1) * pageSize, page.value * pageSize))

const deviceTimeline = computed(() => {
  if (!selectedDevice.value) return []
  return [
    { label: '设备状态', desc: selectedDevice.value.status, done: selectedDevice.value.status === '可租', current: selectedDevice.value.status === '在租' },
    { label: '当前订单', desc: selectedDevice.value.currentOrderId || '无', done: !selectedDevice.value.currentOrderId },
    { label: '下一预约', desc: selectedDevice.value.nextBookingDate || '暂无预约', current: Boolean(selectedDevice.value.currentOrderId) },
  ]
})

function countStatus(nextStatus) {
  return devices.value.filter((device) => device.status === nextStatus).length
}

async function loadDevices() {
  loading.value = true
  loadError.value = ''
  try {
    const nextDevices = await uiV2Adapter.getDevices()
    devices.value = Array.isArray(nextDevices) ? nextDevices : []
    options.value = { deviceModels: [], ...(await uiV2Adapter.getOptions()) }
    const nextStatusTabs = await uiV2Adapter.getDeviceStatusTabs()
    statusTabs.value = Array.isArray(nextStatusTabs) ? nextStatusTabs : [{ label: '全部', value: '全部', count: devices.value.length }]
    sourceMeta.value = uiV2Adapter.getLastMeta('getDevices')
  } catch (error) {
    devices.value = []
    statusTabs.value = [{ label: '全部', value: '全部', count: 0 }]
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '设备只读数据读取失败'
  } finally {
    loading.value = false
  }
}

async function openDevice(device) {
  selectedDevice.value = device
  drawerOpen.value = true
  detailLoading.value = true
  try {
    const detail = await uiV2Adapter.getDevice(device.id)
    if (detail) selectedDevice.value = { ...device, ...detail }
    sourceMeta.value = uiV2Adapter.getLastMeta('getDevice') || sourceMeta.value
  } catch (error) {
    loadError.value = error?.message || '设备详情读取失败'
  } finally {
    detailLoading.value = false
  }
}

async function previewDeviceUpdate(reason) {
  devicePreview.value = { ...devicePreview.value, loading: true, error: '' }
  devicePreview.value = await runSafeOpsPreview('device.update.preview', {
    target: {
      type: 'device',
      id: selectedDevice.value?.id || selectedDevice.value?.assetNo || '',
      deviceId: selectedDevice.value?.id || '',
      assetNo: selectedDevice.value?.assetNo || '',
    },
    payload: {
      deviceId: selectedDevice.value?.id || '',
      assetNo: selectedDevice.value?.assetNo || '',
      modelCode: selectedDevice.value?.model || '',
      targetStatus: reason === 'disable' ? 'disabled' : selectedDevice.value?.status || '',
      reason,
      source: 'devices-page',
    },
  })
}

async function previewDeviceDelete() {
  devicePreview.value = { ...devicePreview.value, loading: true, error: '' }
  devicePreview.value = await runSafeOpsPreview('device.delete.preview', {
    target: {
      type: 'device',
      id: selectedDevice.value?.id || selectedDevice.value?.assetNo || '',
      deviceId: selectedDevice.value?.id || '',
      assetNo: selectedDevice.value?.assetNo || '',
    },
    payload: {
      deviceId: selectedDevice.value?.id || '',
      assetNo: selectedDevice.value?.assetNo || '',
      modelCode: selectedDevice.value?.model || '',
      source: 'devices-drawer',
    },
  })
}

onMounted(loadDevices)
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

.text-truncate {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adapter-source-row {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
  flex-wrap: wrap;
}

.adapter-source,
.adapter-source__reason,
.adapter-source__error {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 760;
}

.adapter-source {
  border: 1px solid var(--ui-border);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
}

.adapter-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}

.adapter-source.is-mock-fallback,
.adapter-source__reason {
  border-color: rgba(245, 158, 11, 0.26);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}

.adapter-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.92);
  color: #b91c1c;
}

.adapter-state {
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 680;
}

.adapter-state.is-compact {
  padding: 8px 10px;
}

.safeops-note {
  margin: 8px 0 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 680;
}
</style>
