<template>
  <UiV2Page title="经营工作台" description="聚合今日履约、风险、订单和设备占用，先处理最影响交付的事项。">
    <template #actions>
      <BaseButton variant="secondary">查看全部待办</BaseButton>
      <BaseButton>新建订单</BaseButton>
    </template>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" />
    </section>

    <section class="dashboard-layout">
      <div class="final-panel today-panel">
        <div class="final-panel__head">
          <div>
            <h2>今日待办</h2>
            <p>按履约优先级处理</p>
          </div>
          <BaseButton variant="secondary" size="sm">查看更多</BaseButton>
        </div>
        <div class="final-panel__body task-list">
          <button v-for="task in tasks" :key="task.id" class="task-row" type="button" @click="goOrder(task.orderId)">
            <span class="task-icon" :class="task.priority === 'high' ? 'is-danger' : 'is-warning'">{{ task.type.slice(0, 1) }}</span>
            <div>
              <strong>{{ task.title }}</strong>
              <small>{{ task.status }} · {{ task.dueAt }}</small>
            </div>
            <BaseButton variant="secondary" size="sm">{{ task.actionLabel }}</BaseButton>
          </button>
        </div>
      </div>

      <div class="final-panel quick-panel">
        <div class="final-panel__head">
          <div>
            <h2>快捷操作</h2>
            <p>常用履约入口</p>
          </div>
          <span>自定义 ›</span>
        </div>
        <div class="quick-actions">
          <RouterLink to="/ui-v2/orders">新建订单</RouterLink>
          <RouterLink to="/ui-v2/orders">订单查询</RouterLink>
          <RouterLink to="/ui-v2/schedule">设备调拨</RouterLink>
          <RouterLink to="/ui-v2/logistics">批量发货</RouterLink>
          <RouterLink to="/ui-v2/devices">设备盘点</RouterLink>
          <RouterLink to="/ui-v2/deposit">延长租期</RouterLink>
          <RouterLink to="/ui-v2/orders">异常申报</RouterLink>
          <RouterLink to="/ui-v2/reports">数据报表</RouterLink>
        </div>
      </div>

      <div class="final-panel reminder-panel">
        <div class="final-panel__head">
          <div>
            <h2>运营提醒</h2>
            <p>风险、库存、活动提醒</p>
          </div>
          <span>查看更多 ›</span>
        </div>
        <div class="final-panel__body reminder-list">
          <button v-for="risk in risks" :key="risk.id" type="button" @click="goOrder(risk.relatedOrderId)">
            <StatusBadge :label="risk.type" :variant="risk.level === '高' ? 'danger' : 'warning'" size="sm" />
            <div>
              <strong>{{ risk.title }}</strong>
              <small>{{ risk.description }}</small>
            </div>
            <span>{{ risk.suggestedAction }} ›</span>
          </button>
        </div>
      </div>

      <div class="final-panel overview-panel">
        <div class="final-panel__head">
          <div>
            <h2>运营概览</h2>
            <p>今日收入、订单和设备周转</p>
          </div>
          <span>查看更多 ›</span>
        </div>
        <div class="final-panel__body overview-grid">
          <div class="trend-card"><strong>¥28,560.00</strong><span>收入趋势（元）</span><i class="trend-line"></i></div>
          <div class="trend-card"><strong>{{ todayActionTotal }}</strong><span>待处理单数</span><i class="trend-line blue"></i></div>
          <div v-for="item in overviewItems" :key="item.label" class="final-mini-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.trend }}</small>
          </div>
        </div>
      </div>

      <div class="final-panel activity-panel">
        <div class="final-panel__head">
          <div>
            <h2>最新动态</h2>
            <p>订单、设备、客户消息</p>
          </div>
        </div>
        <div class="final-panel__body activity-list">
          <div v-for="order in orders.slice(0, 5)" :key="order.orderNo">
            <span></span>
            <div>
              <strong>{{ order.nextAction }}</strong>
              <small>{{ order.orderNo }} · {{ order.customerName }} · {{ order.status }}</small>
            </div>
            <em>10:{{ String(18 - orders.indexOf(order) * 3).padStart(2, '0') }}</em>
          </div>
        </div>
      </div>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { MetricCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import '../shared/uiV2View.css'

const router = useRouter()
const metrics = uiV2MockAdapter.getMetrics()
const orders = uiV2MockAdapter.getOrders()
const tasks = uiV2MockAdapter.getTasks()
const risks = uiV2MockAdapter.getRisks().slice(0, 4)
const todayActionTotal = computed(() => countStatus('待发货') + countStatus('待归还') + countStatus('待押金') + countStatus('异常'))
const overviewItems = [
  { label: '活跃设备数', value: '1,248', trend: '较昨日 +36' },
  { label: '在租订单数', value: '652', trend: '较昨日 +18' },
  { label: '新客数', value: '23', trend: '较昨日 +5' },
  { label: '复购率', value: '32.6%', trend: '较昨日 +2.1%' },
]

function countStatus(status) {
  return orders.filter((order) => order.status === status).length
}

function goOrder(orderNo) {
  router.push({ path: '/ui-v2/orders', query: { order: orderNo } })
}
</script>

<style scoped>
.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(380px, 1.1fr) minmax(320px, 0.75fr) minmax(320px, 0.75fr);
  gap: 14px;
  align-items: start;
}

.today-panel {
  grid-row: span 2;
}

.overview-panel {
  grid-column: span 2;
}

.quick-actions {
  padding: 16px 18px 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.quick-actions a {
  min-height: 88px;
  display: grid;
  place-items: center;
  border: 1px solid #edf1f5;
  border-radius: 10px;
  background: #fafcfd;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 780;
  text-align: center;
}

.task-list,
.reminder-list,
.activity-list {
  display: grid;
  gap: 10px;
}

.task-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 0;
  border: 0;
  border-bottom: 1px solid #edf1f5;
  background: transparent;
  text-align: left;
}

.task-row:last-child {
  border-bottom: 0;
}

.task-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-weight: 850;
  flex: 0 0 auto;
}

.task-icon.is-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.task-row div {
  min-width: 0;
  flex: 1;
}

.task-row strong,
.task-row small {
  display: block;
}

.task-row small,
.reminder-list small,
.activity-list small,
.activity-list em {
  color: var(--color-text-muted);
  font-size: 12px;
}

.reminder-list button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 12px;
  border: 0;
  border-radius: 10px;
  background: #fbfcfd;
  text-align: left;
}

.reminder-list strong,
.activity-list strong,
.next-action {
  color: var(--color-primary);
  font-weight: 820;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.trend-card {
  grid-column: span 2;
  min-height: 174px;
  padding: 16px;
  border: 1px solid #edf1f5;
  border-radius: 10px;
  background: linear-gradient(180deg, #fff, #f8fbfa);
  display: grid;
  align-content: space-between;
}

.trend-card strong {
  color: var(--ui-text);
  font-size: 26px;
  font-variant-numeric: tabular-nums;
}

.trend-card span {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.trend-line {
  height: 56px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(0, 127, 109, 0.1), rgba(0, 127, 109, 0.28));
}

.trend-line.blue {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.26));
}

.activity-list > div {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
}

.activity-list > div > span {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--ui-brand);
}

.activity-list em {
  font-style: normal;
}

@media (max-width: 1380px) {
  .dashboard-layout {
    grid-template-columns: 1fr 1fr;
  }

  .overview-panel {
    grid-column: span 1;
  }
}
</style>
