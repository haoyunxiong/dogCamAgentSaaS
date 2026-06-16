<template>
  <ol class="tracking-timeline">
    <li v-for="step in steps" :key="step.label" :class="{ done: step.done, current: step.current }">
      <span aria-hidden="true" />
      <div>
        <strong>{{ step.label }}</strong>
        <small>{{ step.time || step.desc || step.description }}</small>
      </div>
    </li>
  </ol>
</template>

<script setup>
defineProps({
  steps: { type: Array, default: () => [] },
})
</script>

<style scoped>
.tracking-timeline {
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--ui-space-8);
  list-style: none;
}

.tracking-timeline li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: var(--ui-space-8);
  color: var(--ui-text-muted);
}

.tracking-timeline li > span {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: var(--radius-pill);
  background: var(--ui-border-strong);
  box-shadow: 0 0 0 4px var(--ui-surface-soft);
}

.tracking-timeline li.done > span {
  background: var(--color-status-success);
}

.tracking-timeline li.current > span {
  background: var(--color-status-warning);
}

.tracking-timeline strong,
.tracking-timeline small {
  display: block;
}

.tracking-timeline strong {
  color: var(--ui-text);
  font-size: 13px;
}

.tracking-timeline small {
  margin-top: 2px;
  font-size: 12px;
}
</style>
