<template>
  <UiV2Page title="物流发货" description="顺丰寄件 mock 工作台，聚合运单、揽收、运输和异常处理。">
    <template #actions><BaseButton>创建顺丰寄件</BaseButton></template>
    <section class="ui-v2-metric-grid"><MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" /></section>
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
    <DataTable :columns="columns" :rows="filteredWaybills" row-key="id" :selected-key="selectedWaybill?.id || ''" compact @row-click="openWaybill">
      <template #orderId="{ row }"><strong>{{ row.orderId }}</strong></template>
      <template #customerName="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.model }}</small></div></template>
      <template #shippingStatus="{ row }"><StatusBadge :label="row.shippingStatus" size="sm" /></template>
      <template #trackingNo="{ row }">{{ row.trackingNo || '待生成' }}</template>
      <template #insuredAmount="{ row }">¥{{ row.insuredAmount.toLocaleString() }}</template>
      <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
    </DataTable>
    <BaseDrawer v-model="drawerOpen" :title="selectedWaybill?.id || '运单详情'" :subtitle="selectedWaybill?.orderId || ''" width="560" test-id="logistics-waybill-drawer">
      <div v-if="selectedWaybill" class="ui-v2-stack">
        <DrawerSummary :status="selectedWaybill.shippingStatus" :title="selectedWaybill.customerName" :description="selectedWaybill.receiverAddress" :meta="`${selectedWaybill.carrier} · ${selectedWaybill.trackingNo || '待生成'}`" primary-label="更新物流状态" secondary-label="联系顺丰" />
        <section class="final-drawer-card ui-v2-detail-grid">
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
const status = ref('全部')
const selectedWaybill = ref(null)
const drawerOpen = ref(false)
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
  { key: 'ship', label: '待发货', value: 28, unit: '', trend: '较昨日 -6', tone: 'warning' },
  { key: 'pickup', label: '待揽收', value: 36, unit: '', trend: '较昨日 +8', tone: 'warning' },
  { key: 'moving', label: '运输中', value: 152, unit: '', trend: '较昨日 +12', tone: 'info' },
  { key: 'signed', label: '待签收', value: 68, unit: '', trend: '较昨日 -5', tone: 'success' },
  { key: 'exception', label: '异常物流', value: 9, unit: '', trend: '较昨日 +2', tone: 'danger' },
  { key: 'today', label: '今日发货量', value: 128, unit: '', trend: '较昨日 +12.6%', tone: 'info' },
])
const filteredWaybills = computed(() => waybills.filter((item) => {
  const text = `${item.orderId}${item.customerName}${item.model}${item.trackingNo}`
  return (status.value === '全部' || item.shippingStatus === status.value) && (!keyword.value || text.includes(keyword.value))
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
