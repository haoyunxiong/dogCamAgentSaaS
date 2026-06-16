<template>
  <button class="settings-card" type="button" @click="$emit('click')">
    <div class="settings-card__copy">
      <span v-if="group">{{ group }}</span>
      <strong>{{ title }}</strong>
      <p v-if="desc">{{ desc }}</p>
    </div>
    <StatusBadge :label="status" :variant="variant" size="sm" />
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
  min-height: 112px;
  padding: var(--ui-space-16);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-12);
  text-align: left;
  box-shadow: var(--shadow-subtle);
}

.settings-card:hover {
  border-color: var(--ui-border-strong);
}

.settings-card__copy {
  min-width: 0;
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
