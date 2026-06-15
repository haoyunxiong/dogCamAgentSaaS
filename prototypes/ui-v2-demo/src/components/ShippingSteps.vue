<template>
  <div class="shipping-steps">
    <div v-for="(step, index) in steps" :key="step.label" :class="['step', { done: step.done }]">
      <span>{{ index + 1 }}</span>
      <strong>{{ step.label }}</strong>
    </div>
  </div>
</template>

<script setup>
defineProps({
  steps: { type: Array, required: true }
})
</script>

<style scoped>
.shipping-steps {
  display: grid;
  gap: 8px;
}

.step {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.step span {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--neutral-soft);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 760;
}

.step.done {
  background: var(--success-soft);
  border-color: #cce8dc;
}

.step.done span {
  background: var(--success);
  color: #fff;
}

.step strong {
  font-size: 13px;
}
</style>
