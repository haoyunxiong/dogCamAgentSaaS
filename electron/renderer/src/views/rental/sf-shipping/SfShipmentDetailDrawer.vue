<template>
  <BaseDrawer
    v-model="open"
    :title="selectedDetail ? (selectedDetail.tracking_no || selectedDetail.shipment_no || '寄件详情') : '寄件详情'"
    subtitle="查看物流轨迹、运费和操作记录"
    :width="780"
    @close="$emit('close')"
  >
    <template v-if="selectedDetail">
      <div class="dm-head">
        <div>
          <code class="text-lg">{{ selectedDetail.tracking_no || selectedDetail.shipment_no }}</code>
          <StatusBadge
            :label="shipmentDisplayStatus(selectedDetail)"
            :variant="shipmentStatusVariant(selectedDetail.status, latestRoute(selectedDetail))"
            size="sm"
          />
        </div>
      </div>

      <div class="dm-actions">
        <button class="btn btn-secondary btn-sm" :disabled="busy" @click="$emit('refresh-routes', selectedDetail.id)">刷新轨迹</button>
        <button class="btn btn-secondary btn-sm" :disabled="busy" @click="$emit('refresh-fee', selectedDetail.id)">查清单运费</button>
        <button
          v-if="selectedDetail.status === 'submitted'"
          class="btn btn-danger btn-sm"
          :disabled="busy"
          @click="$emit('cancel-shipment', selectedDetail.id)"
        >
          取消订单
        </button>
      </div>

      <div class="dm-dual">
        <div class="dm-ac">
          <h4>寄</h4>
          <b>{{ selectedDetail.sender_name || '-' }} {{ selectedDetail.sender_mobile || '' }}</b>
          <p>{{ fullAddress(selectedDetail, 'sender') }}</p>
        </div>
        <div class="dm-arrow">→</div>
        <div class="dm-ac">
          <h4>收</h4>
          <b>{{ selectedDetail.receiver_name || '-' }} {{ selectedDetail.receiver_mobile || '' }}</b>
          <p>{{ fullAddress(selectedDetail, 'receiver') }}</p>
        </div>
      </div>

      <div class="kpi-strip kpi-4">
        <div class="kpi"><div class="kpi-body"><div class="kpi-val">{{ timeLabel(selectedDetail.planned_send_at) }}</div><div class="kpi-lbl">计划取件</div></div></div>
        <div class="kpi"><div class="kpi-body"><div class="kpi-val">{{ pickupTimeLabel(selectedDetail) }}</div><div class="kpi-lbl">实际揽收</div></div></div>
        <div class="kpi"><div class="kpi-body"><div class="kpi-val">{{ timeLabel(selectedDetail.expected_arrive_at) }}</div><div class="kpi-lbl">预计送达</div></div></div>
        <div class="kpi"><div class="kpi-body"><div class="kpi-val">{{ feeLabel(selectedDetail.estimated_fee || selectedDetail.quote_fee) }}</div><div class="kpi-lbl">预估费用</div></div></div>
      </div>
      <div class="kpi-strip kpi-3">
        <div class="kpi"><div class="kpi-body"><div class="kpi-val">{{ feeLabel(selectedDetail.billed_fee) }}</div><div class="kpi-lbl">清单运费</div></div></div>
        <div class="kpi"><div class="kpi-body"><div class="kpi-val">{{ feeLabel(selectedDetail.actual_paid_fee) }}</div><div class="kpi-lbl">实际支付</div></div></div>
      </div>

      <div v-if="selectedDetail.billedFeeDetail?.length" class="dm-fees">
        <div v-for="item in selectedDetail.billedFeeDetail" :key="`${item.type}-${item.value}`">
          <span>{{ item.name || item.type }}</span><b>{{ feeLabel(item.value) }}</b>
        </div>
      </div>

      <div class="dm-paid-row">
        <input v-model.number="actualPaidForm.amount" type="number" min="0" step="0.01" placeholder="实际支付金额" />
        <input v-model="actualPaidForm.note" placeholder="修正备注" />
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="$emit('save-actual-paid')">保存</button>
      </div>

      <div class="dm-section">
        <h4>物流轨迹</h4>
        <div v-if="selectedDetail.routesResult?.routes?.length" class="route-timeline">
          <div v-for="route in selectedDetail.routesResult.routes" :key="`${route.acceptTime}-${route.remark}`">
            <b>{{ route.acceptTime }}</b>
            <span>{{ route.acceptAddress }} {{ route.remark }}</span>
          </div>
        </div>
        <p v-else class="empty-text">暂无物流轨迹，揽收后再刷新</p>
      </div>

      <div class="dm-section">
        <h4>操作记录</h4>
        <div v-if="selectedDetail.events?.length" class="dm-events">
          <div v-for="event in selectedDetail.events" :key="event.id">
            <b>{{ statusLabel(event.status) }}</b>
            <span>{{ event.event_type }} · {{ event.message || '-' }}</span>
          </div>
        </div>
        <p v-else class="empty-text">暂无操作记录</p>
      </div>
    </template>
  </BaseDrawer>
