<template>
  <button class="settings-card" type="button" @click="$emit('click')">
    <div>
      <span>{{ group }}</span>
      <strong>{{ title }}</strong>
      <p>{{ desc }}</p>
    </div>
    <StatusTag :label="status" :tone="tone" />
  </button>
</template>

<script setup>
import StatusTag from './StatusTag.vue'

defineProps({
  group: { type: String, default: '' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  status: { type: String, default: '未配置' },
  tone: { type: String, default: 'neutral' }
})

defineEmits(['click'])
</script>

<style scoped>
.settings-card {
  width: 100%;
  min-height: 112px;
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  text-align: left;
  box-shadow: var(--shadow-subtle);
}

.settings-card:hover {
  border-color: var(--border-strong);
}

span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

strong {
  display: block;
  margin-top: var(--space-4);
  color: var(--text);
  font-size: 16px;
}

p {
  margin: var(--space-8) 0 0;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
