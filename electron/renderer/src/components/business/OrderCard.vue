<template>
  <button class="order-card" type="button" @click="$emit('click', order)">
    <div class="order-card__head">
      <strong>{{ order.customerName || order.customer || '未知客户' }}</strong>
      <StatusBadge :label="order.status" size="sm" />
    </div>

    <div class="order-card__meta">
      <span>{{ order.orderNo || order.id }}</span>
      <span>{{ order.channel }}</span>
      <span>{{ order.rentStart }} 至 {{ order.rentEnd }}</span>
    </div>

    <div class="order-card__model">{{ order.model || order.deviceName }}</div>

    <div class="order-card__foot">
      <StatusBadge :label="order.depositStatus" size="sm" />
      <span>{{ order.shippingStatus }}</span>
      <b>{{ order.nextAction }}</b>
    </div>
  </button>
</template>

<script setup>
import StatusBadge from '../StatusBadge.vue'

defineProps({
  order: { type: Object, required: true },
})

defineEmits(['click'])
</script>

<style scoped>
.order-card {
  width: 100%;
  padding: var(--ui-space-12);
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  text-align: left;
  display: grid;
  gap: var(--ui-space-8);
}

.order-card:hover {
  border-color: var(--ui-border-strong);
  box-shadow: var(--shadow-card);
}

.order-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-8);
}

.order-card__head strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text);
  font-size: 15px;
}

.order-card__meta,
.order-card__foot {
  display: flex;
  align-items: center;
  gap: var(--ui-space-8);
  flex-wrap: wrap;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.order-card__model {
  color: var(--ui-text);
  font-weight: 720;
}

.order-card__foot b {
  margin-left: auto;
  color: var(--ui-brand);
  font-size: 12px;
}
</style>
