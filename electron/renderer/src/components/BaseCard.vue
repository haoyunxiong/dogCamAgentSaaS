<template>
  <section
    class="base-card"
    :class="[`base-card--${variant}`, { 'base-card--clickable': clickable }]"
    @click="clickable && $emit('click', $event)"
  >
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
    <div v-if="$slots.footer" class="base-card__footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'metric', 'list', 'action', 'warning'].includes(v),
  },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  padding: { type: String, default: '' },
  clickable: { type: Boolean, default: false },
})

defineEmits(['click'])
</script>

<style scoped>
.base-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-8, 8px);
  box-shadow: var(--shadow-none, none);
  overflow: hidden;
}

.base-card--metric {
  box-shadow: var(--shadow-subtle, 0 1px 2px rgba(16,24,40,0.04));
}

.base-card--list {
  border-radius: var(--radius-8, 8px);
  box-shadow: none;
}

.base-card--action {
  border-color: var(--brand-primary-border, rgba(0, 127, 109, 0.24));
  box-shadow: var(--shadow-subtle, 0 1px 2px rgba(16,24,40,0.04));
}

.base-card--warning {
  border-color: var(--color-warning-border, #fed7aa);
  background: var(--color-warning-soft, #fffbeb);
}

.base-card--clickable {
  cursor: pointer;
  transition: border-color var(--duration-fast, 100ms) var(--ease-standard, ease),
              box-shadow var(--duration-fast, 100ms) var(--ease-standard, ease);
}
.base-card--clickable:hover {
  border-color: var(--brand-primary-border, rgba(0, 127, 109, 0.24));
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16,24,40,0.04));
}

.base-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-12, 12px);
  padding: var(--space-16, 16px) var(--space-20, 20px) 0;
}
.base-card__header-left {
  min-width: 0;
}
.base-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #111827);
  line-height: 24px;
  margin: 0;
}
.base-card__subtitle {
  font-size: 13px;
  color: var(--color-text-muted, #6b7280);
  margin-top: 2px;
  line-height: 1.4;
}
.base-card__actions {
  display: flex;
  align-items: center;
  gap: var(--space-token-8, 8px);
  flex-shrink: 0;
}
.base-card__body {
  padding: var(--space-16, 16px) var(--space-20, 20px) var(--space-20, 20px);
}
.base-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-token-8, 8px);
  padding: var(--space-12, 12px) var(--space-20, 20px);
  border-top: 1px solid var(--color-border, #e5e7eb);
}
</style>
