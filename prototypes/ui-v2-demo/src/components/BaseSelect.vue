<template>
  <label class="base-select">
    <span v-if="label">{{ label }}</span>
    <select :value="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
    </select>
  </label>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.base-select {
  display: grid;
  gap: var(--space-8);
  color: var(--text-soft);
  font-size: 12px;
  line-height: var(--font-caption-line);
  font-weight: 700;
}

select {
  height: 36px;
  min-width: 140px;
  padding: 0 32px 0 var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  color: var(--text);
  outline: none;
}

select:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

select:disabled {
  cursor: not-allowed;
  background: var(--surface-soft);
  color: var(--text-muted);
}
</style>
