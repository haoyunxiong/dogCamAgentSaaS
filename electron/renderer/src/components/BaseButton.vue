<template>
  <button
    class="base-btn"
    :class="[
      `base-btn--${variant}`,
      `base-btn--${size}`,
      { 'base-btn--loading': loading, 'base-btn--block': block }
    ]"
    :disabled="disabled || loading"
    :type="nativeType"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="base-btn__spinner" aria-hidden="true"></span>
    <slot v-if="icon && !loading" name="icon">
      <span class="base-btn__icon" aria-hidden="true">{{ icon }}</span>
    </slot>
    <span v-if="$slots.default" class="base-btn__label"><slot /></span>
  </button>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'secondary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'danger', 'link'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  nativeType: { type: String, default: 'button' },
})

defineEmits(['click'])
</script>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--duration-fast, 100ms) var(--ease-standard, ease),
              border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              color var(--duration-fast, 100ms) var(--ease-standard, ease),
              box-shadow var(--duration-fast, 100ms) var(--ease-standard, ease);
  user-select: none;
}

/* sizes */
.base-btn--sm { min-height: 28px; padding: 0 10px; font-size: 12px; border-radius: 6px; }
.base-btn--md { min-height: 32px; padding: 0 12px; font-size: 13px; border-radius: 8px; }
.base-btn--lg { min-height: 36px; padding: 0 16px; font-size: 14px; border-radius: 8px; }

/* block */
.base-btn--block { width: 100%; }

/* primary */
.base-btn--primary {
  background: var(--brand-primary, #0f766e);
  color: #fff;
  border-color: var(--brand-primary, #0f766e);
  box-shadow: 0 1px 2px rgba(15, 118, 110, 0.16);
}
.base-btn--primary:hover:not(:disabled) {
  background: var(--brand-primary-hover, #0d9488);
  border-color: var(--brand-primary-hover, #0d9488);
}
.base-btn--primary:active:not(:disabled) {
  background: var(--brand-primary-active, #115e59);
}

/* secondary */
.base-btn--secondary {
  background: var(--bg-surface, #fff);
  color: var(--text-secondary, #52615b);
  border-color: var(--border-subtle, #e5e7eb);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16,24,40,0.04));
}
.base-btn--secondary:hover:not(:disabled) {
  background: var(--bg-subtle, #f3f4f6);
  border-color: var(--border-default, #d1d5db);
}

/* ghost */
.base-btn--ghost {
  background: transparent;
  color: var(--text-secondary, #52615b);
}
.base-btn--ghost:hover:not(:disabled) {
  background: var(--bg-subtle, #f3f4f6);
}

/* danger */
.base-btn--danger {
  background: var(--color-danger, #dc2626);
  color: #fff;
  border-color: var(--color-danger, #dc2626);
  box-shadow: 0 1px 2px rgba(220, 38, 38, 0.16);
}
.base-btn--danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}

/* link */
.base-btn--link {
  background: transparent;
  color: var(--brand-primary, #0f766e);
  padding: 0;
  min-height: auto;
  box-shadow: none;
}
.base-btn--link:hover:not(:disabled) {
  text-decoration: underline;
}

/* disabled */
.base-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

/* loading spinner */
.base-btn--loading { position: relative; }
.base-btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}
@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
</style>
