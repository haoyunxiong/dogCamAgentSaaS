import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getOrderCompletionState,
  parseRecipientInfo,
} from '../renderer/src/views/rental/order-fulfillment/orderFulfillmentUtils.js'

test('parseRecipientInfo extracts recipient fields from one-line pasted text', () => {
  const parsed = parseRecipientInfo('李双双 13800138000 四川省成都市武侯区天府长岛50号')

  assert.equal(parsed.name, '李双双')
  assert.equal(parsed.phone, '13800138000')
  assert.equal(parsed.province, '四川省')
  assert.equal(parsed.city, '成都市')
  assert.equal(parsed.district, '武侯区')
  assert.equal(parsed.address, '天府长岛50号')
})

test('getOrderCompletionState reports missing shipment fields before SF shipping', () => {
  const state = getOrderCompletionState({
    id: 13360,
    order_no: '',
    customer_name: '',
    customer_phone: '',
    province: '四川省',
    city: '成都市',
    district: '金牛区',
    address: '',
    fee: 60,
    deposit: 2000,
    unit_id: 7,
    unit_code: '大疆POCKET3-01',
    rent_start_date: '2026-06-13',
    rent_end_date: '2026-06-14',
    planned_ship_at: '2026-06-11 12:00:00',
    actual_ship_at: '',
    tracking_no: '',
  })

  assert.equal(state.primaryStatus, 'shipping_missing')
  assert.equal(state.label, '待补收货')
  assert.deepEqual(state.blockingFields, ['客户姓名', '客户手机号', '详细地址'])
  assert.ok(state.missingFields.includes('平台订单号'))
  assert.ok(state.missingFields.includes('运单号'))
  assert.equal(state.canCreateSfShipment, false)
})

test('getOrderCompletionState treats platform order number as follow-up only', () => {
  const state = getOrderCompletionState({
    order_no: '',
    customer_name: '李双双',
    customer_phone: '13800138000',
    province: '四川省',
    city: '成都市',
    district: '武侯区',
    address: '天府长岛50号',
    fee: 60,
    deposit: 2000,
    unit_id: 7,
    rent_start_date: '2026-06-13',
    rent_end_date: '2026-06-14',
    planned_ship_at: '2026-06-12 12:00:00',
    actual_ship_at: '',
    tracking_no: '',
  })

  assert.equal(state.primaryStatus, 'followup_missing')
  assert.equal(state.label, '待补单号')
  assert.deepEqual(state.blockingFields, [])
  assert.equal(state.canCreateSfShipment, true)
})
