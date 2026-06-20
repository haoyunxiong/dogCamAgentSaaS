const SF_PRODUCTS = Object.freeze({
  sf_standard: Object.freeze({ label: '顺丰标快', expressTypeId: 2, serviceKind: 'express' }),
  sf_half_day: Object.freeze({ label: '顺丰半日达', expressTypeId: 263, serviceKind: 'express' }),
  sf_land_package: Object.freeze({ label: '陆运包裹', expressTypeId: 231, serviceKind: 'express' }),
  sf_intra_city_quote: Object.freeze({ label: '顺丰同城询价', expressTypeId: null, serviceKind: 'intra_city_quote' }),
})
const SF_PICKUP_TIME_PRESETS = Object.freeze([
  Object.freeze({ key: 'morning', label: '上午 10:00-11:00', time: '10:00' }),
  Object.freeze({ key: 'evening', label: '傍晚 17:00', time: '17:00' }),
])

function text(value) {
  return String(value ?? '').trim()
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function validateExpressShipmentData({ sender, receiver, productType } = {}) {
  const product = SF_PRODUCTS[productType]
  if (!product || product.serviceKind !== 'express') {
    return { ok: false, errors: ['当前产品不支持创建真实运单'] }
  }

  const errors = []
  for (const [label, contact] of [['寄件人', sender], ['收件人', receiver]]) {
    const missing = [
      ['name', '联系人'],
      ['mobile', '手机号'],
      ['province', '省份'],
      ['city', '城市'],
      ['address', '详细地址'],
    ].filter(([field]) => !text(contact?.[field])).map(([, fieldLabel]) => fieldLabel)
    if (missing.length) errors.push(`${label}信息不完整：${missing.join('、')}`)
  }
  return { ok: errors.length === 0, errors }
}

function validatePickupTimeWindow(value) {
  const normalized = text(value).replace(' ', 'T')
  if (!normalized) {
    return { ok: false, errors: ['请选择计划取件时间（可选上午 10:00-11:00 或傍晚 17:00）'] }
  }
  const match = normalized.match(/T(\d{2}):(\d{2})(?::\d{2})?$/)
  if (!match) {
    return { ok: false, errors: ['计划取件时间格式不正确'] }
  }
  const minutes = Number(match[1]) * 60 + Number(match[2])
  if (minutes < 8 * 60 || minutes > 20 * 60) {
    return { ok: false, errors: ['顺丰取件时间只能选择 08:00-20:00'] }
  }
  return { ok: true, errors: [] }
}

function validateCreateOrderPrerequisites(input = {}) {
  const shipmentValidation = validateExpressShipmentData(input)
  if (!shipmentValidation.ok) return shipmentValidation
  return validatePickupTimeWindow(input.sendStartTime)
}

function isMonthlyCardFailureMessage(message = '') {
  const value = text(message).toLowerCase()
  if (!value) return false
  return ['月结', '月结卡', '月结账号', 'monthlycard', 'monthly card'].some((keyword) => value.includes(keyword))
}

function toContactInfo(contactType, contact = {}) {
  const info = {
    contactType,
    contact: text(contact.name),
    mobile: text(contact.mobile),
    country: 'CN',
    province: text(contact.province),
    city: text(contact.city),
    address: text(contact.address),
  }
  if (text(contact.district)) info.county = text(contact.district)
  return info
}

function buildExpressOrderPayload(input = {}) {
  const product = SF_PRODUCTS[input.productType] || {}
  const payload = {
    language: 'zh-CN',
    orderId: text(input.shipmentNo),
    payMethod: 1,
    expressTypeId: toNumber(input.expressTypeId || product.expressTypeId),
    parcelQty: 1,
    totalWeight: toNumber(input.weightKg, 1) || 1,
    cargoDetails: [{ name: text(input.cargoName) || '租赁设备' }],
    contactInfoList: [
      toContactInfo(1, input.sender),
      toContactInfo(2, input.receiver),
    ],
    isGenWaybillNo: 1,
    isUnifiedWaybillNo: 1,
  }
  if (text(input.monthlyCard)) payload.monthlyCard = text(input.monthlyCard)
  if (text(input.sendStartTime)) {
    const sendStartTime = text(input.sendStartTime).replace('T', ' ')
    payload.sendStartTm = sendStartTime.length === 16 ? `${sendStartTime}:00` : sendStartTime
    payload.isDocall = 1
  }
  return payload
}

function buildPreOrderPayload(input = {}) {
  const order = buildExpressOrderPayload(input)
  const payload = {
    language: order.language,
    orderId: order.orderId,
    payMethod: order.payMethod,
    expressTypeId: order.expressTypeId,
    parcelQty: order.parcelQty,
    totalWeight: order.totalWeight,
    cargoDetails: order.cargoDetails,
    contactInfoList: order.contactInfoList,
  }
  if (order.monthlyCard) payload.monthlyCard = order.monthlyCard
  if (order.sendStartTm) {
    payload.sendStartTm = order.sendStartTm
    payload.isDocall = order.isDocall
  }
  return payload
}

function buildPromiseTimePayload({ waybillNo, monthlyCard, verifyMobile } = {}) {
  const card = text(monthlyCard)
  return {
    searchNo: text(waybillNo),
    checkType: card ? 2 : 1,
    checkNos: [card || text(verifyMobile)],
  }
}

function buildCancelOrderPayload({ shipmentNo, waybillNo } = {}) {
  const payload = {
    language: 'zh-CN',
    orderId: text(shipmentNo),
    dealType: 2,
    waybillNoInfoList: [],
  }
  if (text(waybillNo)) {
    payload.waybillNoInfoList.push({ waybillNo: text(waybillNo), waybillType: 1 })
  }
  return payload
}

function phoneLast4(value) {
  const digits = text(value).replace(/\D/g, '')
  return digits.length <= 4 ? digits : digits.slice(-4)
}

function buildRouteQueryPayload({ waybillNo, checkPhoneNo } = {}) {
  const payload = {
    language: '0',
    trackingType: '1',
    trackingNumber: [text(waybillNo)],
    methodType: '1',
  }
  const phone = phoneLast4(checkPhoneNo)
  if (phone) payload.checkPhoneNo = phone
  return payload
}

function buildWaybillFeePayload({ waybillNo, checkPhoneNo, monthlyCard } = {}) {
  const payload = {
    trackingType: '1',
    trackingNum: text(waybillNo),
  }
  const phone = phoneLast4(checkPhoneNo)
  if (phone) payload.phone = phone
  if (text(monthlyCard)) payload.monthlyCard = text(monthlyCard)
  return payload
}

function buildBatchShipmentPayloadFromOrder(order = {}, options = {}) {
  return {
    linkedOrderId: order.id,
    productCode: text(options.productCode) || 'sf_standard',
    senderName: text(options.senderName),
    senderMobile: text(options.senderMobile),
    senderProvince: text(options.senderProvince),
    senderCity: text(options.senderCity),
    senderDistrict: text(options.senderDistrict),
    senderAddress: text(options.senderAddress),
    receiverName: text(order.customer_name),
    receiverMobile: text(order.customer_phone),
    receiverProvince: text(order.province),
    receiverCity: text(order.city),
    receiverDistrict: text(order.district),
    receiverAddress: text(order.address),
    cargoName: text(options.cargoName) || text(order.model_code) || '租赁设备',
    weightKg: toNumber(options.weightKg, 1) || 1,
    plannedSendAt: text(order.planned_ship_at).replace(' ', 'T'),
  }
}

function valueFromConfig(config = {}, camelKey, apiKey, fallback = '') {
  return config[camelKey] ?? config[apiKey] ?? fallback
}

function buildIntraCityQuotePayload({ config = {}, cityName, address, weightGram } = {}) {
  return {
    ProjectCode: text(valueFromConfig(config, 'projectCode', 'ProjectCode')),
    ShopId: text(valueFromConfig(config, 'shopId', 'ShopId')),
    ShopType: toNumber(valueFromConfig(config, 'shopType', 'ShopType', 2), 2),
    OrderSource: text(valueFromConfig(config, 'orderSource', 'OrderSource', 'xianyu-agent')),
    ProductType: toNumber(valueFromConfig(config, 'productType', 'ProductType', 1), 1),
    CityName: text(cityName),
    UserAddress: text(address),
    weight: toNumber(weightGram),
    TotalPrice: toNumber(valueFromConfig(config, 'totalPrice', 'TotalPrice', 0)),
    IsInsured: toNumber(valueFromConfig(config, 'isInsured', 'IsInsured', 0)),
    DeclaredValue: toNumber(valueFromConfig(config, 'declaredValue', 'DeclaredValue', 0)),
  }
}

function mapFilterResult(filterResult) {
  const statuses = {
    1: { status: 'manual_review', label: '待顺丰人工确认', tone: 'warning' },
    2: { status: 'waybill_created', label: '可收派', tone: 'success' },
    3: { status: 'rejected', label: '不可收派', tone: 'danger' },
    4: { status: 'manual_review', label: '结果待确认', tone: 'warning' },
  }
  return statuses[Number(filterResult)] || {
    status: 'unknown',
    label: '未知状态',
    tone: 'warning',
  }
}

function parseMsgData(response = {}) {
  if (response.msgData && typeof response.msgData === 'object') return response.msgData
  if (typeof response.msgData === 'string') {
    try {
      return JSON.parse(response.msgData)
    } catch (_error) {
      return {}
    }
  }
  return response.data && typeof response.data === 'object' ? response.data : {}
}

function responseSucceeded(value, fallback = false) {
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (value === undefined || value === null) return fallback
  return Boolean(value)
}

function normalizeBaseExpressResult(response = {}) {
  const msgData = parseMsgData(response)
  const filterResult = Number(msgData.filterResult ?? response.filterResult ?? 0)
  const mapped = mapFilterResult(filterResult)
  return {
    ok: responseSucceeded(response.success, response.apiResultCode === 'A1000'),
    orderId: text(msgData.orderId),
    filterResult,
    orderStatus: mapped.status,
    statusLabel: mapped.label,
    tone: mapped.tone,
    message: text(response.errorMsg || response.msg || msgData.remark),
    raw: msgData,
  }
}

function normalizePreOrderResult(response = {}) {
  const base = normalizeBaseExpressResult(response)
  return {
    ...base,
    serviceList: Array.isArray(base.raw.serviceList) ? base.raw.serviceList : [],
  }
}

function normalizeCreateOrderResult(response = {}) {
  const base = normalizeBaseExpressResult(response)
  const waybillList = Array.isArray(base.raw.waybillNoInfoList) ? base.raw.waybillNoInfoList : []
  const mainWaybill = waybillList.find((item) => Number(item.waybillType) === 1) || waybillList[0] || {}
  const trackingNo = text(mainWaybill.waybillNo)
  const expectedArriveAt = text(
    base.raw.expectedArriveAt || base.raw.promiseTm || base.raw.expectedDeliveryTime
  ) || null
  return {
    ...base,
    trackingNo,
    expectedArriveAt,
    waybillNo: trackingNo,
    waybillNoInfoList: waybillList,
  }
}

function normalizeOrderSearchResult(response = {}) {
  return normalizeCreateOrderResult(response)
}

function normalizePromiseTimeResult(response = {}) {
  const msgData = parseMsgData(response)
  const expectedArriveAt = text(msgData.promiseTm) || null
  const errorCode = text(response.errorCode)
  const pending = errorCode === '20010' || text(response.errorMsg) === '查询清单结果为空'
  const message = pending
    ? '运单已创建，但当前还没有预计派送时间；通常需揽收或产生运输信息后再查询。'
    : text(response.errorMsg || response.msg)
  return {
    ok: responseSucceeded(response.success, response.apiResultCode === 'A1000'),
    waybillNo: text(msgData.searchNo),
    promiseTime: expectedArriveAt || '',
    expectedArriveAt,
    errorCode,
    pending,
    message,
    raw: msgData,
  }
}

function normalizeDeliveryTimeQuoteResult(response = {}, { expressTypeId } = {}) {
  const raw = parseMsgData(response)
  const entries = Array.isArray(raw.deliverTmDto)
    ? raw.deliverTmDto
    : (Array.isArray(raw.deliverTmDTO) ? raw.deliverTmDTO : [])
  // 按请求的 expressTypeId 匹配产品；匹配不到则用第一条
  const targetId = expressTypeId !== undefined && expressTypeId !== null ? String(expressTypeId) : null
  const matched = targetId
    ? (entries.find((e) => String(e.businessType) === targetId) || entries[0] || {})
    : (entries[0] || {})
  const rawDeliveryTime = matched.deliverTime || matched.deliverTm || matched.promiseTm
  const deliveryTimes = (rawDeliveryTime && rawDeliveryTime !== 'null' && rawDeliveryTime !== null)
    ? String(rawDeliveryTime).split(',').map((v) => v.trim()).filter(Boolean)
    : []
  const feeValue = matched.fee ?? matched.totalFee ?? matched.freight ?? matched.estimatedFee
  return {
    ok: responseSucceeded(response.success, response.apiResultCode === 'A1000'),
    expectedArriveAt: deliveryTimes[deliveryTimes.length - 1] || null,
    estimatedFee: feeValue === undefined || feeValue === null || feeValue === ''
      ? null
      : toNumber(feeValue),
    matchedProduct: targetId ? matched.businessType || null : null,
    matchedProductDesc: targetId ? matched.businessTypeDesc || null : null,
    allProducts: entries.map((e) => ({ businessType: String(e.businessType), desc: e.businessTypeDesc, fee: e.fee, deliverTime: e.deliverTime })),
    options: entries,
    message: text(response.errorMsg || response.msg),
    raw,
  }
}

function normalizeCancelOrderResult(response = {}) {
  const raw = parseMsgData(response)
  const ok = responseSucceeded(response.success, response.apiResultCode === 'A1000')
  return {
    ok,
    status: ok ? 'cancelled' : 'cancel_failed',
    orderId: text(raw.orderId),
    message: text(response.errorMsg || response.msg || raw.remark) || (ok ? '订单已取消' : '取消订单失败'),
    raw,
  }
}

function normalizeRouteResult(response = {}) {
  const raw = parseMsgData(response)
  const routeResponses = Array.isArray(raw.routeResps)
    ? raw.routeResps
    : (Array.isArray(raw.routeResp) ? raw.routeResp : [])
  const first = routeResponses[0] || raw
  const entries = Array.isArray(first.routes)
    ? first.routes
    : (Array.isArray(first.route) ? first.route : [])
  const routes = entries.map((item) => ({
    acceptTime: text(item.acceptTime || item.accept_time),
    acceptAddress: text(item.acceptAddress || item.accept_address),
    remark: text(item.remark || item.status),
    opCode: text(item.opCode || item.op_code),
  }))
  const latest = routes[routes.length - 1] || {}
  const reason = text(first.reasonRemark || first.remark || first.errorMsg)
  return {
    ok: responseSucceeded(response.success, response.apiResultCode === 'A1000') && !(reason && routes.length === 0),
    waybillNo: text(first.mailNo || first.waybillNo || raw.mailNo || raw.waybillNo),
    latestStatus: latest.remark || '',
    routes,
    reasonCode: text(first.reasonCode || first.errorCode),
    message: reason || text(response.errorMsg || response.msg),
    raw,
  }
}

function normalizeWaybillFeeResult(response = {}) {
  const raw = parseMsgData(response)
  const source = Array.isArray(raw) ? (raw[0] || {}) : raw
  const feeRows = source.waybillFeeList || source.feeList || source.feeDetails || source.feeDetailList || source.feeDetailsList || []
  const items = (Array.isArray(feeRows) ? feeRows : []).map((item) => {
    const type = text(item.feeType || item.feeTypeCode || item.type || item.feeName || item.name)
    return {
      type,
      name: text(item.feeName || item.name || type),
      value: toNumber(item.feeValue ?? item.feeAmt ?? item.value ?? item.amount),
      paymentTypeCode: text(item.paymentTypeCode || item.payTypeCode),
      settlementTypeCode: text(item.settlementTypeCode || item.settleTypeCode),
    }
  })
  const waybillInfo = source.waybillInfo && typeof source.waybillInfo === 'object' ? source.waybillInfo : {}
  const fallbackTotal = source.totalFee ?? source.totalAmount ?? source.fee ?? waybillInfo.totalFee
  const billedFee = items.length
    ? Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(2))
    : (fallbackTotal === undefined || fallbackTotal === null || fallbackTotal === '' ? null : toNumber(fallbackTotal))
  return {
    ok: responseSucceeded(response.success, response.apiResultCode === 'A1000'),
    waybillNo: text(source.waybillNo || source.mailNo || waybillInfo.waybillNo),
    billedFee,
    items,
    message: text(response.errorMsg || response.msg),
    raw,
  }
}

