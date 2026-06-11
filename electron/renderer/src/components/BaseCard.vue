<template>
  <section class="base-card" :class="{ 'base-card--clickable': clickable }" @click="clickable && $emit('click', $event)">
    <div v-if="title || subtitle || $slots['header-actions']" class="base-card__header">
      <div class="base-card__header-left">
        <h3 v-if="title" class="base-card__title">{{ title }}</h3>
        <p v-if="subtitle" class="base-card__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots['header-actions']" class="base-card__actions">
        <slot name="header-actions" />
      </div>
    </div>
    <div class="base-card__body" :style="{ padding: padding }">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  padding: { type: String, default: '' },
  clickable: { type: Boolean, default: false },
})

defineEmits(['click'])
</script>

<style scoped>
.base-card {
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16,24,40,0.04));
  overflow: hidden;
}

.base-card--clickable {
  cursor: pointer;
  transition: border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              box-shadow var(--duration-fast, 100ms) var(--ease-standard, ease);
}
.base-card--clickable:hover {
  border-color: var(--brand-primary-border, rgba(20,184,166,0.24));
  box-shadow: var(--shadow-popover, 0 12px 32px rgba(16,24,40,0.12));
}

.base-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 0;
}
.base-card__header-left {
  min-width: 0;
}
.base-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-strong, #17211d);
  line-height: 24px;
  margin: 0;
}
.base-card__subtitle {
  font-size: 13px;
  color: var(--text-muted, #6f8078);
  margin-top: 2px;
  line-height: 1.4;
}
.base-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.base-card__body {
  padding: 16px 20px 20px;
}
</style>
