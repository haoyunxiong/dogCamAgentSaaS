<template>
  <AppShell>
    <div class="page desktop-workbench">
      <header class="page-header">
        <div>
          <h1 class="page-title">经营工作台</h1>
          <p class="page-desc">聚合今日履约、风险、订单和设备占用，帮助门店先处理最影响交付的事项。</p>
        </div>
        <BaseButton variant="secondary">导出今日履约清单</BaseButton>
      </header>

      <section class="desktop-command-card">
        <div>
          <StatusTag label="今日工作台" tone="info" />
          <h2>{{ todayActionTotal }} 单待流转，{{ highRiskCount }} 个高风险需要先处理</h2>
          <p>建议先处理押金异常、逾期归还和档期冲突，再进入待发货队列。</p>
        </div>
        <div class="command-checklist">
          <span>发货 {{ countStatus('待发货') }}</span>
          <span>归还 {{ countStatus('待归还') }}</span>
          <span>异常 {{ countStatus('异常') }}</span>
        </div>
      </section>

      <section class="metric-grid">
        <MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" />
      </section>

      <section class="desktop-workbench-grid">
        <div class="panel priority-panel">
          <div class="panel-header">
            <div>
              <h2 class="section-title">今日优先队列</h2>
              <span class="muted">按风险和截止时间排序</span>
            </div>
            <StatusTag label="先处理高风险" tone="danger" />
          </div>
          <div class="priority-lanes">
            <div v-for="lane in taskLanes" :key="lane.title" class="lane">
              <div class="lane-head">
                <strong>{{ lane.title }}</strong>
                <span>{{ lane.items.length }}</span>
              </div>
              <TaskListItem v-for="task in lane.items" :key="task.id" :task="task" @click="goOrder(task.orderId)" />
            </div>
          </div>
        </div>

        <div class="panel risk-panel">
          <div class="panel-header">
            <div>
              <h2 class="section-title">风险处理区</h2>
              <span class="muted">每条风险都有建议动作</span>
            </div>
          </div>
          <div class="panel-body stack">
            <RiskAlert v-for="risk in risks.slice(0, 4)" :key="risk.id" :risk="risk" @action="goOrder(risk.relatedOrderId)" />
          </div>
        </div>
      </section>

      <section class="desktop-bottom-grid">
        <div class="panel">
          <div class="panel-header">
            <h2 class="section-title">最近订单</h2>
            <RouterLink to="/orders" class="panel-link">查看全部</RouterLink>
          </div>
          <div class="panel-body compact-orders">
            <OrderTable :orders="orders.slice(0, 7)" @row-click="goOrder($event.orderNo)" />
          </div>
        </div>

        <div class="panel fulfillment-panel">
          <div class="panel-header">
            <div>
              <h2 class="section-title">7 天履约概览</h2>
              <span class="muted">发货、归还、冲突压缩视图</span>
            </div>
            <RouterLink to="/schedule" class="panel-link">查看档期</RouterLink>
          </div>
          <div class="panel-body fulfillment-grid">
            <div v-for="date in sevenDates" :key="date" class="day-strip">
              <div class="day-top">
                <strong>{{ date.slice(5) }}</strong>
                <span>{{ weekLabel(date) }}</span>
              </div>
              <div class="mini-bars">
                <i class="ship" :style="{ height: `${Math.min(countBy(date, '占用') * 6 + 18, 72)}px` }" />
                <i class="free" :style="{ height: `${Math.min(countBy(date, '可租') * 2 + 18, 72)}px` }" />
                <i class="risk" :style="{ height: `${Math.min(countBy(date, '冲突') * 10 + 14, 72)}px` }" />
              </div>
              <div class="day-foot">
                <span>占用 {{ countBy(date, '占用') }}</span>
                <span>冲突 {{ countBy(date, '冲突') }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import StatusTag from '../../components/StatusTag.vue'
import MetricCard from '../../components/MetricCard.vue'
import TaskListItem from '../../components/TaskListItem.vue'
import RiskAlert from '../../components/RiskAlert.vue'
import OrderTable from '../../components/OrderTable.vue'
import { metrics } from '../../mock/metrics.js'
import { tasks } from '../../mock/tasks.js'
import { risks } from '../../mock/risks.js'
import { orders } from '../../mock/orders.js'
import { schedule, scheduleDates } from '../../mock/schedule.js'

const router = useRouter()
const sevenDates = scheduleDates.slice(0, 7)

const taskLanes = computed(() => [
  { title: '高风险 / 即将截止', items: tasks.filter((task) => task.priority === 'high') },
  { title: '普通待办', items: tasks.filter((task) => task.priority !== 'high') }
])

const todayActionTotal = computed(() => countStatus('待发货') + countStatus('待归还') + countStatus('待押金') + countStatus('异常'))
const highRiskCount = computed(() => risks.filter((risk) => risk.level === 'high').length)

function countBy(date, status) {
  return schedule.filter((item) => item.date === date && item.status === status).length
}

function goOrder(id) {
  router.push({ path: '/orders', query: { order: id } })
}

function countStatus(status) {
  return orders.filter((order) => order.status === status).length
}

function weekLabel(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return `周${week[new Date(`${date}T00:00:00`).getDay()]}`
}
</script>

<style scoped>
.desktop-command-card {
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

.desktop-command-card h2 {
  margin: var(--space-12) 0 var(--space-4);
  font-size: 22px;
  line-height: 30px;
}

.desktop-command-card p {
  margin: 0;
  color: var(--text-muted);
}

.command-checklist {
  min-width: 320px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-8);
}

.command-checklist span {
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
  color: var(--text-soft);
  font-weight: 740;
  text-align: center;
}

.desktop-workbench-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
  gap: var(--space-16);
  align-items: start;
}

