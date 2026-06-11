<template>
  <div class="page review-page">
    <PageHeader
      title="学习审核"
      subtitle="审核历史聊天抽取出的候选问答，通过后入知识库；结构化建议（价格/档期/物流/售后）需人工判断后再决定是否手工归档。"
      icon="🎓"
      :badge="pendingCount || null"
      :breadcrumb="['对话中心', '学习审核']"
    >
      <template #actions>
        <button class="btn btn-secondary" :disabled="historySyncRunning" @click="syncBrowserHistory('current')">📥 {{ historySyncRunning ? '同步中…' : '只扫当前会话' }}</button>
        <button class="btn btn-secondary" :disabled="historySyncRunning" @click="syncBrowserHistory('sweep')" title="人类化随机节奏，最多 15 个会话，仍有较小风控风险">🐢 {{ historySyncRunning ? '同步中…' : '慢速扫一小批' }}</button>
        <button class="btn btn-secondary" @click="extractHistory">🧪 抽取历史聊天</button>
        <button class="btn btn-secondary" :disabled="dedupRunning" @click="dedupLegacy">🧹 {{ dedupRunning ? '清理中…' : '去重旧候选' }}</button>
        <button class="btn btn-primary" @click="reload">↻ 刷新</button>
      </template>
      <template #filters>
        <div class="toolbar">
          <div class="tabs">
            <button class="tab" :class="{ active: activeTab === 'general' }" @click="switchTab('general')">通用候选</button>
            <button class="tab" :class="{ active: activeTab === 'structured' }" @click="switchTab('structured')">结构化建议</button>
          </div>
          <select v-if="activeTab === 'general'" v-model="reviewStatus" @change="loadCandidates">
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          <template v-else>
            <select v-model="structuredCategory" @change="loadStructured">
              <option value="">全部类目</option>
              <option value="price">价格</option>
              <option value="booking">建单</option>
              <option value="schedule">档期</option>
              <option value="shipping">物流</option>
              <option value="aftersale">售后</option>
            </select>
            <select v-model="structuredStatus" @change="loadStructured">
              <option value="pending">待处理</option>
              <option value="handled">已处理</option>
              <option value="ignored">已忽略</option>
            </select>
          </template>
        </div>
      </template>
    </PageHeader>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">当前视图</div>
        <div class="summary-value">{{ activeTab === 'general' ? '通用候选' : '结构化建议' }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ activeTab === 'general' ? reviewStatusLabel : structuredStatusLabel }}</div>
        <div class="summary-value">{{ activeTab === 'general' ? candidates.length : structured.length }}</div>
      </div>
      <div class="summary-card" v-if="activeTab === 'general'">
        <div class="summary-label">可审核项</div>
        <div class="summary-value">{{ pendingCount }}</div>
      </div>
      <div class="summary-card" v-else>
        <div class="summary-label">覆盖类目</div>
        <div class="summary-value">{{ categoryCoverage }}</div>
      </div>
    </div>

    <div v-if="message" class="banner">{{ message }}</div>

    <!-- 通用候选 -->
    <section v-if="activeTab === 'general'" class="panel">
      <div class="panel-header">
        <div>
          <h3>候选列表</h3>
          <div class="panel-tip">通过后写入知识库；拒绝后不再出现。</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>范围</th>
              <th>型号</th>
              <th>问题</th>
              <th>答案</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in candidates" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ candidateScopeLabel(item.candidate_scope) }}</td>
              <td>{{ item.model_code || '-' }}</td>
              <td class="text-cell">{{ item.question }}</td>
              <td class="text-cell">{{ item.final_answer }}</td>
              <td class="actions" v-if="reviewStatus === 'pending'">
                <button class="btn btn-primary btn-sm" @click="approve(item)">通过</button>
                <button class="btn btn-danger btn-sm" @click="reject(item.id)">拒绝</button>
              </td>
              <td v-else>-</td>
            </tr>
            <tr v-if="candidates.length === 0">
              <td colspan="6" class="empty">暂无学习条目</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 结构化建议 -->
    <section v-else class="panel">
      <div class="panel-header">
        <div>
          <h3>结构化建议</h3>
          <div class="panel-tip">这里的问答属于价格/档期/物流/售后等强业务语义，不进知识库；标记「已处理」后从待处理列表移除。</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>类目</th>
              <th>型号</th>
              <th>买家消息</th>
              <th>人工回复</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in structured" :key="item.id">
              <td>{{ item.id }}</td>
              <td><span class="tag" :class="`cat-${item.category}`">{{ categoryLabel(item.category) }}</span></td>
              <td>{{ item.model_code || '-' }}</td>
              <td class="text-cell">{{ item.user_message }}</td>
              <td class="text-cell">{{ item.bot_or_human_reply }}</td>
              <td>{{ structuredStatusLabelOf(item.status) }}</td>
              <td class="actions" v-if="item.status === 'pending'">
                <button class="btn btn-primary btn-sm" @click="markStructured(item.id, 'handled')">已处理</button>
                <button class="btn btn-danger btn-sm" @click="markStructured(item.id, 'ignored')">忽略</button>
              </td>
              <td v-else>-</td>
            </tr>
            <tr v-if="structured.length === 0">
              <td colspan="7" class="empty">暂无结构化建议</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import { runViewInitialization } from '../../utils/viewInitialization.mjs'

