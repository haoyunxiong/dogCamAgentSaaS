import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 全局 UI 状态：待办徽章 + 通知 toast + 侧边栏折叠
export const useUiStore = defineStore('ui', () => {
  // 侧边栏是否折叠（窄屏/用户手动）
  const sidebarCollapsed = ref(false)

  // 待办徽章数字（各模块自行设置）
  const badges = ref({
    takeovers: 0,      // 人工接管
    pending: 0,        // 消息审批
    learning: 0,       // 学习审核
    orders: 0,         // 待履约订单
  })

  function setBadge(key, val) {
    const n = Number(val)
    badges.value[key] = Number.isFinite(n) && n > 0 ? n : 0
  }

  const totalPending = computed(() =>
    (badges.value.takeovers || 0) +
    (badges.value.pending || 0) +
    (badges.value.learning || 0)
  )

  // ---- Toast 通知 ----
  const toasts = ref([])
  let _tid = 0
  function toast(message, type = 'info', duration = 2600) {
    const id = ++_tid
    toasts.value.push({ id, message, type })
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration)
    }
    return id
  }
  function dismissToast(id) {
    const i = toasts.value.findIndex((t) => t.id === id)
    if (i >= 0) toasts.value.splice(i, 1)
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    sidebarCollapsed,
    toggleSidebar,
    badges,
    setBadge,
    totalPending,
    toasts,
    toast,
    dismissToast,
  }
})
