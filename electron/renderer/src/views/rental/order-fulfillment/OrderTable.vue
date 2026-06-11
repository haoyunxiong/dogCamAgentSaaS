<template>
  <div>
    <DataTable min-width="1240px">
      <thead>
        <tr>
          <th class="w-10">
            <input
              type="checkbox"
              :checked="allVisibleSelected"
              :disabled="!orders.length"
              @change.stop="$emit('toggle-visible-selection')"
            >
          </th>
          <th class="w-180">订单信息</th>
          <th class="w-140">客户</th>
          <th class="w-120">设备</th>
          <th class="w-160">租期</th>
          <th class="w-220">状态</th>
          <th class="w-120">金额</th>
          <th class="w-180">操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="order in orders" :key="order.id">
          <tr :class="{ selected: selectedOrderId === order.id }" @click="$emit('select-order', order)">
            <td>
              <input
                type="checkbox"
                :checked="selectedOrderIds.includes(order.id)"
                @change.stop="$emit('toggle-order-selection', order.id)"
              >
            </td>
            <td>
              <div class="cell-stack">
                <b>#{{ order.id }} {{ order.order_no || '未填订单号' }}</b>
                <span class="minor-text">{{ order.store_name || defaultStoreName }}</span>
                <span class="minor-text">{{ shippingModeLabel(order.shipping_mode) }} / {{ order.tracking_no || '未录运单' }}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span class="cell-strong">{{ order.customer_name || '-' }}</span>
                <span class="minor-text">{{ order.customer_phone || formatAreaHint(order) }}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span class="cell-strong">{{ order.unit_code || '-' }}</span>
                <span class="minor-text">{{ order.model_code || '-' }}</span>
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <span>{{ order.rent_start_date }} ~ {{ order.rent_end_date }}</span>
                <span class="minor-text">{{ calcRentDays(order) }} 天</span>
              </div>
            </td>
            <td>
              <div class="status-badge-row">
                <StatusBadge :label="paymentStatusBadge(order).label" :variant="mapStatusVariant(paymentStatusBadge(order).variant)" />
                <StatusBadge :label="fulfillmentStatusBadge(order).label" :variant="mapStatusVariant(fulfillmentStatusBadge(order).variant)" />
                <StatusBadge :label="depositStatusBadge(order).label" :variant="mapStatusVariant(depositStatusBadge(order).variant)" />
                <StatusBadge
                  :label="getOrderCompletionState(order).label"
                  :variant="mapStatusVariant(getOrderCompletionState(order).variant)"
                />
              </div>
            </td>
            <td>
              <div class="cell-stack">
                <b>¥{{ order.fee || 0 }}</b>
                <span class="minor-text">押 ¥{{ order.deposit || 0 }}</span>
              </div>
            </td>
            <td>
              <div class="row-actions" @click.stop>
                <button
                  class="btn btn-primary btn-sm"
                  :disabled="isPrimaryActionDisabled(order)"
                  @click.stop="$emit('primary-action', order)"
                >
                  {{ primaryActionLabel(order) }}
                </button>
                <RowActionMenu :items="actionMenuItems(order)" @select="$emit('menu-action', order, $event)" />
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </DataTable>
    <div v-if="orders.length === 0" class="empty-box">暂无订单</div>
  </div>
</template>

<script setup>
import DataTable from '../../../components/DataTable.vue'
import RowActionMenu from '../../../components/RowActionMenu.vue'
import StatusBadge from '../../../components/StatusBadge.vue'

defineEmits([
  'select-order',
  'toggle-order-selection',
  'toggle-visible-selection',
  'primary-action',
  'menu-action',
])

defineProps({
  orders: { type: Array, default: () => [] },
  selectedOrderId: { type: [Number, String], default: null },
  selectedOrderIds: { type: Array, default: () => [] },
  allVisibleSelected: { type: Boolean, default: false },
  shipActionLoading: { type: Boolean, default: false },
  defaultStoreName: { type: String, default: '' },
  shippingModeLabel: { type: Function, required: true },
  calcRentDays: { type: Function, required: true },
  paymentStatusBadge: { type: Function, required: true },
  fulfillmentStatusBadge: { type: Function, required: true },
  depositStatusBadge: { type: Function, required: true },
  getOrderCompletionState: { type: Function, required: true },
  mapStatusVariant: { type: Function, required: true },
  isPrimaryActionDisabled: { type: Function, required: true },
  primaryActionLabel: { type: Function, required: true },
  actionMenuItems: { type: Function, required: true },
})

function formatAreaHint(order) {
  return [order?.province, order?.city, order?.district].filter(Boolean).join(' ') || '-'
}
</script>

<style scoped>
.w-10  { width: 44px; }
.w-120 { width: 120px; }
.w-140 { width: 140px; }
.w-160 { width: 160px; }
.w-180 { width: 180px; }
.w-220 { width: 220px; }

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.cell-stack {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cell-stack b,
.cell-strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-strong);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.minor-text {
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

:deep(tbody tr.selected td) {
  background: rgba(20, 184, 166, 0.06);
}
</style>
