<template>
  <UiV2Page title="免押管理" description="免押本地缓存只读视图，查看风险状态、押金状态和后续处理提示。">
    <template #actions><BaseButton variant="secondary" :loading="depositPreview.loading" @click="previewDepositCreate('page-action')">免押预览</BaseButton></template>
    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>
    <section v-if="depositPreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="deposit-page-safeops-preview">
      <div><span>免押预览</span><strong>不真实创建/完结</strong></div>
      <div><span>模式</span><strong>{{ depositPreview.view.mode }}</strong></div>
      <div><span>预览模式</span><strong>{{ depositPreview.view.externalPreviewModeLabel }}</strong></div>
      <div><span>开放状态</span><strong>{{ depositPreviewStatusLabel }}</strong></div>
      <div><span>持久化</span><strong>{{ depositPreview.view.persistenceLabel }}</strong></div>
      <div><span>执行门禁</span><strong>{{ depositPreview.view.executeLabel }}</strong></div>
      <div><span>数据写入</span><strong>{{ depositPreview.view.writeWillExecute }}</strong></div>
      <div><span>外部调用</span><strong>{{ depositPreview.view.externalCallWillExecute }}</strong></div>
      <div><span>审计记录</span><strong>{{ depositPreview.view.auditLabel }}</strong></div>
      <div><span>确认令牌</span><strong>{{ depositPreview.view.confirmLabel }}</strong></div>
      <div><span>幂等保护</span><strong>{{ depositPreview.view.idempotencyLabel }}</strong></div>
      <div><span>外部网关</span><strong>{{ depositPreview.view.externalGatewayLabel }}</strong></div>
      <div><span>请求预览</span><strong>{{ depositPreview.view.requestPayloadPreviewLabel }}</strong></div>
      <div><span>免押模拟单</span><strong>{{ depositPreview.view.mockDepositLabel }}</strong></div>
      <div><span>沙盒报文</span><strong>{{ depositPreview.view.sandboxPayloadLabel }}</strong></div>
      <div><span>说明</span><strong>不会写入 / 不会调用免押外部服务</strong></div>
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
        <DrawerSummary :status="selectedReview.reviewStatus" :title="selectedReview.customerName" :description="`${selectedReview.model} · ${selectedReview.rentPeriod}`" :meta="`${selectedReview.orderNo} · 不真实创建/完结`" primary-label="免押预览" danger-label="完结预览" @primary="previewDepositCreate('drawer-create')" @danger="previewDepositFinish('drawer-finish')" />
        <section class="final-drawer-card deposit-preview-gateway" data-testid="deposit-preview-gateway">
          <div class="deposit-preview-gateway__head">
            <div>
              <span>免押预览</span>
              <strong>真实外部已关闭，仅支持模拟/沙盒预览</strong>
            </div>
            <span>不真实创建免押 · 不真实完结免押</span>
          </div>
          <div class="deposit-preview-gateway__controls">
            <BaseSelect v-model="depositPreviewMode" label="预览模式" :options="depositPreviewModeOptions" />
            <BaseButton size="sm" :loading="depositPreview.loading" @click="previewDepositCreate('drawer-mode-create')">创建预览</BaseButton>
            <BaseButton size="sm" variant="secondary" :loading="depositPreview.loading" @click="previewDepositFinish('drawer-mode-finish')">完结预览</BaseButton>
            <BaseButton size="sm" variant="secondary" disabled>真实免押未开放</BaseButton>
          </div>
          <p class="safeops-note">当前仅生成模拟/沙盒预览；真实模式始终关闭；不会新增免押订单；不会写订单表；不会更新档期或资金状态。</p>
        </section>
        <section v-if="depositPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="deposit-safeops-preview">
          <div><span>免押预览</span><strong>不真实创建/完结</strong></div>
          <div><span>模式</span><strong>{{ depositPreview.view.mode }}</strong></div>
          <div><span>预览模式</span><strong>{{ depositPreview.view.externalPreviewModeLabel }}</strong></div>
          <div><span>开放状态</span><strong>{{ depositPreviewStatusLabel }}</strong></div>
          <div><span>持久化</span><strong>{{ depositPreview.view.persistenceLabel }}</strong></div>
          <div><span>执行门禁</span><strong>{{ depositPreview.view.executeLabel }}</strong></div>
          <div><span>数据写入</span><strong>{{ depositPreview.view.writeWillExecute }}</strong></div>
          <div><span>外部调用</span><strong>{{ depositPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>审计记录</span><strong>{{ depositPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ depositPreview.view.riskLevel }}</strong></div>
          <div><span>确认令牌</span><strong>{{ depositPreview.view.confirmLabel }}</strong></div>
          <div><span>幂等保护</span><strong>{{ depositPreview.view.idempotencyLabel }}</strong></div>
          <div><span>外部网关</span><strong>{{ depositPreview.view.externalGatewayLabel }}</strong></div>
          <div><span>请求预览</span><strong>{{ depositPreview.view.requestPayloadPreviewLabel }}</strong></div>
          <div><span>免押模拟单</span><strong>{{ depositPreview.view.mockDepositLabel }}</strong></div>
          <div><span>沙盒报文</span><strong>{{ depositPreview.view.sandboxPayloadLabel }}</strong></div>
        </section>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>免押金额</span><strong>¥{{ Number(selectedReview.requestedFreeAmount || 0).toLocaleString() }}</strong></div>
          <div><span>押金状态</span><strong>{{ selectedReview.depositStatus }}</strong></div>
          <div><span>风险状态</span><strong>{{ selectedReview.riskLevel }}</strong></div>
          <div><span>负责人</span><strong>{{ selectedReview.assignee }}</strong></div>
        </section>
        <UiV2Section title="审核判断"><p>{{ selectedReview.riskReason }}</p></UiV2Section>
        <UiV2Section title="安全说明"><p class="safeops-note">外部真实调用未开放；真实外部已关闭；不会调用免押服务；不会改变外部信用或资金相关状态。</p></UiV2Section>
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
import { safeOpsAdapter } from '../../../adapters/uiV2/safeOpsAdapter.js'
import { createSafeOpsPreviewState, toSafeOpsPreviewView } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import { buildSafeOpsActor } from '../../../adapters/uiV2/actorContextAdapter.js'
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
const depositPreviewMode = ref('disabled')
const sourceMeta = ref(uiV2Adapter.getMeta())
const safeOpsActor = buildSafeOpsActor('ui-v2-deposit')
const depositPreviewModeOptions = [
  { label: '默认关闭', value: 'disabled' },
  { label: '模拟预览（不真实创建/完结）', value: 'mock' },
  { label: '沙盒预览（不发送请求）', value: 'sandbox' },
  { label: '真实模式（已关闭）', value: 'real' },
]
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
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
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
const depositPreviewStatusLabel = computed(() => {
  const result = depositPreview.value?.result || {}
  if (!result.operationType) return '默认关闭'
  if (result.externalPreviewMode === 'mock') return '模拟预览，不真实创建或完结'
  if (result.externalPreviewMode === 'sandbox') return '沙盒预览，不发送请求'
  if (result.externalPreviewMode === 'real') return '真实模式已关闭，禁止真实调用'
  return '真实外部已关闭 / 不真实创建或完结'
})
function openReview(review) {
  selectedReview.value = review
  drawerOpen.value = true
}
function getDepositSource() {
  return selectedReview.value || filteredReviews.value[0] || reviews.value[0] || {}
}
function toDepositPreviewState(result = {}) {
  const view = toSafeOpsPreviewView(result)
  return {
    loading: false,
    result,
    view,
    error: result?.ok ? '' : view.summary,
  }
}
function buildDepositPreviewPayload(reason) {
  const source = getDepositSource()
  return {
    mode: depositPreviewMode.value,
    orderId: source?.meta?.rawOrderId ? String(source.meta.rawOrderId) : String(source?.orderNo || ''),
    orderNo: String(source?.orderNo || ''),
    reviewId: String(source?.id || ''),
    depositOrderId: String(source?.depositOrderId || source?.depositNo || ''),
    modelCode: String(source?.model || ''),
    customerName: String(source?.customerName || ''),
    requestedFreeAmount: source?.requestedFreeAmount || '',
    depositAmount: source?.depositAmount || '',
    riskLevel: String(source?.riskLevel || ''),
    reviewStatus: String(source?.reviewStatus || ''),
    depositStatus: String(source?.depositStatus || ''),
    finishReason: String(reason || ''),
    service: {
      productCode: 'deposit_free_preview',
      scenario: 'rental_deposit_free_preview',
    },
    actor: safeOpsActor,
    reason,
  }
}
async function previewDepositCreate(reason) {
  depositPreview.value = { ...depositPreview.value, loading: true, error: '' }
  const result = await safeOpsAdapter.previewDepositCreate({
    ...buildDepositPreviewPayload(reason),
    clientRequestId: `ui-v2-deposit-create-preview-${Date.now()}`,
  })
  depositPreview.value = toDepositPreviewState(result)
}

async function previewDepositFinish(reason = 'drawer-finish') {
  depositPreview.value = { ...depositPreview.value, loading: true, error: '' }
  const result = await safeOpsAdapter.previewDepositFinish({
    ...buildDepositPreviewPayload(reason),
    clientRequestId: `ui-v2-deposit-finish-preview-${Date.now()}`,
  })
  depositPreview.value = toDepositPreviewState(result)
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
.deposit-preview-gateway {
  gap: 12px;
}
.deposit-preview-gateway__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}
.deposit-preview-gateway__head div {
  display: grid;
  gap: 2px;
}
.deposit-preview-gateway__head strong {
  color: var(--ui-text);
  font-size: 13px;
}
.deposit-preview-gateway__controls {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto auto;
  gap: 8px;
  align-items: end;
}
.safeops-note {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 680;
}
@media (max-width: 720px) {
  .deposit-preview-gateway__controls {
    grid-template-columns: 1fr;
  }
}
</style>
