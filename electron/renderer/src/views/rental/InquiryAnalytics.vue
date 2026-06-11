<template>
  <div class="page inquiry-page">
    <PageHeader
      title="订单分析"
      subtitle="聚合询单、转化、收入和库存效率，辅助补货、定价和履约决策。"
      :breadcrumb="['经营管理', '订单分析']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="goToOptimizationSettings">
          询单优化设置
        </button>
        <button class="btn btn-secondary" :disabled="loading" @click="loadAll">
          <RefreshCw class="btn-icon" aria-hidden="true" />
          刷新
        </button>
      </template>
    </PageHeader>

    <FilterBar>
      <div class="filter-grid">
        <label>
          <span>店铺</span>
          <select v-model="filters.storeId" @change="loadAll">
            <option value="">全部店铺</option>
            <option v-for="store in stores" :key="store.id" :value="String(store.id)">{{ store.name }}</option>
          </select>
        </label>
        <label>
          <span>型号</span>
          <select v-model="filters.modelCode" @change="loadAll">
            <option value="">全部型号</option>
            <option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option>
          </select>
        </label>
        <label>
          <span>开始日期</span>
          <input v-model="filters.from" type="date" @change="loadAll" />
        </label>
        <label>
          <span>结束日期</span>
          <input v-model="filters.to" type="date" @change="loadAll" />
        </label>
        <div class="filter-actions">
          <button class="btn btn-primary" :disabled="loading" @click="loadAll">应用</button>
          <button class="btn btn-secondary" @click="resetFilters">重置</button>
        </div>
      </div>
    </FilterBar>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <KpiStrip :items="kpiItems" />

    <section class="chart-grid">
      <div class="panel chart-card">
        <div class="section-head compact-head">
          <div>
            <h3>询单趋势</h3>
            <p>近 14 天询单量变化</p>
          </div>
        </div>
        <div class="mini-chart">
          <div v-for="point in inquiryTrend" :key="point.label" class="mini-bar-col">
            <span class="mini-bar-value">{{ point.value }}</span>
            <span class="mini-bar-track">
              <span class="mini-bar-fill" :style="{ height: `${point.ratio}%` }"></span>
            </span>
            <span class="mini-bar-label">{{ point.label }}</span>
          </div>
        </div>
      </div>

      <div class="panel chart-card">
        <div class="section-head compact-head">
          <div>
            <h3>转化漏斗</h3>
            <p>从询单到建单的关键阶段</p>
          </div>
        </div>
        <div class="funnel-list">
          <div v-for="item in funnelItems" :key="item.key" class="funnel-item">
            <div class="funnel-row">
              <div class="funnel-copy">
                <span>{{ item.label }}</span>
                <small>{{ item.note }}</small>
              </div>
              <strong>{{ item.value }}</strong>
            </div>
            <div class="funnel-track">
              <span class="funnel-fill" :style="{ width: `${item.ratio}%` }"></span>
            </div>
            <div class="funnel-meta">{{ formatPercent(item.ratio / 100) }}</div>
          </div>
        </div>
      </div>

      <div class="panel chart-card">
        <div class="section-head compact-head">
          <div>
            <h3>型号收入排行</h3>
            <p>按成交收入排序的重点机型</p>
          </div>
        </div>
        <div class="ranking-list">
          <div v-for="item in revenueRanking" :key="item.modelCode" class="ranking-row">
            <div class="ranking-meta">
              <strong>{{ item.modelCode }}</strong>
              <span>{{ formatMoney(item.revenue) }}</span>
            </div>
            <div class="ranking-track">
              <span class="ranking-fill" :style="{ width: `${item.ratio}%` }"></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <h3>优化建议</h3>
          <p>结合询单热度、转化和成本估算，输出补货、调价或继续观察的建议。</p>
        </div>
        <div class="section-meta">
          <span class="meta-chip">窗口 {{ suggestions.config.analysisWindowDays || 0 }} 天</span>
          <select v-model="filters.suggestionType" class="meta-select">
            <option value="">全部建议</option>
            <option v-for="item in suggestionTypeOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
        </div>
      </div>
      <div class="insight-grid">
        <InsightCard title="高优先级" :value="priorityCount('high')" hint="建议尽快处理" badge="high" tone="danger" />
        <InsightCard title="中优先级" :value="priorityCount('medium')" hint="建议本周处理" badge="medium" tone="warning" />
        <InsightCard title="低优先级" :value="priorityCount('low')" hint="继续跟踪观察" badge="low" tone="info" />
      </div>
      <DataTable min-width="1060px" compact>
          <thead>
            <tr>
              <th>型号</th>
              <th>优先级</th>
              <th>建议动作</th>
              <th class="num">询单</th>
              <th class="num">无档率</th>
              <th class="num">转化率</th>
              <th class="num">月化 ROI</th>
              <th class="num">建议调价</th>
              <th class="num">在库</th>
              <th class="num">收入</th>
              <th class="num">成本</th>
              <th class="num">净收益</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredSuggestionRows" :key="row.modelCode">
              <td><code>{{ row.modelCode }}</code></td>
              <td>
                <StatusBadge :label="priorityLabel(row.priority)" :variant="priorityClass(row.priority)" />
              </td>
              <td>
                <StatusBadge :label="suggestionLabel(row.normalizedAction)" :variant="suggestionClass(row.normalizedAction)" />
              </td>
              <td class="num">{{ row.inquiries }}</td>
              <td class="num">{{ formatPercent(row.unavailableRate) }}</td>
              <td class="num">{{ formatPercent(row.conversionRate) }}</td>
              <td class="num">{{ formatPercent(row.monthlyRoi) }}</td>
              <td class="num">{{ formatPriceDelta(row.priceDelta) }}</td>
              <td class="num">{{ row.inventoryUnits || 0 }}</td>
              <td class="num">{{ formatMoney(row.costs?.revenue) }}</td>
              <td class="num">{{ formatMoney(row.costs?.totalCost) }}</td>
              <td class="num">{{ formatMoney(row.costs?.netProfit) }}</td>
              <td class="reason-cell">{{ row.reasonSummary }}</td>
            </tr>
            <tr v-if="!filteredSuggestionRows.length">
              <td colspan="13">
                <EmptyState title="暂无优化建议" hint="当前筛选范围内样本不足或还没有可用的成本数据。" compact />
              </td>
            </tr>
          </tbody>
      </DataTable>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <h3>型号询单排行</h3>
          <p>重点看高频、无档多、有档未成单多的型号。</p>
        </div>
      </div>
      <DataTable min-width="980px">
          <thead>
            <tr>
              <th>型号</th>
              <th class="num">询单</th>
              <th class="num">有档</th>
              <th class="num">无档</th>
              <th class="num">有档未成单</th>
              <th class="num">已建单</th>
              <th class="num">转化率</th>
              <th class="num">平均报价</th>
              <th class="num">成交均价</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in stats.byModel" :key="row.modelCode">
              <td><code>{{ row.modelCode }}</code></td>
              <td class="num">{{ row.inquiries }}</td>
              <td class="num">{{ row.available }}</td>
              <td class="num">
                <StatusBadge :label="String(row.unavailable)" :variant="row.unavailable ? 'warning' : 'success'" />
              </td>
              <td class="num">{{ row.availableNotConverted }}</td>
              <td class="num">{{ row.converted }}</td>
              <td class="num">{{ formatPercent(row.conversionRate) }}</td>
              <td class="num">{{ formatMoney(row.avgQuotedPrice) }}</td>
              <td class="num">{{ formatMoney(row.avgFinalFee) }}</td>
            </tr>
            <tr v-if="!stats.byModel.length">
              <td colspan="9">
                <EmptyState title="暂无询单统计" hint="从手机 H5 或飞书查一次档期后，这里会出现记录。" compact />
              </td>
            </tr>
          </tbody>
      </DataTable>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <h3>最近询单记录</h3>
          <p>用于确认每次查档期是否被正确记录，并检查是否已经转化为订单。</p>
        </div>
      </div>
      <DataTable min-width="1060px" compact>
          <thead>
            <tr>
              <th>时间</th>
              <th>来源</th>
              <th>店铺</th>
              <th>型号</th>
              <th>租期</th>
              <th>地区</th>
              <th class="num">报价</th>
              <th>档期</th>
              <th>转化</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in events" :key="row.id">
              <td>{{ formatDateTime(row.created_at) }}</td>
              <td>{{ sourceLabel(row.source) }}</td>
              <td>{{ row.store_name || '-' }}</td>
              <td><code>{{ row.model_code || '-' }}</code></td>
              <td>{{ formatRange(row.rent_start_date, row.rent_end_date) }}</td>
              <td>{{ [row.province, row.city, row.district].filter(Boolean).join('') || '-' }}</td>
              <td class="num">{{ formatMoney(row.quoted_price) }}</td>
              <td>
                <StatusBadge
                  :label="Number(row.available) === 1 ? `有档 ${row.available_unit_count || 0} 台` : '无档'"
                  :variant="Number(row.available) === 1 ? 'success' : 'warning'"
                />
              </td>
              <td>
                <StatusBadge :label="row.order_id ? `订单 #${row.order_id}` : '未建单'" :variant="row.order_id ? 'success' : 'neutral'" />
              </td>
            </tr>
            <tr v-if="!events.length">
              <td colspan="9">
                <EmptyState title="暂无询单记录" hint="当前筛选范围内没有查档期记录。" compact />
              </td>
            </tr>
          </tbody>
      </DataTable>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RefreshCw } from '@lucide/vue'
