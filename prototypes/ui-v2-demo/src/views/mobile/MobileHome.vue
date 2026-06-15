<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="mobile-page-header">
        <div>
          <span>深圳总仓 · 06/14</span>
          <h1>移动端工作台</h1>
        </div>
        <StatusTag label="营业中" tone="success" />
      </header>

      <section class="mobile-hero">
        <div>
          <span>今日优先级</span>
          <strong>{{ highRiskCount }} 个高风险需要先处理</strong>
          <p>先处理押金异常、逾期归还和档期冲突，再进入发货队列。</p>
        </div>
        <BaseButton variant="secondary" size="sm" @click="goOrders('异常')">查看</BaseButton>
      </section>

      <section class="mobile-kpi-grid">
        <button v-for="item in mobileKpis" :key="item.label" type="button" @click="goOrders(item.status)">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </button>
      </section>

      <section class="mobile-section">
        <div class="row-between">
          <h2>快捷处理</h2>
          <span class="muted">常用动作</span>
        </div>
        <div class="quick-grid">
          <RouterLink to="/mobile/orders"><strong>发</strong><span>待发货</span></RouterLink>
          <RouterLink to="/mobile/orders"><strong>押</strong><span>押金复核</span></RouterLink>
          <RouterLink to="/mobile/schedule"><strong>期</strong><span>档期查询</span></RouterLink>
          <RouterLink to="/mobile/devices"><strong>码</strong><span>设备快查</span></RouterLink>
        </div>
      </section>

      <section class="mobile-section">
        <div class="row-between">
          <h2>今日任务队列</h2>
          <span class="muted">{{ tasks.length }} 项</span>
        </div>
        <div class="mobile-list">
          <TaskListItem v-for="task in tasks" :key="task.id" :task="task" @click="goOrder(task.orderId)" />
        </div>
      </section>

      <section class="mobile-section">
        <div class="row-between">
          <h2>风险提醒</h2>
          <RouterLink to="/mobile/orders" class="text-link">处理</RouterLink>
        </div>
        <div class="stack">
          <RiskAlert v-for="risk in risks.slice(0, 2)" :key="risk.id" :risk="risk" @action="goOrder(risk.relatedOrderId)" />
        </div>
      </section>

      <section class="mobile-section">
        <div class="row-between">
          <h2>最近订单</h2>
          <RouterLink to="/mobile/orders" class="text-link">全部</RouterLink>
        </div>
        <div class="stack">
          <OrderCard v-for="order in orders.slice(0, 2)" :key="order.id" :order="order" @click="openOrder(order)" />
        </div>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import MobileShell from '../../components/MobileShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import StatusTag from '../../components/StatusTag.vue'
import RiskAlert from '../../components/RiskAlert.vue'
import TaskListItem from '../../components/TaskListItem.vue'
import OrderCard from '../../components/OrderCard.vue'
import { risks } from '../../mock/risks.js'
import { tasks } from '../../mock/tasks.js'
import { orders } from '../../mock/orders.js'

const router = useRouter()

const highRiskCount = computed(() => risks.filter((risk) => risk.level === 'high').length)

const mobileKpis = computed(() => [
  { label: '待发货', value: countStatus('待发货'), status: '待发货' },
  { label: '待归还', value: countStatus('待归还'), status: '待归还' },
  { label: '押金复核', value: countStatus('待押金'), status: '待押金' },
  { label: '异常', value: countStatus('异常'), status: '异常' }
])

function openOrder(order) {
  router.push(`/mobile/orders/${order.orderNo}`)
}

function goOrder(orderId) {
  router.push(`/mobile/orders/${orderId}`)
}

function goOrders(status) {
  router.push({ path: '/mobile/orders', query: { status } })
}

function countStatus(status) {
  return orders.filter((order) => order.status === status).length
}
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: var(--space-12);
}

.mobile-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) 0 0;
}

.mobile-page-header span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: var(--font-caption-line);
  font-weight: 700;
}

.mobile-page-header h1 {
  margin: var(--space-4) 0 0;
  font-size: var(--font-mobile-nav-title-size);
  line-height: var(--font-mobile-nav-title-line);
}

.mobile-hero {
  padding: var(--space-16);
  border-radius: var(--radius-16);
  background: var(--color-primary-900);
  color: #fff;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
}

.mobile-hero span {
  color: #b9d9d4;
  font-size: 12px;
  font-weight: 740;
}

.mobile-hero strong {
  display: block;
  margin-top: var(--space-8);
  font-size: 20px;
  line-height: 1.25;
}

.mobile-hero p {
  margin: var(--space-8) 0 0;
  color: #d7e8e5;
  font-size: 12px;
  line-height: 18px;
}

.mobile-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
}

.mobile-kpi-grid button {
  min-height: 64px;
  padding: var(--space-8) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  text-align: center;
  display: grid;
  align-content: center;
  gap: var(--space-4);
}

.mobile-kpi-grid strong {
  font-size: 22px;
  color: var(--brand-strong);
}

.mobile-kpi-grid span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 740;
}

.mobile-section {
  display: grid;
  gap: var(--space-10, 10px);
}

.mobile-section h2 {
  margin: 0;
  font-size: 16px;
}

.mobile-list {
  padding: var(--space-4) var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
}

.quick-grid a {
  min-height: 58px;
  padding: var(--space-10, 10px) var(--space-8);
  border-radius: var(--radius-12);
  border: 1px solid var(--border);
  background: var(--surface);
  display: grid;
  place-items: center;
  align-content: center;
  gap: 3px;
  text-align: center;
  color: var(--text);
  font-weight: 760;
}

.quick-grid strong,
.quick-grid span {
  display: block;
}

.quick-grid strong {
  font-size: 18px;
  color: var(--brand-strong);
}

.quick-grid span {
  color: var(--text-muted);
  font-size: 11px;
}

.text-link {
  color: var(--brand);
  font-size: 13px;
  font-weight: 760;
}
</style>
