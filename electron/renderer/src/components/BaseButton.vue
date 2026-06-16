<template>
  <button
    class="base-btn"
    :class="[
      `base-btn--${variant}`,
      `base-btn--${size}`,
      { 'base-btn--loading': loading, 'base-btn--block': block }
    ]"
    :disabled="disabled || loading"
    :type="buttonType"
    :aria-busy="loading ? 'true' : 'false'"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="base-btn__spinner" aria-hidden="true"></span>
    <slot v-if="($slots.icon || icon) && !loading" name="icon">
      <span class="base-btn__icon" aria-hidden="true">{{ icon }}</span>
    </slot>
    <span v-if="$slots.default" class="base-btn__label"><slot /></span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
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
  type: { type: String, default: 'button' },
  nativeType: { type: String, default: '' },
})

defineEmits(['click'])

const buttonType = computed(() => props.nativeType || props.type || 'button')
</script>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-token-8, 8px);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
  letter-spacing: 0;
  transition: background var(--duration-fast, 100ms) var(--ease-standard, ease),
              border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              color var(--duration-fast, 100ms) var(--ease-standard, ease),
              box-shadow var(--duration-fast, 100ms) var(--ease-standard, ease);
  user-select: none;
}

/* sizes */
.base-btn--sm { min-height: 28px; padding: 0 var(--space-token-8, 8px); font-size: 12px; border-radius: var(--radius-4, 4px); }
.base-btn--md { min-height: 32px; padding: 0 var(--space-12, 12px); font-size: 13px; border-radius: var(--radius-8, 8px); }
.base-btn--lg { min-height: 40px; padding: 0 var(--space-16, 16px); font-size: 14px; border-radius: var(--radius-8, 8px); }

/* block */
.base-btn--block { width: 100%; }

/* primary */
.base-btn--primary {
  background: var(--color-primary, #007f6d);
  color: #fff;
  border-color: var(--color-primary, #007f6d);
  box-shadow: var(--shadow-subtle, 0 1px 2px rgba(16,24,40,0.04));
}
.base-btn--primary:hover:not(:disabled) {
  background: var(--brand-primary-hover, #00a889);
  border-color: var(--brand-primary-hover, #00a889);
}
.base-btn--primary:active:not(:disabled) {
  background: var(--brand-primary-active, #06443d);
}

/* secondary */
.base-btn--secondary {
  background: var(--color-surface, #fff);
  color: var(--color-text-secondary, #4b5563);
  border-color: var(--color-border, #e5e7eb);
  box-shadow: var(--shadow-none, none);
}
.base-btn--secondary:hover:not(:disabled) {
  background: var(--bg-subtle, #f3f4f6);
  border-color: var(--border-default, #d1d5db);
}

/* ghost */
.base-btn--ghost {
  background: transparent;
  color: var(--color-text-secondary, #4b5563);
}
.base-btn--ghost:hover:not(:disabled) {
  background: var(--bg-subtle, #f3f4f6);
}

/* danger */
.base-btn--danger {
  background: var(--color-danger, #dc2626);
  color: #fff;
  border-color: var(--color-danger, #dc2626);
  box-shadow: var(--shadow-subtle, 0 1px 2px rgba(16,24,40,0.04));
}
.base-btn--danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}

/* link */
.base-btn--link {
  background: transparent;
  color: var(--color-primary, #007f6d);
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
  box-shadow: none;
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
