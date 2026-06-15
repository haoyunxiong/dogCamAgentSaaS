<template>
  <button
    :class="['base-button', `is-${variant}`, `size-${size}`, { 'is-block': block }]"
    :type="type"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
</script>

<style scoped>
.base-button {
  min-height: 36px;
  padding: 0 var(--space-16);
  border-radius: var(--radius-8);
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  font-size: 13px;
  line-height: 20px;
  font-weight: 720;
  white-space: nowrap;
  transition: background 0.15s ease, border 0.15s ease, box-shadow 0.15s ease;
}

.base-button:not(:disabled):hover {
  box-shadow: var(--shadow-subtle);
}

.base-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.size-sm {
  min-height: 32px;
  padding: 0 var(--space-12);
}

.size-lg {
  min-height: 40px;
  padding: 0 var(--space-20);
}

.is-primary {
  background: var(--brand);
  color: var(--color-text-inverse);
}

.is-secondary {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}

.is-ghost {
  background: transparent;
  color: var(--text-soft);
}

.is-danger {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: #f3c2c2;
}

.is-block {
  width: 100%;
}
</style>
