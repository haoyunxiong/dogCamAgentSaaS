<template>
  <div class="page prompts-page">
    <PageHeader
      title="提示词编辑"
      subtitle="统一维护分类、谈判、技术咨询与默认回复的提示词，机器人行为的大脑在这里。"
      icon="🧠"
      :breadcrumb="['配置中心', '提示词']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="resetAllPrompts">↺ 恢复所有默认</button>
      </template>
    </PageHeader>

    <section class="panel ai-config-panel">
      <div class="panel-header clickable" @click="showAiPanel = !showAiPanel">
        <div>
          <h3>智能生成提示词</h3>
          <div class="panel-tip">粘贴聊天记录后生成 4 组提示词预览。</div>
        </div>
        <span class="chevron">{{ showAiPanel ? '收起' : '展开' }}</span>
      </div>
      <div v-if="showAiPanel" class="ai-panel-body">
        <textarea
          class="chat-log-input"
          v-model="chatLog"
          rows="6"
          placeholder="将买卖双方的聊天记录粘贴到此处…"
          spellcheck="false"
        />
        <div class="ai-actions">
          <button class="btn btn-primary" :disabled="generating || !chatLog.trim()" @click="generatePrompts">
            {{ generating ? '智能生成中...' : '智能生成' }}
          </button>
          <span v-if="generateError" class="generate-err">{{ generateError }}</span>
        </div>
      </div>
    </section>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">当前标签</div>
        <div class="summary-value">{{ activeTabLabel }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">未保存项</div>
        <div class="summary-value">{{ dirtyKeys.length }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">智能预览</div>
        <div class="summary-value">{{ previewPrompts ? '待确认' : '无' }}</div>
      </div>
    </div>

    <div class="prompts-body" v-if="loaded && !loadError">
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab"
          :class="{ active: activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          {{ tab.label }}<span v-if="dirtyKeys.includes(tab.key)" class="tab-dirty-dot">●</span>
        </button>
        <button
          v-if="previewPrompts !== null"
          class="tab tab-preview"
          :class="{ active: activeTab === '__preview__' }"
          @click="switchTab('__preview__')"
        >
          智能预览
        </button>
      </div>

      <div class="editor-area">
        <template v-for="tab in tabs" :key="tab.key">
          <section v-if="activeTab === tab.key" class="panel editor-pane">
            <div class="editor-toolbar">
              <span class="char-count">{{ (form[tab.key] || '').length }} 字符</span>
              <button type="button" class="btn btn-text" @click="resetPrompt(tab.key)">恢复默认</button>
            </div>
            <textarea
              class="prompt-editor"
              v-model="form[tab.key]"
              :placeholder="`在此输入 ${tab.label} 提示词...`"
              spellcheck="false"
            />
            <div class="form-actions">
              <button
                class="btn btn-primary"
                :disabled="savingKey === tab.key || !dirtyKeys.includes(tab.key)"
                @click="save(tab.key)"
              >
                {{ savingKey === tab.key ? '保存中...' : `保存${tab.label}` }}
              </button>
              <span v-if="savedKey === tab.key" class="save-ok">已保存</span>
            </div>
          </section>
        </template>

        <div v-if="activeTab === '__preview__' && previewPrompts !== null" class="preview-area">
          <section v-for="tab in tabs" :key="tab.key" class="preview-panel panel">
            <div class="preview-panel-header">
              <span class="preview-panel-title">{{ tab.label }}</span>
              <button class="btn btn-primary btn-sm" @click="applyPreview(tab.key)">应用此项</button>
            </div>
            <div class="preview-panel-body">
              <div class="preview-col">
                <div class="preview-col-label">当前内容（只读）</div>
                <textarea class="preview-readonly" readonly :value="form[tab.key]" spellcheck="false" />
              </div>
              <div class="preview-col">
                <div class="preview-col-label">智能生成内容（可编辑）</div>
                <textarea class="preview-editable prompt-editor" v-model="previewPrompts[tab.key]" spellcheck="false" />
              </div>
            </div>
          </section>
          <div class="preview-actions">
            <button class="btn btn-primary" @click="applyAllPreviews">全部应用</button>
            <button class="btn btn-secondary" @click="discardPreview">放弃</button>
          </div>
        </div>
      </div>
    </div>

    <section v-else-if="loadError" class="panel load-error-panel">
      <EmptyState
        title="提示词页面加载失败"
        :hint="loadError"
        icon="!"
        tone="warning"
      >
        <button class="btn btn-primary" @click="loadPage">重新加载</button>
      </EmptyState>
    </section>

    <div v-else class="loading">加载中...</div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import { runViewInitialization } from '../utils/viewInitialization.mjs'

const tabs = [
  { key: 'classify_prompt', label: '意图分类' },
  { key: 'price_prompt', label: '价格谈判' },
  { key: 'tech_prompt', label: '技术咨询' },
  { key: 'default_prompt', label: '默认回复' },
]

const activeTab = ref('classify_prompt')
const form = ref({})
const defaults = ref({})
const loaded = ref(false)
const loadError = ref('')
const savingKey = ref('')
const savedKey = ref('')
const chatLog = ref('')
const generating = ref(false)
const generateError = ref('')
const showAiPanel = ref(false)
const savedState = ref({})
const previewPrompts = ref(null)

const dirtyKeys = computed(() => tabs.filter((t) => form.value[t.key] !== savedState.value[t.key]).map((t) => t.key))
const activeTabLabel = computed(() => {
  if (activeTab.value === '__preview__') return '智能预览'
  return tabs.find((tab) => tab.key === activeTab.value)?.label || '-'
})

async function loadPage() {
  loaded.value = false
  loadError.value = ''
  await runViewInitialization('提示词页面', async () => {
    const [prompts, defaultPrompts] = await Promise.all([
      window.electronAPI.getPrompts(),
      window.electronAPI.getDefaultPrompts(),
    ])
    defaults.value = defaultPrompts
    form.value = { ...defaultPrompts, ...prompts }
    savedState.value = { ...form.value }
    window.electronAPI.removeAllListeners?.('bot:generate_prompts_result')
    window.electronAPI.onGeneratePromptsResult((msg) => {
      generating.value = false
      if (msg.success) {
        const p = msg.prompts || {}
        previewPrompts.value = {
          classify_prompt: typeof p.classify_prompt === 'string' ? p.classify_prompt : form.value.classify_prompt,
          price_prompt: typeof p.price_prompt === 'string' ? p.price_prompt : form.value.price_prompt,
          tech_prompt: typeof p.tech_prompt === 'string' ? p.tech_prompt : form.value.tech_prompt,
          default_prompt: typeof p.default_prompt === 'string' ? p.default_prompt : form.value.default_prompt,
        }
        showAiPanel.value = false
        activeTab.value = '__preview__'
      } else {
        generateError.value = msg.message || '生成失败，请重试'
      }
    })
    loaded.value = true
  }, {
    fallbackMessage: '提示词初始化失败，请稍后重试',
    onError: (message) => {
      loadError.value = message
      loaded.value = true
    },
  })
}

onMounted(() => {
  loadPage()
})

onUnmounted(() => {
  window.electronAPI.removeAllListeners?.('bot:generate_prompts_result')
})

onBeforeRouteLeave(() => {
})

function switchTab(key) {
  activeTab.value = key
}

function resetPrompt(key) {
  form.value[key] = defaults.value[key] || ''
}

async function resetAllPrompts() {
  tabs.forEach((t) => {
    form.value[t.key] = defaults.value[t.key] || ''
  })
  await window.electronAPI.savePrompts({ ...form.value })
  savedState.value = { ...form.value }
}

async function generatePrompts() {
  generating.value = true
  generateError.value = ''
  await window.electronAPI.generatePrompts(chatLog.value)
}

async function save(key) {
  savingKey.value = key
  savedKey.value = ''
  try {
    await window.electronAPI.savePrompts({ [key]: form.value[key] })
    savedKey.value = key
    savedState.value[key] = form.value[key]
    setTimeout(() => {
      savedKey.value = ''
    }, 3000)
  } finally {
    savingKey.value = ''
  }
}

function applyPreview(key) {
  form.value[key] = previewPrompts.value[key]
}

function applyAllPreviews() {
  if (!previewPrompts.value) return
  tabs.forEach((t) => {
    form.value[t.key] = previewPrompts.value[t.key]
  })
  previewPrompts.value = null
  generateError.value = ''
  activeTab.value = 'classify_prompt'
}

function discardPreview() {
  previewPrompts.value = null
  generateError.value = ''
  activeTab.value = 'classify_prompt'
}
</script>

<style scoped>
.prompts-page {
  height: 100%;
  overflow: hidden;
}

.prompts-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 14px;
}

.ai-config-panel {
  padding-bottom: 16px;
}

.clickable {
  cursor: pointer;
}

.chevron {
  font-size: 12px;
  color: var(--text-muted);
}

.ai-panel-body,
.preview-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.generate-err {
  font-size: 12px;
  color: var(--text-danger);
}

.tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  background: #fff;
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
  font-size: 13px;
  font-weight: 600;
}

.tab.active {
  background: var(--bg-primary);
  color: #fff;
  border-color: transparent;
}

.tab-preview {
  color: #7c3aed;
  border-color: #d8b4fe;
  background: #faf5ff;
}

.tab-preview.active {
  background: #7c3aed;
}

.tab-dirty-dot {
  font-size: 12px;
}

.editor-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.char-count {
  font-size: 12px;
  color: var(--text-muted);
}

.prompt-editor,
.preview-readonly {
  flex: 1;
  min-height: 360px;
  resize: none;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.7;
}

.prompt-editor {
  background: #0f172a;
  color: #dbeafe;
  border: 1px solid rgba(148, 163, 184, 0.24);
}

.preview-area {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
}

.preview-panel-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.preview-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-col-label,
.preview-panel-title {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
}

.preview-readonly {
  background: #f8fafc;
  color: var(--text-muted);
}

.save-ok {
  color: var(--text-success);
  font-size: 13px;
  font-weight: 600;
}

.load-error-panel {
  min-height: 320px;
}

@media (max-width: 960px) {
  .preview-panel-body {
    grid-template-columns: 1fr;
  }
}
</style>
