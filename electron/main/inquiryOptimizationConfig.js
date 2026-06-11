const DEFAULTS = Object.freeze({
  analysisWindowDays: 14,
  targetMonthlyRoiMin: 0.1,
  targetMonthlyRoiMax: 0.15,
  priceStep: 5,
  maxPriceAdjustment: 10,
  minInquirySamples: 5,
  minOrderSamples: 2,
  platformFeeRate: 0.016,
  depositFreePer100Fee: 1.5,
  depositFreeOrderCost: 3.5,
  shippingAllocationMode: 'order_count',
  shippingBillReminderDay: 1,
})

const CONFIG_KEY_MAP = Object.freeze({
  analysisWindowDays: 'ANALYSIS_WINDOW_DAYS',
  targetMonthlyRoiMin: 'TARGET_MONTHLY_ROI_MIN',
  targetMonthlyRoiMax: 'TARGET_MONTHLY_ROI_MAX',
  priceStep: 'PRICE_STEP',
  maxPriceAdjustment: 'MAX_PRICE_ADJUSTMENT',
  minInquirySamples: 'MIN_INQUIRY_SAMPLES',
  minOrderSamples: 'MIN_ORDER_SAMPLES',
  platformFeeRate: 'PLATFORM_FEE_RATE',
  depositFreePer100Fee: 'DEPOSIT_FREE_PER_100_FEE',
  depositFreeOrderCost: 'DEPOSIT_FREE_ORDER_COST',
  shippingAllocationMode: 'SHIPPING_ALLOCATION_MODE',
  shippingBillReminderDay: 'SHIPPING_BILL_REMINDER_DAY',
})

const ALLOWED_SHIPPING_ALLOCATION_MODES = new Set(['order_count'])

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toInteger(value, fallback = 0) {
  const number = Number.parseInt(String(value), 10)
  return Number.isFinite(number) ? number : fallback
}

function round2(value) {
  return Number(toNumber(value).toFixed(2))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function readConfigValue(input, fieldName, fallback) {
  const key = CONFIG_KEY_MAP[fieldName]
  if (!input || typeof input !== 'object') return fallback
  if (input[fieldName] !== undefined && input[fieldName] !== null && input[fieldName] !== '') return input[fieldName]
  if (key && input[key] !== undefined && input[key] !== null && input[key] !== '') return input[key]
  return fallback
}

function normalizeInquiryOptimizationConfig(input = {}) {
  const analysisWindowDays = Math.max(1, toInteger(readConfigValue(input, 'analysisWindowDays', DEFAULTS.analysisWindowDays), DEFAULTS.analysisWindowDays))
  let targetMonthlyRoiMin = toNumber(readConfigValue(input, 'targetMonthlyRoiMin', DEFAULTS.targetMonthlyRoiMin), DEFAULTS.targetMonthlyRoiMin)
  let targetMonthlyRoiMax = toNumber(readConfigValue(input, 'targetMonthlyRoiMax', DEFAULTS.targetMonthlyRoiMax), DEFAULTS.targetMonthlyRoiMax)
  if (targetMonthlyRoiMin > targetMonthlyRoiMax) {
    targetMonthlyRoiMax = targetMonthlyRoiMin
  }

  const priceStep = Math.max(1, toInteger(readConfigValue(input, 'priceStep', DEFAULTS.priceStep), DEFAULTS.priceStep))
  const maxPriceAdjustment = Math.max(0, toInteger(readConfigValue(input, 'maxPriceAdjustment', DEFAULTS.maxPriceAdjustment), DEFAULTS.maxPriceAdjustment))
  const minInquirySamples = Math.max(0, toInteger(readConfigValue(input, 'minInquirySamples', DEFAULTS.minInquirySamples), DEFAULTS.minInquirySamples))
  const minOrderSamples = Math.max(0, toInteger(readConfigValue(input, 'minOrderSamples', DEFAULTS.minOrderSamples), DEFAULTS.minOrderSamples))
  const platformFeeRate = Math.max(0, toNumber(readConfigValue(input, 'platformFeeRate', DEFAULTS.platformFeeRate), DEFAULTS.platformFeeRate))
  const depositFreePer100Fee = Math.max(0, toNumber(readConfigValue(input, 'depositFreePer100Fee', DEFAULTS.depositFreePer100Fee), DEFAULTS.depositFreePer100Fee))
  const depositFreeOrderCost = Math.max(0, toNumber(readConfigValue(input, 'depositFreeOrderCost', DEFAULTS.depositFreeOrderCost), DEFAULTS.depositFreeOrderCost))
  const shippingAllocationModeRaw = String(readConfigValue(input, 'shippingAllocationMode', DEFAULTS.shippingAllocationMode) || '').trim()
  const shippingAllocationMode = ALLOWED_SHIPPING_ALLOCATION_MODES.has(shippingAllocationModeRaw)
    ? shippingAllocationModeRaw
    : DEFAULTS.shippingAllocationMode
  const shippingBillReminderDay = clamp(
    Math.max(1, toInteger(readConfigValue(input, 'shippingBillReminderDay', DEFAULTS.shippingBillReminderDay), DEFAULTS.shippingBillReminderDay)),
    1,
    31,
  )

  return {
    analysisWindowDays,
    targetMonthlyRoiMin,
    targetMonthlyRoiMax,
    priceStep,
    maxPriceAdjustment,
    minInquirySamples,
    minOrderSamples,
    platformFeeRate: toNumber(platformFeeRate),
    depositFreePer100Fee: toNumber(depositFreePer100Fee),
    depositFreeOrderCost: toNumber(depositFreeOrderCost),
    shippingAllocationMode,
    shippingBillReminderDay,
  }
}

function getDefaultInquiryOptimizationConfig() {
  return { ...DEFAULTS }
}

function serializeInquiryOptimizationConfig(config = {}) {
  const normalized = normalizeInquiryOptimizationConfig(config)
  const serialized = {}
  for (const [fieldName, key] of Object.entries(CONFIG_KEY_MAP)) {
    serialized[fieldName] = String(normalized[fieldName])
    serialized[key] = serialized[fieldName]
  }
  return serialized
}

function buildDepositFreeCharge({ fee, per100Fee, orderCost } = {}) {
  const amount = Math.max(0, toNumber(fee))
  const rate = Math.max(0, toNumber(per100Fee))
  const fixedCost = Math.max(0, toNumber(orderCost))
  return round2((amount * rate / 100) + fixedCost)
}

module.exports = {
  ALLOWED_SHIPPING_ALLOCATION_MODES,
  CONFIG_KEY_MAP,
  DEFAULTS,
  buildDepositFreeCharge,
  getDefaultInquiryOptimizationConfig,
  normalizeInquiryOptimizationConfig,
  serializeInquiryOptimizationConfig,
}
