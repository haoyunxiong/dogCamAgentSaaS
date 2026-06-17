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
  border-radius: var(--radius-16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 252, 251, 0.98)),
    var(--ui-surface);
  display: flex;
  justify-content: space-between;
  gap: var(--ui-space-12);
  text-align: left;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.settings-card:hover {
  border-color: rgba(0, 127, 109, 0.28);
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.06);
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
