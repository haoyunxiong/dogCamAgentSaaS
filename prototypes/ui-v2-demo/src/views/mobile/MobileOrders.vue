<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="mobile-page-header">
        <MobileAppBar eyebrow="移动端订单中心" title="订单队列" subtitle="按下一步动作快速处理">
          <template #actions>
            <BaseButton variant="secondary" size="sm" @click="sheetOpen = true">筛选</BaseButton>
          </template>
        </MobileAppBar>
      </header>

      <BaseInput v-model="keyword" placeholder="搜索订单、客户、设备" />

      <section class="orders-summary">
        <div>
          <span>当前筛选</span>
          <strong>{{ filteredOrders.length }}</strong>
          <small>单</small>
        </div>
        <p>{{ activeStatus === '全部' ? '全部履约订单按下一步动作展示。' : `${activeStatus} 队列已置顶。` }}</p>
      </section>

      <section class="action-queue">
        <button v-for="item in actionQueue" :key="item.label" type="button" @click="status = item.status">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </button>
      </section>

      <div class="chip-row">
        <FilterChip v-for="item in statuses" :key="item" :label="item" :active="status === item" @click="status = item" />
      </div>

      <div class="stack">
        <OrderCard v-for="order in filteredOrders" :key="order.id" :order="order" @click="openOrder(order)" />
        <BaseEmpty
          v-if="filteredOrders.length === 0"
          title="暂无匹配订单"
          description="可以清除搜索词或切换状态后再查看。"
        />
      </div>

      <BottomSheet :open="sheetOpen" title="订单筛选" @close="sheetOpen = false">
        <div class="sheet-stack">
          <BaseSelect v-model="channel" label="渠道" :options="['全部渠道', '闲鱼', '小红书', '抖音', '私域']" />
          <BaseSelect v-model="deposit" label="押金/免押" :options="['全部押金状态', ...depositStatusList]" />
          <BaseSelect v-model="shipping" label="物流" :options="['全部物流状态', ...shippingStatusList]" />
          <BaseButton block @click="sheetOpen = false">应用筛选</BaseButton>
        </div>
      </BottomSheet>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MobileShell from '../../components/MobileShell.vue'
import MobileAppBar from '../../components/MobileAppBar.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseInput from '../../components/BaseInput.vue'
import BaseSelect from '../../components/BaseSelect.vue'
import BaseEmpty from '../../components/BaseEmpty.vue'
import FilterChip from '../../components/FilterChip.vue'
import OrderCard from '../../components/OrderCard.vue'
import BottomSheet from '../../components/BottomSheet.vue'
import { orders, depositStatusList, shippingStatusList } from '../../mock/orders.js'

const router = useRouter()
const route = useRoute()
const statuses = ['全部', '待发货', '待归还', '待押金', '异常']
const status = ref('全部')
const keyword = ref('')
const sheetOpen = ref(false)
const channel = ref('全部渠道')
const deposit = ref('全部押金状态')
const shipping = ref('全部物流状态')

const filteredOrders = computed(() => orders.filter((order) => {
  const mappedStatus = status.value === '待押金' ? '待押金' : status.value
  const matchStatus = status.value === '全部' || order.status === mappedStatus
  const matchKeyword = !keyword.value || `${order.orderNo}${order.customerName}${order.model}`.includes(keyword.value)
  const matchChannel = channel.value === '全部渠道' || order.channel === channel.value
  const matchDeposit = deposit.value === '全部押金状态' || order.depositStatus === deposit.value
  const matchShipping = shipping.value === '全部物流状态' || order.shippingStatus === shipping.value
  return matchStatus && matchKeyword && matchChannel && matchDeposit && matchShipping
}))

const activeStatus = computed(() => status.value)

const actionQueue = computed(() => [
  { label: '全部', value: orders.length, status: '全部' },
  { label: '待发货', value: countStatus('待发货'), status: '待发货' },
  { label: '待归还', value: countStatus('待归还'), status: '待归还' },
  { label: '异常', value: countStatus('异常'), status: '异常' }
])

function openOrder(order) {
  router.push(`/mobile/orders/${order.orderNo}`)
}

function countStatus(nextStatus) {
  return orders.filter((order) => order.status === nextStatus).length
}

watch(
  () => route.query.status,
  (nextStatus) => {
    if (typeof nextStatus === 'string' && statuses.includes(nextStatus)) {
      status.value = nextStatus
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: var(--space-12);
}

.mobile-page-header {
  display: block;
}

.orders-summary {
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.orders-summary span,
.orders-summary small {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.orders-summary strong {
  margin: 0 var(--space-4);
  font-size: 26px;
  color: var(--brand-strong);
}

.orders-summary p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  text-align: right;
}

.action-queue {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
}

.action-queue button {
  min-height: 58px;
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  color: var(--text);
  display: grid;
  align-content: center;
  gap: var(--space-4);
}

.action-queue strong {
  font-size: 18px;
  color: var(--brand-strong);
}

.action-queue span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 760;
}

.chip-row {
  display: flex;
  gap: var(--space-8);
  overflow-x: auto;
  padding-bottom: 2px;
}

.sheet-stack {
  display: grid;
  gap: var(--space-12);
}
</style>
