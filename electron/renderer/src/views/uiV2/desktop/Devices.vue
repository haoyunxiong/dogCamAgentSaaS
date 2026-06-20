<template>
  <UiV2Page title="设备中心" description="以资产视角管理设备状态、当前订单、下一预约、收益和维护状态。">
    <template #actions>
      <BaseButton variant="secondary">导出设备台账</BaseButton>
      <BaseButton @click="previewDeviceUpdate('new-device')">新增设备预览</BaseButton>
    </template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section v-if="devicePreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="devices-page-safeops-preview">
      <div><span>操作预览</span><strong>仅预览，不写入</strong></div>
      <div><span>开放状态</span><strong>{{ devicePreviewStatusLabel }}</strong></div>
      <div><span>持久化</span><strong>{{ devicePreview.view.persistenceLabel }}</strong></div>
      <div><span>执行门禁</span><strong>{{ devicePreview.view.executeLabel }}</strong></div>
      <div><span>数据写入</span><strong>{{ devicePreview.view.writeWillExecute }}</strong></div>
      <div><span>外部调用</span><strong>{{ devicePreview.view.externalCallWillExecute }}</strong></div>
      <div><span>审计记录</span><strong>{{ devicePreview.view.auditLabel }}</strong></div>
      <div><span>确认令牌</span><strong>{{ devicePreview.view.confirmLabel }}</strong></div>
      <div><span>幂等保护</span><strong>{{ devicePreview.view.idempotencyLabel }}</strong></div>
      <div><span>说明</span><strong>不会写入 / 不会调用外部服务</strong></div>
    </section>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in deviceMetrics" :key="metric.key" :metric="metric" />
    </section>

    <div class="final-tabs" data-testid="devices-view-switch">
      <button
        v-for="item in viewModes"
        :key="item.value"
        type="button"
        class="final-tab"
        :class="{ 'is-active': viewMode === item.value }"
        @click="switchViewMode(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <FilterBar title="资产筛选" hint="点击设备行查看右侧资产详情">
      <StatusTabs v-model="status" :items="statusTabs" />
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索资产编号、型号、位置" />
        <BaseSelect v-model="status" label="设备状态" :options="deviceStatusFilterOptions" />
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...options.deviceModels]" />
        <BaseSelect v-model="location" label="门店" :options="['全部门店', ...locations]" />
        <BaseButton variant="secondary" @click="resetFilters">重置</BaseButton>
      </div>
    </FilterBar>

    <div v-if="loading" class="adapter-state">设备数据读取中...</div>

    <DataTable
      v-if="viewMode === 'model'"
      :columns="modelColumns"
      :rows="pagedModelGroups"
      row-key="id"
      :selected-key="selectedModelGroup?.id || ''"
      compact
      min-width="980px"
      :empty-title="loading ? '设备数据读取中' : '暂无匹配型号'"
      @row-click="openModelGroup"
    >
      <template #model="{ row }"><strong class="asset-link">{{ row.model }}</strong></template>
      <template #free="{ row }"><StatusBadge :label="`${row.free} 台可租`" size="sm" variant="success" /></template>
      <template #rented="{ row }">{{ row.rented }}</template>
      <template #reserved="{ row }">{{ row.reserved }}</template>
      <template #repair="{ row }">{{ row.repair }}</template>
      <template #offline="{ row }">{{ row.offline }}</template>
      <template #riskLabel="{ row }"><StatusBadge :label="row.riskLabel" size="sm" /></template>
    </DataTable>

    <DataTable
      v-else
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
    <Pagination v-model:page="page" :total="activeTotal" :page-size="pageSize" />

    <BaseDrawer v-model="drawerOpen" :title="drawerTitle" :subtitle="drawerSubtitle" width="720" test-id="device-detail-drawer">
      <div v-if="selectedModelGroup" class="ui-v2-stack">
        <DrawerSummary
          :status="selectedModelGroup.riskLabel"
          :title="selectedModelGroup.model"
          :description="`总 ${selectedModelGroup.total} 台 · 可租 ${selectedModelGroup.free} 台 · 在租 ${selectedModelGroup.rented} 台`"
          :meta="`最近可用：${selectedModelGroup.recentlyAvailableAt} · 近30天收入：${selectedModelGroup.revenue30dLabel}`"
          primary-label="查看首台设备"
          @primary="openDeviceFromGroup(selectedModelGroup.units[0])"
        />
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>型号</span><strong>{{ selectedModelGroup.model }}</strong></div>
          <div><span>总台数</span><strong>{{ selectedModelGroup.total }} 台</strong></div>
          <div><span>可租</span><strong>{{ selectedModelGroup.free }} 台</strong></div>
          <div><span>在租</span><strong>{{ selectedModelGroup.rented }} 台</strong></div>
          <div><span>已预订</span><strong>{{ selectedModelGroup.reserved }} 台</strong></div>
          <div><span>维修/停用</span><strong>{{ selectedModelGroup.repair + selectedModelGroup.offline }} 台</strong></div>
        </section>
        <DataTable
          :columns="unitColumns"
          :rows="selectedModelGroup.units"
          row-key="id"
          compact
          min-width="760px"
          empty-title="暂无单机记录"
          @row-click="openDeviceFromGroup"
        >
          <template #assetNo="{ row }"><strong class="asset-link">{{ row.assetNo }}</strong></template>
          <template #status="{ row }"><StatusBadge :label="row.status" size="sm" /></template>
          <template #currentOrderId="{ row }">{{ row.currentOrderId || '暂无记录' }}</template>
        </DataTable>
        <p class="safeops-note">型号视图用于库存管理；单机安全更新需进入具体设备详情后执行。</p>
      </div>

      <div v-else-if="selectedDevice" class="ui-v2-stack">
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
        <section class="final-drawer-card device-safe-update" data-testid="device-basic-update-safeops">
          <div class="device-safe-update__header">
            <div>
              <span>设备基础信息安全更新</span>
              <strong>本地安全操作</strong>
            </div>
            <span>需要确认 · 可审计 · 自动回滚暂不可执行</span>
          </div>
          <div class="device-safe-update__grid">
            <BaseInput v-model="deviceBasicForm.city" label="所在城市" placeholder="填写城市" />
            <BaseSelect v-model="deviceBasicForm.status" label="受限状态" :options="deviceStatusOptions" />
            <label class="device-safe-update__note">
              <span>内部备注</span>
              <textarea v-model="deviceBasicForm.note" rows="3" placeholder="填写内部维护备注"></textarea>
            </label>
          </div>
          <div class="device-safe-update__actions">
            <BaseButton :loading="devicePreview.loading" @click="previewDeviceBasicUpdate">操作预览</BaseButton>
            <BaseButton
              variant="primary"
              :loading="deviceBasicExecuting"
              :disabled="!canExecuteDeviceBasicUpdate"
              @click="executeDeviceBasicUpdate"
            >
              确认执行
            </BaseButton>
          </div>
          <p class="safeops-note">先预览再确认；不调用外部接口；只允许更新城市、内部备注和受限状态。</p>
          <p v-if="devicePreview.view?.blockedReason" class="adapter-source__error">{{ devicePreview.view.blockedReason }}</p>
        </section>
        <section v-if="devicePreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="devices-safeops-preview">
          <div><span>操作预览</span><strong>仅预览，不写入</strong></div>
          <div><span>开放状态</span><strong>{{ devicePreviewStatusLabel }}</strong></div>
          <div><span>持久化</span><strong>{{ devicePreview.view.persistenceLabel }}</strong></div>
          <div><span>执行门禁</span><strong>{{ devicePreview.view.executeLabel }}</strong></div>
          <div><span>数据写入</span><strong>{{ devicePreview.view.writeWillExecute }}</strong></div>
          <div><span>外部调用</span><strong>{{ devicePreview.view.externalCallWillExecute }}</strong></div>
          <div><span>审计记录</span><strong>{{ devicePreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ devicePreview.view.riskLevel }}</strong></div>
          <div><span>确认令牌</span><strong>{{ devicePreview.view.confirmLabel }}</strong></div>
          <div><span>幂等保护</span><strong>{{ devicePreview.view.idempotencyLabel }}</strong></div>
        </section>
        <p v-if="devicePreview.error" class="adapter-source__error">{{ devicePreview.error }}</p>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>当前订单</span><strong>{{ selectedDevice.currentOrderId || '无' }}</strong></div>
          <div><span>下一预约</span><strong>{{ selectedDevice.nextBookingDate }}</strong></div>
          <div><span>维护状态</span><strong>{{ selectedDevice.maintenanceStatus }}</strong></div>
          <div><span>最近检查</span><strong>{{ selectedDevice.lastCheckedAt }}</strong></div>
          <div><span>买入成本</span><strong>{{ selectedDevice.purchaseCostLabel || (selectedDevice.purchaseCost ? `¥${Number(selectedDevice.purchaseCost).toLocaleString()}` : '无法判断') }}</strong></div>
          <div><span>残值</span><strong>{{ selectedDevice.residualValueLabel || '无法判断' }}</strong></div>
        </section>
        <UiV2Section title="未来档期">
          <TrackingTimeline :steps="deviceTimeline" />
        </UiV2Section>
        <UiV2Section title="操作建议">
          <p>{{ selectedDevice.conditionNote || '状态正常，可继续分配给符合租期的新订单。' }}</p>
          <p class="safeops-note">仅生成安全预览；不会写入；不会调用外部服务。</p>
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
import { safeOpsAdapter } from '../../../adapters/uiV2/safeOpsAdapter.js'
import { createSafeOpsPreviewState, runSafeOpsPreview, toSafeOpsPreviewView } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import { buildSafeOpsActor } from '../../../adapters/uiV2/actorContextAdapter.js'
import {
  buildDeviceGroupMetrics,
  buildDeviceModelGroups,
  decorateDeviceUnit,
  filterDeviceModelGroups,
  filterDeviceUnits,
  paginateDeviceRows,
} from '../../../adapters/uiV2/deviceModelGroupMapper.js'
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
const pageSize = 20
const selectedDevice = ref(null)
const selectedModelGroup = ref(null)
const drawerOpen = ref(false)
const viewMode = ref('model')
const loading = ref(false)
const detailLoading = ref(false)
const loadError = ref('')
const devicePreview = ref(createSafeOpsPreviewState())
const deviceBasicExecuting = ref(false)
const deviceBasicForm = ref({ city: '', note: '', status: 'idle' })
const deviceBasicPreviewPatch = ref(null)
const sourceMeta = ref(uiV2Adapter.getMeta())
const safeOpsActor = buildSafeOpsActor('ui-v2-devices')
const viewModes = [
  { label: '型号视图', value: 'model' },
  { label: '单机视图', value: 'unit' },
  { label: '维修/停用', value: 'maintenance' },
]
const deviceStatusOptions = [
  { label: '可租', value: 'idle' },
  { label: '维护中', value: 'repair' },
  { label: '停用', value: 'offline' },
]
const deviceStatusFilterOptions = ['全部状态', '可租', '在租', '待清洁', '维修中', '异常', '停用']
const locations = computed(() => [...new Set(devices.value.map((device) => device.location).filter(Boolean))])
const modelColumns = [
  { key: 'model', label: '型号' },
  { key: 'total', label: '总台数' },
  { key: 'free', label: '可租' },
  { key: 'rented', label: '在租' },
  { key: 'reserved', label: '已预订' },
  { key: 'repair', label: '维修' },
  { key: 'offline', label: '停用' },
  { key: 'recentlyAvailableAt', label: '最近可用日期' },
  { key: 'utilization30d', label: '近30天利用率' },
  { key: 'revenue30dLabel', label: '近30天收入' },
  { key: 'riskLabel', label: '库存状态' },
]
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
const unitColumns = [
  { key: 'assetNo', label: '设备编号' },
  { key: 'serialNo', label: '序列号' },
  { key: 'status', label: '状态' },
  { key: 'location', label: '所在门店' },
  { key: 'currentOrderId', label: '当前订单' },
  { key: 'nextBookingDate', label: '下一预约' },
  { key: 'lastCheckedAt', label: '最近维护' },
  { key: 'noteLabel', label: '内部备注' },
]

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})

