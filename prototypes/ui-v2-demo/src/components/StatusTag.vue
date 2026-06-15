<template>
  <span :class="['status-tag', `tone-${resolvedTone}`]">
    <span class="status-dot" aria-hidden="true" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  tone: { type: String, default: 'neutral' }
})

const toneMap = {
  待确认: 'neutral',
  待押金: 'warning',
  待分配设备: 'info',
  待发货: 'warning',
  租赁中: 'info',
  待归还: 'warning',
  待验机: 'info',
  已完成: 'success',
  异常: 'danger',
  正常: 'success',
  低: 'info',
  中: 'warning',
  高: 'danger',
  可租: 'success',
  可安排: 'success',
  满租: 'danger',
  余量不足: 'warning',
  已预订: 'info',
  占用: 'info',
  冲突: 'danger',
  维修: 'warning',
  维修中: 'warning',
  在租: 'info',
  待清洁: 'warning',
  停用: 'neutral',
  待收: 'warning',
  已收: 'success',
  免押审核中: 'warning',
  免押通过: 'success',
  免押失败: 'danger',
  待审核: 'warning',
  已通过: 'success',
  已拒绝: 'danger',
  待复核: 'warning',
  低风险: 'info',
  中风险: 'warning',
  高风险: 'danger',
  已配置: 'success',
  未配置: 'neutral',
  需处理: 'warning',
  已启用: 'success',
  已停用: 'neutral',
  需人工复核: 'warning',
  待下单: 'neutral',
  待揽收: 'warning',
  运输中: 'info',
  已签收: 'success',
  已发货: 'info'
}

const resolvedTone = computed(() => toneMap[props.label] || props.tone)
</script>

<style scoped>
.status-tag {
  min-height: 24px;
  padding: 2px 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
  font-weight: 700;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: currentColor;
}

.tone-neutral {
  background: var(--neutral-soft);
  color: var(--text-soft);
  border-color: var(--border);
}

.tone-success {
  background: var(--success-soft);
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 20%, white);
}

.tone-warning {
  background: var(--warning-soft);
  color: #b45309;
  border-color: color-mix(in srgb, var(--warning) 24%, white);
}

.tone-danger {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 18%, white);
}

.tone-info {
  background: var(--info-soft);
  color: var(--info);
  border-color: color-mix(in srgb, var(--info) 18%, white);
}
</style>
