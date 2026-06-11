<template>
  <div class="page dashboard-v2">
    <PageHeader
      icon="⌂"
      title="控制台"
      subtitle="一眼看懂今天最需要处理的事。"
      :breadcrumb="['概览', '控制台']"
    >
      <template #actions>
        <button class="btn btn-secondary btn-square" @click="runSystemCheck">运行自检</button>
        <button class="btn btn-secondary btn-square" :disabled="extractBusy" @click="extractHistoryLearning">
          {{ extractBusy ? '抽取中…' : '抽取历史学习' }}
        </button>
        <button class="btn btn-primary btn-square" @click="openXianyu">打开闲鱼 IM</button>
      </template>
    </PageHeader>

    <!-- ─── 今日待办 ─── -->
    <section class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">今日待办</h2>
        <span class="dash-section-hint">今天需要你关注和处理的项</span>
      </div>
      <div class="action-grid">
        <router-link
          v-for="action in todayActions"
          :key="action.key"
          :to="action.to"
          class="action-card"
          :class="{ urgent: action.count > 0 && action.tone === 'danger' }"
        >
          <component :is="action.icon" class="action-card__icon" />
          <div class="action-card__body">
            <div class="action-card__head">
              <span class="action-card__label">{{ action.label }}</span>
              <BaseBadge v-if="action.count > 0" :tone="action.tone">{{ action.count }}</BaseBadge>
            </div>
            <div class="action-card__desc">{{ action.desc }}</div>
          </div>
        </router-link>
      </div>
    </section>

    <!-- ─── 运营概览 ─── -->
    <section class="dash-section" v-if="ops">
      <div class="dash-section-header">
        <h2 class="dash-section-title">运营概览</h2>
        <span class="dash-section-hint">今日业务数据快照</span>
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-card__label">进行中订单</div>
          <div class="metric-card__value">{{ stats.activeOrders }}</div>
          <div class="metric-card__desc">履约链路中的订单</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">今日自动回复</div>
          <div class="metric-card__value">{{ ops.autoReplyToday }}</div>
          <div class="metric-card__desc">命中率 {{ formatPercent(ops.hitRate) }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">建单转化</div>
          <div class="metric-card__value">{{ ops.bookingConvertedToday }}/{{ ops.bookingDraftsToday }}</div>
          <div class="metric-card__desc">{{ formatPercent(ops.bookingConversionRate) }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">在用档期</div>
          <div class="metric-card__value">{{ stats.activeBlocks }}</div>
          <div class="metric-card__desc">当前占用中的设备</div>
        </div>
      </div>
    </section>

    <!-- 运营概览空态（ops 尚未加载） -->
    <section class="dash-section" v-else>
      <div class="dash-section-header">
        <h2 class="dash-section-title">运营概览</h2>
        <span class="dash-section-hint">今日业务数据快照</span>
      </div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-card__label">进行中订单</div>
          <div class="metric-card__value">{{ stats.activeOrders }}</div>
          <div class="metric-card__desc">履约链路中的订单</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">今日自动回复</div>
          <div class="metric-card__value">—</div>
          <div class="metric-card__desc">等待数据同步</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">建单转化</div>
          <div class="metric-card__value">—</div>
          <div class="metric-card__desc">等待数据同步</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">在用档期</div>
          <div class="metric-card__value">{{ stats.activeBlocks }}</div>
          <div class="metric-card__desc">当前占用中的设备</div>
        </div>
      </div>
    </section>

    <div v-if="historyMessage" class="banner">{{ historyMessage }}</div>

    <!-- ─── 系统状态 ─── -->
    <section class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">系统状态</h2>
        <span class="dash-section-hint">配置检查与运行日志</span>
      </div>
      <div class="dash-grid">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>系统自检</h3>
              <div class="panel-tip" v-if="systemCheck">
                {{ passedChecks }}/{{ systemCheck.checks.length }} 项通过
                <span v-if="passedChecks < systemCheck.checks.length" class="pill pill-warning" style="margin-left:8px">有 {{ systemCheck.checks.length - passedChecks }} 项待配置</span>
                <span v-else class="pill pill-success" style="margin-left:8px">全部通过</span>
              </div>
              <div class="panel-tip" v-else>未运行，点击右上角"运行自检"</div>
            </div>
            <button v-if="systemCheck" class="btn btn-secondary btn-sm btn-square" @click="runSystemCheck">重新检查</button>
          </div>
          <div v-if="systemCheck" class="check-grid">
            <div v-for="item in systemCheck.checks" :key="item.key" class="check-card" :class="item.ok ? 'ok' : 'bad'">
              <div class="check-title">{{ item.label }}</div>
              <div class="check-status">
                <span class="pill" :class="item.ok ? 'pill-success' : 'pill-warning'">{{ item.ok ? '正常' : '待配置' }}</span>
              </div>
              <div class="check-detail">{{ item.detail }}</div>
            </div>
          </div>
          <div v-else class="empty-box">
            <span class="emoji">🔍</span>
            <div class="title">尚未运行系统自检</div>
            <div class="hint">点击上方按钮，检查 API Key、Cookies、飞书、顺丰等配置</div>
          </div>
        </div>

        <div class="panel log-panel">
          <div class="panel-header">
            <div>
              <h3>实时日志</h3>
              <div class="panel-tip">观察启动、鉴权、回复与履约过程</div>
            </div>
          </div>
          <div class="log-area">
            <LogViewer :logs="botStore.logs" @clear="botStore.clearLogs" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useBotStore } from '../stores/botStore'
import PageHeader from '../components/PageHeader.vue'
import LogViewer from '../components/LogViewer.vue'
import BaseBadge from '../components/BaseBadge.vue'
import { runViewInitialization } from '../utils/viewInitialization.mjs'
import { BellRing, BookOpenCheck, CalendarClock, MailCheck, PackageCheck, ShieldAlert } from '@lucide/vue'

const botStore = useBotStore()
const historyMessage = ref('')
const systemCheck = ref(null)
const extractBusy = ref(false)
const stats = reactive({ pendingTakeovers: 0, activeOrders: 0, pendingLearning: 0, activeBlocks: 0 })
const ops = ref(null)
const XIANYU_IM_URL = 'https://www.goofish.com/im'

const passedChecks = computed(() => (systemCheck.value?.checks || []).filter((i) => i.ok).length)
const failedChecks = computed(() => {
  const checks = systemCheck.value?.checks || []
  return checks.filter((item) => !item.ok).length
})

// 待审消息汇总（展示层 fallback，数据来自 ops）
const pendingReview = computed(() => ({
  feishu: ops.value?.feishuPending ?? 0,
  structured: ops.value?.structuredPending ?? 0,
}))
const pendingReviewTotal = computed(() => pendingReview.value.feishu + pendingReview.value.structured)
const todayActions = computed(() => [
  {
    key: 'takeovers',
    to: '/takeovers',
    icon: BellRing,
    label: '待接管会话',
    count: stats.pendingTakeovers,
    tone: 'warning',
    desc: '需要人工介入的客户会话',
  },
  {
    key: 'shipping',
    to: '/orders',
    icon: PackageCheck,
    label: '履约/发货关注',
    count: stats.activeOrders,
    tone: 'info',
    desc: '进行中订单，优先检查待发货和物流状态',
  },
  {
    key: 'returns',
    to: '/schedule',
    icon: CalendarClock,
    label: '归还/档期关注',
    count: stats.activeBlocks,
    tone: 'info',
    desc: '当前占用档期，关注到期归还和后续排期',
  },
  {
    key: 'pending-review',
    to: '/pending',
    icon: MailCheck,
    label: '待审消息',
    count: pendingReviewTotal.value,
    tone: 'warning',
    desc: `飞书 ${pendingReview.value.feishu} · 结构化 ${pendingReview.value.structured}`,
  },
  {
    key: 'learning',
    to: '/learning',
    icon: BookOpenCheck,
    label: '待审核学习',
    count: stats.pendingLearning,
    tone: 'warning',
    desc: '等待确认的知识候选',
  },
  {
    key: 'system',
    to: '/settings',
    icon: ShieldAlert,
    label: '系统阻塞项',
    count: failedChecks.value,
    tone: 'danger',
    desc: systemCheck.value ? '配置自检未通过项' : '未运行自检时不计入阻塞',
  },
])

function formatPercent(v) {
  if (v == null || isNaN(v)) return '—'
  return (Number(v) * 100).toFixed(1) + '%'
}

async function loadStats() {
  const result = await window.electronAPI.getDashboardStats()
  Object.assign(stats, result || {})
}

async function loadOps() {
  try {
    ops.value = await window.electronAPI.getOpsMetrics()
  } catch (e) {
    ops.value = null
  }
}

async function runSystemCheck() {
  systemCheck.value = await window.electronAPI.getSystemCheck()
  if (systemCheck.value) {
    const ok = (systemCheck.value.checks || []).filter((i) => i.ok).length
    const total = (systemCheck.value.checks || []).length
    window.$toast?.(`自检完成：${ok}/${total}`, ok === total ? 'success' : 'warning')
  }
}

function openXianyu() {
  window.electronAPI.openUrl(XIANYU_IM_URL)
  window.$toast?.('已在浏览器打开闲鱼 IM', 'info')
}

async function extractHistoryLearning() {
  extractBusy.value = true
  historyMessage.value = '正在抽取历史聊天...'
  try {
    await window.electronAPI.extractLearningFromHistory({})
  } catch (e) {
    extractBusy.value = false
    historyMessage.value = '抽取失败: ' + (e?.message || e)
    window.$toast?.('抽取失败', 'error')
  }
}

onMounted(() => {
  runViewInitialization('控制台', async () => {
    await loadStats()
    await loadOps()
    window.electronAPI.onHistoryLearningResult(async (msg) => {
      extractBusy.value = false
      if (msg.success) {
        const d = msg.data || {}
        const cat = d.by_category || {}
        const catText = Object.keys(cat).length
          ? '，分类：' + Object.entries(cat).map(([k, v]) => `${k}×${v}`).join(' · ')
          : ''
        const parts = []
        if (d.deduped > 0) parts.push(`合并 ${d.deduped}`)
        if (d.existing_skipped > 0) parts.push(`已存在 ${d.existing_skipped}`)
        const extra = parts.length ? `（${parts.join('，')}）` : ''
        historyMessage.value = `抽取完成：新增 ${d.created ?? 0} 条${extra} · 知识库 ${d.knowledge ?? 0} · 结构化 ${d.structured ?? 0}${catText}`
      } else {
        historyMessage.value = `抽取失败：${msg.message || '未知错误'}`
      }
      window.$toast?.(historyMessage.value, msg.success ? 'success' : 'error')
      await loadStats()
      await loadOps()
      if (systemCheck.value) await runSystemCheck()
    })
  })
})

onUnmounted(() => {
  window.electronAPI.removeAllListeners('bot:history_learning_result')
})
</script>

<style scoped>
.dashboard-v2 { gap: 16px; }

/* ─── Section ─── */
.dash-section { display: flex; flex-direction: column; gap: 12px; }
.dash-section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0 2px;
}
.dash-section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-strong);
  margin: 0;
}
.dash-section-hint {
  font-size: 12px;
  color: var(--text-faint);
}

