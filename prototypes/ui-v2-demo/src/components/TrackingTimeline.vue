<template>
  <ol class="tracking-timeline">
    <li v-for="step in steps" :key="step.label" :class="{ done: step.done, current: step.current }">
      <span aria-hidden="true" />
      <div>
        <strong>{{ step.label }}</strong>
        <small>{{ step.time || step.desc }}</small>
      </div>
    </li>
  </ol>
</template>

<script setup>
defineProps({
  steps: { type: Array, default: () => [] }
})
</script>

<style scoped>
.tracking-timeline {
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-8);
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: var(--space-8);
  color: var(--text-muted);
}

li > span {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: var(--radius-pill);
  background: var(--border-strong);
  box-shadow: 0 0 0 4px var(--surface-soft);
}

li.done > span {
  background: var(--success);
}

li.current > span {
  background: var(--warning);
}

strong,
small {
  display: block;
}

strong {
  color: var(--text);
  font-size: 13px;
}

small {
  margin-top: 2px;
  font-size: 12px;
}
</style>
