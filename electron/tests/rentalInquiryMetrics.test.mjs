import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  buildInquiryEventRecord,
  summarizeInquiryStats,
} = require('../main/rentalInquiryMetrics.js')

test('builds inquiry event record from availability result', () => {
  const record = buildInquiryEventRecord({
    source: 'feishu',
    storeId: 1,
    chatId: 'oc_123',
    messageId: 'om_456',
    parsed: {
      text: '查档期 pocket3 6.1到6.3 发成都武侯',
      modelCode: '大疆POCKET3',
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-03',
      rentDays: 3,
      province: '四川省',
      city: '成都',
      district: '武侯',
      address: '成都武侯',
      shippingMode: 'land',
    },
    availability: {
      ok: true,
      available: true,
      modelCode: '大疆POCKET3',
      plan: {
        rentStartDate: '2026-06-01',
        rentEndDate: '2026-06-03',
        shipDate: '2026-05-31',
        arriveDate: '2026-06-01',
      },
      quote: { ok: true, totalPrice: 120, days: 3 },
      depositExemption: { ok: true, summary: '免押：芝麻分 600+' },
      counts: { totalUnits: 7, availableUnits: 2, conflictUnits: 5 },
    },
  })

  assert.equal(record.source, 'feishu')
  assert.equal(record.storeId, 1)
  assert.equal(record.modelCode, '大疆POCKET3')
  assert.equal(record.rentDays, 3)
  assert.equal(record.available, 1)
  assert.equal(record.availableUnitCount, 2)
  assert.equal(record.quotedPrice, 120)
  assert.equal(record.depositSummary, '免押：芝麻分 600+')
})

test('summarizes inquiry rows by model with conversion rate and price averages', () => {
  const summary = summarizeInquiryStats([
    { model_code: '大疆POCKET3', available: 1, quoted_price: 120, final_fee: 118, order_id: 10 },
    { model_code: '大疆POCKET3', available: 1, quoted_price: 120, final_fee: null, order_id: null },
    { model_code: '大疆POCKET3', available: 0, quoted_price: 0, final_fee: null, order_id: null },
    { model_code: 'g12', available: 1, quoted_price: 80, final_fee: 80, order_id: 11 },
  ])

  assert.equal(summary.total.inquiries, 4)
  assert.equal(summary.total.converted, 2)
  assert.equal(summary.byModel.length, 2)
  assert.deepEqual(summary.byModel[0], {
    modelCode: '大疆POCKET3',
    inquiries: 3,
    available: 2,
    unavailable: 1,
    converted: 1,
    availableNotConverted: 1,
    conversionRate: 0.3333,
    avgQuotedPrice: 120,
    avgFinalFee: 118,
  })
})
