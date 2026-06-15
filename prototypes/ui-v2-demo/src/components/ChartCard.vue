<template>
  <section class="chart-card">
    <header>
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <StatusTag v-if="tag" :label="tag" tone="info" />
    </header>
    <div class="chart-bars" :style="{ '--count': data.length }">
      <span v-for="item in data" :key="item.label" :style="{ '--value': `${item.value}%` }">
        <i />
        <small>{{ item.label }}</small>
      </span>
    </div>
  </section>
</template>

<script setup>
import StatusTag from './StatusTag.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  tag: { type: String, default: '' },
  data: { type: Array, default: () => [] }
})
</script>

<style scoped>
.chart-card {
  min-height: 260px;
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: var(--space-16);
}

header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
}

h3 {
  margin: 0;
  font-size: 16px;
}

p {
  margin: var(--space-4) 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.chart-bars {
  min-height: 168px;
  display: grid;
  grid-template-columns: repeat(var(--count), minmax(0, 1fr));
  align-items: end;
  gap: var(--space-8);
}

.chart-bars span {
  min-width: 0;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--space-8);
  align-items: end;
}

i {
  height: var(--value);
  min-height: 18px;
  border-radius: var(--radius-8) var(--radius-8) 0 0;
  background: linear-gradient(180deg, var(--brand), var(--color-primary-500));
}

small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
}
</style>
