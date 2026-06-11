<template>
  <div class="page reports-page">
    <PageHeader
      title="报表中心"
      subtitle="库存、订单、资金、设备使用 —— 经营全景一屏看尽。"
      icon="📊"
      :breadcrumb="['经营管理', '报表中心']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="loadAll">↻ 刷新数据</button>
      </template>
    </PageHeader>

    <!-- 顶部 Tab 切换 -->
    <div class="report-tabs">
      <button class="report-tab" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">财务概览</button>
      <button class="report-tab" :class="{ active: activeTab === 'deep' }" @click="activeTab = 'deep'">深度分析</button>
    </div>

    <div v-if="loadError" class="report-error">
      报表数据加载失败：{{ loadError }}
    </div>

    <section class="panel report-filter-panel">
      <div class="report-filter-grid">
        <div class="form-group">
          <label>店铺</label>
          <select v-model="filters.storeId">
            <option value="">全部店铺</option>
            <option v-for="store in storeOptions" :key="store.id" :value="String(store.id)">{{ store.name }}</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" @click="loadAll">应用筛选</button>
          <button class="btn btn-secondary" @click="resetFilters">重置</button>
        </div>
      </div>
    </section>

    <!-- ========== 财务概览 ========== -->
    <template v-if="activeTab === 'overview'">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>🏪 店铺经营拆分</h3>
            <div class="panel-tip">共享设备池下，按订单归属统计各店铺订单和租金。</div>
          </div>
        </div>
        <div class="store-stat-grid">
          <div v-for="store in storePerformance" :key="store.key" class="store-stat-card">
            <div class="store-stat-head">
              <strong>{{ store.name }}</strong>
              <span class="store-stat-pill">{{ store.orderCount }} 单</span>
            </div>
            <div class="store-stat-row"><span>租金收入</span><b>¥{{ formatNum(store.revenue) }}</b></div>
            <div class="store-stat-row"><span>进行中</span><b>{{ store.activeCount }}</b></div>
            <div class="store-stat-row"><span>已完成</span><b>{{ store.completedCount }}</b></div>
          </div>
          <div v-if="!storePerformance.length" class="empty-state">暂无店铺订单数据</div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>本期费用概览</h3>
            <div class="panel-tip">顺丰清单运费同步后进入费用统计；实际支付修正后以实际支付金额为准。</div>
          </div>
        </div>
        <div class="expense-summary-grid">
          <div class="expense-summary-card">
            <span>顺丰快递费</span>
            <b>¥{{ formatNum(shippingSfExpense) }}</b>
            <small>来自寄件单实际支付金额</small>
          </div>
          <div class="expense-summary-card">
            <span>全部费用</span>
            <b>¥{{ formatNum(totalExpense) }}</b>
            <small>按费用记录汇总</small>
          </div>
        </div>
      </section>

      <!-- 库存概览 KPI -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>📦 库存概览</h3>
            <div class="panel-tip">设备池当前状态：可租赁 / 已租出 / 维修中 / 停用&损失</div>
          </div>
        </div>
        <div class="inv-kpi-grid">
          <div class="inv-kpi inv-idle">
            <div class="inv-num">{{ inventory.idle }}</div>
            <div class="inv-label">可租赁</div>
          </div>
          <div class="inv-kpi inv-busy">
            <div class="inv-num">{{ inventory.busy }}</div>
            <div class="inv-label">已租出</div>
          </div>
          <div class="inv-kpi inv-repair">
            <div class="inv-num">{{ inventory.repair }}</div>
            <div class="inv-label">维修中</div>
          </div>
          <div class="inv-kpi inv-offline">
            <div class="inv-num">{{ inventory.offline }}</div>
            <div class="inv-label">停用/损失</div>
          </div>
        </div>
      </section>

      <!-- 订单趋势 -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>📈 订单趋势</h3>
            <div class="panel-tip">按创建时间统计，可切换按天/按周/按月。</div>
          </div>
          <div class="trend-toggle">
            <button v-for="g in trendGranularityOptions" :key="g.value"
              class="tg-btn" :class="{ active: trendGranularity === g.value }"
              @click="trendGranularity = g.value">{{ g.label }}</button>
          </div>
        </div>
        <div class="trend-chart-wrap">
          <svg v-if="trendPoints.length" class="trend-chart" :viewBox="`0 0 ${trendChartW} ${trendChartH}`" preserveAspectRatio="none">
            <!-- Y 网格 -->
            <g class="trend-grid">
              <line v-for="i in 4" :key="`g-${i}`" :x1="40" :x2="trendChartW - 10" :y1="40 + (i-1)*((trendChartH-70)/3)" :y2="40 + (i-1)*((trendChartH-70)/3)" />
            </g>
            <!-- Y 轴标签 -->
            <g class="trend-yaxis">
              <text v-for="i in 4" :key="`y-${i}`" :x="32" :y="44 + (i-1)*((trendChartH-70)/3)" text-anchor="end">
                {{ Math.round(trendMax - (trendMax / 3) * (i - 1)) }}
              </text>
            </g>
            <!-- 面积 -->
            <path class="trend-area" :d="trendAreaPath" />
            <!-- 线 -->
            <path class="trend-line" :d="trendLinePath" />
            <!-- 点 + 数值 -->
            <g v-for="(p, idx) in trendPoints" :key="`p-${idx}`">
              <circle :cx="p.x" :cy="p.y" r="3" class="trend-dot" />
              <text v-if="p.value > 0" :x="p.x" :y="p.y - 8" text-anchor="middle" class="trend-val">{{ p.value }}</text>
              <text :x="p.x" :y="trendChartH - 8" text-anchor="middle" class="trend-xlabel">{{ p.label }}</text>
            </g>
          </svg>
          <div v-else class="empty-state">暂无订单数据</div>
        </div>
      </section>

      <!-- 3张资产 / 完成 / 逾期卡片 -->
      <div class="asset-cards">
        <div class="asset-card">
          <div class="ac-head">设备资产 <span class="ac-icon">🏷️</span></div>
          <div class="ac-sub">设备总数</div>
          <div class="ac-big ac-blue">{{ inventory.total }}</div>
          <div class="ac-sub">设备总价值 <span class="ac-tip">(已售出设备不包含在内)</span></div>
          <div class="ac-val ac-blue">¥{{ formatNum(totalAssetValue) }}</div>
          <div class="ac-sub">当前残值</div>
          <div class="ac-val">{{ formatNum(totalResidualValue) }}</div>
          <div class="ac-sub">价值变化</div>
          <div class="ac-val" :class="assetDeltaValue >= 0 ? 'ac-green' : 'ac-red'">{{ assetDeltaValue >= 0 ? '+' : '' }}¥{{ formatNum(assetDeltaValue) }}</div>
          <svg class="ac-spark" viewBox="0 0 200 40" preserveAspectRatio="none">
            <path :d="sparkPath(assetSpark, 200, 40, '#3b82f6')" fill="url(#blueGrad)" stroke="#3b82f6" stroke-width="1.5" />
            <defs><linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6" stop-opacity="0.35"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0.02"/></linearGradient></defs>
          </svg>
        </div>
        <div class="asset-card">
          <div class="ac-head">已完成订单 <span class="ac-icon">✔️</span></div>
          <div class="ac-sub">订单数量</div>
          <div class="ac-big ac-green">{{ completedOrderCount }}</div>
          <div class="ac-sub">累计收入</div>
          <div class="ac-val ac-green">¥{{ formatNum(completedRevenue) }}</div>
          <svg class="ac-spark" viewBox="0 0 200 40" preserveAspectRatio="none">
            <path :d="sparkPath(completedSpark, 200, 40, '#22c55e')" fill="url(#greenGrad)" stroke="#22c55e" stroke-width="1.5" />
            <defs><linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22c55e" stop-opacity="0.35"/><stop offset="1" stop-color="#22c55e" stop-opacity="0.02"/></linearGradient></defs>
          </svg>
        </div>
        <div class="asset-card">
          <div class="ac-head">逾期订单 <span class="ac-icon">⏱️</span></div>
          <div class="ac-sub">订单数量</div>
          <div class="ac-big ac-red">{{ overdueOrderCount }}</div>
          <div class="ac-sub">逾期金额</div>
          <div class="ac-val ac-red">¥{{ formatNum(overdueAmount) }}</div>
          <svg class="ac-spark" viewBox="0 0 200 40" preserveAspectRatio="none">
            <path :d="sparkPath(overdueSpark, 200, 40, '#ef4444')" fill="url(#redGrad)" stroke="#ef4444" stroke-width="1.5" />
            <defs><linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity="0.35"/><stop offset="1" stop-color="#ef4444" stop-opacity="0.02"/></linearGradient></defs>
          </svg>
        </div>
      </div>

      <!-- 最近订单活动 -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>🗓️ 最近订单活动</h3>
            <div class="panel-tip">此处仅显示特定日期创建的已确认和进行中订单。</div>
          </div>
        </div>
        <div class="activity-grid">
          <div class="activity-card ac-cyan">
            <div class="act-title"><span class="act-icon">📅</span>今日订单</div>
            <div class="act-row"><span>订单数：</span><b>{{ activity.today.count }}</b></div>
            <div class="act-row"><span>金额：</span><b>¥{{ formatNum(activity.today.amount) }}</b></div>
          </div>
          <div class="activity-card ac-purple">
            <div class="act-title"><span class="act-icon">✅</span>今日完结</div>
            <div class="act-row"><span>订单数：</span><b>{{ activity.todayDone.count }}</b></div>
            <div class="act-row"><span>金额：</span><b>¥{{ formatNum(activity.todayDone.amount) }}</b></div>
          </div>
          <div class="activity-card ac-lime">
            <div class="act-title"><span class="act-icon">🕐</span>昨日订单</div>
            <div class="act-row"><span>订单数：</span><b>{{ activity.yesterday.count }}</b></div>
            <div class="act-row"><span>金额：</span><b>¥{{ formatNum(activity.yesterday.amount) }}</b></div>
          </div>
          <div class="activity-card ac-amber">
            <div class="act-title"><span class="act-icon">🕑</span>本周订单</div>
            <div class="act-row"><span>订单数：</span><b>{{ activity.thisWeek.count }}</b></div>
            <div class="act-row"><span>金额：</span><b>¥{{ formatNum(activity.thisWeek.amount) }}</b></div>
          </div>
          <div class="activity-card ac-teal">
            <div class="act-title"><span class="act-icon">✔️</span>本月完结</div>
            <div class="act-row"><span>订单数：</span><b>{{ activity.thisMonthDone.count }}</b></div>
            <div class="act-row"><span>金额：</span><b>¥{{ formatNum(activity.thisMonthDone.amount) }}</b></div>
          </div>
        </div>
      </section>
    </template>

    <!-- ========== 深度分析 ========== -->
    <template v-else>
      <!-- 近12个月指标 -->
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>📆 近12个月指标</h3>
            <div class="panel-tip">数据统计以订单发出/开始时间为准。</div>
          </div>
        </div>
        <div class="metric12-grid">
          <div class="metric12-card m12-blue">
            <div class="m12-title"><span class="m12-icon">📄</span>订单总数</div>
            <div class="m12-row"><span>订单数：</span><b class="ac-blue">{{ last12m.orderCount }}</b></div>
          </div>
          <div class="metric12-card m12-green">
            <div class="m12-title"><span class="m12-icon">💰</span>收入总额</div>
            <div class="m12-row"><span>金额：</span><b class="ac-green">¥{{ formatNum(last12m.totalRevenue) }}</b></div>
          </div>
          <div class="metric12-card m12-pink">
            <div class="m12-title"><span class="m12-icon">📊</span>月均收入</div>
            <div class="m12-row"><span>金额：</span><b class="ac-red">¥{{ formatNum(last12m.avgMonthly) }}</b></div>
          </div>
        </div>
      </section>

      <!-- 财务状况 + 回本情况 + 订单状态分布 -->
      <div class="three-col-grid">
        <!-- 资金回收率 Gauge -->
        <section class="panel">
          <div class="panel-header"><div><h3>📟 财务状况指标</h3></div></div>
          <div class="gauge-wrap">
            <svg viewBox="0 0 200 130" class="gauge-svg">
              <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#e5e7eb" stroke-width="14" stroke-linecap="round"/>
              <path :d="gaugePath" fill="none" :stroke="gaugeColor" stroke-width="14" stroke-linecap="round"/>
              <text x="100" y="92" text-anchor="middle" class="gauge-label">资金回收率</text>
              <text x="100" y="118" text-anchor="middle" class="gauge-value" :fill="gaugeColor">{{ roiPct }}%</text>
            </svg>
            <div class="gauge-legend">
              <span class="gl-dot gl-red"></span> &lt;25%
              <span class="gl-dot gl-amber"></span> &lt;50%
              <span class="gl-dot gl-blue"></span> &lt;75%
              <span class="gl-dot gl-green"></span> ≥75%
            </div>
          </div>
        </section>

        <!-- 回本情况 -->
        <section class="panel">
          <div class="panel-header"><div><h3>📈 回本情况</h3></div></div>
          <div class="roi-wrap">
            <svg viewBox="0 0 180 130" class="roi-svg">
              <circle cx="90" cy="70" r="52" fill="none" stroke="#e5e7eb" stroke-width="14"/>
              <circle cx="90" cy="70" r="52" fill="none" stroke="#f59e0b" stroke-width="14"
                :stroke-dasharray="`${(Math.min(roiPct,100)/100)*326.73} 326.73`"
                stroke-dashoffset="81.68" transform="rotate(-90 90 70)" stroke-linecap="round"/>
              <text x="90" y="70" text-anchor="middle" class="roi-big" fill="#f59e0b">{{ roiPct }}%</text>
              <text x="90" y="90" text-anchor="middle" class="roi-sub">回本率</text>
            </svg>
            <div class="roi-stat">
              <div class="rs-row"><span>设备总投资：</span><b>¥{{ formatNum(totalAssetValue) }}</b></div>
              <div class="rs-row"><span>当前总残值：</span><b>¥{{ formatNum(totalResidualValue) }}</b></div>
              <div class="rs-row"><span>已实现收入：</span><b class="ac-green">¥{{ formatNum(completedRevenue) }}</b></div>
              <div class="rs-row"><span>回本状态：</span>
                <span class="roi-badge" :class="roiBadge.cls">{{ roiBadge.label }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 订单状态分布 Donut -->
        <section class="panel">
          <div class="panel-header">
            <div><h3>🎯 订单状态分布</h3><div class="panel-tip">已完成/已确认/进行中/已逾期</div></div>
          </div>
          <div class="donut-wrap">
            <svg viewBox="0 0 200 200" class="donut-svg">
              <g transform="translate(100 100)">
                <path v-for="(arc, idx) in donutArcs" :key="`arc-${idx}`"
                  :d="arc.d" :fill="arc.color" />
                <circle r="48" fill="#fff"/>
                <text text-anchor="middle" y="-2" class="donut-center-label">总订单</text>
                <text text-anchor="middle" y="20" class="donut-center-value">{{ donutTotal }}</text>
              </g>
            </svg>
            <div class="donut-legend">
              <div v-for="(s, idx) in statusDist" :key="`sl-${idx}`" class="dl-item">
                <span class="dl-dot" :style="{ background: s.color }"></span>
                <span class="dl-label">{{ s.label }}</span>
                <span class="dl-num">{{ s.count }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 热门 / 闲置 / 月度使用 -->
      <div class="two-col-grid">
        <section class="panel">
          <div class="panel-header">
            <div><h3>🔥 热门设备 TOP10</h3><div class="panel-tip">按累计使用频率排序</div></div>
          </div>
          <div class="rank-table">
            <div class="rt-head">
              <span>设备型号</span><span class="rt-code">管理编号</span><span class="rt-count">使用频率</span>
            </div>
            <div v-for="(item, idx) in hotTop10" :key="`ht-${idx}`" class="rt-row">
              <span class="rt-name">{{ item.modelCode }}</span>
              <span class="rt-code">{{ item.unitCode || '-' }}</span>
              <span class="rt-count">
                {{ item.count }}
                <span class="rt-bar"><span :style="{ width: (item.count / hotMax * 100) + '%' }"></span></span>
              </span>
            </div>
            <div v-if="!hotTop10.length" class="empty-state">暂无数据</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div><h3>💤 闲置设备 TOP10</h3><div class="panel-tip">使用次数最少的设备（包括从未使用过的）</div></div>
          </div>
          <div class="rank-table">
            <div class="rt-head">
              <span>设备型号</span><span class="rt-code">管理编号</span><span class="rt-count">使用次数</span>
            </div>
            <div v-for="(item, idx) in idleTop10" :key="`it-${idx}`" class="rt-row">
              <span class="rt-name ac-amber">{{ item.modelCode }}</span>
              <span class="rt-code">{{ item.unitCode || '-' }}</span>
              <span class="rt-count">
                {{ item.count }}
                <span v-if="item.count === 0" class="rt-tag">未使用</span>
              </span>
            </div>
            <div v-if="!idleTop10.length" class="empty-state">暂无数据</div>
          </div>
        </section>
      </div>

      <!-- 月度统计曲线 -->
      <section class="panel">
        <div class="panel-header">
          <div><h3>📉 月度统计</h3><div class="panel-tip">最近12个月的订单租金走势</div></div>
        </div>
        <div class="trend-chart-wrap">
          <svg v-if="monthlyPoints.length" class="trend-chart" :viewBox="`0 0 ${monthlyChartW} ${monthlyChartH}`" preserveAspectRatio="none">
            <g class="trend-grid">
              <line v-for="i in 4" :key="`mg-${i}`" :x1="50" :x2="monthlyChartW - 10" :y1="40 + (i-1)*((monthlyChartH-70)/3)" :y2="40 + (i-1)*((monthlyChartH-70)/3)" />
            </g>
            <g class="trend-yaxis">
              <text v-for="i in 4" :key="`my-${i}`" :x="44" :y="44 + (i-1)*((monthlyChartH-70)/3)" text-anchor="end">
                {{ formatShortMoney(monthlyMax - (monthlyMax / 3) * (i - 1)) }}
              </text>
            </g>
            <path class="trend-area" :d="monthlyAreaPath" />
            <path class="trend-line" :d="monthlyLinePath" />
            <g v-for="(p, idx) in monthlyPoints" :key="`mp-${idx}`">
              <circle :cx="p.x" :cy="p.y" r="3" class="trend-dot" />
              <text :x="p.x" :y="monthlyChartH - 8" text-anchor="middle" class="trend-xlabel">{{ p.label }}</text>
            </g>
          </svg>
          <div v-else class="empty-state">暂无数据</div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import { runViewInitialization } from '../../utils/viewInitialization.mjs'

const activeTab = ref('overview')
const units = ref([])
const orders = ref([])
const revenueByMonth = ref([])
const expenseByType = ref([])
const stores = ref([])
const loadError = ref('')
const filters = ref({ storeId: '' })

const trendGranularity = ref('day')
const trendGranularityOptions = [
  { value: 'day', label: '按天' },
  { value: 'week', label: '按周' },
  { value: 'month', label: '按月' },
]

function pad2(n) { return String(n).padStart(2, '0') }
function toIso(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function formatNum(v) { return (Number(v) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }
function formatShortMoney(v) {
  const n = Number(v) || 0
  if (n >= 1_0000_0000) return (n / 1_0000_0000).toFixed(1) + '亿'
  if (n >= 1_0000) return (n / 1_0000).toFixed(0) + '万'
  return String(Math.round(n))
}
function normalizeDateTimeValue(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim().replace(' ', 'T')
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return `${toIso(parsed)}T${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}:${pad2(parsed.getSeconds())}`
}
function normalizeDateOnlyValue(value) {
  return normalizeDateTimeValue(value).slice(0, 10)
}
function normalizeUnitRow(row = {}) {
  return {
    ...row,
    purchase_cost: Number(row.purchase_cost || 0),
    residual_value: Number(row.residual_value || 0),
  }
}
function normalizeOrderRow(row = {}) {
  return {
    ...row,
    fee: Number(row.fee || 0),
    deposit: Number(row.deposit || 0),
    created_at: normalizeDateTimeValue(row.created_at),
    rent_start_date: normalizeDateOnlyValue(row.rent_start_date),
    rent_end_date: normalizeDateOnlyValue(row.rent_end_date),
  }
}
function normalizeRevenueRow(row = {}) {
  return {
    ...row,
    month: String(row.month || '').slice(0, 7),
    total_revenue: Number(row.total_revenue || 0),
    order_count: Number(row.order_count || 0),
    avg_fee: Number(row.avg_fee || 0),
  }
}
function normalizeExpenseRow(row = {}) {
  return {
    ...row,
    expense_type: String(row.expense_type || ''),
    total: Number(row.total || 0),
  }
}

const storeOptions = computed(() => (stores.value || []).filter((store) => store.status !== 'inactive'))
const reportOrders = computed(() => (orders.value || []).filter((order) => order.order_status !== 'cancelled'))
const totalExpense = computed(() => (expenseByType.value || []).reduce((sum, row) => sum + Number(row.total || 0), 0))
const shippingSfExpense = computed(() => {
  const row = (expenseByType.value || []).find((item) => item.expense_type === 'shipping_sf')
  return Number(row?.total || 0)
})
const storePerformance = computed(() => {
  const map = new Map()
  for (const order of reportOrders.value) {
    const key = order.store_id || order.store_name || 'default'
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: order.store_name || '小狗相机',
        orderCount: 0,
        revenue: 0,
        activeCount: 0,
        completedCount: 0,
      })
    }
    const current = map.get(key)
    current.orderCount += 1
    current.revenue += Number(order.fee || 0)
    if (order.order_status === 'completed') current.completedCount += 1
    if (!['completed', 'cancelled'].includes(order.order_status)) current.activeCount += 1
  }
  return Array.from(map.values())
    .map((item) => ({ ...item, revenue: Number(item.revenue.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue || b.orderCount - a.orderCount)
})

// ---- 库存 ----
const inventory = computed(() => {
  const acc = { total: 0, idle: 0, busy: 0, repair: 0, offline: 0 }
  for (const u of units.value || []) {
    acc.total += 1
    const s = u.status || 'idle'
    if (s === 'idle') acc.idle += 1
    else if (s === 'busy') acc.busy += 1
    else if (s === 'repair') acc.repair += 1
    else acc.offline += 1
  }
  return acc
})

const totalAssetValue = computed(() => (units.value || []).reduce((s, u) => s + Number(u.purchase_cost || 0), 0))
const totalResidualValue = computed(() => (units.value || []).reduce((s, u) => s + Number(u.residual_value || 0), 0))
const assetDeltaValue = computed(() => Number((totalResidualValue.value - totalAssetValue.value).toFixed(2)))

// ---- 订单细分 ----
const today = toIso(new Date())
function toDate(s) { return s ? new Date(`${s}T00:00:00`) : null }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return toIso(d) }

const completedOrders = computed(() => (orders.value || []).filter(o => o.order_status === 'completed'))
const completedOrderCount = computed(() => completedOrders.value.length)
const completedRevenue = computed(() => completedOrders.value.reduce((s, o) => s + Number(o.fee || 0), 0))

const overdueOrders = computed(() => (orders.value || []).filter(o => {
  if (o.order_status === 'completed' || o.order_status === 'cancelled') return false
  return o.rent_end_date && o.rent_end_date < today
}))
const overdueOrderCount = computed(() => overdueOrders.value.length)
const overdueAmount = computed(() => overdueOrders.value.reduce((s, o) => s + Number(o.fee || 0), 0))

// ---- 订单趋势 (按 created_at 或 rent_start_date) ----
function orderDate(o) { return normalizeDateOnlyValue(o.rent_start_date || o.created_at) }

const trendChartW = 1100
const trendChartH = 220

const trendPoints = computed(() => {
  const g = trendGranularity.value
  const end = new Date()
  let start, buckets = [], keyFn, labelFn
  if (g === 'day') {
    start = new Date(end); start.setDate(start.getDate() - 29)
    keyFn = (d) => toIso(d)
    labelFn = (d) => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) buckets.push({ key: keyFn(new Date(d)), label: labelFn(new Date(d)), value: 0 })
  } else if (g === 'week') {
    start = new Date(end); start.setDate(start.getDate() - 7 * 11)
    keyFn = (d) => {
      const t = new Date(d); t.setDate(t.getDate() - t.getDay()); return toIso(t)
    }
    labelFn = (d) => {
      const t = new Date(d); t.setDate(t.getDate() - t.getDay()); return `${pad2(t.getMonth()+1)}-${pad2(t.getDate())}`
    }
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) buckets.push({ key: keyFn(new Date(d)), label: labelFn(new Date(d)), value: 0 })
  } else {
    start = new Date(end.getFullYear(), end.getMonth() - 11, 1)
    keyFn = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    labelFn = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) buckets.push({ key: keyFn(new Date(d)), label: labelFn(new Date(d)), value: 0 })
  }
  const bucketMap = new Map(buckets.map((b) => [b.key, b]))
  for (const o of orders.value || []) {
    const iso = orderDate(o); if (!iso) continue
    let key
    if (g === 'day') key = iso
    else if (g === 'week') { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() - d.getDay()); key = toIso(d) }
    else key = iso.slice(0, 7)
    const bk = bucketMap.get(key); if (bk) bk.value += 1
  }
  const maxV = Math.max(...buckets.map(b => b.value), 1)
  const n = buckets.length
  const padL = 40, padR = 10, padT = 40, padB = 30
  const plotW = trendChartW - padL - padR
  const plotH = trendChartH - padT - padB
  return buckets.map((b, i) => ({
    ...b,
    x: padL + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1)),
    y: padT + plotH - (b.value / maxV) * plotH,
  }))
})
const trendMax = computed(() => Math.max(...trendPoints.value.map(p => p.value), 1))
const trendLinePath = computed(() => catmullRomPath(trendPoints.value))
const trendAreaPath = computed(() => {
  if (!trendPoints.value.length) return ''
  const line = trendLinePath.value
  const last = trendPoints.value[trendPoints.value.length - 1]
  const first = trendPoints.value[0]
  return `${line} L ${last.x} ${trendChartH - 30} L ${first.x} ${trendChartH - 30} Z`
})

function catmullRomPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

// ---- 最近活动卡 ----
const activity = computed(() => {
  const list = orders.value || []
  const acc = {
    today: { count: 0, amount: 0 }, todayDone: { count: 0, amount: 0 },
    yesterday: { count: 0, amount: 0 }, thisWeek: { count: 0, amount: 0 },
    thisMonthDone: { count: 0, amount: 0 },
  }
  const todayStr = today
  const yesterdayStr = daysAgo(1)
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return toIso(d) })()
  const monthPrefix = today.slice(0, 7)
  for (const o of list) {
    const cd = (o.created_at || '').slice(0, 10)
    const rs = (o.rent_start_date || '').slice(0, 10)
    const re = (o.rent_end_date || '').slice(0, 10)
    const fee = Number(o.fee || 0)
    const d = cd || rs
    if (d === todayStr) { acc.today.count += 1; acc.today.amount += fee }
    if (d === yesterdayStr) { acc.yesterday.count += 1; acc.yesterday.amount += fee }
    if (d && d >= weekStart) { acc.thisWeek.count += 1; acc.thisWeek.amount += fee }
    if (o.order_status === 'completed') {
      if (re === todayStr) { acc.todayDone.count += 1; acc.todayDone.amount += fee }
      if (re && re.startsWith(monthPrefix)) { acc.thisMonthDone.count += 1; acc.thisMonthDone.amount += fee }
    }
  }
  return acc
})

