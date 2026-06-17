<template>
  <button
    class="order-card"
    type="button"
    data-testid="mobile-order-card"
    :data-order-no="order.orderNo || order.id"
    :aria-label="`查看订单 ${order.orderNo || order.id}`"
    @click="$emit('click', order)"
  >
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
  position: relative;
  width: 100%;
  min-height: 112px;
  padding: 13px 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 252, 251, 0.98)),
    var(--ui-surface);
  text-align: left;
  display: grid;
  gap: var(--ui-space-8);
  cursor: pointer;
  touch-action: manipulation;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.order-card:hover {
  border-color: rgba(0, 127, 109, 0.28);
  box-shadow: 0 8px 18px rgba(16, 24, 40, 0.07);
  transform: translateY(-1px);
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
  font-size: 15.5px;
  letter-spacing: 0;
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
  font-weight: 780;
}

.order-card__foot b {
  margin-left: auto;
  color: var(--ui-brand);
  font-size: 12px;
  font-weight: 820;
}
</style>
