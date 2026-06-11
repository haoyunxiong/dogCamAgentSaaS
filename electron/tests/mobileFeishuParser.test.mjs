import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAvailabilityPayload,
  parseRecipientAddress,
  parseFeishuRentalCommand,
} from '../main/mobileFeishuParser.js'

const modelCodes = ['大疆pocket3', 'pocket4', 'acepro2', 'g7x2']
const baseNow = new Date('2026-05-21T10:00:00+08:00')

test('parses availability command with start date and rent days', () => {
  const parsed = parseFeishuRentalCommand('查档期 pocket4 5.22 租5天 发成都武侯', { modelCodes, now: baseNow })

  assert.equal(parsed.intent, 'availability')
  assert.equal(parsed.modelCode, 'pocket4')
  assert.equal(parsed.rentStartDate, '2026-05-22')
  assert.equal(parsed.rentEndDate, '2026-05-26')
  assert.equal(parsed.rentDays, 5)
  assert.equal(parsed.province, '四川省')
  assert.equal(parsed.city, '成都')
  assert.equal(parsed.district, '武侯')
  assert.equal(parsed.transitDays, undefined)
})

test('matches short model alias against full inventory model code', () => {
  const parsed = parseFeishuRentalCommand('查档期 pocket4 5.22 租5天', {
    modelCodes: ['大疆POCKET4'],
    now: baseNow,
  })

  assert.equal(parsed.modelCode, '大疆POCKET4')
})

test('parses availability command with date range', () => {
  const parsed = parseFeishuRentalCommand('查档期 acepro2 5月22到5月26 顺丰到杭州西湖区', { modelCodes, now: baseNow })

  assert.equal(parsed.intent, 'availability')
  assert.equal(parsed.modelCode, 'acepro2')
  assert.equal(parsed.rentStartDate, '2026-05-22')
  assert.equal(parsed.rentEndDate, '2026-05-26')
  assert.equal(parsed.rentDays, 5)
  assert.equal(parsed.city, '杭州')
  assert.equal(parsed.district, '西湖区')
})

test('parses booking command with recipient and fee', () => {
  const parsed = parseFeishuRentalCommand(
    '记档期 pocket4 5.22租5天 李双双 13800138000 四川省成都市武侯区天府长岛50号 租金300',
    { modelCodes, now: baseNow },
  )

  assert.equal(parsed.intent, 'booking')
  assert.equal(parsed.modelCode, 'pocket4')
  assert.equal(parsed.customerName, '李双双')
  assert.equal(parsed.customerPhone, '13800138000')
  assert.equal(parsed.province, '四川省')
  assert.equal(parsed.city, '成都市')
  assert.equal(parsed.district, '武侯区')
  assert.equal(parsed.address, '天府长岛50号')
  assert.equal(parsed.fee, 300)
})

test('parses pasted recipient info when address appears before phone', () => {
  const parsed = parseFeishuRentalCommand(
    '记档期 李双双 四川省成都市武侯区天府长岛50号 13800138000',
    { modelCodes, now: baseNow },
  )

  assert.equal(parsed.intent, 'booking')
  assert.equal(parsed.customerName, '李双双')
  assert.equal(parsed.customerPhone, '13800138000')
  assert.equal(parsed.province, '四川省')
  assert.equal(parsed.city, '成都市')
  assert.equal(parsed.district, '武侯区')
  assert.equal(parsed.address, '天府长岛50号')
})

test('parses a full pasted delivery address for mobile availability queries', () => {
  const parsed = parseRecipientAddress('张三 13800138000 四川省绵阳市涪城区未名湖畔')

  assert.deepEqual(parsed, {
    province: '四川省',
    city: '绵阳市',
    district: '涪城区',
    address: '未名湖畔',
  })
})

test('parses fuzzy city-level delivery regions for availability queries', () => {
  const parsed = parseRecipientAddress('四川省成都市')

  assert.deepEqual(parsed, {
    province: '四川省',
    city: '成都市',
    district: '',
    address: '',
  })
})

test('does not include the delivery verb in a full address from chat text', () => {
  const parsed = parseFeishuRentalCommand(
    '查档期 acepro2 2026-05-25到2026-05-28 发四川省绵阳市涪城区未名湖畔',
    { modelCodes, now: baseNow },
  )

  assert.equal(parsed.province, '四川省')
  assert.equal(parsed.city, '绵阳市')
  assert.equal(parsed.district, '涪城区')
  assert.equal(parsed.address, '未名湖畔')
})

test('buildAvailabilityPayload normalizes defaults for schedule API', () => {
  const parsed = parseFeishuRentalCommand('查档期 pocket4 5.22 租5天 发成都武侯', { modelCodes, now: baseNow })
  const payload = buildAvailabilityPayload(parsed)

  assert.deepEqual(payload, {
    modelCode: 'pocket4',
    rentStartDate: '2026-05-22',
    rentEndDate: '2026-05-26',
    returnBufferDays: 2,
    shippingMode: 'land',
    province: '四川省',
    city: '成都',
    district: '武侯',
    address: '',
    customerName: '',
    customerPhone: '',
  })
})

test('keeps explicit logistics transit days when provided', () => {
  const parsed = parseFeishuRentalCommand('查档期 pocket4 5.22 租5天 发成都武侯 物流2天', { modelCodes, now: baseNow })
  const payload = buildAvailabilityPayload(parsed)

  assert.equal(parsed.transitDays, 2)
  assert.equal(payload.transitDays, 2)
})

test('parses fulfillment task commands', () => {
  assert.equal(parseFeishuRentalCommand('今日待发货', { modelCodes, now: baseNow }).intent, 'fulfillment_tasks')
  assert.equal(parseFeishuRentalCommand('明日待归还', { modelCodes, now: baseNow }).taskDatePreset, 'tomorrow')
  assert.equal(parseFeishuRentalCommand('今天待办', { modelCodes, now: baseNow }).taskType, 'all')
})
