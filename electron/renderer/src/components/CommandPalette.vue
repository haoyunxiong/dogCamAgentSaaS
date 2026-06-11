<template>
  <Teleport to="body">
    <Transition name="cp-fade">
      <div v-if="open" class="cp-mask" @mousedown.self="close">
        <div class="cp-panel" role="dialog" aria-modal="true">
          <div class="cp-input-wrap">
            <span class="cp-search-icon">
              <Search class="cp-search-svg" aria-hidden="true" />
            </span>
            <input
              ref="inputRef"
              v-model="query"
              class="cp-input"
              placeholder="搜索页面或操作… (支持中文拼音)"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="runActive"
              @keydown.escape="close"
            />
            <span class="cp-kbd">ESC</span>
          </div>

          <div class="cp-list" ref="listRef">
            <template v-if="filtered.length">
              <div
                v-for="(group, gi) in groupedFiltered"
                :key="group.label"
                class="cp-group"
              >
                <div class="cp-group-label">{{ group.label }}</div>
                <div
                  v-for="item in group.items"
                  :key="item.id"
                  class="cp-item"
                  :class="{ active: item.flatIndex === activeIndex }"
                  @mouseenter="activeIndex = item.flatIndex"
                  @click="runItem(item)"
                >
                  <span class="cp-icon">
                    <component :is="item.icon || Search" class="cp-icon-svg" aria-hidden="true" />
                  </span>
                  <span class="cp-label">{{ item.label }}</span>
                  <span v-if="item.hint" class="cp-hint">{{ item.hint }}</span>
                  <span v-if="item.badge" class="cp-badge">{{ item.badge }}</span>
                </div>
              </div>
            </template>
            <div v-else class="cp-empty">
              <div class="cp-empty-icon">
                <Search class="cp-empty-svg" aria-hidden="true" />
              </div>
              <div>没有匹配的指令</div>
              <div class="cp-empty-hint">试试 "订单"、"接管"、"启动" 等关键词</div>
            </div>
          </div>

          <div class="cp-footer">
            <span><span class="cp-kbd">↑↓</span> 选择</span>
            <span><span class="cp-kbd">Enter</span> 执行</span>
            <span><span class="cp-kbd">Ctrl</span>+<span class="cp-kbd">K</span> 打开</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  Flag,
  Home,
  Mail,
  MessageSquareText,
  Package,
  Play,
  Power,
  Radar,
  Search,
  Settings,
  SquarePen,
  WandSparkles,
} from '@lucide/vue'
import { useUiStore } from '../stores/uiStore'
import { useBotStore } from '../stores/botStore'

const router = useRouter()
const ui = useUiStore()
const bot = useBotStore()

const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)
const listRef = ref(null)

function openPalette() {
  open.value = true
  query.value = ''
  activeIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}
function close() {
  open.value = false
}
function toggle() {
  open.value ? close() : openPalette()
}

