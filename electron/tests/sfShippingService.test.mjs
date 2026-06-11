import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  SF_PICKUP_TIME_PRESETS,
  SF_PRODUCTS,
  buildCancelOrderPayload,
  buildBatchShipmentPayloadFromOrder,
  buildExpressOrderPayload,
  buildIntraCityQuotePayload,
  buildPreOrderPayload,
  buildPromiseTimePayload,
  buildRouteQueryPayload,
  buildWaybillFeePayload,
  isMonthlyCardFailureMessage,
  mapFilterResult,
  normalizeCancelOrderResult,
  normalizeCreateOrderResult,
  normalizeDeliveryTimeQuoteResult,
  normalizeIntraCityQuoteResult,
  normalizeOrderSearchResult,
  normalizePreOrderResult,
  normalizePromiseTimeResult,
  normalizeRouteResult,
  normalizeWaybillFeeResult,
  redactShipmentSecrets,
  resolveActualPaidPolicy,
  validatePickupTimeWindow,
  validateCreateOrderPrerequisites,
  validateExpressShipmentData,
} = require('../main/sfShippingService.js')

const completeInput = {
  shipmentNo: 'SFSHIP202605260001',
  productType: 'sf_standard',
  monthlyCard: '1234567890',
  cargoName: '租赁相机',
  weightKg: 1,
  sender: {
    name: '小狗相机',
    mobile: '13800000000',
    province: '四川省',
    city: '成都市',
    district: '武侯区',
    address: '测试地址1号',
  },
  receiver: {
    name: '测试客户',
    mobile: '13900000000',
    province: '四川省',
    city: '绵阳市',
    district: '涪城区',
    address: '测试地址2号',
  },
}

test('uses confirmed domestic product identifiers and separates intra-city quoting', () => {
  assert.equal(SF_PRODUCTS.sf_standard.expressTypeId, 2)
  assert.equal(SF_PRODUCTS.sf_half_day.expressTypeId, 263)
  assert.equal(SF_PRODUCTS.sf_land_package.expressTypeId, 231)
  assert.equal(SF_PRODUCTS.sf_land_package.serviceKind, 'express')
  assert.equal(SF_PRODUCTS.sf_intra_city_quote.expressTypeId, null)
  assert.equal(SF_PRODUCTS.sf_intra_city_quote.serviceKind, 'intra_city_quote')
})

test('allows express precheck without a monthly card when contacts are complete', () => {
  assert.deepEqual(validateExpressShipmentData({
    ...completeInput,
    monthlyCard: '',
  }), { ok: true, errors: [] })
})

test('rejects incomplete express contacts and non-express products', () => {
  assert.deepEqual(validateExpressShipmentData({
    ...completeInput,
    receiver: { ...completeInput.receiver, address: '' },
  }), { ok: false, errors: ['收件人信息不完整：详细地址'] })

  assert.deepEqual(validateExpressShipmentData({
    ...completeInput,
    sender: { ...completeInput.sender, name: '', mobile: '', address: '' },
  }), { ok: false, errors: ['寄件人信息不完整：联系人、手机号、详细地址'] })

  assert.deepEqual(validateExpressShipmentData({
    ...completeInput,
    productType: 'sf_intra_city_quote',
  }), { ok: false, errors: ['当前产品不支持创建真实运单'] })
})

test('allows a real express order to proceed without a monthly card', () => {
  assert.deepEqual(validateCreateOrderPrerequisites({
    ...completeInput,
    monthlyCard: '',
    sendStartTime: '2026-05-27T10:00',
  }), { ok: true, errors: [] })
  assert.deepEqual(validateCreateOrderPrerequisites({
    ...completeInput,
    sendStartTime: '2026-05-27T17:00',
  }), { ok: true, errors: [] })
})

test('exposes the two usual pickup presets requested for express shipping', () => {
  assert.deepEqual(SF_PICKUP_TIME_PRESETS, [
    { key: 'morning', label: '上午 10:00-11:00', time: '10:00' },
    { key: 'evening', label: '傍晚 17:00', time: '17:00' },
  ])
})

