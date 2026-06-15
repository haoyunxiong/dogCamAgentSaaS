<template>
  <button :class="['toggle-switch', { active: modelValue }]" type="button" @click="$emit('update:modelValue', !modelValue)">
    <span />
  </button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.toggle-switch {
  width: 44px;
  height: 26px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-strong);
  display: inline-flex;
  justify-content: flex-start;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.toggle-switch span {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
  transition: transform 0.15s ease;
}

.toggle-switch.active {
  border-color: var(--brand);
  background: var(--brand);
}

.toggle-switch.active span {
  transform: translateX(18px);
}
</style>
