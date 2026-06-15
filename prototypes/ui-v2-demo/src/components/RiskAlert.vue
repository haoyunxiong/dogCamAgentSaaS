<template>
  <article :class="['risk-alert', `level-${risk.level}`]">
    <div class="risk-head">
      <BaseBadge :label="risk.type" :tone="risk.level === 'high' ? 'danger' : 'warning'" />
      <span>{{ risk.relatedOrderId }}</span>
    </div>
    <h3>{{ risk.title }}</h3>
    <p>{{ risk.description }}</p>
    <button type="button" @click="$emit('action', risk)">{{ risk.suggestedAction }}</button>
  </article>
</template>

<script setup>
import BaseBadge from './BaseBadge.vue'

defineProps({
  risk: { type: Object, required: true }
})

defineEmits(['action'])
</script>

<style scoped>
.risk-alert {
  padding: 12px 12px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(251, 251, 250, 0.92);
  position: relative;
  overflow: hidden;
}

.risk-alert::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--warning);
}

.level-high {
  border-color: #f0b8b8;
  background: linear-gradient(90deg, rgba(248, 232, 229, 0.76), rgba(251, 251, 250, 0.96) 44%);
}

.level-high::before {
  background: var(--danger);
}

.level-medium {
  border-color: #efd49e;
  background: linear-gradient(90deg, rgba(247, 237, 216, 0.72), rgba(251, 251, 250, 0.96) 44%);
}

.risk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

h3 {
  margin: 10px 0 4px;
  font-size: 14px;
}

p {
  margin: 0;
  color: var(--text-soft);
  font-size: 12px;
}

button {
  margin-top: 10px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  font-size: 12px;
  font-weight: 720;
}
</style>