import FilterBar from '../../components/FilterBar.vue'
import DataTable from '../../components/DataTable.vue'
import InsightCard from '../../components/InsightCard.vue'
import KpiStrip from '../../components/KpiStrip.vue'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { runViewInitialization } from '../../utils/viewInitialization.mjs'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const stores = ref([])
const units = ref([])
const events = ref([])
const stats = ref({
  total: {
    inquiries: 0,
    available: 0,
    unavailable: 0,
    converted: 0,
    conversionRate: 0,
    avgQuotedPrice: 0,
    avgFinalFee: 0,
  },
  byModel: [],
})
const suggestions = ref({
  config: {
    analysisWindowDays: 0,
  },
  rows: [],
  summary: {
    actionCounts: {},
  },
})

const filters = reactive({
  storeId: '',
  modelCode: '',
  from: '',
  to: '',
  suggestionType: '',
})

const modelOptions = computed(() => {
  return Array.from(new Set((units.value || []).map((unit) => unit.model_code || unit.modelCode).filter(Boolean))).sort()
})
const suggestionTypeOptions = [
  { key: 'restock', label: '补货' },
  { key: 'increase_price', label: '提价' },
  { key: 'decrease_price', label: '降价' },
  { key: 'observe', label: '继续观察' },
  { key: 'insufficient_sample', label: '样本不足' },
]
const suggestionRows = computed(() => {
  return (suggestions.value?.rows || []).map((row) => {
    const normalizedAction = normalizeSuggestionAction(row)
    return {
      ...row,
      normalizedAction,
      priority: computeSuggestionPriority({ ...row, normalizedAction }),
    }
  })
})
const filteredSuggestionRows = computed(() => {
  const priorityWeight = { high: 0, medium: 1, low: 2 }
  return suggestionRows.value
    .filter((row) => !filters.suggestionType || row.normalizedAction === filters.suggestionType)
    .sort((a, b) => {
      const diff = (priorityWeight[a.priority] ?? 9) - (priorityWeight[b.priority] ?? 9)
      if (diff !== 0) return diff
      return Number(b.inquiries || 0) - Number(a.inquiries || 0)
    })
})
const totalRevenue = computed(() => suggestionRows.value.reduce((sum, row) => sum + Number(row.costs?.revenue || 0), 0))
const totalNetProfit = computed(() => suggestionRows.value.reduce((sum, row) => sum + Number(row.costs?.netProfit || 0), 0))
const inventoryTurnover = computed(() => {
  const totalUnits = Math.max(units.value.length, 1)
  return Number(stats.value?.total?.converted || 0) / totalUnits
})
const availabilityRate = computed(() => {
  const inquiries = Number(stats.value?.total?.inquiries || 0)
  if (!inquiries) return 0
  return Number(stats.value?.total?.available || 0) / inquiries
})
const kpiItems = computed(() => [
  { key: 'inquiries', label: '询单数', value: stats.value?.total?.inquiries || 0, hint: '查档期记录', tone: 'info' },
  { key: 'availability', label: '有档率', value: formatPercent(availabilityRate.value), hint: `无档 ${stats.value?.total?.unavailable || 0} 次`, tone: 'success' },
  { key: 'conversion', label: '查档建单率', value: formatPercent(stats.value?.total?.conversionRate || 0), hint: `查档记录已建单 ${stats.value?.total?.converted || 0} 次`, tone: 'warning', emphasis: Number(stats.value?.total?.conversionRate || 0) < 0.12 },
  { key: 'revenue', label: '成交收入', value: formatMoney(totalRevenue.value), hint: '建议样本收入，不等同查档转化', tone: 'info' },
  { key: 'profit', label: '净收益', value: formatMoney(totalNetProfit.value), hint: '扣除成本后', tone: totalNetProfit.value >= 0 ? 'success' : 'danger' },
  { key: 'turnover', label: '库存周转', value: formatPercent(inventoryTurnover.value), hint: `${units.value.length || 0} 台在库`, tone: 'info' },
])
const inquiryTrend = computed(() => {
  const buckets = []
  const now = new Date(filters.to || new Date())
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const key = dateOnly(date)
    const value = events.value.filter((event) => String(event.created_at || '').slice(0, 10) === key).length
    buckets.push({ key, label: key.slice(5), value })
  }
  const max = Math.max(...buckets.map((item) => item.value), 1)
  return buckets.map((item) => ({ ...item, ratio: item.value > 0 ? Math.max((item.value / max) * 100, 8) : 0 }))
})
const funnelItems = computed(() => {
  const inquiries = Number(stats.value?.total?.inquiries || 0)
  const available = Number(stats.value?.total?.available || 0)
  const converted = Number(stats.value?.total?.converted || 0)
  const top = Math.max(inquiries, 1)
  return [
    { key: 'inquiries', label: '询单', value: inquiries, ratio: (inquiries / top) * 100, note: '进入查档流程的总量' },
    { key: 'available', label: '有档', value: available, ratio: (available / top) * 100, note: `流失 ${Math.max(inquiries - available, 0)} 次` },
    { key: 'converted', label: '建单', value: converted, ratio: (converted / top) * 100, note: `流失 ${Math.max(available - converted, 0)} 次` },
  ]
})
const revenueRanking = computed(() => {
  const rows = [...suggestionRows.value]
    .sort((a, b) => Number(b.costs?.revenue || 0) - Number(a.costs?.revenue || 0))
    .slice(0, 5)
  const max = Math.max(...rows.map((row) => Number(row.costs?.revenue || 0)), 1)
  return rows.map((row) => ({
    modelCode: row.modelCode,
    revenue: Number(row.costs?.revenue || 0),
    ratio: (Number(row.costs?.revenue || 0) / max) * 100,
  }))
})

