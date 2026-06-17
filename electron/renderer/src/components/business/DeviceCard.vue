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
  position: relative;
  width: 100%;
  min-height: 178px;
  padding: 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 251, 250, 0.96)),
    rgba(251, 251, 250, 0.88);
  text-align: left;
  display: grid;
  gap: var(--ui-space-8);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.device-card:hover {
  border-color: rgba(0, 127, 109, 0.28);
  background: var(--ui-surface);
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.07);
  transform: translateY(-1px);
}

.device-card__head,
.device-card__meta,
.device-card__next {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.device-card__head {
  align-items: center;
  justify-content: space-between;
}

.device-card__asset {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 760;
}

.device-card strong {
  color: var(--ui-text);
  font-size: 15px;
  letter-spacing: 0;
}

.device-card__meta,
.device-card__next,
.device-card p {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.device-card__next span {
  min-width: 0;
  max-width: 100%;
  padding: 6px 8px;
  border-radius: 7px;
  background: var(--ui-surface-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-card p {
  margin: 0;
  padding: 8px 9px;
  border-radius: var(--radius-8);
  background: rgba(254, 242, 242, 0.72);
  color: var(--color-danger);
  font-weight: 720;
}
</style>
