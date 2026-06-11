<template>
  <div class="page market-page">
    <PageHeader
      title="市场监控"
      subtitle="追踪闲鱼同类机型帖子数量、价格中位数与异动，辅助判断买卖时机。"
      icon="📊"
      :breadcrumb="['运营工具', '市场监控']"
    >
      <template #actions>
        <button class="btn btn-primary" :disabled="scanning" @click="startScan">
          {{ scanning ? '🔄 扫描中…' : '🔍 立即扫描' }}
        </button>
      </template>
      <template #filters>
        <div class="toolbar">
          <select v-model="selectedModel" @change="loadData" class="select-sm">
            <option value="">全部机型</option>
            <option v-for="m in modelCodes" :key="m" :value="m">{{ m }}</option>
          </select>
          <select v-model="days" @change="loadData" class="select-sm">
            <option :value="7">近 7 天</option>
            <option :value="14">近 14 天</option>
            <option :value="30">近 30 天</option>
          </select>
        </div>
      </template>
    </PageHeader>

    <!-- 异动告警 -->
    <div v-if="alerts.length" class="alerts-strip">
      <div v-for="alert in alerts" :key="alert.modelCode" class="alert-card" :class="{ up: alert.priceDeltaPct > 0, down: alert.priceDeltaPct < 0 }">
        <div class="alert-model">{{ alert.modelCode }}</div>
        <div class="alert-detail">
          <span class="alert-arrow">{{ alert.priceDeltaPct > 0 ? '↑' : '↓' }}</span>
          均价 {{ Math.abs(alert.priceDeltaPct) }}%
          <span class="alert-sep">·</span>
          帖子 {{ alert.listingDeltaPct > 0 ? '+' : '' }}{{ alert.listingDeltaPct }}%
        </div>
        <div class="alert-price">¥{{ alert.currentPrice?.toFixed(0) }}</div>
      </div>
    </div>

    <!-- 趋势图 -->
    <section class="panel trend-panel">
      <div class="panel-header">
        <h3>价格趋势</h3>
        <div class="panel-tip">{{ selectedModel || '所有机型' }} · {{ days }} 天</div>
      </div>
      <div class="trend-chart" v-if="trend.length">
        <div class="trend-row" v-for="item in trend" :key="item.day">
          <div class="trend-date">{{ item.day?.slice(5) }}</div>
          <div class="trend-bar-bg">
            <div class="trend-bar-min" :style="{ left: trendPos(item.min_price), width: trendWidth(item.min_price, item.max_price) }">
              <span class="trend-bar-label">¥{{ item.min_price?.toFixed(0) }} ~ ¥{{ item.max_price?.toFixed(0) }}</span>
            </div>
            <div class="trend-avg-dot" :style="{ left: trendPos(item.avg_price) }" :title="`均价 ¥${item.avg_price?.toFixed(0)}`"></div>
          </div>
          <div class="trend-meta">
            <span>均 ¥{{ item.avg_price?.toFixed(0) }}</span>
            <span class="trend-count">{{ item.avg_listings?.toFixed(0) }} 条</span>
          </div>
        </div>
      </div>
      <EmptyState
        v-else
        icon="📉"
        tone="primary"
        title="还没有趋势数据"
        hint="点击右上角「立即扫描」即可采集最新闲鱼市场数据。"
        compact
      />
    </section>

    <!-- 快照列表 -->
    <section class="panel">
      <div class="panel-header">
        <h3>扫描历史</h3>
      </div>
      <div class="snapshot-grid" v-if="snapshots.length">
        <div v-for="s in snapshots" :key="s.id" class="snapshot-card">
          <div class="snapshot-header">
            <span class="snapshot-model">{{ s.model_code }}</span>
            <span class="snapshot-time">{{ formatTime(s.snapshot_time) }}</span>
          </div>
          <div class="snapshot-stats">
            <div><span class="stat-sm-label">帖子</span><span class="stat-sm-value">{{ s.total_listings }}</span></div>
            <div><span class="stat-sm-label">均价</span><span class="stat-sm-value">¥{{ s.avg_price?.toFixed(0) }}</span></div>
            <div><span class="stat-sm-label">最低</span><span class="stat-sm-value">¥{{ s.min_price?.toFixed(0) }}</span></div>
            <div><span class="stat-sm-label">最高</span><span class="stat-sm-value">¥{{ s.max_price?.toFixed(0) }}</span></div>
          </div>
        </div>
      </div>
      <EmptyState
        v-else
        icon="🗂"
        title="暂无扫描记录"
        hint="完成一次扫描后，历史快照将显示在这里，便于对比价格变化。"
        compact
      />
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'

const selectedModel = ref('')
const days = ref(14)
const modelCodes = ref([])
const trend = ref([])
const snapshots = ref([])
const alerts = ref([])
const scanning = ref(false)

