<template>
  <BaseDrawer
    v-model="visible"
    :title="createdOrder ? '免押单已创建' : '创建免押单'"
    :width="640"
    @close="$emit('close')"
  >

    <!-- ── 未创建：表单 ── -->
    <div v-if="!createdOrder" class="deposit-body">
      <div class="deposit-section-title">{{ props.order ? '订单信息（自动带入，可修改）' : '免押单信息（手动填写）' }}</div>

      <div class="deposit-form-grid">
        <div class="form-group">
          <label>来源订单号</label>
          <input v-model="form.sourceOrderNo" />
        </div>
        <div class="form-group">
          <label>商品名称</label>
          <input v-model="form.productName" />
        </div>
        <div class="form-group">
          <label>选择设备</label>
          <select v-model="selectedUnitCode" @change="onUnitSelected">
            <option value="">请选择设备</option>
            <option v-for="unit in scheduleUnits" :key="unit.id || unit.unit_code" :value="unit.unit_code">
              {{ unit.unit_code }}（{{ unit.model_code }}）
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>设备型号 / 编号</label>
          <input :value="`${form.modelCode || '-'} / ${form.unitCode || '-'}`" disabled />
        </div>
        <div v-if="matchedOrders.length" class="form-group span-2">
          <label>匹配来源订单</label>
          <select v-model="selectedMatchedOrderId" @change="onMatchedOrderSelected">
            <option value="">不绑定，手动填写来源订单号</option>
            <option v-for="order in matchedOrders" :key="order.id" :value="String(order.id)">
              #{{ order.id }} {{ order.order_no || '-' }} · {{ order.customer_name || '-' }} · ¥{{ formatFee(order.fee) }}
            </option>
          </select>
          <span class="field-hint">按当前设备和租期匹配，可选中后自动带入来源订单、客户和默认租金。</span>
        </div>
        <div class="form-group">
          <label>客户姓名</label>
          <input v-model="form.customerName" />
        </div>
        <div class="form-group">
          <label>客户手机号</label>
          <input v-model="form.customerPhone" />
        </div>
        <div class="form-group">
          <label>租期开始</label>
          <input v-model="form.rentStartDate" type="date" />
        </div>
        <div class="form-group">
          <label>租期结束</label>
          <input v-model="form.rentEndDate" type="date" />
        </div>
        <div class="form-group">
          <label>租期天数</label>
          <input v-model.number="form.rentDays" type="number" />
        </div>
        <div class="form-group">
          <label>租金展示</label>
          <input v-model.number="form.rentAmount" type="number" min="0" step="0.01" />
        </div>
        <div class="form-group">
          <label>押金</label>
          <input v-model.number="form.depositAmount" type="number" min="0" step="0.01" />
          <span v-if="depositWarning" class="deposit-warning">未找到设备价值，请手动填写</span>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="banner banner-error">{{ errorMsg }}</div>
    </div>

    <!-- ── 已创建：海报预览 ── -->
    <div v-else class="deposit-result">
      <div class="deposit-success-head">
        <span class="deposit-check">✓</span>
        <div>
          <b>免押单创建成功</b>
          <p>{{ createdOrder.depositOrderNo }}</p>
        </div>
      </div>

      <!-- HTML 海报预览 -->
      <div class="deposit-poster" ref="posterRef">
        <img
          v-if="posterPreviewUrl"
          :src="posterPreviewUrl"
          class="poster-preview-img"
          alt="免押审核海报预览"
        />
        <div v-else class="poster-inner">
          <!-- 品牌头部 -->
          <div class="poster-header">
            <div class="poster-title">{{ displaySettings.posterTitle }}</div>
            <div class="poster-subtitle">{{ displaySettings.posterSubtitle }}</div>
          </div>

          <!-- 二维码主视觉 -->
          <div class="poster-card poster-qr-card">
            <div class="qr-area">
              <img
                v-if="createdOrder.qrImageUrl && !qrLoadError"
                :src="createdOrder.qrImageUrl"
                class="qr-image"
                alt="支付宝免押二维码"
                @error="onQRLoadError"
              />
              <div v-else class="qr-placeholder">
                <template v-if="qrLoadError">二维码加载失败<br>请复制邀约文本</template>
                <template v-else>二维码加载中</template>
              </div>
            </div>
            <div class="qr-hint">{{ displaySettings.posterQRHint }}</div>
            <div class="qr-expiry">{{ displaySettings.expiresInLabel }}</div>
          </div>

          <!-- 订单信息卡 -->
          <div class="poster-card">
            <div class="poster-row">
              <span class="pr-label">商品名称</span>
              <span class="pr-value">{{ createdOrder.productName }}</span>
            </div>
            <div class="poster-row">
              <span class="pr-label">设备编号</span>
              <span class="pr-value">{{ createdOrder.unitCode || '-' }}</span>
            </div>
            <div class="poster-row">
              <span class="pr-label">免押单号</span>
              <span class="pr-value">{{ createdOrder.depositOrderNo }}</span>
            </div>
            <div class="poster-row">
              <span class="pr-label">来源订单</span>
              <span class="pr-value">{{ createdOrder.sourceOrderNo }}</span>
            </div>
            <div class="poster-row">
              <span class="pr-label">押金金额</span>
              <span class="pr-value pr-price">¥{{ formatFee(createdOrder.depositAmount) }}</span>
            </div>
            <div class="poster-row">
              <span class="pr-label">租期</span>
              <span class="pr-value">{{ formatDate(createdOrder.rentStartDate) }} ~ {{ formatDate(createdOrder.rentEndDate) }} 共{{ createdOrder.rentDays }}天</span>
            </div>
            <div class="poster-row" style="border-bottom:none">
              <span class="pr-label">租金展示</span>
              <span class="pr-value">¥{{ formatFee(createdOrder.rentAmount) }}</span>
            </div>
          </div>

          <!-- 流程说明 -->
          <div class="poster-card poster-flow">
            <div class="flow-steps">
              <template v-for="(step, idx) in displaySettings.processSteps" :key="step">
                <span class="flow-step"><i>{{ idx + 1 }}</i>{{ step }}</span>
                <span v-if="idx < displaySettings.processSteps.length - 1" class="flow-arrow">→</span>
              </template>
            </div>
          </div>

          <!-- 温馨提示 -->
          <div class="poster-card poster-tips">
            <b>{{ displaySettings.tipsTitle }}</b>
            <span v-for="tip in displaySettings.tips" :key="tip">{{ tip }}</span>
          </div>

          <!-- 联系方式（紧凑） -->
          <div class="poster-card poster-contact">
            <span>微电同号：{{ displaySettings.contactPhones }}</span>
            <span>工作时间：{{ displaySettings.workTime }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="deposit-actions">
        <button class="btn btn-secondary btn-sm" @click="copyReviewUrl">复制邀约</button>
        <button class="btn btn-secondary btn-sm" :disabled="savingImage" @click="savePoster">
          {{ savingImage ? '生成中…' : '保存图片' }}
        </button>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button class="btn btn-secondary" @click="close">关闭</button>
      <template v-if="!createdOrder">
        <button
          class="btn btn-primary"
          :disabled="busy"
          @click="submit"
        >
          {{ busy ? '创建中…' : '创建免押单' }}
        </button>
      </template>
      <template v-else>
        <button class="btn btn-secondary" @click="copyReviewUrl">复制邀约</button>
        <button class="btn btn-secondary" :disabled="savingImage" @click="savePoster">
          {{ savingImage ? '生成中…' : '保存图片' }}
        </button>
      </template>
    </template>

  </BaseDrawer>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import BaseDrawer from './BaseDrawer.vue'
import { createDepositOrder } from '../services/depositApiService.js'
import { getDepositDisplaySettings } from '../services/depositSettingsService.js'
import { validateCreateParams } from '../services/depositValidationService.js'
import { lookupDeviceValue } from '../services/deviceLookupService.js'
import { downloadDepositPoster, generateDepositPosterBlob } from '../utils/depositPosterCanvas.js'

const displaySettings = ref(getDepositDisplaySettings())

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  order: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'close', 'created'])

