<template>
  <header class="mobile-app-bar" :class="[`mobile-app-bar--${tone}`]">
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
  tone: {
    type: String,
    default: 'dark',
    validator: (v) => ['dark', 'light'].includes(v),
  },
})
</script>

<style scoped>
.mobile-app-bar {
  min-height: 94px;
  padding: 20px 16px 16px;
  border-radius: 0 0 18px 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(20, 184, 166, 0.18), transparent 34%),
    linear-gradient(135deg, #031614, #061f1d);
  box-shadow: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ui-space-12);
}

.mobile-app-bar--light {
  min-height: 76px;
  background: transparent;
  border-radius: 0;
  padding-bottom: 8px;
}

.mobile-app-bar__main {
  min-width: 0;
}

.mobile-app-bar__eyebrow {
  display: block;
  color: rgba(236, 253, 245, 0.74);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
  font-weight: 820;
}

.mobile-app-bar h1 {
  margin: var(--ui-space-4) 0 0;
  color: #fff;
  font-size: 24px;
  line-height: var(--font-mobile-nav-title-line);
  font-weight: 820;
  letter-spacing: 0;
}

.mobile-app-bar p {
  margin: 2px 0 0;
  color: rgba(236, 253, 245, 0.72);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
}

.mobile-app-bar--light .mobile-app-bar__eyebrow {
  display: none;
}

.mobile-app-bar--light h1 {
  color: var(--ui-text);
}

.mobile-app-bar--light p {
  color: var(--ui-text-muted);
}

.mobile-app-bar__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--ui-space-8);
}
</style>
