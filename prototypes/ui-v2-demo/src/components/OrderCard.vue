<template>
  <button class="order-card" type="button" @click="$emit('click', order)">
    <div class="row-between">
      <strong>{{ order.customerName }}</strong>
      <StatusTag :label="order.status" />
    </div>
    <div class="order-meta">
      <span>{{ order.orderNo }}</span>
      <span>{{ order.channel }}</span>
      <span>{{ order.rentStart }} 至 {{ order.rentEnd }}</span>
    </div>
    <div class="order-model">{{ order.model }}</div>
    <div class="order-foot">
      <StatusTag :label="order.depositStatus" />
      <span>{{ order.shippingStatus }}</span>
      <b>{{ order.nextAction }}</b>
    </div>
  </button>
</template>

<script setup>
import StatusTag from './StatusTag.vue'

defineProps({
  order: { type: Object, required: true }
})

defineEmits(['click'])
</script>

<style scoped>
.order-card {
  width: 100%;
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  text-align: left;
  display: grid;
  gap: var(--space-8);
}

.order-card:hover {
  border-color: var(--border-strong);
  background: var(--surface);
  box-shadow: var(--shadow-pop);
}

strong {
  font-size: 15px;
}

.order-meta,
.order-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 12px;
}

.order-model {
  color: var(--text);
  font-weight: 720;
}

.order-foot b {
  margin-left: auto;
  color: var(--brand);
  font-size: 12px;
}
</style>