test('requires pickup time between 08:00 and 20:00 for a real express order', () => {
  assert.deepEqual(validatePickupTimeWindow('2026-05-27T08:00'), { ok: true, errors: [] })
  assert.deepEqual(validatePickupTimeWindow('2026-05-27T20:00'), { ok: true, errors: [] })
  assert.deepEqual(validatePickupTimeWindow('2026-05-27T07:59'), {
    ok: false,
    errors: ['顺丰取件时间只能选择 08:00-20:00'],
  })
  assert.deepEqual(validatePickupTimeWindow('2026-05-27T20:01'), {
    ok: false,
    errors: ['顺丰取件时间只能选择 08:00-20:00'],
  })
  assert.deepEqual(validateCreateOrderPrerequisites({
    ...completeInput,
    sendStartTime: '',
  }), {
    ok: false,
    errors: ['请选择计划取件时间（可选上午 10:00-11:00 或傍晚 17:00）'],
  })
})

test('builds a mainland sender-paid express order payload from the selected product', () => {
  const payload = buildExpressOrderPayload({
    ...completeInput,
    productType: 'sf_half_day',
  })

  assert.equal(payload.orderId, 'SFSHIP202605260001')
  assert.equal(payload.expressTypeId, 263)
  assert.equal(payload.payMethod, 1)
  assert.equal(payload.monthlyCard, '1234567890')
  assert.equal(payload.contactInfoList[0].contactType, 1)
  assert.equal(payload.contactInfoList[1].contactType, 2)
  assert.equal(payload.contactInfoList[0].country, 'CN')
  assert.equal(payload.contactInfoList[1].country, 'CN')
  assert.deepEqual(payload.cargoDetails, [{ name: '租赁相机' }])
})

test('builds an express order payload for the new land package product', () => {
  const payload = buildExpressOrderPayload({
    ...completeInput,
    productType: 'sf_land_package',
  })

  assert.equal(payload.expressTypeId, 231)
})

test('omits monthly card from a real express order payload when sender falls back to寄付', () => {
  const payload = buildExpressOrderPayload({
    ...completeInput,
    monthlyCard: '',
  })

  assert.equal(payload.payMethod, 1)
  assert.equal(payload.monthlyCard, undefined)
})

test('detects monthly-card specific failure messages for sender-pay fallback', () => {
  assert.equal(isMonthlyCardFailureMessage('月结卡号不存在或不可用'), true)
  assert.equal(isMonthlyCardFailureMessage('MONTHLYCARD is invalid'), true)
  assert.equal(isMonthlyCardFailureMessage('收件地址校验失败'), false)
})

test('accepts an explicit express type override for supported express requests', () => {
  const payload = buildExpressOrderPayload({
    ...completeInput,
    expressTypeId: 999,
  })

  assert.equal(payload.expressTypeId, 999)
})

test('formats planned pickup time for the SF order API', () => {
  const payload = buildExpressOrderPayload({
    ...completeInput,
    sendStartTime: '2026-05-26T10:30',
  })

  assert.equal(payload.sendStartTm, '2026-05-26 10:30:00')
  assert.equal(payload.isDocall, 1)
})

test('omits a missing monthly card from pre-order payloads while retaining routing data', () => {
  const withoutCard = buildPreOrderPayload({
    ...completeInput,
    monthlyCard: '',
  })
  const withCard = buildPreOrderPayload(completeInput)

  assert.equal(withoutCard.orderId, completeInput.shipmentNo)
  assert.equal(withoutCard.expressTypeId, 2)
  assert.equal(withoutCard.monthlyCard, undefined)
  assert.equal(withCard.monthlyCard, '1234567890')
})

test('builds promise-time lookup using waybill and monthly card', () => {
  assert.deepEqual(buildPromiseTimePayload({
    waybillNo: 'SF100',
    monthlyCard: '1234567890',
  }), {
    searchNo: 'SF100',
    checkType: 2,
    checkNos: ['1234567890'],
  })
})

test('builds promise-time lookup using a mobile number when monthly card is absent', () => {
  assert.deepEqual(buildPromiseTimePayload({
    waybillNo: 'SF101',
    verifyMobile: '13800000000',
  }), {
    searchNo: 'SF101',
    checkType: 1,
    checkNos: ['13800000000'],
  })
})

