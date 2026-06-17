<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="订单中心" subtitle="">
        <template #actions>
          <BaseButton
            class="mobile-orders__filter-action"
            variant="secondary"
            size="lg"
            data-testid="mobile-orders-filter-button"
            aria-label="打开订单筛选"
            @click="openFilters"
          >
            筛选
          </BaseButton>
        </template>
      </MobileAppBar>
      <section class="mobile-dark-hero orders-hero">
        <div class="mobile-stat-grid is-four">
          <div v-for="item in orderStats" :key="item.label" class="mobile-stat">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
            <em>{{ item.trend }}</em>
          </div>
        </div>
      </section>

      <section class="mobile-content-sheet">
        <div class="mobile-tabs">
          <button v-for="item in statuses" :key="item" type="button" class="mobile-tab" :class="{ 'is-active': status === item }" @click="status = item">{{ item }} {{ countByStatus(item) }}</button>
        </div>
        <BaseInput v-model="keyword" search clearable placeholder="订单号 / 客户 / 设备" />
        <div class="filter-line">
          <BaseButton variant="secondary" size="sm">门店</BaseButton>
          <BaseButton variant="secondary" size="sm">渠道</BaseButton>
          <BaseButton variant="secondary" size="sm">时间</BaseButton>
          <BaseButton variant="secondary" size="sm" @click="openFilters">筛选</BaseButton>
        </div>
        <div class="ui-v2-stack">
          <OrderCard v-for="order in filteredOrders.slice(0, 8)" :key="order.id" :order="order" @click="openOrder" />
          <EmptyState v-if="filteredOrders.length === 0" state="no-result" compact />
        </div>
      </section>
      <BottomSheet v-model="sheetOpen" title="订单筛选" test-id="mobile-orders-filter-sheet">
        <BaseSelect v-model="channel" label="渠道" :options="['全部渠道', ...options.channels]" />
        <BaseSelect v-model="deposit" label="押金/免押" :options="['全部押金状态', ...options.depositStatuses]" />
        <BaseSelect v-model="shipping" label="物流" :options="['全部物流状态', ...options.shippingStatuses]" />
        <BaseButton block @click="sheetOpen = false">应用筛选</BaseButton>
      </BottomSheet>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import EmptyState from '../../../components/EmptyState.vue'
import { OrderCard } from '../../../components/business'
import { BottomSheet, MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const router = useRouter()
const route = useRoute()
const orders = uiV2MockAdapter.getOrders()
const options = uiV2MockAdapter.getOptions()
const statuses = ['全部', '待处理', '待发货', '待归还', '使用中', '已完成']
const status = ref('全部')
const keyword = ref('')
const channel = ref('全部渠道')
const deposit = ref('全部押金状态')
const shipping = ref('全部物流状态')
const sheetOpen = ref(false)
const filteredOrders = computed(() => orders.filter((order) => {
  const text = `${order.orderNo}${order.customerName}${order.model}`
  const statusMatched = status.value === '全部'
    || (status.value === '待处理' && ['待确认', '待押金', '待分配设备'].includes(order.status))
    || (status.value === '使用中' && order.status === '租赁中')
    || order.status === status.value
  return statusMatched
    && (!keyword.value || text.includes(keyword.value))
    && (channel.value === '全部渠道' || order.channel === channel.value)
    && (deposit.value === '全部押金状态' || order.depositStatus === deposit.value)
    && (shipping.value === '全部物流状态' || order.shippingStatus === shipping.value)
}))
const orderStats = [
  { label: '待处理', value: 28, trend: '较昨日 -6' },
  { label: '待发货', value: 36, trend: '较昨日 +8' },
  { label: '待归还', value: 52, trend: '较昨日 -4' },
  { label: '异常/逾期', value: 9, trend: '较昨日 +2' },
]
function openFilters() {
  sheetOpen.value = true
}
function openOrder(order) {
  router.push(`/ui-v2/mobile/orders/${order.orderNo}`)
}
function countByStatus(item) {
  if (item === '全部') return orders.length
  if (item === '待处理') return orders.filter((order) => ['待确认', '待押金', '待分配设备'].includes(order.status)).length
  if (item === '使用中') return orders.filter((order) => order.status === '租赁中').length
  return orders.filter((order) => order.status === item).length
}
watch(() => route.query.status, (next) => {
  if (typeof next === 'string' && statuses.includes(next)) status.value = next
}, { immediate: true })
</script>

<style scoped>
.orders-hero {
  padding-top: 8px;
}
.filter-line {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.filter-line::-webkit-scrollbar { display: none; }
.mobile-orders__filter-action {
  min-width: 64px;
  min-height: 44px;
}
</style>
