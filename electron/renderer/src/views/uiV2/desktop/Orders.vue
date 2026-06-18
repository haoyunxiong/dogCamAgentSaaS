<template>
  <UiV2Page title="订单中心" description="按状态、押金、物流和风险推进履约，数据由 UI-V2 adapter 统一提供。">
    <template #actions>
      <BaseButton variant="secondary" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? '收起筛选' : '高级筛选' }}</BaseButton>
      <BaseButton @click="openBulkEditPreview">批量分配预览</BaseButton>
    </template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="sourceMeta.fallbackReason" class="adapter-source__reason">{{ sourceMeta.fallbackReason }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section v-if="orderPreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-page-safeops-preview">
      <div><span>操作预览</span><strong>{{ orderPreview.view.title }}</strong></div>
      <div><span>开放状态</span><strong>暂未开放</strong></div>
      <div><span>execute</span><strong>{{ orderPreview.view.executeLabel }}</strong></div>
      <div><span>writeWillExecute</span><strong>{{ orderPreview.view.writeWillExecute }}</strong></div>
      <div><span>externalCallWillExecute</span><strong>{{ orderPreview.view.externalCallWillExecute }}</strong></div>
      <div><span>audit</span><strong>{{ orderPreview.view.auditLabel }}</strong></div>
      <div><span>confirm</span><strong>{{ orderPreview.view.confirmLabel }}</strong></div>
      <div><span>idempotency</span><strong>{{ orderPreview.view.idempotencyLabel }}</strong></div>
    </section>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in orderMetrics" :key="metric.key" :metric="metric" />
    </section>

    <FilterBar title="订单筛选" hint="按订单号、客户、设备、门店和下单时间筛选" :show-advanced="showAdvanced">
      <StatusTabs v-model="status" :items="statusTabs" />
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、设备" />
        <BaseSelect v-model="channel" label="渠道" :options="['全部渠道', ...options.channels]" />
        <BaseSelect v-model="deposit" label="押金/免押" :options="['全部押金状态', ...options.depositStatuses]" />
      </div>
      <template #advanced>
        <div class="filter-row">
          <BaseSelect v-model="shipping" label="物流" :options="['全部物流状态', ...options.shippingStatuses]" />
          <BaseSelect v-model="risk" label="风险" :options="['全部风险', '正常', '低', '中', '高']" />
          <BaseSelect v-model="assignee" label="负责人" :options="['全部负责人', '阿宁', '小夏', '小顾', '小周']" />
        </div>
      </template>
    </FilterBar>

    <div v-if="loading" class="adapter-state">订单数据读取中...</div>

    <div v-if="selectedRows.length" class="bulk-bar">
      <span>已选择 {{ selectedRows.length }} 单</span>
      <BaseButton variant="secondary" size="sm" @click="openBulkEditPreview">分配预览</BaseButton>
      <BaseButton variant="secondary" size="sm">导出</BaseButton>
      <BaseButton variant="secondary" size="sm" @click="openBulkEditPreview">联系预览</BaseButton>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredOrders"
      row-key="orderNo"
      :selected-key="selectedOrder?.orderNo || ''"
      compact
      :empty-title="loading ? '订单数据读取中' : '暂无匹配订单'"
      @row-click="openOrder"
    >
      <template #select="{ row }">
        <input type="checkbox" :checked="selectedRows.includes(row.orderNo)" @click.stop="toggleRow(row.orderNo)" />
      </template>
      <template #orderNo="{ row }"><strong>{{ row.orderNo }}</strong></template>
      <template #customerName="{ row }">
        <div class="ui-v2-cell-stack">
          <strong>{{ row.customerName }}</strong>
          <small>{{ row.channel }} · {{ row.phoneMasked }}</small>
        </div>
      </template>
      <template #status="{ row }"><StatusBadge :label="row.status" size="sm" /></template>
      <template #rentPeriod="{ row }"><span>{{ row.rentStart.slice(5) }} ~ {{ row.rentEnd.slice(5) }}</span></template>
      <template #rentAmount="{ row }">¥{{ row.rentAmount.toLocaleString() }}</template>
      <template #channel="{ row }"><span>{{ row.channel }}</span></template>
      <template #store="{ row }">{{ row.storeName || '未分配门店' }}</template>
      <template #createdAt="{ row }">{{ row.createdAt ? row.createdAt.slice(5, 16) : '-' }}</template>
      <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
    </DataTable>

    <Pagination v-model:page="page" :total="filteredOrders.length" :page-size="12" />

    <BaseDrawer v-model="drawerOpen" :title="selectedOrder?.orderNo || '订单详情'" :subtitle="drawerSubtitle" width="720" test-id="order-detail-drawer">
      <div v-if="selectedOrder" class="ui-v2-stack">
        <div v-if="detailLoading" class="adapter-state is-compact">订单详情读取中...</div>
        <DrawerSummary
          :status="selectedOrder.status"
          :title="selectedOrder.customerName"
          :description="`${selectedOrder.channel} · ${selectedOrder.model}`"
          :meta="`${selectedOrder.rentStart || '-'} 至 ${selectedOrder.rentEnd || '-'}`"
          primary-label="顺丰预览"
          secondary-label="状态预览"
          danger-label="编辑预览"
          @primary="openShippingPreview"
          @secondary="openStatusPreview"
          @danger="openEditPreview"
        />
        <section v-if="orderPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-action-safeops-preview">
          <div><span>操作预览</span><strong>{{ orderPreview.view.title }}</strong></div>
          <div><span>开放状态</span><strong>暂未开放</strong></div>
          <div><span>execute</span><strong>{{ orderPreview.view.executeLabel }}</strong></div>
          <div><span>writeWillExecute</span><strong>{{ orderPreview.view.writeWillExecute }}</strong></div>
          <div><span>externalCallWillExecute</span><strong>{{ orderPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>audit</span><strong>{{ orderPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ orderPreview.view.riskLevel }}</strong></div>
          <div><span>confirm</span><strong>{{ orderPreview.view.confirmLabel }}</strong></div>
          <div><span>idempotency</span><strong>{{ orderPreview.view.idempotencyLabel }}</strong></div>
        </section>
        <p v-if="orderPreview.error" class="adapter-source__error">{{ orderPreview.error }}</p>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>客户电话</span><strong>{{ selectedOrder.phoneMasked }}</strong></div>
          <div><span>订单金额</span><strong>¥{{ selectedOrder.rentAmount.toLocaleString() }}</strong></div>
          <div><span>押金/免押</span><strong>{{ selectedOrder.depositStatus }} · ¥{{ selectedOrder.depositAmount }}</strong></div>
          <div><span>物流状态</span><strong>{{ selectedOrder.shippingStatus }}</strong></div>
          <div><span>负责人</span><strong>{{ selectedOrder.assignee }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedOrder.nextAction }}</strong></div>
        </section>
        <UiV2Section title="履约步骤" hint="mock 时间线">
          <TrackingTimeline :steps="orderSteps" />
        </UiV2Section>
        <UiV2Section title="风险提醒">
          <p class="drawer-note">{{ selectedOrder.note || '暂无特殊备注，按标准履约流程推进。' }}</p>
        </UiV2Section>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="drawerOpen = false">关闭</BaseButton>
        <BaseButton variant="secondary" data-testid="order-status-preview-button" @click="openStatusPreview">状态预览</BaseButton>
        <BaseButton variant="secondary" data-testid="order-edit-preview-button" @click="openEditPreview">编辑预览</BaseButton>
        <BaseButton data-testid="order-create-shipping-button" @click="openShippingPreview">操作预览</BaseButton>
      </template>
    </BaseDrawer>

    <BaseDrawer v-model="shippingOpen" title="顺丰寄件预览" :subtitle="selectedOrder?.orderNo || ''" width="520" test-id="shipping-drawer">
      <div v-if="selectedOrder" class="ui-v2-stack">
        <DrawerSummary
          status="dry-run only"
          :title="selectedOrder.customerName"
          :description="selectedOrder.address"
          :meta="`${selectedOrder.model} · 暂未开放 · 不会写入`"
          primary-label="重新预览"
          @primary="openShippingPreview"
        />
        <section v-if="shippingPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-safeops-preview">
          <div><span>操作预览</span><strong>{{ shippingPreview.view.title }}</strong></div>
          <div><span>开放状态</span><strong>暂未开放</strong></div>
          <div><span>execute</span><strong>{{ shippingPreview.view.executeLabel }}</strong></div>
          <div><span>writeWillExecute</span><strong>{{ shippingPreview.view.writeWillExecute }}</strong></div>
          <div><span>externalCallWillExecute</span><strong>{{ shippingPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>audit</span><strong>{{ shippingPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ shippingPreview.view.riskLevel }}</strong></div>
          <div><span>confirm</span><strong>{{ shippingPreview.view.confirmLabel }}</strong></div>
          <div><span>idempotency</span><strong>{{ shippingPreview.view.idempotencyLabel }}</strong></div>
        </section>
        <p v-if="shippingPreview.error" class="adapter-source__error">{{ shippingPreview.error }}</p>
        <UiV2Section title="寄件信息">
          <div class="ui-v2-detail-grid">
            <div><span>承运商</span><strong>顺丰速运</strong></div>
            <div><span>揽收时间</span><strong>今天 18:00-20:00</strong></div>
            <div><span>收件人</span><strong>{{ selectedOrder.customerName }}</strong></div>
            <div><span>运单号</span><strong>不会生成</strong></div>
          </div>
        </UiV2Section>
        <UiV2Section title="安全说明">
          <p class="drawer-note">dry-run only；暂未开放；不会写入；不会调用外部服务。</p>
          <p v-if="shippingPreview.view" class="drawer-note">{{ shippingPreview.view.summary }}</p>
        </UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard, Pagination, StatusTabs, TrackingTimeline } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { createSafeOpsPreviewState, runSafeOpsPreview } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const route = useRoute()
const orders = ref([])
const options = ref({ channels: [], depositStatuses: [], shippingStatuses: [] })
const statusTabs = ref([{ label: '全部', value: '全部', count: 0 }])
const status = ref('全部')
const keyword = ref('')
const channel = ref('全部渠道')
const deposit = ref('全部押金状态')
const shipping = ref('全部物流状态')
const risk = ref('全部风险')
const assignee = ref('全部负责人')
const page = ref(1)
const selectedOrder = ref(null)
const drawerOpen = ref(false)
const shippingOpen = ref(false)
const showAdvanced = ref(false)
const selectedRows = ref([])
const loading = ref(false)
const detailLoading = ref(false)
const loadError = ref('')
const orderPreview = ref(createSafeOpsPreviewState())
const shippingPreview = ref(createSafeOpsPreviewState())
const sourceMeta = ref(uiV2Adapter.getMeta())

const columns = [
  { key: 'select', label: '', width: '42px' },
  { key: 'orderNo', label: '订单号' },
  { key: 'customerName', label: '客户' },
  { key: 'model', label: '设备' },
  { key: 'rentPeriod', label: '租期' },
  { key: 'status', label: '订单状态' },
  { key: 'rentAmount', label: '金额' },
  { key: 'channel', label: '渠道' },
  { key: 'store', label: '门店' },
  { key: 'createdAt', label: '下单时间' },
  { key: 'nextAction', label: '操作' },
]

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})

const orderMetrics = computed(() => [
  { key: 'pending', label: '待处理', value: countByStatuses(['待确认', '待押金', '待分配设备']), unit: '', trend: '只读', tone: 'warning' },
  { key: 'ship', label: '待发货', value: countByStatuses(['待发货']), unit: '', trend: '只读', tone: 'warning' },
  { key: 'return', label: '待归还', value: countByStatuses(['待归还']), unit: '', trend: '只读', tone: 'info' },
  { key: 'risk', label: '异常/逾期', value: countByStatuses(['异常']), unit: '', trend: '只读', tone: 'danger' },
  { key: 'revenue', label: '订单金额(元)', value: `¥${orders.value.reduce((sum, order) => sum + Number(order.rentAmount || 0), 0).toLocaleString()}`, unit: '', trend: '只读汇总', tone: 'success' },
  { key: 'total', label: '订单总数', value: orders.value.length, unit: '单', trend: sourceLabel.value, tone: 'info' },
])

const filteredOrders = computed(() => orders.value.filter((order) => {
  const text = `${order.orderNo}${order.customerName}${order.model}${order.phoneMasked}`
  return (status.value === '全部' || order.status === status.value)
    && (!keyword.value || text.includes(keyword.value))
    && (channel.value === '全部渠道' || order.channel === channel.value)
    && (deposit.value === '全部押金状态' || order.depositStatus === deposit.value)
    && (shipping.value === '全部物流状态' || order.shippingStatus === shipping.value)
    && (risk.value === '全部风险' || order.riskLevel === risk.value)
    && (assignee.value === '全部负责人' || order.assignee === assignee.value)
}))

const drawerSubtitle = computed(() => selectedOrder.value ? `${selectedOrder.value.customerName} · ${selectedOrder.value.model}` : '')
const orderSteps = computed(() => selectedOrder.value ? [
  { label: '订单创建', desc: selectedOrder.value.createdAt, done: true },
  { label: '押金/免押确认', desc: selectedOrder.value.depositStatus, done: !['待收', '免押审核中'].includes(selectedOrder.value.depositStatus), current: ['待押金'].includes(selectedOrder.value.status) },
  { label: '设备分配', desc: (selectedOrder.value.deviceIds || []).join(', ') || '未分配', done: !['待分配设备', '待确认'].includes(selectedOrder.value.status), current: selectedOrder.value.status === '待分配设备' },
  { label: '物流发货', desc: selectedOrder.value.shippingStatus, done: ['运输中', '已签收'].includes(selectedOrder.value.shippingStatus), current: selectedOrder.value.status === '待发货' },
  { label: '归还验机', desc: selectedOrder.value.status, done: ['已完成'].includes(selectedOrder.value.status), current: ['待归还', '待验机'].includes(selectedOrder.value.status) },
] : [])

function countByStatuses(nextStatuses) {
  return orders.value.filter((order) => nextStatuses.includes(order.status)).length
}

async function loadOrders() {
  loading.value = true
  loadError.value = ''
  try {
    const nextOrders = await uiV2Adapter.getOrders()
    orders.value = Array.isArray(nextOrders) ? nextOrders : []
    options.value = { channels: [], depositStatuses: [], shippingStatuses: [], ...(await uiV2Adapter.getOptions()) }
    const nextStatusTabs = await uiV2Adapter.getOrderStatusTabs()
    statusTabs.value = Array.isArray(nextStatusTabs) ? nextStatusTabs : [{ label: '全部', value: '全部', count: orders.value.length }]
    sourceMeta.value = uiV2Adapter.getLastMeta('getOrders')
  } catch (error) {
    orders.value = []
    statusTabs.value = [{ label: '全部', value: '全部', count: 0 }]
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '订单只读数据读取失败'
  } finally {
    loading.value = false
  }
}

async function openOrder(order) {
  selectedOrder.value = order
  drawerOpen.value = true
  detailLoading.value = true
  try {
    const detail = await uiV2Adapter.getOrder(order.orderNo)
    if (detail) {
      selectedOrder.value = { ...order, ...detail }
    } else if (uiV2Adapter.getLastMeta('getOrder')?.source === 'mock-fallback') {
      loadError.value = '真实详情读取失败，当前显示列表只读摘要。'
    }
    sourceMeta.value = uiV2Adapter.getLastMeta('getOrder') || sourceMeta.value
  } catch (error) {
    loadError.value = error?.message || '订单详情读取失败'
  } finally {
    detailLoading.value = false
  }
}

function toggleRow(orderNo) {
  selectedRows.value = selectedRows.value.includes(orderNo)
    ? selectedRows.value.filter((item) => item !== orderNo)
    : [...selectedRows.value, orderNo]
}

function nextPreviewStatus(currentStatus) {
  const transitions = {
    待确认: '待押金',
    待押金: '待分配设备',
    待分配设备: '待发货',
    待发货: '运输中',
    运输中: '租用中',
    租用中: '待归还',
    待归还: '待验机',
    待验机: '已完成',
  }
  return transitions[currentStatus] || currentStatus || '待确认'
}

async function openStatusPreview() {
  orderPreview.value = { ...orderPreview.value, loading: true, error: '' }
  orderPreview.value = await runSafeOpsPreview('order.status.transition.preview', {
    target: {
      type: 'order',
      id: selectedOrder.value?.orderNo || '',
    },
    payload: {
      orderId: selectedOrder.value?.orderNo || '',
      fromStatus: selectedOrder.value?.status || '',
      toStatus: nextPreviewStatus(selectedOrder.value?.status),
      source: 'orders-drawer',
    },
  })
}

async function openEditPreview() {
  orderPreview.value = { ...orderPreview.value, loading: true, error: '' }
  orderPreview.value = await runSafeOpsPreview('order.edit.preview', {
    target: {
      type: 'order',
      id: selectedOrder.value?.orderNo || '',
    },
    payload: {
      orderId: selectedOrder.value?.orderNo || '',
      rentStartDate: selectedOrder.value?.rentStart || '',
      rentEndDate: selectedOrder.value?.rentEnd || '',
      deviceId: Array.isArray(selectedOrder.value?.deviceIds) ? selectedOrder.value.deviceIds[0] : '',
      modelCode: selectedOrder.value?.model || '',
      rentAmount: selectedOrder.value?.rentAmount || '',
      source: 'orders-drawer',
    },
  })
}

async function openBulkEditPreview() {
  orderPreview.value = { ...orderPreview.value, loading: true, error: '' }
  orderPreview.value = await runSafeOpsPreview('order.edit.preview', {
    target: {
      type: 'order-bulk',
      id: selectedRows.value.join(','),
    },
    payload: {
      orderIds: selectedRows.value,
      reason: 'bulk-assignee-or-contact-preview',
      source: 'orders-page',
    },
  })
}

async function openShippingPreview() {
  shippingOpen.value = true
  shippingPreview.value = { ...shippingPreview.value, loading: true, error: '' }
  shippingPreview.value = await runSafeOpsPreview('logistics.shipment.preview', {
    target: {
      type: 'shipment',
      id: selectedOrder.value?.orderNo || '',
      orderNo: selectedOrder.value?.orderNo || '',
    },
    payload: {
      carrier: 'sf',
      orderId: selectedOrder.value?.orderNo || '',
      modelCode: selectedOrder.value?.model || '',
      receiverName: selectedOrder.value?.customerName || '',
      receiverAddress: selectedOrder.value?.address || '',
      senderName: 'merchant',
      source: 'orders-drawer',
    },
  })
}

watch(
  () => route.query.order,
  async (orderNo) => {
    if (typeof orderNo !== 'string') return
    if (!orders.value.length) await loadOrders()
    const order = orders.value.find((item) => item.orderNo === orderNo) || await uiV2Adapter.getOrder(orderNo)
    if (order) openOrder(order)
  },
  { immediate: true },
)

onMounted(loadOrders)
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.4fr repeat(2, minmax(180px, 0.7fr));
  gap: 10px;
  align-items: end;
}

.bulk-bar {
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--brand-primary-border);
  border-radius: var(--radius-12);
  background: linear-gradient(180deg, rgba(232, 247, 243, 0.9), rgba(232, 247, 243, 0.66));
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.bulk-bar span {
  color: var(--color-primary);
  font-weight: 740;
}

.next-action {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
  font-weight: 720;
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
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 760;
}

.adapter-source {
  border: 1px solid var(--ui-border);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
}

.adapter-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}

.adapter-source.is-mock-fallback,
.adapter-source__reason {
  border-color: rgba(245, 158, 11, 0.26);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}

.adapter-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.92);
  color: #b91c1c;
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

.adapter-state.is-compact {
  padding: 8px 10px;
}

.drawer-note {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