test('builds cancel, route and billed-fee requests for an existing waybill', () => {
  assert.deepEqual(buildCancelOrderPayload({
    shipmentNo: 'SFSHIP202605260001',
    waybillNo: 'SF100000000001',
  }), {
    language: 'zh-CN',
    orderId: 'SFSHIP202605260001',
    dealType: 2,
    waybillNoInfoList: [{ waybillNo: 'SF100000000001', waybillType: 1 }],
  })
  assert.deepEqual(buildRouteQueryPayload({ waybillNo: 'SF100000000001' }), {
    language: '0',
    trackingType: '1',
    trackingNumber: ['SF100000000001'],
    methodType: '1',
  })
  assert.deepEqual(buildRouteQueryPayload({ waybillNo: 'SF100000000001', checkPhoneNo: '13900001111' }), {
    language: '0',
    trackingType: '1',
    trackingNumber: ['SF100000000001'],
    methodType: '1',
    checkPhoneNo: '1111',
  })
  assert.deepEqual(buildWaybillFeePayload({ waybillNo: 'SF100000000001', checkPhoneNo: '13900001111', monthlyCard: '7551234567' }), {
    trackingType: '1',
    trackingNum: 'SF100000000001',
    phone: '1111',
    monthlyCard: '7551234567',
  })
})

test('builds a linked shipment payload from a pending rental order for batch shipping', () => {
  const payload = buildBatchShipmentPayloadFromOrder({
    id: 42,
    customer_name: '张三',
    customer_phone: '13900001111',
    province: '四川省',
    city: '成都市',
    district: '武侯区',
    address: '天府三街 1 号',
    planned_ship_at: '2026-05-28T10:00:00',
    model_code: '大疆POCKET3',
  }, {
    productCode: 'sf_half_day',
    cargoName: '相机租赁设备',
    weightKg: 1.5,
    senderName: '小狗相机',
    senderMobile: '13800000000',
    senderProvince: '四川省',
    senderCity: '成都市',
    senderDistrict: '金牛区',
    senderAddress: '寄件地址',
  })

  assert.deepEqual(payload, {
    linkedOrderId: 42,
    productCode: 'sf_half_day',
    senderName: '小狗相机',
    senderMobile: '13800000000',
    senderProvince: '四川省',
    senderCity: '成都市',
    senderDistrict: '金牛区',
    senderAddress: '寄件地址',
    receiverName: '张三',
    receiverMobile: '13900001111',
    receiverProvince: '四川省',
    receiverCity: '成都市',
    receiverDistrict: '武侯区',
    receiverAddress: '天府三街 1 号',
    cargoName: '相机租赁设备',
    weightKg: 1.5,
    plannedSendAt: '2026-05-28T10:00:00',
  })
})

test('normalizes express estimated price together with delivery time', () => {
  const result = normalizeDeliveryTimeQuoteResult({
    success: true,
    msgData: {
      deliverTmDto: [{
        expressTypeId: 2,
        deliverTime: '2026-05-29 18:00:00',
        fee: '16.50',
      }],
    },
  })

  assert.equal(result.ok, true)
  assert.equal(result.expectedArriveAt, '2026-05-29 18:00:00')
  assert.equal(result.estimatedFee, 16.5)
})

test('builds intra-city quote data without placing credentials in the service payload', () => {
  const payload = buildIntraCityQuotePayload({
    config: {
      projectCode: 'P1',
      shopId: 'S1',
      shopType: 2,
      accessCode: 'access-secret',
      checkword: 'check-secret',
    },
    cityName: '成都市',
    address: '四川省成都市武侯区测试路1号',
    weightGram: 1000,
  })

  assert.equal(payload.ProjectCode, 'P1')
  assert.equal(payload.ShopId, 'S1')
  assert.equal(payload.ShopType, 2)
  assert.equal(payload.CityName, '成都市')
  assert.equal(payload.UserAddress, '四川省成都市武侯区测试路1号')
  assert.equal(payload.weight, 1000)
  assert.equal(payload.AccessCode, undefined)
  assert.equal(payload.Checkword, undefined)
})

test('maps SF filter results without treating uncertain states as success', () => {
  assert.deepEqual(mapFilterResult(1), { status: 'manual_review', label: '待顺丰人工确认', tone: 'warning' })
  assert.deepEqual(mapFilterResult(2), { status: 'waybill_created', label: '可收派', tone: 'success' })
  assert.deepEqual(mapFilterResult(3), { status: 'rejected', label: '不可收派', tone: 'danger' })
  assert.deepEqual(mapFilterResult(4), { status: 'manual_review', label: '结果待确认', tone: 'warning' })
})

