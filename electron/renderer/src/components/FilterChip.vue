<template>
  <button
    type="button"
    class="filter-chip"
    :class="{
      'is-selected': isActive,
      'is-removable': removable,
      'is-disabled': disabled,
    }"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <span class="filter-chip__label"><slot>{{ label }}</slot></span>
    <span v-if="count !== null && count !== undefined" class="filter-chip__count">{{ count }}</span>
    <span
      v-if="removable"
      class="filter-chip__remove"
      role="button"
      tabindex="-1"
      aria-hidden="true"
      @click.stop="$emit('remove', $event)"
    >
      x
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  count: { type: [Number, String], default: null },
  selected: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  removable: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

defineEmits(['click', 'remove'])

const isActive = computed(() => props.selected || props.active)
</script>

<style scoped>
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-token-8, 8px);
  min-height: 32px;
  padding: 0 var(--space-12, 12px);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 999px;
  background: var(--color-surface, #fff);
  color: var(--color-text-secondary, #4b5563);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  transition: background var(--duration-fast, 100ms) var(--ease-standard, ease),
              border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              color var(--duration-fast, 100ms) var(--ease-standard, ease);
}

.filter-chip:hover:not(:disabled) {
  background: var(--bg-subtle, #f3f4f6);
  border-color: var(--border-default, #d1d5db);
}

.filter-chip.is-selected {
  background: rgba(0, 127, 109, 0.08);
  border-color: rgba(0, 127, 109, 0.24);
  color: var(--color-primary, #007f6d);
}

.filter-chip.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.filter-chip__label {
  white-space: nowrap;
}

.filter-chip__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--color-neutral-soft, #f3f4f6);
  color: var(--color-text-muted, #6b7280);
  font-size: 11px;
}

.filter-chip.is-selected .filter-chip__count {
  background: rgba(0, 127, 109, 0.12);
  color: var(--color-primary, #007f6d);
}

.filter-chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: -4px;
  border-radius: 999px;
  color: currentColor;
}

.filter-chip__remove:hover {
  background: rgba(15, 23, 42, 0.08);
}
</style>
