<template>
  <span
    class="base-badge"
    :class="[`base-badge--${resolvedTone}`, `base-badge--${size}`, { 'base-badge--with-dot': dot }]"
    :style="badgeStyle"
  >
    <span v-if="dot" class="base-badge__dot" aria-hidden="true"></span>
    <slot>{{ resolvedLabel }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tone: {
    type: String,
    default: 'neutral',
    validator: (v) => ['success', 'warning', 'danger', 'info', 'neutral'].includes(v),
  },
  variant: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
  dot: { type: Boolean, default: false },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md'].includes(v),
  },
})

const STATUS_MAP = {
  'pending-shipping': { label: '待发货', tone: 'info', color: 'var(--status-order-pending-shipping)' },
  pending_shipping: { label: '待发货', tone: 'info', color: 'var(--status-order-pending-shipping)' },
  in_use: { label: '进行中', tone: 'info', color: 'var(--status-order-in-use)' },
  'in-use': { label: '进行中', tone: 'info', color: 'var(--status-order-in-use)' },
  pending_return: { label: '待归还', tone: 'warning', color: 'var(--status-order-pending-return)' },
  'pending-return': { label: '待归还', tone: 'warning', color: 'var(--status-order-pending-return)' },
  overdue: { label: '逾期', tone: 'danger', color: 'var(--status-order-overdue)' },
  completed: { label: '已完结', tone: 'neutral', color: 'var(--status-order-completed)' },
  available: { label: '可安排', tone: 'success', color: 'var(--status-schedule-available)' },
  occupied: { label: '已占用', tone: 'info', color: 'var(--status-schedule-occupied)' },
  conflict: { label: '冲突', tone: 'danger', color: 'var(--status-schedule-conflict)' },
  maintenance: { label: '维修中', tone: 'warning', color: 'var(--status-device-maintenance)' },
  rented: { label: '已出租', tone: 'info', color: 'var(--status-device-rented)' },
  exception: { label: '异常', tone: 'danger', color: 'var(--status-device-exception)' },
  pending: { label: '待处理', tone: 'info', color: 'var(--status-deposit-pending)' },
  approved: { label: '已通过', tone: 'success', color: 'var(--status-deposit-approved)' },
  rejected: { label: '已拒绝', tone: 'danger', color: 'var(--status-deposit-rejected)' },
  in_transit: { label: '运输中', tone: 'info', color: 'var(--status-shipping-in-transit)' },
  'in-transit': { label: '运输中', tone: 'info', color: 'var(--status-shipping-in-transit)' },
  signed: { label: '已签收', tone: 'success', color: 'var(--status-shipping-signed)' },
}

const statusMeta = computed(() => STATUS_MAP[props.status] || STATUS_MAP[props.variant] || null)
const resolvedTone = computed(() => statusMeta.value?.tone || props.variant || props.tone || 'neutral')
const resolvedLabel = computed(() => props.label || statusMeta.value?.label || '')
const badgeStyle = computed(() => {
  if (!statusMeta.value?.color) return null
  return { '--badge-status-color': statusMeta.value.color }
})
</script>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-token-4, 4px);
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  border: 1px solid transparent;
}

.base-badge--sm {
  height: 20px;
  padding: 0 7px;
  font-size: 11px;
}

.base-badge--success {
  background: var(--color-success-soft, #f0fdf4);
  color: var(--color-success, #16a34a);
  border-color: var(--color-success-border, #bbf7d0);
}
.base-badge--warning {
  background: var(--color-warning-soft, #fffbeb);
  color: var(--color-warning, #d97706);
  border-color: var(--color-warning-border, #fed7aa);
}
.base-badge--danger {
  background: var(--color-danger-soft, #fef2f2);
  color: var(--color-danger, #dc2626);
  border-color: var(--color-danger-border, #fecaca);
}
.base-badge--info {
  background: var(--color-info-soft, #eff6ff);
  color: var(--color-info, #2563eb);
  border-color: var(--color-info-border, #bfdbfe);
}
.base-badge--neutral {
  background: var(--color-neutral-soft, #f3f4f6);
  color: var(--color-neutral, #6b7280);
  border-color: var(--color-neutral-border, #e5e7eb);
}

.base-badge[style*="--badge-status-color"] {
  color: var(--badge-status-color);
}

.base-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: currentColor;
}
</style>
