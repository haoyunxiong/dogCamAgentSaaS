<template>
  <button :class="['filter-chip', { active }]" type="button" @click="$emit('click')">
    <slot>{{ label }}</slot>
    <span v-if="count !== null" class="chip-count">{{ count }}</span>
  </button>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  active: { type: Boolean, default: false },
  count: { type: [Number, String], default: null }
})

defineEmits(['click'])
</script>

<style scoped>
.filter-chip {
  min-height: 31px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 720;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.filter-chip.active {
  color: var(--brand-strong);
  background: #dfeeea;
  border-color: #abcfc7;
  box-shadow: inset 0 0 0 1px rgba(15, 104, 97, 0.08);
}

.chip-count {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: rgba(20, 28, 28, 0.06);
  color: inherit;
  font-size: 11px;
}
</style>
