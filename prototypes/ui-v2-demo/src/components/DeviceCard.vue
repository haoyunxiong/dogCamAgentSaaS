<template>
  <button class="device-card" type="button" @click="$emit('click', device)">
    <div class="device-head">
      <span class="asset">{{ device.assetNo }}</span>
      <BaseBadge :label="device.status" />
    </div>
    <strong>{{ device.model }}</strong>
    <div class="device-meta">
      <span>{{ device.category }}</span>
      <span>{{ device.location }}</span>
      <span>利用率 {{ device.utilization }}%</span>
    </div>
    <div class="device-next">
      <span>当前订单：{{ device.currentOrderId || '无' }}</span>
      <span>下一预约：{{ device.nextBookingDate }}</span>
      <span>近30天收益：¥{{ revenue }}</span>
    </div>
    <p v-if="device.conditionNote">{{ device.conditionNote }}</p>
  </button>
</template>

<script setup>
import BaseBadge from './BaseBadge.vue'
import { computed } from 'vue'

const props = defineProps({
  device: { type: Object, required: true }
})

defineEmits(['click'])

const revenue = computed(() => (props.device.utilization * 38 + props.device.assetNo.length * 12).toLocaleString())
</script>

<style scoped>
.device-card {
  width: 100%;
  padding: 13px 13px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(251, 251, 250, 0.88);
  text-align: left;
  display: grid;
  gap: 8px;
}

.device-card:hover {
  border-color: var(--border-strong);
  background: #fff;
  box-shadow: var(--shadow-pop);
}

.device-head,
.device-meta,
.device-next {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.device-head {
  justify-content: space-between;
}

.asset {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 760;
}

strong {
  color: var(--text);
  font-size: 14px;
}

.device-meta,
.device-next,
p {
  color: var(--text-muted);
  font-size: 12px;
}

.device-next span {
  padding: 6px 7px;
  border-radius: 7px;
  background: var(--surface-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

p {
  margin: 0;
  color: var(--danger);
}
</style>