const modelGroups = computed(() => buildDeviceModelGroups(devices.value))
const deviceMetrics = computed(() => buildDeviceGroupMetrics(modelGroups.value))

const filteredModelGroups = computed(() => filterDeviceModelGroups(modelGroups.value, {
  keyword: keyword.value,
  model: model.value,
  status: status.value,
}))
const filteredDevices = computed(() => {
  const base = filterDeviceUnits(devices.value, {
    keyword: keyword.value,
    model: model.value,
    location: location.value,
    status: status.value,
  })
  if (viewMode.value !== 'maintenance') return base
  return base.filter((device) => ['维修中', '维修', '异常', '停用'].includes(device.status))
})
const pagedModelGroups = computed(() => paginateDeviceRows(filteredModelGroups.value, page.value, pageSize))
const pagedDevices = computed(() => paginateDeviceRows(filteredDevices.value, page.value, pageSize))
const activeTotal = computed(() => viewMode.value === 'model' ? filteredModelGroups.value.length : filteredDevices.value.length)
const drawerTitle = computed(() => selectedModelGroup.value?.model || selectedDevice.value?.assetNo || '设备详情')
const drawerSubtitle = computed(() => selectedModelGroup.value ? '型号库存与单机清单' : selectedDevice.value?.model || '')

const deviceTimeline = computed(() => {
  if (!selectedDevice.value) return []
  return [
    { label: '设备状态', desc: selectedDevice.value.status, done: selectedDevice.value.status === '可租', current: selectedDevice.value.status === '在租' },
    { label: '当前订单', desc: selectedDevice.value.currentOrderId || '无', done: !selectedDevice.value.currentOrderId },
    { label: '下一预约', desc: selectedDevice.value.nextBookingDate || '暂无预约', current: Boolean(selectedDevice.value.currentOrderId) },
  ]
})

