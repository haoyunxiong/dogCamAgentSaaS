<template>
  <div class="base-error">
    <div>
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
    <BaseButton v-if="actionLabel" variant="secondary" @click="$emit('retry')">{{ actionLabel }}</BaseButton>
  </div>
</template>

<script setup>
import BaseButton from './BaseButton.vue'

defineProps({
  title: { type: String, default: '加载失败' },
  description: { type: String, default: '请稍后重试。' },
  actionLabel: { type: String, default: '' }
})

defineEmits(['retry'])
</script>

<style scoped>
.base-error {
  padding: var(--space-16);
  border: 1px solid color-mix(in srgb, var(--danger) 20%, white);
  border-radius: var(--radius-12);
  background: var(--danger-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-16);
}

strong {
  color: var(--danger);
  font-size: 14px;
}

p {
  margin: var(--space-4) 0 0;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
