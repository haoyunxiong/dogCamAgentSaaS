<template>
  <section class="chart-card">
    <header>
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <StatusTag v-if="tag" :label="tag" tone="info" />
    </header>
    <div class="chart-summary">
      <strong>{{ value }}</strong>
      <span>{{ note }}</span>
    </div>
    <div :class="['chart-bars', `is-${variant}`]" :style="{ '--count': data.length }">
      <span
        v-for="item in normalizedData"
        :key="item.label"
        :style="{ '--value': `${item.percent}%`, '--index': item.index }"
      >
        <em>{{ item.valueLabel }}</em>
        <i />
        <small>{{ item.label }}</small>
      </span>
    </div>
    <footer v-if="footer">{{ footer }}</footer>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import StatusTag from './StatusTag.vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  tag: { type: String, default: '' },
  data: { type: Array, default: () => [] },
  variant: { type: String, default: 'bar' },
  value: { type: String, default: '' },
  note: { type: String, default: '' },
  footer: { type: String, default: '' }
})

const normalizedData = computed(() => {
  const max = Math.max(...props.data.map((item) => Number(item.value) || 0), 1)
  return props.data.map((item, index) => {
    const rawValue = Number(item.value) || 0
    return {
      ...item,
      index,
      percent: Math.max(Math.round((rawValue / max) * 100), 8),
      valueLabel: item.valueLabel || item.value
    }
  })
})
</script>

<style scoped>
.chart-card {
  min-height: 304px;
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: var(--space-14, 14px);
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

.chart-summary {
  min-height: 54px;
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-12);
}

.chart-summary strong {
  color: var(--brand-strong);
  font-size: 26px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.chart-summary span {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
  font-weight: 720;
}

.chart-bars {
  min-height: 164px;
  display: grid;
  grid-template-columns: repeat(var(--count), minmax(0, 1fr));
  align-items: end;
  gap: var(--space-8);
  padding-top: var(--space-4);
}

.chart-bars span {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--space-6, 6px);
  align-items: end;
}

.chart-bars em {
  color: var(--text-soft);
  font-size: 11px;
  font-style: normal;
  font-weight: 760;
  text-align: center;
}

i {
  height: var(--value);
  min-height: 18px;
  border-radius: var(--radius-8);
  background: linear-gradient(180deg, var(--brand), var(--color-primary-500));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.is-trend i {
  border-radius: var(--radius-pill);
  background:
    linear-gradient(180deg, var(--color-primary-500), var(--brand));
}

.is-trend span:nth-child(even) i {
  background:
    linear-gradient(180deg, var(--info), var(--brand));
}

small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
}

footer {
  padding-top: var(--space-12);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}
</style>