function dateOnly(date) {
  return date.toISOString().slice(0, 10)
}

function setDefaultDates() {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 29)
  filters.from = dateOnly(from)
  filters.to = dateOnly(now)
}

function buildFilterPayload(limit) {
  return {
    storeId: filters.storeId || undefined,
    modelCode: filters.modelCode || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    limit,
  }
}

async function loadOptions() {
  const [storeRows, unitRows] = await Promise.all([
    window.electronAPI.listStores({ status: 'active' }),
    window.electronAPI.listScheduleUnits({ activeInventoryOnly: true }),
  ])
  stores.value = storeRows || []
  units.value = unitRows || []
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [nextStats, nextEvents, nextSuggestions] = await Promise.all([
      window.electronAPI.getInquiryStats(buildFilterPayload(1000)),
      window.electronAPI.listInquiryEvents(buildFilterPayload(100)),
      window.electronAPI.getRentalOptimizationSuggestions(buildFilterPayload(1000)),
    ])
    stats.value = nextStats || stats.value
    events.value = nextEvents || []
    suggestions.value = nextSuggestions || suggestions.value
  } catch (err) {
    error.value = err?.message || String(err)
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.storeId = ''
  filters.modelCode = ''
  filters.suggestionType = ''
  setDefaultDates()
  loadAll()
}

