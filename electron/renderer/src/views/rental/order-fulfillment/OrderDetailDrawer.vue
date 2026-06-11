<template>
  <BaseDrawer
    :model-value="modelValue"
    :title="order ? `订单详情 #${order.id}` : '订单详情'"
    :width="720"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('close')"
  >
    <template v-if="order">
      <div class="order-detail-drawer-body">
        <div class="order-drawer-header">
          <div class="order-drawer-header-left">
            <div class="order-drawer-title-row">
              <span class="order-drawer-id">#{{ order.id }}</span>
              <span class="order-drawer-source-no">{{ order.order_no || '未填订单号' }}</span>
            </div>
            <div class="order-drawer-badges">
              <StatusBadge :label="orderStatusLabel(order.order_status)" variant="neutral" />
              <StatusBadge v-if="isPendingShipOrder(order)" label="待发货" variant="warning" />
              <StatusBadge v-if="isPendingReturnOrder(order)" label="待归还" variant="danger" />
              <StatusBadge :label="depositHeaderLabel" :variant="mapStatusVariant(depositHeaderVariant)" />
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" @click.stop="$emit('edit-order', order)">编辑订单</button>
        </div>

        <div class="status-advisor" :class="`status-advisor--${advisorSeverity}`">
          <span class="advisor-dot"></span>
          <span class="advisor-text">{{ advisorMessage }}</span>
        </div>

        <section v-if="completionState.missingFields.length" class="drawer-section-card missing-fields-card">
          <div class="drawer-section-head">
            <div>
              <div class="drawer-section-title">资料状态：{{ completionState.label }}</div>
              <div class="drawer-section-tip">可先占用档期，发货前需补齐收货资料。</div>
            </div>
            <button class="btn btn-secondary btn-sm" @click.stop="$emit('edit-order', order)">补资料</button>
          </div>
          <div class="missing-field-list">
            <span
              v-for="field in completionState.missingFields"
              :key="field"
              class="missing-field-chip"
              :class="{ blocking: completionState.blockingFields.includes(field) }"
            >{{ field }}</span>
          </div>
        </section>

        <div class="mini-summary-grid">
          <div class="mini-summary-card">
            <span class="mini-summary-label">租期</span>
            <span class="mini-summary-value">{{ order.rent_start_date }} ~ {{ order.rent_end_date }}</span>
            <span class="mini-summary-sub">{{ calcRentDays(order) }} 天</span>
          </div>
          <div class="mini-summary-card">
            <span class="mini-summary-label">金额</span>
            <span class="mini-summary-value mini-summary-value--accent">¥{{ order.fee || 0 }}</span>
            <span class="mini-summary-sub">押金 ¥{{ order.deposit || 0 }}</span>
          </div>
          <div class="mini-summary-card">
            <span class="mini-summary-label">设备</span>
            <span class="mini-summary-value">{{ order.unit_code || '-' }}</span>
            <span class="mini-summary-sub">{{ order.model_code }}</span>
          </div>
          <div class="mini-summary-card">
            <span class="mini-summary-label">店铺</span>
            <span class="mini-summary-value">{{ order.store_name || defaultStoreName }}</span>
            <span class="mini-summary-sub">#{{ order.id }}</span>
          </div>
        </div>

        <section class="drawer-section-card">
          <div class="drawer-section-head">
            <div class="drawer-section-title">客户与收货信息</div>
            <button class="btn btn-secondary btn-sm" @click.stop="$emit('copy-shipping-info', order)">复制收货信息</button>
          </div>
          <div class="kv-grid">
            <div class="kv-item">
              <span class="kv-label">客户姓名</span>
              <span class="kv-value">{{ order.customer_name || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">手机号</span>
              <span class="kv-value">{{ order.customer_phone || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">用户来源</span>
              <span class="kv-value">{{ sourceChannelLabel(order.source_channel) }} / {{ order.source_name || '-' }}</span>
            </div>
            <div class="kv-item kv-item--wide">
              <span class="kv-label">收货地址</span>
              <span class="kv-value">{{ formatOrderAddress(order) || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">订单备注</span>
              <span class="kv-value">{{ order.remark || order.note || '-' }}</span>
            </div>
          </div>
        </section>

        <section class="drawer-section-card">
          <div class="drawer-section-head">
            <div class="drawer-section-title">资金与免押</div>
          </div>

          <div class="kv-grid kv-grid--3col">
            <div class="kv-item">
              <span class="kv-label">租金展示</span>
              <span class="kv-value kv-value--accent">¥{{ order.fee || 0 }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">订单押金</span>
              <span class="kv-value">¥{{ order.deposit || 0 }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">设备价值</span>
              <span class="kv-value">{{ order.residual_value || order.device_value || order.purchase_cost || '-' }}</span>
            </div>
          </div>

          <div class="deposit-state-panel" :class="`deposit-state-panel--${latestDepositOrder ? latestDepositOrder.status : 'none'}`">
            <template v-if="!latestDepositOrder">
              <div class="deposit-state-row">
                <span class="deposit-state-badge deposit-state-badge--none">未创建</span>
                <span class="deposit-state-hint">免押金额默认取设备价值，可在创建时手动调整</span>
              </div>
              <div class="deposit-action-row">
                <button class="btn btn-primary btn-sm" @click.stop="$emit('open-create-deposit', order)">创建免押单</button>
              </div>
            </template>

            <template v-else-if="latestDepositOrder.status === 'pending_review'">
              <div class="deposit-state-row">
                <span class="deposit-state-badge deposit-state-badge--pending">{{ getDepositStatusLabel(latestDepositOrder.status) }}</span>
                <span class="deposit-state-no">{{ latestDepositOrder.depositOrderNo }}</span>
              </div>
              <div class="kv-grid kv-grid--2col">
                <div class="kv-item">
                  <span class="kv-label">押金金额</span>
                  <span class="kv-value">¥{{ latestDepositOrder.depositAmount || 0 }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">二维码有效期</span>
                  <span class="kv-value">{{ latestDepositOrder.expiresInText || '24小时' }}</span>
                </div>
              </div>
              <div class="deposit-action-row">
                <button class="btn btn-secondary btn-sm" @click.stop="$emit('copy-deposit-review-url')">复制邀约</button>
                <button class="btn btn-secondary btn-sm" @click.stop="$emit('save-deposit-poster')">保存海报</button>
              </div>
            </template>

            <template v-else-if="latestDepositOrder.status === 'approved'">
              <div class="deposit-state-row">
                <span class="deposit-state-badge deposit-state-badge--approved">{{ getDepositStatusLabel(latestDepositOrder.status) }}</span>
                <span class="deposit-state-no">{{ latestDepositOrder.depositOrderNo }}</span>
              </div>
              <div class="deposit-state-hint deposit-state-hint--success">免押已通过，可安排发货</div>
              <div class="kv-grid kv-grid--2col">
                <div class="kv-item">
                  <span class="kv-label">押金金额</span>
                  <span class="kv-value">¥{{ latestDepositOrder.depositAmount || 0 }}</span>
                </div>
                <div class="kv-item">
                  <span class="kv-label">免押单号</span>
                  <span class="kv-value">{{ latestDepositOrder.depositOrderNo }}</span>
                </div>
              </div>
            </template>

            <template v-else-if="latestDepositOrder.status === 'rejected'">
              <div class="deposit-state-row">
                <span class="deposit-state-badge deposit-state-badge--rejected">{{ getDepositStatusLabel(latestDepositOrder.status) }}</span>
                <span class="deposit-state-no">{{ latestDepositOrder.depositOrderNo }}</span>
              </div>
              <div class="deposit-state-hint deposit-state-hint--danger">用户未通过免押审核，可重新创建免押单</div>
              <div class="deposit-action-row">
                <button class="btn btn-primary btn-sm" @click.stop="$emit('open-create-deposit', order)">重新创建免押单</button>
              </div>
            </template>

            <template v-else-if="latestDepositOrder.status === 'cancelled'">
              <div class="deposit-state-row">
                <span class="deposit-state-badge deposit-state-badge--cancelled">{{ getDepositStatusLabel(latestDepositOrder.status) }}</span>
                <span class="deposit-state-no">{{ latestDepositOrder.depositOrderNo }}</span>
              </div>
              <div class="deposit-state-hint">该免押单已取消，可重新创建</div>
              <div class="deposit-action-row">
                <button class="btn btn-primary btn-sm" @click.stop="$emit('open-create-deposit', order)">重新创建免押单</button>
              </div>
            </template>

            <template v-else-if="latestDepositOrder.status === 'completed'">
              <div class="deposit-state-row">
                <span class="deposit-state-badge deposit-state-badge--completed">{{ getDepositStatusLabel(latestDepositOrder.status) }}</span>
                <span class="deposit-state-no">{{ latestDepositOrder.depositOrderNo }}</span>
              </div>
              <div class="deposit-state-hint">该订单关联免押单已完结</div>
            </template>

            <template v-else>
              <div class="deposit-state-row">
                <span class="deposit-state-badge">{{ getDepositStatusLabel(latestDepositOrder.status) }}</span>
                <span class="deposit-state-no">{{ latestDepositOrder.depositOrderNo }}</span>
              </div>
            </template>
          </div>
        </section>

        <section class="drawer-section-card">
          <div class="drawer-section-head">
            <div class="drawer-section-title">设备与租期</div>
          </div>
          <div class="device-rental-grid">
            <div class="kv-item">
              <span class="kv-label">商品名称</span>
              <span class="kv-value">{{ order.product_name || order.item_title || order.model_code || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">型号编码</span>
              <span class="kv-value">{{ order.model_code || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">设备编号</span>
              <span class="kv-value">{{ order.unit_code || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">设备价值</span>
              <span class="kv-value">{{ order.residual_value || order.device_value || order.purchase_cost || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">租期开始</span>
              <span class="kv-value">{{ order.rent_start_date || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">租期结束</span>
              <span class="kv-value">{{ order.rent_end_date || '-' }}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">租期天数</span>
              <span class="kv-value">{{ calcRentDays(order) }} 天</span>
            </div>
          </div>
        </section>

        <section class="drawer-section-card logistics-workbench">
          <div class="logistics-summary-strip">
            <div class="logistics-summary-item">
              <span class="mini-summary-label">物流状态</span>
              <span class="logistics-status-badge" :class="`logistics-status-badge--${logisticsStatusSummary.badge}`">
                {{ logisticsStatusSummary.label }}
              </span>
            </div>
            <div class="logistics-summary-item">
              <span class="mini-summary-label">运单号</span>
              <span class="logistics-summary-value">{{ shippingForm.trackingNo || order.tracking_no || '-' }}</span>
            </div>
            <div class="logistics-summary-item">
              <span class="mini-summary-label">物流方式</span>
              <span class="logistics-summary-value">{{ shippingModeLabel(shippingForm.shippingMode) || shippingModeLabel(order.shipping_mode) || '-' }}</span>
            </div>
            <div class="logistics-summary-item">
              <span class="mini-summary-label">最近更新</span>
              <span class="logistics-summary-value">{{ logisticsLastUpdate || '暂无轨迹' }}</span>
            </div>
          </div>

          <div class="logistics-form-panel">
            <div class="drawer-section-head">
              <div class="drawer-section-title">物流信息编辑</div>
            </div>
            <div class="form-grid two-cols drawer-logistics-grid">
              <div class="form-group">
                <label>运单号</label>
                <input v-model="shippingForm.trackingNo" placeholder="运单号">
              </div>
              <div class="form-group">
                <label>物流方式</label>
                <select v-model="shippingForm.shippingMode">
                  <option value="">物流方式</option>
                  <option value="land">陆运</option>
                  <option value="express">普通快递</option>
                  <option value="next_morning">次晨达</option>
                </select>
              </div>
              <div class="form-group span-2">
                <label>最新物流状态</label>
                <input v-model="shippingForm.latestLogisticsStatus" placeholder="最新物流状态">
              </div>
              <div class="form-group">
                <label>实际发货时间</label>
                <input v-model="shippingForm.actualShipAt" type="datetime-local">
              </div>
              <div class="form-group">
                <label>预计送达时间</label>
                <input v-model="shippingForm.expectedArriveAt" type="datetime-local">
              </div>
            </div>
            <div class="logistics-action-row">
              <button class="btn btn-primary btn-sm" :disabled="shipActionLoading" @click.stop="$emit('ship-order-with-sf', order)">顺丰寄件</button>
              <button class="btn btn-secondary btn-sm" :disabled="!shippingForm.orderId || logisticsLoading" @click="$emit('query-logistics')">
                {{ logisticsLoading ? '查询中...' : '查询物流' }}
              </button>
              <button class="btn btn-secondary btn-sm" @click="$emit('reset-shipping-draft')">重置草稿</button>
            </div>
          </div>

          <div class="logistics-timeline">
            <div class="drawer-section-head">
              <div class="drawer-section-title">物流轨迹</div>
            </div>

            <div v-if="shippingRecords.length" class="logistics-timeline-list">
              <div
                v-for="(record, idx) in shippingRecords"
                :key="record.id"
                class="logistics-timeline-item"
                :class="{ 'logistics-timeline-item--latest': idx === 0 }"
              >
                <div class="logistics-timeline-marker">
                  <span class="logistics-timeline-dot" :class="{ 'logistics-timeline-dot--active': idx === 0 }"></span>
                  <span v-if="idx < shippingRecords.length - 1" class="logistics-timeline-line"></span>
                </div>
                <div class="logistics-timeline-body">
                  <div class="logistics-timeline-status">{{ record.latest_status || '已记录物流更新' }}</div>
                  <div class="logistics-timeline-time">
                    {{ formatDateTime(record.actual_ship_at || record.actual_arrive_at || record.expected_arrive_at || record.created_at) }}
                  </div>
                  <div class="logistics-timeline-meta">运单号：{{ record.tracking_no || '-' }}</div>
                </div>
              </div>
            </div>

            <div v-else class="logistics-empty-state">
              <div class="logistics-empty-icon">📭</div>
              <div class="logistics-empty-title">暂无物流轨迹</div>
              <div class="logistics-empty-desc">保存运单号后可查询物流状态</div>
            </div>
          </div>
        </section>
      </div>
    </template>

    <div v-else class="empty-box">
      <div class="title">请先选择一笔订单</div>
      <div class="hint">点击订单操作列的详情按钮查看完整信息。</div>
    </div>

    <template #footer>
      <button class="btn btn-secondary" @click="$emit('close')">关闭</button>
      <button class="btn btn-primary" @click="$emit('save-shipping')">保存物流</button>
    </template>
  </BaseDrawer>
</template>

<script setup>
import BaseDrawer from '../../../components/BaseDrawer.vue'
import StatusBadge from '../../../components/StatusBadge.vue'

defineEmits([
  'update:modelValue',
  'close',
  'edit-order',
  'copy-shipping-info',
  'open-create-deposit',
  'copy-deposit-review-url',
  'save-deposit-poster',
  'ship-order-with-sf',
  'query-logistics',
  'reset-shipping-draft',
  'save-shipping',
])

defineProps({
  modelValue: { type: Boolean, default: false },
  order: { type: Object, default: null },
  latestDepositOrder: { type: Object, default: null },
  shippingForm: { type: Object, required: true },
  shippingRecords: { type: Array, default: () => [] },
  defaultStoreName: { type: String, default: '' },
  advisorMessage: { type: String, default: '' },
  advisorSeverity: { type: String, default: 'neutral' },
  depositHeaderLabel: { type: String, default: '' },
  depositHeaderVariant: { type: String, default: 'subtle' },
  logisticsStatusSummary: { type: Object, default: () => ({ badge: 'neutral', label: '未发货' }) },
  logisticsLastUpdate: { type: String, default: '' },
  completionState: { type: Object, default: () => ({ missingFields: [], blockingFields: [], label: '资料完整' }) },
  shipActionLoading: { type: Boolean, default: false },
  logisticsLoading: { type: Boolean, default: false },
  orderStatusLabel: { type: Function, required: true },
  isPendingShipOrder: { type: Function, required: true },
  isPendingReturnOrder: { type: Function, required: true },
  mapStatusVariant: { type: Function, required: true },
  calcRentDays: { type: Function, required: true },
  sourceChannelLabel: { type: Function, required: true },
  formatOrderAddress: { type: Function, required: true },
  getDepositStatusLabel: { type: Function, required: true },
  shippingModeLabel: { type: Function, required: true },
  formatDateTime: { type: Function, required: true },
})
</script>

<style scoped>
.order-drawer-header {
  margin-bottom: 12px;
}
.order-drawer-header-left {
  min-width: 0;
}
.order-drawer-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.order-drawer-id {
  color: var(--text-strong);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
  font-size: 18px;
  font-weight: 800;
}
.order-drawer-source-no {
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-drawer-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.status-advisor {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}
.status-advisor--info {
  border: 1px solid rgba(20, 184, 166, 0.15);
  background: rgba(20, 184, 166, 0.06);
  color: #0f766e;
}
.status-advisor--warning {
  border: 1px solid rgba(245, 158, 11, 0.15);
  background: rgba(245, 158, 11, 0.06);
  color: #b45309;
}
.status-advisor--neutral {
  border: 1px solid rgba(100, 116, 139, 0.12);
  background: rgba(100, 116, 139, 0.05);
  color: var(--text-secondary);
}
.advisor-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}
.status-advisor--info .advisor-dot {
  background: #14b8a6;
}
.status-advisor--warning .advisor-dot {
  background: #f59e0b;
}
.status-advisor--neutral .advisor-dot {
  background: #94a3b8;
}
.advisor-text {
  flex: 1;
  min-width: 0;
}
.mini-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.mini-summary-card,
.drawer-section-card {
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: var(--bg-surface, #fff);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(16, 24, 40, 0.04));
}
.mini-summary-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--radius-md, 8px);
}
.mini-summary-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.mini-summary-value {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-summary-value--accent {
  color: #0f766e;
  font-size: 15px;
  font-weight: 800;
}
.mini-summary-sub {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawer-section-card {
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md, 8px);
}
.drawer-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.drawer-section-title {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 800;
}
.drawer-section-tip {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}
.missing-fields-card {
  border-color: rgba(245, 158, 11, 0.2);
  background: rgba(255, 251, 235, 0.7);
}
.missing-field-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.missing-field-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}
.missing-field-chip.blocking {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(254, 243, 199, 0.92);
  color: #b45309;
}
.kv-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 16px;
}
.kv-grid--2col {
  grid-template-columns: repeat(2, 1fr);
}
.kv-grid--3col {
  grid-template-columns: repeat(3, 1fr);
}
.kv-item {
  min-width: 0;
}
.kv-item--wide {
  grid-column: 1 / -1;
}
.kv-label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}
.kv-value {
  display: block;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kv-value--accent {
  color: #0f766e;
  font-size: 16px;
  font-weight: 800;
}
.deposit-state-panel {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 10px;
  background: var(--bg-subtle, #f9fafb);
}
.deposit-state-panel--none,
.deposit-state-panel--cancelled,
.deposit-state-panel--completed {
  border-color: rgba(100, 116, 139, 0.12);
  background: rgba(100, 116, 139, 0.04);
}
.deposit-state-panel--pending_review {
  border-color: rgba(245, 158, 11, 0.14);
  background: rgba(245, 158, 11, 0.05);
}
.deposit-state-panel--approved {
  border-color: rgba(20, 184, 166, 0.14);
  background: rgba(20, 184, 166, 0.05);
}
.deposit-state-panel--rejected {
  border-color: rgba(239, 68, 68, 0.14);
  background: rgba(239, 68, 68, 0.05);
}
.deposit-state-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.deposit-state-badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  flex-shrink: 0;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.deposit-state-badge--none,
.deposit-state-badge--cancelled,
.deposit-state-badge--completed {
  background: rgba(100, 116, 139, 0.10);
  color: #64748b;
}
.deposit-state-badge--pending {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}
.deposit-state-badge--approved {
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
}
.deposit-state-badge--rejected {
  background: rgba(239, 68, 68, 0.10);
  color: #b91c1c;
}
.deposit-state-no {
  overflow: hidden;
  color: var(--text-secondary);
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deposit-state-hint {
  margin-bottom: 8px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}
.deposit-state-hint--success {
  color: #0f766e;
}
.deposit-state-hint--danger {
  color: #b91c1c;
}
.deposit-action-row,
.logistics-action-row {
  display: flex;
  gap: 8px;
}
.deposit-action-row {
  margin-top: 8px;
}
.device-rental-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 16px;
}
.logistics-summary-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 10px;
  background: var(--bg-subtle, #f9fafb);
}
.logistics-summary-item,
.logistics-timeline-body {
  min-width: 0;
}
.logistics-summary-value {
  overflow: hidden;
  margin-top: 2px;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.logistics-status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  margin-top: 2px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.logistics-status-badge--info {
  background: rgba(20, 184, 166, 0.10);
  color: #0f766e;
}
.logistics-status-badge--warning {
  background: rgba(245, 158, 11, 0.10);
  color: #b45309;
}
.logistics-status-badge--neutral {
  background: rgba(100, 116, 139, 0.08);
  color: #64748b;
}
.logistics-form-panel {
  margin-bottom: 14px;
  padding: 14px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: 10px;
  background: var(--bg-surface, #fff);
}
.logistics-action-row {
  margin-top: 12px;
}
.logistics-timeline-list {
  display: flex;
  flex-direction: column;
}
.logistics-timeline-item {
  display: flex;
  min-height: 52px;
  gap: 12px;
}
.logistics-timeline-item--latest .logistics-timeline-status {
  font-weight: 800;
}
.logistics-timeline-marker {
  display: flex;
  width: 24px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}
.logistics-timeline-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border: 2px solid #e5e7eb;
  border-radius: 50%;
  background: #d1d5db;
}
.logistics-timeline-dot--active {
  border-color: #99f6e4;
  background: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.14);
}
.logistics-timeline-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  margin: 4px 0;
  background: #e5e7eb;
}
.logistics-timeline-body {
  flex: 1;
  padding-bottom: 14px;
}
.logistics-timeline-status {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}
.logistics-timeline-time,
.logistics-timeline-meta,
.logistics-empty-desc {
  color: var(--text-muted);
  font-size: 12px;
}
.logistics-timeline-time,
.logistics-timeline-meta {
  margin-top: 3px;
}
.logistics-empty-state {
  padding: 28px 16px;
  text-align: center;
}
.logistics-empty-icon {
  margin-bottom: 8px;
  font-size: 28px;
}
.logistics-empty-title {
  margin-bottom: 4px;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
}
.drawer-logistics-grid input,
.drawer-logistics-grid select {
  min-height: 34px;
  padding: 6px 10px;
  font-size: 13px;
}

@media (max-width: 720px) {
  .mini-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .drawer-logistics-grid {
    grid-template-columns: 1fr;
  }

  .device-rental-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
