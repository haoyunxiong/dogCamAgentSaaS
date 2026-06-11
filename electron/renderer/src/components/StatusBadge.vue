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
  size: { type: String, default: 'md' },
  dot: { type: Boolean, default: false },
})

const resolvedLabel = computed(() => {
  if (props.label) return props.label
  if (props.running === true) return '运行中'
  if (props.running === false) return '已停止'
  return ''
})

const variantClass = computed(() => {
  if (props.running === true) return 'variant-success'
  if (props.running === false) return 'variant-danger'
  return `variant-${props.variant || 'neutral'}`
})

const sizeClass = computed(() => `size-${props.size || 'md'}`)
const showDot = computed(() => props.dot || props.running !== null)
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
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
  background: #fef3c7;
  color: #92400e;
}

.variant-info {
  background: #dbeafe;
  color: #1d4ed8;
}

.variant-success {
  background: #dcfce7;
  color: #166534;
}

.variant-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.variant-neutral {
  background: #f3f4f6;
  color: #6b7280;
}
</style>
