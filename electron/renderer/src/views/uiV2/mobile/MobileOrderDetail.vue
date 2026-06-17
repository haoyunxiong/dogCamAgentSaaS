<template>
  <MobileShell :show-nav="false">
    <div v-if="order" class="detail-page">
      <header class="detail-top">
        <RouterLink to="/ui-v2/mobile/orders">返回</RouterLink>
        <span>订单详情</span>
      </header>
      <section class="status-head">
        <div class="ui-v2-row-between">
          <StatusBadge :label="order.status" size="sm" />
          <span>{{ order.orderNo }}</span>
        </div>
        <h1>{{ order.nextAction }}</h1>
        <p>{{ order.channel }} · {{ order.model }}</p>
      </section>
      <section class="ui-v2-mobile-card">
        <div class="ui-v2-row-between">
          <h2>履约对象</h2>
          <StatusBadge :label="order.riskLevel" size="sm" />
        </div>
        <div class="info-row"><span>客户</span><strong>{{ order.customerName }} · {{ order.phoneMasked }}</strong></div>
        <div class="info-row"><span>地址</span><strong>{{ order.address }}</strong></div>
      </section>
      <section class="ui-v2-mobile-card">
        <h2>租期与费用</h2>
        <div class="info-row"><span>租期</span><strong>{{ order.rentStart }} 至 {{ order.rentEnd }}</strong></div>
        <div class="info-row"><span>租金</span><strong>¥{{ order.rentAmount }}</strong></div>
        <div class="info-row"><span>押金/免押</span><strong>{{ order.depositStatus }} · ¥{{ order.depositAmount }}</strong></div>
      </section>
      <DeviceCard v-if="device" :device="device" />
      <section class="ui-v2-mobile-card">
        <h2>物流状态</h2>
        <div class="info-row"><span>顺丰</span><strong>{{ order.shippingStatus }}</strong></div>
        <TrackingTimeline :steps="shippingSteps" />
      </section>
      <div class="fixed-actions">
        <BaseButton variant="secondary">标记异常</BaseButton>
        <BaseButton @click="clicked = true">{{ clicked ? '已处理 mock 状态' : order.nextAction }}</BaseButton>
      </div>
    </div>
    <EmptyState v-else title="未找到订单" hint="请返回订单中心重新选择订单。" />
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import EmptyState from '../../../components/EmptyState.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DeviceCard } from '../../../components/business'
import { MobileShell } from '../../../components/mobile'
import { TrackingTimeline } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const route = useRoute()
const clicked = ref(false)
const order = computed(() => uiV2MockAdapter.getOrder(route.params.id))
const device = computed(() => order.value ? uiV2MockAdapter.getDevice(order.value.deviceIds[0]) : null)
const shippingSteps = computed(() => {
  const waybill = uiV2MockAdapter.getWaybills().find((item) => item.orderId === order.value?.orderNo)
  return waybill?.timeline || [{ label: '确认信息', done: true }, { label: '生成运单', current: true }]
})
</script>

<style scoped>
.detail-page {
  display: grid;
  gap: var(--space-12);
  padding-bottom: 76px;
}
.detail-top {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}
.detail-top a {
  color: var(--ui-brand);
  font-size: 13px;
  font-weight: 760;
}
.detail-top span {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 700;
}
.status-head {
  padding: 17px;
  border-radius: var(--radius-16);
  background:
    linear-gradient(135deg, #06211f, #0b3832),
    var(--color-primary-900);
  color: #fff;
  box-shadow: 0 12px 24px rgba(6, 33, 31, 0.16);
}
.status-head h1 {
  margin: var(--space-16) 0 var(--space-token-4);
  font-size: 24px;
  line-height: 30px;
}
.status-head p,
.status-head span {
  color: #c9deda;
}
.info-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  padding: 9px 0;
  border-top: 1px solid rgba(229, 235, 232, 0.68);
  color: var(--ui-text-muted);
  font-size: 13px;
}
.info-row:first-of-type { border-top: 0; }
.info-row strong {
  color: var(--ui-text);
  text-align: right;
}
.fixed-actions {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: min(430px, 100vw);
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: var(--space-token-8);
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--ui-border);
  box-shadow: 0 -10px 26px rgba(16, 24, 40, 0.07);
  z-index: 35;
}
</style>
