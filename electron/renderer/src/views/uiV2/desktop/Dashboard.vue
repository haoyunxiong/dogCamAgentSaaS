<template>
  <UiV2Page title="经营工作台" description="聚合今日履约、风险、订单和设备占用，先处理最影响交付的事项。">
    <template #actions>
      <BaseButton variant="secondary">导出今日履约清单</BaseButton>
      <BaseButton>进入待发货队列</BaseButton>
    </template>

    <section class="command-card">
      <div>
        <StatusBadge label="今日工作台" variant="info" size="sm" />
        <h2>{{ todayActionTotal }} 单待流转，{{ highRiskCount }} 个高风险需要先处理</h2>
        <p>建议先处理押金异常、逾期归还和档期冲突，再进入待发货队列。</p>
      </div>
      <div class="command-card__stats">
        <span>发货 {{ countStatus('待发货') }}</span>
        <span>归还 {{ countStatus('待归还') }}</span>
        <span>异常 {{ countStatus('异常') }}</span>
      </div>
    </section>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" />
    </section>

    <section class="ui-v2-grid-2">
      <UiV2Section title="今日优先队列" hint="按风险和截止时间排序">
        <template #actions>
          <StatusBadge label="先处理高风险" variant="danger" size="sm" />
        </template>
        <div class="priority-lanes">
          <div v-for="lane in taskLanes" :key="lane.title" class="priority-lane">
            <div class="ui-v2-row-between">
              <strong>{{ lane.title }}</strong>
              <StatusBadge :label="`${lane.items.length} 项`" variant="neutral" size="sm" />
            </div>
            <button v-for="task in lane.items" :key="task.id" class="task-row" type="button" @click="goOrder(task.orderId)">
              <div>
                <strong>{{ task.title }}</strong>
                <span>{{ task.type }} · {{ task.dueAt }}</span>
              </div>
              <BaseButton variant="secondary" size="sm">{{ task.actionLabel }}</BaseButton>
            </button>
          </div>
        </div>
      </UiV2Section>

      <UiV2Section title="风险处理区" hint="每条风险带建议动作">
        <div class="ui-v2-stack">
          <button v-for="risk in risks" :key="risk.id" class="risk-card" type="button" @click="goOrder(risk.relatedOrderId)">
            <div class="ui-v2-row-between">
              <StatusBadge :label="risk.type" :variant="risk.level === '高' ? 'danger' : 'warning'" size="sm" />
              <span>{{ risk.suggestedAction }}</span>
            </div>
            <strong>{{ risk.title }}</strong>
            <p>{{ risk.description }}</p>
          </button>
        </div>
      </UiV2Section>
    </section>

    <section class="ui-v2-grid-2">
      <UiV2Section title="最近订单" hint="高频处理队列">
        <DataTable :columns="columns" :rows="orders.slice(0, 7)" row-key="orderNo" compact @row-click="goOrder($event.orderNo)">
          <template #orderNo="{ row }"><strong>{{ row.orderNo }}</strong></template>
          <template #status="{ row }"><StatusBadge :label="row.status" size="sm" /></template>
          <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
        </DataTable>
      </UiV2Section>

      <UiV2Section title="7 天履约概览" hint="发货、归还、冲突压缩视图">
        <div class="fulfillment-grid">
          <div v-for="date in sevenDates" :key="date" class="day-strip">
            <div class="ui-v2-row-between">
              <strong>{{ date.slice(5) }}</strong>
              <span>{{ weekLabel(date) }}</span>
            </div>
            <div class="mini-bars">
              <i class="busy" :style="{ height: `${Math.min(countSchedule(date, '占用') * 6 + 18, 72)}px` }" />
              <i class="free" :style="{ height: `${Math.min(countSchedule(date, '可租') * 2 + 18, 72)}px` }" />
              <i class="risk" :style="{ height: `${Math.min(countSchedule(date, '冲突') * 10 + 14, 72)}px` }" />
            </div>
            <small>占用 {{ countSchedule(date, '占用') }} / 冲突 {{ countSchedule(date, '冲突') }}</small>
          </div>
        </div>
      </UiV2Section>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import DataTable from '../../../components/DataTable.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { MetricCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const router = useRouter()