test('normalizes pre-order, create-order, recovery and promise-time results', () => {
  const precheck = normalizePreOrderResult({
    success: true,
    msg: '预校验完成',
    msgData: {
      orderId: 'S001',
      filterResult: 2,
      serviceList: [{ expressTypeId: 2, deliverTm: '2026-05-27 18:00:00' }],
    },
  })
  const createOrder = normalizeCreateOrderResult({
    success: true,
    msg: '下单完成',
    msgData: {
      orderId: 'S001',
      filterResult: 2,
      waybillNoInfoList: [{ waybillType: 1, waybillNo: 'SF100000000001' }],
      expectedArriveAt: '2026-05-27 18:00:00',
    },
  })
  const recovered = normalizeOrderSearchResult({
    success: true,
    msg: '查询完成',
    msgData: {
      orderId: 'S001',
      filterResult: 2,
      waybillNoInfoList: [{ waybillType: 1, waybillNo: 'SF100000000002' }],
    },
  })
  const promise = normalizePromiseTimeResult({
    success: true,
    msg: '时效查询完成',
    msgData: { searchNo: 'SF100000000001', promiseTm: '2026-05-27 18:00:00' },
  })

  assert.equal(precheck.ok, true)
  assert.equal(precheck.message, '预校验完成')
  assert.equal(precheck.orderId, 'S001')
  assert.equal(precheck.orderStatus, 'waybill_created')
  assert.deepEqual(precheck.serviceList, [{ expressTypeId: 2, deliverTm: '2026-05-27 18:00:00' }])
  assert.equal(createOrder.message, '下单完成')
  assert.equal(createOrder.filterResult, 2)
  assert.equal(createOrder.trackingNo, 'SF100000000001')
  assert.equal(createOrder.expectedArriveAt, '2026-05-27 18:00:00')
  assert.equal(createOrder.orderStatus, 'waybill_created')
  assert.equal(recovered.message, '查询完成')
  assert.equal(recovered.filterResult, 2)
  assert.equal(recovered.trackingNo, 'SF100000000002')
  assert.equal(recovered.expectedArriveAt, null)
  assert.equal(recovered.orderStatus, 'waybill_created')
  assert.equal(promise.message, '时效查询完成')
  assert.equal(promise.waybillNo, 'SF100000000001')
  assert.equal(promise.expectedArriveAt, '2026-05-27 18:00:00')
  assert.equal(promise.promiseTime, '2026-05-27 18:00:00')
})

test('normalizes cancelled orders, route timelines and billed fee components', () => {
  const cancelled = normalizeCancelOrderResult({
    success: true,
    msg: '取消成功',
    msgData: { orderId: 'S001' },
  })
  const routes = normalizeRouteResult({
    success: true,
    msgData: {
      routeResps: [{
        mailNo: 'SF100000000001',
        routes: [
          { acceptTime: '2026-05-28 10:00:00', acceptAddress: '成都市', remark: '顺丰已收取快件', opCode: '50' },
          { acceptTime: '2026-05-28 18:00:00', acceptAddress: '绵阳市', remark: '运输中', opCode: '36' },
        ],
      }],
    },
  })
  const fee = normalizeWaybillFeeResult({
    success: true,
    msgData: {
      waybillNo: 'SF100000000001',
      feeList: [
        { feeType: '运费', feeValue: '16.50', paymentTypeCode: '1', settlementTypeCode: '2' },
        { feeType: '保价费', feeValue: '2.00', paymentTypeCode: '1', settlementTypeCode: '2' },
      ],
    },
  })

  assert.equal(cancelled.ok, true)
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(routes.waybillNo, 'SF100000000001')
  assert.equal(routes.latestStatus, '运输中')
  assert.equal(routes.routes.length, 2)
  assert.deepEqual(fee.items, [
    { type: '运费', name: '运费', value: 16.5, paymentTypeCode: '1', settlementTypeCode: '2' },
    { type: '保价费', name: '保价费', value: 2, paymentTypeCode: '1', settlementTypeCode: '2' },
  ])
  assert.equal(fee.billedFee, 18.5)
})