function formatMoney(value) {
  const num = Number(value || 0)
  if (!num) return '-'
  return `¥${num.toFixed(2)}`
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}

function formatRange(start, end) {
  if (!start && !end) return '-'
  return `${String(start || '').slice(0, 10)} 至 ${String(end || '').slice(0, 10)}`
}

function formatDateTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

function sourceLabel(source) {
  const map = {
    feishu: '飞书',
    mobile_h5: '手机 H5',
    xianyu: '闲鱼',
  }
  return map[source] || source || '-'
}

function actionCount(action) {
  return suggestions.value?.summary?.actionCounts?.[action] || 0
}

function normalizeSuggestionAction(row) {
  const raw = row?.action || ''
  if (Number(row?.inquiries || 0) < 3) return 'insufficient_sample'
  if (['restock', 'increase_price', 'decrease_price', 'observe'].includes(raw)) return raw
  return 'observe'
}

function suggestionLabel(action) {
  const map = {
    restock: '补货',
    increase_price: '提价',
    decrease_price: '降价',
    observe: '继续观察',
    insufficient_sample: '样本不足',
  }
  return map[action] || action || '-'
}

function suggestionClass(action) {
  const map = {
    restock: 'info',
    increase_price: 'success',
    decrease_price: 'warning',
    observe: 'neutral',
    insufficient_sample: 'neutral',
  }
  return map[action] || 'neutral'
}

