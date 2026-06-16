<template>
  <UiV2Page title="物流发货" description="顺丰寄件 mock 工作台，聚合运单、揽收、运输和异常处理。">
    <template #actions><BaseButton>创建顺丰寄件</BaseButton></template>
    <section class="ui-v2-metric-grid"><MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" /></section>
    <FilterBar>
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、运单号" />
        <BaseSelect v-model="status" label="物流状态" :options="['全部状态', '待下单', '待揽收', '运输中', '已签收', '异常']" />
      </div>
    </FilterBar>
    <DataTable :columns="columns" :rows="filteredWaybills" row-key="id" :selected-key="selectedWaybill?.id || ''" compact @row-click="openWaybill">
      <template #orderId="{ row }"><strong>{{ row.orderId }}</strong></template>
      <template #customerName="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.model }}</small></div></template>
      <template #shippingStatus="{ row }"><StatusBadge :label="row.shippingStatus" size="sm" /></template>
      <template #trackingNo="{ row }">{{ row.trackingNo || '待生成' }}</template>
      <template #insuredAmount="{ row }">¥{{ row.insuredAmount.toLocaleString() }}</template>
      <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
    </DataTable>
    <BaseDrawer v-model="drawerOpen" :title="selectedWaybill?.id || '运单详情'" :subtitle="selectedWaybill?.orderId || ''" width="560">
      <div v-if="selectedWaybill" class="ui-v2-stack">
        <DrawerSummary :status="selectedWaybill.shippingStatus" :title="selectedWaybill.customerName" :description="selectedWaybill.receiverAddress" :meta="`${selectedWaybill.carrier} · ${selectedWaybill.trackingNo || '待生成'}`" primary-label="更新物流状态" secondary-label="联系顺丰" />
        <section class="ui-v2-detail-grid">
          <div><span>保价金额</span><strong>¥{{ selectedWaybill.insuredAmount.toLocaleString() }}</strong></div>
          <div><span>揽收时间</span><strong>{{ selectedWaybill.pickupTime }}</strong></div>
          <div><span>订单状态</span><strong>{{ selectedWaybill.orderStatus }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedWaybill.nextAction }}</strong></div>
        </section>
        <UiV2Section title="物流时间线"><TrackingTimeline :steps="selectedWaybill.timeline" /></UiV2Section>
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
import { DrawerSummary, MetricCard, TrackingTimeline } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const waybills = uiV2MockAdapter.getWaybills()
const keyword = ref('')
const status = ref('全部状态')
const selectedWaybill = ref(null)
const drawerOpen = ref(false)
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
  { key: 'today', label: '今日运单', value: waybills.length, unit: '单', trend: 'mock 运单池', tone: 'info' },
  { key: 'pickup', label: '待揽收', value: countStatus('待揽收'), unit: '单', trend: '需盯揽收', tone: 'warning' },
  { key: 'moving', label: '运输中', value: countStatus('运输中'), unit: '单', trend: '跟踪轨迹', tone: 'info' },
  { key: 'exception', label: '物流异常', value: countStatus('异常'), unit: '单', trend: '优先处理', tone: 'danger' },
])
const filteredWaybills = computed(() => waybills.filter((item) => {
  const text = `${item.orderId}${item.customerName}${item.model}${item.trackingNo}`
  return (status.value === '全部状态' || item.shippingStatus === status.value) && (!keyword.value || text.includes(keyword.value))
}))
function countStatus(nextStatus) {
  return waybills.filter((item) => item.shippingStatus === nextStatus).length
}
function openWaybill(item) {
  selectedWaybill.value = item
  drawerOpen.value = true
}
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.2fr minmax(200px, 0.5fr);
  gap: var(--space-12);
  align-items: end;
}
.next-action { color: var(--color-primary); font-weight: 720; }
</style>
