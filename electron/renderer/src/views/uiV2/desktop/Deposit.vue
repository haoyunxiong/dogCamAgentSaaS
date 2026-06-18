<template>
  <UiV2Page title="免押管理" description="免押本地缓存只读视图，查看风险状态、押金状态和后续处理提示。">
    <template #actions><BaseButton variant="secondary" @click="previewDepositCreate('page-action')">创建预览</BaseButton></template>
    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="sourceMeta.fallbackReason" class="adapter-source__reason">{{ sourceMeta.fallbackReason }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>
    <section v-if="depositPreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="deposit-page-safeops-preview">
      <div><span>操作预览</span><strong>dry-run only</strong></div>
      <div><span>开放状态</span><strong>暂未开放</strong></div>
      <div><span>writeWillExecute</span><strong>{{ depositPreview.view.writeWillExecute }}</strong></div>
      <div><span>externalCallWillExecute</span><strong>{{ depositPreview.view.externalCallWillExecute }}</strong></div>
      <div><span>audit</span><strong>{{ depositPreview.view.auditLabel }}</strong></div>
      <div><span>说明</span><strong>不会写入 / 不会调用外部服务</strong></div>
    </section>
    <section class="ui-v2-metric-grid is-four"><MetricCard v-for="metric in depositMetrics" :key="metric.key" :metric="metric" /></section>
    <div v-if="loading" class="adapter-state">免押本地缓存读取中...</div>
    <FilterBar title="审核筛选" hint="该页无最终图，结构从订单中心和系统设置派生">
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、设备" />
        <BaseSelect v-model="risk" label="风险" :options="['全部风险', '低', '中', '高']" />
        <BaseSelect v-model="reviewStatus" label="审核状态" :options="['全部状态', '待审核', '待复核', '已通过', '已拒绝']" />
      </div>
    </FilterBar>
    <DataTable
      :columns="columns"
      :rows="filteredReviews"
      row-key="id"
      :selected-key="selectedReview?.id || ''"
      compact
      :empty-title="loading ? '免押本地缓存读取中' : '暂无免押记录'"
      @row-click="openReview"
    >
      <template #orderNo="{ row }"><strong>{{ row.orderNo }}</strong></template>
      <template #customerName="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.customerName }}</strong><small>{{ row.channel }} · {{ row.phoneMasked }}</small></div></template>
      <template #reviewStatus="{ row }"><StatusBadge :label="row.reviewStatus" size="sm" /></template>
      <template #riskLevel="{ row }"><StatusBadge :label="row.riskLevel" size="sm" /></template>
      <template #requestedFreeAmount="{ row }">¥{{ Number(row.requestedFreeAmount || 0).toLocaleString() }}</template>
      <template #depositStatus="{ row }"><StatusBadge :label="row.depositStatus" size="sm" /></template>
    </DataTable>
    <BaseDrawer v-model="drawerOpen" :title="selectedReview?.orderNo || '免押审核详情'" :subtitle="selectedReview?.customerName || ''" width="620" test-id="deposit-review-drawer">
      <div v-if="selectedReview" class="ui-v2-stack">
        <DrawerSummary :status="selectedReview.reviewStatus" :title="selectedReview.customerName" :description="`${selectedReview.model} · ${selectedReview.rentPeriod}`" :meta="`${selectedReview.orderNo} · dry-run only`" primary-label="创建预览" danger-label="完结预览" @primary="previewDepositCreate('drawer-create')" @danger="previewDepositFinish" />
        <section v-if="depositPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="deposit-safeops-preview">
          <div><span>操作预览</span><strong>dry-run only</strong></div>
          <div><span>开放状态</span><strong>暂未开放</strong></div>
          <div><span>writeWillExecute</span><strong>{{ depositPreview.view.writeWillExecute }}</strong></div>
          <div><span>externalCallWillExecute</span><strong>{{ depositPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>audit</span><strong>{{ depositPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ depositPreview.view.riskLevel }}</strong></div>
        </section>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>免押金额</span><strong>¥{{ Number(selectedReview.requestedFreeAmount || 0).toLocaleString() }}</strong></div>
          <div><span>押金状态</span><strong>{{ selectedReview.depositStatus }}</strong></div>
          <div><span>风险状态</span><strong>{{ selectedReview.riskLevel }}</strong></div>
          <div><span>负责人</span><strong>{{ selectedReview.assignee }}</strong></div>
        </section>
        <UiV2Section title="审核判断"><p>{{ selectedReview.riskReason }}</p></UiV2Section>
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
import { DrawerSummary, MetricCard } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { createSafeOpsPreviewState, runSafeOpsPreview } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const reviews = ref([])
const keyword = ref('')
const risk = ref('全部风险')
const reviewStatus = ref('全部状态')
const selectedReview = ref(null)
const drawerOpen = ref(false)
const loading = ref(false)
const loadError = ref('')
const depositPreview = ref(createSafeOpsPreviewState())
const sourceMeta = ref(uiV2Adapter.getMeta())
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
const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})
const depositMetrics = computed(() => [
  { key: 'queue', label: '审核队列', value: reviews.value.filter((item) => ['待审核', '待复核'].includes(item.reviewStatus)).length, unit: '单', trend: '只读统计', tone: 'warning' },
  { key: 'approved', label: '已通过', value: reviews.value.filter((item) => item.reviewStatus === '已通过').length, unit: '单', trend: sourceLabel.value, tone: 'success' },
  { key: 'risk', label: '高风险', value: reviews.value.filter((item) => item.riskLevel === '高').length, unit: '单', trend: '需人工判断', tone: 'danger' },
  { key: 'amount', label: '免押金额', value: reviews.value.reduce((sum, item) => sum + Number(item.requestedFreeAmount || 0), 0).toLocaleString(), unit: '元', trend: '本地缓存', tone: 'info' },
])
const filteredReviews = computed(() => reviews.value.filter((review) => {
  const text = `${review.orderNo}${review.customerName}${review.model}${review.phoneMasked}`
  return (risk.value === '全部风险' || review.riskLevel === risk.value)
    && (reviewStatus.value === '全部状态' || review.reviewStatus === reviewStatus.value)
    && (!keyword.value || text.includes(keyword.value))
}))
function openReview(review) {
  selectedReview.value = review
  drawerOpen.value = true
}
async function previewDepositCreate(reason) {
  depositPreview.value = { ...depositPreview.value, loading: true, error: '' }
  depositPreview.value = await runSafeOpsPreview('deposit.create.preview', {
    target: {
      orderNo: selectedReview.value?.orderNo || '',
      reviewId: selectedReview.value?.id || '',
    },
    payload: {
      reason,
      source: 'deposit-page',
    },
  })
}

async function previewDepositFinish() {
  depositPreview.value = { ...depositPreview.value, loading: true, error: '' }
  depositPreview.value = await runSafeOpsPreview('deposit.finish.preview', {
    target: {
      orderNo: selectedReview.value?.orderNo || '',
      reviewId: selectedReview.value?.id || '',
    },
    payload: {
      source: 'deposit-drawer',
    },
  })
}
async function loadDepositReviews() {
  loading.value = true
  loadError.value = ''
  try {
    const nextReviews = await uiV2Adapter.getDepositReviews()
    reviews.value = Array.isArray(nextReviews) ? nextReviews : []
    sourceMeta.value = uiV2Adapter.getLastMeta('getDepositReviews')
  } catch (error) {
    reviews.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '免押本地缓存读取失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadDepositReviews)
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(2, minmax(180px, 0.6fr));
  gap: var(--space-12);
  align-items: end;
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
