<template>
  <div class="page">
    <PageHeader
      title="人工接管"
      subtitle="机器人遇到议价、敏感售后、档期无法承诺等情况时，会在这里生成任务，等待销售人工处理。"
      icon="🙋"
      :badge="pendingCount || null"
      :breadcrumb="['对话中心', '人工接管']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="loadTasks">↻ 刷新</button>
      </template>
      <template #filters>
        <div class="toolbar">
          <select v-model="filters.status" @change="loadTasks">
            <option value="">全部状态</option>
            <option value="new">新建</option>
            <option value="notified">已通知</option>
            <option value="accepted">已接单</option>
            <option value="closed">已关闭</option>
            <option value="escalated">已升级</option>
          </select>
          <select v-model="filters.priority" @change="loadTasks">
            <option value="">全部优先级</option>
            <option value="normal">普通</option>
            <option value="high">高</option>
          </select>
        </div>
      </template>
    </PageHeader>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">待处理</div>
        <div class="summary-value">{{ pendingCount }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已升级</div>
        <div class="summary-value">{{ escalatedCount }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">SLA 秒数</div>
        <div class="summary-value">{{ takeoverTimeoutSec }}</div>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>ID</th>
          <th>会话</th>
          <th>型号</th>
          <th>原因</th>
          <th>优先级</th>
          <th>状态</th>
          <th>会话状态</th>
          <th>SLA</th>
          <th>接单人</th>
          <th>时间线</th>
          <th>问题</th>
          <th>处理</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="task in tasks" :key="task.id">
          <td>{{ task.id }}</td>
          <td>{{ task.session_id }}</td>
          <td>{{ task.model_code || '-' }}</td>
          <td>{{ task.reason }}</td>
          <td>
            <span class="badge" :class="task.priority === 'high' ? 'badge-high' : 'badge-normal'">
              {{ priorityLabel(task.priority) }}
            </span>
          </td>
          <td>
            <span class="badge" :class="statusClass(task.status)">{{ statusLabel(task.status) }}</span>
          </td>
          <td>
            <span class="badge" :class="sessionStateClass(task.session_id)">{{ sessionStateLabel(task.session_id) }}</span>
            <button
              v-if="sessionStateOf(task.session_id) !== 'auto'"
              class="btn btn-ghost btn-sm"
              style="margin-left: 6px"
              @click="resetSession(task.session_id)"
              title="强制恢复自动回复"
            >恢复</button>
          </td>
          <td>{{ formatSla(task) }}</td>
          <td>{{ task.assigned_to || '-' }}</td>
          <td class="timeline">
            创建：{{ formatDate(task.created_at) }}
            <br />
            通知：{{ formatDate(task.notified_at) }}
            <br />
            接单：{{ formatDate(task.accepted_at) }}
            <br />
            升级：{{ formatDate(task.escalated_at) }}
          </td>
          <td class="question">{{ task.latest_question || '-' }}</td>
          <td class="actions">
            <button class="btn btn-primary btn-sm" @click="accept(task.id)" :disabled="task.status === 'accepted' || task.status === 'closed'">接单</button>
            <button class="btn btn-danger btn-sm" @click="closeTask(task.id)" :disabled="task.status === 'closed'">关闭</button>
          </td>
        </tr>
        <tr v-if="tasks.length === 0">
          <td colspan="12" class="empty">暂无接管任务</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import { runViewInitialization } from '../../utils/viewInitialization.mjs'

const tasks = ref([])
const takeoverTimeoutSec = ref(180)
const nowTs = ref(Date.now())
const filters = reactive({ status: '', priority: '' })
const sessionStateMap = ref({})
let timer = null
let refreshTimer = null

const pendingCount = computed(() => tasks.value.filter((task) => ['new', 'notified', 'accepted'].includes(task.status)).length)
const escalatedCount = computed(() => tasks.value.filter((task) => task.status === 'escalated').length)

function parseTime(value) {
  if (!value) return null
  const ts = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isNaN(ts) ? null : ts
}

function formatDate(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 19)
}

function formatSla(task) {
  if (!['new', 'notified'].includes(task.status)) return '-'
  const baseTs = parseTime(task.notified_at || task.created_at)
  if (!baseTs) return '-'
  const remain = Math.max(0, takeoverTimeoutSec.value - Math.floor((nowTs.value - baseTs) / 1000))
  return remain === 0 ? '已超时' : `${remain}s`
}

function statusClass(status) {
  return `status-${status}`
}

function statusLabel(status) {
  if (status === 'new') return '新建'
  if (status === 'notified') return '已通知'
  if (status === 'accepted') return '已接单'
  if (status === 'closed') return '已关闭'
  if (status === 'escalated') return '已升级'
  return status || '-'
}

function priorityLabel(priority) {
  if (priority === 'high') return '高'
  if (priority === 'normal') return '普通'
  return priority || '-'
}

async function loadTasks() {
  tasks.value = await window.electronAPI.listTakeovers({ ...filters })
  await loadSessionStates()
}

async function loadSessionStates() {
  try {
    const rows = await window.electronAPI.listSessionStates({})
    const map = {}
    for (const row of rows || []) {
      map[row.session_id] = row
    }
    sessionStateMap.value = map
  } catch (err) {
    console.warn('[takeover] 加载会话状态失败', err)
  }
}

function sessionStateOf(sessionId) {
  const row = sessionStateMap.value[sessionId]
  return (row && row.state) || 'auto'
}

function sessionStateLabel(sessionId) {
  const s = sessionStateOf(sessionId)
  if (s === 'auto') return '自动'
  if (s === 'cooldown') return '冷却'
  if (s === 'human_active') return '人工中'
  if (s === 'manual') return '已接管'
  return s
}

function sessionStateClass(sessionId) {
  const s = sessionStateOf(sessionId)
  if (s === 'auto') return 'status-auto'
  if (s === 'cooldown') return 'status-cooldown'
  if (s === 'human_active') return 'status-human'
  if (s === 'manual') return 'status-manual'
  return ''
}

async function resetSession(sessionId) {
  if (!sessionId) return
  await window.electronAPI.resetSessionState(sessionId)
  await loadSessionStates()
}

async function accept(taskId) {
  await window.electronAPI.acceptTakeover({ taskId, operator: 'ui' })
  await loadTasks()
}

async function closeTask(taskId) {
  await window.electronAPI.closeTakeover({ taskId, resolution: 'handled_in_ui' })
  await loadTasks()
}

onMounted(() => {
  runViewInitialization('人工接管', async () => {
    const config = await window.electronAPI.getConfig()
    takeoverTimeoutSec.value = Number(config.MANUAL_TAKEOVER_TIMEOUT_SEC || 180)
    await loadTasks()
    timer = setInterval(() => {
      nowTs.value = Date.now()
    }, 1000)
    refreshTimer = setInterval(loadTasks, 15000)
  })
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.page { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
.toolbar { display: flex; gap: 8px; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.summary-card { background: #fff; border-radius: 10px; padding: 16px; }
.summary-label { color: #64748b; font-size: 13px; margin-bottom: 6px; }
.summary-value { color: #0f172a; font-size: 22px; font-weight: 700; }
.table { width: 100%; border-collapse: collapse; background: #fff; }
.table th, .table td { padding: 10px 12px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
.table th { background: #f8fafc; }
.question { max-width: 260px; word-break: break-all; color: #475569; }
.timeline { min-width: 180px; color: #64748b; font-size: 12px; }
.actions { white-space: nowrap; }
.empty { text-align: center; color: #94a3b8; padding: 24px; }
.badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; }
.badge-high { background: #fee2e2; color: #dc2626; }
.badge-normal { background: #e0f2fe; color: #0369a1; }
.status-new, .status-notified { background: #fef3c7; color: #b45309; }
.status-accepted { background: #dcfce7; color: #15803d; }
.status-closed { background: #e2e8f0; color: #475569; }
.status-escalated { background: #fee2e2; color: #b91c1c; }
.status-auto { background: #dcfce7; color: #15803d; }
.status-cooldown { background: #fef3c7; color: #b45309; }
.status-human { background: #dbeafe; color: #1e40af; }
.status-manual { background: #ede9fe; color: #6d28d9; }
.btn-ghost { background: transparent; color: #475569; border: 1px solid #cbd5e1; }
.btn { padding: 8px 14px; border-radius: 6px; border: none; }
.btn-sm { padding: 4px 10px; margin-right: 8px; }
.btn-primary { background: #4a9eff; color: #fff; }
.btn-secondary { background: #e2e8f0; color: #334155; }
.btn-danger { background: #ef4444; color: #fff; }
select { padding: 8px 10px; border: 1px solid #dbe2ea; border-radius: 6px; }
</style>