function resolveActualPaidPolicy({
  billedFee,
  existingActualPaidFee,
  existingSource,
  existingNote,
  requestedActualPaidFee,
  requestedNote,
} = {}) {
  const hasRequestedFee = requestedActualPaidFee !== undefined && requestedActualPaidFee !== null
    && text(requestedActualPaidFee) !== ''
  if (hasRequestedFee) {
    const amount = toNumber(requestedActualPaidFee)
    if (billedFee !== undefined && billedFee !== null && Number(amount) !== Number(billedFee)
      && !text(requestedNote)) {
      return { ok: false, message: '实际支付金额与顺丰清单金额不一致时，请填写修正备注' }
    }
    return {
      ok: true,
      actualPaidFee: amount,
      source: billedFee !== undefined && billedFee !== null && Number(amount) === Number(billedFee) ? 'billed_fee' : 'manual',
      note: text(requestedNote),
    }
  }
  if (text(existingSource) === 'manual') {
    return {
      ok: true,
      actualPaidFee: toNumber(existingActualPaidFee),
      source: 'manual',
      note: text(existingNote),
    }
  }
  return {
    ok: true,
    actualPaidFee: billedFee === undefined || billedFee === null ? null : toNumber(billedFee),
    source: 'billed_fee',
    note: '',
  }
}