const visible = ref(props.modelValue)
const busy = ref(false)
const errorMsg = ref('')
const createdOrder = ref(null)
const savingImage = ref(false)
const qrLoadError = ref(false)
const depositWarning = ref(false)
const posterPreviewUrl = ref('')
const scheduleUnits = ref([])
const matchedOrders = ref([])
const selectedUnitCode = ref('')
const selectedMatchedOrderId = ref('')

watch(() => props.modelValue, (v) => {
  visible.value = v
  if (v) refreshDisplaySettings()
  if (v) loadScheduleUnits()
  if (v && props.order) initForm(props.order)
  if (v && !props.order) initManualForm()
  if (!v) resetState()
})
watch(visible, (v) => emit('update:modelValue', v))

const form = reactive({
  sourceOrderId: null,
  sourceOrderNo: '',
  productName: '租赁设备',
  modelCode: '',
  unitCode: '',
  customerName: '',
  customerPhone: '',
  depositAmount: 0,
  rentAmount: 0,
  rentStartDate: '',
  rentEndDate: '',
  rentDays: 0,
  sourceType: 'order',
})
watch(
  () => [form.rentStartDate, form.rentEndDate],
  ([start, end]) => {
    form.rentDays = calcRentDays(start, end)
  }
)
watch(
  () => [form.unitCode, form.modelCode, form.rentStartDate, form.rentEndDate],
  () => {
    loadMatchedOrders()
  }
)

