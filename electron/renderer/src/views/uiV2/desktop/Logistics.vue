<template>
  <UiV2Page title="物流发货" description="物流只读可视化，展示运单、揽收、运输和异常状态。">
    <template #actions><BaseButton @click="previewShipment('page-action')">发货预览</BaseButton></template>
    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="sourceMeta.fallbackReason" class="adapter-source__reason">{{ sourceMeta.fallbackReason }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>
    <section v-if="shipmentPreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="logistics-page-safeops-preview">
      <div><span>操作预览</span><strong>dry-run only</strong></div>
      <div><span>开放状态</span><strong>暂未开放</strong></div>
      <div><span>writeWillExecute</span><strong>{{ shipmentPreview.view.writeWillExecute }}</strong></div>
      <div><span>externalCallWillExecute</span><strong>{{ shipmentPreview.view.externalCallWillExecute }}</strong></div>
      <div><span>audit</span><strong>{{ shipmentPreview.view.auditLabel }}</strong></div>
      <div><span>说明</span><strong>不会写入 / 不会调用外部服务</strong></div>
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
        <DrawerSummary :status="selectedWaybill.shippingStatus" :title="selectedWaybill.customerName" :description="selectedWaybill.receiverAddress" :meta="`${selectedWaybill.carrier} · ${selectedWaybill.trackingNo || '待生成'} · dry-run only`" primary-label="发货预览" secondary-label="暂未开放" @primary="previewShipment('drawer-action')" @secondary="previewShipment('drawer-secondary')" />
        <section v-if="shipmentPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="logistics-safeops-preview">
          <div><span>操作预览</span><strong>dry-run only</strong></div>
          <div><span>开放状态</span><strong>暂未开放</strong></div>
          <div><span>writeWillExecute</span><strong>{{ shipmentPreview.view.writeWillExecute }}</strong></div>
          <div><span>externalCallWillExecute</span><strong>{{ shipmentPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>audit</span><strong>{{ shipmentPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ shipmentPreview.view.riskLevel }}</strong></div>
        </section>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>保价金额</span><strong>¥{{ Number(selectedWaybill.insuredAmount || 0).toLocaleString() }}</strong></div>
          <div><span>揽收时间</span><strong>{{ selectedWaybill.pickupTime }}</strong></div>
          <div><span>订单状态</span><strong>{{ selectedWaybill.orderStatus }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedWaybill.nextAction }}</strong></div>
        </section>
        <UiV2Section title="物流时间线"><TrackingTimeline :steps="selectedWaybill.timeline" /></UiV2Section>
        <UiV2Section title="安全说明"><p class="safeops-note">dry-run only；暂未开放；不会写入；不会调用外部服务。</p></UiV2Section>
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
import { createSafeOpsPreviewState, runSafeOpsPreview } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
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
const shipmentPreview = ref(createSafeOpsPreviewState())
const sourceMeta = ref(uiV2Adapter.getMeta())
const logisticsTabs = ['全部', '待下单', '待揽收', '运输中', '已签收', '异常', '已取消']
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
function countStatus(nextStatus) {
  return waybills.value.filter((item) => item.shippingStatus === nextStatus).length
}
function openWaybill(item) {
  selectedWaybill.value = item
  drawerOpen.value = true
}
async function previewShipment(reason) {
  shipmentPreview.value = { ...shipmentPreview.value, loading: true, error: '' }
  shipmentPreview.value = await runSafeOpsPreview('logistics.shipment.preview', {
    target: {
      waybillId: selectedWaybill.value?.id || '',
      orderId: selectedWaybill.value?.orderId || '',
    },
    payload: {
      reason,
      source: 'logistics-page',
    },
  })
}
async function loadWaybills() {
  loading.value = true
  loadError.value = ''
  try {
    const nextWaybills = await uiV2Adapter.getWaybills()
    waybills.value = Array.isArray(nextWaybills) ? nextWaybills : []
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
</style>
