<template>
  <header class="mobile-app-bar">
    <div class="mobile-app-bar__main">
      <span v-if="eyebrow" class="mobile-app-bar__eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="mobile-app-bar__actions">
      <slot name="actions">
        <StatusBadge v-if="statusLabel" :label="statusLabel" :variant="statusVariant" size="sm" />
      </slot>
    </div>
  </header>
</template>

<script setup>
import StatusBadge from '../StatusBadge.vue'

defineProps({
  eyebrow: { type: String, default: '小狗相机助手' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  statusLabel: { type: String, default: '' },
  statusVariant: { type: String, default: 'info' },
})
</script>

<style scoped>
.mobile-app-bar {
  min-height: 86px;
  padding: 15px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-16);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(240, 248, 246, 0.94)),
    var(--ui-surface);
  box-shadow: 0 8px 20px rgba(16, 24, 40, 0.055);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-12);
}

.mobile-app-bar__main {
  min-width: 0;
}

.mobile-app-bar__eyebrow {
  display: block;
  color: var(--ui-brand);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
  font-weight: 820;
}

.mobile-app-bar h1 {
  margin: var(--ui-space-4) 0 0;
  color: var(--ui-text);
  font-size: 21px;
  line-height: var(--font-mobile-nav-title-line);
  font-weight: 820;
  letter-spacing: 0;
}

.mobile-app-bar p {
  margin: 2px 0 0;
  color: var(--ui-text-muted);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
}

.mobile-app-bar__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--ui-space-8);
}
</style>