function assignForm(next) {
  Object.assign(form, {
    sourceOrderId: null,
    sourceOrderNo: '',
    productName: '租赁设备',
    modelCode: '',
    unitCode: '',
    customerName: '',
    customerPhone: '',
    depositAmount: 0,
    rentAmount: 0,
    rentStartDate: '',
    rentEndDate: '',
    rentDays: 0,
    sourceType: 'order',
    ...next,
  })
}

function refreshDisplaySettings() {
  displaySettings.value = getDepositDisplaySettings()
}

function initManualForm() {
  assignForm({
    sourceType: 'manual',
    sourceOrderNo: '',
    productName: '租赁设备',
  })
  selectedUnitCode.value = ''
  selectedMatchedOrderId.value = ''
  matchedOrders.value = []
  depositWarning.value = false
  errorMsg.value = ''
  createdOrder.value = null
  qrLoadError.value = false
}

async function initForm(order) {
  assignForm({
    sourceOrderId: order.id,
    sourceOrderNo: order.order_no || `#${order.id}`,
    productName: order.product_name || order.item_title || order.model_code || order.unit_code || '租赁设备',
    modelCode: order.model_code || '',
    unitCode: order.unit_code || '',
    customerName: order.customer_name || '',
    customerPhone: order.customer_phone || '',
  })

  // 押金默认值：从设备管理查找机器残值，缺失时退回买入价
  // 不使用 order.deposit/order.deposit_amount（订单押金 ≠ 免押押金）
  const deviceValue = await lookupDeviceValue(order.unit_code, order.model_code)
  form.depositAmount = deviceValue ?? 0
  depositWarning.value = form.depositAmount === 0

  // 租金：整单租金（非日租金）
  form.rentAmount = order.fee || order.rent_fee || order.rentFee || order.total_rent || order.totalRent || 0

  form.rentStartDate = order.rent_start_date || ''
  form.rentEndDate = order.rent_end_date || ''
  form.rentDays = calcRentDays(order.rent_start_date, order.rent_end_date)
  form.sourceType = 'order'
  selectedUnitCode.value = order.unit_code || ''
  selectedMatchedOrderId.value = order.id ? String(order.id) : ''
  errorMsg.value = ''
  createdOrder.value = null
  qrLoadError.value = false
}

async function loadScheduleUnits() {
  try {
    const rows = await window.electronAPI?.listScheduleUnits?.({ activeInventoryOnly: true })
    scheduleUnits.value = Array.isArray(rows)
      ? rows.filter((unit) => unit?.unit_code).sort((a, b) => String(a.unit_code).localeCompare(String(b.unit_code), 'zh-Hans-CN'))
      : []
  } catch {
    scheduleUnits.value = []
  }
}

function productNameFromModel(modelCode) {
  const model = String(modelCode || '').trim()
  return model ? `${model}租赁` : '租赁设备'
}

