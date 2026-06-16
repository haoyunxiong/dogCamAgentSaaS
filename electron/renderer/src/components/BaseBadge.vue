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
  '待确认': { label: '待确认', tone: 'warning', color: 'var(--status-order-pending-shipping)' },
  '待押金': { label: '待押金', tone: 'warning', color: 'var(--status-deposit-pending)' },
  '待分配设备': { label: '待分配设备', tone: 'info', color: 'var(--status-order-in-use)' },
  '待发货': { label: '待发货', tone: 'warning', color: 'var(--status-order-pending-shipping)' },
  '租赁中': { label: '租赁中', tone: 'info', color: 'var(--status-order-in-use)' },
  '待归还': { label: '待归还', tone: 'warning', color: 'var(--status-order-pending-return)' },
  '待验机': { label: '待验机', tone: 'warning', color: 'var(--status-device-maintenance)' },
  '已完成': { label: '已完成', tone: 'neutral', color: 'var(--status-order-completed)' },
  '异常': { label: '异常', tone: 'danger', color: 'var(--status-device-exception)' },
  '正常': { label: '正常', tone: 'success', color: 'var(--status-device-available)' },
  '低': { label: '低', tone: 'success', color: 'var(--status-device-available)' },
  '中': { label: '中', tone: 'warning', color: 'var(--status-order-pending-shipping)' },
  '高': { label: '高', tone: 'danger', color: 'var(--status-order-overdue)' },
  '可租': { label: '可租', tone: 'success', color: 'var(--status-schedule-available)' },
  '占用': { label: '占用', tone: 'info', color: 'var(--status-schedule-occupied)' },
  '冲突': { label: '冲突', tone: 'danger', color: 'var(--status-schedule-conflict)' },
  '维修': { label: '维修', tone: 'warning', color: 'var(--status-device-maintenance)' },
  '维修中': { label: '维修中', tone: 'warning', color: 'var(--status-device-maintenance)' },
  '待收': { label: '待收', tone: 'warning', color: 'var(--status-deposit-pending)' },
  '已收': { label: '已收', tone: 'success', color: 'var(--status-deposit-approved)' },
  '免押审核中': { label: '免押审核中', tone: 'warning', color: 'var(--status-deposit-pending)' },
  '免押通过': { label: '免押通过', tone: 'success', color: 'var(--status-deposit-approved)' },
  '免押失败': { label: '免押失败', tone: 'danger', color: 'var(--status-deposit-rejected)' },
  '需人工复核': { label: '需人工复核', tone: 'warning', color: 'var(--status-deposit-exception)' },
  '待下单': { label: '待下单', tone: 'warning', color: 'var(--status-shipping-pending)' },
  '待揽收': { label: '待揽收', tone: 'warning', color: 'var(--status-shipping-pickup)' },
  '运输中': { label: '运输中', tone: 'info', color: 'var(--status-shipping-in-transit)' },
  '已签收': { label: '已签收', tone: 'success', color: 'var(--status-shipping-signed)' },
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
