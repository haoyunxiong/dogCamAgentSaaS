<template>
  <header class="app-topbar">
    <div class="tb-left">
      <button class="tb-icon-btn" :title="ui.sidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="ui.toggleSidebar()">
        <PanelLeftOpen v-if="ui.sidebarCollapsed" class="tb-svg" aria-hidden="true" />
        <PanelLeftClose v-else class="tb-svg" aria-hidden="true" />
      </button>
      <div class="tb-crumb">
        <span class="tb-crumb-section">{{ sectionLabel }}</span>
        <span v-if="pageLabel" class="tb-crumb-sep">/</span>
        <span v-if="pageLabel" class="tb-crumb-page">{{ pageLabel }}</span>
      </div>
      <div class="tb-context" aria-label="当前工作区信息">
        <span>成都小狗相机租赁</span>
        <span>本地运行</span>
        <span class="tb-context-ok">系统正常</span>
      </div>
    </div>

    <div class="tb-center">
      <button class="tb-search" @click="openPalette" title="快速跳转 (Ctrl+K)">
        <Search class="tb-svg tb-search-icon" aria-hidden="true" />
        <span class="tb-search-text">搜索订单、客户、设备、操作...</span>
        <span class="tb-search-kbd">Ctrl K</span>
      </button>
    </div>

    <div class="tb-right">
      <button class="tb-icon-btn" title="刷新当前页" @click="reload">
        <RefreshCw class="tb-svg" aria-hidden="true" />
      </button>

      <div class="tb-status" :class="{ on: bot.running }">
        <span class="tb-dot"></span>
        <span class="tb-status-txt">{{ bot.running ? 'Agent 运行中' : 'Agent 已停止' }}</span>
      </div>

      <button
        class="tb-cta"
        :class="bot.running ? 'cta-stop' : 'cta-start'"
        :disabled="pending"
        @click="toggleBot"
      >
        <Power v-if="bot.running" class="tb-svg" aria-hidden="true" />
        <Play v-else class="tb-svg" aria-hidden="true" />
        {{ pending ? '处理中…' : (bot.running ? '停止' : '启动') }}
      </button>

      <button class="tb-icon-btn badge-btn" title="待办" @click="goInbox">
        <Bell class="tb-svg" aria-hidden="true" />
        <span v-if="ui.totalPending > 0" class="tb-badge">{{ ui.totalPending > 99 ? '99+' : ui.totalPending }}</span>
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, PanelLeftClose, PanelLeftOpen, Play, Power, RefreshCw, Search } from '@lucide/vue'
import { useBotStore } from '../stores/botStore'
import { useUiStore } from '../stores/uiStore'

const route = useRoute()
const router = useRouter()
const bot = useBotStore()
const ui = useUiStore()
const pending = ref(false)

const META = {
  '/ui-v2': { section: 'UI-V2 Mock', page: '经营工作台' },
  '/ui-v2/orders': { section: 'UI-V2 Mock', page: '订单中心' },
  '/ui-v2/schedule': { section: 'UI-V2 Mock', page: '档期中心' },
  '/ui-v2/devices': { section: 'UI-V2 Mock', page: '设备中心' },
  '/ui-v2/customers': { section: 'UI-V2 Mock', page: '客户中心' },
  '/ui-v2/deposit': { section: 'UI-V2 Mock', page: '免押管理' },
  '/ui-v2/logistics': { section: 'UI-V2 Mock', page: '物流发货' },
  '/ui-v2/reports': { section: 'UI-V2 Mock', page: '报表中心' },
  '/ui-v2/settings': { section: 'UI-V2 Mock', page: '系统设置' },
  '/':            { section: '核心运营',   page: '控制台 / 工作台' },
  '/orders':      { section: '核心运营',   page: '订单履约' },
  '/schedule':    { section: '核心运营',   page: '租赁档期' },
  '/devices':     { section: '核心运营',   page: '设备管理' },
  '/sf-shipping': { section: '核心运营',   page: '顺丰寄件' },
  '/deposits':    { section: '核心运营',   page: '免押管理' },
  '/reports':     { section: '增长与分析', page: '报表中心' },
  '/inquiries':   { section: '增长与分析', page: '询单分析' },
  '/market':      { section: '增长与分析', page: '市场监控' },
  '/pricing':     { section: '增长与分析', page: '定价' },
  '/prompts':     { section: '自动化与知识', page: '提示词' },
  '/knowledge':   { section: '自动化与知识', page: '知识库' },
  '/takeovers':   { section: '自动化与知识', page: '人工接管' },
  '/pending':     { section: '自动化与知识', page: '消息审批' },
  '/learning':    { section: '自动化与知识', page: '学习审核' },
  '/settings':    { section: '系统配置',   page: '设置' },
  '/item-mapping': { section: '系统配置',  page: '商品型号绑定' },
}

