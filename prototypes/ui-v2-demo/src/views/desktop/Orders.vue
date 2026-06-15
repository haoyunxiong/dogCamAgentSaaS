<template>
  <AppShell>
    <div class="page desktop-orders">
      <header class="page-header">
        <div>
          <h1 class="page-title">订单中心</h1>
          <p class="page-desc">订单履约工作台：押金、设备、顺丰、归还和异常在同一页闭环。</p>
        </div>
        <BaseButton>新建手工订单</BaseButton>
      </header>

      <section class="orders-command">
        <div>
          <StatusTag label="订单履约工作台" tone="info" />
          <h2>{{ filteredOrders.length }} 单需要查看</h2>
          <p>{{ orderCommandCopy }}</p>
        </div>
        <div class="command-stats">
          <span>待发货 <strong>{{ countStatus('待发货') }}</strong></span>
          <span>待归还 <strong>{{ countStatus('待归还') }}</strong></span>
          <span>异常 <strong>{{ countStatus('异常') }}</strong></span>
        </div>
      </section>

      <section class="queue-rhythm">
        <article v-for="item in queueRhythm" :key="item.label">
          <div>
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
          <small>{{ item.note }}</small>
        </article>
      </section>

      <FilterBar>
        <FilterChip
          v-for="item in quickFilters"
          :key="item.label"
          :active="activeStatus === item.label"
          :label="item.label"
          :count="item.count"
          @click="activeStatus = item.label"
        />
        <template #actions>
          <BaseButton variant="secondary" @click="advancedOpen = !advancedOpen">
            {{ advancedOpen ? '收起高级筛选' : '展开高级筛选' }}
          </BaseButton>
        </template>
      </FilterBar>

      <section v-if="advancedOpen" class="advanced-filters">
        <BaseInput v-model="keyword" label="搜索" placeholder="客户、订单号、设备" />
        <BaseSelect v-model="channel" label="渠道" :options="['全部渠道', '闲鱼', '小红书', '抖音', '私域']" />
        <BaseSelect v-model="deposit" label="押金/免押" :options="['全部押金状态', ...depositStatusList]" />
        <BaseSelect v-model="shippingFilter" label="物流" :options="['全部物流状态', ...shippingStatusList]" />
      </section>

      <section :class="['bulk-bar', { active: selectedOrder }]">
        <span>{{ selectedOrder ? `已选 ${selectedOrder.orderNo} · ${selectedOrder.customerName}` : `当前筛选 ${filteredOrders.length} 单` }}</span>
        <div class="toolbar">
          <BaseButton variant="secondary">批量分配负责人</BaseButton>
          <BaseButton variant="secondary">导出履约清单</BaseButton>
          <BaseButton variant="ghost" @click="selectedOrder = null">清除选择</BaseButton>
        </div>
      </section>

      <OrderTable :orders="pagedOrders" :selected-key="selectedOrder?.orderNo || ''" @row-click="openOrder" />
      <Pagination v-model:page="page" :page-size="pageSize" :total="filteredOrders.length" />
    </div>

    <Drawer
      :open="Boolean(selectedOrder)"
      :title="selectedOrder?.orderNo || '订单详情'"
      :description="selectedOrder ? `${selectedOrder.customerName} · ${selectedOrder.model}` : ''"
      @close="selectedOrder = null"
    >
      <template v-if="selectedOrder">
        <div class="drawer-stack">
          <section class="detail-hero">
            <div>
              <StatusTag :label="selectedOrder.status" />
              <h3>{{ selectedOrder.nextAction }}</h3>
              <p>{{ selectedOrder.rentStart }} 至 {{ selectedOrder.rentEnd }} · 租金 {{ selectedOrder.rentAmount }} 元</p>
            </div>
            <BaseButton @click="shippingOpen = true">创建顺丰寄件</BaseButton>
          </section>

          <section class="fulfillment-steps">
            <div v-for="step in fulfillmentSteps" :key="step.label" :class="['fulfillment-step', { done: step.done }]">
              <span>{{ step.index }}</span>
              <strong>{{ step.label }}</strong>
              <small>{{ step.desc }}</small>
            </div>
          </section>

          <section class="detail-grid">
            <div>
              <span>客户</span>
              <strong>{{ selectedOrder.customerName }}</strong>
              <small>{{ selectedOrder.phoneMasked }} · {{ selectedOrder.channel }}</small>
            </div>
            <div>
              <span>押金/免押</span>
              <strong>{{ selectedOrder.depositStatus }}</strong>
              <small>押金 {{ selectedOrder.depositAmount }} 元</small>
            </div>
            <div>
              <span>物流</span>
              <strong>{{ selectedOrder.shippingStatus }}</strong>
              <small>{{ selectedOrder.address }}</small>
            </div>
            <div>
              <span>负责人</span>
              <strong>{{ selectedOrder.assignee }}</strong>
              <small>下一步：{{ selectedOrder.nextAction }}</small>
            </div>
          </section>

          <DeviceCard
            v-if="linkedDevice"
            :device="linkedDevice"
            @click="null"
          />

          <RiskAlert v-if="linkedRisk" :risk="linkedRisk" />

          <section class="panel timeline">
            <div class="panel-header">
              <h3 class="section-title">履约时间线</h3>
            </div>
            <div class="panel-body">
              <div v-for="item in timeline" :key="item" class="timeline-item">{{ item }}</div>
            </div>
          </section>
        </div>
      </template>
    </Drawer>

    <Drawer
      :open="shippingOpen"
      title="顺丰寄件"
      :description="selectedOrder ? `为 ${selectedOrder.orderNo} 生成 mock 运单` : ''"
      width="520px"
      @close="shippingOpen = false"
    >
      <template v-if="selectedOrder">
        <div class="drawer-stack">
          <section class="detail-hero">
            <div>
              <StatusTag :label="generated ? '待揽收' : '待下单'" :tone="generated ? 'info' : 'warning'" />
              <h3>{{ generated ? '已生成顺丰 mock 运单' : '确认寄件信息' }}</h3>
              <p>{{ selectedOrder.address }}</p>
            </div>
          </section>
          <ShippingSteps :steps="shippingSteps" />
          <section class="detail-grid one">
            <div>
              <span>寄件设备</span>
              <strong>{{ selectedOrder.model }}</strong>
              <small>{{ linkedDevice?.assetNo || selectedOrder.deviceIds[0] }}</small>
            </div>
            <div>
              <span>保价金额</span>
              <strong>{{ Math.max(selectedOrder.depositAmount, 3000) }} 元</strong>
              <small>顺丰到付，客户签收后进入租赁中</small>
            </div>
          </section>
          <BaseButton block @click="generated = true">{{ generated ? '已生成 SF MOCK 运单' : '生成 mock 运单' }}</BaseButton>
        </div>
      </template>
    </Drawer>
  </AppShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import StatusTag from '../../components/StatusTag.vue'