const metrics = uiV2MockAdapter.getMetrics()
const orders = uiV2MockAdapter.getOrders()
const tasks = uiV2MockAdapter.getTasks()
const risks = uiV2MockAdapter.getRisks().slice(0, 4)
const schedule = uiV2MockAdapter.getSchedule()
const sevenDates = uiV2MockAdapter.getScheduleDates().slice(0, 7)
const columns = [
  { key: 'orderNo', label: '订单号' },
  { key: 'customerName', label: '客户' },
  { key: 'model', label: '设备' },
  { key: 'status', label: '状态' },
  { key: 'nextAction', label: '下一步' },
]

const taskLanes = computed(() => [
  { title: '高风险 / 即将截止', items: tasks.filter((task) => task.priority === 'high') },
  { title: '普通待办', items: tasks.filter((task) => task.priority !== 'high') },
])
const todayActionTotal = computed(() => countStatus('待发货') + countStatus('待归还') + countStatus('待押金') + countStatus('异常'))
const highRiskCount = computed(() => risks.filter((risk) => risk.level === '高').length)

function countStatus(status) {
  return orders.filter((order) => order.status === status).length
}

function countSchedule(date, status) {
  return schedule.filter((item) => item.date === date && item.status === status).length
}

function weekLabel(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return `周${week[new Date(`${date}T00:00:00`).getDay()]}`
}

function goOrder(orderNo) {
  router.push({ path: '/ui-v2/orders', query: { order: orderNo } })
}
</script>

<style scoped>
.command-card {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-24);
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-16);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(235, 247, 244, 0.88)),
    var(--color-surface);
  box-shadow: 0 10px 26px rgba(16, 24, 40, 0.06);
}

.command-card::after {
  content: "";
  position: absolute;
  inset: auto 22px 0 22px;
  height: 3px;
  border-radius: var(--radius-pill) var(--radius-pill) 0 0;
  background: linear-gradient(90deg, var(--color-primary), rgba(0, 127, 109, 0.08));
}

.command-card h2 {
  margin: var(--space-12) 0 var(--space-token-4);
  color: var(--color-text);
  font-size: 24px;
  line-height: 32px;
  letter-spacing: 0;
}

.command-card p {
  margin: 0;
  color: var(--color-text-muted);
}

.command-card__stats {
  min-width: 320px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-token-8);
}

.command-card__stats span {
  min-height: 74px;
  padding: 13px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  background: rgba(255, 255, 255, 0.74);
  color: var(--color-text);
  font-weight: 740;
  text-align: center;
  display: grid;
  place-items: center;
}

.priority-lanes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-12);
}

.priority-lane {
  display: grid;
  gap: var(--space-10, 10px);
  padding: var(--space-12);
  border-radius: var(--radius-12);
  background: #f7faf9;
  border: 1px solid rgba(229, 235, 232, 0.84);
}

.task-row,
.risk-card {
  width: 100%;
  display: grid;
  gap: var(--space-token-8);
  padding: var(--space-12);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  background: var(--color-surface);
  text-align: left;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.028);
  transition: border-color var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);
}

.task-row:hover,
.risk-card:hover {
  border-color: rgba(0, 127, 109, 0.26);
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.06);
  transform: translateY(-1px);
}

.task-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.task-row span,
.risk-card span,
.risk-card p,
.day-strip span,
.day-strip small {
  color: var(--color-text-muted);
  font-size: 12px;
}

.risk-card strong,
.next-action {
  color: var(--color-primary);
  font-weight: 820;
}

.fulfillment-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-token-8);
}

.day-strip {
  min-height: 170px;
  display: grid;
  gap: var(--space-token-8);
  padding: var(--space-12);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-12);
  background: linear-gradient(180deg, #fff, #f8fbfa);
}

.mini-bars {
  height: 80px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  align-items: end;
}

.mini-bars i {
  min-height: 10px;
  border-radius: var(--radius-8);
}

.mini-bars .busy { background: var(--color-status-info); }
.mini-bars .free { background: var(--color-status-success); }
.mini-bars .risk { background: var(--color-status-danger); }
</style>