function computeSuggestionPriority(row) {
  const inquiries = Number(row.inquiries || 0)
  const unavailableRate = Number(row.unavailableRate || 0)
  const conversionRate = Number(row.conversionRate || 0)
  const roi = Number(row.monthlyRoi || 0)
  if (row.normalizedAction === 'restock' && (unavailableRate >= 0.25 || inquiries >= 8)) return 'high'
  if (row.normalizedAction === 'decrease_price' && inquiries >= 5 && conversionRate < 0.18) return 'high'
  if (row.normalizedAction === 'increase_price' && conversionRate >= 0.35 && roi > 0.18) return 'medium'
  if (row.normalizedAction === 'restock' && inquiries >= 4) return 'medium'
  if (row.normalizedAction === 'decrease_price' && inquiries >= 3) return 'medium'
  if (row.normalizedAction === 'observe' && inquiries >= 6 && roi < 0.05) return 'medium'
  if (row.normalizedAction === 'observe') return 'low'
  if (row.normalizedAction === 'insufficient_sample') return 'low'
  return 'medium'
}

function priorityLabel(priority) {
  if (priority === 'high') return '高'
  if (priority === 'medium') return '中'
  return '低'
}

function priorityClass(priority) {
  if (priority === 'high') return 'danger'
  if (priority === 'medium') return 'warning'
  return 'neutral'
}

function priorityCount(priority) {
  return filteredSuggestionRows.value.filter((row) => row.priority === priority).length
}

function formatPriceDelta(value) {
  const amount = Number(value || 0)
  if (!amount) return '-'
  return `${amount > 0 ? '+' : ''}${formatMoney(amount)}`
}

function goToOptimizationSettings() {
  router.push({ path: '/settings', query: { module: 'inquiry-optimization' } })
}

onMounted(() => {
  runViewInitialization('询单分析', async () => {
    setDefaultDates()
    await loadOptions()
    await loadAll()
  })
})
</script>

<style scoped>
.inquiry-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-panel {
  padding: 14px;
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(180px, 1fr) 150px 150px auto;
  gap: 12px;
  align-items: end;
}

.filter-grid label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 700;
}

.filter-grid select,
.filter-grid input {
  height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
  color: var(--text-strong);
  font-size: 13px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 15px;
  height: 15px;
  margin-right: 6px;
  vertical-align: -2px;
}

.error-banner {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.22);
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
}

.chart-grid,
.insight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.chart-card {
  min-height: 240px;
}

.compact-head {
  margin-bottom: 14px;
}

.mini-chart {
  display: grid;
  grid-template-columns: repeat(14, minmax(0, 1fr));
  gap: 8px;
  align-items: end;
  height: 170px;
}

.mini-bar-col {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.mini-bar-value,
.mini-bar-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.mini-bar-track {
  position: relative;
  display: flex;
  align-items: end;
  width: 100%;
  height: 112px;
  border-radius: 999px;
  background: #eef2f6;
}

.mini-bar-fill {
  width: 100%;
  border-radius: 999px;
  background: var(--brand-primary, #0f766e);
}

.funnel-list,
.ranking-list {
  display: grid;
  gap: 12px;
}

.funnel-item,
.ranking-row {
  display: grid;
  gap: 8px;
}

.funnel-row,
.ranking-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.funnel-copy {
  display: grid;
  gap: 2px;
}

.funnel-copy small,
.funnel-meta {
  font-size: 11px;
  color: var(--text-secondary);
}

.funnel-track,
.ranking-track {
  height: 10px;
  border-radius: 999px;
  background: #eef2f6;
  overflow: hidden;
}

.funnel-fill,
.ranking-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--brand-primary, #0f766e);
}

.section-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.section-head h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-strong);
}

.section-head p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.section-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.meta-select {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  background: #fff;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.num {
  text-align: right !important;
}

code {
  padding: 2px 6px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}

.reason-cell {
  white-space: normal;
  min-width: 220px;
  line-height: 1.5;
}

@media (max-width: 1180px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-actions {
    grid-column: 1 / -1;
  }

  .section-meta {
    justify-content: flex-start;
  }

  .chart-grid,
  .insight-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .mini-chart {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    height: auto;
  }
}
</style>
