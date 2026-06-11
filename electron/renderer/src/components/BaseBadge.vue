<template>
  <span class="base-badge" :class="[`base-badge--${tone}`, { 'base-badge--dot': dot }]">
    <span v-if="dot" class="base-badge__dot" aria-hidden="true"></span>
    <slot />
  </span>
</template>

<script setup>
defineProps({
  tone: {
    type: String,
    default: 'neutral',
    validator: (v) => ['success', 'warning', 'danger', 'info', 'neutral'].includes(v),
  },
  dot: { type: Boolean, default: false },
})
</script>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.base-badge--success {
  background: var(--color-success-soft, #f0fdf4);
  color: var(--color-success, #16a34a);
  border: 1px solid var(--color-success-border, #bbf7d0);
}
.base-badge--warning {
  background: var(--color-warning-soft, #fffbeb);
  color: var(--color-warning, #d97706);
  border: 1px solid var(--color-warning-border, #fed7aa);
}
.base-badge--danger {
  background: var(--color-danger-soft, #fef2f2);
  color: var(--color-danger, #dc2626);
  border: 1px solid var(--color-danger-border, #fecaca);
}
.base-badge--info {
  background: var(--color-info-soft, #eff6ff);
  color: var(--color-info, #2563eb);
  border: 1px solid var(--color-info-border, #bfdbfe);
}
.base-badge--neutral {
  background: var(--color-neutral-soft, #f3f4f6);
  color: var(--color-neutral, #6b7280);
  border: 1px solid var(--color-neutral-border, #e5e7eb);
}

/* dot variant */
.base-badge--dot {
  width: 22px;
  height: 22px;
  padding: 0;
  justify-content: center;
  border: none;
  background: transparent;
}
.base-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.base-badge--success .base-badge__dot { background: var(--color-success, #16a34a); }
.base-badge--warning .base-badge__dot { background: var(--color-warning, #d97706); }
.base-badge--danger  .base-badge__dot { background: var(--color-danger, #dc2626); }
.base-badge--info    .base-badge__dot { background: var(--color-info, #2563eb); }
.base-badge--neutral .base-badge__dot { background: var(--color-neutral, #6b7280); }
</style>
