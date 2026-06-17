<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="订单队列" subtitle="按下一步动作快速处理">
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
      <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、设备" />
      <section class="orders-summary">
        <div><span>当前筛选</span><strong>{{ filteredOrders.length }}</strong><small> 单</small></div>
        <p>{{ status === '全部' ? '全部履约订单按下一步动作展示。' : `${status} 队列已置顶。` }}</p>
      </section>
      <div class="chip-row">
        <FilterChip v-for="item in statuses" :key="item" :label="item" :selected="status === item" @click="status = item" />
      </div>
      <div class="ui-v2-stack">
        <OrderCard v-for="order in filteredOrders" :key="order.id" :order="order" @click="openOrder" />
        <EmptyState v-if="filteredOrders.length === 0" state="no-result" compact />
      </div>
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
import FilterChip from '../../../components/FilterChip.vue'
import { OrderCard } from '../../../components/business'
import { BottomSheet, MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const router = useRouter()
const route = useRoute()
const orders = uiV2MockAdapter.getOrders()
const options = uiV2MockAdapter.getOptions()
const statuses = ['全部', '待发货', '待归还', '待押金', '异常']
const status = ref('全部')
const keyword = ref('')
const channel = ref('全部渠道')
const deposit = ref('全部押金状态')
const shipping = ref('全部物流状态')
const sheetOpen = ref(false)
const filteredOrders = computed(() => orders.filter((order) => {
  const text = `${order.orderNo}${order.customerName}${order.model}`
  return (status.value === '全部' || order.status === status.value)
    && (!keyword.value || text.includes(keyword.value))
    && (channel.value === '全部渠道' || order.channel === channel.value)
    && (deposit.value === '全部押金状态' || order.depositStatus === deposit.value)
    && (shipping.value === '全部物流状态' || order.shippingStatus === shipping.value)
}))
function openFilters() {
  sheetOpen.value = true
}
function openOrder(order) {
  router.push(`/ui-v2/mobile/orders/${order.orderNo}`)
}
watch(() => route.query.status, (next) => {
  if (typeof next === 'string' && statuses.includes(next)) status.value = next
}, { immediate: true })
</script>

<style scoped>
.orders-summary {
  padding: var(--space-12);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}
.orders-summary span,
.orders-summary small,
.orders-summary p {
  color: var(--ui-text-muted);
  font-size: 12px;
}
.orders-summary strong {
  margin: 0 var(--space-token-4);
  color: var(--ui-brand-strong);
  font-size: 26px;
}
.orders-summary p { margin: 0; text-align: right; }
.chip-row {
  display: flex;
  gap: var(--space-token-8);
  overflow-x: auto;
  padding-bottom: 2px;
}
.mobile-orders__filter-action {
  min-width: 64px;
  min-height: 44px;
}
</style>
