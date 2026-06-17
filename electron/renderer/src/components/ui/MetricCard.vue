<template>
  <article :class="['metric-card', `tone-${tone}`]">
    <div class="metric-card__top">
      <span class="metric-card__icon">{{ icon }}</span>
      <div class="metric-card__label">{{ label }}</div>
    </div>
    <div class="metric-card__value">
      <strong>{{ value }}</strong>
      <span v-if="unit">{{ unit }}</span>
    </div>
    <div v-if="trend || hint" class="metric-card__trend">{{ trend || hint }}</div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  metric: { type: Object, default: null },
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  unit: { type: String, default: '' },
  trend: { type: String, default: '' },
  hint: { type: String, default: '' },
  tone: { type: String, default: 'neutral' },
})

const label = computed(() => props.metric?.label ?? props.label)
const value = computed(() => props.metric?.value ?? props.value)
const unit = computed(() => props.metric?.unit ?? props.unit)
const trend = computed(() => props.metric?.trend ?? props.trend)
const hint = computed(() => props.metric?.hint ?? props.hint)
const tone = computed(() => props.metric?.tone ?? props.tone)
const icon = computed(() => {
  const source = label.value || ''
  return source.slice(0, 1) || '•'
})
</script>

<style scoped>
.metric-card {
  position: relative;
  min-height: 104px;
  overflow: hidden;
  padding: 16px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-surface);
  display: grid;
  align-content: space-between;
  gap: 10px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.metric-card__top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-card__icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--ui-brand);
  background: var(--ui-brand-soft);
  font-size: 13px;
  font-weight: 850;
}

.tone-success .metric-card__icon { color: var(--color-status-success); background: var(--color-success-soft); }
.tone-warning .metric-card__icon { color: var(--color-status-warning); background: var(--color-warning-soft); }
.tone-danger .metric-card__icon { color: var(--color-status-danger); background: var(--color-danger-soft); }
.tone-info .metric-card__icon { color: var(--color-status-info); background: var(--color-info-soft); }

.metric-card__label {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 760;
}

.metric-card__value {
  display: flex;
  align-items: baseline;
  gap: var(--ui-space-4);
}

.metric-card__value strong {
  color: var(--ui-text);
  font-size: 28px;
  line-height: 1;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.metric-card__value span,
.metric-card__trend {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 650;
}
</style>
