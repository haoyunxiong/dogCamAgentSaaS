<template>
  <div class="page knowledge-page">
    <PageHeader
      title="知识库管理"
      subtitle="常见问答是机器人的底气：录入后命中相似问题时会优先按知识库回复，未命中才走 LLM。"
      icon="📚"
      :breadcrumb="['配置中心', '知识库']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="triggerGenerateFromImage" :disabled="isGenerating">
          {{ isGenerating ? '🪄 生成中…' : '🖼 从图片智能生成' }}
        </button>
        <button class="btn btn-primary" @click="openAddModal">＋ 新增条目</button>
      </template>
    </PageHeader>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">知识条目</div>
        <div class="summary-value">{{ entries.length }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已审批</div>
        <div class="summary-value">{{ approvedCount }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">待审核智能结果</div>
        <div class="summary-value">{{ pendingEntries.length }}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>筛选条目</h3>
          <div class="panel-tip">按范围、型号、商品与关键词快速检索知识内容。</div>
        </div>
      </div>
      <div class="filter-grid">
        <div class="form-group">
          <label>范围</label>
          <select v-model="filters.scopeType" @change="loadEntries">
            <option value="">全部范围</option>
            <option value="global">通用</option>
            <option value="biz_item">业务商品</option>
            <option value="model">型号</option>
            <option value="item">商品</option>
          </select>
        </div>
        <div class="form-group">
          <label>商品编码</label>
          <input v-model="filters.bizItemCode" placeholder="业务商品编码" @keyup.enter="loadEntries" />
        </div>
        <div class="form-group">
          <label>型号编码</label>
          <select v-model="filters.modelCode" @change="loadEntries">
            <option value="">全部型号</option>
            <option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>商品 ID</label>
          <input v-model="filters.itemId" placeholder="商品 ID / __global__" @keyup.enter="loadEntries" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="filters.status" @change="loadEntries">
            <option value="">全部状态</option>
            <option value="approved">已启用</option>
            <option value="draft">草稿</option>
            <option value="disabled">已停用</option>
          </select>
        </div>
        <div class="form-group span-2">
          <label>关键词</label>
          <input v-model="filters.keyword" placeholder="搜索问题 / 答案 / 商品编码 / 型号" @keyup.enter="loadEntries" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-primary" @click="loadEntries">筛选</button>
          <button class="btn btn-secondary" @click="resetFilters">重置</button>
          <button class="btn btn-secondary" @click="showChatPanel = true" :disabled="isGenerating">从聊天记录智能生成</button>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>知识条目</h3>
          <div class="panel-tip">查看范围、状态、标签及问答正文。</div>
        </div>
      </div>
      <div class="table-wrap">
        <table class="knowledge-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>范围</th>
              <th>商品编码</th>
              <th>型号</th>
              <th>商品</th>
              <th>状态</th>
              <th>标签</th>
              <th>问题</th>
              <th>答案</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.id">
              <td>{{ entry.id }}</td>
              <td>{{ scopeLabel(entry.scope_type) }}</td>
              <td>{{ entry.biz_item_code || '-' }}</td>
              <td>{{ entry.model_code || '-' }}</td>
              <td>{{ entry.item_id || '-' }}</td>
              <td>{{ statusLabel(entry.status) }}</td>
              <td class="text-cell">{{ formatTags(entry.tags) }}</td>
              <td class="text-cell">{{ entry.question }}</td>
              <td class="text-cell answer-preview">{{ entry.answer }}</td>
              <td class="action-cell">
                <button class="btn btn-secondary btn-sm" @click="openEditModal(entry)">编辑</button>
                <button class="btn btn-danger btn-sm" @click="deleteEntry(entry.id)">删除</button>
              </td>
            </tr>
            <tr v-if="entries.length === 0">
              <td colspan="10" class="empty-tip">暂无知识条目</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="showChatPanel" class="panel">
      <div class="panel-header">
        <div>
          <h3>从聊天记录生成知识</h3>
          <div class="panel-tip">粘贴聊天记录后交给智能生成提炼问答。</div>
        </div>
      </div>
      <textarea v-model="chatText" placeholder="粘贴聊天记录..." rows="8"></textarea>
      <div class="panel-actions">
        <button class="btn btn-primary" @click="generateFromChat" :disabled="!chatText.trim() || isGenerating">生成</button>
        <button class="btn btn-secondary" @click="showChatPanel = false">取消</button>
      </div>
    </section>

    <section v-if="pendingEntries.length > 0" class="panel">
      <div class="panel-header">
        <div>
          <h3>智能生成结果审核</h3>
          <div class="panel-tip">确认范围与标签后批量入库。</div>
        </div>
      </div>
      <div class="review-filter">
        <select v-model="pendingScopeType">
          <option value="global">通用</option>
          <option value="biz_item">业务商品</option>
          <option value="model">型号</option>
          <option value="item">商品</option>
        </select>
        <input v-model="pendingBizItemCode" placeholder="入库商品编码" />
        <select v-model="pendingModelCode">
          <option value="">不限定型号</option>
          <option v-for="model in modelOptions" :key="`pending-${model}`" :value="model">{{ model }}</option>
        </select>
        <input v-model="pendingItemId" placeholder="入库商品 ID" />
        <input v-model="pendingTags" placeholder="标签，逗号分隔" />
      </div>
      <div v-for="(entry, idx) in pendingEntries" :key="idx" class="pending-entry">
        <input type="checkbox" v-model="entry.selected" />
        <div class="qa-content">
          <div><strong>Q:</strong> {{ entry.question }}</div>
          <div><strong>A:</strong> {{ entry.answer }}</div>
          <div class="pending-tags">标签：{{ formatTags(entry.tags) }}</div>
        </div>
      </div>
      <div class="panel-actions">
        <button class="btn btn-primary" @click="confirmBatchAdd" :disabled="!hasSelectedPending">
          确认入库（{{ selectedPendingCount }} 条）
        </button>
        <button class="btn btn-secondary" @click="pendingEntries = []">放弃</button>
      </div>
    </section>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal knowledge-modal">
        <div class="modal-close-anchor">
          <button class="modal-close-float" type="button" aria-label="关闭" title="关闭" @click="closeModal">✕</button>
        </div>
        <div class="panel-header">
          <div>
            <h3>{{ editingEntry ? '编辑条目' : '新增条目' }}</h3>
            <div class="panel-tip">维护范围、标签、命中阈值与问答内容。</div>
          </div>
        </div>
        <div class="form-row two-cols">
          <div class="form-group">
            <label>范围</label>
            <select v-model="form.scopeType">
              <option value="global">通用</option>
              <option value="biz_item">业务商品</option>
              <option value="model">型号</option>
              <option value="item">商品</option>
            </select>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status">
              <option value="approved">已启用</option>
              <option value="draft">草稿</option>
              <option value="disabled">已停用</option>
            </select>
          </div>
          <div class="form-group">
            <label>商品编码</label>
            <input v-model="form.bizItemCode" placeholder="如 G7X_RENT_STD" />
          </div>
          <div class="form-group">
            <label>型号编码</label>
            <select v-model="form.modelCode">
              <option value="">不限定型号</option>
              <option v-for="model in modelOptions" :key="`form-${model}`" :value="model">{{ model }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>商品 ID</label>
            <input v-model="form.itemId" placeholder="可选" />
          </div>
          <div class="form-group span-2">
            <label>标签</label>
            <input v-model="form.tags" placeholder="如 开机,续航,发货" />
          </div>
          <div class="form-group">
            <label>命中阈值</label>
            <input v-model.number="form.confidenceThreshold" type="number" min="0" max="1" step="0.05" />
          </div>
          <div class="form-group span-2">
            <label>问题</label>
            <input v-model="form.question" placeholder="买家可能会问的问题" />
          </div>
          <div class="form-group span-2">
            <label>答案</label>
            <textarea v-model="form.answer" rows="6" placeholder="对应的回答"></textarea>
          </div>
        </div>
        <div class="panel-actions">
          <button class="btn btn-primary" @click="saveEntry" :disabled="!form.question.trim() || !form.answer.trim()">保存</button>
          <button class="btn btn-secondary" @click="closeModal">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { runViewInitialization } from '../utils/viewInitialization.mjs'

const entries = ref([])
const modelOptions = ref([])
const filters = reactive({
  scopeType: '',
  bizItemCode: '',
  modelCode: '',
  itemId: '',
  status: '',
  keyword: '',
})
const isGenerating = ref(false)
const showChatPanel = ref(false)
const chatText = ref('')
const pendingEntries = ref([])
const pendingScopeType = ref('global')
const pendingBizItemCode = ref('')
const pendingModelCode = ref('')
const pendingItemId = ref('')
const pendingTags = ref('')
const showModal = ref(false)
const editingEntry = ref(null)
const form = reactive({
  scopeType: 'global',
  bizItemCode: '',
  modelCode: '',
  itemId: '',
  status: 'approved',
  tags: '',
  confidenceThreshold: 0.75,
  question: '',
  answer: '',
})

const hasSelectedPending = computed(() => pendingEntries.value.some((e) => e.selected))
const selectedPendingCount = computed(() => pendingEntries.value.filter((e) => e.selected).length)
const approvedCount = computed(() => entries.value.filter((entry) => entry.status === 'approved').length)

function summarizeModelOptions(units = []) {
  return [...new Set(
    (units || [])
      .map((unit) => String(unit.model_code || unit.modelCode || '').trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

function scopeLabel(scopeType) {
  if (scopeType === 'biz_item') return '业务商品'
  if (scopeType === 'model') return '型号'
  if (scopeType === 'item') return '商品'
  return '通用'
}

function statusLabel(status) {
  if (status === 'approved') return '已启用'
  if (status === 'draft') return '草稿'
  if (status === 'disabled') return '已停用'
  return status || '-'
}

function parseTagsInput(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function formatTags(tags) {
  if (!tags || tags.length === 0) return '-'
  return tags.join(', ')
}

function normalizeKnowledgePayload() {
  return {
    itemId: form.itemId.trim() || undefined,
    bizItemCode: form.bizItemCode.trim() || undefined,
    scopeType: form.scopeType,
    modelCode: form.modelCode.trim() || undefined,
    status: form.status,
    tags: parseTagsInput(form.tags),
    confidenceThreshold: Number(form.confidenceThreshold) || 0.75,
    question: form.question.trim(),
    answer: form.answer.trim(),
  }
}

async function loadEntries() {
  entries.value = await window.electronAPI.listKnowledge({
    scopeType: filters.scopeType || undefined,
    bizItemCode: filters.bizItemCode.trim() || undefined,
    modelCode: filters.modelCode.trim() || undefined,
    itemId: filters.itemId.trim() || undefined,
    status: filters.status || undefined,
    keyword: filters.keyword.trim() || undefined,
  })
}

async function loadModelOptions() {
  modelOptions.value = summarizeModelOptions(await window.electronAPI.listScheduleUnits({ activeInventoryOnly: true }))
}

function resetFilters() {
  filters.scopeType = ''
  filters.bizItemCode = ''
  filters.modelCode = ''
  filters.itemId = ''
  filters.status = ''
  filters.keyword = ''
  loadEntries()
}

function resetForm() {
  form.scopeType = 'global'
  form.bizItemCode = ''
  form.modelCode = ''
  form.itemId = ''
  form.status = 'approved'
  form.tags = ''
  form.confidenceThreshold = 0.75
  form.question = ''
  form.answer = ''
}

function openAddModal() {
  editingEntry.value = null
  resetForm()
  showModal.value = true
}

function openEditModal(entry) {
  editingEntry.value = entry
  form.scopeType = entry.scope_type || 'global'
  form.bizItemCode = entry.biz_item_code || ''
  form.modelCode = entry.model_code || ''
  form.itemId = entry.item_id || ''
  form.status = entry.status || 'approved'
  form.tags = (entry.tags || []).join(', ')
  form.confidenceThreshold = entry.confidence_threshold || 0.75
  form.question = entry.question
  form.answer = entry.answer
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function saveEntry() {
  const payload = normalizeKnowledgePayload()
  try {
    if (editingEntry.value) {
      await window.electronAPI.updateKnowledge({ id: editingEntry.value.id, ...payload })
    } else {
      await window.electronAPI.addKnowledge(payload)
    }
    closeModal()
    await loadEntries()
  } catch (e) {
    alert(`保存失败：${e.message}`)
  }
}

async function deleteEntry(id) {
  if (!confirm('确认删除此条目？')) return
  await window.electronAPI.deleteKnowledge({ id })
  await loadEntries()
}

async function triggerGenerateFromImage() {
  try {
    const result = await window.electronAPI.generateFromImage()
    if (result?.canceled) return
    isGenerating.value = true
  } catch (e) {
    alert(`打开文件对话框失败：${e.message}`)
  }
}

async function generateFromChat() {
  if (!chatText.value.trim()) return
  try {
    await window.electronAPI.generateFromChat({ chatText: chatText.value })
    isGenerating.value = true
    showChatPanel.value = false
  } catch (e) {
    alert(`发送聊天记录失败：${e.message}`)
  }
}

async function confirmBatchAdd() {
  const selected = pendingEntries.value.filter((e) => e.selected)
  await window.electronAPI.batchAddKnowledge({
    entries: selected.map((e) => ({
      question: e.question,
      answer: e.answer,
      tags: e.tags || parseTagsInput(pendingTags.value),
    })),
    itemId: pendingItemId.value.trim() || undefined,
    bizItemCode: pendingBizItemCode.value.trim() || undefined,
    scopeType: pendingScopeType.value,
    modelCode: pendingModelCode.value.trim() || undefined,
    sourceType: 'ai_generated',
    status: 'approved',
  })
  pendingEntries.value = []
  await loadEntries()
}

onMounted(() => {
  runViewInitialization('知识库', async () => {
    await loadModelOptions()
    await loadEntries()
    window.electronAPI.onKnowledgeGenerateResult((msg) => {
      isGenerating.value = false
      pendingEntries.value = (msg.data || []).map((e) => ({ ...e, selected: true }))
    })
    window.electronAPI.onKnowledgeGenerateError((msg) => {
      isGenerating.value = false
      alert(`智能生成失败：${msg.message}`)
    })
  })
})

onUnmounted(() => {
  window.electronAPI.removeAllKnowledgeListeners?.()
})
</script>

<style scoped>
.knowledge-page {
  gap: 18px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
  align-items: end;
}

.filter-actions,
.review-filter {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.review-filter {
  margin-bottom: 14px;
}

.action-cell {
  white-space: nowrap;
}

.pending-entry {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f1f5f9;
}

.pending-entry:last-child {
  border-bottom: none;
}

.qa-content {
  flex: 1;
}

.pending-tags {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 13px;
}

.knowledge-modal {
  width: min(920px, 100%);
}

@media (max-width: 1280px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
}
</style>