async function onUnitSelected() {
  const unit = scheduleUnits.value.find((item) => item.unit_code === selectedUnitCode.value)
  if (!unit) return
  form.modelCode = unit.model_code || ''
  form.unitCode = unit.unit_code || ''
  form.productName = productNameFromModel(form.modelCode)
  form.depositAmount = Number(unit.residual_value || unit.purchase_cost || 0)
  depositWarning.value = form.depositAmount === 0
  selectedMatchedOrderId.value = ''
  await loadMatchedOrders()
}

function orderOverlapsRent(order) {
  if (!form.rentStartDate || !form.rentEndDate) return true
  const orderStart = String(order.rent_start_date || '').slice(0, 10)
  const orderEnd = String(order.rent_end_date || '').slice(0, 10)
  if (!orderStart || !orderEnd) return false
  return orderEnd >= form.rentStartDate && orderStart <= form.rentEndDate
}

async function loadMatchedOrders() {
  if (!form.modelCode || !form.rentStartDate || !form.rentEndDate) {
    matchedOrders.value = []
    return
  }
  try {
    const rows = await window.electronAPI?.listOrders?.({
      modelCode: form.modelCode,
      from: form.rentStartDate,
      to: form.rentEndDate,
    })
    matchedOrders.value = (Array.isArray(rows) ? rows : [])
      .filter((order) => orderOverlapsRent(order))
      .filter((order) => !form.unitCode || order.unit_code === form.unitCode)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  } catch {
    matchedOrders.value = []
  }
}

function onMatchedOrderSelected() {
  const order = matchedOrders.value.find((item) => String(item.id) === String(selectedMatchedOrderId.value))
  if (!order) return
  form.sourceOrderId = order.id
  form.sourceOrderNo = order.order_no || `#${order.id}`
  form.customerName = order.customer_name || ''
  form.customerPhone = order.customer_phone || ''
  form.rentAmount = Number(order.fee || 0)
  form.sourceType = 'order'
}

function calcRentDays(start, end) {
  if (!start || !end) return 0
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.max(1, Math.round((e - s) / 86400000) + 1)
}

function formatDate(v) {
  if (!v) return '-'
  return String(v).slice(0, 10)
}

function formatFee(v) {
  if (v == null) return '0'
  return Number(v).toFixed(2)
}

async function submit() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = ''
  try {
    const payload = {
      sourceOrderId: form.sourceOrderId,
      sourceOrderNo: form.sourceOrderNo,
      productName: form.productName,
      modelCode: form.modelCode,
      unitCode: form.unitCode,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      depositAmount: form.depositAmount,
      rentAmount: form.rentAmount,
      rentStartDate: form.rentStartDate,
      rentEndDate: form.rentEndDate,
      rentDays: form.rentDays,
      sourceType: form.sourceType,
    }
    const validationMessage = validateCreateParams(payload)
    if (validationMessage) {
      errorMsg.value = validationMessage
      return
    }

    const result = await createDepositOrder(payload)
    if (result.success) {
      createdOrder.value = result.depositOrder
      await generatePosterPreview(result.depositOrder)
      emit('created', result.depositOrder)
    } else {
      errorMsg.value = result.message || '创建失败'
    }
  } catch (e) {
    errorMsg.value = e.message || '创建失败，请重试'
  } finally {
    busy.value = false
  }
}

async function generatePosterPreview(order) {
  if (posterPreviewUrl.value) {
    URL.revokeObjectURL(posterPreviewUrl.value)
    posterPreviewUrl.value = ''
  }
  try {
    const blob = await generateDepositPosterBlob(order)
    if (blob) posterPreviewUrl.value = URL.createObjectURL(blob)
  } catch {
    posterPreviewUrl.value = ''
  }
}

async function copyReviewUrl() {
  try {
    await navigator.clipboard.writeText(createdOrder.value?.reviewUrl || '')
    window.$toast?.('邀约文本已复制', 'success')
  } catch {
    window.$toast?.('复制失败', 'error')
  }
}

async function savePoster() {
  if (!createdOrder.value) return
  savingImage.value = true
  try {
    const ok = await downloadDepositPoster(
      createdOrder.value,
      `免押单_${createdOrder.value.depositOrderNo}.png`
    )
    if (ok) {
      window.$toast?.('海报已保存', 'success')
    } else {
      window.$toast?.('保存失败，请重试', 'error')
    }
  } catch {
    window.$toast?.('保存失败', 'error')
  } finally {
    savingImage.value = false
  }
}