import BaseInput from '../../components/BaseInput.vue'
import BaseSelect from '../../components/BaseSelect.vue'
import FilterChip from '../../components/FilterChip.vue'
import FilterBar from '../../components/FilterBar.vue'
import OrderTable from '../../components/OrderTable.vue'
import Pagination from '../../components/Pagination.vue'
import Drawer from '../../components/Drawer.vue'
import DeviceCard from '../../components/DeviceCard.vue'
import ShippingSteps from '../../components/ShippingSteps.vue'
import RiskAlert from '../../components/RiskAlert.vue'
import { orders, orderStatuses, depositStatusList, shippingStatusList } from '../../mock/orders.js'
import { devices } from '../../mock/devices.js'
import { risks } from '../../mock/risks.js'

const route = useRoute()
const activeStatus = ref('全部')
const advancedOpen = ref(false)
const keyword = ref('')
const channel = ref('全部渠道')
const deposit = ref('全部押金状态')
const shippingFilter = ref('全部物流状态')
const selectedOrder = ref(null)
const shippingOpen = ref(false)
const generated = ref(false)
const page = ref(1)
const pageSize = 10

const filteredOrders = computed(() => orders.filter((order) => {
  const matchStatus = activeStatus.value === '全部' || order.status === activeStatus.value
  const matchKeyword = !keyword.value || [order.orderNo, order.customerName, order.model].some((item) => item.includes(keyword.value))
  const matchChannel = channel.value === '全部渠道' || order.channel === channel.value
  const matchDeposit = deposit.value === '全部押金状态' || order.depositStatus === deposit.value
  const matchShipping = shippingFilter.value === '全部物流状态' || order.shippingStatus === shippingFilter.value
  return matchStatus && matchKeyword && matchChannel && matchDeposit && matchShipping
}))

const quickFilters = computed(() => ['全部', ...orderStatuses].map((label) => ({
  label,
  count: label === '全部' ? orders.length : orders.filter((order) => order.status === label).length
})))

const orderCommandCopy = computed(() => `当前筛选聚焦 ${activeStatus.value}，沿押金、设备、顺丰、归还链路进入订单抽屉处理。`)

const queueRhythm = computed(() => [
  { label: '确认/押金', value: countStatus('待确认') + countStatus('待押金'), note: '租期、地址、押金和免押复核' },
  { label: '设备分配', value: countStatus('待分配设备'), note: '校验档期并锁定资产' },
  { label: '顺丰寄件', value: countStatus('待发货'), note: '创建运单、保价和揽收' },
  { label: '归还异常', value: countStatus('待归还') + countStatus('异常'), note: '归还提醒、验机和异常插队' }
])