const canExecuteDeviceBasicUpdate = computed(() => Boolean(
  devicePreview.value?.result?.operationType === 'device.basic.update'
  && devicePreview.value?.result?.executeEnabled
  && devicePreview.value?.result?.confirmRequirement?.tokenId
  && !devicePreview.value?.view?.blockers?.length
  && !deviceBasicExecuting.value
))

const devicePreviewStatusLabel = computed(() => {
  const result = devicePreview.value?.result || {}
  if (result.mode === 'write' && result.code === 'SAFE_OP_EXECUTED') return '已执行'
  if (result.operationType === 'device.basic.update' && result.executeEnabled) return '需要确认'
  if (result.operationType === 'device.basic.update' && result.blockers?.length) return '已阻断'
  return '暂未开放'
})

function countStatus(nextStatus) {
  return devices.value.filter((device) => device.status === nextStatus).length
}

function resetFilters() {
  status.value = '全部状态'
  model.value = '全部型号'
  location.value = '全部门店'
  keyword.value = ''
  page.value = 1
}

function getRawDeviceStatus(device = {}) {
  const rawStatus = String(device.rawStatus || '').trim()
  if (['idle', 'repair', 'offline'].includes(rawStatus)) return rawStatus
  if (device.status === '可租') return 'idle'
  if (device.status === '维修中') return 'repair'
  if (device.status === '停用') return 'offline'
  return 'idle'
}