const activeTab = ref('general')
const candidates = ref([])
const reviewStatus = ref('pending')
const message = ref('')
const dedupRunning = ref(false)
const historySyncRunning = ref(false)

const structured = ref([])
const structuredCategory = ref('')
const structuredStatus = ref('pending')

const pendingCount = computed(() => reviewStatus.value === 'pending' ? candidates.value.length : 0)
const reviewStatusLabel = computed(() => {
  if (reviewStatus.value === 'pending') return '待审核'
  if (reviewStatus.value === 'approved') return '已通过'
  if (reviewStatus.value === 'rejected') return '已拒绝'
  return reviewStatus.value
})
const structuredStatusLabel = computed(() => structuredStatusLabelOf(structuredStatus.value))
const categoryCoverage = computed(() => {
  const set = new Set(structured.value.map((r) => r.category).filter(Boolean))
  return set.size
})

function structuredStatusLabelOf(s) {
  if (s === 'pending') return '待处理'
  if (s === 'handled') return '已处理'
  if (s === 'ignored') return '已忽略'
  return s || '-'
}

function candidateScopeLabel(scope) {
  if (scope === 'model') return '型号'
  if (scope === 'item') return '商品'
  return '通用'
}

function categoryLabel(cat) {
  const m = { price: '价格', booking: '建单', schedule: '档期', shipping: '物流', aftersale: '售后' }
  return m[cat] || cat || '-'
}

function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'structured') loadStructured()
  else loadCandidates()
}

async function loadCandidates() {
  candidates.value = await window.electronAPI.listLearningCandidates({ reviewStatus: reviewStatus.value })
}

async function loadStructured() {
  structured.value = await window.electronAPI.listStructuredSuggestions({
    category: structuredCategory.value || undefined,
    status: structuredStatus.value || undefined,
    limit: 200,
  })
}

async function reload() {
  if (activeTab.value === 'general') await loadCandidates()
  else await loadStructured()
}

async function extractHistory() {
  message.value = '正在抽取历史聊天...'
  await window.electronAPI.extractLearningFromHistory({})
}

async function syncBrowserHistory(mode = 'current') {
  if (mode === 'sweep') {
    if (!confirm('慢速扫一小批：将以 2~5 秒的随机间隔依次打开最多 15 个会话。\n虽然已做人类化节奏，但仍可能触发闲鱼风控。\n建议仅在确实需要时使用。是否继续？')) return
  }
  historySyncRunning.value = true
  message.value = mode === 'sweep'
    ? '正在慢速扫描一小批会话（人类化节奏，请勿操作浏览器）...'
    : '正在同步当前打开的会话历史...'
  try {
    await window.electronAPI.syncBrowserHistory({ mode })
  } catch (e) {
    historySyncRunning.value = false
    message.value = `历史同步失败：${e.message || e}`
  }
}

