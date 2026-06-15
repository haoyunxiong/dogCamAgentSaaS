<template>
  <MobileShell>
    <div class="detail-page" v-if="order">
      <header class="detail-header">
        <RouterLink to="/mobile/orders">返回</RouterLink>
        <span>订单详情</span>
      </header>

      <section class="status-head">
        <div class="row-between">
          <StatusTag :label="order.status" />
          <span class="order-no">{{ order.orderNo }}</span>
        </div>
        <h1>{{ order.nextAction }}</h1>
        <p>{{ order.channel }} · {{ order.model }}</p>
      </section>

      <section class="info-block primary-info">
        <div class="row-between">
          <h2>履约对象</h2>
          <StatusTag :label="riskLabel(order.riskLevel)" :tone="riskTone(order.riskLevel)" />
        </div>
        <div class="customer-line">
          <strong>{{ order.customerName }}</strong>
          <span>{{ order.phoneMasked }}</span>
        </div>
        <p>{{ order.address }}</p>
      </section>

      <section class="info-block">
        <h2>租期与费用</h2>
        <div class="info-row"><span>租期</span><strong>{{ order.rentStart }} 至 {{ order.rentEnd }}</strong></div>
        <div class="info-row"><span>租金</span><strong>{{ order.rentAmount }} 元</strong></div>
        <div class="info-row">
          <span>押金</span>
          <strong><StatusTag :label="order.depositStatus" /> {{ order.depositAmount }} 元</strong>
        </div>
      </section>

      <DeviceCard v-if="device" :device="device" />

      <section class="info-block">
        <h2>物流状态</h2>
        <div class="info-row"><span>顺丰</span><strong><StatusTag :label="order.shippingStatus" /></strong></div>
        <ShippingSteps :steps="shippingSteps" />
      </section>

      <section class="info-block timeline">
        <h2>时间线</h2>
        <p v-for="item in timeline" :key="item">{{ item }}</p>
      </section>

      <div class="fixed-actions">
        <BaseButton variant="secondary">标记异常</BaseButton>
        <BaseButton @click="primaryClicked = true">{{ primaryClicked ? '已处理 mock 状态' : order.nextAction }}</BaseButton>
      </div>
    </div>
    <BaseEmpty v-else title="未找到订单" description="请返回订单中心重新选择订单。" />
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import MobileShell from '../../components/MobileShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseEmpty from '../../components/BaseEmpty.vue'
import StatusTag from '../../components/StatusTag.vue'
import DeviceCard from '../../components/DeviceCard.vue'
import ShippingSteps from '../../components/ShippingSteps.vue'
import { orders } from '../../mock/orders.js'
import { devices } from '../../mock/devices.js'
import { shipping } from '../../mock/shipping.js'

const route = useRoute()
const primaryClicked = ref(false)
const order = computed(() => orders.find((item) => item.orderNo === route.params.id))
const device = computed(() => order.value ? devices.find((item) => order.value.deviceIds.includes(item.id)) : null)
const shippingRecord = computed(() => order.value ? shipping.find((item) => item.orderId === order.value.orderNo) : null)
const shippingSteps = computed(() => shippingRecord.value?.steps || [
  { label: '确认信息', done: true },
  { label: '生成运单', done: false }
])
const timeline = ['订单创建', '确认租期', '押金/免押处理', '设备分配', '发货/归还跟进']

function riskLabel(level) {
  return { none: '正常', low: '低风险', medium: '中风险', high: '高风险' }[level] || '正常'
}

function riskTone(level) {
  return { none: 'success', low: 'info', medium: 'warning', high: 'danger' }[level] || 'success'
}
</script>

<style scoped>
.detail-page {
  display: grid;
  gap: var(--space-12);
  padding-bottom: 74px;
}

.detail-header {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-header a {
  color: var(--brand);
  font-size: 13px;
  font-weight: 760;
}

.detail-header span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.status-head {
  padding: var(--space-16);
  border-radius: var(--radius-16);
  background: var(--color-primary-900);
  color: #fff;
}

.status-head h1 {
  margin: var(--space-16) 0 var(--space-4);
  font-size: 24px;
  line-height: 30px;
}

.status-head p {
  margin: 0;
  color: #c9deda;
}

.order-no {
  color: #c9deda;
  font-size: 12px;
  font-weight: 700;
}

.info-block {
  padding: var(--space-14, 14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  display: grid;
  gap: var(--space-8);
}

.primary-info {
  background: #fff;
}

.customer-line {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
}

.customer-line strong {
  font-size: 18px;
}

.customer-line span,
.primary-info p {
  color: var(--text-muted);
}

.primary-info p {
  margin: 0;
}

.info-block h2 {
  margin: 0 0 2px;
  font-size: var(--font-mobile-card-title-size);
  line-height: var(--font-mobile-card-title-line);
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-12);
  color: var(--text-muted);
  font-size: 13px;
}

.info-row strong {
  color: var(--text);
  text-align: right;
}

.timeline p {
  margin: 0;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-soft);
}

.timeline p:last-child {
  border-bottom: 0;
}

.fixed-actions {
  position: fixed;
  left: 50%;
  bottom: 70px;
  transform: translateX(-50%);
  width: min(430px, 100vw);
  padding: var(--space-10, 10px) var(--space-14, 14px);
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: var(--space-8);
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--border);
  z-index: 35;
}
</style>