function getDeviceEditableCity(device = {}) {
  if (device.raw?.city !== undefined && device.raw?.city !== null) return String(device.raw.city || '')
  return device.location === '未分配门店' ? '' : String(device.location || '')
}

function getDeviceEditableNote(device = {}) {
  if (device.raw?.note !== undefined && device.raw?.note !== null) return String(device.raw.note || '')
  return String(device.conditionNote || '')
}

function syncDeviceBasicForm(device = {}) {
  deviceBasicForm.value = {
    city: getDeviceEditableCity(device),
    note: getDeviceEditableNote(device),
    status: getRawDeviceStatus(device),
  }
  deviceBasicPreviewPatch.value = null
}

function getSelectedDeviceUnitId() {
  return String(selectedDevice.value?.rawId || selectedDevice.value?.id || '')
}

function buildDeviceBasicPatch() {
  return {
    city: String(deviceBasicForm.value.city || '').trim(),
    note: String(deviceBasicForm.value.note || '').trim(),
    status: String(deviceBasicForm.value.status || '').trim(),
  }
}

function toPreviewState(result = {}) {
  const view = toSafeOpsPreviewView(result)
  return {
    loading: false,
    result,
    view,
    error: result?.ok ? '' : (result?.message || view.summary),
  }
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
  selectedModelGroup.value = null
  selectedDevice.value = decorateDeviceUnit(device)
  syncDeviceBasicForm(device)
  drawerOpen.value = true
  detailLoading.value = true
  try {
    const detail = await uiV2Adapter.getDevice(device.id)
    if (detail) {
      selectedDevice.value = decorateDeviceUnit({ ...device, ...detail })
      syncDeviceBasicForm(selectedDevice.value)
    }
    sourceMeta.value = uiV2Adapter.getLastMeta('getDevice') || sourceMeta.value
  } catch (error) {
    loadError.value = error?.message || '设备详情读取失败'
  } finally {
    detailLoading.value = false
  }
}

