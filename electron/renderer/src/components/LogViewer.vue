<template>
  <div class="log-viewer-wrap">
    <div class="log-toolbar">
      <div class="lt-left">
        <div class="lt-filter-group">
          <button
            v-for="f in filters"
            :key="f.key"
            class="lt-chip"
            :class="{ active: activeFilter === f.key }"
            @click="activeFilter = f.key"
          >
            <span :class="`lt-dot lt-dot-${f.key}`"></span>
            {{ f.label }}
            <span v-if="f.key !== 'all' && counts[f.key] > 0" class="lt-chip-num">{{ counts[f.key] }}</span>
          </button>
        </div>
        <div class="lt-search">
          <span class="lt-search-icon">🔎</span>
          <input v-model="keyword" placeholder="过滤关键词…" />
          <button v-if="keyword" class="lt-search-clear" @click="keyword = ''" title="清空">✕</button>
        </div>
      </div>
      <div class="lt-right">
        <button
          class="lt-icon-btn"
          :class="{ off: !autoScrollOn }"
          @click="toggleAutoScroll"
          :title="autoScrollOn ? '暂停自动滚动' : '恢复自动滚动'"
        >
          {{ autoScrollOn ? '⏸ 跟随' : '▶ 跟随' }}
        </button>
        <button class="lt-icon-btn" @click="copyAll" title="复制全部日志">⧉ 复制</button>
        <button class="lt-icon-btn danger" @click="$emit('clear')" title="清空日志">🗑 清空</button>
      </div>
    </div>

    <div ref="containerRef" class="log-viewer" @scroll="onScroll">
      <div
        v-for="entry in visibleLogs"
        :key="entry.id"
        class="log-line"
        :class="`level-${entry.level}`"
      >
        <span class="log-time">{{ formatTime(entry.time) }}</span>
        <span class="log-level">{{ levelLabel(entry.level) }}</span>
        <span class="log-msg">{{ entry.message }}</span>
      </div>
      <div v-if="visibleLogs.length === 0" class="log-empty">
        <img class="log-empty-image" :src="brandDog" alt="日志空状态" />
        <div v-if="logs.length === 0">暂无日志，启动机器人后将实时显示运行日志</div>
        <div v-else-if="keyword">没有匹配 "{{ keyword }}" 的日志</div>
        <div v-else>当前筛选下没有日志</div>
      </div>
    </div>

    <div class="log-footer">
      <span>共 <b>{{ logs.length }}</b> 条</span>
      <span v-if="visibleLogs.length !== logs.length">（筛选后 {{ visibleLogs.length }}）</span>
      <span class="lt-spacer"></span>
      <span v-if="!autoScrollOn" class="lt-paused-hint">⏸ 已暂停滚动</span>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import brandDog from '../assets/brand-dog.jpg'

const props = defineProps({
  logs: { type: Array, default: () => [] },
})
defineEmits(['clear'])

const containerRef = ref(null)
const activeFilter = ref('all')
const keyword = ref('')
const autoScrollOn = ref(true)
let userPaused = false

const filters = [
  { key: 'all',     label: '全部' },
  { key: 'info',    label: '信息' },
  { key: 'warning', label: '警告' },
  { key: 'error',   label: '错误' },
]

const counts = computed(() => {
  const c = { info: 0, warning: 0, error: 0, debug: 0 }
  for (const l of props.logs) {
    if (c[l.level] != null) c[l.level]++
  }
  return c
})

const visibleLogs = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return props.logs.filter((l) => {
    if (activeFilter.value !== 'all' && l.level !== activeFilter.value) return false
    if (kw && !(l.message || '').toLowerCase().includes(kw)) return false
    return true
  })
})

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return ''
  }
}

function levelLabel(level) {
  return { debug: '调试', info: '信息', warning: '警告', error: '错误' }[level] || level || '-'
}

function onScroll() {
  if (!containerRef.value) return
  const el = containerRef.value
  const threshold = 60
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  // 用户主动往上滚 → 暂停；滚回底部 → 恢复
  if (!atBottom) {
    userPaused = true
    autoScrollOn.value = false
  } else if (userPaused) {
    userPaused = false
    autoScrollOn.value = true
  }
}

function toggleAutoScroll() {
  autoScrollOn.value = !autoScrollOn.value
  userPaused = !autoScrollOn.value
  if (autoScrollOn.value) scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  })
}

