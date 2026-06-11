<template>
  <div class="page pending-page">
    <PageHeader
      title="消息审批"
      subtitle="AI 针对知识库未命中 / 功能性问题生成的回复草稿，由人工审核后再发给买家。"
      icon="✉️"
      :badge="pendingBadge || null"
      :breadcrumb="['对话中心', '消息审批']"
    >
      <template #actions>
        <button class="btn" @click="load">↻ 刷新</button>
      </template>
      <template #filters>
        <div class="toolbar">
          <select v-model="filterStatus" @change="load" class="select-sm">
            <option value="pending">待确认</option>
            <option value="approved">已发送</option>
            <option value="rejected">已拒绝</option>
          </select>
        </div>
      </template>
    </PageHeader>

    <div class="pending-list" v-if="items.length">
      <div v-for="item in items" :key="item.id" class="pending-card">
        <div class="pending-header">
          <div class="pending-meta">
            <span class="pending-id">#{{ item.id }}</span>
            <span class="pending-type" :class="item.reply_type">{{ typeLabel(item.reply_type) }}</span>
            <span class="pending-status" :class="item.status">{{ statusLabel(item.status) }}</span>
          </div>
          <span class="pending-time">{{ formatTime(item.created_at) }}</span>
        </div>

        <div class="pending-body">
          <div class="pending-section">
            <div class="pending-label">买家问题</div>
            <div class="pending-question">{{ item.user_question }}</div>
          </div>

          <div class="pending-section" v-if="item.ai_draft">
            <div class="pending-label">AI 草稿</div>
            <div class="pending-draft">{{ item.ai_draft }}</div>
          </div>

          <div class="pending-section" v-if="item.model_code">
            <span class="pending-tag">{{ item.model_code }}</span>
            <span class="pending-tag secondary" v-if="item.item_id">{{ item.item_id }}</span>
          </div>
        </div>

        <div class="pending-actions" v-if="item.status === 'pending'">
          <textarea v-model="editingReply[item.id]" class="reply-input" rows="2"
            :placeholder="item.ai_draft || '输入要发送的回复内容…'"></textarea>
          <div class="action-row">
            <button class="btn btn-sm btn-danger" @click="reject(item.id)">拒绝</button>
            <button class="btn btn-sm" @click="useAiDraft(item)">使用 AI 草稿</button>
            <button class="btn btn-sm btn-primary" @click="approve(item.id)" :disabled="!getReply(item)">确认发送</button>
          </div>
        </div>

        <div class="pending-result" v-if="item.status === 'approved'">
          <div class="pending-label">已发送回复</div>
          <div class="pending-final">{{ item.final_reply }}</div>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      :icon="filterStatus === 'pending' ? '✅' : '📭'"
      :tone="filterStatus === 'pending' ? 'success' : 'neutral'"
      :title="filterStatus === 'pending' ? '目前没有待确认的回复' : '暂无记录'"
      :hint="filterStatus === 'pending' ? '所有飞书消息都已处理完成，可以喘口气啦。' : '切换上方状态试试其他类别。'"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'

const filterStatus = ref('pending')
const items = ref([])
const editingReply = reactive({})

const pendingBadge = computed(() => filterStatus.value === 'pending' ? items.value.length : 0)

function typeLabel(t) {
  const map = { faq_miss: '知识库未命中', functional_search: '功能问题', schedule: '档期问题' }
  return map[t] || t
}
function statusLabel(s) {
  const map = { pending: '待确认', approved: '已发送', rejected: '已拒绝' }
  return map[s] || s
}
function formatTime(t) { return t?.replace('T', ' ').slice(0, 16) || '-' }
function getReply(item) { return editingReply[item.id] || item.ai_draft }
function useAiDraft(item) { editingReply[item.id] = item.ai_draft || '' }

async function load() {
  try {
    items.value = await window.electronAPI.listFeishuPending({ status: filterStatus.value }) || []
  } catch (e) { console.error(e) }
}

async function approve(id) {
  const item = items.value.find(i => i.id === id)
  const reply = editingReply[id] || item?.ai_draft
  if (!reply) return
  try {
    await window.electronAPI.approveFeishuPending({ id, finalReply: reply, approvedBy: 'manual' })
    load()
  } catch (e) { console.error(e) }
}

async function reject(id) {
  try {
    await window.electronAPI.rejectFeishuPending({ id })
    load()
  } catch (e) { console.error(e) }
}

onMounted(load)
</script>

<style scoped>
.pending-list { display: flex; flex-direction: column; gap: 12px; }
.pending-card { background: var(--bg-secondary); border-radius: 10px; padding: 16px; border: 1px solid var(--border); }
.pending-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.pending-meta { display: flex; align-items: center; gap: 8px; }
.pending-id { font-weight: 600; font-size: 13px; color: var(--text-muted); }
.pending-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #e0e7ff; color: #4338ca; }
.pending-type.functional_search { background: #fef3c7; color: #92400e; }
.pending-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.pending-status.pending { background: #fef3c7; color: #92400e; }
.pending-status.approved { background: #d1fae5; color: #065f46; }
.pending-status.rejected { background: #fee2e2; color: #991b1b; }
.pending-time { font-size: 11px; color: var(--text-muted); }

.pending-body { margin-bottom: 12px; }
.pending-section { margin-bottom: 8px; }
.pending-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; font-weight: 500; }
.pending-question { font-size: 14px; font-weight: 500; color: var(--text-primary); padding: 8px 12px; background: var(--bg-tertiary); border-radius: 8px; }
.pending-draft { font-size: 13px; color: var(--text-secondary); padding: 8px 12px; background: #eff6ff; border-radius: 8px; border-left: 3px solid #3b82f6; }
.pending-final { font-size: 13px; color: #065f46; padding: 8px 12px; background: #ecfdf5; border-radius: 8px; border-left: 3px solid #22c55e; }
.pending-tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--bg-tertiary); color: var(--text-secondary); margin-right: 4px; }
.pending-tag.secondary { opacity: 0.7; }

.pending-actions { border-top: 1px solid var(--border); padding-top: 12px; }
.reply-input { width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 13px; resize: vertical; margin-bottom: 8px; background: var(--bg-primary); }
.action-row { display: flex; justify-content: flex-end; gap: 8px; }

.empty-state { padding: 60px; text-align: center; color: var(--text-muted); }
.empty-icon { font-size: 40px; margin-bottom: 12px; }
.select-sm { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); font-size: 13px; }
</style>
