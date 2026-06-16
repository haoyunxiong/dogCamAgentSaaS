<template>
  <header class="mobile-app-bar">
    <div class="app-bar-main">
      <span class="app-bar-kicker">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="app-bar-actions">
      <slot name="actions">
        <StatusTag v-if="statusLabel" :label="statusLabel" :tone="statusTone" />
      </slot>
    </div>
  </header>
</template>

<script setup>
import StatusTag from './StatusTag.vue'

defineProps({
  eyebrow: { type: String, default: '小狗相机助手' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  statusLabel: { type: String, default: '' },
  statusTone: { type: String, default: 'info' }
})
</script>

<style scoped>
.mobile-app-bar {
  min-height: 78px;
  padding: var(--space-14, 14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-16);
  background:
    linear-gradient(135deg, var(--surface), var(--surface-soft));
  box-shadow: var(--shadow-subtle);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12);
}

.app-bar-main {
  min-width: 0;
}

.app-bar-kicker {
  display: block;
  color: var(--brand);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
  font-weight: 780;
}

h1 {
  margin: var(--space-4) 0 0;
  color: var(--text);
  font-size: var(--font-mobile-nav-title-size);
  line-height: var(--font-mobile-nav-title-line);
  font-weight: 780;
}

p {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
}

.app-bar-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-8);
}
</style>