function openModelGroup(group) {
  selectedDevice.value = null
  selectedModelGroup.value = group
  drawerOpen.value = true
}

function openDeviceFromGroup(device) {
  if (!device) return
  selectedModelGroup.value = null
  openDevice(device)
}

function switchViewMode(nextMode) {
  viewMode.value = nextMode
  page.value = 1
  if (nextMode === 'maintenance') {
    status.value = '全部状态'
  }
}

async function refreshSelectedDeviceAfterWrite() {
  const selectedId = selectedDevice.value?.id
  await loadDevices()
  const refreshed = devices.value.find((device) => device.id === selectedId)
  if (refreshed) {
    selectedDevice.value = decorateDeviceUnit(refreshed)
    try {
      const detail = await uiV2Adapter.getDevice(refreshed.id)
      if (detail) selectedDevice.value = decorateDeviceUnit({ ...refreshed, ...detail })
    } catch {
      selectedDevice.value = decorateDeviceUnit(refreshed)
    }
    syncDeviceBasicForm(selectedDevice.value)
  }
}

async function previewDeviceBasicUpdate() {
  devicePreview.value = { ...devicePreview.value, loading: true, error: '' }
  const patch = buildDeviceBasicPatch()
  deviceBasicPreviewPatch.value = patch
  const result = await safeOpsAdapter.previewDeviceBasicUpdate({
    unitId: getSelectedDeviceUnitId(),
    patch,
    actor: safeOpsActor,
    clientRequestId: `ui-v2-device-basic-preview-${Date.now()}`,
  })
  devicePreview.value = toPreviewState(result)
}

async function executeDeviceBasicUpdate() {
  if (!canExecuteDeviceBasicUpdate.value) return
  deviceBasicExecuting.value = true
  try {
    const result = await safeOpsAdapter.executeDeviceBasicUpdate({
      previewResult: devicePreview.value.result,
      unitId: getSelectedDeviceUnitId(),
      patch: deviceBasicPreviewPatch.value || buildDeviceBasicPatch(),
      actor: safeOpsActor,
      clientRequestId: `ui-v2-device-basic-execute-${Date.now()}`,
    })
    devicePreview.value = toPreviewState(result)
    if (result?.ok && result?.mode === 'write') {
      await refreshSelectedDeviceAfterWrite()
    }
  } catch (error) {
    devicePreview.value = toPreviewState({
      ok: false,
      supported: true,
      operationType: 'device.basic.update',
      mode: 'execute-rejected',
      code: 'SAFE_OP_EXECUTE_ERROR',
      message: error?.message || '设备基础信息更新失败',
      writeWillExecute: false,
      externalCallWillExecute: false,
      blockers: [error?.message || '安全执行失败，未执行任何写入'],
      audit: { mode: 'noop', persisted: false },
      execute: { enabled: false, code: 'SAFE_OP_EXECUTE_ERROR' },
    })
  } finally {
    deviceBasicExecuting.value = false
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
  grid-template-columns: 1.2fr repeat(3, minmax(150px, 0.6fr)) auto;
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

.device-safe-update {
  display: grid;
  gap: 12px;
}

.device-safe-update__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 720;
}

.device-safe-update__header > div {
  display: grid;
  gap: 3px;
}

.device-safe-update__header strong {
  color: var(--ui-text);
  font-size: 15px;
}

.device-safe-update__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 0.55fr);
  gap: 10px;
}

.device-safe-update__note {
  display: grid;
  grid-column: 1 / -1;
  gap: 4px;
  color: var(--color-text-secondary, #4b5563);
  font-size: 13px;
  font-weight: 600;
}

.device-safe-update__note textarea {
  width: 100%;
  min-height: 84px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-8, 8px);
  background: var(--color-surface, #fff);
  color: var(--color-text, #111827);
  font: inherit;
  font-weight: 500;
  outline: none;
}

.device-safe-update__note textarea:focus {
  border-color: var(--color-primary, #007f6d);
  box-shadow: 0 0 0 3px rgba(0, 127, 109, 0.12);
}

.device-safe-update__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .device-safe-update__grid {
    grid-template-columns: 1fr;
  }
}
</style>
