import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  allocateMonthlyShippingExpenseByOrderCount,
  buildDepositFreeCharge,
  buildPlatformFeeCharge,
  summarizeInquiryOptimization,
} = require('../main/inquiryOptimizationEngine.js')

test('allocates monthly shipping expense evenly by order count with remainder on the last order', () => {
  const rows = allocateMonthlyShippingExpenseByOrderCount({
    total: 301,
    orders: [{ id: 1 }, { id: 2 }, { id: 3 }],
  })

  assert.deepEqual(rows, [
    { orderId: 1, amount: 100.33 },
    { orderId: 2, amount: 100.33 },
    { orderId: 3, amount: 100.34 },
  ])
})

test('exposes platform fee and deposit-free cost helpers', () => {
  assert.equal(buildPlatformFeeCharge({ revenue: 880, rate: 0.016 }), 14.08)
  assert.equal(buildDepositFreeCharge({ fee: 260, per100Fee: 1.5, orderCost: 3.5 }), 7.4)
})

test('summarizes inquiry optimization recommendations with cost breakdown and restock action', () => {
  const result = summarizeInquiryOptimization({
    config: {
      analysisWindowDays: 14,
      targetMonthlyRoiMin: 0.1,
      targetMonthlyRoiMax: 0.15,
      minInquirySamples: 5,
      minOrderSamples: 2,
      priceStep: 5,
      maxPriceAdjustment: 10,
      platformFeeRate: 0.016,
      depositFreePer100Fee: 1.5,
      depositFreeOrderCost: 3.5,
      shippingAllocationMode: 'order_count',
      shippingBillReminderDay: 1,
    },
    models: [{
      modelCode: 'POCKET3',
      inquiries: 20,
      available: 6,
      unavailable: 14,
      converted: 5,
      availableNotConverted: 1,
      inventoryUnits: 3,
      activeAssetCost: 6000,
      netProfit: 420,
      grossRevenue: 880,
      finalAvg: 176,
      depositFreeOrderCount: 4,
      shippingExpense: 30,
      repairCost: 12.5,
      missingCostData: false,
    }],
  })

  assert.equal(result.config.shippingAllocationMode, 'order_count')
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].action, 'restock')
  assert.equal(result.rows[0].monthlyRoi, 0.15)
  assert.equal(result.rows[0].costs.platformFee, 14.08)
  assert.equal(result.rows[0].costs.depositFreeCharge, 24.56)
  assert.equal(result.rows[0].costs.shippingExpense, 30)
  assert.match(result.rows[0].reasonSummary, /无档率/)
  assert.equal(result.summary.modelCount, 1)
  assert.equal(result.summary.actionCounts.restock, 1)
})
