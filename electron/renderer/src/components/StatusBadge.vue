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
  '待确认': { label: '待确认', variant: 'warning' },
  '待押金': { label: '待押金', variant: 'warning' },
  '待分配设备': { label: '待分配设备', variant: 'info' },
  '待发货': { label: '待发货', variant: 'warning' },
  '租赁中': { label: '租赁中', variant: 'info' },
  '待归还': { label: '待归还', variant: 'warning' },
  '待验机': { label: '待验机', variant: 'warning' },
  '已完成': { label: '已完成', variant: 'neutral' },
  '异常': { label: '异常', variant: 'danger' },
  '正常': { label: '正常', variant: 'success' },
  '低': { label: '低', variant: 'success' },
  '中': { label: '中', variant: 'warning' },
  '高': { label: '高', variant: 'danger' },
  '可租': { label: '可租', variant: 'success' },
  '占用': { label: '占用', variant: 'info' },
  '冲突': { label: '冲突', variant: 'danger' },
  '维修': { label: '维修', variant: 'warning' },
  '维修中': { label: '维修中', variant: 'warning' },
  '待收': { label: '待收', variant: 'warning' },
  '已收': { label: '已收', variant: 'success' },
  '免押审核中': { label: '免押审核中', variant: 'warning' },
  '免押通过': { label: '免押通过', variant: 'success' },
  '免押失败': { label: '免押失败', variant: 'danger' },
  '需人工复核': { label: '需人工复核', variant: 'warning' },
  '待下单': { label: '待下单', variant: 'warning' },
  '待揽收': { label: '待揽收', variant: 'warning' },
  '运输中': { label: '运输中', variant: 'info' },
  '已签收': { label: '已签收', variant: 'success' },
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
  gap: 6px;
  border-radius: 999px;
  font-weight: 760;
  white-space: nowrap;
  border: 1px solid transparent;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.32);
}

.status-badge.with-dot {
  padding-left: 10px;
}

.size-sm {
  min-height: 23px;
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
  background: #fff7ed;
  color: var(--color-warning, #d97706);
  border-color: var(--color-warning-border, #fed7aa);
}

.variant-info {
  background: #ecf7ff;
  color: #256b9e;
  border-color: #b7def5;
}

.variant-success {
  background: #eefaf4;
  color: #0f7a4e;
  border-color: #b7e4ca;
}

.variant-danger {
  background: #fff1f2;
  color: #be123c;
  border-color: #fecdd3;
}

.variant-neutral {
  background: #f5f7f8;
  color: #667085;
  border-color: #e3e8ee;
}
</style>
