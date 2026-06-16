<template>
  <span
    class="status-badge"
    :class="[variantClass, sizeClass, { 'with-dot': showDot }]"
  >
    <span v-if="showDot" class="status-badge__dot"></span>
    {{ resolvedLabel }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  running: { type: Boolean, default: null },
  label: { type: String, default: '' },
  variant: { type: String, default: 'neutral' },
  status: { type: String, default: '' },
  size: { type: String, default: 'md' },
  dot: { type: Boolean, default: false },
})

const STATUS_MAP = {
  pending_shipping: { label: '待发货', variant: 'info' },
  'pending-shipping': { label: '待发货', variant: 'info' },
  in_use: { label: '进行中', variant: 'info' },
  'in-use': { label: '进行中', variant: 'info' },
  pending_return: { label: '待归还', variant: 'warning' },
  'pending-return': { label: '待归还', variant: 'warning' },
  overdue: { label: '逾期', variant: 'danger' },
  completed: { label: '已完结', variant: 'neutral' },
  available: { label: '可安排', variant: 'success' },
  occupied: { label: '已占用', variant: 'info' },
  conflict: { label: '冲突', variant: 'danger' },
  maintenance: { label: '维修中', variant: 'warning' },
  rented: { label: '已出租', variant: 'info' },
  exception: { label: '异常', variant: 'danger' },
  pending: { label: '待处理', variant: 'info' },
  approved: { label: '已通过', variant: 'success' },
  rejected: { label: '已拒绝', variant: 'danger' },
  in_transit: { label: '运输中', variant: 'info' },
  'in-transit': { label: '运输中', variant: 'info' },
  signed: { label: '已签收', variant: 'success' },
}

const statusMeta = computed(() => STATUS_MAP[props.status] || STATUS_MAP[props.variant] || null)

const resolvedLabel = computed(() => {
  if (props.label) return props.label
  if (statusMeta.value?.label) return statusMeta.value.label
  if (props.running === true) return '运行中'
  if (props.running === false) return '已停止'
  return ''
})

const variantClass = computed(() => {
  if (props.running === true) return 'variant-success'
  if (props.running === false) return 'variant-danger'
  return `variant-${statusMeta.value?.variant || props.variant || 'neutral'}`
})

const sizeClass = computed(() => `size-${props.size || 'md'}`)
const showDot = computed(() => props.dot || props.running !== null)
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-token-8, 8px);
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid transparent;
}

.status-badge.with-dot {
  padding-left: 10px;
}

.size-sm {
  min-height: 22px;
  padding: 0 8px;
  font-size: 11px;
}

.size-md {
  min-height: 26px;
  padding: 0 10px;
  font-size: 12px;
}

.size-lg {
  min-height: 34px;
  padding: 0 14px;
  font-size: 13px;
}

.status-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.9;
}

.variant-warning {
  background: var(--color-warning-soft, #fffbeb);
  color: var(--color-warning, #d97706);
  border-color: var(--color-warning-border, #fed7aa);
}

.variant-info {
  background: var(--color-info-soft, #eff6ff);
  color: var(--color-info, #2563eb);
  border-color: var(--color-info-border, #bfdbfe);
}

.variant-success {
  background: var(--color-success-soft, #f0fdf4);
  color: var(--color-success, #16a34a);
  border-color: var(--color-success-border, #bbf7d0);
}

.variant-danger {
  background: var(--color-danger-soft, #fef2f2);
  color: var(--color-danger, #dc2626);
  border-color: var(--color-danger-border, #fecaca);
}

.variant-neutral {
  background: var(--color-neutral-soft, #f3f4f6);
  color: var(--color-neutral, #6b7280);
  border-color: var(--color-neutral-border, #e5e7eb);
}
</style>
