<template>
  <UiV2Page title="档期中心" description="按型号余量和单机排期两种视图管理库存占用、冲突与手工锁定。">
    <template #actions>
      <BaseButton variant="secondary" @click="previewScheduleBlock('batch-lock')">批量锁库预览</BaseButton>
      <BaseButton @click="openCreateDrawer">新建占用预览</BaseButton>
    </template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section v-if="schedulePreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="schedule-safeops-preview">
      <div><span>操作预览</span><strong>{{ schedulePreview.view.title || '档期预览' }}</strong></div>
      <div><span>开放状态</span><strong>{{ schedulePreviewStatusLabel }}</strong></div>
      <div><span>数据写入</span><strong>{{ schedulePreview.view.writeWillExecute }}</strong></div>
      <div><span>外部调用</span><strong>{{ schedulePreview.view.externalCallWillExecute }}</strong></div>
      <div><span>审计记录</span><strong>{{ schedulePreview.view.auditLabel }}</strong></div>
      <div><span>冲突检查</span><strong>{{ schedulePreview.view.conflictLabel || '创建时重新检查真实冲突' }}</strong></div>
    </section>

    <section class="summary-grid">
      <MetricCard v-for="metric in scheduleMetrics" :key="metric.key" :metric="metric" />
    </section>

    <div class="final-tabs" data-testid="schedule-view-switch">
      <button
        v-for="item in viewModes"
        :key="item.value"
        type="button"
        class="final-tab"
        :class="{ 'is-active': viewMode === item.value }"
        @click="switchView(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <FilterBar title="档期筛选" hint="日期列展示总库存 / 可用 / 占用 / 冲突，点击行查看详情">
      <div class="filter-row">
        <BaseSelect v-model="scheduleRange" label="日期范围" :options="scheduleRangeOptions" />
        <BaseInput v-model="keyword" search clearable placeholder="搜索型号、设备编号、门店" />
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...options.deviceModels]" />
        <BaseSelect v-model="status" label="状态" :options="scheduleTabs" />
      </div>
    </FilterBar>

    <section class="legend-row">
      <span><i class="ok"></i>可安排</span>
      <span><i class="mid"></i>余量紧张</span>
      <span><i class="full"></i>满租/占用</span>
      <span><i class="low"></i>冲突</span>
      <span><i class="off"></i>维修/停用</span>
    </section>

    <DataTable
      :columns="activeColumns"
      :rows="pagedRows"
      row-key="id"
      compact
      min-width="1120px"
      :empty-title="loading ? '档期数据读取中' : '暂无匹配档期'"
      @row-click="openScheduleRow"
    >
      <template #model="{ row }"><strong class="asset-link">{{ row.model }}</strong></template>
      <template #assetNo="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.assetNo }}</strong><small>{{ row.model }}</small></div></template>
      <template #risk="{ row }"><StatusBadge :label="row.risk" size="sm" /></template>
    </DataTable>
    <Pagination v-model:page="page" :total="activeRows.length" :page-size="pageSize" />

    <BaseDrawer v-model="drawerOpen" :title="drawerTitle" :subtitle="drawerSubtitle" width="680" test-id="schedule-detail-drawer">
      <div class="ui-v2-stack">
        <DrawerSummary
          :status="selectedRow?.risk || selectedRow?.status || '待预览'"
          :title="drawerTitle"
          :description="drawerSubtitle"
          meta="本地安全操作；不批量锁库；不调用外部服务"
          primary-label="创建预览"
          secondary-label="取消预览"
          @primary="previewScheduleBlockCreate"
          @secondary="previewScheduleBlockCancel"
        />

        <section v-if="selectedRow" class="final-drawer-card ui-v2-detail-grid">
          <div><span>视图</span><strong>{{ viewModeLabel }}</strong></div>
          <div><span>型号</span><strong>{{ selectedRow.model || '未填写型号' }}</strong></div>
          <div><span>设备</span><strong>{{ selectedRow.assetNo || '型号汇总' }}</strong></div>
          <div><span>门店</span><strong>{{ selectedRow.location || '未分配门店' }}</strong></div>
          <div><span>状态</span><strong>{{ selectedRow.risk || selectedRow.status || '无法判断' }}</strong></div>
          <div><span>说明</span><strong>真实冲突检测在创建预览和执行前重新进行</strong></div>
        </section>

        <section class="final-drawer-card schedule-safe-update" data-testid="schedule-block-safeops">
          <div class="schedule-safe-update__head">
            <div>
              <span>单条档期安全操作</span>
              <strong>创建 / 取消都必须先预览</strong>
            </div>
            <span>自动回滚暂不可执行</span>
          </div>
          <div class="schedule-safe-update__grid">
            <BaseInput v-model="scheduleCreateForm.unitId" label="设备 ID" placeholder="单机视图会自动带入" />
            <BaseInput v-model="scheduleCreateForm.startDate" label="开始日期" type="date" />
            <BaseInput v-model="scheduleCreateForm.endDate" label="结束日期" type="date" />
            <BaseSelect v-model="scheduleCreateForm.blockType" label="占用类型" :options="scheduleBlockTypeOptions" />
            <BaseInput v-model="scheduleCancelBlockId" label="取消 blockId" placeholder="输入要软取消的 block ID" />
            <label class="schedule-safe-update__note">
              <span>内部备注</span>
              <textarea v-model="scheduleCreateForm.note" rows="3" placeholder="填写手工锁定或维护原因"></textarea>
            </label>
          </div>
          <div class="schedule-safe-update__actions">
            <BaseButton size="sm" :loading="schedulePreview.loading" @click="previewScheduleBlockCreate">创建预览</BaseButton>
            <BaseButton size="sm" variant="primary" :loading="scheduleWriteExecuting" :disabled="!canExecuteCreate" @click="executeScheduleBlockCreate">确认创建</BaseButton>
            <BaseButton size="sm" variant="secondary" :loading="schedulePreview.loading" @click="previewScheduleBlockCancel">取消预览</BaseButton>
            <BaseButton size="sm" variant="danger" :loading="scheduleWriteExecuting" :disabled="!canExecuteCancel" @click="executeScheduleBlockCancel">确认取消</BaseButton>
          </div>
          <p class="safeops-note">创建只插入单条本地 schedule_blocks；取消只软取消单条 block；不会更新订单、设备、物流或外部平台。</p>
        </section>

        <section v-if="schedulePreview.view" class="final-drawer-card ui-v2-detail-grid">
          <div><span>操作</span><strong>{{ scheduleOperationLabel }}</strong></div>
          <div><span>开放状态</span><strong>{{ schedulePreviewStatusLabel }}</strong></div>
          <div><span>数据写入</span><strong>{{ schedulePreview.view.writeWillExecute }}</strong></div>
          <div><span>外部调用</span><strong>{{ schedulePreview.view.externalCallWillExecute }}</strong></div>
          <div><span>确认令牌</span><strong>{{ schedulePreview.view.confirmLabel }}</strong></div>
          <div><span>幂等保护</span><strong>{{ schedulePreview.view.idempotencyLabel }}</strong></div>
        </section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard, Pagination } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { safeOpsAdapter } from '../../../adapters/uiV2/safeOpsAdapter.js'
