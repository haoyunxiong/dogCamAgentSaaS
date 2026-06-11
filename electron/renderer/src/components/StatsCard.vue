<template>
  <article class="stats-card" :class="tone ? `tone-${tone}` : ''">
    <div class="stats-card__label">{{ label }}</div>
    <strong class="stats-card__value">{{ value }}</strong>
    <div v-if="hint" class="stats-card__hint">{{ hint }}</div>
  </article>
</template>

<script setup>
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  hint: { type: String, default: '' },
  tone: { type: String, default: '' },
})
</script>

<style scoped>
.stats-card {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.stats-card__label,
.stats-card__hint {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.stats-card__value {
  font-size: 24px;
  line-height: 1.1;
  color: var(--text-primary, #111827);
}

.tone-success {
  background: rgba(240, 253, 244, 0.88);
}

.tone-warning {
  background: rgba(255, 251, 235, 0.92);
}

.tone-danger {
  background: rgba(254, 242, 242, 0.92);
}

.tone-info {
  background: rgba(239, 246, 255, 0.9);
}
</style>