.desktop-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(360px, 0.82fr);
  gap: var(--space-16);
  align-items: start;
}

.priority-lanes {
  padding: var(--space-16);
}

.lane {
  background: var(--surface-soft);
}

.compact-orders :deep(.base-table) {
  border: 0;
  box-shadow: none;
}

.compact-orders :deep(th:nth-child(4)),
.compact-orders :deep(td:nth-child(4)),
.compact-orders :deep(th:nth-child(7)),
.compact-orders :deep(td:nth-child(7)),
.compact-orders :deep(th:nth-child(9)),
.compact-orders :deep(td:nth-child(9)) {
  display: none;
}

.command-hero {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--brand-soft) 76%, transparent), color-mix(in srgb, var(--surface) 96%, transparent) 38%),
    var(--surface);
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
}

.experience-ribbon {
  padding: 13px 15px;
  border: 1px solid color-mix(in srgb, var(--brand) 24%, var(--border));
  border-radius: 14px;
  background:
    linear-gradient(120deg, color-mix(in srgb, var(--ink) 93%, var(--brand) 7%), color-mix(in srgb, var(--brand-strong) 82%, #111 18%));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  position: relative;
}

.experience-ribbon::after {
  content: "";
  position: absolute;
  inset: auto -30px -54px auto;
  width: 220px;
  height: 120px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  transform: rotate(-18deg);
}

.experience-ribbon span {
  color: color-mix(in srgb, #fff 72%, var(--brand-soft));
  font-size: 12px;
  font-weight: 760;
}

.experience-ribbon h2 {
  margin: 4px 0 0;
  font-size: 20px;
  line-height: 1.2;
}

.ribbon-pulses {
  display: flex;
  align-items: end;
  gap: 5px;
  height: 38px;
}

.ribbon-pulses i {
  width: 7px;
  border-radius: 999px;
  background: color-mix(in srgb, #fff 78%, var(--brand-soft));
}

.ribbon-pulses i:nth-child(1) { height: 18px; opacity: 0.64; }
.ribbon-pulses i:nth-child(2) { height: 28px; opacity: 0.78; }
.ribbon-pulses i:nth-child(3) { height: 36px; opacity: 0.92; }
.ribbon-pulses i:nth-child(4) { height: 23px; opacity: 0.7; }

.rhythm-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.rhythm-board article {
  min-height: 96px;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, white), color-mix(in srgb, var(--surface-soft) 88%, transparent));
  display: grid;
  align-content: space-between;
  position: relative;
  overflow: hidden;
}

.rhythm-board article::before {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 3px;
  border-radius: 999px 999px 0 0;
  background: linear-gradient(90deg, var(--brand), var(--accent));
}

.rhythm-board span,
.rhythm-board small {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.rhythm-board strong {
  margin-top: 6px;
  font-size: 24px;
  line-height: 1;
}

.hero-copy {
  display: grid;
  align-content: center;
  gap: 9px;
}

.hero-copy h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.18;
}

.hero-copy p {
  margin: 0;
  color: var(--text-soft);
}

.hero-metrics {
  align-items: stretch;
}

.command-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(360px, 0.65fr);
  gap: 14px;
  align-items: start;
}

.priority-lanes {
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.lane {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: rgba(247, 248, 245, 0.8);
  display: grid;
  align-content: start;
  gap: 6px;
}

.lane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-soft);
  font-size: 12px;
  padding: 0 2px 4px;
}

