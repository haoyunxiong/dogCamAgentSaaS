<template>
  <section class="panel">
    <div class="section-head">
      <div class="records-toolbar">
        <select v-model="filters.status" class="ff-select" @change="$emit('load-shipments')">
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="submitted">已下单</option>
          <option value="result_pending">待查结果</option>
          <option value="cancelled">已取消</option>
          <option value="rejected">不可收派</option>
        </select>
        <span class="minor-text">共 <b>{{ shipments.length }}</b> 单 · 运输中 <b>{{ shipmentStats.active }}</b></span>
      </div>
    </div>

    <div v-if="shipments.length" class="record-list">
      <div v-for="shipment in shipments" :key="shipment.id" class="record-row" @click="$emit('open-shipment', shipment)">
        <div class="rr-main">
          <code class="rr-code">{{ shipment.tracking_no || shipment.shipment_no }}</code>
          <StatusBadge :label="shipmentDisplayStatus(shipment)" :variant="shipmentStatusVariant(shipment.status, latestRoute(shipment))" />
        </div>
        <div class="rr-route">
          <span>{{ cityLabel(shipment.sender_city, shipment.sender_district) }}</span>
          <span class="rr-arrow">→</span>
          <span>{{ cityLabel(shipment.receiver_city, shipment.receiver_district) }}</span>
        </div>
        <div class="rr-meta">
          <span>{{ shipment.receiver_name || '-' }} · {{ feeLabel(shipment.estimated_fee || shipment.quote_fee) }} · {{ timeLabel(shipment.created_at || shipment.planned_send_at) }}</span>
          <div class="rr-actions" @click.stop>
            <button v-if="shipment.status === 'result_pending'" class="btn btn-secondary btn-sm" @click="$emit('recover-result', shipment.id)">查结果</button>
            <button v-if="shipment.status === 'submitted'" class="btn btn-secondary btn-sm" @click="$emit('refresh-routes', shipment.id)">物流</button>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="empty-text">暂无寄件记录，在「寄快递」中创建第一单吧</p>
  </section>
</template>

<script setup>
import StatusBadge from '../../../components/StatusBadge.vue'

defineEmits(['load-shipments', 'open-shipment', 'recover-result', 'refresh-routes'])

defineProps({
  shipments: { type: Array, default: () => [] },
  filters: { type: Object, required: true },
  shipmentStats: { type: Object, default: () => ({ active: 0 }) },
  latestRoute: { type: Function, required: true },
  shipmentDisplayStatus: { type: Function, required: true },
  shipmentStatusVariant: { type: Function, required: true },
  cityLabel: { type: Function, required: true },
  feeLabel: { type: Function, required: true },
  timeLabel: { type: Function, required: true },
})
</script>

<style scoped>
.records-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.record-list {
  display: grid;
  gap: 8px;
}
.record-row {
  padding: var(--space-4);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  cursor: pointer;
  transition: all .15s;
}
.record-row:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-sm);
}
.rr-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.rr-code {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.rr-route {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 14px;
}
.rr-arrow {
  color: var(--text-faint);
}
.rr-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 13px;
}
.rr-actions {
  display: flex;
  gap: 6px;
}
</style>
