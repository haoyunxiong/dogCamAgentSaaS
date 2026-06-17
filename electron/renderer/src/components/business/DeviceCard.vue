<template>
  <button class="device-card" type="button" @click="$emit('click', device)">
    <div class="device-card__image" aria-hidden="true">
      <span>{{ shortModel }}</span>
    </div>

    <div class="device-card__content">
      <div class="device-card__head">
        <strong>{{ device.model || device.name }}</strong>
        <StatusBadge :label="device.status" size="sm" />
      </div>

      <div class="device-card__meta">
        <span>编号：{{ device.serialNo || device.assetNo || device.id }}</span>
        <span>所属门店：{{ device.location }}</span>
        <span v-if="device.currentOrderId">当前租期：{{ device.nextBookingDate }}</span>
        <span v-else>状态：{{ device.status }}</span>
      </div>

      <div class="device-card__foot">
        <span v-if="device.currentOrderId">订单：{{ device.currentOrderId }}</span>
        <span v-else>可直接安排</span>
        <b>查看详情 ›</b>
      </div>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import StatusBadge from '../StatusBadge.vue'

const props = defineProps({
  device: { type: Object, required: true },
})

defineEmits(['click'])

const shortModel = computed(() => {
  const model = props.device.model || props.device.name || ''
  if (model.includes('Pocket')) return 'DJI'
  if (model.includes('Canon')) return 'R5'
  if (model.includes('Sony')) return 'A7'
  if (model.includes('富士')) return 'FX'
  return 'CAM'
})
</script>

<style scoped>
.device-card {
  position: relative;
  width: 100%;
  min-height: 154px;
  padding: 14px;
  border: 1px solid #e7edf2;
  border-radius: 16px;
  background: var(--ui-surface);
  text-align: left;
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr);
  gap: 14px;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(16, 24, 40, 0.045);
}

.device-card:hover {
  border-color: rgba(0, 127, 109, 0.28);
  background: var(--ui-surface);
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.07);
  transform: translateY(-1px);
}

.device-card__image {
  min-height: 126px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(180deg, #f4f6f8, #eceff3);
  border: 1px solid #edf1f5;
}

.device-card__image span {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: var(--ui-brand);
  background: #fff;
  font-size: 16px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.08);
}

.device-card__content {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 9px;
}

.device-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.device-card strong {
  color: var(--ui-text);
  font-size: 16px;
  letter-spacing: 0;
}

.device-card__meta {
  display: grid;
  gap: 5px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.device-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.device-card__foot b {
  color: var(--ui-brand);
  font-weight: 850;
}
</style>
