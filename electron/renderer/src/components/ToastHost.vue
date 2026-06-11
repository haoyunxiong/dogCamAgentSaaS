<template>
  <Teleport to="body">
    <div class="toast-stack">
      <transition-group name="toast">
        <div
          v-for="t in ui.toasts"
          :key="t.id"
          class="toast-item"
          :class="`toast-${t.type}`"
          @click="ui.dismissToast(t.id)"
        >
          <span class="toast-icon">
            <component :is="iconOf(t.type)" class="toast-icon-svg" aria-hidden="true" />
          </span>
          <span class="toast-msg">{{ t.message }}</span>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup>
import { CheckCircle2, CircleAlert, CircleX, Info } from '@lucide/vue'
import { useUiStore } from '../stores/uiStore'
const ui = useUiStore()
function iconOf(type) {
  return {
    success: CheckCircle2,
    error: CircleX,
    warning: CircleAlert,
    info: Info,
  }[type] || Info
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 260px;
  max-width: 420px;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--bg-surface, #fff);
  box-shadow: var(--shadow-popover, 0 12px 32px rgba(16, 24, 40, 0.12));
  border: 1px solid var(--border-subtle, #e5e7eb);
  font-size: 13px;
  color: var(--text-main);
  cursor: pointer;
  transition: transform 0.16s ease;
}
.toast-item:hover {
  transform: translateY(-1px);
}

.toast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  color: #fff;
  flex: 0 0 auto;
}
.toast-icon-svg {
  width: 15px;
  height: 15px;
  stroke-width: 2.2;
}
.toast-success { border-color: rgba(34, 197, 94, 0.18); }
.toast-success .toast-icon { background: #16a34a; }
.toast-error { border-color: rgba(239, 68, 68, 0.18); }
.toast-error .toast-icon { background: #dc2626; }
.toast-warning { border-color: rgba(249, 115, 22, 0.18); }
.toast-warning .toast-icon { background: #ea580c; }
.toast-info { border-color: rgba(20, 184, 166, 0.18); }
.toast-info .toast-icon { background: #0f766e; }

.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-enter-active, .toast-leave-active { transition: all 0.22s ease; }
.toast-leave-to { opacity: 0; transform: translateX(20px); }
</style>
