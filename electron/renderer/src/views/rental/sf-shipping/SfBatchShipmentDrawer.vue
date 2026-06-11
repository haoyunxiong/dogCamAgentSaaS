<template>
  <BaseDrawer v-model="open" title="批量寄件" :width="720">
    <div class="batch-toolbar">
      <button class="btn btn-secondary btn-sm" :disabled="batchLoading" @click="$emit('load-pending-shipment-orders')">刷新</button>
      <button class="btn btn-secondary btn-sm" @click="$emit('toggle-select-all-pending')">
        {{ allPendingSelected ? '取消全选' : '全选可寄' }}
      </button>
      <button class="btn btn-primary btn-sm" :disabled="busy || batchLoading || !selectedIds.length" @click="$emit('place-selected-orders')">
        一键寄件 ({{ selectedIds.length }})
      </button>
    </div>

    <DataTable v-if="pendingOrders.length" min-width="640px">
      <thead>
        <tr>
          <th class="w-10"></th>
          <th>订单 / 设备</th>
          <th>客户 / 地址</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in pendingOrders" :key="order.id" :class="{ muted: !order.selectable }">
          <td>
            <input
              v-model="selectedIds"
              type="checkbox"
              :value="order.id"
              :disabled="!order.selectable || busy || batchLoading"
            />
          </td>
          <td>
            <b>{{ order.order_no || `#${order.id}` }}</b>
            <span class="minor-text">{{ order.model_code || '-' }}</span>
          </td>
          <td><span class="minor-text">{{ [order.province, order.city, order.district].filter(Boolean).join('') || '-' }}</span></td>
          <td>
            <span v-if="batchResultMap[order.id]" :class="['pill', batchResultMap[order.id].ok ? 'pill-on' : 'pill-off']">
              {{ batchResultMap[order.id].ok ? '已寄件' : '失败' }}
            </span>
            <span v-else-if="order.existingShipment" class="pill pill-on">已有单</span>
            <span v-else-if="!order.selectable" class="minor-text">{{ order.selectDisabledReason }}</span>
            <span v-else class="pill">可寄</span>
          </td>
        </tr>
      </tbody>
    </DataTable>

    <p v-else class="empty-text">暂无今日待发货订单</p>

    <div v-if="batchResults.length" class="batch-summary">
      <div v-for="result in batchResults" :key="result.orderId" :class="['bs-row', result.ok ? 'bs-ok' : 'bs-err']">
        <b>#{{ result.orderId }}</b> {{ result.ok ? `成功 ${result.trackingNo || ''}` : result.message }}
      </div>
    </div>
  </BaseDrawer>
</template>

<script setup>
import { computed } from 'vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import DataTable from '../../../components/DataTable.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  pendingOrders: { type: Array, default: () => [] },
  batchSelectedIds: { type: Array, default: () => [] },
  batchResultMap: { type: Object, default: () => ({}) },
  batchResults: { type: Array, default: () => [] },
  allPendingSelected: { type: Boolean, default: false },
  batchLoading: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:modelValue',
  'update:batchSelectedIds',
  'load-pending-shipment-orders',
  'toggle-select-all-pending',
  'place-selected-orders',
])

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const selectedIds = computed({
  get: () => props.batchSelectedIds,
  set: (value) => emit('update:batchSelectedIds', value),
})
</script>

<style scoped>
.batch-toolbar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.batch-summary {
  display: grid;
  gap: 6px;
  margin-top: var(--space-3);
}
.bs-row {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.bs-ok {
  background: var(--bg-success-soft);
  color: var(--text-success);
}
.bs-err {
  background: var(--bg-danger-soft);
  color: var(--text-danger);
}
.minor-text {
  color: var(--text-muted);
  font-size: 13px;
}
.empty-text {
  padding: 40px;
  color: var(--text-faint);
  font-size: 14px;
  text-align: center;
}
.w-10 {
  width: 40px;
}
</style>