</template>

<script setup>
import { computed } from 'vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import StatusBadge from '../../../components/StatusBadge.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  selectedDetail: { type: Object, default: null },
  actualPaidForm: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  shipmentDisplayStatus: { type: Function, required: true },
  shipmentStatusVariant: { type: Function, required: true },
  latestRoute: { type: Function, required: true },
  fullAddress: { type: Function, required: true },
  timeLabel: { type: Function, required: true },
  pickupTimeLabel: { type: Function, required: true },
  feeLabel: { type: Function, required: true },
  statusLabel: { type: Function, required: true },
})

const emit = defineEmits([
  'update:modelValue',
  'close',
  'refresh-routes',
  'refresh-fee',
  'cancel-shipment',
  'save-actual-paid',
])

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<style scoped>
.dm-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.dm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
.dm-dual {
  display: grid;
  grid-template-columns: 1fr 36px 1fr;
  gap: var(--space-4);
  align-items: start;
  margin-bottom: var(--space-4);
}
.dm-ac {
  padding: var(--space-3);
  background: var(--bg-panel-muted);
  border-radius: var(--radius-sm);
}
.dm-ac h4 {
  margin: 0 0 6px;
  color: var(--text-muted);
  font-size: 13px;
}
.dm-ac b,
.dm-ac p {
  display: block;
  margin: 0 0 2px;
  font-size: 14px;
}
.dm-ac p {
  color: var(--text-muted);
  font-size: 13px;
}
.dm-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 28px;
  color: var(--text-faint);
  font-size: 20px;
}
.dm-fees {
  display: grid;
  gap: 6px;
  margin-bottom: var(--space-3);
}
.dm-fees div {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--bg-panel-muted);
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.dm-paid-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: var(--space-2);
  align-items: end;
  margin-bottom: var(--space-4);
}
.dm-section {
  margin-top: var(--space-4);
}
.dm-section h4 {
  margin: 0 0 var(--space-2);
  color: var(--text-secondary);
  font-size: 14px;
}
.dm-events {
  display: grid;
  gap: 6px;
}
.dm-events div {
  display: flex;
  gap: 10px;
  font-size: 13px;
}
.dm-events b {
  flex-shrink: 0;
  min-width: 80px;
  color: var(--text-secondary);
}
.kpi-3 {
  grid-template-columns: repeat(2, 1fr);
}
.kpi-4 {
  grid-template-columns: repeat(4, 1fr);
}
.empty-text {
  padding: 40px;
  color: var(--text-faint);
  font-size: 14px;
  text-align: center;
}
.text-lg {
  font-size: 18px;
  font-weight: 700;
}
.route-timeline {
  display: grid;
  gap: 6px;
}
.route-timeline > div {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--space-3);
  padding: 10px 12px;
  border-left: 3px solid var(--bg-primary);
  background: var(--bg-panel-muted);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 13px;
}
.route-timeline b {
  color: var(--text-secondary);
}
.route-timeline span {
  color: var(--text-main);
}
.btn-danger {
  border-color: #dc2626;
  background: #dc2626;
  color: #fff;
}
.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}
@media (max-width: 820px) {
  .dm-dual {
    grid-template-columns: 1fr;
  }
  .dm-arrow {
    transform: rotate(90deg);
    padding-top: 0;
  }
  .kpi-strip {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
</style>
