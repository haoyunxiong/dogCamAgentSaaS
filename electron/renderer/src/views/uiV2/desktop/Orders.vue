<template>
  <UiV2Page title="订单中心" description="按状态、押金、物流和风险推进履约，所有数据来自 UI-V2 mock adapter。">
    <template #actions>
      <BaseButton variant="secondary" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? '收起筛选' : '高级筛选' }}</BaseButton>
      <BaseButton>批量分配负责人</BaseButton>
    </template>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in orderMetrics" :key="metric.key" :metric="metric" />
    </section>

    <FilterBar title="订单筛选" hint="快筛和高级筛选均为前端 mock 状态" :show-advanced="showAdvanced">
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

    <div v-if="selectedRows.length" class="bulk-bar">
      <span>已选择 {{ selectedRows.length }} 单</span>
      <BaseButton variant="secondary" size="sm">分配负责人</BaseButton>
      <BaseButton variant="secondary" size="sm">导出</BaseButton>
      <BaseButton variant="secondary" size="sm">标记已联系</BaseButton>
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredOrders"
      row-key="orderNo"
      :selected-key="selectedOrder?.orderNo || ''"
      compact
      empty-title="暂无匹配订单"
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
      <template #depositStatus="{ row }"><StatusBadge :label="row.depositStatus" size="sm" /></template>
      <template #shippingStatus="{ row }"><StatusBadge :label="row.shippingStatus" size="sm" /></template>
      <template #riskLevel="{ row }"><StatusBadge :label="row.riskLevel" size="sm" /></template>
      <template #rentAmount="{ row }">¥{{ row.rentAmount.toLocaleString() }}</template>
      <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
    </DataTable>

    <Pagination v-model:page="page" :total="filteredOrders.length" :page-size="12" />

    <BaseDrawer v-model="drawerOpen" :title="selectedOrder?.orderNo || '订单详情'" :subtitle="drawerSubtitle" width="720" test-id="order-detail-drawer">
      <div v-if="selectedOrder" class="ui-v2-stack">
        <DrawerSummary
          :status="selectedOrder.status"
          :title="selectedOrder.customerName"
          :description="`${selectedOrder.channel} · ${selectedOrder.model}`"
          :meta="`${selectedOrder.rentStart} 至 ${selectedOrder.rentEnd}`"
          primary-label="创建顺丰寄件"
          secondary-label="标记已联系"
          danger-label="标记异常"
          @primary="shippingOpen = true"
        />
        <section class="ui-v2-detail-grid">
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
        <BaseButton data-testid="order-create-shipping-button" @click="shippingOpen = true">创建顺丰寄件</BaseButton>
      </template>
    </BaseDrawer>

    <BaseDrawer v-model="shippingOpen" title="顺丰寄件" :subtitle="selectedOrder?.orderNo || ''" width="520" test-id="shipping-drawer">
      <div v-if="selectedOrder" class="ui-v2-stack">
        <DrawerSummary
          status="待下单"
          :title="selectedOrder.customerName"
          :description="selectedOrder.address"
          :meta="`${selectedOrder.model} · 保价 ¥${selectedOrder.depositAmount}`"
          primary-label="生成 mock 运单"
          @primary="mockTrackingNo = `SF${Date.now().toString().slice(-10)}`"
        />
        <UiV2Section title="寄件信息">
          <div class="ui-v2-detail-grid">
            <div><span>承运商</span><strong>顺丰速运</strong></div>
            <div><span>揽收时间</span><strong>今天 18:00-20:00</strong></div>
            <div><span>收件人</span><strong>{{ selectedOrder.customerName }}</strong></div>
            <div><span>运单号</span><strong>{{ mockTrackingNo || '待生成' }}</strong></div>
          </div>
        </UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard, Pagination, StatusTabs, TrackingTimeline } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const route = useRoute()
const orders = uiV2MockAdapter.getOrders()
const options = uiV2MockAdapter.getOptions()
const statusTabs = uiV2MockAdapter.getOrderStatusTabs()
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
const mockTrackingNo = ref('')
const showAdvanced = ref(false)
const selectedRows = ref([])

const columns = [
  { key: 'select', label: '', width: '42px' },
  { key: 'orderNo', label: '订单号' },
  { key: 'customerName', label: '客户/渠道' },
  { key: 'model', label: '设备' },
  { key: 'status', label: '状态' },
  { key: 'depositStatus', label: '押金/免押' },
  { key: 'shippingStatus', label: '物流' },
  { key: 'riskLevel', label: '风险' },
  { key: 'rentAmount', label: '租金' },
  { key: 'nextAction', label: '下一步' },
]

const orderMetrics = computed(() => [
  { key: 'all', label: '订单总数', value: orders.length, unit: '单', trend: 'mock 订单池', tone: 'info' },
  { key: 'ship', label: '待发货', value: countStatus('待发货'), unit: '单', trend: '今日优先', tone: 'warning' },
  { key: 'renting', label: '租赁中', value: countStatus('租赁中'), unit: '单', trend: '需跟进归还', tone: 'info' },
  { key: 'return', label: '待归还', value: countStatus('待归还'), unit: '单', trend: '含逾期风险', tone: 'warning' },
  { key: 'deposit', label: '待押金', value: countStatus('待押金'), unit: '单', trend: '影响发货', tone: 'danger' },
  { key: 'done', label: '已完成', value: countStatus('已完成'), unit: '单', trend: '归档可查', tone: 'success' },
])

const filteredOrders = computed(() => orders.filter((order) => {
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
  { label: '设备分配', desc: selectedOrder.value.deviceIds.join(', '), done: !['待分配设备', '待确认'].includes(selectedOrder.value.status), current: selectedOrder.value.status === '待分配设备' },
  { label: '物流发货', desc: selectedOrder.value.shippingStatus, done: ['运输中', '已签收'].includes(selectedOrder.value.shippingStatus), current: selectedOrder.value.status === '待发货' },
  { label: '归还验机', desc: selectedOrder.value.status, done: ['已完成'].includes(selectedOrder.value.status), current: ['待归还', '待验机'].includes(selectedOrder.value.status) },
] : [])

function countStatus(nextStatus) {
  return orders.filter((order) => order.status === nextStatus).length
}

function openOrder(order) {
  selectedOrder.value = order
  drawerOpen.value = true
}

function toggleRow(orderNo) {
  selectedRows.value = selectedRows.value.includes(orderNo)
    ? selectedRows.value.filter((item) => item !== orderNo)
    : [...selectedRows.value, orderNo]
}

watch(
  () => route.query.order,
  (orderNo) => {
    if (typeof orderNo !== 'string') return
    const order = uiV2MockAdapter.getOrder(orderNo)
    if (order) openOrder(order)
  },
  { immediate: true },
)
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.4fr repeat(2, minmax(180px, 0.7fr));
  gap: var(--space-12);
  align-items: end;
}

.bulk-bar {
  min-height: 44px;
  padding: var(--space-10, 10px) var(--space-12);
  border: 1px solid var(--brand-primary-border);
  border-radius: var(--radius-12);
  background: var(--brand-primary-soft);
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
}

.bulk-bar span {
  color: var(--color-primary);
  font-weight: 740;
}

.next-action {
  color: var(--color-primary);
  font-weight: 720;
}

.drawer-note {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