import { createSafeOpsPreviewState, runSafeOpsPreview, toSafeOpsPreviewView } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import { buildSafeOpsActor } from '../../../adapters/uiV2/actorContextAdapter.js'
import {
  buildScheduleDates,
  buildScheduleModelAvailability,
  buildScheduleUnitRows,
  filterScheduleModels,
  filterScheduleUnits,
  paginateScheduleRows,
} from '../../../adapters/uiV2/scheduleOperationalMapper.js'
import UiV2Page from '../shared/UiV2Page.vue'
import '../shared/uiV2View.css'

const devices = ref([])
const schedule = ref([])
const dates = ref([])
const options = ref({ deviceModels: [] })
const viewMode = ref('model')
const keyword = ref('')
const model = ref('全部型号')
const scheduleRange = ref('未来 7 天')
const status = ref('全部')
const page = ref(1)
const pageSize = 20
const selectedRow = ref(null)
const drawerOpen = ref(false)
const loading = ref(false)
const loadError = ref('')
const schedulePreview = ref(createSafeOpsPreviewState())
const scheduleWriteExecuting = ref(false)
const scheduleCancelBlockId = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const safeOpsActor = buildSafeOpsActor('ui-v2-schedule')
const scheduleCreateForm = ref({
  unitId: '',
  blockType: 'manual_hold',
  startDate: '',
  endDate: '',
  note: '',
})
const viewModes = [
  { label: '型号余量总览', value: 'model' },
  { label: '单机排期', value: 'unit' },
]
const scheduleTabs = ['全部', '可安排', '余量不足', '满租', '冲突', '占用', '维修']
const scheduleRangeOptions = ['今日', '未来 7 天', '本月']
const scheduleBlockTypeOptions = [
  { label: '手工锁定', value: 'manual_hold' },
  { label: '内部占用', value: 'internal_hold' },
  { label: '维护占用', value: 'maintenance' },
  { label: '缓冲', value: 'buffer' },
]

