<template>
  <MobileShell>
    <div v-if="loading" class="detail-page">
      <header class="detail-top">
        <RouterLink to="/ui-v2/mobile/orders">返回</RouterLink>
        <span>订单详情</span>
      </header>
      <div class="detail-adapter-state">订单详情读取中...</div>
    </div>
    <div v-else-if="order" class="detail-page">
      <header class="detail-top">
        <RouterLink to="/ui-v2/mobile/orders">返回</RouterLink>
        <span>订单详情</span>
      </header>
      <div class="detail-source-row">
        <span class="detail-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
        <span v-if="sourceMeta.fallbackReason" class="detail-source__reason">{{ sourceMeta.fallbackReason }}</span>
        <span v-if="loadError" class="detail-source__error">{{ loadError }}</span>
      </div>
      <section class="mobile-dark-hero detail-hero">
        <div class="ui-v2-row-between">
          <h1>{{ order.orderNo }}</h1>
          <StatusBadge :label="order.status" size="sm" />
        </div>
        <p>下单时间：{{ order.createdAt || '-' }}　渠道：{{ order.channel }}</p>
        <div class="next-task">
          <div>
            <strong>下一步任务</strong>
            <span>只读模式：{{ order.nextAction }}</span>
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
    <div v-else class="detail-page">
      <header class="detail-top">
        <RouterLink to="/ui-v2/mobile/orders">返回</RouterLink>
        <span>订单详情</span>
      </header>
      <EmptyState title="未找到订单" :hint="loadError || '请返回订单中心重新选择订单。'" />
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
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
const order = ref(null)
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})
const device = computed(() => order.value ? {
  model: order.value.model || '未填写设备',
  maintenanceStatus: '只读',
  serialNo: (order.value.deviceIds || [])[0] || '未分配',
} : null)
const shippingSteps = computed(() => {
  if (!order.value) return []
  return [
    { label: '确认信息', desc: order.value.status, done: true },
    { label: '物流状态', desc: order.value.shippingStatus || '待更新', current: !['已完成', '已取消'].includes(order.value.status) },
  ]
})

async function loadOrder() {
  loading.value = true
  loadError.value = ''
  order.value = null
  try {
    const nextOrder = await uiV2Adapter.getOrder(route.params.id)
    order.value = nextOrder || null
    sourceMeta.value = uiV2Adapter.getLastMeta('getOrder')
    if (!nextOrder && sourceMeta.value.source === 'mock-fallback') {
      loadError.value = '真实订单详情读取失败，且没有可用 mock fallback。'
    }
  } catch (error) {
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '订单详情读取失败'
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, loadOrder)
onMounted(loadOrder)
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
.detail-source-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.detail-source,
.detail-source__reason,
.detail-source__error {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}
.detail-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}
.detail-source.is-mock-fallback,
.detail-source__reason {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}
.detail-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.92);
  color: #b91c1c;
}
.detail-adapter-state {
  padding: 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 680;
}
</style>