/* ─── Action Grid ─── */
.action-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.action-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16,24,40,0.04));
  color: inherit;
  cursor: pointer;
  transition: border-color var(--duration-fast, 100ms) ease, box-shadow var(--duration-fast, 100ms) ease;
}
.action-card:hover {
  border-color: var(--brand-primary-border, rgba(20,184,166,0.24));
  box-shadow: 0 4px 12px rgba(16,24,40,0.06);
}
.action-card.urgent {
  border-color: rgba(239, 68, 68, 0.28);
  background: #fffafa;
}
.action-card__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--text-secondary);
  stroke-width: 2;
}
.action-card.urgent .action-card__icon {
  color: var(--text-danger);
}
.action-card__body { min-width: 0; width: 100%; }
.action-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.action-card__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
  line-height: 1.3;
}
.action-card__desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* ─── Metric Grid ─── */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.metric-card {
  padding: 16px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16,24,40,0.04));
}
.metric-card__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.metric-card__value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-strong);
  line-height: 1.1;
}
.metric-card__desc {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

/* ─── 底部双栏 ─── */
.dash-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
}
.log-panel { height: 280px; display: flex; flex-direction: column; }
.log-panel .log-area { flex: 1; min-height: 0; display: flex; overflow: hidden; }

/* ─── 系统自检 ─── */
.check-title { font-weight: 700; color: var(--text-strong); margin-bottom: 6px; }
.check-status { margin-bottom: 6px; font-size: 13px; }

/* ─── 旧版 KPI 行（保留兼容） ─── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.ops-row .kpi-card { background: var(--color-surface-alt, #f7f9fc); }
.kpi-link { display: block; color: inherit; cursor: pointer; transition: transform 0.16s ease, box-shadow 0.16s ease; }
.kpi-link:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

@media (max-width: 1280px) {
  .action-grid,
  .metric-grid,
  .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dash-grid { grid-template-columns: 1fr; }
}
</style>
