<template>
  <button class="settings-card" type="button" @click="$emit('click')">
    <span class="settings-card__icon">{{ title.slice(0, 1) }}</span>
    <div class="settings-card__copy">
      <span v-if="group">{{ group }}</span>
      <strong>{{ title }}</strong>
      <p v-if="desc">{{ desc }}</p>
    </div>
    <StatusBadge class="settings-card__status" :label="status" :variant="variant" size="sm" />
  </button>
</template>

<script setup>
import StatusBadge from '../StatusBadge.vue'

defineProps({
  group: { type: String, default: '' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  status: { type: String, default: '未配置' },
  variant: { type: String, default: 'neutral' },
})

defineEmits(['click'])
</script>

<style scoped>
.settings-card {
  width: 100%;
  min-height: 132px;
  padding: 18px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-surface);
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 14px;
  text-align: left;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.settings-card__icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: var(--ui-brand);
  background: var(--ui-brand-soft);
  font-size: 16px;
  font-weight: 900;
}

.settings-card:hover {
  border-color: rgba(0, 127, 109, 0.28);
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.06);
}

.settings-card__copy {
  min-width: 0;
}

.settings-card__status {
  align-self: start;
}

.settings-card span {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.settings-card strong {
  display: block;
  margin-top: var(--ui-space-4);
  color: var(--ui-text);
  font-size: 16px;
}

.settings-card p {
  margin: var(--ui-space-8) 0 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 1.5;
}
</style>
