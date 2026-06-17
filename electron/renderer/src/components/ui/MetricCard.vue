<template>
  <article :class="['metric-card', `tone-${tone}`]">
    <div class="metric-card__label">{{ label }}</div>
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
</script>

<style scoped>
.metric-card {
  position: relative;
  min-height: 98px;
  overflow: hidden;
  padding: 13px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 251, 250, 0.94)),
    var(--ui-surface);
  display: grid;
  align-content: space-between;
  gap: var(--ui-space-8);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.metric-card::before {
  content: "";
  position: absolute;
  left: 13px;
  top: 12px;
  width: 28px;
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--ui-brand);
}

.tone-success::before { background: var(--color-status-success); }
.tone-warning::before { background: var(--color-status-warning); }
.tone-danger::before { background: var(--color-status-danger); }
.tone-info::before { background: var(--color-status-info); }

.metric-card__label {
  padding-top: 8px;
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
  font-size: 27px;
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