async function copyAll() {
  const text = visibleLogs.value
    .map((l) => `[${formatTime(l.time)}] [${levelLabel(l.level)}] ${l.message}`)
    .join('\n')
  try {
    await navigator.clipboard.writeText(text)
    window.$toast?.(`已复制 ${visibleLogs.value.length} 条日志`, 'success', 1600)
  } catch (e) {
    window.$toast?.('复制失败: ' + (e.message || e), 'error')
  }
}

watch(
  () => props.logs.length,
  () => {
    if (autoScrollOn.value) scrollToBottom()
  }
)
</script>

<style scoped>
.log-viewer-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 8px;
}

.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: #1f2937;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: var(--radius-lg);
  flex-wrap: wrap;
}
.lt-left, .lt-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lt-filter-group {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 10px;
}
.lt-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 7px;
  background: transparent;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
}
.lt-chip:hover { color: #fff; background: rgba(148, 163, 184, 0.12); }
.lt-chip.active {
  background: #3b82f6;
  color: #fff;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
}
.lt-chip-num {
  min-width: 16px;
  padding: 0 4px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 10px;
  font-weight: 800;
}

.lt-dot { width: 6px; height: 6px; border-radius: 50%; }
.lt-dot-all     { background: #cbd5e1; }
.lt-dot-info    { background: #60a5fa; }
.lt-dot-warning { background: #fbbf24; }
.lt-dot-error   { background: #f87171; }

.lt-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  width: 220px;
}
.lt-search input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: #e2e8f0;
  font-size: 12px;
}
.lt-search input::placeholder { color: #64748b; }
.lt-search-icon { font-size: 11px; color: #94a3b8; }
.lt-search-clear {
  background: transparent;
  color: #94a3b8;
  padding: 0;
  font-size: 12px;
  height: 18px;
  width: 18px;
  border-radius: 50%;
}
.lt-search-clear:hover { background: rgba(148, 163, 184, 0.2); color: #fff; }

.lt-icon-btn {
  height: 30px;
  padding: 0 12px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
}
.lt-icon-btn:hover { background: rgba(148, 163, 184, 0.18); color: #fff; }
.lt-icon-btn.off { color: #fbbf24; border-color: rgba(251, 191, 36, 0.4); }
.lt-icon-btn.danger:hover { background: rgba(239, 68, 68, 0.22); color: #fecaca; border-color: rgba(239, 68, 68, 0.4); }

.log-viewer {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  border-radius: var(--radius-lg);
  background: #0f172a;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.14);
  font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  min-height: 180px;
}

.log-line {
  display: grid;
  grid-template-columns: 88px 62px minmax(0, 1fr);
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
}
.log-line:last-child { border-bottom: none; }
.log-line:hover { background: rgba(148, 163, 184, 0.04); }

.log-time { color: #64748b; }
.log-level {
  justify-self: start;
  min-width: 56px;
  padding: 0 8px;
  border-radius: 999px;
  font-weight: 700;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.log-msg { color: #dbeafe; word-break: break-word; white-space: pre-wrap; }

.level-debug   .log-level { background: rgba(148, 163, 184, 0.16); color: #cbd5e1; }
.level-info    .log-level { background: rgba(59, 130, 246, 0.18); color: #93c5fd; }
.level-warning .log-level { background: rgba(249, 115, 22, 0.18); color: #fdba74; }
.level-error   .log-level { background: rgba(239, 68, 68, 0.2);  color: #fca5a5; }

.level-warning .log-msg { color: #fde68a; }
.level-error   .log-msg { color: #fecaca; }

.log-empty {
  padding: 48px 0;
  color: #64748b;
  text-align: center;
}
.log-empty-image {
  width: 112px;
  height: 112px;
  object-fit: cover;
  border-radius: 24px;
  margin-bottom: 12px;
  box-shadow: 0 18px 42px rgba(220, 38, 38, 0.18);
}

.log-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #1f2937;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: var(--radius-lg);
  color: #94a3b8;
  font-size: 11.5px;
}
.lt-spacer { flex: 1; }
.lt-paused-hint { color: #fbbf24; font-weight: 600; }

@media (max-width: 960px) {
  .log-line { grid-template-columns: 1fr; gap: 4px; }
  .lt-search { width: 140px; }
}
</style>
