<template>
  <UiV2Page title="免押管理" description="审核免押队列，查看风险状态、押金状态和处理动作。">
    <template #actions><BaseButton variant="secondary">批量复核</BaseButton></template>
    <section class="ui-v2-metric-grid"><MetricCard v-for="metric in depositMetrics" :key="metric.key" :metric="metric" /></section>
    <FilterBar>
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、设备" />
        <BaseSelect v-model="risk" label="风险" :options="['全部风险', '低', '中', '高']" />
        <BaseSelect v-model="reviewStatus" label="审核状态" :options="['全部状态', '待审核', '待复核', '已通过', '已拒绝']" />
      </div>
    </FilterBar>
    <DataTable :columns="columns" :rows="filteredReviews" row-key="id" :selected-key="selectedReview?.id || ''" compact @row-click="openReview">
      <template #orderNo="{ row }"><strong>{{ row.orderNo }}</strong></template>
      <template #customerName="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.channel }} · {{ row.phoneMasked }}</small></div></template>
      <template #reviewStatus="{ row }"><StatusBadge :label="row.reviewStatus" size="sm" /></template>
      <template #riskLevel="{ row }"><StatusBadge :label="row.riskLevel" size="sm" /></template>
      <template #requestedFreeAmount="{ row }">¥{{ row.requestedFreeAmount.toLocaleString() }}</template>
      <template #depositStatus="{ row }"><StatusBadge :label="row.depositStatus" size="sm" /></template>
    </DataTable>
    <BaseDrawer v-model="drawerOpen" :title="selectedReview?.orderNo || '免押审核详情'" :subtitle="selectedReview?.customerName || ''" width="620">
      <div v-if="selectedReview" class="ui-v2-stack">
        <DrawerSummary :status="selectedReview.reviewStatus" :title="selectedReview.customerName" :description="`${selectedReview.model} · ${selectedReview.rentPeriod}`" :meta="`${selectedReview.orderNo} · ${selectedReview.phoneMasked}`" primary-label="通过免押" danger-label="驳回" />
        <section class="ui-v2-detail-grid">
          <div><span>免押金额</span><strong>¥{{ selectedReview.requestedFreeAmount.toLocaleString() }}</strong></div>
          <div><span>押金状态</span><strong>{{ selectedReview.depositStatus }}</strong></div>
          <div><span>风险状态</span><strong>{{ selectedReview.riskLevel }}</strong></div>
          <div><span>负责人</span><strong>{{ selectedReview.assignee }}</strong></div>
        </section>
        <UiV2Section title="审核判断"><p>{{ selectedReview.riskReason }}</p></UiV2Section>
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
import { DrawerSummary, MetricCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const reviews = uiV2MockAdapter.getDepositReviews()
const keyword = ref('')
const risk = ref('全部风险')
const reviewStatus = ref('全部状态')
const selectedReview = ref(null)
const drawerOpen = ref(false)
const columns = [
  { key: 'orderNo', label: '订单号' },
  { key: 'customerName', label: '客户/渠道' },
  { key: 'reviewStatus', label: '审核状态' },
  { key: 'riskLevel', label: '风险' },
  { key: 'requestedFreeAmount', label: '免押金额' },
  { key: 'depositStatus', label: '押金状态' },
  { key: 'assignee', label: '负责人' },
  { key: 'nextAction', label: '下一步' },
]
const depositMetrics = computed(() => [
  { key: 'queue', label: '审核队列', value: reviews.filter((item) => ['待审核', '待复核'].includes(item.reviewStatus)).length, unit: '单', trend: '今日需处理', tone: 'warning' },
  { key: 'approved', label: '已通过', value: reviews.filter((item) => item.reviewStatus === '已通过').length, unit: '单', trend: 'mock 规则', tone: 'success' },
  { key: 'risk', label: '高风险', value: reviews.filter((item) => item.riskLevel === '高').length, unit: '单', trend: '需人工判断', tone: 'danger' },
  { key: 'amount', label: '免押金额', value: reviews.reduce((sum, item) => sum + item.requestedFreeAmount, 0).toLocaleString(), unit: '元', trend: '仅前端展示', tone: 'info' },
])
const filteredReviews = computed(() => reviews.filter((review) => {
  const text = `${review.orderNo}${review.customerName}${review.model}${review.phoneMasked}`
  return (risk.value === '全部风险' || review.riskLevel === risk.value)
    && (reviewStatus.value === '全部状态' || review.reviewStatus === reviewStatus.value)
    && (!keyword.value || text.includes(keyword.value))
}))
function openReview(review) {
  selectedReview.value = review
  drawerOpen.value = true
}
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(2, minmax(180px, 0.6fr));
  gap: var(--space-12);
  align-items: end;
}
</style>
