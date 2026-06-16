<template>
  <div
    class="app-layout app-shell"
    :class="{ 'sidebar-collapsed': ui.sidebarCollapsed, 'ui-v2-mobile-preview': isUiV2MobileRoute }"
  >
    <AppSidebar v-if="!isUiV2MobileRoute" class="app-shell-sidebar" />

    <div class="app-main app-shell-main">
      <AppTopBar v-if="!isUiV2MobileRoute" />
      <main class="app-main-inner app-content-scroll" role="main">
        <BrowserPreviewNotice v-if="showBrowserPreviewNotice" :route-path="route.path" />
        <router-view v-else v-slot="{ Component, route: viewRoute }">
          <transition name="page">
            <component :is="Component" :key="viewRoute.path" />
          </transition>
        </router-view>
      </main>
    </div>

    <ToastHost />
    <CommandPalette />
    <BaseDialog
      v-model="confirmState.open"
      :title="confirmState.title"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :danger="confirmState.danger"
      :loading="confirmState.loading"
      @confirm="resolveConfirm(true)"
      @cancel="resolveConfirm(false)"
    >
      <p v-if="confirmState.message" class="global-confirm-message">{{ confirmState.message }}</p>
      <ul v-if="confirmState.details.length" class="global-confirm-details">
        <li v-for="detail in confirmState.details" :key="detail">{{ detail }}</li>
      </ul>
    </BaseDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBotStore } from './stores/botStore'
import { useConfigStore } from './stores/configStore.js'
import { useUiStore } from './stores/uiStore'
import AppSidebar from './components/AppSidebar.vue'
import AppTopBar from './components/AppTopBar.vue'
import BrowserPreviewNotice from './components/BrowserPreviewNotice.vue'
import ToastHost from './components/ToastHost.vue'
import CommandPalette from './components/CommandPalette.vue'
import BaseDialog from './components/BaseDialog.vue'
import { useConfirmDialog } from './composables/useConfirmDialog'
import { isBrowserPreview } from './utils/runtimeMode.mjs'

const botStore = useBotStore()
const configStore = useConfigStore()
const ui = useUiStore()
const route = useRoute()
const browserPreviewMode = computed(() => isBrowserPreview())
const isUiV2MockRoute = computed(() => route.path.startsWith('/ui-v2'))
const isUiV2MobileRoute = computed(() => route.path.startsWith('/ui-v2/mobile'))
const showBrowserPreviewNotice = computed(() => browserPreviewMode.value && !isUiV2MockRoute.value)
const { state: confirmState, resolveConfirm } = useConfirmDialog()

async function loadUiConfig() {
  if (browserPreviewMode.value) return
  const config = await window.electronAPI.getConfig()
  botStore.setMaxLogs(config?.UI_MAX_LOG_LINES)
}

// 暴露全局 toast 方法
window.$toast = (msg, type = 'info', dur) => ui.toast(msg, type, dur)

// 轮询拉取待办徽章数字（~20s 一次）
let badgeTimer = null
async function refreshBadges() {
  const countOf = (res) => {
    if (Array.isArray(res)) return res.length
    if (res && Array.isArray(res.items)) return res.items.length
    if (res && typeof res.total === 'number') return res.total
    return 0
  }
  try {
    if (window.electronAPI?.listTakeovers) {
      const res = await window.electronAPI.listTakeovers({ status: 'pending' })
      ui.setBadge('takeovers', countOf(res))
    }
  } catch (e) {}
  try {
    if (window.electronAPI?.listFeishuPending) {
      const res = await window.electronAPI.listFeishuPending({ status: 'pending' })
      ui.setBadge('pending', countOf(res))
    }
  } catch (e) {}
  try {
    if (window.electronAPI?.listLearningCandidates) {
      const res = await window.electronAPI.listLearningCandidates({ status: 'pending' })
      ui.setBadge('learning', countOf(res))
    }
  } catch (e) {}
}

onMounted(async () => {
  if (browserPreviewMode.value) {
    if (route.path === '/') {
      window.location.replace('/#/ui-v2')
    }
    return
  }
  await loadUiConfig()
  await configStore.loadConfig()
  window.electronAPI.onBotStatus((msg) => {
    botStore.setRunning(msg.running)
  })
  window.electronAPI.onBotLog((msg) => {
    botStore.addLog(msg)
  })
  window.electronAPI.onBotError((msg) => {
    botStore.addLog({ ...msg, level: 'error' })
  })
  refreshBadges()
  badgeTimer = setInterval(refreshBadges, 20000)
})

onUnmounted(() => {
  if (browserPreviewMode.value) return
  window.electronAPI.removeAllListeners('bot:status')
  window.electronAPI.removeAllListeners('bot:log')
  window.electronAPI.removeAllListeners('bot:error')
  if (badgeTimer) clearInterval(badgeTimer)
})
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--color-background, #f6f8fb);
}

.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-background, #f6f8fb);
}

.app-main-inner {
  flex: 1;
  min-height: 0;
  overflow: auto;
  width: 100%;
  padding: var(--space-20, 20px) var(--space-24, 24px) var(--space-24, 24px);
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

.app-content-scroll {
  position: relative;
}

.ui-v2-mobile-preview {
  justify-content: center;
  background: #dfe7e5;
}

.ui-v2-mobile-preview .app-main {
  flex: 0 1 430px;
  width: min(430px, 100vw);
  background: transparent;
}

.ui-v2-mobile-preview .app-main-inner {
  padding: 0;
  overflow: auto;
}

.page-enter-from { opacity: 0; transform: translateY(10px) scale(0.995); }
.page-enter-active, .page-leave-active { transition: opacity 0.24s ease, transform 0.24s ease; }
.page-leave-to { opacity: 0; transform: translateY(-6px) scale(0.998); }

@media (max-width: 1024px) {
  .app-layout {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
    overflow: auto;
  }
  .app-main { overflow: visible; }
  .app-main-inner { overflow: visible; }
}

.global-confirm-message {
  margin: 0;
  color: var(--text-secondary, #52615b);
}

.global-confirm-details {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--text-muted, #6f8078);
  font-size: 13px;
  line-height: 1.6;
}
</style>