// ---- 命令清单 ----
const commands = computed(() => [
  // 导航
  { id: 'nav-dashboard',  group: '导航', icon: Home, label: '仪表盘',       hint: 'Dashboard', action: () => router.push('/') },
  { id: 'nav-orders',     group: '导航', icon: Package, label: '订单履约',     hint: '/orders',   action: () => router.push('/orders') },
  { id: 'nav-schedule',   group: '导航', icon: CalendarDays, label: '档期日历',     hint: '/schedule', action: () => router.push('/schedule') },
  { id: 'nav-devices',    group: '导航', icon: Boxes, label: '设备管理',     hint: '/devices',  action: () => router.push('/devices') },
  { id: 'nav-takeovers',  group: '导航', icon: MessageSquareText, label: '人工接管',     hint: '/takeovers', badge: ui.badges.takeovers || null, action: () => router.push('/takeovers') },
  { id: 'nav-pending',    group: '导航', icon: Mail, label: '消息审批',     hint: '/pending',  badge: ui.badges.pending || null, action: () => router.push('/pending') },
  { id: 'nav-learning',   group: '导航', icon: Flag, label: '学习审核',     hint: '/learning', badge: ui.badges.learning || null, action: () => router.push('/learning') },
  { id: 'nav-knowledge',  group: '导航', icon: BookOpen, label: '知识库',       hint: '/knowledge', action: () => router.push('/knowledge') },
  { id: 'nav-market',     group: '导航', icon: Radar, label: '市场监控',     hint: '/market',   action: () => router.push('/market') },
  { id: 'nav-reports',    group: '导航', icon: ChartNoAxesCombined, label: '经营报表',     hint: '/reports',  action: () => router.push('/reports') },
  { id: 'nav-prompts',    group: '导航', icon: SquarePen, label: 'Prompts 管理', hint: '/prompts',  action: () => router.push('/prompts') },
  { id: 'nav-settings',   group: '导航', icon: Settings, label: '系统设置',     hint: '/settings', action: () => router.push('/settings') },

  // 操作
  bot.running
    ? { id: 'act-stop',  group: '操作', icon: Power, label: '停止机器人', hint: '当前运行中', action: async () => { await window.electronAPI.botStop(); window.$toast?.('已发送停止指令', 'info') } }
    : { id: 'act-start', group: '操作', icon: Play, label: '启动机器人', hint: '当前已停止', action: async () => { await window.electronAPI.botStart(); window.$toast?.('已发送启动指令', 'success') } },
  { id: 'act-check',   group: '操作', icon: Activity, label: '运行系统自检',   hint: '检查依赖 / 配置 / 网络', action: async () => { router.push('/'); window.$toast?.('已触发自检', 'info') } },
  { id: 'act-extract', group: '操作', icon: WandSparkles, label: '从历史聊天抽取学习候选', hint: '批量扫描会话', action: async () => {
      try {
        const r = await window.electronAPI.extractLearningFromHistory?.()
        window.$toast?.(`已抽取 ${r?.created ?? 0} 条候选`, 'success')
      } catch (e) { window.$toast?.('抽取失败: ' + (e.message || e), 'error') }
    } },
  { id: 'act-open-im', group: '操作', icon: MessageSquareText, label: '打开闲鱼 IM', hint: '浏览器', action: () => window.electronAPI.openUrl?.('https://www.goofish.com/im') },

  // 状态
  { id: 'info-bot',     group: '状态', icon: Power, label: bot.running ? '机器人：运行中' : '机器人：已停止', hint: '点击查看仪表盘', action: () => router.push('/') },
  { id: 'info-pending', group: '状态', icon: Bell, label: `待办合计 ${ui.totalPending}`, hint: '点击查看接管队列', action: () => router.push('/takeovers') },
])

function matchScore(item, q) {
  if (!q) return 1
  const ql = q.toLowerCase()
  const hay = [item.label, item.hint, item.group].filter(Boolean).join(' ').toLowerCase()
  if (hay.includes(ql)) return 2
  // 拆词模糊匹配
  let i = 0
  for (const ch of hay) {
    if (ch === ql[i]) i++
    if (i >= ql.length) return 1
  }
  return 0
}

const filtered = computed(() => {
  const q = query.value.trim()
  return commands.value
    .map((c, idx) => ({ ...c, _score: matchScore(c, q), _idx: idx }))
    .filter((c) => c._score > 0)
    .sort((a, b) => b._score - a._score || a._idx - b._idx)
    .map((c, flatIndex) => ({ ...c, flatIndex }))
})

const groupedFiltered = computed(() => {
  const groups = []
  const map = new Map()
  for (const item of filtered.value) {
    if (!map.has(item.group)) {
      const g = { label: item.group, items: [] }
      map.set(item.group, g)
      groups.push(g)
    }
    map.get(item.group).items.push(item)
  }
  return groups
})