const sourceLabel = computed(() => sourceMeta.value.source === 'real' ? '本地数据库' : '本地演示数据')
const activeDates = computed(() => buildScheduleDates(dates.value, scheduleRange.value === '今日' ? 1 : 7))
const modelRows = computed(() => buildScheduleModelAvailability({ devices: devices.value, schedule: schedule.value, dates: activeDates.value }))
const unitRows = computed(() => buildScheduleUnitRows({ devices: devices.value, schedule: schedule.value, dates: activeDates.value }))
const filteredModelRows = computed(() => filterScheduleModels(modelRows.value, { keyword: keyword.value, model: model.value, status: status.value }))
const filteredUnitRows = computed(() => filterScheduleUnits(unitRows.value, { keyword: keyword.value, model: model.value, status: status.value }))
const activeRows = computed(() => {
  const rows = viewMode.value === 'model' ? filteredModelRows.value : filteredUnitRows.value
  return rows.map(toTableRow)
})
const pagedRows = computed(() => paginateScheduleRows(activeRows.value, page.value, pageSize))
const activeColumns = computed(() => [
  viewMode.value === 'model' ? { key: 'model', label: '型号' } : { key: 'assetNo', label: '设备 / 型号' },
  ...activeDates.value.map((date, index) => ({ key: `d${index}`, label: date.slice(5) })),
  { key: 'risk', label: '状态' },
])
const scheduleMetrics = computed(() => {
  const totalUnits = devices.value.length
  const riskModels = modelRows.value.filter((row) => row.risk !== '余量正常').length
  const conflictDays = modelRows.value.reduce((sum, row) => sum + row.dates.filter((cell) => cell.conflict > 0).length, 0)
  return [
    { key: 'models', label: '型号', value: modelRows.value.length, unit: '类', trend: '型号余量总览', tone: 'info' },
    { key: 'units', label: '单机', value: totalUnits, unit: '台', trend: '真实设备', tone: 'info' },
    { key: 'risk', label: '余量风险', value: riskModels, unit: '类', trend: '未来窗口', tone: riskModels ? 'warning' : 'success' },
    { key: 'conflict', label: '冲突日期', value: conflictDays, unit: '处', trend: '需复核', tone: conflictDays ? 'danger' : 'success' },
  ]
})
const viewModeLabel = computed(() => viewModes.find((item) => item.value === viewMode.value)?.label || '档期视图')
const drawerTitle = computed(() => selectedRow.value?.model || selectedRow.value?.assetNo || '档期详情')
const drawerSubtitle = computed(() => selectedRow.value?.assetNo ? `${selectedRow.value.assetNo} · ${selectedRow.value.location}` : '型号每日余量与冲突概览')
const canExecuteCreate = computed(() => canExecuteOperation('schedule.block.create'))
const canExecuteCancel = computed(() => canExecuteOperation('schedule.block.cancel'))
const scheduleOperationLabel = computed(() => {
  const type = schedulePreview.value?.result?.operationType
  if (type === 'schedule.block.create') return '创建档期占用'
  if (type === 'schedule.block.cancel') return '取消档期占用'
  return '档期影响预览'
})
const schedulePreviewStatusLabel = computed(() => {
  const result = schedulePreview.value?.result || {}
  if (result.mode === 'write' && result.code === 'SAFE_OP_EXECUTED') return '已执行'
  if (result.blockers?.length) return '已阻断'
  if (result.executeEnabled) return '需要确认'
  return '仅预览 / 暂未开放'
})

