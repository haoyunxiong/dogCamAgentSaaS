import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  DEFAULTS,
  buildDepositFreeCharge,
  getDefaultInquiryOptimizationConfig,
  normalizeInquiryOptimizationConfig,
  serializeInquiryOptimizationConfig,
} = require('../main/inquiryOptimizationConfig.js')

test('returns the expected inquiry optimization defaults', () => {
  assert.deepEqual(getDefaultInquiryOptimizationConfig(), DEFAULTS)
})

test('normalizes inquiry optimization config from mixed key styles and falls back on invalid values', () => {
  const cfg = normalizeInquiryOptimizationConfig({
    ANALYSIS_WINDOW_DAYS: '21',
    targetMonthlyRoiMin: '0.10',
    TARGET_MONTHLY_ROI_MAX: '0.15',
    PRICE_STEP: '3',
    MAX_PRICE_ADJUSTMENT: '12',
    minInquirySamples: '9',
    MIN_ORDER_SAMPLES: '4',
    PLATFORM_FEE_RATE: '0.016',
    DEPOSIT_FREE_PER_100_FEE: '1.5',
    depositFreeOrderCost: '3.5',
    SHIPPING_ALLOCATION_MODE: 'order_count',
    SHIPPING_BILL_REMINDER_DAY: '7',
  })

  assert.deepEqual(cfg, {
    analysisWindowDays: 21,
    targetMonthlyRoiMin: 0.1,
    targetMonthlyRoiMax: 0.15,
    priceStep: 3,
    maxPriceAdjustment: 12,
    minInquirySamples: 9,
    minOrderSamples: 4,
    platformFeeRate: 0.016,
    depositFreePer100Fee: 1.5,
    depositFreeOrderCost: 3.5,
    shippingAllocationMode: 'order_count',
    shippingBillReminderDay: 7,
  })

  const fallback = normalizeInquiryOptimizationConfig({
    analysisWindowDays: 'not-a-number',
    targetMonthlyRoiMin: '0.20',
    targetMonthlyRoiMax: '0.10',
    priceStep: '0',
    maxPriceAdjustment: '-8',
    minInquirySamples: '-1',
    minOrderSamples: '-2',
    platformFeeRate: 'bogus',
    depositFreePer100Fee: '',
    depositFreeOrderCost: undefined,
    shippingAllocationMode: 'revenue_share',
    shippingBillReminderDay: '99',
  })

  assert.equal(fallback.analysisWindowDays, DEFAULTS.analysisWindowDays)
  assert.equal(fallback.targetMonthlyRoiMin, 0.2)
  assert.equal(fallback.targetMonthlyRoiMax, 0.2)
  assert.equal(fallback.priceStep, 1)
  assert.equal(fallback.maxPriceAdjustment, 0)
  assert.equal(fallback.minInquirySamples, 0)
  assert.equal(fallback.minOrderSamples, 0)
  assert.equal(fallback.platformFeeRate, DEFAULTS.platformFeeRate)
  assert.equal(fallback.depositFreePer100Fee, DEFAULTS.depositFreePer100Fee)
  assert.equal(fallback.depositFreeOrderCost, DEFAULTS.depositFreeOrderCost)
  assert.equal(fallback.shippingAllocationMode, DEFAULTS.shippingAllocationMode)
  assert.equal(fallback.shippingBillReminderDay, 31)
})

test('serializes normalized config to database-ready uppercase keys', () => {
  const serialized = serializeInquiryOptimizationConfig({
    analysisWindowDays: 30,
    targetMonthlyRoiMin: 0.11,
    targetMonthlyRoiMax: 0.16,
    priceStep: 5,
    maxPriceAdjustment: 15,
    minInquirySamples: 8,
    minOrderSamples: 3,
    platformFeeRate: 0.016,
    depositFreePer100Fee: 1.5,
    depositFreeOrderCost: 3.5,
    shippingAllocationMode: 'order_count',
    shippingBillReminderDay: 5,
  })

  assert.equal(serialized.ANALYSIS_WINDOW_DAYS, '30')
  assert.equal(serialized.TARGET_MONTHLY_ROI_MIN, '0.11')
  assert.equal(serialized.TARGET_MONTHLY_ROI_MAX, '0.16')
  assert.equal(serialized.PRICE_STEP, '5')
  assert.equal(serialized.DEPOSIT_FREE_PER_100_FEE, '1.5')
  assert.equal(serialized.DEPOSIT_FREE_ORDER_COST, '3.5')
  assert.equal(serialized.SHIPPING_ALLOCATION_MODE, 'order_count')
  assert.equal(serialized.SHIPPING_BILL_REMINDER_DAY, '5')
})

test('calculates deposit-free completion charge per 100 yuan plus single-order cost', () => {
  assert.equal(buildDepositFreeCharge({ fee: 260, per100Fee: 1.5, orderCost: 3.5 }), 7.4)
})
