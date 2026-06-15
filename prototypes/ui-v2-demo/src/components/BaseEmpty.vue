<template>
  <div class="base-empty">
    <div class="empty-icon" aria-hidden="true">{{ icon }}</div>
    <strong>{{ title }}</strong>
    <p v-if="description">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '—' },
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' }
})
</script>

<style scoped>
.base-empty {
  min-height: 168px;
  padding: var(--space-24);
  border: 1px dashed var(--border);
  border-radius: var(--radius-12);
  background: var(--surface-soft);
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--space-8);
  color: var(--text-muted);
  text-align: center;
}

.empty-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-8);
  background: var(--surface);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
  color: var(--brand);
  font-weight: 800;
}

strong {
  color: var(--text);
  font-size: 14px;
}

p {
  max-width: 320px;
  margin: 0;
  font-size: 13px;
}
</style>
