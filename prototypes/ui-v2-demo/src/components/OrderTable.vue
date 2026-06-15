<template>
  <BaseTable :columns="columns" :rows="orders" row-key="orderNo" :selected-key="selectedKey" @row-click="$emit('row-click', $event)">
    <template #orderNo="{ row }">
      <strong class="mono">{{ row.orderNo }}</strong>
    </template>
    <template #customerName="{ row }">
      <div class="customer-cell">
        <strong>{{ row.customerName }}</strong>
        <small>{{ row.channel }}</small>
      </div>
    </template>
    <template #status="{ row }">
      <StatusTag :label="row.status" />
    </template>
    <template #period="{ row }">
      {{ row.rentStart }} - {{ row.rentEnd }}
    </template>
    <template #depositStatus="{ row }">
      <StatusTag :label="row.depositStatus" />
    </template>
    <template #riskLevel="{ row }">
      <StatusTag :label="riskLabel(row.riskLevel)" :tone="riskTone(row.riskLevel)" />
    </template>
    <template #nextAction="{ row }">
      <span class="next-action">{{ row.nextAction }}</span>
    </template>
  </BaseTable>
</template>

<script setup>
import BaseTable from './BaseTable.vue'
import StatusTag from './StatusTag.vue'

defineProps({
  orders: { type: Array, required: true }
  ,
  selectedKey: { type: String, default: '' }
})

defineEmits(['row-click'])

const columns = [
  { key: 'orderNo', label: '订单号' },
  { key: 'customerName', label: '客户/渠道' },
  { key: 'status', label: '订单状态' },
  { key: 'period', label: '租期' },
  { key: 'model', label: '设备' },
  { key: 'depositStatus', label: '押金/免押' },
  { key: 'shippingStatus', label: '物流' },
  { key: 'riskLevel', label: '风险' },
  { key: 'assignee', label: '负责人' },
  { key: 'nextAction', label: '下一步' }
]

function riskLabel(level) {
  return { none: '正常', low: '低', medium: '中', high: '高' }[level] || '正常'
}

function riskTone(level) {
  return { none: 'neutral', low: 'info', medium: 'warning', high: 'danger' }[level] || 'neutral'
}
</script>

<style scoped>
.mono {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.customer-cell strong,
.customer-cell small {
  display: block;
}

.customer-cell strong {
  color: var(--text);
}

.customer-cell small {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
}

.next-action {
  color: var(--brand);
  font-weight: 740;
}
</style>
