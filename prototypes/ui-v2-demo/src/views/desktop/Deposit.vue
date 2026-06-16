<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">免押管理</h1>
          <p class="page-desc">审核免押队列，查看风险状态、押金状态和处理动作。</p>
        </div>
        <BaseButton variant="secondary">批量复核</BaseButton>
      </header>

      <section class="metric-grid">
        <MetricCard v-for="metric in depositKpis" :key="metric.key" :metric="metric" />
      </section>

      <FilterBar>
        <BaseInput v-model="keyword" placeholder="搜索订单、客户、设备" />
        <BaseSelect v-model="risk" label="风险" :options="riskOptions" />
        <StatusTabs v-model="reviewStatus" :items="reviewTabs" />
      </FilterBar>

      <BaseTable
        :columns="columns"
        :rows="filteredReviews"
        row-key="id"
        :selected-key="selectedReview?.id || ''"
        @row-click="selectedReview = $event"
      >
        <template #orderNo="{ row }">
          <strong class="mono">{{ row.orderNo }}</strong>
        </template>
        <template #customerName="{ row }">
          <div class="cell-stack">
            <strong>{{ row.customerName }}</strong>
            <small>{{ row.channel }} · {{ row.phoneMasked }}</small>
          </div>
        </template>
        <template #reviewStatus="{ row }">
          <StatusTag :label="row.reviewStatus" />
        </template>
        <template #riskLevel="{ row }">
          <StatusTag :label="row.riskLevel" />
        </template>
        <template #requestedFreeAmount="{ row }">
          ¥{{ row.requestedFreeAmount.toLocaleString() }}
        </template>
        <template #depositStatus="{ row }">
          <StatusTag :label="row.depositStatus" />
        </template>
      </BaseTable>
    </div>

    <Drawer
      :open="Boolean(selectedReview)"
      :title="selectedReview?.orderNo || '免押审核详情'"
      :description="selectedReview ? `${selectedReview.customerName} · ${selectedReview.model}` : ''"
      @close="selectedReview = null"
    >
      <div v-if="selectedReview" class="drawer-stack">
        <DrawerSummary
          :status="selectedReview.reviewStatus"
          :title="selectedReview.customerName"
          :description="`${selectedReview.model} · ${selectedReview.rentPeriod}`"
          :meta="`${selectedReview.orderNo} · ${selectedReview.phoneMasked}`"
          primary-label="通过免押"
          danger-label="驳回"
        />
        <section class="detail-grid">
          <div><span>免押金额</span><strong>¥{{ selectedReview.requestedFreeAmount.toLocaleString() }}</strong></div>
          <div><span>押金状态</span><strong>{{ selectedReview.depositStatus }}</strong></div>
          <div><span>风险状态</span><strong>{{ selectedReview.riskLevel }}</strong></div>
          <div><span>负责人</span><strong>{{ selectedReview.assignee }}</strong></div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h3 class="section-title">审核判断</h3>
            <StatusTag :label="selectedReview.riskLevel" />
          </div>
          <div class="panel-body note-text">{{ selectedReview.riskReason }}</div>
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
import BaseSelect from '../../components/BaseSelect.vue'
import BaseTable from '../../components/BaseTable.vue'
import Drawer from '../../components/Drawer.vue'
import DrawerSummary from '../../components/DrawerSummary.vue'
import FilterBar from '../../components/FilterBar.vue'
import MetricCard from '../../components/MetricCard.vue'
import StatusTabs from '../../components/StatusTabs.vue'
import StatusTag from '../../components/StatusTag.vue'
import { depositKpis, depositReviews } from '../../mock/deposits.js'

const keyword = ref('')
const risk = ref('全部风险')
const reviewStatus = ref('全部状态')
const selectedReview = ref(null)
const riskOptions = ['全部风险', '低风险', '中风险', '高风险']
const columns = [
  { key: 'orderNo', label: '订单号' },
  { key: 'customerName', label: '客户/渠道' },
  { key: 'reviewStatus', label: '审核状态' },
  { key: 'riskLevel', label: '风险' },
  { key: 'requestedFreeAmount', label: '免押金额' },
  { key: 'depositStatus', label: '押金状态' },
  { key: 'assignee', label: '负责人' },
  { key: 'nextAction', label: '下一步' }
]

const reviewTabs = computed(() => ['全部状态', '待审核', '待复核', '已通过', '已拒绝'].map((item) => ({
  label: item,
  value: item,
  count: item === '全部状态' ? depositReviews.length : depositReviews.filter((review) => review.reviewStatus === item).length
})))

const filteredReviews = computed(() => depositReviews.filter((review) => {
  const text = `${review.orderNo}${review.customerName}${review.model}${review.phoneMasked}`
  const matchRisk = risk.value === '全部风险' || review.riskLevel === risk.value
  const matchStatus = reviewStatus.value === '全部状态' || review.reviewStatus === reviewStatus.value
  return matchRisk && matchStatus && (!keyword.value || text.includes(keyword.value))
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

.note-text {
  color: var(--text-soft);
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-8);
}
</style>
