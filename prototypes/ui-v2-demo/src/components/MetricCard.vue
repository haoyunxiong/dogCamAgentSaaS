<template>
  <article :class="['metric-card', `tone-${metric.tone || 'neutral'}`]">
    <div class="metric-label">{{ metric.label }}</div>
    <div class="metric-value">
      <strong>{{ metric.value }}</strong>
      <span>{{ metric.unit }}</span>
    </div>
    <div class="metric-trend">{{ metric.trend }}</div>
  </article>
</template>

<script setup>
defineProps({
  metric: { type: Object, required: true }
})
</script>

<style scoped>
.metric-card {
  min-height: 98px;
  padding: 12px 12px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(247, 248, 245, 0.9));
  display: grid;
  align-content: space-between;
  gap: 8px;
  position: relative;
}

.metric-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 13px;
  width: 2px;
  height: 32px;
  border-radius: 0 2px 2px 0;
  background: var(--brand);
}

.tone-success::before { background: var(--success); }
.tone-warning::before { background: var(--warning); }
.tone-danger::before { background: var(--danger); }
.tone-info::before { background: var(--info); }

.metric-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 760;
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-value strong {
  font-size: 24px;
  line-height: 1;
  letter-spacing: 0;
}

.metric-value span,
.metric-trend {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 650;
}
</style>
