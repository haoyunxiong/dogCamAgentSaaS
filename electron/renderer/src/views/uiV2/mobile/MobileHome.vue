<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="今日工作台" subtitle="深圳总仓 · 2026-06-17" status-label="Mock" status-variant="info" />
      <section class="risk-hero">
        <StatusBadge label="高风险置顶" variant="danger" size="sm" />
        <h1>{{ risks[0].title }}</h1>
        <p>{{ risks[0].description }}</p>
      </section>
      <section class="quick-grid">
        <RouterLink to="/ui-v2/mobile/orders?status=待发货">待发货 {{ countStatus('待发货') }}</RouterLink>
        <RouterLink to="/ui-v2/mobile/orders?status=待归还">待归还 {{ countStatus('待归还') }}</RouterLink>
        <RouterLink to="/ui-v2/mobile/schedule">查档期</RouterLink>
        <RouterLink to="/ui-v2/mobile/devices">查设备</RouterLink>
      </section>
      <section class="ui-v2-mobile-card">
        <h2>今日任务队列</h2>
        <button v-for="task in tasks" :key="task.id" class="mobile-task" type="button">
          <div>
            <strong>{{ task.title }}</strong>
            <span>{{ task.type }} · {{ task.dueAt }}</span>
          </div>
          <StatusBadge :label="task.priority === 'high' ? '高' : '中'" :variant="task.priority === 'high' ? 'danger' : 'warning'" size="sm" />
        </button>
      </section>
      <section class="ui-v2-mobile-card">
        <h2>最近订单</h2>
        <OrderCard v-for="order in orders.slice(0, 3)" :key="order.id" :order="order" @click="openOrder" />
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { useRouter } from 'vue-router'
import StatusBadge from '../../../components/StatusBadge.vue'
import { OrderCard } from '../../../components/business'
import { MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const router = useRouter()
const orders = uiV2MockAdapter.getOrders()
const tasks = uiV2MockAdapter.getTasks()
const risks = uiV2MockAdapter.getRisks()
function countStatus(status) {
  return orders.filter((order) => order.status === status).length
}
function openOrder(order) {
  router.push(`/ui-v2/mobile/orders/${order.orderNo}`)
}
</script>

<style scoped>
.risk-hero {
  padding: 17px;
  border-radius: var(--radius-16);
  background:
    linear-gradient(135deg, #06211f, #0b3832),
    var(--color-primary-900);
  color: #fff;
  box-shadow: 0 12px 24px rgba(6, 33, 31, 0.16);
}
.risk-hero h1 {
  margin: var(--space-12) 0 var(--space-token-4);
  font-size: 22px;
  line-height: 28px;
}
.risk-hero p {
  margin: 0;
  color: #c9deda;
  font-size: 12px;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-token-8);
}
.quick-grid a,
.mobile-task {
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
}
.quick-grid a {
  min-height: 64px;
  display: grid;
  place-items: center;
  color: var(--ui-brand);
  font-size: 12px;
  font-weight: 820;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}
.mobile-task {
  width: 100%;
  margin-top: var(--space-token-8);
  padding: 12px 13px;
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  text-align: left;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}
.mobile-task strong,
.mobile-task span {
  display: block;
}
.mobile-task span {
  margin-top: 2px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
</style>