// sparkline data
const assetSpark = computed(() => Array.from({ length: 12 }, (_, i) => inventory.value.total * (0.6 + (i / 22))))
const completedSpark = computed(() => {
  const arr = new Array(12).fill(0)
  const now = new Date()
  for (const o of orders.value || []) {
    if (o.order_status !== 'completed') continue
    const re = o.rent_end_date || o.created_at
    if (!re) continue
    const d = new Date(re)
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
    if (diff >= 0 && diff < 12) arr[11 - diff] += Number(o.fee || 0)
  }
  return arr
})
const overdueSpark = computed(() => {
  const arr = new Array(12).fill(0)
  const now = new Date()
  for (const o of overdueOrders.value) {
    const d = new Date(o.rent_end_date || o.created_at || now)
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
    if (diff >= 0 && diff < 12) arr[11 - diff] += Number(o.fee || 0)
  }
  return arr
})

function sparkPath(arr, w, h, color) {
  if (!arr || !arr.length) return ''
  const max = Math.max(...arr, 1)
  const n = arr.length
  const points = arr.map((v, i) => {
    const x = (i * w) / (n - 1)
    const y = h - (v / max) * (h - 4) - 2
    return { x, y }
  })
  let d = `M 0 ${h} L ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i += 1) d += ` L ${points[i].x} ${points[i].y}`
  d += ` L ${w} ${h} Z`
  return d
}

// ---- 深度分析 ----
const last12m = computed(() => {
  const now = new Date()
  const from = new Date(now.getFullYear() - 1, now.getMonth(), 1)
  const list = (orders.value || []).filter((o) => {
    const d = new Date(orderDate(o) || 0)
    return d >= from
  })
  const orderCount = list.length
  const totalRevenue = list.reduce((s, o) => s + Number(o.fee || 0), 0)
  return {
    orderCount,
    totalRevenue,
    avgMonthly: totalRevenue / 12,
  }
})

// ROI gauge
const roiPct = computed(() => {
  const inv = totalAssetValue.value
  if (!inv) return 0
  return Math.min(999, Math.round((completedRevenue.value / inv) * 100))
})
const gaugeColor = computed(() => {
  const p = roiPct.value
  if (p < 25) return '#ef4444'
  if (p < 50) return '#f59e0b'
  if (p < 75) return '#3b82f6'
  return '#22c55e'
})
const gaugePath = computed(() => {
  // 半圆 0~180度，根据 roiPct 填充
  const p = Math.min(100, roiPct.value) / 100
  const angle = Math.PI * (1 - p)
  const cx = 100, cy = 110, r = 80
  const x = cx + r * Math.cos(angle)
  const y = cy - r * Math.sin(angle)
  const largeArc = p > 0.5 ? 1 : 0
  if (p <= 0) return ''
  return `M 20 110 A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`
})
const roiBadge = computed(() => {
  const p = roiPct.value
  if (p >= 100) return { cls: 'rb-green', label: '已回本' }
  if (p >= 50) return { cls: 'rb-amber', label: '过半回本' }
  if (p >= 25) return { cls: 'rb-blue', label: '小半回本' }
  return { cls: 'rb-red', label: '起步阶段' }
})

// 订单状态分布 donut
const statusDist = computed(() => {
  const list = orders.value || []
  const acc = { completed: 0, confirmed: 0, active: 0, overdue: 0 }
  const t = today
  for (const o of list) {
    if (o.order_status === 'completed') { acc.completed += 1; continue }
    if (o.order_status === 'cancelled') continue
    if (o.rent_end_date && o.rent_end_date < t) { acc.overdue += 1; continue }
    if (o.rent_start_date && o.rent_start_date <= t) { acc.active += 1; continue }
    acc.confirmed += 1
  }
  return [
    { key: 'completed', label: '已完成', count: acc.completed, color: '#22c55e' },
    { key: 'confirmed', label: '已确认', count: acc.confirmed, color: '#f59e0b' },
    { key: 'active', label: '进行中', count: acc.active, color: '#3b82f6' },
    { key: 'overdue', label: '已逾期', count: acc.overdue, color: '#ef4444' },
  ]
})
const donutTotal = computed(() => statusDist.value.reduce((s, x) => s + x.count, 0))
const donutArcs = computed(() => {
  const total = donutTotal.value
  if (!total) return []
  const arcs = []
  let start = -Math.PI / 2
  const r = 80
  for (const s of statusDist.value) {
    if (!s.count) continue
    const sweep = (s.count / total) * Math.PI * 2
    const end = start + sweep
    const x1 = r * Math.cos(start), y1 = r * Math.sin(start)
    const x2 = r * Math.cos(end), y2 = r * Math.sin(end)
    const large = sweep > Math.PI ? 1 : 0
    arcs.push({
      d: `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: s.color,
    })
    start = end
  }
  return arcs
})

