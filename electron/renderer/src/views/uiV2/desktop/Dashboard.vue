<template>
  <UiV2Page title="经营工作台" description="聚合今日履约、风险、订单和设备占用，先处理最影响交付的事项。">
    <template #actions>
      <BaseButton variant="secondary" @click="router.push('/ui-v2/orders')">查看全部待办</BaseButton>
      <BaseButton data-testid="dashboard-create-order-button" @click="goCreateOrder">新建订单</BaseButton>
    </template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in dashboardMetrics" :key="metric.key" :metric="metric" />
    </section>

    <div v-if="loading" class="adapter-state">工作台只读聚合读取中...</div>

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
          <div class="trend-card"><strong>{{ totalAmountLabel }}</strong><span>订单金额基础汇总</span><i class="trend-line"></i></div>
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

      <details class="final-panel demo-status-band">
        <summary>系统状态 / 上线准备</summary>
        <div class="demo-status-grid">
          <div>
            <span>本地演示</span>
            <strong>{{ actorRoleLabel }} · {{ actorContext.merchantName || actorContext.merchantId }}</strong>
            <small>{{ actorContext.storeName || actorContext.storeId }} / 外部真实调用关闭</small>
          </div>
          <div>
            <span>安全操作</span>
            <strong>{{ healthStatusLabel }}</strong>
            <small>{{ healthSummary }}</small>
          </div>
          <div>
            <span>配置中心</span>
            <strong>{{ configSourceLabel }}</strong>
            <small>{{ configSummary }}</small>
          </div>
          <RouterLink to="/ui-v2/settings">系统健康 / 上线准备</RouterLink>
        </div>
      </details>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { MetricCard } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { actorContextAdapter } from '../../../adapters/uiV2/actorContextAdapter.js'
import { configCenterAdapter } from '../../../adapters/uiV2/configCenterAdapter.js'
import { healthCheckAdapter } from '../../../adapters/uiV2/healthCheckAdapter.js'
import UiV2Page from '../shared/UiV2Page.vue'
import '../shared/uiV2View.css'

const router = useRouter()
const metrics = ref([])
const orders = ref([])
const tasks = ref([])
const risks = ref([])
const devices = ref([])
const schedule = ref([])
const customers = ref([])
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const actorContext = ref(actorContextAdapter.getLocalActorContext())
const health = ref(null)
const configOverview = ref(null)

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})

const dashboardMetrics = computed(() => [
  { key: 'todayTodo', label: '今日待处理', value: todayActionTotal.value, unit: '单', trend: todayActionTotal.value ? '优先处理' : '今日暂无新订单', tone: todayActionTotal.value ? 'warning' : 'success' },
  { key: 'ship', label: '待发货', value: countStatus('待发货'), unit: '单', trend: '需补充物流', tone: 'warning' },
  { key: 'return', label: '待归还', value: countStatus('待归还'), unit: '单', trend: '关注租期结束', tone: 'warning' },
  { key: 'risk', label: '异常订单', value: countStatus('异常'), unit: '单', trend: '需人工复核', tone: countStatus('异常') ? 'danger' : 'success' },
  { key: 'renting', label: '当前在租', value: countStatus('租赁中'), unit: '单', trend: '履约中', tone: 'info' },
  { key: 'scheduleRisk', label: '未来档期风险', value: schedule.value.filter((slot) => ['冲突', '维修'].includes(slot.status)).length, unit: '处', trend: '未来窗口', tone: 'warning' },
])

const todayActionTotal = computed(() => countStatus('待发货') + countStatus('待归还') + countStatus('待押金') + countStatus('异常'))
const totalAmountLabel = computed(() => `¥${orders.value.reduce((sum, order) => sum + Number(order.rentAmount || order.totalAmount || 0), 0).toLocaleString()}`)
const overviewItems = computed(() => [
  { label: '空闲设备', value: countDeviceStatus(['可租', '空闲']), trend: `设备总数 ${devices.value.length}` },
  { label: '占用设备', value: countDeviceStatus(['在租', '已预订', '占用']), trend: '只读统计' },
  { label: '维修设备', value: countDeviceStatus(['维修中', '维修', '异常']), trend: '不可分配' },
  { label: '档期占用', value: schedule.value.filter((slot) => ['占用', '冲突'].includes(slot.status)).length, trend: '当前窗口' },
  { label: '客户数', value: customers.value.length, trend: '派生只读' },
  { label: '热门型号', value: topModel.value, trend: '按订单数' },
  { label: '主要来源', value: topSource.value, trend: '字段缺失时降级' },
])

