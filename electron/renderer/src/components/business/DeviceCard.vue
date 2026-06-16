<template>
  <button class="device-card" type="button" @click="$emit('click', device)">
    <div class="device-card__head">
      <span class="device-card__asset">{{ device.assetNo || device.id }}</span>
      <StatusBadge :label="device.status" size="sm" />
    </div>

    <strong>{{ device.model || device.name }}</strong>

    <div class="device-card__meta">
      <span>{{ device.category }}</span>
      <span>{{ device.location }}</span>
      <span v-if="device.utilization !== undefined">利用率 {{ device.utilization }}%</span>
    </div>

    <div class="device-card__next">
      <span>当前订单：{{ device.currentOrderId || '无' }}</span>
      <span>下一预约：{{ device.nextBookingDate || '暂无' }}</span>
      <span v-if="revenueText">近30天收益：{{ revenueText }}</span>
    </div>

    <p v-if="device.conditionNote || device.alert">{{ device.conditionNote || device.alert }}</p>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import StatusBadge from '../StatusBadge.vue'

const props = defineProps({
  device: { type: Object, required: true },
})

defineEmits(['click'])

const revenueText = computed(() => {
  if (props.device.revenue30d !== undefined) return `¥${Number(props.device.revenue30d).toLocaleString()}`
  if (props.device.utilization !== undefined && props.device.assetNo) {
    return `¥${(Number(props.device.utilization) * 38 + String(props.device.assetNo).length * 12).toLocaleString()}`
  }
  return ''
})
</script>

<style scoped>
.device-card {
  width: 100%;
  padding: 13px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: rgba(251, 251, 250, 0.88);
  text-align: left;
  display: grid;
  gap: var(--ui-space-8);
}

.device-card:hover {
  border-color: var(--ui-border-strong);
  background: var(--ui-surface);
  box-shadow: var(--shadow-card);
}

.device-card__head,
.device-card__meta,
.device-card__next {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.device-card__head {
  align-items: center;
}

.device-card__asset {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 760;
}

.device-card strong {
  color: var(--ui-text);
  font-size: 14px;
}

.device-card__meta,
.device-card__next,
.device-card p {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.device-card__next span {
  min-width: 0;
  padding: 6px 7px;
  border-radius: 7px;
  background: var(--ui-surface-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-card p {
  margin: 0;
  color: var(--color-danger);
}
</style>