.lane-head span {
  color: var(--text-muted);
}

.panel-link {
  color: var(--brand);
  font-size: 12px;
  font-weight: 760;
}

.compact-orders :deep(.table-wrap) {
  border: 0;
}

.compact-orders :deep(th:nth-child(4)),
.compact-orders :deep(td:nth-child(4)),
.compact-orders :deep(th:nth-child(7)),
.compact-orders :deep(td:nth-child(7)),
.compact-orders :deep(th:nth-child(9)),
.compact-orders :deep(td:nth-child(9)) {
  display: none;
}

.fulfillment-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
  min-height: 246px;
}

.day-strip {
  min-height: 210px;
  padding: 9px 7px;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  background: rgba(247, 248, 245, 0.78);
}

.day-top strong,
.day-top span,
.day-foot span {
  display: block;
}

.day-top strong {
  font-size: 13px;
}

.day-top span,
.day-foot span {
  color: var(--text-muted);
  font-size: 11px;
}

.mini-bars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  align-items: end;
  padding-top: 10px;
}

:global([data-experience="c"]) .experience-ribbon {
  background:
    radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.24), transparent 28%),
    linear-gradient(125deg, #7d321d, #c0522a 54%, #0f7285);
}

:global([data-experience="c"]) .rhythm-board article {
  border-radius: 16px;
  min-height: 112px;
}

:global([data-experience="c"]) .rhythm-board article:nth-child(even) {
  transform: translateY(8px);
}

:global([data-experience="c"]) .command-hero {
  grid-template-columns: 360px minmax(0, 1fr);
  border-radius: 16px;
}

.mini-bars i {
  width: 100%;
  display: block;
  border-radius: 999px 999px 4px 4px;
}

.mini-bars .ship { background: var(--info); opacity: 0.68; }
.mini-bars .free { background: var(--success); opacity: 0.58; }
.mini-bars .risk { background: var(--danger); opacity: 0.8; }

.day-foot {
  display: grid;
  gap: 2px;
}

.dashboard-bottom {
  grid-template-columns: minmax(0, 1.18fr) minmax(360px, 0.82fr);
  align-items: start;
}

@media (max-width: 1180px) {
  .command-hero,
  .command-grid,
  .dashboard-bottom,
  .desktop-workbench-grid,
  .desktop-bottom-grid,
  .desktop-command-card {
    grid-template-columns: 1fr;
  }

  .desktop-command-card {
    display: grid;
  }

  .command-checklist {
    min-width: 0;
  }
}
</style>