function normalizeIntraCityQuoteResult(response = {}) {
  const raw = response.Result && typeof response.Result === 'object'
    ? response.Result
    : (response.result && typeof response.result === 'object' ? response.result : response)
  const feeCents = toNumber(raw.TotalPrice ?? raw.totalPrice ?? raw.DeliveryFee ?? raw.deliveryFee)
  const transitMinutes = toNumber(raw.PromiseDeliveryTime ?? raw.promiseDeliveryTime)
  const distanceMeters = toNumber(raw.DeliveryDistanceMeter ?? raw.deliveryDistanceMeter ?? raw.Distance ?? raw.distance)
  return {
    ok: text(response.Head ?? raw.Head).toUpperCase() === 'OK' || Boolean(response.Success ?? response.success),
    message: text(response.ErrorMessage || response.errorMessage || response.Message || response.message)
      || [
        transitMinutes ? `预计 ${transitMinutes} 分钟送达` : '',
        distanceMeters ? `距离 ${(distanceMeters / 1000).toFixed(1)} km` : '',
      ].filter(Boolean).join('，'),
    fee: feeCents / 100,
    feeCents,
    transitMinutes,
    distanceMeters,
    raw,
  }
}

function maskMonthlyCard(value) {
  const card = text(value)
  if (!card) return ''
  return `${'*'.repeat(Math.max(4, card.length - 4))}${card.slice(-4)}`
}