// 热门/闲置 TOP10
const unitUsageList = computed(() => {
  const map = new Map()
  for (const u of units.value || []) {
    const key = `${u.id}`
    map.set(key, { unitId: u.id, unitCode: u.unit_code, modelCode: u.model_code, count: 0 })
  }
  for (const o of orders.value || []) {
    if (!o.unit_id) continue
    const e = map.get(String(o.unit_id))
    if (e) e.count += 1
  }
  return Array.from(map.values())
})
const hotTop10 = computed(() => [...unitUsageList.value].sort((a, b) => b.count - a.count).slice(0, 10))
const hotMax = computed(() => Math.max(...hotTop10.value.map(x => x.count), 1))
const idleTop10 = computed(() => [...unitUsageList.value].sort((a, b) => a.count - b.count).slice(0, 10))

// 月度租金曲线 (近12个月)
const monthlyChartW = 1100
const monthlyChartH = 240
const monthlyPoints = computed(() => {
  const now = new Date()
  const buckets = []
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${pad2(d.getMonth()+1)}`, label: `${d.getFullYear()}-${pad2(d.getMonth()+1)}`, value: 0 })
  }
  const map = new Map(buckets.map(b => [b.key, b]))
  for (const row of revenueByMonth.value || []) {
    const bk = map.get(row.month); if (bk) bk.value = Number(row.total_revenue || 0)
  }
  const maxV = Math.max(...buckets.map(b => b.value), 1)
  const n = buckets.length
  const padL = 50, padR = 10, padT = 40, padB = 30
  const plotW = monthlyChartW - padL - padR
  const plotH = monthlyChartH - padT - padB
  return buckets.map((b, i) => ({
    ...b,
    x: padL + (i * plotW) / (n - 1),
    y: padT + plotH - (b.value / maxV) * plotH,
  }))
})
const monthlyMax = computed(() => Math.max(...monthlyPoints.value.map(p => p.value), 1))
const monthlyLinePath = computed(() => catmullRomPath(monthlyPoints.value))
const monthlyAreaPath = computed(() => {
  if (!monthlyPoints.value.length) return ''
  const last = monthlyPoints.value[monthlyPoints.value.length - 1]
  const first = monthlyPoints.value[0]
  return `${monthlyLinePath.value} L ${last.x} ${monthlyChartH - 30} L ${first.x} ${monthlyChartH - 30} Z`
})

async function loadAll() {
  try {
    loadError.value = ''
    const storeId = filters.value.storeId ? Number(filters.value.storeId) : undefined
    const [u, o, rep] = await Promise.all([
      window.electronAPI.listScheduleUnits({}),
      window.electronAPI.listOrders({ storeId }),
      window.electronAPI.getRevenueReport({ storeId }),
    ])
    units.value = Array.isArray(u) ? u.map(normalizeUnitRow) : []
    orders.value = Array.isArray(o) ? o.map(normalizeOrderRow) : []
    revenueByMonth.value = Array.isArray(rep?.revenueByMonth) ? rep.revenueByMonth.map(normalizeRevenueRow) : []
    expenseByType.value = Array.isArray(rep?.expenseByType) ? rep.expenseByType.map(normalizeExpenseRow) : []
  } catch (e) {
    console.error('报表加载失败', e)
    loadError.value = e?.message || '报表加载失败'
  }
}

async function loadStores() {
  stores.value = await window.electronAPI.listStores({ status: 'active' })
}

function resetFilters() {
  filters.value.storeId = ''
  loadAll()
}

onMounted(() => {
  runViewInitialization('经营报表', async () => {
    await loadStores()
    await loadAll()
  })
})
</script>

<style scoped>
.reports-page { gap: 18px; }

.report-filter-grid {
  display: grid;
  grid-template-columns: minmax(220px, 320px) auto;
  gap: 14px;
  align-items: end;
}

.store-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.store-stat-card {
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 16px;
  background: var(--bg-surface, #fff);
}

.store-stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.store-stat-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
}

.store-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
}

.store-stat-row b {
  color: var(--text-primary);
}

.expense-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.expense-summary-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background: #f8fafc;
}

.expense-summary-card span,
.expense-summary-card small {
  color: var(--text-secondary);
}

.expense-summary-card b {
  color: #0f766e;
  font-size: 24px;
}

/* Tab */
.report-tabs {
  display: flex; gap: 4px;
  border-bottom: 1px solid var(--border-light);
  padding: 0 4px;
}
.report-tab {
  background: transparent; border: none;
  padding: 10px 18px; font-size: 14px; font-weight: 600;
  color: var(--text-secondary); cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.report-tab:hover { color: #3b82f6; }
.report-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.report-error {
  padding: 12px 14px;
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #b91c1c;
  border-radius: 10px;
  font-size: 13px;
}

/* 库存概览 */
.inv-kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
.inv-kpi {
  background: #f8fafc;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 22px 16px;
  text-align: center;
  transition: transform 0.15s, box-shadow 0.15s;
}
.inv-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
.inv-num { font-size: 34px; font-weight: 800; line-height: 1; margin-bottom: 8px; }
.inv-label { font-size: 12px; color: var(--text-secondary); }
.inv-idle .inv-num { color: #22c55e; }
.inv-busy .inv-num { color: #3b82f6; }
.inv-repair .inv-num { color: #f59e0b; }
.inv-offline .inv-num { color: #ef4444; }

/* 趋势切换按钮 */
.trend-toggle {
  display: inline-flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
}
.tg-btn {
  background: transparent; border: none;
  padding: 6px 14px; font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
}
.tg-btn.active {
  background: #fff;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* 曲线图 */
.trend-chart-wrap {
  width: 100%;
  padding: 8px 0;
}
.trend-chart {
  width: 100%;
  height: 240px;
  display: block;
}
.trend-grid line { stroke: #f1f5f9; stroke-dasharray: 3 3; }
.trend-yaxis text { fill: #94a3b8; font-size: 11px; }
.trend-line { fill: none; stroke: #3b82f6; stroke-width: 2; }
.trend-area { fill: url(#trendGrad); opacity: 0.25; }
.trend-dot { fill: #3b82f6; stroke: #fff; stroke-width: 1.5; }
.trend-val { fill: #3b82f6; font-size: 11px; font-weight: 700; }
.trend-xlabel { fill: #94a3b8; font-size: 10px; }
/* 需要内嵌 defs gradient */
.trend-chart::before { content: ''; }

.trend-chart {
  /* use inline <defs> instead since scoped svg can't reference outside */
}

/* 资产卡 */
.asset-cards {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
.asset-card {
  background: #fff;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 4px;
  position: relative;
  overflow: hidden;
}
.ac-head {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin-bottom: 8px;
  display: flex; align-items: center; gap: 6px;
}
.ac-icon { font-size: 14px; }
.ac-sub { font-size: 11px; color: var(--text-muted); margin-top: 6px; }
.ac-tip { color: var(--text-muted); font-weight: 400; }
.ac-big { font-size: 28px; font-weight: 800; line-height: 1.2; }
.ac-val { font-size: 20px; font-weight: 800; }
.ac-blue { color: #3b82f6; }
.ac-green { color: #22c55e; }
.ac-red { color: #ef4444; }
.ac-amber { color: #f59e0b; }
.ac-spark {
  width: 100%; height: 40px; margin-top: 10px;
  display: block;
}

/* 最近活动卡 */
.activity-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;
}
.activity-card {
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border-light);
}
.act-title {
  font-size: 13px; font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
  display: flex; align-items: center; gap: 6px;
}
.act-icon { font-size: 14px; }
.act-row {
  display: flex; justify-content: space-between;
  font-size: 12px; color: var(--text-secondary);
  margin-top: 4px;
}
.act-row b { color: var(--text-primary); font-weight: 700; }
.ac-cyan { background: #ecfeff; }
.ac-purple { background: #faf5ff; }
.ac-lime { background: #f7fee7; }
.ac-amber { background: #fffbeb; }
.ac-teal { background: #f0fdfa; }

/* 近12月 */
.metric12-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
.metric12-card {
  padding: 18px 22px;
  border-radius: 12px;
  border: 1px solid var(--border-light);
}
.m12-title {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 14px;
}
.m12-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  background: #fff; font-size: 14px;
}
.m12-row {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 13px; color: var(--text-secondary);
}
.m12-row b { font-size: 22px; font-weight: 800; }
.m12-blue { background: #eff6ff; }
.m12-green { background: #f0fdf4; }
.m12-pink { background: #fdf2f8; }

/* 三列布局 */
.three-col-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
}
.two-col-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
}

/* Gauge */
.gauge-wrap {
  display: flex; flex-direction: column; align-items: center;
  padding: 10px 0;
}
.gauge-svg { width: 100%; max-width: 280px; height: auto; }
.gauge-label { font-size: 12px; fill: var(--text-secondary); font-weight: 600; }
.gauge-value { font-size: 22px; font-weight: 800; }
.gauge-legend {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; color: var(--text-secondary);
  margin-top: 10px; flex-wrap: wrap; justify-content: center;
}
.gl-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 3px; }
.gl-red { background: #ef4444; }
.gl-amber { background: #f59e0b; }
.gl-blue { background: #3b82f6; }
.gl-green { background: #22c55e; }

/* ROI donut */
.roi-wrap {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 0;
}
.roi-svg { width: 160px; flex-shrink: 0; height: auto; }
.roi-big { font-size: 20px; font-weight: 800; }
.roi-sub { font-size: 11px; fill: var(--text-secondary); }
.roi-stat { flex: 1; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.rs-row {
  display: flex; justify-content: space-between;
  padding: 6px 10px; background: #f8fafc; border-radius: 6px;
}
.roi-badge {
  padding: 3px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 700;
}
.rb-red { background: #fee2e2; color: #b91c1c; }
.rb-blue { background: #dbeafe; color: #1d4ed8; }
.rb-amber { background: #fef3c7; color: #b45309; }
.rb-green { background: #dcfce7; color: #15803d; }

/* Donut */
.donut-wrap {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 0;
}
.donut-svg { width: 160px; flex-shrink: 0; }
.donut-center-label { font-size: 10px; fill: var(--text-muted); }
.donut-center-value { font-size: 20px; font-weight: 800; fill: var(--text-primary); }
.donut-legend { flex: 1; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.dl-item { display: flex; align-items: center; gap: 8px; }
.dl-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.dl-label { flex: 1; color: var(--text-secondary); }
.dl-num { font-weight: 700; color: var(--text-primary); }

/* Rank 表格 */
.rank-table {
  display: flex; flex-direction: column;
  font-size: 13px;
}
.rt-head {
  display: grid; grid-template-columns: 1fr 1fr 1.2fr;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
}
.rt-row {
  display: grid; grid-template-columns: 1fr 1fr 1.2fr;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  align-items: center;
}
.rt-row:hover { background: #fafcff; }
.rt-name { color: #3b82f6; font-weight: 600; }
.rt-code { color: var(--text-secondary); font-family: monospace; font-size: 12px; }
.rt-count {
  font-weight: 700; color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
}
.rt-bar {
  flex: 1; max-width: 120px;
  height: 6px; border-radius: 3px;
  background: #e5e7eb; overflow: hidden;
}
.rt-bar span {
  display: block; height: 100%;
  background: #3b82f6;
  border-radius: 3px;
}
.rt-tag {
  padding: 1px 8px;
  background: #fee2e2; color: #b91c1c;
  border-radius: 4px; font-size: 10px; font-weight: 700;
}

.empty-state {
  padding: 40px; text-align: center;
  color: var(--text-muted); font-size: 13px;
}

@media (max-width: 1280px) {
  .three-col-grid { grid-template-columns: 1fr 1fr; }
  .activity-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 900px) {
  .inv-kpi-grid, .asset-cards, .metric12-grid, .three-col-grid, .two-col-grid {
    grid-template-columns: 1fr 1fr;
  }
  .activity-grid { grid-template-columns: 1fr 1fr; }
}
</style>