// 计算趋势图位置
const priceRange = computed(() => {
  const allPrices = trend.value.flatMap(t => [t.min_price, t.max_price, t.avg_price]).filter(Boolean)
  return { min: Math.min(...allPrices, 0), max: Math.max(...allPrices, 1) }
})
function trendPos(price) {
  const { min, max } = priceRange.value
  const range = max - min || 1
  return `${Math.max(((price - min) / range) * 100, 2)}%`
}
function trendWidth(minP, maxP) {
  const { min, max } = priceRange.value
  const range = max - min || 1
  return `${Math.max(((maxP - minP) / range) * 100, 2)}%`
}
function formatTime(t) { return t?.replace('T', ' ').slice(0, 16) || '-' }

async function loadData() {
  try {
    // 获取机型列表
    const units = await window.electronAPI.listScheduleUnits({})
    modelCodes.value = [...new Set((units || []).map(u => u.model_code).filter(Boolean))]

    // 趋势
    if (selectedModel.value) {
      trend.value = await window.electronAPI.getMarketTrend({ modelCode: selectedModel.value, days: days.value }) || []
      const alert = await window.electronAPI.getMarketAlerts({ modelCode: selectedModel.value, days: days.value })
      alerts.value = alert ? [alert] : []
    } else {
      trend.value = []
      // 获取所有机型告警
      const allAlerts = []
      for (const mc of modelCodes.value) {
        const a = await window.electronAPI.getMarketAlerts({ modelCode: mc, days: days.value })
        if (a) allAlerts.push(a)
      }
      alerts.value = allAlerts
    }

    // 快照
    const filters = { limit: 50 }
    if (selectedModel.value) filters.modelCode = selectedModel.value
    snapshots.value = await window.electronAPI.listMarketSnapshots(filters) || []
  } catch (e) {
    console.error('加载市场数据失败', e)
  }
}

async function startScan() {
  scanning.value = true
  try {
    await window.electronAPI.startMarketScan({ modelCodes: modelCodes.value })
  } catch (e) {
    console.error('扫描失败', e)
  }
}

function onScanResult(msg) {
  scanning.value = false
  loadData()
}

onMounted(() => {
  loadData()
  window.electronAPI.onMarketScanResult(onScanResult)
})
onUnmounted(() => {
  window.electronAPI.removeAllListeners('bot:market_scan_result')
})
</script>

<style scoped>
.alerts-strip { display: flex; gap: 10px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
.alert-card { flex-shrink: 0; padding: 12px 16px; border-radius: 10px; background: var(--bg-secondary); border-left: 3px solid var(--border); min-width: 180px; }
.alert-card.up { border-left-color: #ef4444; background: #fef2f2; }
.alert-card.down { border-left-color: #22c55e; background: #f0fdf4; }
.alert-model { font-weight: 600; font-size: 13px; }
.alert-detail { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.alert-arrow { font-weight: 700; }
.alert-card.up .alert-arrow { color: #ef4444; }
.alert-card.down .alert-arrow { color: #22c55e; }
.alert-sep { margin: 0 4px; opacity: 0.4; }
.alert-price { font-size: 16px; font-weight: 700; margin-top: 6px; }

.trend-panel { margin-bottom: 16px; }
.trend-chart { padding: 12px 0; }
.trend-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
.trend-date { width: 48px; font-size: 12px; color: var(--text-muted); flex-shrink: 0; text-align: right; }
.trend-bar-bg { flex: 1; height: 22px; background: var(--bg-tertiary); border-radius: 4px; position: relative; overflow: hidden; }
.trend-bar-min { position: absolute; top: 2px; bottom: 2px; background: #818cf8; border-radius: 3px; min-width: 4px; }
.trend-bar-label { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; color: #fff; white-space: nowrap; font-weight: 500; }
.trend-avg-dot { position: absolute; top: 50%; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; transform: translate(-50%, -50%); border: 2px solid #fff; z-index: 1; }
.trend-meta { width: 130px; flex-shrink: 0; font-size: 11px; color: var(--text-muted); display: flex; gap: 8px; }
.trend-count { color: var(--text-secondary); }

.snapshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; padding: 8px 0; }
.snapshot-card { padding: 12px; background: var(--bg-secondary); border-radius: 8px; }
.snapshot-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.snapshot-model { font-weight: 600; font-size: 13px; }
.snapshot-time { font-size: 11px; color: var(--text-muted); }
.snapshot-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.stat-sm-label { display: block; font-size: 10px; color: var(--text-muted); }
.stat-sm-value { display: block; font-size: 13px; font-weight: 600; }

.empty-state { padding: 32px; text-align: center; color: var(--text-muted); font-size: 13px; }
.select-sm { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); font-size: 13px; }
</style>
