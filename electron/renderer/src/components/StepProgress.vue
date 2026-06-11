<template>
  <div class="step-progress">
    <button
      v-for="(item, index) in steps"
      :key="item.key"
      type="button"
      class="step-progress__item"
      :class="{
        'is-active': item.key === current,
        'is-done': stepIndex(item.key) < currentIndex,
        'is-clickable': allowBackNavigation && stepIndex(item.key) <= currentIndex,
      }"
      :disabled="!allowBackNavigation || stepIndex(item.key) > currentIndex"
      @click="$emit('change', item.key)"
    >
      <span class="step-progress__num">{{ stepIndex(item.key) < currentIndex ? '✓' : index + 1 }}</span>
      <span class="step-progress__label">{{ item.label }}</span>
      <span v-if="index < steps.length - 1" class="step-progress__line"></span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  steps: { type: Array, default: () => [] },
  current: { type: String, required: true },
  allowBackNavigation: { type: Boolean, default: true },
})

defineEmits(['change'])

const currentIndex = computed(() => props.steps.findIndex((item) => item.key === props.current))

function stepIndex(key) {
  return props.steps.findIndex((item) => item.key === key)
}
</script>

<style scoped>
.step-progress {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 12px;
  background: #fff;
}

.step-progress__item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 0;
  background: transparent;
  text-align: left;
}

.step-progress__item:last-child {
  flex: 0 0 auto;
}

.step-progress__item:disabled {
  cursor: default;
  opacity: 1;
}

.step-progress__num {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--bg-subtle, #f3f4f6);
  color: var(--text-tertiary, #6b7280);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-progress__label {
  color: var(--text-secondary, #4b5563);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.step-progress__line {
  width: 100%;
  min-width: 20px;
  height: 2px;
  margin: 0 12px;
  border-radius: 999px;
  background: var(--border-subtle, #e5e7eb);
}

.step-progress__item.is-active .step-progress__num {
  background: #0f766e;
  color: #fff;
}

.step-progress__item.is-active .step-progress__label,
.step-progress__item.is-done .step-progress__label {
  color: var(--text-primary, #111827);
}

.step-progress__item.is-done .step-progress__num {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}

.step-progress__item.is-done .step-progress__line {
  background: rgba(15, 118, 110, 0.18);
}
</style>
