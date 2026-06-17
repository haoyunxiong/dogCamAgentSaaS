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
      <strong>{{ order.orderNo || order.id }}</strong>
      <StatusBadge :label="order.status" size="sm" />
    </div>

    <div class="order-card__core">
      <div class="order-card__customer">
        <span>客户</span>
        <strong>{{ order.customerName || order.customer || '未知客户' }}</strong>
        <small>{{ order.phoneMasked || order.channel }}</small>
      </div>
      <div class="order-card__thumb" aria-hidden="true">{{ modelIcon }}</div>
      <div class="order-card__amount">
        <span>¥{{ Number(order.rentAmount || 0).toLocaleString() }}</span>
        <small>押金 ¥{{ Number(order.depositAmount || 0).toLocaleString() }}</small>
      </div>
    </div>

    <div class="order-card__model">{{ order.model || order.deviceName }}</div>

    <div class="order-card__meta">
      <span>租期 {{ order.rentStart }} ~ {{ order.rentEnd }}</span>
      <span>渠道 {{ order.channel }}</span>
      <span>门店 深圳南山店</span>
    </div>

    <div class="order-card__foot">
      <span>下单时间：06-14 10:23</span>
      <b>{{ order.nextAction }}</b>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import StatusBadge from '../StatusBadge.vue'

const props = defineProps({
  order: { type: Object, required: true },
})

defineEmits(['click'])

const modelIcon = computed(() => {
  const model = props.order.model || props.order.deviceName || ''
  if (model.includes('CCD')) return 'CCD'
  if (model.includes('Pocket')) return 'DJI'
  return 'CAM'
})
</script>

<style scoped>
.order-card {
  position: relative;
  width: 100%;
  min-height: 188px;
  padding: 14px;
  border: 1px solid #e7edf2;
  border-radius: 16px;
  background: var(--ui-surface);
  text-align: left;
  display: grid;
  gap: 11px;
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
  color: var(--ui-brand);
  font-size: 14px;
  letter-spacing: 0;
}

.order-card__core {
  display: grid;
  grid-template-columns: 1fr 58px auto;
  gap: 12px;
  align-items: center;
}

.order-card__customer,
.order-card__amount {
  display: grid;
  gap: 3px;
}

.order-card__customer span,
.order-card__amount small,
.order-card__meta,
.order-card__foot {
  color: var(--ui-text-muted);
  font-size: 12px;
}

.order-card__customer strong,
.order-card__amount span {
  color: var(--ui-text);
  font-size: 15px;
  font-weight: 850;
}

.order-card__thumb {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f5f7;
  border: 1px solid #edf1f5;
  font-size: 26px;
}

.order-card__amount {
  justify-items: end;
  text-align: right;
}

.order-card__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid #edf1f5;
  border-bottom: 1px solid #edf1f5;
}

.order-card__meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-card__model {
  color: var(--ui-text);
  font-weight: 780;
}

.order-card__foot b {
  color: var(--ui-brand);
  font-size: 12px;
  font-weight: 820;
}
</style>