function onQRLoadError() {
  qrLoadError.value = true
}

function resetState() {
  if (posterPreviewUrl.value) {
    URL.revokeObjectURL(posterPreviewUrl.value)
    posterPreviewUrl.value = ''
  }
  createdOrder.value = null
  errorMsg.value = ''
  depositWarning.value = false
  qrLoadError.value = false
}

function close() {
  visible.value = false
}
</script>

<style scoped>
.deposit-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.deposit-section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-strong);
}
.deposit-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.deposit-form-grid .form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.deposit-form-grid .span-2 {
  grid-column: span 2;
}
.deposit-form-grid label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0;
}
.deposit-form-grid input,
.deposit-form-grid select {
  min-height: 34px;
  padding: 6px 10px;
  font-size: 13px;
}
.deposit-form-grid input:disabled {
  color: var(--text-secondary);
  background: var(--bg-muted, #f3f4f6);
}
.field-hint {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 18px;
}

/* ── 成功态 ── */
.deposit-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.deposit-success-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-primary-soft, rgba(20, 184, 166, 0.08));
  border: 1px solid var(--brand-primary-border, rgba(20, 184, 166, 0.24));
  border-radius: var(--radius-md, 8px);
}
.deposit-check {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--brand-primary, #0f766e);
  color: #fff;
  font-size: 18px;
  flex-shrink: 0;
}
.deposit-success-head b {
  display: block;
  font-size: 16px;
  color: var(--text-strong);
}
.deposit-success-head p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  font-family: var(--font-mono, monospace);
}

.deposit-actions {
  display: flex;
  gap: 8px;
}

/* ── 海报预览 ── */
.deposit-poster {
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  background: #f7f8fa;
  padding: 16px;
  max-height: 500px;
  overflow: auto;
}
.poster-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.poster-preview-img {
  display: block;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  border-radius: 12px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  background: #fff;
}

.poster-header {
  background: var(--brand-primary-soft, #e6f4f2);
  border: 1px solid #cce8e4;
  border-radius: var(--radius-md, 8px);
  padding: 24px 20px;
  text-align: center;
}
.poster-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--brand-primary, #0f766e);
}
.poster-subtitle {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.poster-card {
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  padding: 14px 16px;
}
.poster-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle, #f3f4f6);
}
.poster-row:last-child { border-bottom: none; }
.pr-label {
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.pr-value {
  font-size: 14px;
  color: var(--text-strong);
  font-weight: 600;
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pr-price {
  font-size: 18px;
  font-weight: 800;
  color: var(--brand-primary, #0f766e);
}

/* 二维码主视觉 */
.poster-qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 20px;
}
.qr-area {
  width: 200px;
  height: 200px;
  flex-shrink: 0;
  background: #f0f9f6;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.qr-placeholder {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
  padding: 8px;
}
.qr-hint {
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}
.qr-expiry {
  margin-top: 6px;
  font-size: 13px;
  color: #dc2626;
  font-weight: 700;
}

/* 流程说明 */
.poster-flow {
  padding: 16px;
}
.flow-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.flow-step {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--text-strong);
  font-weight: 600;
}
.flow-step i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--brand-primary, #0f766e);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  font-style: normal;
}
.flow-arrow {
  font-size: 14px;
  color: #d1d5db;
}

.poster-tips {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.poster-tips b {
  font-size: 13px;
  color: var(--text-strong);
  margin-bottom: 4px;
}
.poster-tips span {
  font-size: 12px;
  color: var(--text-secondary);
}

.poster-contact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #f9fafb;
  border: 1px solid var(--border-subtle, #e5e7eb);
  padding: 12px 16px;
}
.poster-contact span {
  font-size: 12px;
  color: var(--text-secondary);
}

.deposit-warning {
  font-size: 11px;
  color: #f59e0b;
  margin-top: 2px;
}

.banner-error {
  padding: 10px 14px;
  border-radius: var(--radius-sm, 8px);
  background: var(--color-danger-soft, #fef2f2);
  border: 1px solid var(--color-danger-border, #fecaca);
  color: var(--color-danger, #dc2626);
  font-size: 13px;
}
</style>