watch(filtered, () => { activeIndex.value = 0 })

function move(delta) {
  const n = filtered.value.length
  if (!n) return
  activeIndex.value = (activeIndex.value + delta + n) % n
  nextTick(() => {
    const el = listRef.value?.querySelector('.cp-item.active')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function runItem(item) {
  close()
  try { item.action?.() } catch (e) { console.error(e) }
}
function runActive() {
  const item = filtered.value[activeIndex.value]
  if (item) runItem(item)
}

function onKey(e) {
  const k = (e.key || '').toLowerCase()
  if ((e.ctrlKey || e.metaKey) && k === 'k') {
    e.preventDefault()
    toggle()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

defineExpose({ openPalette, close, toggle })
</script>

<style scoped>
.cp-mask {
  position: fixed; inset: 0; z-index: 4000;
  background: rgba(15, 23, 42, 0.42);
  display: flex; justify-content: center;
  padding-top: 12vh;
}
.cp-panel {
  width: min(640px, 92vw);
  max-height: 70vh;
  background: var(--bg-surface, #fff);
  border-radius: 18px;
  box-shadow: var(--shadow-popover, 0 12px 32px rgba(16, 24, 40, 0.12));
  display: flex; flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-subtle, #e5e7eb);
}
.cp-input-wrap {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
}
.cp-search-icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
}
.cp-search-svg,
.cp-icon-svg,
.cp-empty-svg {
  width: 16px;
  height: 16px;
  stroke-width: 2.1;
}
.cp-input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 15px; color: #0f172a;
}
.cp-input::placeholder { color: #94a3b8; }
.cp-kbd {
  display: inline-block;
  padding: 3px 8px;
  font-size: 11px; font-family: 'Consolas', monospace;
  color: #475569;
  background: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 6px;
  box-shadow: inset 0 -1px 0 rgba(148, 163, 184, 0.14);
}
.cp-list {
  flex: 1; overflow-y: auto;
  padding: 8px 0 12px;
}
.cp-group { padding: 4px 0; }
.cp-group-label {
  padding: 8px 18px 6px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
  color: #94a3b8;
}
.cp-item {
  display: grid;
  grid-template-columns: 32px 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin: 0 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.12s, transform 0.12s;
}
.cp-item.active {
  background: rgba(20, 184, 166, 0.08);
  transform: translateY(-1px);
}
.cp-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.88);
  color: #475569;
  text-align: center;
}
.cp-item.active .cp-icon {
  background: rgba(255, 255, 255, 0.82);
  color: #0f766e;
}
.cp-label { color: #0f172a; font-weight: 600; font-size: 14px; }
.cp-hint { color: #94a3b8; font-size: 12px; }
.cp-badge {
  min-width: 20px; padding: 0 6px; height: 18px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.16);
  color: #dc2626;
  font-size: 11px; font-weight: 700;
}
.cp-empty {
  padding: 36px 16px; text-align: center; color: #64748b;
}
.cp-empty-icon {
  width: 46px;
  height: 46px;
  margin: 0 auto 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
}
.cp-empty-hint { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.cp-footer {
  display: flex; gap: 16px; justify-content: flex-end;
  padding: 10px 14px;
  border-top: 1px solid var(--border-subtle, #e5e7eb);
  background: var(--bg-subtle, #f3f4f6);
  font-size: 12px; color: #64748b;
}

.cp-fade-enter-from, .cp-fade-leave-to { opacity: 0; }
.cp-fade-enter-active, .cp-fade-leave-active { transition: opacity 0.16s ease; }
.cp-fade-enter-active .cp-panel, .cp-fade-leave-active .cp-panel { transition: transform 0.18s ease; }
.cp-fade-enter-from .cp-panel { transform: translateY(-6px) scale(0.98); }
.cp-fade-leave-to .cp-panel { transform: translateY(-4px) scale(0.99); }
</style>
