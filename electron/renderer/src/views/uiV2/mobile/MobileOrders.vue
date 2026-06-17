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
      <div class="mobile-source-row">
        <span class="mobile-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
        <span v-if="sourceMeta.fallbackReason" class="mobile-source__reason">{{ sourceMeta.fallbackReason }}</span>
      </div>
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
        <div v-if="loading" class="mobile-adapter-state">订单数据读取中...</div>
        <div v-if="loadError" class="mobile-adapter-state is-error">{{ loadError }}</div>
        <div class="ui-v2-stack">
          <OrderCard v-for="order in filteredOrders.slice(0, 8)" :key="order.id" :order="order" @click="openOrder" />
          <EmptyState v-if="!loading && filteredOrders.length === 0" state="no-result" compact />
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import EmptyState from '../../../components/EmptyState.vue'
import { OrderCard } from '../../../components/business'
import { BottomSheet, MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2Adapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const router = useRouter()
const route = useRoute()
const orders = ref([])
const options = ref({ channels: [], depositStatuses: [], shippingStatuses: [] })
const statuses = ['全部', '待处理', '待发货', '待归还', '使用中', '已完成']
const status = ref('全部')
const keyword = ref('')
const channel = ref('全部渠道')
const deposit = ref('全部押金状态')
const shipping = ref('全部物流状态')
const sheetOpen = ref(false)
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})
const filteredOrders = computed(() => orders.value.filter((order) => {
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
const orderStats = computed(() => [
  { label: '待处理', value: countByStatus('待处理'), trend: sourceLabel.value },
  { label: '待发货', value: countByStatus('待发货'), trend: '只读' },
  { label: '待归还', value: countByStatus('待归还'), trend: '只读' },
  { label: '异常/逾期', value: orders.value.filter((order) => order.status === '异常' || order.riskLevel === '高').length, trend: '只读' },
])
async function loadOrders() {
  loading.value = true
  loadError.value = ''
  try {
    const nextOrders = await uiV2Adapter.getOrders()
    orders.value = Array.isArray(nextOrders) ? nextOrders : []
    options.value = { channels: [], depositStatuses: [], shippingStatuses: [], ...(await uiV2Adapter.getOptions()) }
    sourceMeta.value = uiV2Adapter.getLastMeta('getOrders')
  } catch (error) {
    orders.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '订单只读数据读取失败'
  } finally {
    loading.value = false
  }
}
function openFilters() {
  sheetOpen.value = true
}
function openOrder(order) {
  router.push(`/ui-v2/mobile/orders/${order.orderNo}`)
}
function countByStatus(item) {
  if (item === '全部') return orders.value.length
  if (item === '待处理') return orders.value.filter((order) => ['待确认', '待押金', '待分配设备'].includes(order.status)).length
  if (item === '使用中') return orders.value.filter((order) => order.status === '租赁中').length
  return orders.value.filter((order) => order.status === item).length
}
watch(() => route.query.status, (next) => {
  if (typeof next === 'string' && statuses.includes(next)) status.value = next
}, { immediate: true })
onMounted(loadOrders)
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
.mobile-source-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 2px;
}
.mobile-source,
.mobile-source__reason {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}
.mobile-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}
.mobile-source.is-mock-fallback,
.mobile-source__reason {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}
.mobile-adapter-state {
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 680;
}
.mobile-adapter-state.is-error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.92);
  color: #b91c1c;
}
</style>
