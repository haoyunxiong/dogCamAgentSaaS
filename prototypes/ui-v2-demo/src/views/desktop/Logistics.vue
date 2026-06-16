<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">物流发货</h1>
          <p class="page-desc">集中处理待下单、待揽收、运输中和异常运单。</p>
        </div>
        <BaseButton variant="secondary">创建寄件</BaseButton>
      </header>

      <section class="metric-grid">
        <MetricCard v-for="metric in logisticsKpis" :key="metric.key" :metric="metric" />
      </section>

      <FilterBar>
        <BaseInput v-model="keyword" placeholder="搜索订单、运单、客户" />
        <StatusTabs v-model="shippingStatus" :items="shippingTabs" />
      </FilterBar>

      <BaseTable
        :columns="columns"
        :rows="filteredWaybills"
        row-key="id"
        :selected-key="selectedWaybill?.id || ''"
        @row-click="selectedWaybill = $event"
      >
        <template #id="{ row }">
          <strong class="mono">{{ row.id }}</strong>
        </template>
        <template #customerName="{ row }">
          <div class="cell-stack">
            <strong>{{ row.customerName }}</strong>
            <small>{{ row.model }}</small>
          </div>
        </template>
        <template #shippingStatus="{ row }">
          <StatusTag :label="row.shippingStatus" />
        </template>
        <template #trackingNo="{ row }">
          {{ row.trackingNo || '未生成' }}
        </template>
        <template #insuredAmount="{ row }">
          ¥{{ row.insuredAmount.toLocaleString() }}
        </template>
      </BaseTable>
    </div>

    <Drawer
      :open="Boolean(selectedWaybill)"
      :title="selectedWaybill?.id || '发货详情'"
      :description="selectedWaybill ? `${selectedWaybill.orderId} · ${selectedWaybill.customerName}` : ''"
      @close="selectedWaybill = null"
    >
      <div v-if="selectedWaybill" class="drawer-stack">
        <DrawerSummary
          :status="selectedWaybill.shippingStatus"
          :title="selectedWaybill.carrier"
          :description="selectedWaybill.trackingNo || '待生成运单号'"
          :meta="`${selectedWaybill.orderId} · ${selectedWaybill.customerName}`"
          primary-label="更新物流状态"
          secondary-label="查看订单"
        />
        <section class="detail-grid">
          <div><span>收件人</span><strong>{{ selectedWaybill.receiver }}</strong></div>
          <div><span>预约揽收</span><strong>{{ selectedWaybill.pickupTime }}</strong></div>
          <div><span>保价金额</span><strong>¥{{ selectedWaybill.insuredAmount.toLocaleString() }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedWaybill.nextAction }}</strong></div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h3 class="section-title">物流轨迹</h3>
          </div>
          <div class="panel-body">
            <TrackingTimeline :steps="selectedWaybill.timeline" />
          </div>
        </section>
      </div>
    </Drawer>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseInput from '../../components/BaseInput.vue'
import BaseTable from '../../components/BaseTable.vue'
import Drawer from '../../components/Drawer.vue'
import DrawerSummary from '../../components/DrawerSummary.vue'
import FilterBar from '../../components/FilterBar.vue'
import MetricCard from '../../components/MetricCard.vue'
import StatusTabs from '../../components/StatusTabs.vue'
import StatusTag from '../../components/StatusTag.vue'
import TrackingTimeline from '../../components/TrackingTimeline.vue'
import { logisticsKpis, waybills } from '../../mock/logistics.js'

const keyword = ref('')
const shippingStatus = ref('全部状态')
const selectedWaybill = ref(null)
const columns = [
  { key: 'id', label: '运单' },
  { key: 'orderId', label: '订单号' },
  { key: 'customerName', label: '客户/设备' },
  { key: 'shippingStatus', label: '物流状态' },
  { key: 'trackingNo', label: '快递单号' },
  { key: 'pickupTime', label: '揽收窗口' },
  { key: 'insuredAmount', label: '保价' },
  { key: 'nextAction', label: '下一步' }
]

const shippingTabs = computed(() => ['全部状态', '待下单', '待揽收', '运输中', '已签收', '异常'].map((item) => ({
  label: item,
  value: item,
  count: item === '全部状态' ? waybills.length : waybills.filter((waybill) => waybill.shippingStatus === item).length
})))

const filteredWaybills = computed(() => waybills.filter((waybill) => {
  const text = `${waybill.id}${waybill.orderId}${waybill.customerName}${waybill.trackingNo}${waybill.model}`
  const matchStatus = shippingStatus.value === '全部状态' || waybill.shippingStatus === shippingStatus.value
  return matchStatus && (!keyword.value || text.includes(keyword.value))
}))
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
</style>
