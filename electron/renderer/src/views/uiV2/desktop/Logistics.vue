<template>
  <UiV2Page title="物流发货" description="区分发货任务与物流记录；本地记录可安全创建，顺丰仅支持预览。">
    <template #actions>
      <BaseButton variant="secondary" :loading="sfPreview?.loading || false" @click="previewShipment('page-action')">顺丰预览</BaseButton>
      <BaseButton @click="previewLogisticsLocalRecordCreate">新增本地发货记录</BaseButton>
    </template>
    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>
    <section v-if="sfPreview?.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="logistics-page-sf-preview">
      <div><span>顺丰预览</span><strong>不真实下单</strong></div>
      <div><span>模式</span><strong>{{ sfPreview.view.mode }}</strong></div>
      <div><span>预览模式</span><strong>{{ sfPreview.view.externalPreviewModeLabel }}</strong></div>
      <div><span>持久化</span><strong>{{ sfPreview.view.persistenceLabel }}</strong></div>
      <div><span>执行门禁</span><strong>{{ sfPreview.view.executeLabel }}</strong></div>
      <div><span>数据写入</span><strong>{{ sfPreview.view.writeWillExecute }}</strong></div>
      <div><span>外部调用</span><strong>{{ sfPreview.view.externalCallWillExecute }}</strong></div>
      <div><span>审计记录</span><strong>{{ sfPreview.view.auditLabel }}</strong></div>
      <div><span>确认令牌</span><strong>{{ sfPreview.view.confirmLabel }}</strong></div>
      <div><span>幂等保护</span><strong>{{ sfPreview.view.idempotencyLabel }}</strong></div>
      <div><span>外部网关</span><strong>{{ sfPreview.view.externalGatewayLabel }}</strong></div>
      <div><span>模拟运单</span><strong>{{ sfPreview.view.mockWaybillLabel }}</strong></div>
      <div><span>沙盒报文</span><strong>{{ sfPreview.view.sandboxPayloadLabel }}</strong></div>
      <div><span>开放状态</span><strong>{{ sfPreviewStatusLabel }}</strong></div>
      <div><span>说明</span><strong>外部真实调用未开放 / 模拟/沙盒预览</strong></div>
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
    <FilterBar title="物流筛选" hint="按发货任务、物流记录、订单、客户和轨迹筛选">
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、运单号" />
        <BaseSelect v-model="status" label="物流状态" :options="logisticsTabs" />
      </div>
    </FilterBar>
    <DataTable
      :columns="columns"
      :rows="pagedWaybills"
      row-key="id"
      :selected-key="selectedWaybill?.id || ''"
      compact
      :empty-title="loading ? '物流只读数据读取中' : '暂无物流记录'"
      @row-click="openWaybill"
    >
      <template #orderId="{ row }"><strong>{{ row.orderId }}</strong></template>
      <template #customerName="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.model }}</small></div></template>
      <template #logisticsStage="{ row }"><StatusBadge :label="row.logisticsStage" size="sm" /></template>
      <template #trackingNo="{ row }">{{ row.trackingNo || '暂无记录' }}</template>
      <template #amountLabel="{ row }">{{ row.amountLabel }}</template>
      <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
    </DataTable>
    <Pagination v-model:page="page" :total="filteredWaybills.length" :page-size="pageSize" />
    <BaseDrawer v-model="drawerOpen" :title="selectedWaybill?.entityType || '物流详情'" :subtitle="selectedWaybill?.orderId || ''" width="640" test-id="logistics-waybill-drawer">
      <div v-if="selectedWaybill" class="ui-v2-stack">
        <DrawerSummary :status="selectedWaybill.logisticsStage" :title="selectedWaybill.customerName" :description="`${selectedWaybill.model} · ${selectedWaybill.latestTrace}`" :meta="`${selectedWaybill.carrier} · ${selectedWaybill.trackingNo || '暂无记录'} · 不真实下单`" primary-label="顺丰预览" secondary-label="真实调用未开放" @primary="previewShipment('drawer-action')" @secondary="previewShipment('drawer-secondary')" />
        <section class="final-drawer-card sf-preview-gateway" data-testid="logistics-sf-preview-gateway">
          <div class="sf-preview-gateway__head">
            <div>
              <span>顺丰预览</span>
              <strong>真实外部已关闭，仅支持模拟/沙盒预览</strong>
            </div>
            <span>不真实下单 · 不调用外部服务</span>
          </div>
          <div class="sf-preview-gateway__controls">
            <BaseSelect v-model="sfPreviewMode" label="预览模式" :options="sfPreviewModeOptions" />
            <BaseButton size="sm" :loading="sfPreview?.loading || false" @click="previewShipment('drawer-mode-action')">生成顺丰预览</BaseButton>
            <BaseButton size="sm" variant="secondary" disabled>真实下单未开放</BaseButton>
          </div>
          <p class="safeops-note">当前仅生成模拟/沙盒预览；真实模式始终关闭；不会写本地发货记录；不会更新订单或档期。</p>
        </section>
        <section v-if="sfPreview?.view" class="final-drawer-card ui-v2-detail-grid" data-testid="logistics-sf-safeops-preview">
          <div><span>顺丰预览</span><strong>不真实下单</strong></div>
          <div><span>模式</span><strong>{{ sfPreview.view.mode }}</strong></div>
          <div><span>预览模式</span><strong>{{ sfPreview.view.externalPreviewModeLabel }}</strong></div>
          <div><span>持久化</span><strong>{{ sfPreview.view.persistenceLabel }}</strong></div>
          <div><span>执行门禁</span><strong>{{ sfPreview.view.executeLabel }}</strong></div>
          <div><span>数据写入</span><strong>{{ sfPreview.view.writeWillExecute }}</strong></div>
          <div><span>外部调用</span><strong>{{ sfPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>审计记录</span><strong>{{ sfPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ sfPreview.view.riskLevel }}</strong></div>
          <div><span>确认令牌</span><strong>{{ sfPreview.view.confirmLabel }}</strong></div>
          <div><span>幂等保护</span><strong>{{ sfPreview.view.idempotencyLabel }}</strong></div>
          <div><span>外部网关</span><strong>{{ sfPreview.view.externalGatewayLabel }}</strong></div>
          <div><span>请求预览</span><strong>{{ sfPreview.view.requestPayloadPreviewLabel }}</strong></div>
          <div><span>模拟运单</span><strong>{{ sfPreview.view.mockWaybillLabel }}</strong></div>
          <div><span>沙盒报文</span><strong>{{ sfPreview.view.sandboxPayloadLabel }}</strong></div>
          <div><span>开放状态</span><strong>{{ sfPreviewStatusLabel }}</strong></div>
        </section>
        <section class="final-drawer-card logistics-local-record" data-testid="logistics-local-record-safeops">
          <div class="logistics-local-record__head">
            <div>
              <span>本地发货记录</span>
              <strong>本地发货记录</strong>
            </div>
            <span>需要确认 · 已审计 · 自动回滚暂不可执行</span>
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
            <BaseButton size="sm" :loading="shipmentPreview?.loading || false" @click="previewLogisticsLocalRecordCreate">本地记录预览</BaseButton>
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
          <p class="safeops-note">只写本地发货记录；不调用顺丰；不调用外部接口；不更新订单状态。</p>
          <p v-if="shipmentPreview?.view?.blockedReason" class="adapter-source__error">{{ shipmentPreview.view.blockedReason }}</p>
        </section>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>金额/保价</span><strong>{{ selectedWaybill.amountLabel }}</strong></div>
          <div><span>寄出时间</span><strong>{{ selectedWaybill.sentAt }}</strong></div>
          <div><span>预计送达</span><strong>{{ selectedWaybill.expectedArriveAt }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedWaybill.nextAction }}</strong></div>
        </section>
        <UiV2Section title="物流时间线"><TrackingTimeline :steps="selectedWaybill.timeline" /></UiV2Section>
        <UiV2Section title="安全说明"><p class="safeops-note">外部真实调用未开放；真实外部已关闭；不会调用顺丰；不会产生外部费用。</p></UiV2Section>
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
import { DrawerSummary, MetricCard, Pagination, TrackingTimeline } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { safeOpsAdapter } from '../../../adapters/uiV2/safeOpsAdapter.js'
import { createSafeOpsPreviewState, toSafeOpsPreviewView } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import { buildSafeOpsActor } from '../../../adapters/uiV2/actorContextAdapter.js'
import { filterLogisticsRows, normalizeLogisticsRows, paginateLogisticsRows } from '../../../adapters/uiV2/logisticsTaskMapper.js'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const waybills = ref([])
const keyword = ref('')
const status = ref('待创建运单')
const page = ref(1)
const pageSize = 20
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
const logisticsTabs = ['待创建运单', '待揽收', '运输中', '已签收', '异常', '历史记录', '全部']
const safeOpsActor = buildSafeOpsActor('ui-v2-logistics')
const sfPreviewModeOptions = [
  { label: '默认关闭', value: 'disabled' },
  { label: '模拟预览（不真实下单）', value: 'mock' },
  { label: '沙盒预览（不发送请求）', value: 'sandbox' },
  { label: '真实模式（已关闭）', value: 'real' },
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
  { key: 'logisticsStage', label: '物流阶段' },
  { key: 'carrier', label: '承运商' },
  { key: 'trackingNo', label: '运单号' },
  { key: 'sentAt', label: '寄出时间' },
  { key: 'expectedArriveAt', label: '预计送达' },
  { key: 'latestTrace', label: '最近轨迹' },
  { key: 'risk', label: '风险' },
  { key: 'nextAction', label: '下一步' },
]
const metrics = computed(() => [
  { key: 'task', label: '待创建运单', value: countStatus('待创建运单'), unit: '单', trend: '发货任务', tone: 'warning' },
  { key: 'pickup', label: '待揽收', value: countStatus('待揽收'), unit: '单', trend: '物流记录', tone: 'warning' },
  { key: 'moving', label: '运输中', value: countStatus('运输中'), unit: '单', trend: '物流记录', tone: 'info' },
  { key: 'signed', label: '已签收', value: countStatus('已签收'), unit: '单', trend: '历史记录', tone: 'success' },
  { key: 'exception', label: '异常物流', value: countStatus('异常'), unit: '单', trend: '需人工复核', tone: 'danger' },
  { key: 'records', label: '物流记录', value: waybills.value.filter((item) => item.entityType !== '发货任务').length, unit: '条', trend: `任务 ${countStatus('待创建运单')}`, tone: 'info' },
])
const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})
const filteredWaybills = computed(() => filterLogisticsRows(waybills.value, { status: status.value, keyword: keyword.value }))
const pagedWaybills = computed(() => paginateLogisticsRows(filteredWaybills.value, page.value, pageSize))
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
  if (!result.operationType) return '默认关闭'
  if (result.externalPreviewMode === 'mock') return '模拟预览，不真实下单'
  if (result.externalPreviewMode === 'sandbox') return '沙盒预览，不发送请求'
  if (result.externalPreviewMode === 'real') return '真实模式已关闭，禁止真实调用'
  return '真实外部已关闭 / 不真实下单'
})
function countStatus(nextStatus) {
  return waybills.value.filter((item) => item.logisticsStage === nextStatus).length
}
function openWaybill(item) {
  selectedWaybill.value = item
  syncLocalRecordForm(item)
  drawerOpen.value = true
}
function syncLocalRecordForm(item = {}) {
  localRecordForm.value = {
    ...localRecordForm.value,
    orderId: item?.rawOrderId ? String(item.rawOrderId) : String(item?.orderId || ''),
    trackingNo: item?.trackingNo && item.trackingNo !== '暂无记录' ? item.trackingNo : localRecordForm.value.trackingNo,
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
    orderId: localRecordForm.value.orderId || (source?.rawOrderId ? String(source.rawOrderId) : String(source?.orderId || '')),
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
    orderId: source?.rawOrderId ? String(source.rawOrderId) : String(source?.orderId || ''),
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
    waybills.value = normalizeLogisticsRows(nextWaybills)
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