async function dedupLegacy() {
  if (!confirm('确定要对历史 learning_candidates / structured_learning_suggestions 做一次性去重吗？\n将按「问题 + 答案」保留最早 id，其余重复项直接删除。')) return
  dedupRunning.value = true
  try {
    const res = await window.electronAPI.dedupLegacyLearningCandidates()
    message.value = `去重完成：通用候选删除 ${res.learningDeleted ?? 0} 条，结构化建议删除 ${res.structuredDeleted ?? 0} 条`
    await reload()
  } catch (e) {
    message.value = `去重失败：${e.message || e}`
  } finally {
    dedupRunning.value = false
  }
}

async function approve(item) {
  const itemId = item.item_id || undefined
  const hasBizMapping = item.biz_item_code || itemId
  await window.electronAPI.approveLearningCandidate({
    candidateId: item.id,
    scopeType: item.candidate_scope === 'model' ? 'model' : (hasBizMapping ? 'biz_item' : 'global'),
    bizItemCode: item.biz_item_code || undefined,
    modelCode: item.model_code || undefined,
    tags: item.tags || [],
  })
  await loadCandidates()
}

async function reject(candidateId) {
  await window.electronAPI.rejectLearningCandidate({ candidateId })
  await loadCandidates()
}

async function markStructured(id, status) {
  await window.electronAPI.updateStructuredSuggestion({ id, status })
  await loadStructured()
}

onMounted(() => {
  runViewInitialization('学习审核', async () => {
    await loadCandidates()
    window.electronAPI.onHistoryLearningResult(async (msg) => {
      if (msg.success) {
        const d = msg.data || {}
        const cat = d.by_category || {}
        const catText = Object.keys(cat).length
          ? '，分类：' + Object.entries(cat).map(([k, v]) => `${k}×${v}`).join(' · ')
          : ''
        const parts = []
        if (d.deduped > 0) parts.push(`合并重复 ${d.deduped}`)
        if (d.existing_skipped > 0) parts.push(`跳过已存在 ${d.existing_skipped}`)
        const extra = parts.length ? `（${parts.join('，')}）` : ''
        const kb = d.knowledge ?? 0
        const st = d.structured ?? 0
        message.value = `抽取完成：新增候选 ${d.created ?? 0} 条${extra} · 入知识库 ${kb} · 结构化 ${st}${catText}`
      } else {
        message.value = `抽取失败：${msg.message || '未知错误'}`
      }
      await reload()
    })
    window.electronAPI.onBrowserHistorySyncResult(async (msg) => {
      historySyncRunning.value = false
      if (msg.success) {
        const d = msg.data || {}
        message.value = `历史同步完成：扫描会话 ${d.scanned_sessions ?? 0} 个 · 写入消息 ${d.added_messages ?? 0} 条${d.skipped_sessions ? ` · 跳过 ${d.skipped_sessions}` : ''}`
      } else {
        message.value = `历史同步失败：${msg.message || '未知错误'}`
      }
    })
  })
})

onUnmounted(() => {
  window.electronAPI.removeAllListeners('bot:history_learning_result')
  window.electronAPI.removeAllListeners('bot:browser_history_sync_result')
})
</script>

<style scoped>
.review-page {
  gap: 18px;
}

.actions {
  white-space: nowrap;
}

.tabs {
  display: inline-flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.04);
  padding: 3px;
  border-radius: 8px;
}

.tab {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  color: var(--color-text-secondary, #666);
  transition: all 0.15s;
}

.tab.active {
  background: var(--color-primary, #0b63f6);
  color: #fff;
  font-weight: 500;
}

.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(11, 99, 246, 0.1);
  color: #0b63f6;
  font-size: 12px;
}

.tag.cat-price { background: rgba(255, 140, 0, 0.12); color: #d97706; }
.tag.cat-booking { background: rgba(11, 99, 246, 0.12); color: #0b63f6; }
.tag.cat-schedule { background: rgba(139, 92, 246, 0.12); color: #7c3aed; }
.tag.cat-shipping { background: rgba(16, 185, 129, 0.12); color: #059669; }
.tag.cat-aftersale { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
</style>
