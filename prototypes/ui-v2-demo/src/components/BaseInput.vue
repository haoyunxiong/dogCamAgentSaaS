<template>
  <label class="base-input">
    <span v-if="label">{{ label }}</span>
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :type="type"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </label>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.base-input {
  display: grid;
  gap: var(--space-8);
  color: var(--text-soft);
  font-size: 12px;
  line-height: var(--font-caption-line);
  font-weight: 700;
}

input {
  height: 36px;
  width: 100%;
  padding: 0 var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  color: var(--text);
  outline: none;
}

input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}

input:disabled {
  cursor: not-allowed;
  background: var(--surface-soft);
  color: var(--text-muted);
}
</style>