function toTableRow(row) {
  const cells = row.dates || row.cells || []
  const base = { ...row }
  cells.forEach((cell, index) => {
    base[`d${index}`] = viewMode.value === 'model'
      ? `总${cell.total}/可${cell.available}/占${cell.occupied}/冲${cell.conflict}`
      : `${cell.status} · ${cell.label || cell.orderId}`
  })
  base.risk = row.risk || row.status || '无法判断'
  base.unitId = row.id
  return base
}

function switchView(nextMode) {
  viewMode.value = nextMode
  page.value = 1
}

function openScheduleRow(row) {
  selectedRow.value = row
  scheduleCreateForm.value.unitId = viewMode.value === 'unit' ? String(row.unitId || row.id || '') : ''
  scheduleCreateForm.value.startDate = activeDates.value[0] || ''
  scheduleCreateForm.value.endDate = activeDates.value[0] || ''
  drawerOpen.value = true
}

function openCreateDrawer() {
  selectedRow.value = selectedRow.value || null
  if (!scheduleCreateForm.value.startDate) scheduleCreateForm.value.startDate = activeDates.value[0] || ''
  if (!scheduleCreateForm.value.endDate) scheduleCreateForm.value.endDate = activeDates.value[0] || ''
  drawerOpen.value = true
  previewScheduleBlockCreate()
}

