<template>
  <UiV2Page title="物流发货" description="物流只读可视化，展示运单、揽收、运输和异常状态。">
    <template #actions>
      <BaseButton variant="secondary" :loading="sfPreview.loading" @click="previewShipment('page-action')">顺丰预览</BaseButton>
      <BaseButton @click="previewLogisticsLocalRecordCreate">新增本地发货记录</BaseButton>
    </template>
    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="sourceMeta.fallbackReason" class="adapter-source__reason">{{ sourceMeta.fallbackReason }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>
    <section v-if="sfPreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="logistics-page-sf-preview">
      <div><span>顺丰预览</span><strong>不真实下单</strong></div>
      <div><span>模式</span><strong>{{ sfPreview.view.mode }}</strong></div>
      <div><span>预览模式</span><strong>{{ sfPreview.view.externalPreviewModeLabel }}</strong></div>
      <div><span>persistence</span><strong>{{ sfPreview.view.persistenceLabel }}</strong></div>
      <div><span>execute</span><strong>{{ sfPreview.view.executeLabel }}</strong></div>
      <div><span>writeWillExecute</span><strong>{{ sfPreview.view.writeWillExecute }}</strong></div>
      <div><span>externalCallWillExecute</span><strong>{{ sfPreview.view.externalCallWillExecute }}</strong></div>
      <div><span>audit</span><strong>{{ sfPreview.view.auditLabel }}</strong></div>
      <div><span>confirm</span><strong>{{ sfPreview.view.confirmLabel }}</strong></div>
      <div><span>idempotency</span><strong>{{ sfPreview.view.idempotencyLabel }}</strong></div>
      <div><span>external gateway</span><strong>{{ sfPreview.view.externalGatewayLabel }}</strong></div>
      <div><span>mock waybill</span><strong>{{ sfPreview.view.mockWaybillLabel }}</strong></div>
      <div><span>sandbox payload</span><strong>{{ sfPreview.view.sandboxPayloadLabel }}</strong></div>
      <div><span>开放状态</span><strong>{{ sfPreviewStatusLabel }}</strong></div>
      <div><span>说明</span><strong>外部真实调用未开放 / mock-sandbox only</strong></div>
    </section>
    <section class="ui-v2-metric-grid"><MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" /></section>
    <div v-if="loading" class="adapter-state">物流只读数据读取中...</div>
    <div class="final-tabs">
      <button
        v-for="item in logisticsTabs"
        :key="item"
        type="button"
        class="final-tab"
        :class="{ 'is-active': status === item }"
        @click="status = item"
      >
        {{ item }}
      </button>
    </div>
    <FilterBar title="运单筛选" hint="按运单、订单、收件人、状态和发货时间筛选">
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、运单号" />
        <BaseSelect v-model="status" label="物流状态" :options="logisticsTabs" />
      </div>
    </FilterBar>
    <DataTable
      :columns="columns"
      :rows="filteredWaybills"
      row-key="id"
      :selected-key="selectedWaybill?.id || ''"
      compact
      :empty-title="loading ? '物流只读数据读取中' : '暂无物流记录'"
      @row-click="openWaybill"
    >
      <template #orderId="{ row }"><strong>{{ row.orderId }}</strong></template>
      <template #customerName="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.model }}</small></div></template>
      <template #shippingStatus="{ row }"><StatusBadge :label="row.shippingStatus" size="sm" /></template>
      <template #trackingNo="{ row }">{{ row.trackingNo || '待生成' }}</template>
      <template #insuredAmount="{ row }">¥{{ Number(row.insuredAmount || 0).toLocaleString() }}</template>
      <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
    </DataTable>
    <BaseDrawer v-model="drawerOpen" :title="selectedWaybill?.id || '运单详情'" :subtitle="selectedWaybill?.orderId || ''" width="560" test-id="logistics-waybill-drawer">
      <div v-if="selectedWaybill" class="ui-v2-stack">
        <DrawerSummary :status="selectedWaybill.shippingStatus" :title="selectedWaybill.customerName" :description="selectedWaybill.receiverAddress" :meta="`${selectedWaybill.carrier} · ${selectedWaybill.trackingNo || '待生成'} · 不真实下单`" primary-label="顺丰预览" secondary-label="真实调用未开放" @primary="previewShipment('drawer-action')" @secondary="previewShipment('drawer-secondary')" />
        <section class="final-drawer-card sf-preview-gateway" data-testid="logistics-sf-preview-gateway">
          <div class="sf-preview-gateway__head">
            <div>
              <span>顺丰预览</span>
              <strong>gateway disabled or mock/sandbox only</strong>
            </div>
            <span>不真实下单 · 不调用外部服务</span>
          </div>
          <div class="sf-preview-gateway__controls">
            <BaseSelect v-model="sfPreviewMode" label="预览模式" :options="sfPreviewModeOptions" />
            <BaseButton size="sm" :loading="sfPreview.loading" @click="previewShipment('drawer-mode-action')">生成顺丰预览</BaseButton>
            <BaseButton size="sm" variant="secondary" disabled>真实下单未开放</BaseButton>
          </div>
          <p class="safeops-note">当前仅 mock/sandbox payload 预览；real 永远返回 disabled；不会写 shipping_records；不会更新订单或档期。</p>
        </section>
        <section v-if="sfPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="logistics-sf-safeops-preview">
          <div><span>顺丰预览</span><strong>不真实下单</strong></div>
          <div><span>模式</span><strong>{{ sfPreview.view.mode }}</strong></div>
          <div><span>预览模式</span><strong>{{ sfPreview.view.externalPreviewModeLabel }}</strong></div>
          <div><span>persistence</span><strong>{{ sfPreview.view.persistenceLabel }}</strong></div>
          <div><span>execute</span><strong>{{ sfPreview.view.executeLabel }}</strong></div>
          <div><span>writeWillExecute</span><strong>{{ sfPreview.view.writeWillExecute }}</strong></div>
          <div><span>externalCallWillExecute</span><strong>{{ sfPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>audit</span><strong>{{ sfPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ sfPreview.view.riskLevel }}</strong></div>
          <div><span>confirm</span><strong>{{ sfPreview.view.confirmLabel }}</strong></div>
          <div><span>idempotency</span><strong>{{ sfPreview.view.idempotencyLabel }}</strong></div>
          <div><span>external gateway</span><strong>{{ sfPreview.view.externalGatewayLabel }}</strong></div>
          <div><span>request preview</span><strong>{{ sfPreview.view.requestPayloadPreviewLabel }}</strong></div>
          <div><span>mock waybill</span><strong>{{ sfPreview.view.mockWaybillLabel }}</strong></div>
          <div><span>sandbox payload</span><strong>{{ sfPreview.view.sandboxPayloadLabel }}</strong></div>
          <div><span>开放状态</span><strong>{{ sfPreviewStatusLabel }}</strong></div>
        </section>
        <section class="final-drawer-card logistics-local-record" data-testid="logistics-local-record-safeops">
          <div class="logistics-local-record__head">
            <div>
              <span>本地发货记录</span>
              <strong>shipping_records</strong>
            </div>
            <span>需要确认 · 已审计 · rollback 暂不可自动执行</span>
          </div>
          <div class="logistics-local-record__grid">
            <BaseInput v-model="localRecordForm.orderId" label="订单 ID / 订单号" />
            <BaseInput v-model="localRecordForm.trackingNo" label="人工运单号" placeholder="仅本地记录，不触发查询" />
            <BaseSelect v-model="localRecordForm.carrier" label="承运方" :options="carrierOptions" />
            <BaseSelect v-model="localRecordForm.shippingMode" label="物流方式" :options="shippingModeOptions" />
            <BaseSelect v-model="localRecordForm.latestStatus" label="本地状态" :options="shippingStatusOptions" />
            <BaseInput v-model="localRecordForm.actualShipAt" label="发货时间" placeholder="YYYY-MM-DD HH:mm" />
            <BaseInput v-model="localRecordForm.shipFromCity" label="发出城市" />
            <BaseInput v-model="localRecordForm.shipToCity" label="到达城市" />
          </div>
          <div class="logistics-local-record__actions">
            <BaseButton size="sm" :loading="shipmentPreview.loading" @click="previewLogisticsLocalRecordCreate">本地记录预览</BaseButton>
            <BaseButton
              size="sm"
              variant="primary"
              :loading="logisticsWriteExecuting"
              :disabled="!canExecuteLogisticsLocalRecord"
              @click="executeLogisticsLocalRecordCreate"
            >
              确认创建本地记录
            </BaseButton>
          </div>
          <p class="safeops-note">只写本地 shipping_records；不调用顺丰；不调用外部接口；不更新订单状态。</p>
          <p v-if="shipmentPreview.view?.blockedReason" class="adapter-source__error">{{ shipmentPreview.view.blockedReason }}</p>
        </section>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>保价金额</span><strong>¥{{ Number(selectedWaybill.insuredAmount || 0).toLocaleString() }}</strong></div>
          <div><span>揽收时间</span><strong>{{ selectedWaybill.pickupTime }}</strong></div>
          <div><span>订单状态</span><strong>{{ selectedWaybill.orderStatus }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedWaybill.nextAction }}</strong></div>
        </section>
        <UiV2Section title="物流时间线"><TrackingTimeline :steps="selectedWaybill.timeline" /></UiV2Section>
        <UiV2Section title="安全说明"><p class="safeops-note">外部真实调用未开放；gateway disabled；不会调用顺丰；不会产生外部费用。</p></UiV2Section>
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
import { DrawerSummary, MetricCard, TrackingTimeline } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { safeOpsAdapter } from '../../../adapters/uiV2/safeOpsAdapter.js'
import { createSafeOpsPreviewState, toSafeOpsPreviewView } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const waybills = ref([])
const keyword = ref('')
const status = ref('全部')
const selectedWaybill = ref(null)
const drawerOpen = ref(false)
const loading = ref(false)
const loadError = ref('')
const sfPreview = ref(createSafeOpsPreviewState())
const sfPreviewMode = ref('disabled')
const shipmentPreview = ref(createSafeOpsPreviewState())
const localRecordPreviewPayload = ref(null)
const logisticsWriteExecuting = ref(false)
const localRecordForm = ref({
  orderId: '',
  carrier: 'manual',
  trackingNo: '',
  shippingMode: 'manual',
  latestStatus: 'manual_recorded',
  shipFromCity: '',
  shipToCity: '',
  plannedShipAt: '',
  actualShipAt: '',
  expectedArriveAt: '',
  actualArriveAt: '',
})
const sourceMeta = ref(uiV2Adapter.getMeta())
const logisticsTabs = ['全部', '待下单', '待揽收', '运输中', '已签收', '异常', '已取消']
const safeOpsActor = Object.freeze({ id: 'ui-v2-logistics-operator', source: 'ui-v2', role: 'operator' })
const sfPreviewModeOptions = [
  { label: 'disabled（默认）', value: 'disabled' },
  { label: 'mock（不真实下单）', value: 'mock' },
  { label: 'sandbox payload（不发送请求）', value: 'sandbox' },
  { label: 'real（禁用）', value: 'real' },
]
const carrierOptions = [
  { label: '手工记录', value: 'manual' },
  { label: '顺丰（仅本地）', value: 'sf' },
  { label: '京东物流', value: 'jd' },
  { label: 'EMS', value: 'ems' },
  { label: '德邦', value: 'deppon' },
  { label: '其他', value: 'other' },
]
const shippingModeOptions = [
  { label: '手工记录', value: 'manual' },
  { label: '快递', value: 'express' },
  { label: '上门揽收', value: 'pickup' },
  { label: '网点寄出', value: 'dropoff' },
  { label: '同城', value: 'same_city' },
  { label: '归还', value: 'return' },
]
const shippingStatusOptions = [
  { label: '手工已记录', value: 'manual_recorded' },
  { label: '待揽收', value: 'pending_pickup' },
  { label: '运输中', value: 'in_transit' },
  { label: '已签收', value: 'delivered' },
  { label: '异常', value: 'exception' },
]
const columns = [
  { key: 'orderId', label: '订单号' },
  { key: 'customerName', label: '客户/设备' },
  { key: 'shippingStatus', label: '物流状态' },
  { key: 'trackingNo', label: '运单号' },
  { key: 'pickupTime', label: '揽收时间' },
  { key: 'insuredAmount', label: '保价' },
  { key: 'nextAction', label: '下一步' },
]
const metrics = computed(() => [
  { key: 'ship', label: '待下单', value: countStatus('待下单'), unit: '', trend: sourceLabel.value, tone: 'warning' },
  { key: 'pickup', label: '待揽收', value: countStatus('待揽收'), unit: '', trend: '只读统计', tone: 'warning' },
  { key: 'moving', label: '运输中', value: countStatus('运输中'), unit: '', trend: '只读统计', tone: 'info' },
  { key: 'signed', label: '已签收', value: countStatus('已签收'), unit: '', trend: '只读统计', tone: 'success' },
  { key: 'exception', label: '异常物流', value: countStatus('异常'), unit: '', trend: '需人工复核', tone: 'danger' },
  { key: 'total', label: '物流记录', value: waybills.value.length, unit: '', trend: '订单派生', tone: 'info' },
])
const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})
const filteredWaybills = computed(() => waybills.value.filter((item) => {
  const text = `${item.orderId}${item.customerName}${item.model}${item.trackingNo}`
  return (status.value === '全部' || item.shippingStatus === status.value) && (!keyword.value || text.includes(keyword.value))
}))
const canExecuteLogisticsLocalRecord = computed(() => {
  const result = shipmentPreview.value?.result || {}
  return result.operationType === 'logistics.local_record.create'
    && Boolean(result.executeEnabled)
    && Boolean(result.confirmRequirement?.tokenId)
    && !shipmentPreview.value?.view?.blockers?.length
    && !logisticsWriteExecuting.value
})
const logisticsPreviewStatusLabel = computed(() => {
  const result = shipmentPreview.value?.result || {}
  if (result.mode === 'write' && result.code === 'SAFE_OP_EXECUTED') return '已执行'
  if (result.operationType === 'logistics.local_record.create' && shipmentPreview.value?.view?.blockers?.length) return '已阻断'
  if (result.operationType === 'logistics.local_record.create' && result.executeEnabled) return '需要确认'
  return '暂未开放'
})
const sfPreviewStatusLabel = computed(() => {
  const result = sfPreview.value?.result || {}
  if (!result.operationType) return 'gateway disabled / 默认关闭'
  if (result.externalPreviewMode === 'mock') return 'mock preview only / 不真实下单'
  if (result.externalPreviewMode === 'sandbox') return 'sandbox payload only / 不发送请求'
  if (result.externalPreviewMode === 'real') return 'real disabled / 禁止真实调用'
  return 'gateway disabled / 不真实下单'
})
function countStatus(nextStatus) {
  return waybills.value.filter((item) => item.shippingStatus === nextStatus).length
}
function openWaybill(item) {
  selectedWaybill.value = item
  syncLocalRecordForm(item)
  drawerOpen.value = true
}
function syncLocalRecordForm(item = {}) {
  localRecordForm.value = {
    ...localRecordForm.value,
    orderId: item?.meta?.rawOrderId ? String(item.meta.rawOrderId) : String(item?.orderId || ''),
    shipToCity: localRecordForm.value.shipToCity || '',
  }
}
function toShipmentPreviewState(result = {}) {
  const view = toSafeOpsPreviewView(result)
  return {
    loading: false,
    result,
    view,
    error: result?.ok ? '' : view.summary,
  }
}
function buildLocalRecordPayload() {
  const source = selectedWaybill.value || waybills.value[0] || {}
  return {
    orderId: localRecordForm.value.orderId || (source?.meta?.rawOrderId ? String(source.meta.rawOrderId) : String(source?.orderId || '')),
    carrier: localRecordForm.value.carrier || 'manual',
    trackingNo: String(localRecordForm.value.trackingNo || '').trim(),
    shippingMode: localRecordForm.value.shippingMode || 'manual',
    latestStatus: localRecordForm.value.latestStatus || 'manual_recorded',
    shipFromCity: String(localRecordForm.value.shipFromCity || '').trim(),
    shipToCity: String(localRecordForm.value.shipToCity || '').trim(),
    plannedShipAt: String(localRecordForm.value.plannedShipAt || '').trim(),
    actualShipAt: String(localRecordForm.value.actualShipAt || '').trim(),
    expectedArriveAt: String(localRecordForm.value.expectedArriveAt || '').trim(),
    actualArriveAt: String(localRecordForm.value.actualArriveAt || '').trim(),
  }
}
async function previewShipment(reason) {
  sfPreview.value = { ...sfPreview.value, loading: true, error: '' }
  const source = selectedWaybill.value || filteredWaybills.value[0] || waybills.value[0] || {}
  const result = await safeOpsAdapter.previewSfCreateOrder({
    mode: sfPreviewMode.value,
    shipmentId: source?.id || '',
    orderId: source?.meta?.rawOrderId ? String(source.meta.rawOrderId) : String(source?.orderId || ''),
    modelCode: source?.model || '',
    receiverName: source?.customerName || '',
    receiverAddress: source?.receiverAddress || '',
    receiverCity: source?.shipToCity || '',
    senderName: 'merchant',
    packageInfo: {
      weightKg: source?.weightKg || null,
      insuredAmount: source?.insuredAmount || null,
      goodsType: 'rental_device',
    },
    service: {
      productCode: 'sf_standard',
      payMethod: 'monthly_settlement_preview',
    },
    actor: safeOpsActor,
    reason,
    clientRequestId: `ui-v2-sf-create-order-preview-${Date.now()}`,
  })
  sfPreview.value = toShipmentPreviewState(result)
}
async function previewLogisticsLocalRecordCreate() {
  shipmentPreview.value = { ...shipmentPreview.value, loading: true, error: '' }
  const payload = buildLocalRecordPayload()
  localRecordPreviewPayload.value = payload
  const result = await safeOpsAdapter.previewLogisticsLocalRecordCreate({
    ...payload,
    actor: safeOpsActor,
    clientRequestId: `ui-v2-logistics-local-record-preview-${Date.now()}`,
  })
  shipmentPreview.value = toShipmentPreviewState(result)
}
async function executeLogisticsLocalRecordCreate() {
  if (!canExecuteLogisticsLocalRecord.value) return
  logisticsWriteExecuting.value = true
  try {
    const payload = localRecordPreviewPayload.value || buildLocalRecordPayload()
    const result = await safeOpsAdapter.executeLogisticsLocalRecordCreate({
      ...payload,
      previewResult: shipmentPreview.value.result,
      actor: safeOpsActor,
      clientRequestId: `ui-v2-logistics-local-record-execute-${Date.now()}`,
    })
    shipmentPreview.value = toShipmentPreviewState(result)
    if (result?.ok && result?.mode === 'write') await loadWaybills()
  } finally {
    logisticsWriteExecuting.value = false
  }
}
async function loadWaybills() {
  loading.value = true
  loadError.value = ''
  try {
    const nextWaybills = await uiV2Adapter.getWaybills()
    waybills.value = Array.isArray(nextWaybills) ? nextWaybills : []
    if (!selectedWaybill.value && waybills.value[0]) syncLocalRecordForm(waybills.value[0])
    sourceMeta.value = uiV2Adapter.getLastMeta('getWaybills')
  } catch (error) {
    waybills.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '物流只读数据读取失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadWaybills)
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.2fr minmax(200px, 0.5fr);
  gap: var(--space-12);
  align-items: end;
}
.next-action { color: var(--color-primary); font-weight: 720; }
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
.adapter-source.is-mock-fallback,
.adapter-source__reason {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}
.adapter-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.9);
  color: #b42318;
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
.safeops-note {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 680;
}
.logistics-local-record {
  gap: 12px;
}
.sf-preview-gateway {
  gap: 12px;
}
.sf-preview-gateway__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}
.sf-preview-gateway__head div {
  display: grid;
  gap: 2px;
}
.sf-preview-gateway__head strong {
  color: var(--ui-text);
  font-size: 13px;
}
.sf-preview-gateway__controls {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto;
  gap: 8px;
  align-items: end;
}
.logistics-local-record__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}
.logistics-local-record__head div {
  display: grid;
  gap: 2px;
}
.logistics-local-record__head strong {
  color: var(--ui-text);
  font-size: 13px;
}
.logistics-local-record__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.logistics-local-record__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 720px) {
  .sf-preview-gateway__controls {
    grid-template-columns: 1fr;
  }
}
</style>