const topModel = computed(() => topBy(orders.value, (order) => order.model || '未填写型号'))
const topSource = computed(() => topBy(orders.value, (order) => order.channel || order.source || '手工'))
const healthStatus = computed(() => health.value?.status || 'checking')
const actorRoleLabel = computed(() => actorContext.value?.roleLabel || actorContextAdapter.getRoleLabel(actorContext.value?.role))
const healthStatusLabel = computed(() => {
  const labels = {
    checking: '检查中',
    'ready-for-local-demo': '本地演示就绪',
    ready: '就绪',
    blocked: '已阻断',
  }
  return labels[healthStatus.value] || healthStatus.value
})
const healthSummary = computed(() => {
  if (!health.value?.ok) return '本地检查待完成'
  const readyCount = health.value.checks?.filter((check) => check.status === 'ready').length || 0
  const totalCount = health.value.checks?.length || 0
  return `${readyCount}/${totalCount} 项检查就绪`
})
const configSourceLabel = computed(() => {
  const source = configOverview.value?.source || ''
  if (source === 'mysql') return '本地 MySQL'
  if (source === 'localStorage') return '浏览器本地预览'
  return '读取中'
})
const configSummary = computed(() => {
  if (!configOverview.value?.ok) return configOverview.value?.message || '配置中心待检查'
  const storesCount = configOverview.value?.stores?.count || 0
  const configured = configOverview.value?.config?.sensitiveConfiguredCount || 0
  const total = configOverview.value?.config?.sensitiveCount || 0
  return `门店 ${storesCount} 个，敏感状态 ${configured}/${total}，真实外部关闭`
})

function countStatus(status) {
  return orders.value.filter((order) => order.status === status).length
}

function countDeviceStatus(statuses) {
  return devices.value.filter((device) => statuses.includes(device.status)).length
}

function topBy(rows, resolver) {
  const counts = new Map()
  rows.forEach((row) => {
    const key = resolver(row)
    if (!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || '暂无数据'
}

function goCreateOrder() {
  router.push({ path: '/ui-v2/orders', query: { intent: 'create-order-preview' } })
}

function resolveDashboardMeta() {
  const methodNames = ['getMetrics', 'getOrders', 'getTasks', 'getRisks', 'getDevices', 'getSchedule', 'getCustomers']
  const metas = methodNames.map((methodName) => uiV2Adapter.getLastMeta(methodName)).filter(Boolean)
  return metas.find((meta) => meta.source === 'mock-fallback')
    || metas.find((meta) => meta.source === 'real')
    || metas[0]
    || uiV2Adapter.getMeta()
}

async function loadDashboard() {
  loading.value = true
  loadError.value = ''
  try {
    const [
      nextMetrics,
      nextOrders,
      nextTasks,
      nextRisks,
      nextDevices,
      nextSchedule,
      nextCustomers,
    ] = await Promise.all([
      uiV2Adapter.getMetrics(),
      uiV2Adapter.getOrders(),
      uiV2Adapter.getTasks(),
      uiV2Adapter.getRisks(),
      uiV2Adapter.getDevices(),
      uiV2Adapter.getSchedule(),
      uiV2Adapter.getCustomers(),
    ])
    metrics.value = Array.isArray(nextMetrics) ? nextMetrics : []
    orders.value = Array.isArray(nextOrders) ? nextOrders : []
    tasks.value = Array.isArray(nextTasks) ? nextTasks.slice(0, 8) : []
    risks.value = Array.isArray(nextRisks) ? nextRisks.slice(0, 4) : []
    devices.value = Array.isArray(nextDevices) ? nextDevices : []
    schedule.value = Array.isArray(nextSchedule) ? nextSchedule : []
    customers.value = Array.isArray(nextCustomers) ? nextCustomers : []
    sourceMeta.value = resolveDashboardMeta()
    actorContext.value = actorContextAdapter.getLocalActorContext()
    const [nextHealth, nextConfigOverview] = await Promise.all([
      healthCheckAdapter.getLocalDemoHealthCheck(),
      configCenterAdapter.getOverview(),
    ])
    health.value = nextHealth
    configOverview.value = nextConfigOverview
  } catch (error) {
    metrics.value = []
    orders.value = []
    tasks.value = []
    risks.value = []
    devices.value = []
    schedule.value = []
    customers.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '工作台只读聚合读取失败'
  } finally {
    loading.value = false
  }
}

function goOrder(orderNo) {
  router.push({ path: '/ui-v2/orders', query: { order: orderNo } })
}

onMounted(loadDashboard)
</script>

<style scoped>
.demo-status-band {
  grid-column: 1 / -1;
  padding: 12px;
}

.demo-status-band summary {
  cursor: pointer;
  color: var(--ui-text);
  font-weight: 820;
}

.demo-status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 12px;
  align-items: stretch;
  margin-top: 12px;
}

.demo-status-grid > div,
.demo-status-grid > a {
  min-height: 82px;
  padding: 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-8);
  background: var(--ui-surface);
  display: grid;
  align-content: center;
  gap: 5px;
}

.demo-status-grid span,
.demo-status-grid small {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.demo-status-grid strong {
  color: var(--ui-text);
  font-size: 15px;
  font-weight: 850;
}

.demo-status-grid > a {
  min-width: 168px;
  place-items: center;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 820;
  text-align: center;
}

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

.adapter-source-row {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
  flex-wrap: wrap;
}

.adapter-source,
.adapter-source__reason,
.adapter-source__error {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-pill);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}

.adapter-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}

.adapter-source.is-mock-fallback,
.adapter-source__reason {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}

.adapter-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.9);
  color: #b42318;
}

.adapter-state {
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 680;
}

@media (max-width: 1380px) {
  .demo-status-band {
    grid-template-columns: 1fr 1fr;
  }

  .dashboard-layout {
    grid-template-columns: 1fr 1fr;
  }

  .overview-panel {
    grid-column: span 1;
  }
}
</style>
