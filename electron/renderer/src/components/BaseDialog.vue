<template>
  <Teleport to="body">
    <transition name="dialog">
      <div v-if="modelValue" class="dialog-overlay" @click.self="cancel">
        <div class="dialog-panel anim-scale-in">
          <h2 v-if="title" class="dialog-title">{{ title }}</h2>
          <div class="dialog-body">
            <slot />
          </div>
          <div class="dialog-footer">
            <slot name="footer">
              <button class="base-btn base-btn--secondary" style="min-height:32px;padding:0 12px;font-size:13px" @click="cancel">{{ cancelText }}</button>
              <button
                class="base-btn dialog-btn--confirm"
                :class="danger ? 'dialog-btn--danger' : 'dialog-btn--primary'"
                style="min-height:32px;padding:0 12px;font-size:13px"
                :disabled="loading"
                @click="confirm"
              >
                <span v-if="loading" class="base-btn__spinner" style="width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dialog-spin 0.6s linear infinite"></span>
                {{ loading ? '处理中…' : confirmText }}
              </button>
            </slot>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'close'])

function confirm() {
  emit('confirm')
}
function cancel() {
  emit('update:modelValue', false)
  emit('cancel')
  emit('close')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(16, 24, 40, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog-panel {
  width: min(440px, 100%);
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-popover, 0 12px 32px rgba(16,24,40,0.12));
  padding: 24px;
}
.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-strong, #17211d);
  margin: 0 0 8px;
}
.dialog-body {
  font-size: 14px;
  color: var(--text-secondary, #52615b);
  line-height: 1.6;
  margin-bottom: 20px;
}
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.1s ease, border-color 0.1s ease;
}
.base-btn:disabled { opacity: 0.48; cursor: not-allowed; }
.base-btn--secondary {
  background: var(--bg-surface, #fff);
  color: var(--text-secondary, #52615b);
  border-color: var(--border-subtle, #e5e7eb);
}
.base-btn--secondary:hover:not(:disabled) {
  background: var(--bg-subtle, #f3f4f6);
}
.dialog-btn--primary {
  background: var(--brand-primary, #0f766e);
  color: #fff;
  border-color: var(--brand-primary, #0f766e);
}
.dialog-btn--primary:hover:not(:disabled) {
  background: var(--brand-primary-hover, #0d9488);
}
.dialog-btn--danger {
  background: var(--color-danger, #dc2626);
  color: #fff;
  border-color: var(--color-danger, #dc2626);
}
.dialog-btn--danger:hover:not(:disabled) {
  background: #b91c1c;
}
@keyframes dialog-spin {
  to { transform: rotate(360deg); }
}

/* 过渡 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity var(--duration-fast, 100ms) var(--ease-standard, ease);
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