function redactRawText(value) {
  return text(value)
    .replace(/("accessToken"\s*:\s*")[^"]+(")/ig, '$1[hidden]$2')
    .replace(/("token"\s*:\s*")[^"]+(")/ig, '$1[hidden]$2')
    .replace(/(accessToken=)[^&\s]+/ig, '$1[hidden]')
}

function redactShipmentSecrets(value) {
  if (Array.isArray(value)) return value.map((item) => redactShipmentSecrets(item))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const normalizedKey = key.replace(/[_-]/g, '').toLowerCase()
    if (normalizedKey === 'monthlycard') return [key, maskMonthlyCard(item)]
    if (normalizedKey === 'rawtext') return [key, redactRawText(item)]
    if (normalizedKey.includes('token') || normalizedKey.includes('secret')
      || normalizedKey === 'checkword' || normalizedKey === 'accesscode') {
      return [key, '[hidden]']
    }
    if (normalizedKey === 'partnerid' || normalizedKey === 'customercode' || normalizedKey === 'appid') {
      return [key, '[configured]']
    }
    if (normalizedKey.includes('mobile') || normalizedKey.includes('phone') || normalizedKey.includes('checkno')) {
      return [key, '[redacted-phone]']
    }
    if (normalizedKey.includes('address')) {
      return [key, '[redacted-address]']
    }
    if (normalizedKey === 'contact' || normalizedKey === 'sender' || normalizedKey === 'receiver') {
      return [key, '[redacted-contact]']
    }
    return [key, redactShipmentSecrets(item)]
  }))
}

module.exports = {
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
  isMonthlyCardFailureMessage,
  validatePickupTimeWindow,
  validateCreateOrderPrerequisites,
  validateExpressShipmentData,
}
