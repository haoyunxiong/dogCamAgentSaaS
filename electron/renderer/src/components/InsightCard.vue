<template>
  <article class="insight-card" :class="tone ? `tone-${tone}` : ''">
    <div class="insight-card__head">
      <span class="insight-card__title">{{ title }}</span>
      <span v-if="badge" class="insight-card__badge">{{ badge }}</span>
    </div>
    <strong class="insight-card__value">{{ value }}</strong>
    <p v-if="hint" class="insight-card__hint">{{ hint }}</p>
    <slot />
  </article>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  hint: { type: String, default: '' },
  badge: { type: String, default: '' },
  tone: { type: String, default: '' },
})
</script>

<style scoped>
.insight-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 12px;
  background: #fff;
}

.insight-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.insight-card__title,
.insight-card__hint {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.insight-card__value {
  font-size: 24px;
  line-height: 1.1;
  color: var(--text-primary, #111827);
}

.insight-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 11px;
  font-weight: 700;
}

.tone-success {
  background: rgba(240, 253, 244, 0.88);
}

.tone-warning {
  background: rgba(255, 251, 235, 0.9);
}

.tone-info {
  background: rgba(239, 246, 255, 0.9);
}

.tone-danger {
  background: rgba(254, 242, 242, 0.9);
}
</style>