const sectionLabel = computed(() => META[route.path]?.section || '工作台')
const pageLabel = computed(() => META[route.path]?.page || '')

async function toggleBot() {
  pending.value = true
  try {
    if (bot.running) {
      await window.electronAPI.botStop()
      ui.toast('机器人已停止', 'info')
    } else {
      await window.electronAPI.botStart()
      ui.toast('机器人启动中…', 'success')
    }
  } catch (e) {
    ui.toast('操作失败: ' + (e?.message || e), 'error')
  } finally {
    pending.value = false
  }
}

function reload() {
  window.location.reload()
}

function goInbox() {
  // 跳转到最优先的待办模块
  if (ui.badges.takeovers > 0) router.push('/takeovers')
  else if (ui.badges.pending > 0) router.push('/pending')
  else if (ui.badges.learning > 0) router.push('/learning')
  else ui.toast('暂无待办', 'info')
}

function openPalette() {
  // 触发全局快捷键事件，由 CommandPalette 响应
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}
</script>

<style scoped>
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--space-16, 16px);
  height: 60px;
  padding: 0 var(--space-20, 20px);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  box-shadow: 0 1px 0 rgba(16, 24, 40, 0.02);
}

.tb-left, .tb-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tb-left {
  min-width: 0;
}
.tb-center { flex: 1; min-width: 0; }

.tb-search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: min(380px, 100%);
  height: 32px;
  padding: 0 10px 0 11px;
  background: #f8fbfa;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-8, 8px);
  color: var(--color-text-muted, #6b7280);
  font-size: 13px;
  cursor: pointer;
  box-shadow: none;
  transition: border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              background var(--duration-fast, 100ms) var(--ease-standard, ease);
}
.tb-search:hover {
  background: #fff;
  border-color: var(--brand-primary-border, rgba(0, 127, 109, 0.24));
}
.tb-search-icon { color: var(--color-text-faint, #9ca3af); }
.tb-search-text {
  flex: 1;
  text-align: left;
  color: var(--color-text-muted, #6b7280);
  user-select: none;
}
.tb-search-kbd {
  padding: 3px 8px;
  font-size: 11px; font-family: 'Consolas', monospace;
  color: var(--color-text-muted, #6b7280);
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: var(--radius-4, 4px);
  box-shadow: none;
}

.tb-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: var(--radius-8, 8px);
  background: transparent;
  color: var(--color-text-secondary, #4b5563);
  font-size: 16px;
  border: 1px solid transparent;
}
.tb-icon-btn:hover {
  background: #f8fafc;
  color: var(--color-text, #111827);
  border-color: var(--brand-primary-border, rgba(0, 127, 109, 0.24));
}

.tb-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  min-width: 0;
}
.tb-crumb-section { color: var(--color-text-muted, #6b7280); font-weight: 600; }
.tb-crumb-sep { color: var(--color-text-faint, #9ca3af); }
.tb-crumb-page { color: var(--color-text, #111827); font-weight: 700; white-space: nowrap; }

.tb-context {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--color-text-muted, #6b7280);
  font-size: 12px;
}
.tb-context span {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f8fbfa;
  border: 1px solid var(--color-border, #e5e7eb);
  white-space: nowrap;
}
.tb-context-ok {
  color: var(--color-success, #16a34a);
  background: var(--color-success-soft, #f0fdf4) !important;
  border-color: var(--color-success-border, #bbf7d0) !important;
}

.tb-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-warning-soft, #fffbeb);
  color: var(--color-warning, #d97706);
  border: 1px solid var(--color-warning-border, #fed7aa);
  opacity: 0.92;
}
.tb-status.on {
  background: var(--color-success-soft, #f0fdf4);
  color: var(--color-success, #16a34a);
  border-color: var(--color-success-border, #bbf7d0);
}
.tb-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.tb-status.on .tb-dot { animation: pulse 1.5s infinite; }

.tb-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 68px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-8, 8px);
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}
.cta-start {
  background: var(--brand-primary, #0f766e);
  box-shadow: 0 1px 2px rgba(15, 118, 110, 0.12);
}
.cta-start:hover:not(:disabled) {
  background: var(--brand-primary-hover, #0d9488);
}
.cta-stop  {
  background: var(--color-danger, #dc2626);
  box-shadow: 0 1px 2px rgba(220, 38, 38, 0.12);
}
.cta-stop:hover:not(:disabled) {
  background: #b91c1c;
}

.tb-svg {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.badge-btn .tb-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

@media (max-width: 1120px) {
  .tb-status-txt {
    display: none;
  }
  .tb-context {
    display: none;
  }
}

@media (max-width: 960px) {
  .tb-center {
    display: none;
  }
  .app-topbar {
    gap: 10px;
  }
  .tb-right {
    margin-left: auto;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
</style>
