import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  buildDepositExemptionSummary,
  buildPricingRowsFromLadder,
  pickDepositExemptionRule,
  resolveQuoteFromPricingRows,
  summarizePricingRowsByModel,
} = require('../main/rentalOpsRules.js')

test('resolves exact-day quote from configured total price row', () => {
  const quote = resolveQuoteFromPricingRows([
    { model_code: '大疆POCKET4', min_days: 1, max_days: 1, total_price: 99, daily_price: 99, extension_daily_price: 80, active: 1 },
    { model_code: '大疆POCKET4', min_days: 2, max_days: 2, total_price: 188, daily_price: 94, extension_daily_price: 80, active: 1 },
    { model_code: '大疆POCKET4', min_days: 3, max_days: 3, total_price: 269, daily_price: 89.67, extension_daily_price: 75, active: 1 },
  ], 2)

  assert.equal(quote.ok, true)
  assert.equal(quote.totalPrice, 188)
  assert.equal(quote.extensionDays, 0)
  assert.equal(quote.source, 'exact')
})

test('extends quote with configured extra daily price after max configured tier', () => {
  const quote = resolveQuoteFromPricingRows([
    { model_code: '大疆POCKET4', min_days: 3, max_days: 3, total_price: 269, daily_price: 89.67, extension_daily_price: 75, active: 1 },
  ], 5)

  assert.equal(quote.ok, true)
  assert.equal(quote.baseDays, 3)
  assert.equal(quote.extensionDays, 2)
  assert.equal(quote.extensionDailyPrice, 75)
  assert.equal(quote.totalPrice, 419)
  assert.equal(quote.source, 'extended')
})

test('selects deposit exemption rule by asset value range', () => {
  const rule = pickDepositExemptionRule([
    { min_asset_value: 0, max_asset_value: 1999, min_zhima_score: 600, adult_required: 1, real_name_required: 1, unsupported_cert_text: '港澳通行证不支持', deposit_mode: 'asset_value', fixed_deposit_amount: 0, active: 1, sort_order: 10 },
    { min_asset_value: 2000, max_asset_value: 3999, min_zhima_score: 650, adult_required: 1, real_name_required: 1, unsupported_cert_text: '港澳通行证不支持', deposit_mode: 'asset_value', fixed_deposit_amount: 0, active: 1, sort_order: 20 },
  ], 3100)

  assert.equal(rule.min_zhima_score, 650)
  assert.equal(rule.deposit_mode, 'asset_value')
})

test('builds exemption summary with fallback full deposit amount from asset value', () => {
  const summary = buildDepositExemptionSummary({
    min_zhima_score: 650,
    adult_required: 1,
    real_name_required: 1,
    unsupported_cert_text: '港澳通行证不支持',
    deposit_mode: 'asset_value',
    fixed_deposit_amount: 0,
  }, 3100)

  assert.equal(summary, '免押：芝麻分 650+，需成年，需实名审核，港澳通行证不支持；未通过需全额押金 ¥3100.00')
})

test('builds staircase pricing rows from one model ladder config', () => {
  const rows = buildPricingRowsFromLadder({
    modelCode: '大疆POCKET4',
    tierPrices: [50, 70, 90, 110, 140],
    extensionDailyPrice: 18,
    deposit: 0,
    remark: '标准价',
    active: 1,
  })

  assert.equal(rows.length, 5)
  assert.deepEqual(rows.map((row) => row.max_days), [1, 2, 3, 4, 5])
  assert.deepEqual(rows.map((row) => row.total_price), [50, 70, 90, 110, 140])
  assert.equal(rows[4].extension_daily_price, 18)
  assert.equal(rows[4].daily_price, 28)
})

test('summarizes flat pricing rows back into per-model ladder config', () => {
  const groups = summarizePricingRowsByModel([
    { id: 11, model_code: '大疆POCKET4', min_days: 1, max_days: 1, total_price: 50, daily_price: 50, extension_daily_price: 18, deposit: 0, remark: '标准价', active: 1 },
    { id: 12, model_code: '大疆POCKET4', min_days: 2, max_days: 2, total_price: 70, daily_price: 35, extension_daily_price: 18, deposit: 0, remark: '标准价', active: 1 },
    { id: 13, model_code: '大疆POCKET4', min_days: 3, max_days: 3, total_price: 90, daily_price: 30, extension_daily_price: 18, deposit: 0, remark: '标准价', active: 1 },
    { id: 14, model_code: '大疆POCKET4', min_days: 4, max_days: 4, total_price: 110, daily_price: 27.5, extension_daily_price: 18, deposit: 0, remark: '标准价', active: 1 },
    { id: 15, model_code: '大疆POCKET4', min_days: 5, max_days: 5, total_price: 140, daily_price: 28, extension_daily_price: 18, deposit: 0, remark: '标准价', active: 1 },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].modelCode, '大疆POCKET4')
  assert.equal(groups[0].extensionDailyPrice, 18)
  assert.deepEqual(groups[0].tiers.map((tier) => tier.day), [1, 2, 3, 4, 5])
  assert.deepEqual(groups[0].tiers.map((tier) => tier.totalPrice), [50, 70, 90, 110, 140])
})
