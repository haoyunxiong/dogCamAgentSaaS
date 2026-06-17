<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="租赁商家运营系统" subtitle="商家端" />
      <section class="mobile-dark-hero">
        <div class="hero-title">
          <div>
            <h1>Hi，林小姐</h1>
            <p>深圳南山区 · 06月14日 10:23 更新</p>
          </div>
          <RouterLink to="/ui-v2/reports">经营概览 ›</RouterLink>
        </div>
        <div class="mobile-stat-grid">
          <div v-for="item in heroStats" :key="item.label" class="mobile-stat">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
            <em>{{ item.trend }}</em>
          </div>
        </div>
      </section>
      <section class="mobile-content-sheet">
        <div class="mobile-section-title"><h2>快捷操作</h2><RouterLink to="/ui-v2/mobile/mine">全部功能 ›</RouterLink></div>
        <section class="quick-grid">
          <RouterLink to="/ui-v2/mobile/orders">新建订单</RouterLink>
          <RouterLink to="/ui-v2/mobile/schedule">查档期</RouterLink>
          <RouterLink to="/ui-v2/mobile/devices">设备中心</RouterLink>
          <RouterLink to="/ui-v2/logistics">物流发货</RouterLink>
          <RouterLink to="/ui-v2/customers">客户管理</RouterLink>
          <RouterLink to="/ui-v2/reports">经营报表</RouterLink>
        </section>

        <section class="ui-v2-mobile-card">
          <div class="mobile-section-title"><h2>今日待办（9）</h2><RouterLink to="/ui-v2/mobile/orders">去处理 ›</RouterLink></div>
          <button v-for="task in tasks.slice(0, 4)" :key="task.id" class="mobile-task" type="button">
            <span class="task-dot">{{ task.type.slice(0, 1) }}</span>
            <div>
              <strong>{{ task.type }}</strong>
              <small>{{ task.title }}</small>
            </div>
            <b>{{ task.priority === 'high' ? 12 : 6 }}</b>
          </button>
        </section>

        <section class="ui-v2-mobile-card">
          <div class="mobile-section-title"><h2>运营提醒</h2><RouterLink to="/ui-v2/mobile/orders">全部提醒 ›</RouterLink></div>
          <button v-for="risk in risks.slice(0, 2)" :key="risk.id" class="mobile-alert" type="button" @click="goOrder(risk.relatedOrderId)">
            <div>
              <strong>{{ risk.title }}</strong>
              <small>{{ risk.description }}</small>
            </div>
            <span>去处理 ›</span>
          </button>
        </section>

        <section class="ui-v2-mobile-card">
          <h2>最近订单</h2>
          <OrderCard v-for="order in orders.slice(0, 2)" :key="order.id" :order="order" @click="openOrder" />
        </section>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { OrderCard } from '../../../components/business'
import { MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const router = useRouter()
const orders = uiV2MockAdapter.getOrders()
const tasks = uiV2MockAdapter.getTasks()
const risks = uiV2MockAdapter.getRisks()
const heroStats = [
  { label: '待处理', value: 28, trend: '较昨日 -6' },
  { label: '待发货', value: 36, trend: '较昨日 +8' },
  { label: '待归还', value: 52, trend: '较昨日 -4' },
  { label: '异常/逾期', value: 9, trend: '较昨日 +2' },
  { label: '今日收入(元)', value: '¥28,560.00', trend: '较昨日 +12.6%' },
  { label: '设备利用率', value: '78.6%', trend: '较昨日 +4.3%' },
]
function openOrder(order) {
  router.push(`/ui-v2/mobile/orders/${order.orderNo}`)
}
function goOrder(orderNo) {
  router.push(`/ui-v2/mobile/orders/${orderNo}`)
}
</script>

<style scoped>
.hero-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.hero-title a {
  align-self: start;
  min-height: 34px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  font-size: 12px;
  font-weight: 800;
}
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.quick-grid a,
.mobile-task {
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  background: var(--ui-surface);
}
.quick-grid a {
  min-height: 82px;
  display: grid;
  place-items: center;
  color: var(--ui-brand);
  font-size: 13px;
  font-weight: 820;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}
.mobile-task {
  width: 100%;
  margin-top: var(--space-token-8);
  padding: 12px 0;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-12);
  border: 0;
  border-bottom: 1px solid #edf1f5;
  border-radius: 0;
  text-align: left;
  box-shadow: none;
}
.mobile-task:last-child { border-bottom: 0; }
.mobile-task strong,
.mobile-task small {
  display: block;
}
.mobile-task small {
  margin-top: 2px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.task-dot {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-weight: 850;
}
.mobile-task b {
  color: var(--color-danger);
  font-size: 18px;
}
.mobile-alert {
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 0;
  border-radius: 12px;
  background: #fff7ed;
  color: var(--ui-text);
  text-align: left;
}
.mobile-alert:nth-of-type(3) {
  background: #fef2f2;
}
.mobile-alert small {
  display: block;
  margin-top: 3px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.mobile-alert span {
  flex: 0 0 auto;
  color: var(--color-warning);
  font-size: 12px;
  font-weight: 800;
}
</style>