const pagedOrders = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

const linkedDevice = computed(() => {
  if (!selectedOrder.value) return null
  return devices.find((device) => selectedOrder.value.deviceIds.includes(device.id))
})

const linkedRisk = computed(() => {
  if (!selectedOrder.value) return null
  return risks.find((risk) => risk.relatedOrderId === selectedOrder.value.orderNo) || null
})

const fulfillmentSteps = computed(() => {
  const currentIndex = orderStatuses.indexOf(selectedOrder.value?.status || '待确认')
  return [
    { index: 1, label: '确认租期', desc: '客户、地址、租期', status: '待确认' },
    { index: 2, label: '押金/免押', desc: '收款或免押审核', status: '待押金' },
    { index: 3, label: '分配设备', desc: '校验档期和资产', status: '待分配设备' },
    { index: 4, label: '顺丰寄件', desc: '生成运单并揽收', status: '待发货' },
    { index: 5, label: '归还验机', desc: '归还、清洁、入库', status: '待验机' }
  ].map((step) => ({ ...step, done: currentIndex > orderStatuses.indexOf(step.status) }))
})

const shippingSteps = computed(() => [
  { label: '确认客户地址', done: true },
  { label: '确认寄件设备与保价', done: true },
  { label: '生成顺丰运单', done: generated.value },
  { label: '等待快递员揽收', done: false }
])

const timeline = ['订单创建', '确认租期', '押金/免押审核', '分配设备', '创建顺丰寄件', '客户签收', '归还验机']

function openOrder(order) {
  selectedOrder.value = order
  generated.value = false
}

function countStatus(status) {
  return orders.filter((order) => order.status === status).length
}

watch([activeStatus, keyword, channel, deposit, shippingFilter], () => {
  page.value = 1
})

watch(
  () => route.query.order,
  (orderId) => {
    if (orderId) {
      selectedOrder.value = orders.find((order) => order.orderNo === orderId) || null
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.order-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.orders-command {
  padding: var(--space-20);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-24);
}

.orders-command h2 {
  margin: 10px 0 4px;
  font-size: 24px;
}

.orders-command p {
  margin: 0;
  color: var(--text-soft);
}

.command-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(108px, 1fr));
  gap: var(--space-8);
}

.command-stats span {
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 12px;
}

.command-stats strong {
  display: block;
  margin-top: 4px;
  color: var(--text);
  font-size: 20px;
}

.queue-rhythm {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-12);
}

.queue-rhythm article {
  min-height: 84px;
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  display: grid;
  align-content: space-between;
  gap: 12px;
  overflow: hidden;
  position: relative;
}

.queue-rhythm article::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--brand);
}

.queue-rhythm article:nth-child(2)::before { background: var(--warning); }
.queue-rhythm article:nth-child(3)::before { background: var(--info); }
.queue-rhythm article:nth-child(4)::before { background: var(--danger); }

.queue-rhythm span,
.queue-rhythm small {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.queue-rhythm strong {
  display: block;
  margin-top: 4px;
  font-size: 23px;
}

.advanced-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) repeat(3, 160px);
  gap: var(--space-12);
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
}

.bulk-bar {
  min-height: 44px;
  padding: var(--space-8) var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-soft);
  font-size: 13px;
}

.bulk-bar.active {
  border-color: #abcfc7;
  background: var(--brand-soft);
}

.drawer-stack {
  display: grid;
  gap: 12px;
}

.detail-hero {
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface-soft);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.fulfillment-steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.fulfillment-step {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(247, 248, 245, 0.82);
  display: grid;
  gap: 5px;
}

.fulfillment-step span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--neutral-soft);
  color: var(--text-muted);
  font-weight: 780;
}

.fulfillment-step.done {
  background: var(--success-soft);
  border-color: #c8dfd1;
}

.fulfillment-step.done span {
  background: var(--success);
  color: #fff;
}

.fulfillment-step strong {
  font-size: 12px;
}

.fulfillment-step small {
  color: var(--text-muted);
  font-size: 11px;
}

.detail-hero h3 {
  margin: 10px 0 4px;
  font-size: 18px;
}

.detail-hero p {
  margin: 0;
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid.one {
  grid-template-columns: 1fr;
}

.detail-grid div {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.detail-grid span,
.detail-grid small {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
}

.detail-grid strong {
  display: block;
  margin: 5px 0 3px;
}

.timeline-item {
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-soft);
}

.timeline-item:last-child {
  border-bottom: 0;
}

@media (max-width: 1180px) {
  .orders-command,
  .bulk-bar {
    display: grid;
  }

  .advanced-filters,
  .queue-rhythm {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .advanced-filters,
  .queue-rhythm,
  .command-stats {
    grid-template-columns: 1fr;
  }
}
</style>