function canExecuteOperation(operationType) {
  const result = schedulePreview.value?.result || {}
  return result.operationType === operationType
    && Boolean(result.executeEnabled)
    && Boolean(result.confirmRequirement?.tokenId)
    && !schedulePreview.value?.view?.blockers?.length
    && !scheduleWriteExecuting.value
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

async function previewScheduleBlock(reason) {
  schedulePreview.value = { ...schedulePreview.value, loading: true, error: '' }
  schedulePreview.value = await runSafeOpsPreview('schedule.block.preview', {
    target: { type: 'schedule', id: reason },
    payload: {
      unitId: scheduleCreateForm.value.unitId,
      modelCode: selectedRow.value?.model || model.value,
      startDate: scheduleCreateForm.value.startDate,
      endDate: scheduleCreateForm.value.endDate,
      reason,
    },
  })
}

async function previewScheduleBlockCreate() {
  schedulePreview.value = { ...schedulePreview.value, loading: true, error: '' }
  const result = await safeOpsAdapter.previewScheduleBlockCreate({
    ...scheduleCreateForm.value,
    modelCode: selectedRow.value?.model || model.value,
    actor: safeOpsActor,
    clientRequestId: `ui-v2-schedule-block-create-preview-${Date.now()}`,
  })
  schedulePreview.value = toPreviewState(result)
}

async function executeScheduleBlockCreate() {
  if (!canExecuteCreate.value) return
  scheduleWriteExecuting.value = true
  try {
    const result = await safeOpsAdapter.executeScheduleBlockCreate({
      ...scheduleCreateForm.value,
      modelCode: selectedRow.value?.model || model.value,
      previewResult: schedulePreview.value.result,
      actor: safeOpsActor,
      clientRequestId: `ui-v2-schedule-block-create-execute-${Date.now()}`,
    })
    schedulePreview.value = toPreviewState(result)
    if (result?.ok && result?.mode === 'write') await loadSchedule()
  } finally {
    scheduleWriteExecuting.value = false
  }
}

async function previewScheduleBlockCancel() {
  schedulePreview.value = { ...schedulePreview.value, loading: true, error: '' }
  const result = await safeOpsAdapter.previewScheduleBlockCancel({
    blockId: scheduleCancelBlockId.value,
    actor: safeOpsActor,
    clientRequestId: `ui-v2-schedule-block-cancel-preview-${Date.now()}`,
  })
  schedulePreview.value = toPreviewState(result)
}

async function executeScheduleBlockCancel() {
  if (!canExecuteCancel.value) return
  scheduleWriteExecuting.value = true
  try {
    const result = await safeOpsAdapter.executeScheduleBlockCancel({
      blockId: scheduleCancelBlockId.value,
      previewResult: schedulePreview.value.result,
      actor: safeOpsActor,
      clientRequestId: `ui-v2-schedule-block-cancel-execute-${Date.now()}`,
    })
    schedulePreview.value = toPreviewState(result)
    if (result?.ok && result?.mode === 'write') await loadSchedule()
  } finally {
    scheduleWriteExecuting.value = false
  }
}

async function loadSchedule() {
  loading.value = true
  loadError.value = ''
  try {
    const [nextDevices, nextSchedule, nextDates, nextOptions] = await Promise.all([
      uiV2Adapter.getDevices(),
      uiV2Adapter.getSchedule({ daysLimit: 7 }),
      uiV2Adapter.getScheduleDates({ daysLimit: 7 }),
      uiV2Adapter.getOptions(),
    ])
    devices.value = Array.isArray(nextDevices) ? nextDevices : []
    schedule.value = Array.isArray(nextSchedule) ? nextSchedule : []
    dates.value = Array.isArray(nextDates) ? nextDates : []
    options.value = { deviceModels: [], ...(nextOptions || {}) }
    sourceMeta.value = uiV2Adapter.getLastMeta('getSchedule')
  } catch (error) {
    devices.value = []
    schedule.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '档期只读数据读取失败'
  } finally {
    loading.value = false
  }
}

watch([viewMode, keyword, model, status, scheduleRange], () => {
  page.value = 1
})

onMounted(loadSchedule)
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.5fr) minmax(240px, 1fr) minmax(180px, 0.6fr) minmax(160px, 0.55fr);
  gap: 10px;
  align-items: end;
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 720;
}

.legend-row span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-row i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.legend-row .ok { background: #16a34a; }
.legend-row .mid { background: #d97706; }
.legend-row .full { background: #2563eb; }
.legend-row .low { background: #dc2626; }
.legend-row .off { background: #64748b; }

.asset-link {
  color: var(--ui-brand);
}

.adapter-source-row {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
  flex-wrap: wrap;
}

.adapter-source,
.adapter-source__error {
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

.adapter-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}

.adapter-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.9);
  color: #b42318;
}

.safeops-note {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 680;
}

.schedule-safe-update {
  display: grid;
  gap: 12px;
}

.schedule-safe-update__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 720;
}

.schedule-safe-update__head div {
  display: grid;
  gap: 3px;
}

.schedule-safe-update__head strong {
  color: var(--ui-text);
  font-size: 15px;
}

.schedule-safe-update__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.schedule-safe-update__note {
  display: grid;
  grid-column: 1 / -1;
  gap: 4px;
  color: var(--color-text-secondary, #4b5563);
  font-size: 13px;
  font-weight: 600;
}

.schedule-safe-update__note textarea {
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

.schedule-safe-update__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .summary-grid,
  .filter-row,
  .schedule-safe-update__grid {
    grid-template-columns: 1fr;
  }
}
</style>
