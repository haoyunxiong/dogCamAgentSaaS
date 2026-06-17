<template>
  <MobileShell>
    <div v-if="order" class="detail-page">
      <header class="detail-top">
        <RouterLink to="/ui-v2/mobile/orders">返回</RouterLink>
        <span>订单详情</span>
      </header>
      <section class="mobile-dark-hero detail-hero">
        <div class="ui-v2-row-between">
          <h1>{{ order.orderNo }}</h1>
          <StatusBadge :label="order.status" size="sm" />
        </div>
        <p>下单时间：2025-06-14 10:23:45　渠道：{{ order.channel }}</p>
        <div class="next-task">
          <div>
            <strong>下一步任务</strong>
            <span>请尽快{{ order.nextAction }}并填写物流单号</span>
          </div>
          <BaseButton size="sm">{{ order.nextAction }}</BaseButton>
        </div>
      </section>
      <section class="ui-v2-mobile-card">
        <div class="ui-v2-row-between">
          <h2>客户信息</h2>
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
      <section v-if="device" class="ui-v2-mobile-card device-line-card">
        <h2>设备清单（1）</h2>
        <div class="device-line">
          <span>{{ device.model.slice(0, 3) }}</span>
          <div><strong>{{ device.model }}</strong><small>{{ device.maintenanceStatus }} · {{ device.serialNo }}</small></div>
          <b>¥{{ order.rentAmount }} × 1</b>
        </div>
      </section>
      <section class="ui-v2-mobile-card">
        <h2>物流状态</h2>
        <div class="info-row"><span>顺丰</span><strong>{{ order.shippingStatus }}</strong></div>
        <TrackingTimeline :steps="shippingSteps" />
      </section>
      <div class="fixed-actions">
        <BaseButton variant="secondary">联系客户</BaseButton>
        <BaseButton variant="secondary">更多操作</BaseButton>
        <BaseButton @click="clicked = true">{{ clicked ? '已处理' : order.nextAction }}</BaseButton>
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
import { MobileShell } from '../../../components/mobile'
import { TrackingTimeline } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const route = useRoute()
const clicked = ref(false)
const order = computed(() => uiV2Adapter.getOrder(route.params.id))
const device = computed(() => order.value ? uiV2Adapter.getDevice(order.value.deviceIds[0]) : null)
const shippingSteps = computed(() => {
  const waybill = uiV2Adapter.getWaybills().find((item) => item.orderId === order.value?.orderNo)
  return waybill?.timeline || [{ label: '确认信息', done: true }, { label: '生成运单', current: true }]
})
</script>

<style scoped>
.detail-page {
  display: grid;
  gap: var(--space-12);
  padding-bottom: 148px;
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
.detail-hero h1 {
  font-size: 25px;
}
.detail-hero p {
  margin: 8px 0 0;
  color: rgba(236, 253, 245, 0.72);
  font-size: 12px;
}
.next-task {
  margin-top: 16px;
  padding: 13px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
}
.next-task strong,
.next-task span {
  display: block;
}
.next-task span {
  margin-top: 4px;
  color: rgba(236, 253, 245, 0.72);
  font-size: 12px;
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
  bottom: 78px;
  transform: translateX(-50%);
  width: min(430px, 100vw);
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
  display: grid;
  grid-template-columns: 1fr 1fr 1.25fr;
  gap: var(--space-token-8);
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--ui-border);
  box-shadow: 0 -10px 26px rgba(16, 24, 40, 0.07);
  z-index: 35;
}
.device-line {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}
.device-line > span {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f5f7;
  color: var(--ui-brand);
  font-weight: 900;
}
.device-line strong,
.device-line small {
  display: block;
}
.device-line small {
  margin-top: 4px;
  color: var(--ui-text-muted);
  font-size: 12px;
}
.device-line b {
  font-size: 13px;
}
</style>