test('surfaces SF route reject reasons and parses waybill fee list payloads', () => {
  const rejectedRoutes = normalizeRouteResult({
    success: true,
    msgData: {
      routeResps: [{
        mailNo: 'SF0213872605463',
        routes: [],
        reasonRemark: '月结卡号不匹配',
        reasonCode: '20028',
      }],
    },
  })
  const fee = normalizeWaybillFeeResult({
    success: true,
    msgData: {
      waybillInfo: { waybillNo: 'SF0213872605463' },
      waybillFeeList: [
        { feeTypeCode: 'FREIGHT', feeName: '运费', feeAmt: '12.00' },
        { feeTypeCode: 'VAS', feeName: '增值服务费', feeAmt: '3.50' },
      ],
    },
  })

  assert.equal(rejectedRoutes.ok, false)
  assert.equal(rejectedRoutes.message, '月结卡号不匹配')
  assert.equal(rejectedRoutes.reasonCode, '20028')
  assert.equal(fee.waybillNo, 'SF0213872605463')
  assert.equal(fee.billedFee, 15.5)
  assert.deepEqual(fee.items.map((item) => [item.type, item.name, item.value]), [
    ['FREIGHT', '运费', 12],
    ['VAS', '增值服务费', 3.5],
  ])
})

test('defaults actual payment from billed fee and preserves a manual override', () => {
  assert.deepEqual(resolveActualPaidPolicy({
    billedFee: 18.5,
    existingActualPaidFee: null,
    existingSource: '',
  }), {
    ok: true,
    actualPaidFee: 18.5,
    source: 'billed_fee',
    note: '',
  })
  assert.deepEqual(resolveActualPaidPolicy({
    billedFee: 19,
    existingActualPaidFee: 17,
    existingSource: 'manual',
    existingNote: '优惠后实扣',
  }), {
    ok: true,
    actualPaidFee: 17,
    source: 'manual',
    note: '优惠后实扣',
  })
  assert.deepEqual(resolveActualPaidPolicy({
    billedFee: 18.5,
    requestedActualPaidFee: 17,
    requestedNote: '',
  }), {
    ok: false,
    message: '实际支付金额与顺丰清单金额不一致时，请填写修正备注',
  })
  assert.deepEqual(resolveActualPaidPolicy({
    billedFee: null,
    requestedActualPaidFee: 17,
    requestedNote: '',
  }), {
    ok: true,
    actualPaidFee: 17,
    source: 'manual',
    note: '',
  })
})

test('does not treat an SF string false response as a successful order result', () => {
  const result = normalizeCreateOrderResult({
    success: 'false',
    errorMsg: '地址不可达',
    msgData: { filterResult: 3 },
  })

  assert.equal(result.ok, false)
  assert.equal(result.filterResult, 3)
  assert.equal(result.message, '地址不可达')
})

test('explains when a created waybill does not yet have promise-time data', () => {
  const result = normalizePromiseTimeResult({
    success: false,
    errorCode: '20010',
    errorMsg: '查询清单结果为空',
    msgData: null,
  })

  assert.equal(result.ok, false)
  assert.equal(result.pending, true)
  assert.equal(result.message, '运单已创建，但当前还没有预计派送时间；通常需揽收或产生运输信息后再查询。')
})

test('normalizes an intra-city fee and time quote result', () => {
  const result = normalizeIntraCityQuoteResult({
    Head: 'OK',
    PromiseDeliveryTime: 50,
    TotalPrice: 1800,
    DeliveryDistanceMeter: 7200,
  })

  assert.deepEqual(result, {
    ok: true,
    message: '预计 50 分钟送达，距离 7.2 km',
    fee: 18,
    feeCents: 1800,
    transitMinutes: 50,
    distanceMeters: 7200,
    raw: { Head: 'OK', PromiseDeliveryTime: 50, TotalPrice: 1800, DeliveryDistanceMeter: 7200 },
  })
})

test('recursively hides credentials and masks monthly cards in stored summaries', () => {
  assert.deepEqual(redactShipmentSecrets({
    accessToken: 'token',
    nested: {
      partnerSecret: 'partner-secret',
      Checkword: 'check-secret',
      accessCode: 'access-secret',
      monthlyCard: '1234567890',
    },
    rows: [{ monthly_card: '1234' }],
    name: 'ok',
  }), {
    accessToken: '[hidden]',
    nested: {
      partnerSecret: '[hidden]',
      Checkword: '[hidden]',
      accessCode: '[hidden]',
      monthlyCard: '******7890',
    },
    rows: [{ monthly_card: '****1234' }],
    name: 'ok',
  })
})
