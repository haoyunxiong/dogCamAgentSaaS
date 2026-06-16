<template>
  <section class="chart-card">
    <header class="chart-card__header">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <StatusBadge v-if="tag" :label="tag" variant="info" size="sm" />
    </header>

    <div v-if="value || note" class="chart-card__summary">
      <strong>{{ value }}</strong>
      <span>{{ note }}</span>
    </div>

    <div :class="['chart-card__bars', `is-${variant}`]" :style="{ '--bar-count': normalizedData.length }">
      <span
        v-for="item in normalizedData"
        :key="item.label"
        :style="{ '--bar-value': `${item.percent}%` }"
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
import StatusBadge from '../StatusBadge.vue'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  tag: { type: String, default: '' },
  data: { type: Array, default: () => [] },
  variant: { type: String, default: 'bar' },
  value: { type: String, default: '' },
  note: { type: String, default: '' },
  footer: { type: String, default: '' },
})

const normalizedData = computed(() => {
  const rows = props.data.length ? props.data : [{ label: '暂无', value: 1, valueLabel: '-' }]
  const max = Math.max(...rows.map((item) => Number(item.value) || 0), 1)
  return rows.map((item) => {
    const rawValue = Number(item.value) || 0
    return {
      ...item,
      percent: Math.max(Math.round((rawValue / max) * 100), 8),
      valueLabel: item.valueLabel || item.value,
    }
  })
})
</script>

<style scoped>
.chart-card {
  min-height: 304px;
  padding: var(--ui-space-16);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  box-shadow: var(--shadow-card);
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: var(--ui-space-12);
}

.chart-card__header {
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-12);
}

.chart-card h3 {
  margin: 0;
  color: var(--ui-text);
  font-size: 16px;
}

.chart-card p {
  margin: var(--ui-space-4) 0 0;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.chart-card__summary {
  min-height: 54px;
  padding: var(--ui-space-12);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-8);
  background: var(--ui-surface-soft);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ui-space-12);
}

.chart-card__summary strong {
  color: var(--ui-brand-strong);
  font-size: 26px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.chart-card__summary span {
  color: var(--ui-text-muted);
  font-size: var(--font-caption-size);
  font-weight: 720;
}

.chart-card__bars {
  min-height: 164px;
  display: grid;
  grid-template-columns: repeat(var(--bar-count), minmax(0, 1fr));
  align-items: end;
  gap: var(--ui-space-8);
  padding-top: var(--ui-space-4);
}

.chart-card__bars span {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 6px;
  align-items: end;
}

.chart-card__bars em {
  color: var(--ui-text-soft);
  font-size: 11px;
  font-style: normal;
  font-weight: 760;
  text-align: center;
}

.chart-card__bars i {
  height: var(--bar-value);
  min-height: 18px;
  border-radius: var(--radius-8);
  background: linear-gradient(180deg, var(--ui-brand), var(--color-primary-500));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.chart-card__bars.is-trend i {
  border-radius: var(--radius-pill);
}

.chart-card__bars small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text-muted);
  font-size: 11px;
  text-align: center;
}

.chart-card footer {
  padding-top: var(--ui-space-12);
  border-top: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: var(--font-caption-size);
}
</style>
