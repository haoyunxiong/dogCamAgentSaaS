<template>
  <Teleport to="body">
    <transition name="dialog">
      <div v-if="modelValue" class="dialog-overlay" @click.self="handleOverlayClick">
        <div class="dialog-panel anim-scale-in" :class="`dialog-panel--${resolvedVariant}`">
          <h2 v-if="title" class="dialog-title">{{ title }}</h2>
          <p v-if="subtitle" class="dialog-subtitle">{{ subtitle }}</p>
          <div class="dialog-body">
            <slot />
          </div>
          <div class="dialog-footer">
            <slot name="footer">
              <button class="base-btn base-btn--secondary" style="min-height:32px;padding:0 12px;font-size:13px" @click="cancel">{{ cancelText }}</button>
              <button
                class="base-btn dialog-btn--confirm"
                :class="resolvedVariant === 'danger' ? 'dialog-btn--danger' : 'dialog-btn--primary'"
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
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  variant: {
    type: String,
    default: 'confirm',
    validator: (v) => ['confirm', 'warning', 'form', 'danger'].includes(v),
  },
  confirmText: { type: String, default: '确认' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  closeOnOverlay: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'close'])

const resolvedVariant = computed(() => props.danger ? 'danger' : props.variant)

function confirm() {
  emit('confirm')
}
function handleOverlayClick() {
  if (props.closeOnOverlay) cancel()
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
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-12, 12px);
  box-shadow: var(--shadow-floating, 0 12px 32px rgba(16,24,40,0.12));
  padding: var(--space-24, 24px);
}
.dialog-panel--warning {
  border-color: var(--color-warning-border, #fed7aa);
}
.dialog-panel--danger {
  border-color: var(--color-danger-border, #fecaca);
}
.dialog-panel--form {
  width: min(560px, 100%);
}
.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #111827);
  margin: 0 0 8px;
}
.dialog-subtitle {
  margin: -2px 0 var(--space-12, 12px);
  color: var(--color-text-muted, #6b7280);
  font-size: 13px;
  line-height: 1.5;
}
.dialog-body {
  font-size: 14px;
  color: var(--color-text-secondary, #4b5563);
  line-height: 1.6;
  margin-bottom: var(--space-20, 20px);
}
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-token-8, 8px);
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
  background: var(--color-surface, #fff);
  color: var(--color-text-secondary, #4b5563);
  border-color: var(--color-border, #e5e7eb);
}
.base-btn--secondary:hover:not(:disabled) {
  background: var(--bg-subtle, #f3f4f6);
}
.dialog-btn--primary {
  background: var(--color-primary, #007f6d);
  color: #fff;
  border-color: var(--color-primary, #007f6d);
}
.dialog-btn--primary:hover:not(:disabled) {
  background: var(--brand-primary-hover, #00a889);
  border-color: var(--brand-primary-hover, #00a889);
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
