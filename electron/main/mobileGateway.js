const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const nodePath = require('path')

const {
  batchMarkOrdersShipped,
  checkScheduleAvailability,
  createOrder,
  getStoredDepositOrder,
  getConfig,
  getOrderById,
  getInquiryStats,
  getScheduleMonthlyOverview,
  getSfShipmentDetail,
  listFulfillmentTasks,
  listInquiryEvents,
  listOrders,
  listScheduleUnits,
  listSfPendingShipmentOrders,
  listSfShipments,
  listStoredDepositOrders,
  listStores,
  linkInquiryEventToOrder,
  linkRecentInquiryToOrder,
  markOrderReturned,
  recordInquiryEventFromAvailability,
  saveConfig,
  placeSfShipment,
  cancelSfShipment,
  querySfShipmentRoutes,
  querySfShipmentFee,
  querySfShipmentPromiseTime,
  updateSfShipmentActualPaid,
  upsertStoredDepositOrder,
} = require('./dbManager')
const { sendCommand } = require('./pythonManager')
const {
  createMerchantDepositOrder,
  listMerchantDepositOrders,
  finishMerchantDepositOrder,
} = require('./depositClient')
const {
  buildAvailabilityPayload,
  getMissingFields,
  parseRecipientAddress,
  parseFeishuRentalCommand,
} = require('./mobileFeishuParser')

let server = null
let tenantTokenCache = null
let fulfillmentReminderTimer = null
let gatewayConfigCache = null
const sentFulfillmentReminderKeys = new Set()
const FULFILLMENT_REMINDER_SENT_CONFIG_KEY = 'MOBILE_FULFILLMENT_REMINDER_SENT_KEYS'
const FEISHU_AVAILABILITY_CONTEXT_TTL_MS = 10 * 60 * 1000
const availabilityContextByChat = new Map()
const availabilityHistoryByChat = new Map()
const availabilityContextByMessage = new Map()
const bookingSnapshotByActionId = new Map()
const bookingResultByActionKey = new Map()
const bookingActionInFlight = new Set()
const processedFeishuMessageById = new Map()
const FEISHU_MESSAGE_DEDUPE_TTL_MS = 30 * 60 * 1000
const DEFAULT_AVAILABLE_REPLY_TEMPLATE = [
  '宝，这边看了下，{型号} {开始日期}到{结束日期}是有档期的哈～',
  '这几天租金一共是{租金}。',
  '免押的话需要{免押条件}。',
  '你这边如果可以，我就继续帮你安排哈。',
].join('\n')
const DEFAULT_UNAVAILABLE_REPLY_TEMPLATE = '宝，不好意思，这边看了下，{型号} {开始日期}到{结束日期}暂时没有档期咯。'
const DEFAULT_AVAILABILITY_ADDRESS = '四川省成都市金牛区'

function parseFulfillmentReminderSentKeys(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\n,]/)
  const seen = new Set()
  const keys = []
  for (const item of source) {
    const key = String(item || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

function appendFulfillmentReminderSentKey(value, key, limit = 180) {
  const keys = parseFulfillmentReminderSentKeys(value)
  const normalizedKey = String(key || '').trim()
  if (normalizedKey && !keys.includes(normalizedKey)) keys.push(normalizedKey)
  return keys.slice(-limit).join(',')
}

function shouldRecordInquiryEvent(parsed = {}) {
  const text = String(parsed.text || parsed.rawText || '').trim()
  return !/^(【\s*测试\s*】|\[\s*测试\s*\]|测试[:：\s])/i.test(text)
}

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function textResponse(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

function htmlResponse(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  })
  res.end(body)
}

function binaryResponse(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function isEnabled(value) {
  return !['false', '0', 'off', 'no'].includes(String(value || '').trim().toLowerCase())
}

function normalizePath(req) {
  return new URL(req.url, 'http://127.0.0.1').pathname
}

function getRequestOrigin(req) {
  const host = String(req.headers.host || '').trim()
  if (!host) return ''
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const proto = forwardedProto || (req.socket?.encrypted ? 'https' : 'http')
  return `${proto}://${host}`
}

function getPublicBaseUrl(config = {}) {
  return String(config.MOBILE_PUBLIC_BASE_URL || config.PUBLIC_BASE_URL || 'https://unactuated-nonceremoniously-dane.ngrok-free.dev').replace(/\/+$/, '')
}

async function getModelCodes() {
  const units = await listScheduleUnits({ activeInventoryOnly: true })
  return Array.from(new Set((units || []).map((unit) => unit.model_code || unit.modelCode).filter(Boolean)))
}

function getQuery(req) {
  return new URL(req.url, 'http://127.0.0.1').searchParams
}

function toPositiveNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function normalizeMobileOrder(order = {}) {
  const address = [order.province, order.city, order.district, order.address].filter(Boolean).join('')
  return {
    id: order.id,
    orderNo: order.order_no || '',
    storeId: order.store_id || null,
    storeName: order.store_name || '',
    modelCode: order.model_code || '',
    unitId: order.unit_id || null,
    unitCode: order.unit_code || '',
    customerName: order.customer_name || '',
    customerPhone: order.customer_phone || '',
    address,
    province: order.province || '',
    city: order.city || '',
    district: order.district || '',
    rentStartDate: order.rent_start_date || '',
    rentEndDate: order.rent_end_date || '',
    fee: Number(order.fee || 0),
    deposit: Number(order.deposit || 0),
    orderStatus: order.order_status || '',
    plannedShipAt: order.planned_ship_at || '',
    expectedArriveAt: order.expected_arrive_at || '',
    actualShipAt: order.actual_ship_at || '',
    trackingNo: order.tracking_no || '',
    shippingMode: order.shipping_mode || '',
    latestLogisticsStatus: order.latest_logistics_status || '',
    createdAt: order.created_at || '',
    updatedAt: order.updated_at || '',
  }
}

function normalizeDepositStatus(status) {
  const normalized = String(status ?? '').trim()
  const map = {
    0: 'pending_review',
    1: 'approved',
    2: 'completed',
    3: 'cancelled',
    pending: 'pending_review',
    pending_review: 'pending_review',
    approved: 'approved',
    rejected: 'rejected',
    completed: 'completed',
    cancelled: 'cancelled',
  }
  return map[normalized] || normalized || 'pending_review'
}

function getDepositStatusLabel(status) {
  return ({
    pending_review: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    completed: '已完结',
    cancelled: '已取消',
  })[normalizeDepositStatus(status)] || String(status || '未知')
}

function normalizeMobileDepositOrder(order = {}) {
  const status = normalizeDepositStatus(order.status)
  return {
    depositOrderNo: order.depositOrderNo || order.orderNo || '',
    orderId: order.orderId || null,
    sourceType: order.sourceType || '',
    sourceOrderId: order.sourceOrderId || null,
    sourceOrderNo: order.sourceOrderNo || '',
    productName: order.productName || '',
    modelCode: order.modelCode || '',
    unitCode: order.unitCode || '',
    customerName: order.customerName || '',
    customerPhone: order.customerPhone || '',
    depositAmount: Number(order.depositAmount || order.product_deposit || 0),
    rentAmount: Number(order.rentAmount || order.count_deposit_price || 0),
    rentStartDate: order.rentStartDate || '',
    rentEndDate: order.rentEndDate || '',
    rentDays: Number(order.rentDays || 0),
    status,
    statusLabel: order.statusLabel || getDepositStatusLabel(status),
    reviewUrl: order.reviewUrl || '',
    qrImageUrl: order.qrImageUrl || '',
    isLatest: Boolean(order.isLatest),
    createdAt: order.createdAt || order.thirdPartyCreatedAt || '',
    updatedAt: order.updatedAt || order.thirdPartyUpdatedAt || '',
  }
}

function getSfShipmentStatusLabel(status) {
  return ({
    draft: '草稿',
    prechecked: '已预校验',
    precheck_failed: '预校验失败',
    submitting: '提交中',
    submitted: '已下单',
    result_pending: '结果待查',
    manual_review: '待人工确认',
    rejected: '不可收派',
    cancelled: '已取消',
    quoted: '已询价',
    quote_failed: '询价失败',
  })[String(status || '').trim()] || String(status || '-')
}

function normalizeMobileShipment(shipment = {}) {
  if (!shipment) return null
  return {
    id: shipment.id,
    shipmentNo: shipment.shipment_no || shipment.shipmentNo || '',
    linkedOrderId: shipment.linked_order_id || shipment.linkedOrderId || null,
    status: shipment.status || '',
    statusLabel: getSfShipmentStatusLabel(shipment.status),
    trackingNo: shipment.tracking_no || shipment.trackingNo || '',
    productCode: shipment.product_code || shipment.productCode || '',
    senderName: shipment.sender_name || shipment.senderName || '',
    senderMobile: shipment.sender_mobile || shipment.senderMobile || '',
    senderProvince: shipment.sender_province || shipment.senderProvince || '',
    senderCity: shipment.sender_city || shipment.senderCity || '',
    senderDistrict: shipment.sender_district || shipment.senderDistrict || '',
    senderAddress: shipment.sender_address || shipment.senderAddress || '',
    receiverName: shipment.receiver_name || shipment.receiverName || '',
    receiverMobile: shipment.receiver_mobile || shipment.receiverMobile || '',
    receiverProvince: shipment.receiver_province || shipment.receiverProvince || '',
    receiverCity: shipment.receiver_city || shipment.receiverCity || '',
    receiverDistrict: shipment.receiver_district || shipment.receiverDistrict || '',
    receiverAddress: shipment.receiver_address || shipment.receiverAddress || '',
    cargoName: shipment.cargo_name || shipment.cargoName || '',
    plannedSendAt: shipment.planned_send_at || shipment.plannedSendAt || '',
    expectedArriveAt: shipment.expected_arrive_at || shipment.expectedArriveAt || '',
    estimatedFee: shipment.estimated_fee ?? shipment.estimatedFee ?? null,
    actualPaidFee: shipment.actual_paid_fee ?? shipment.actualPaidFee ?? null,
    serviceMessage: shipment.service_message || shipment.serviceMessage || '',
    routesUpdatedAt: shipment.routes_updated_at || '',
    feeUpdatedAt: shipment.fee_updated_at || '',
    events: Array.isArray(shipment.events) ? shipment.events : [],
  }
}

async function mergeDepositSettings(settings = {}) {
  const cfg = await getConfig()
  return {
    ...settings,
    baseUrl: settings.baseUrl || cfg.DEPOSIT_BASE_URL || '',
    appId: cfg.DEPOSIT_APP_ID || settings.appId || '',
    appSecret: cfg.DEPOSIT_APP_SECRET || settings.appSecret || '',
    userEid: settings.userEid || cfg.DEPOSIT_USER_EID || '',
    notify_url: settings.notify_url || settings.notifyUrl || cfg.DEPOSIT_NOTIFY_URL || '',
    contractSupplementaryContent: settings.contractSupplementaryContent || cfg.DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT || '',
    receivingInfoFallback: settings.receivingInfoFallback || cfg.DEPOSIT_RECEIVING_INFO_FALLBACK || '待补充',
    timeoutMs: settings.timeoutMs || cfg.DEPOSIT_TIMEOUT_MS || '',
  }
}

async function listMobileDepositOrders(filters = {}) {
  const mergedSettings = await mergeDepositSettings(filters.settings || {})
  const remote = await listMerchantDepositOrders({
    depositStatus: filters.status || 'all',
    keyword: filters.keyword || '',
    page: filters.page || 1,
    limit: filters.limit || 50,
  }, mergedSettings)
  const local = await listStoredDepositOrders(filters)
  const byNo = new Map()
  for (const item of local || []) {
    const normalized = normalizeMobileDepositOrder(item)
    if (normalized.depositOrderNo) byNo.set(normalized.depositOrderNo, normalized)
  }
  if (remote?.success && Array.isArray(remote.orders)) {
    for (const item of remote.orders) {
      const normalized = normalizeMobileDepositOrder(item)
      if (normalized.depositOrderNo) byNo.set(normalized.depositOrderNo, { ...byNo.get(normalized.depositOrderNo), ...normalized })
    }
  }
  let orders = Array.from(byNo.values())
  if (filters.sourceOrderId !== undefined && filters.sourceOrderId !== null && filters.sourceOrderId !== '') {
    orders = orders.filter((item) => String(item.sourceOrderId || '') === String(filters.sourceOrderId))
  }
  if (filters.status) {
    orders = orders.filter((item) => item.status === normalizeDepositStatus(filters.status))
  }
  return {
    ok: remote?.success !== false || orders.length > 0,
    stale: remote?.success === false,
    message: remote?.message || '',
    orders,
  }
}

async function getMobileOrderDetail(orderId) {
  const order = orderId ? await getOrderById(orderId) : null
  if (!order) return null
  const normalizedOrder = normalizeMobileOrder(order)
  const depositsRes = await listMobileDepositOrders({ sourceOrderId: orderId })
  const depositOrders = depositsRes.orders || []
  const latestDepositOrder = depositOrders.find((item) => item.isLatest) || depositOrders[0] || null
  const shipmentList = await listSfShipments({ linkedOrderId: orderId })
  const latestShipment = Array.isArray(shipmentList) && shipmentList.length ? shipmentList[0] : null
  const shipmentDetail = latestShipment?.id ? await getSfShipmentDetail({ shipmentId: latestShipment.id }) : null
  return {
    order: normalizedOrder,
    depositOrders,
    latestDepositOrder,
    shipment: normalizeMobileShipment(shipmentDetail || latestShipment),
  }
}

function buildMobileManifest(req) {
  const origin = getRequestOrigin(req)
  const mobileUrl = `${origin || ''}/mobile`
  return {
    name: '小狗相机助手',
    short_name: '小狗相机',
    start_url: mobileUrl,
    scope: '/',
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#15171a',
    icons: [
      { src: '/mobile/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}

async function parseCommandText(text) {
  const modelCodes = await getModelCodes()
  return parseFeishuRentalCommand(text, { modelCodes })
}

function buildAvailabilityContextRecord(parsed, availability, now = Date.now(), options = {}) {
  return {
    createdAt: now,
    parsed: {
      text: parsed?.text || '',
      inquiryEventId: Number(options.inquiryEventId || parsed?.inquiryEventId || availability?.inquiryEventId || 0) || null,
      modelCode: parsed?.modelCode || '',
      rentStartDate: parsed?.rentStartDate || '',
      rentEndDate: parsed?.rentEndDate || '',
      rentDays: Number(parsed?.rentDays || 0),
      shippingMode: parsed?.shippingMode || 'land',
      returnBufferDays: Number(parsed?.returnBufferDays ?? 2),
      province: parsed?.province || '',
      city: parsed?.city || '',
      district: parsed?.district || '',
      address: parsed?.address || '',
    },
    availability: {
      availableUnits: Array.isArray(availability?.availableUnits)
        ? availability.availableUnits.map((unit) => ({ id: unit.id, unitCode: unit.unitCode }))
        : [],
      plan: {
        plannedShipAt: availability?.plan?.plannedShipAt || null,
        expectedArriveAt: availability?.plan?.expectedArriveAt || null,
        shipDate: availability?.plan?.shipDate || '',
        arriveDate: availability?.plan?.arriveDate || '',
      },
    },
  }
}

function buildMessageContextKey(chatId, messageId) {
  if (!chatId || !messageId) return ''
  return `${chatId}:${messageId}`
}

function isExpiredAvailabilityContext(context, now = Date.now()) {
  return !context || context.createdAt + FEISHU_AVAILABILITY_CONTEXT_TTL_MS < now
}

function getActiveAvailabilityHistory(chatId, now = Date.now()) {
  if (!chatId) return []
  const history = availabilityHistoryByChat.get(chatId) || []
  const active = history.filter((context) => !isExpiredAvailabilityContext(context, now))
  if (active.length !== history.length) availabilityHistoryByChat.set(chatId, active)
  return active
}

function rememberAvailabilityContextAlias(chatId, messageId, context) {
  const key = buildMessageContextKey(chatId, messageId)
  if (!key || !context) return null
  availabilityContextByMessage.set(key, context)
  return context
}

function getAvailabilityContext(chatId, { now = Date.now(), referencedMessageId = '' } = {}) {
  if (!chatId) return null
  if (referencedMessageId) {
    const context = availabilityContextByMessage.get(buildMessageContextKey(chatId, referencedMessageId))
    if (!isExpiredAvailabilityContext(context, now)) return context
  }
  const context = availabilityContextByChat.get(chatId)
  if (!context) return null
  if (isExpiredAvailabilityContext(context, now)) {
    availabilityContextByChat.delete(chatId)
    return null
  }
  return context
}

function rememberAvailabilityContext(chatId, parsed, availability, now = Date.now(), options = {}) {
  if (!chatId || !parsed || !availability?.ok) return null
  const record = buildAvailabilityContextRecord(parsed, availability, now, options)
  availabilityContextByChat.set(chatId, record)
  const history = getActiveAvailabilityHistory(chatId, now)
  history.push(record)
  availabilityHistoryByChat.set(chatId, history.slice(-5))
  rememberAvailabilityContextAlias(chatId, options.messageId, record)
  rememberAvailabilityContextAlias(chatId, options.botMessageId, record)
  return record
}

function resolveBookingAvailabilityContext(parsed, chatId, { referencedMessageId = '', now = Date.now() } = {}) {
  if (!parsed || parsed.intent !== 'booking' || !chatId) return { status: 'none', context: null, contexts: [] }
  if (referencedMessageId) {
    const context = getAvailabilityContext(chatId, { now, referencedMessageId })
    return context ? { status: 'matched', context, contexts: [context] } : { status: 'not_found', context: null, contexts: [] }
  }
  const hasSchedule = Boolean(parsed.modelCode && parsed.rentStartDate && parsed.rentEndDate)
  if (hasSchedule) {
    const context = getAvailabilityContext(chatId, { now })
    return context ? { status: 'matched', context, contexts: [context] } : { status: 'none', context: null, contexts: [] }
  }
  const contexts = getActiveAvailabilityHistory(chatId, now)
  if (contexts.length === 1) return { status: 'matched', context: contexts[0], contexts }
  if (contexts.length > 1) return { status: 'ambiguous', context: null, contexts }
  return { status: 'none', context: null, contexts: [] }
}

function mergeBookingParsedWithAvailabilityContext(parsed, context, { now = Date.now() } = {}) {
  if (!parsed || parsed.intent !== 'booking') return parsed
  if (isExpiredAvailabilityContext(context, now)) return parsed
  const base = context.parsed || {}
  return {
    ...base,
    ...parsed,
    text: parsed.text || base.text || '',
    modelCode: parsed.modelCode || base.modelCode || '',
    rentStartDate: parsed.rentStartDate || base.rentStartDate || '',
    rentEndDate: parsed.rentEndDate || base.rentEndDate || '',
    rentDays: Number(parsed.rentDays || 0) || Number(base.rentDays || 0),
    inquiryEventId: Number(parsed.inquiryEventId || 0) || Number(base.inquiryEventId || 0) || null,
    shippingMode: parsed.shippingMode || base.shippingMode || 'land',
    returnBufferDays: Number(parsed.returnBufferDays ?? base.returnBufferDays ?? 2),
    province: parsed.province || base.province || '',
    city: parsed.city || base.city || '',
    district: parsed.district || base.district || '',
    address: parsed.address || '',
    customerName: parsed.customerName || '',
    customerPhone: parsed.customerPhone || '',
    fee: Number(parsed.fee || 0),
    deposit: Number(parsed.deposit || 0),
  }
}

function resetMobileGatewayContextForTests() {
  availabilityContextByChat.clear()
  availabilityHistoryByChat.clear()
  availabilityContextByMessage.clear()
  bookingSnapshotByActionId.clear()
  bookingResultByActionKey.clear()
  bookingActionInFlight.clear()
  processedFeishuMessageById.clear()
}

function formatAvailabilityText(result) {
  if (!result?.ok) return result?.message || '查询失败'
  const units = (result.availableUnits || []).slice(0, 8).map((unit) => unit.unitCode).join('、') || '-'
  const quoteLine = formatAvailabilityQuote(result.quote)
  const depositLine = formatAvailabilityDeposit(result.depositExemption, result.quote)
  const customerReply = buildCustomerAvailabilityReply(result)
  return [
    `${result.modelCode} ${result.plan.rentStartDate} 至 ${result.plan.rentEndDate}`,
    result.available ? `可用 ${result.counts.availableUnits}/${result.counts.totalUnits} 台：${units}` : `当前无可用机器，可用 0/${result.counts.totalUnits} 台`,
    `发货 ${result.plan.shipDate || '-'}，到货 ${result.plan.arriveDate || '-'}`,
    quoteLine,
    depositLine,
    customerReply ? `建议回复：\n${customerReply}` : '',
    result.plan.fallbackReason ? `提示：${result.plan.fallbackReason}` : '',
  ].filter(Boolean).join('\n')
}

function formatAvailabilityQuote(quote) {
  if (!quote?.ok) return '租金：未配置'
  const total = `¥${Number(quote.totalPrice || 0).toFixed(2)}`
  if (quote.source === 'extended' && Number(quote.extensionDays || 0) > 0) {
    return `租金：${total}（${quote.days}天，含续租 ${quote.extensionDays} 天 x ¥${Number(quote.extensionDailyPrice || 0).toFixed(2)}）`
  }
  return `租金：${total}（${quote.days}天）`
}

function formatAvailabilityDeposit(depositExemption, quote) {
  if (depositExemption?.ok && depositExemption.summary) return depositExemption.summary
  if (Number(quote?.deposit || 0) > 0) return `免押：未配置规则，旧押金 ¥${Number(quote.deposit).toFixed(2)}`
  return '免押：未配置规则'
}

function formatChineseMonthDay(dateText) {
  const matched = String(dateText || '').match(/^\d{4}-(\d{2})-(\d{2})/)
  if (!matched) return dateText || '-'
  return `${Number(matched[1])}月${Number(matched[2])}号`
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatShortTime(dateTimeText) {
  const matched = String(dateTimeText || '').match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/)
  return matched ? `${matched[1]}:${matched[2]}` : '-'
}

function normalizeDateOnly(date = new Date()) {
  if (typeof date === 'string') return date.slice(0, 10)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function addLocalDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00+08:00`)
  date.setDate(date.getDate() + days)
  return normalizeDateOnly(date)
}

function resolveTaskDateRange(parsed = {}) {
  const today = normalizeDateOnly()
  const target = parsed.taskDatePreset === 'tomorrow' ? addLocalDays(today, 1) : today
  return { dateFrom: target, dateTo: target }
}

function formatCustomerMoney(value) {
  const num = Number(value || 0)
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

function stripExemptionPrefix(summary) {
  return String(summary || '')
    .replace(/^免押：/, '')
    .replace(/；/g, '；')
    .trim()
}

function buildReplyTemplateVariables(availability) {
  const quoteText = availability?.quote?.ok
    ? `${formatCustomerMoney(availability.quote.totalPrice)}元`
    : '租金待确认'
  const exemptionText = availability?.depositExemption?.summary
    ? stripExemptionPrefix(availability.depositExemption.summary)
    : '免押条件待确认'
  return {
    '{型号}': availability?.modelCode || '这个型号',
    '{开始日期}': formatChineseMonthDay(availability?.plan?.rentStartDate),
    '{结束日期}': formatChineseMonthDay(availability?.plan?.rentEndDate),
    '{租金}': quoteText,
    '{免押条件}': exemptionText,
    '{档期状态}': availability?.available ? '有档期' : '暂时没有档期',
  }
}

function renderReplyTemplate(template, availability) {
  const variables = buildReplyTemplateVariables(availability)
  let output = String(template || '')
  for (const [key, value] of Object.entries(variables)) {
    output = output.split(key).join(value)
  }
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function buildCustomerAvailabilityReply(availability, options = {}) {
  if (!availability?.ok) return availability?.message || '宝，不好意思，这边暂时查不到档期结果哈。'
  if (!availability.available) {
    return renderReplyTemplate(options.unavailableTemplate || DEFAULT_UNAVAILABLE_REPLY_TEMPLATE, availability)
  }

  return renderReplyTemplate(options.availableTemplate || DEFAULT_AVAILABLE_REPLY_TEMPLATE, availability)
}

function buildFeishuBookingSnapshot(parsed, availability) {
  return {
    ...parsed,
    inquiryEventId: Number(parsed?.inquiryEventId || availability?.inquiryEventId || 0) || null,
    fee: Number(parsed?.fee || 0) || Number(availability?.quote?.totalPrice || 0),
    deposit: Number(parsed?.deposit || 0),
    plannedShipAt: availability?.plan?.plannedShipAt || null,
    expectedArriveAt: availability?.plan?.expectedArriveAt || null,
  }
}

function rememberBookingSnapshotForAction(snapshot) {
  const id = crypto.randomUUID()
  bookingSnapshotByActionId.set(id, {
    createdAt: Date.now(),
    snapshot,
  })
  return id
}

function getBookingSnapshotForAction(id, now = Date.now()) {
  if (!id) return null
  const record = bookingSnapshotByActionId.get(id)
  if (!record) return null
  if (record.createdAt + FEISHU_AVAILABILITY_CONTEXT_TTL_MS < now) {
    bookingSnapshotByActionId.delete(id)
    return null
  }
  return record.snapshot
}

function buildFeishuText(content) {
  return {
    msg_type: 'text',
    content: JSON.stringify({ text: content }),
  }
}

function buildFeishuCard(card) {
  return {
    msg_type: 'interactive',
    content: JSON.stringify(card),
  }
}

function buildFeishuCardCallbackResponse(content, type = 'info') {
  return {
    toast: {
      type,
      content: String(content || ''),
    },
  }
}

function buildCustomerReplyCard(replyContent) {
  return buildFeishuCard({
    config: { wide_screen_mode: true },
    header: { template: 'green', title: { tag: 'plain_text', content: '租客回复' } },
    elements: [
      { tag: 'div', text: { tag: 'plain_text', content: String(replyContent || '') } },
    ],
  })
}

function buildCustomerReplyMessage(replyContent) {
  return buildFeishuText(String(replyContent || ''))
}

async function getGatewayConfig(options = {}) {
  if (!options.forceRefresh && gatewayConfigCache) return gatewayConfigCache
  gatewayConfigCache = await getConfig()
  return gatewayConfigCache
}

function mergeGatewayConfigCache(patch = {}) {
  gatewayConfigCache = {
    ...(gatewayConfigCache || {}),
    ...patch,
  }
  return gatewayConfigCache
}

function formatMoney(value) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function findAvailabilityUnitCode(availability, unitId) {
  const units = Array.isArray(availability?.availableUnits) ? availability.availableUnits : []
  const matched = units.find((unit) => String(unit.id) === String(unitId))
  return matched?.unitCode || unitId || '-'
}

function buildBookingResultMessage(created) {
  if (!created?.ok) return `建单失败：${created?.message || '未知错误'}`

  const parsed = created.parsed || {}
  const result = created.result || {}
  const address = [parsed.province, parsed.city, parsed.district, parsed.address].filter(Boolean).join('')
  const hasCustomerInfo = Boolean(parsed.customerName || parsed.customerPhone || parsed.address)
  const unitCode = findAvailabilityUnitCode(created.availability, result.unitId)
  return [
    `建单成功：#${result.id || '-'}`,
    `型号：${parsed.modelCode || '-'}`,
    `设备：${unitCode}`,
    `租期：${parsed.rentStartDate || '-'} 至 ${parsed.rentEndDate || '-'}`,
    `租金：${formatMoney(parsed.fee)}`,
    `客户：${[parsed.customerName || '待补资料', parsed.customerPhone].filter(Boolean).join(' ')}`,
    `地址：${address || '待补资料'}`,
    `发货：${formatChineseMonthDay(String(result.plannedShipAt || '').slice(0, 10))} ${formatShortTime(result.plannedShipAt)}`,
    `到货：${formatChineseMonthDay(String(result.expectedArriveAt || '').slice(0, 10))} ${formatShortTime(result.expectedArriveAt)}`,
    hasCustomerInfo ? '' : '状态：待补资料',
  ].filter(Boolean).join('\n')
}

function buildBookingLatestLogisticsStatus(parsed = {}) {
  return parsed.customerName && parsed.customerPhone && parsed.address
    ? '飞书建单'
    : '占用档期（待补资料）'
}

function buildBookingResultCard(created) {
  const isOk = Boolean(created?.ok)
  const pending = isOk && buildBookingLatestLogisticsStatus(created.parsed || {}).includes('待补资料')
  const title = !isOk ? '建单失败' : pending ? '占用档期成功' : '建单成功'
  return buildFeishuCard({
    config: { wide_screen_mode: true },
    header: {
      template: !isOk ? 'red' : pending ? 'orange' : 'green',
      title: { tag: 'plain_text', content: title },
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: buildBookingResultMessage(created) } },
    ],
  })
}

function shouldProcessFeishuMessage(messageId, now = Date.now()) {
  if (!messageId) return true
  for (const [id, createdAt] of processedFeishuMessageById.entries()) {
    if (createdAt + FEISHU_MESSAGE_DEDUPE_TTL_MS <= now) processedFeishuMessageById.delete(id)
  }
  if (processedFeishuMessageById.has(messageId)) return false
  processedFeishuMessageById.set(messageId, now)
  return true
}

function isMorningShipment(order) {
  const hour = Number(String(order?.planned_ship_at || '').slice(11, 13))
  return Number.isFinite(hour) && hour > 0 && hour <= 12
}

function isFarShipment(order) {
  const province = String(order?.province || '')
  const city = String(order?.city || '')
  const address = `${province}${city}${order?.address || ''}`
  if (!address.trim()) return false
  return !/四川|成都|双流|武侯/.test(address)
}

function fulfillmentPriority(order, type) {
  if (type === 'return_overdue') return 0
  if (type === 'ship' && isMorningShipment(order) && isFarShipment(order)) return 1
  if (type === 'ship' && isMorningShipment(order)) return 2
  if (type === 'ship' && isFarShipment(order)) return 3
  if (type === 'ship') return 4
  return 5
}

function formatOrderLine(order, type) {
  const tags = []
  if (type === 'ship') {
    if (isMorningShipment(order)) tags.push('早发')
    if (isFarShipment(order)) tags.push('外地')
  }
  if (type === 'return_overdue') tags.push('逾期')
  const tagText = tags.length ? `【${tags.join('/')}】` : ''
  const dateText = type === 'ship'
    ? `${formatChineseMonthDay(String(order.planned_ship_at || '').slice(0, 10))} ${formatShortTime(order.planned_ship_at)}`
    : formatChineseMonthDay(order.rent_end_date)
  const address = [order.province, order.city, order.district, order.address].filter(Boolean).join('')
  return `${tagText}#${order.id} ${order.customer_name || '-'}｜${order.model_code || '-'}｜${order.unit_code || '-'}｜${dateText}｜${address || '-'}`
}

function buildFulfillmentDigest(tasks = {}, { title = '履约待办', taskType = 'all' } = {}) {
  const infoItems = (tasks.pendingInfo || [])
    .map((order) => ({ type: 'info', order, priority: fulfillmentPriority(order, 'ship') }))
  const shipItems = (tasks.pendingShip || [])
    .map((order) => ({ type: 'ship', order, priority: fulfillmentPriority(order, 'ship') }))
  const returnItems = (tasks.pendingReturn || [])
    .map((order) => ({ type: 'return', order, priority: fulfillmentPriority(order, 'return') }))
  const overdueItems = (tasks.overdueReturn || [])
    .map((order) => ({ type: 'return_overdue', order, priority: fulfillmentPriority(order, 'return_overdue') }))

  const sections = []
  if (taskType === 'all' || taskType === 'ship') {
    const rows = infoItems.sort((a, b) => a.priority - b.priority).map((item) => formatOrderLine(item.order, 'ship'))
    if (rows.length) sections.push(`**待补资料 ${rows.length} 单**\n${rows.slice(0, 20).join('\n')}`)
  }
  if (taskType === 'all' || taskType === 'ship') {
    const rows = shipItems.sort((a, b) => a.priority - b.priority).map((item) => formatOrderLine(item.order, item.type))
    sections.push(`**待发货 ${rows.length} 单**\n${rows.slice(0, 20).join('\n') || '暂无'}`)
  }
  if (taskType === 'all' || taskType === 'return') {
    const dueRows = returnItems.sort((a, b) => a.priority - b.priority).map((item) => formatOrderLine(item.order, item.type))
    const overdueRows = overdueItems.sort((a, b) => a.priority - b.priority).map((item) => formatOrderLine(item.order, item.type))
    sections.push(`**待归还 ${dueRows.length} 单**\n${dueRows.slice(0, 20).join('\n') || '暂无'}`)
    if (overdueRows.length) sections.push(`**逾期待完结 ${overdueRows.length} 单**\n${overdueRows.slice(0, 20).join('\n')}`)
  }

  return {
    title,
    content: [
      `日期：${tasks.dateFrom}${tasks.dateTo && tasks.dateTo !== tasks.dateFrom ? ` 至 ${tasks.dateTo}` : ''}`,
      '',
      ...sections,
      '',
      '优先级：逾期归还 > 早发外地 > 早发 > 外地 > 普通发货。',
    ].filter(Boolean).join('\n'),
  }
}

function buildTaskActionValue(actionType, order, options = {}) {
  return {
    action_type: actionType,
    order_id: order.id,
    task_date_preset: options.taskDatePreset || 'today',
    task_type: options.taskType || 'all',
  }
}

function buildOrderTaskText(order, type) {
  const tagText = type === 'ship'
    ? [isMorningShipment(order) ? '早发' : '', isFarShipment(order) ? '外地' : ''].filter(Boolean).join(' / ')
    : type === 'return_overdue'
      ? '逾期'
      : ''
  const address = [order.province, order.city, order.district, order.address].filter(Boolean).join('')
  const timeLabel = type === 'ship' ? '发货' : type === 'return_overdue' ? '逾期' : '归还'
  const timeValue = type === 'ship'
    ? `${formatChineseMonthDay(String(order.planned_ship_at || '').slice(0, 10))} ${formatShortTime(order.planned_ship_at)}`
    : formatChineseMonthDay(order.rent_end_date)
  return [
    `**#${order.id} ${order.customer_name || '-'}**`,
    `${order.model_code || '-'}｜${order.unit_code || '-'}`,
    `${timeLabel}：${timeValue}`,
    address ? `地址：${address}` : '',
    tagText ? `标记：${tagText}` : '',
  ].filter(Boolean).join('\n')
}

function buildPendingInfoText(order) {
  const missing = []
  if (!order.customer_name) missing.push('姓名')
  if (!order.customer_phone) missing.push('手机号')
  if (!order.address) missing.push('地址')
  if (!(Number(order.fee) > 0)) missing.push('租金')
  const shipText = order.planned_ship_at
    ? `${formatChineseMonthDay(String(order.planned_ship_at || '').slice(0, 10))} ${formatShortTime(order.planned_ship_at)}`
    : '-'
  return [
    `**#${order.id} ${order.customer_name || '待补资料'}**`,
    `${order.model_code || '-'}｜${order.unit_code || '-'}`,
    `发货：${shipText}`,
    `缺少：${missing.join('、') || '资料待确认'}`,
  ].join('\n')
}

function buildPendingInfoElements(items, options = {}) {
  const limit = Number(options.sectionLimit || 0) || (options.taskType === 'all' ? 4 : 8)
  const elements = [
    { tag: 'div', text: { tag: 'lark_md', content: `**待补资料 ${items.length} 单**` } },
  ]
  if (!items.length) {
    elements.push({ tag: 'div', text: { tag: 'plain_text', content: '暂无' } })
    return elements
  }
  for (const item of items.slice(0, limit)) {
    elements.push({ tag: 'hr' })
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: buildPendingInfoText(item.order) } })
  }
  if (items.length > limit) {
    elements.push({ tag: 'div', text: { tag: 'plain_text', content: `还有 ${items.length - limit} 单待补资料，可用订单详情继续处理。` } })
  }
  return elements
}

function buildFulfillmentOrderElements(title, items, actionType, actionText, options = {}) {
  const limit = Number(options.sectionLimit || 0) || (options.taskType === 'all' ? 4 : 8)
  const elements = [
    { tag: 'div', text: { tag: 'lark_md', content: `**${title} ${items.length} 单**` } },
  ]
  if (!items.length) {
    elements.push({ tag: 'div', text: { tag: 'plain_text', content: '暂无' } })
    return elements
  }
  for (const item of items.slice(0, limit)) {
    elements.push({ tag: 'hr' })
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: buildOrderTaskText(item.order, item.type) } })
    elements.push({
      tag: 'action',
      actions: [{
        tag: 'button',
        text: { tag: 'plain_text', content: `${actionText} #${item.order.id}` },
        type: actionType === 'mark_shipped' ? 'primary' : 'default',
        value: buildTaskActionValue(actionType, item.order, options),
      }],
    })
  }
  if (items.length > limit) {
    elements.push({ tag: 'div', text: { tag: 'plain_text', content: `还有 ${items.length - limit} 单未展示，可用手机工作台查看。` } })
  }
  return elements
}

function buildFulfillmentCard(tasks, options = {}) {
  const digest = buildFulfillmentDigest(tasks, options)
  const taskType = options.taskType || 'all'
  const infoItems = (tasks.pendingInfo || [])
    .map((order) => ({ type: 'info', order, priority: fulfillmentPriority(order, 'ship') }))
    .sort((a, b) => a.priority - b.priority)
  const shipItems = (tasks.pendingShip || [])
    .map((order) => ({ type: 'ship', order, priority: fulfillmentPriority(order, 'ship') }))
    .sort((a, b) => a.priority - b.priority)
  const returnItems = (tasks.pendingReturn || [])
    .map((order) => ({ type: 'return', order, priority: fulfillmentPriority(order, 'return') }))
    .sort((a, b) => a.priority - b.priority)
  const overdueItems = (tasks.overdueReturn || [])
    .map((order) => ({ type: 'return_overdue', order, priority: fulfillmentPriority(order, 'return_overdue') }))
    .sort((a, b) => a.priority - b.priority)

  const elements = [
    { tag: 'div', text: { tag: 'plain_text', content: `日期：${tasks.dateFrom}${tasks.dateTo && tasks.dateTo !== tasks.dateFrom ? ` 至 ${tasks.dateTo}` : ''}` } },
  ]
  if (taskType === 'all' || taskType === 'ship') {
    elements.push(...buildPendingInfoElements(infoItems, options))
  }
  if (taskType === 'all' || taskType === 'return') {
    elements.push(...buildFulfillmentOrderElements('逾期待完结', overdueItems, 'mark_returned', '确认归还', options))
  }
  if (taskType === 'all' || taskType === 'ship') {
    elements.push(...buildFulfillmentOrderElements('待发货', shipItems, 'mark_shipped', '确认发货', options))
  }
  if (taskType === 'all' || taskType === 'return') {
    elements.push(...buildFulfillmentOrderElements('待归还', returnItems, 'mark_returned', '确认归还', options))
  }
  elements.push({ tag: 'note', elements: [{ tag: 'plain_text', content: '优先级：逾期归还 > 早发外地 > 早发 > 外地 > 普通发货' }] })

  return buildFeishuCard({
    config: { wide_screen_mode: true },
    header: { template: 'blue', title: { tag: 'plain_text', content: digest.title } },
    elements,
  })
}

function buildMobileWorkbenchHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#15171a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="小狗相机助手" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <link rel="manifest" href="/mobile/manifest.json" />
  <link rel="apple-touch-icon" href="/mobile/icon.png" />
  <title>小狗相机助手</title>
  <style>
    :root {
      color-scheme: light;
      --bg:#f3f1eb;
      --bg-soft:#ebe6da;
      --panel:#fffdf8;
      --panel-2:#ffffff;
      --text:#1f1f1b;
      --muted:#6d685d;
      --line:#ddd5c5;
      --line-strong:#cfc4b0;
      --primary:#181714;
      --accent:#c76b2d;
      --accent-soft:#f4d8c1;
      --green:#1f7a50;
      --green-soft:#d6f3e4;
      --orange:#b4681f;
      --orange-soft:#f8e0be;
      --red:#b44533;
      --red-soft:#f8d7d2;
      --blue:#2359d6;
      --shadow:0 14px 40px rgba(34, 29, 19, .08);
    }
    * { box-sizing: border-box; }
    html { background: radial-gradient(circle at top, #f7f1e7 0%, var(--bg) 52%, #efebe2 100%); }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(221, 180, 135, .22), transparent 24%),
        radial-gradient(circle at top right, rgba(52, 101, 164, .10), transparent 18%),
        linear-gradient(180deg, #f7f1e7 0%, var(--bg) 28%, #efebe2 100%);
      color: var(--text);
      min-height: 100vh;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image: linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px);
      background-size: 24px 24px;
      opacity: .28;
      mask-image: linear-gradient(180deg, rgba(0,0,0,.55), transparent 65%);
    }
    header { position: sticky; top: 0; z-index: 18; padding: 14px 14px 0; backdrop-filter: blur(20px); }
    .hero {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.55);
      border-radius: 26px;
      padding: 16px;
      background:
        linear-gradient(145deg, rgba(24,23,20,.96), rgba(56,48,38,.92)),
        linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,0));
      color: #f7f3eb;
      box-shadow: var(--shadow);
    }
    .hero::after {
      content: '';
      position: absolute;
      width: 180px;
      height: 180px;
      right: -80px;
      top: -90px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(241, 196, 145, .28) 0%, rgba(241, 196, 145, 0) 70%);
    }
    .topbar { display: flex; align-items: flex-start; gap: 12px; position: relative; z-index: 1; }
    .logo {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,.2);
      box-shadow: 0 10px 22px rgba(0,0,0,.22);
    }
    .brand-copy { min-width: 0; flex: 1; }
    h1 { margin: 0; font-size: 28px; line-height: 1.02; letter-spacing: -.03em; }
    .sub { color: rgba(247,243,235,.72); font-size: 13px; margin-top: 6px; line-height: 1.45; }
    .tabs {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: max(10px, env(safe-area-inset-bottom));
      z-index: 25;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      padding: 8px;
      border-radius: 22px;
      background: rgba(255,253,248,.92);
      border: 1px solid rgba(217, 208, 194, .95);
      box-shadow: 0 18px 36px rgba(39, 32, 21, .16);
      backdrop-filter: blur(18px);
    }
    .tab {
      border: 0;
      border-radius: 12px;
      padding: 11px 6px;
      background: transparent;
      color: #6a665d;
      font-size: 12px;
      min-height: 48px;
    }
    .tab-label { font-size: 13px; font-weight: 700; }
    .tab.active {
      background: linear-gradient(180deg, #1f1d19, #2a2620);
      color: #fff7eb;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    }
    main { padding: 14px; padding-bottom: calc(106px + env(safe-area-inset-bottom)); max-width: 760px; margin: 0 auto; }
    section { display: none; }
    section.active { display: grid; gap: 14px; animation: fadeUp .18s ease-out; }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .panel {
      background: linear-gradient(180deg, rgba(255,253,248,.98), rgba(255,251,244,.96));
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 15px;
      box-shadow: 0 10px 28px rgba(49, 40, 28, .04);
    }
    .panel.soft { background: linear-gradient(180deg, rgba(246, 240, 228, .88), rgba(255,251,244,.96)); }
    .section-label { font-size: 11px; font-weight: 700; color: var(--accent); letter-spacing: .08em; text-transform: uppercase; }
    .panel-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
    .panel-title strong { font-size: 18px; letter-spacing: -.02em; }
    .panel-title .meta { font-size: 12px; }
    .panel-copy { margin: -4px 0 12px; color: var(--muted); font-size: 13px; line-height: 1.55; }
    .grid { display: grid; gap: 12px; }
    .grid > * { min-width: 0; }
    .two { grid-template-columns: 1fr; }
    label { display: grid; gap: 7px; font-size: 12px; color: #595447; font-weight: 600; }
    .field-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .field-head-label { display: block; font-size: 12px; color: #595447; font-weight: 600; }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--line-strong);
      border-radius: 16px;
      padding: 13px 14px;
      font-size: 16px;
      background: rgba(255,255,255,.92);
      color: var(--text);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
    }
    input::placeholder, textarea::placeholder { color: #9b9487; }
    input:focus, select:focus, textarea:focus { outline: 0; border-color: #b98b61; box-shadow: 0 0 0 4px rgba(199, 107, 45, .12); }
    .date-control {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      min-width: 0;
      height: 52px;
      border: 1px solid var(--line-strong);
      border-radius: 16px;
      padding: 0 14px;
      background: rgba(255,255,255,.92);
      color: var(--text);
      font-size: 16px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
    }
    .date-control:focus-within { border-color: #b98b61; box-shadow: 0 0 0 4px rgba(199, 107, 45, .12); }
    .date-display { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; font-weight: 600; }
    .date-display.placeholder { color: #9b9487; font-weight: 500; }
    .date-control input[type="date"], .date-control input[type="month"] { position: absolute; inset: 0; display: block; width: 100%; min-width: 0; height: 100%; margin: 0; padding: 0; border: 0; opacity: 0; cursor: pointer; }
    textarea { min-height: 98px; resize: vertical; line-height: 1.5; }
    button {
      border: 0;
      border-radius: 16px;
      padding: 12px 14px;
      background: linear-gradient(180deg, #1f1d19, #2a2620);
      color: #fff7eb;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -.01em;
      box-shadow: 0 8px 20px rgba(32, 28, 20, .16);
    }
    button.secondary {
      background: #ece4d7;
      color: #2d281f;
      box-shadow: none;
    }
    button.ghost {
      background: transparent;
      color: var(--blue);
      padding: 6px 0;
      border-radius: 0;
      box-shadow: none;
    }
    button.green { background: linear-gradient(180deg, #1e7d51, #195d3d); }
    button.red { background: linear-gradient(180deg, #bf5541, #963c2d); }
    button:disabled { opacity: .55; box-shadow: none; }
    .seg { display: flex; gap: 8px; flex-wrap: wrap; }
    .seg button { flex: 0 0 auto; padding: 10px 14px; background: #ede5d9; color: #4e473d; box-shadow: none; }
    .seg button.active { background: linear-gradient(180deg, #1f1d19, #2a2620); color: #fff7eb; }
    .cards { display: grid; gap: 12px; }
    .card {
      background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,251,244,.96));
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 14px;
      display: grid;
      gap: 10px;
      box-shadow: 0 10px 24px rgba(49, 40, 28, .04);
    }
    .card-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .name { font-weight: 800; font-size: 17px; letter-spacing: -.02em; }
    .meta { color: var(--muted); font-size: 12px; line-height: 1.55; }
    .meta strong { color: var(--text); }
    .pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 10px;
      background: #ece4d7;
      color: #4e473d;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .pill.green { background: var(--green-soft); color: var(--green); }
    .pill.orange { background: var(--orange-soft); color: var(--orange); }
    .pill.red { background: var(--red-soft); color: var(--red); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions > * { flex: 1 1 140px; }
    .empty { padding: 28px 12px; text-align: center; color: var(--muted); font-size: 14px; }
    .result {
      white-space: pre-wrap;
      word-break: break-word;
      background: #f8f3ea;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 12px;
      line-height: 1.6;
      font-size: 13px;
    }
    .alert-error {
      white-space: pre-wrap;
      word-break: break-word;
      background: #fff1ee;
      border: 1px solid #f0b8ae;
      border-radius: 18px;
      padding: 12px;
      color: #9c3628;
      line-height: 1.55;
      font-size: 13px;
    }
    .alert-error strong { display: block; margin-bottom: 3px; }
    .reply {
      white-space: pre-wrap;
      border: 1px dashed #c4b49d;
      border-radius: 18px;
      padding: 12px;
      line-height: 1.6;
      font-size: 14px;
      background: #fffefb;
    }
    .hero-stat-grid, .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .hero-stat-card, .summary-card {
      background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,249,240,.95));
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 14px;
      display: grid;
      gap: 6px;
      min-height: 102px;
      align-content: space-between;
    }
    .hero-stat-card b, .summary-card b { font-size: 30px; line-height: 1; letter-spacing: -.03em; }
    .hero-stat-card span, .summary-card span { color: var(--muted); font-size: 12px; }
    .hero-stat-card strong { font-size: 15px; }
    .inline-kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .inline-kpi {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #f3ebde;
      color: #544d42;
      font-size: 12px;
    }
    .step-list {
      display: grid;
      gap: 12px;
      counter-reset: steps;
    }
    .step-card {
      position: relative;
      padding-left: 54px;
    }
    .step-card::before {
      counter-increment: steps;
      content: counter(steps);
      position: absolute;
      left: 0;
      top: 14px;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: linear-gradient(180deg, #1f1d19, #2a2620);
      color: #fff7eb;
      display: grid;
      place-items: center;
      font-size: 15px;
      font-weight: 800;
      box-shadow: 0 10px 18px rgba(32, 28, 20, .14);
    }
    .tool-strip {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .tool-card {
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 14px;
      background: linear-gradient(180deg, rgba(255,255,255,.94), rgba(246,239,228,.92));
      display: grid;
      gap: 8px;
    }
    .tool-card strong { font-size: 16px; }
    .tool-card .meta { font-size: 12px; }
    .order-highlights {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .order-highlight {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: 999px;
      background: #f3ebde;
      color: #554f44;
      font-size: 12px;
      font-weight: 700;
    }
    .schedule-legend { display: flex; flex-wrap: wrap; gap: 8px 12px; padding-top: 4px; }
    .schedule-legend-item { display: inline-flex; align-items: center; gap: 6px; color: #5d564a; font-size: 12px; }
    .schedule-legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; border: 1px solid rgba(15, 23, 42, .08); }
    .schedule-legend-dot.full { background: #fecaca; }
    .schedule-legend-dot.tight { background: #fde68a; }
    .schedule-legend-dot.open { background: #bbf7d0; }
    .schedule-legend-dot.rent { background: #111827; }
    .schedule-legend-dot.shipping { background: #dbeafe; }
    .schedule-legend-dot.return { background: #fce7f3; }
    .schedule-legend-dot.buffer { background: #fef3c7; }
    .schedule-overview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .schedule-overview-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: grid; gap: 6px; }
    .schedule-overview-card span { color: var(--muted); font-size: 12px; }
    .schedule-overview-card b { color: var(--text); font-size: 24px; line-height: 1; }
    .schedule-overview-card strong { color: var(--muted); font-size: 12px; font-weight: 600; }
    .group-card { display: grid; gap: 10px; }
    .group-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .group-title { font-size: 15px; font-weight: 700; }
    .group-meta { color: var(--muted); font-size: 12px; line-height: 1.5; }
    .group-heat { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(24px, 1fr); gap: 4px; overflow-x: auto; padding-bottom: 2px; }
    .group-heat-cell { border: 0; border-radius: 8px; padding: 6px 0; font-size: 11px; color: #344054; background: #f8fafc; min-width: 24px; }
    .group-heat-cell.schedule-heat-full { background: #fee4e2; color: #b42318; }
    .group-heat-cell.schedule-heat-tight { background: #fef3c7; color: #b54708; }
    .group-heat-cell.schedule-heat-open { background: #dcfae6; color: #067647; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .summary-card { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: grid; gap: 4px; }
    .summary-card b { font-size: 22px; line-height: 1; }
    .summary-card span { color: var(--muted); font-size: 12px; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .detail-actions button { flex: 1 1 120px; }
    .detail-section { display: grid; gap: 8px; }
    .detail-section-title { font-size: 13px; font-weight: 700; color: #344054; }
    .detail-grid-two { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
    .detail-card { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 10px; display: grid; gap: 4px; }
    .detail-card small { color: #667085; font-size: 11px; }
    .detail-card div { color: #111827; font-size: 13px; line-height: 1.5; word-break: break-word; }
    .status-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .hint-box { background: #fffbeb; border: 1px solid #fed7aa; border-radius: 10px; padding: 10px; color: #b54708; font-size: 12px; line-height: 1.55; }
    .schedule-scroll { overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
    .schedule-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
    .schedule-table th, .schedule-table td { border-right: 1px solid #edf0f3; border-bottom: 1px solid #edf0f3; min-width: 42px; width: 42px; height: 42px; padding: 0; text-align: center; vertical-align: middle; }
    .schedule-table th:first-child, .schedule-table td:first-child { position: sticky; left: 0; z-index: 2; min-width: 118px; width: 118px; text-align: left; padding: 0 10px; background: #fff; }
    .schedule-table thead th { position: sticky; top: 0; z-index: 3; background: #fff; color: #475467; font-size: 12px; font-weight: 600; }
    .schedule-table thead th:first-child { z-index: 4; }
    .schedule-table tr:first-child th { border-top: 0; }
    .schedule-table th:first-child, .schedule-table td:first-child { border-left: 0; }
    .schedule-table tr:last-child td { border-bottom: 0; }
    .schedule-table .schedule-sticky-head { background: #f8fafc; }
    .schedule-day-head { display: grid; line-height: 1.1; justify-items: center; }
    .schedule-day-head .month { font-size: 10px; color: #98a2b3; }
    .schedule-day-head .day { font-size: 12px; color: #344054; }
    .schedule-row-meta { display: grid; gap: 2px; padding: 8px 0; }
    .schedule-row-meta strong { font-size: 13px; color: #111827; }
    .schedule-row-meta span { font-size: 11px; color: #667085; }
    .schedule-model-cell { background: #f8fafc; }
    .schedule-model-cell strong { font-size: 13px; color: #111827; }
    .schedule-model-cell span { font-size: 11px; color: #667085; }
    .schedule-cell-btn { width: 100%; height: 100%; border: 0; border-radius: 0; padding: 0 2px; background: #fff; color: #111827; font-size: 11px; }
    .schedule-cell-empty { color: #98a2b3; background: #fff; }
    .schedule-cell-rent { background: #111827; color: #fff; }
    .schedule-cell-shipping { background: #dbeafe; color: #1d4ed8; }
    .schedule-cell-return { background: #fce7f3; color: #be185d; }
    .schedule-cell-buffer { background: #fef3c7; color: #b54708; }
    .schedule-cell-btn.schedule-clickable { font-weight: 700; }
    .schedule-cell-heat { border: 0; border-radius: 0; width: 100%; height: 100%; padding: 0; font-size: 11px; color: #475467; background: #f8fafc; }
    .schedule-cell-heat.schedule-heat-full { background: #fee4e2; color: #b42318; }
    .schedule-cell-heat.schedule-heat-tight { background: #fef3c7; color: #b54708; }
    .schedule-cell-heat.schedule-heat-open { background: #dcfae6; color: #067647; }
    .sheet-backdrop[hidden] { display: none; }
    .sheet-backdrop { position: fixed; inset: 0; z-index: 35; background: rgba(15, 23, 42, .46); display: flex; align-items: flex-end; justify-content: center; }
    .sheet { width: min(760px, 100%); max-height: 82vh; overflow: auto; background: #fff; border-radius: 16px 16px 0 0; padding: 14px 12px 18px; box-shadow: 0 -10px 28px rgba(15, 23, 42, .18); display: grid; gap: 12px; }
    .sheet-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .sheet-head strong { font-size: 16px; }
    .sheet-close { background: #eef0f3; color: #20242c; padding: 8px 10px; }
    .sheet-grid { display: grid; gap: 8px; }
    .sheet-kv { background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 10px; display: grid; gap: 3px; }
    .sheet-kv small { color: #667085; font-size: 11px; }
    .sheet-kv div { color: #111827; font-size: 13px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
    .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #111827; color: #fff; padding: 9px 12px; border-radius: 999px; font-size: 13px; opacity: 0; pointer-events: none; transition: opacity .18s; z-index: 20; }
    .toast.show { opacity: 1; }
    /* Final mobile ops polish: compact, scan-first surfaces for repeated phone use. */
    :root {
      --bg:#eef2f7;
      --bg-soft:#f6f8fb;
      --panel:#ffffff;
      --panel-2:#f8fbff;
      --text:#15181d;
      --muted:#667085;
      --line:#dde3ec;
      --line-strong:#cfd7e3;
      --primary:#111827;
      --accent:#2563eb;
      --accent-soft:#e8efff;
      --green:#16805a;
      --green-soft:#e3f7ed;
      --orange:#b75d12;
      --orange-soft:#fff0dd;
      --red:#c23d2c;
      --red-soft:#ffe8e4;
      --blue:#2563eb;
      --shadow:0 12px 34px rgba(21, 24, 29, .08);
    }
    html { background: #e9edf3; }
    body {
      background:
        linear-gradient(180deg, rgba(37,99,235,.05), rgba(22,128,90,.04) 28%, transparent 54%),
        linear-gradient(180deg, #f8fbff 0%, var(--bg) 36%, #e9edf3 100%);
    }
    body::before { display: none; }
    header {
      padding: 12px 12px 0;
      background: rgba(248,251,255,.72);
      border-bottom: 1px solid rgba(221,227,236,.65);
    }
    .hero {
      border-radius: 8px;
      padding: 14px 14px 104px;
      background: linear-gradient(180deg, #ffffff, #f8fbff);
      color: var(--text);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }
    .hero::after { display: none; }
    .logo {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      border-color: var(--line);
      box-shadow: none;
    }
    h1 { font-size: 22px; letter-spacing: 0; }
    .sub { color: var(--muted); font-size: 12px; }
    .tabs {
      left: 12px;
      right: 12px;
      gap: 4px;
      padding: 8px;
      border-radius: 8px;
      background: rgba(255,255,255,.92);
      border-color: var(--line);
      box-shadow: 0 -12px 30px rgba(21, 24, 29, .08);
    }
    .tab { border-radius: 8px; min-height: 48px; color: var(--muted); padding: 10px 4px; }
    .tab-label { font-size: 12px; }
    .tab.active {
      background: linear-gradient(180deg, #1d2430, var(--primary));
      color: #fff;
      box-shadow: none;
    }
    main { padding: 12px; padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
    section.active { gap: 12px; }
    .panel, .card, .hero-stat-card, .summary-card, .tool-card {
      border-radius: 8px;
      background: var(--panel);
      border-color: var(--line);
      box-shadow: 0 6px 18px rgba(21,24,29,.05);
    }
    .panel { padding: 12px; }
    .panel.soft { background: linear-gradient(180deg, #fff, #f8fbff); }
    .section-label {
      color: var(--blue);
      letter-spacing: 0;
      text-transform: none;
    }
    .panel-title strong { font-size: 18px; letter-spacing: 0; }
    .panel-copy { color: var(--muted); }
    label, .field-head-label { color: #475467; }
    input, select, textarea, .date-control {
      border-radius: 8px;
      background: #fff;
      border-color: var(--line-strong);
      box-shadow: none;
    }
    input:focus, select:focus, textarea:focus, .date-control:focus-within {
      border-color: var(--blue);
      box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }
    button { border-radius: 8px; background: linear-gradient(180deg, #1d2430, var(--primary)); box-shadow: none; letter-spacing: 0; }
    button.secondary, .seg button { background: var(--bg-soft); color: var(--text); }
    .seg button.active { background: var(--primary); color: #fff; }
    button.green { background: linear-gradient(180deg, #1e9668, var(--green)); }
    button.red { background: linear-gradient(180deg, #d24b39, var(--red)); }
    .pill { background: var(--bg-soft); color: #455468; }
    .pill.green { background: var(--green-soft); color: var(--green); }
    .pill.orange { background: var(--orange-soft); color: var(--orange); }
    .pill.red { background: var(--red-soft); color: var(--red); }
    .hero-stat-card, .summary-card { min-height: 92px; }
    .hero-stat-card b, .summary-card b { font-size: 28px; letter-spacing: 0; }
    .inline-kpi, .order-highlight { background: var(--bg-soft); color: #455468; }
    .step-card { padding-left: 48px; }
    .step-card::before {
      left: 12px;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--blue);
      box-shadow: none;
      font-size: 13px;
    }
    .tool-card {
      text-align: left;
      color: var(--text);
    }
    .tool-card strong { color: var(--text); }
    .tool-card .meta { color: var(--muted); }
    .schedule-scroll { border-radius: 8px; }
    .sheet { border-radius: 8px 8px 0 0; }
    .sheet-kv, .detail-card, .hint-box, .result, .reply, .alert-error { border-radius: 8px; }
    .toast { bottom: calc(92px + env(safe-area-inset-bottom)); }
    /* Mobile reference implementation: light app shell, green overview card, compact workbench cards. */
    :root {
      --bg:#f4f6f8;
      --bg-soft:#f7faf9;
      --panel:#ffffff;
      --panel-2:#ffffff;
      --text:#111827;
      --muted:#6b7280;
      --line:#e5e7eb;
      --line-strong:#d1d5db;
      --primary:#0f766e;
      --accent:#0f766e;
      --green:#0f9f85;
      --green-dark:#07806e;
      --green-soft:#e8f7f3;
      --orange:#d97706;
      --orange-soft:#fff7ed;
      --red:#dc2626;
      --red-soft:#fef2f2;
      --blue:#2563eb;
      --blue-soft:#eff6ff;
      --shadow:0 10px 24px rgba(15, 23, 42, .06);
    }
    html { background: var(--bg); overflow-x: hidden; }
    body {
      width: min(100%, 430px);
      margin: 0 auto;
      overflow-x: hidden;
      background: linear-gradient(180deg, #fbfcfd 0%, var(--bg) 100%);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 18;
      padding: 10px 14px 4px;
      background: rgba(244,246,248,.88);
      border-bottom: 0;
      backdrop-filter: blur(18px);
    }
    .hero {
      padding: 0;
      background: transparent;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      color: var(--text);
    }
    .topbar { align-items: center; gap: 10px; min-height: 42px; }
    .logo {
      width: 30px;
      height: 30px;
      border-radius: 999px;
      border: 1px solid var(--line);
      box-shadow: none;
    }
    .brand-copy h1, h1 { font-size: 16px; line-height: 1.2; letter-spacing: 0; font-weight: 800; }
    .sub { display: none; }
    .notify-button {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      flex: 0 0 auto;
      background: #fff;
      color: var(--text);
      border: 1px solid var(--line);
      box-shadow: 0 4px 12px rgba(15, 23, 42, .06);
    }
    .notify-dot {
      position: absolute;
      top: -3px;
      right: -3px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: 999px;
      display: none;
      align-items: center;
      justify-content: center;
      background: #ff4d4f;
      color: #fff;
      border: 2px solid #fff;
      font-size: 10px;
      font-weight: 800;
    }
    main { padding: 8px 14px calc(82px + env(safe-area-inset-bottom)); max-width: 430px; }
    section.active { gap: 12px; }
    .panel, .card, .tool-card, .summary-card, .hero-stat-card {
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .panel { padding: 14px; }
    .panel.soft { background: var(--panel); }
    .panel-title { margin-bottom: 10px; }
    .panel-title strong { font-size: 15px; }
    .section-label { color: var(--primary); font-size: 12px; text-transform: none; letter-spacing: 0; }
    .tabs {
      left: max(14px, calc((100vw - 430px) / 2 + 14px));
      right: max(14px, calc((100vw - 430px) / 2 + 14px));
      bottom: max(10px, env(safe-area-inset-bottom));
      grid-template-columns: repeat(5, 1fr);
      gap: 2px;
      padding: 6px;
      border-radius: 14px;
      background: rgba(255,255,255,.96);
      border: 1px solid var(--line);
      box-shadow: 0 -10px 30px rgba(15, 23, 42, .12);
    }
    .tab { min-height: 46px; border-radius: 10px; color: #667085; background: transparent; box-shadow: none; padding: 6px 4px; }
    .tab-label { font-size: 11px; font-weight: 700; }
    .tab.active { background: transparent; color: var(--primary); box-shadow: none; }
    .tab.active::before {
      content: '';
      display: block;
      width: 20px;
      height: 3px;
      border-radius: 999px;
      background: var(--primary);
      margin: 0 auto 4px;
    }
    .today-overview-card {
      padding: 15px;
      border-radius: 14px;
      color: #fff;
      border: 0;
      background:
        radial-gradient(circle at 92% 0%, rgba(255,255,255,.22), transparent 30%),
        linear-gradient(135deg, #2fc3a4 0%, #0f9f85 46%, #07806e 100%);
      box-shadow: 0 14px 28px rgba(15, 159, 133, .22);
    }
    .overview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .overview-head strong { font-size: 15px; }
    .overview-more { color: rgba(255,255,255,.78); font-size: 12px; background: transparent; padding: 0; box-shadow: none; }
    .overview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 10px; }
    .overview-metric { display: grid; gap: 4px; min-width: 0; }
    .overview-metric span { color: rgba(255,255,255,.72); font-size: 11px; }
    .overview-metric b { color: #fff; font-size: 20px; line-height: 1; letter-spacing: -.01em; }
    .overview-metric small { color: rgba(255,255,255,.82); font-size: 10px; }
    .quick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 8px; }
    .quick-action {
      padding: 0;
      display: grid;
      gap: 7px;
      justify-items: center;
      color: var(--text);
      background: transparent;
      box-shadow: none;
      border-radius: 12px;
      min-height: 58px;
    }
    .quick-icon {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--green-soft);
      color: var(--primary);
      font-size: 17px;
    }
    .quick-action:nth-child(2) .quick-icon,
    .quick-action:nth-child(7) .quick-icon { background: var(--blue-soft); color: var(--blue); }
    .quick-action:nth-child(8) .quick-icon { background: #f3f4f6; color: #667085; }
    .quick-action span { font-size: 11px; font-weight: 700; white-space: nowrap; }
    .home-list { display: grid; gap: 9px; }
    .home-row {
      display: grid;
      grid-template-columns: 24px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .home-row:last-child { border-bottom: 0; }
    .home-row-icon { color: #475467; font-size: 14px; text-align: center; }
    .home-row-title { font-size: 13px; font-weight: 700; color: var(--text); }
    .home-row-meta { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .home-count {
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--red);
      background: var(--red-soft);
      font-size: 11px;
      font-weight: 800;
    }
    .home-count.neutral { color: #667085; background: #f2f4f7; }
    .alert-row { grid-template-columns: 24px 1fr; }
    .alert-row.warning .home-row-title { color: var(--orange); }
    .alert-row.danger .home-row-title { color: var(--red); }
    .card, .tool-card { border-radius: 14px; }
    .step-card { padding-left: 46px; }
    .step-card::before { left: 12px; width: 26px; height: 26px; border-radius: 9px; background: var(--primary); }
    .toast { bottom: calc(82px + env(safe-area-inset-bottom)); }
    @media (min-width: 560px) { .two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
    @media (min-width: 720px) { .desktop-two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
  </style>
</head>
<body>
  <header>
    <div class="hero">
      <div class="topbar">
        <img class="logo" src="/mobile/icon.png" alt="" />
        <div class="brand-copy">
          <h1>小狗相机助手</h1>
          <div class="sub">面向租赁运营的手机工作台。把今日待办、询单建单、订单推进和可视化档期压缩到一个高频操作面板。</div>
        </div>
        <button class="notify-button" data-action="jump-tab" data-tab-target="today" aria-label="待办通知">⌁<span id="homeNotifyBadge" class="notify-dot"></span></button>
      </div>
    </div>
    <nav class="tabs">
      <button class="tab active" data-tab="today"><span class="tab-label">首页</span></button>
      <button class="tab" data-tab="inquiry"><span class="tab-label">询单</span></button>
      <button class="tab" data-tab="orders"><span class="tab-label">订单</span></button>
      <button class="tab" data-tab="fulfillment"><span class="tab-label">档期</span></button>
      <button class="tab" data-tab="mine"><span class="tab-label">免押</span></button>
    </nav>
  </header>
  <main>
    <section id="tab-today" class="active">
      <div class="today-overview-card">
        <div class="overview-head">
          <strong>今日概览</strong>
          <button class="overview-more" data-action="refresh-tasks">刷新</button>
        </div>
        <div id="todayOverviewStats" class="overview-grid"></div>
      </div>
      <div class="panel">
        <div class="panel-title"><strong>快捷功能</strong><button class="ghost" data-action="mobile-placeholder" data-message="更多移动功能会继续接入">更多</button></div>
        <div class="quick-grid">
          <button class="quick-action" data-action="jump-tab" data-tab-target="inquiry"><span class="quick-icon">⌁</span><span>查档期</span></button>
          <button class="quick-action" data-action="jump-tab" data-tab-target="inquiry"><span class="quick-icon">＋</span><span>新建订单</span></button>
          <button class="quick-action" data-action="jump-tab" data-tab-target="orders"><span class="quick-icon">▣</span><span>订单中心</span></button>
          <button class="quick-action" data-action="jump-tab" data-tab-target="fulfillment"><span class="quick-icon">▦</span><span>档期表</span></button>
          <button class="quick-action" data-action="jump-tab" data-tab-target="mine"><span class="quick-icon">◎</span><span>免押管理</span></button>
          <button class="quick-action" data-action="jump-tab" data-tab-target="fulfillment"><span class="quick-icon">◫</span><span>设备占用</span></button>
          <button class="quick-action" data-action="mobile-placeholder" data-message="报表中心暂请在桌面端查看"><span class="quick-icon">◰</span><span>报表中心</span></button>
          <button class="quick-action" data-action="mobile-placeholder" data-message="更多功能后续接入移动端"><span class="quick-icon">•••</span><span>更多</span></button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title"><strong>待办事项</strong><button class="ghost" id="refreshTasks">刷新</button></div>
        <div id="todoList" class="home-list"></div>
      </div>
      <div class="panel">
        <div class="panel-title"><strong>运营提醒</strong><button class="ghost" data-action="refresh-tasks">刷新</button></div>
        <div id="alertCards" class="home-list"></div>
      </div>
    </section>

    <section id="tab-inquiry">
      <div class="panel soft">
        <div class="section-label">Deal Flow</div>
        <div class="panel-title"><strong>询单到建单</strong><span class="pill" id="availabilityStatus">待查询</span></div>
        <div class="panel-copy">推荐流程：先查档期，再把结果一键带入建单。这样店员在手机里可以连续完成“报价判断 -> 锁档 -> 建单”。</div>
        <div class="inline-kpis">
          <span class="inline-kpi">步骤 1 查档期</span>
          <span class="inline-kpi">步骤 2 确认租期与物流</span>
          <span class="inline-kpi">步骤 3 直接建单</span>
        </div>
      </div>
      <div class="step-list">
        <div class="panel grid step-card">
          <div class="panel-title"><strong>查档期</strong><button class="ghost" id="clearAvailabilityAddress">清空地址</button></div>
          <label>型号<select id="modelCode"></select></label>
          <div class="grid two">
            <label>开始日期<div class="date-control"><span class="date-display placeholder" id="rentStartDateDisplay">请选择日期</span><input id="rentStartDate" type="date" aria-label="开始日期" /></div></label>
            <label>租赁天数<input id="rentDays" list="rentDayOptions" inputmode="numeric" placeholder="例如 5" /></label>
          </div>
          <label>结束日期<div class="date-control"><span class="date-display placeholder" id="rentEndDateDisplay">请选择日期</span><input id="rentEndDate" type="date" aria-label="结束日期" /></div></label>
          <datalist id="rentDayOptions"></datalist>
          <div class="grid" style="gap:6px">
            <div class="field-head"><span class="field-head-label">收货信息 / 城市区域</span><span class="meta">顺丰试算至少填省+市</span></div>
            <textarea id="address" placeholder="顺丰试算至少填省+市，如：四川省绵阳市；也可粘贴完整收货信息"></textarea>
          </div>
          <label>运输天数<input id="transitDays" type="number" min="0" placeholder="不填则使用顺丰/默认时效" /></label>
          <button id="queryAvailability">查询档期</button>
        </div>
        <div id="availabilityResult" class="cards"></div>
        <div class="panel grid step-card">
          <div class="panel-title"><strong>创建订单 / 先占档期</strong><button class="ghost" id="fillFromAvailability">使用上次查询</button></div>
          <label>店铺<select id="createStore"></select></label>
          <label>型号<select id="createModelCode"></select></label>
          <label>设备<select id="createUnitId"><option value="">自动分配</option></select></label>
          <div class="grid two">
            <label>开始日期<div class="date-control"><span class="date-display placeholder" id="createRentStartDateDisplay">请选择日期</span><input id="createRentStartDate" type="date" aria-label="开始日期" /></div></label>
            <label>租赁天数<input id="createRentDays" list="createRentDayOptions" inputmode="numeric" /></label>
          </div>
          <label>结束日期<div class="date-control"><span class="date-display placeholder" id="createRentEndDateDisplay">请选择日期</span><input id="createRentEndDate" type="date" aria-label="结束日期" /></div></label>
          <datalist id="createRentDayOptions"></datalist>
          <label>租客姓名<input id="customerName" placeholder="信息不全可先空着，占用档期" /></label>
          <label>地址<textarea id="createAddress" placeholder="可粘贴完整收货信息"></textarea></label>
          <label>手机号<input id="customerPhone" inputmode="tel" /></label>
          <div class="grid two">
            <label>租金<input id="fee" type="number" min="0" step="1" placeholder="可按成交价修改" /></label>
            <label>押金<input id="deposit" type="number" min="0" step="1" placeholder="默认 0" /></label>
          </div>
          <button id="createOrderBtn">创建订单</button>
        </div>
      </div>
      <div id="createResult" class="cards"></div>
    </section>

    <section id="tab-orders">
      <div class="panel soft">
        <div class="section-label">Orders</div>
        <div class="panel-title"><strong>订单中心</strong><button class="ghost" data-action="refresh-orders">刷新订单</button></div>
        <div class="panel-copy">按型号、时间和状态过滤后，直接从卡片进入详情、免押或寄件动作。适合店员在外场快速推进订单。</div>
      </div>
      <div class="panel grid">
        <div class="panel-title"><strong>订单中心</strong><button class="ghost" id="refreshOrders">刷新</button></div>
        <label>型号<select id="orderModelCode"><option value="">全部型号</option></select></label>
        <div class="grid two">
          <label>开始<div class="date-control"><span class="date-display placeholder" id="orderFromDisplay">请选择日期</span><input id="orderFrom" type="date" aria-label="开始" /></div></label>
          <label>结束<div class="date-control"><span class="date-display placeholder" id="orderToDisplay">请选择日期</span><input id="orderTo" type="date" aria-label="结束" /></div></label>
        </div>
        <label>状态<select id="orderStatus">
          <option value="">全部状态</option>
          <option value="waiting_payment">待付款/待处理</option>
          <option value="paid">已付款</option>
          <option value="shipping">运输中</option>
          <option value="active">租赁中</option>
          <option value="returning">归还中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select></label>
      </div>
      <div id="orderCards" class="cards"></div>
    </section>

    <section id="tab-fulfillment">
      <div class="panel soft">
        <div class="section-label">Schedule</div>
        <div class="panel-title"><strong>可视化档期表</strong><button class="ghost" data-action="refresh-schedule">刷新档期</button></div>
        <div class="panel-copy">这里专注查看每个型号、每台设备在本月的占用情况，帮助店员快速判断能不能接单、哪台设备可安排。</div>
      </div>
      <div id="scheduleSummary" class="panel"></div>
      <div class="panel grid">
        <div class="panel-title"><strong>筛选档期</strong><button class="ghost" id="refreshSchedule">刷新</button></div>
        <div class="grid two">
          <label>月份<div class="date-control"><span class="date-display placeholder" id="scheduleMonthDisplay">请选择月份</span><input id="scheduleMonth" type="month" aria-label="月份" /></div></label>
          <label>型号<select id="scheduleModelCode"><option value="">全部型号</option></select></label>
        </div>
        <div class="seg" id="scheduleViewSeg">
          <button class="secondary active" data-view="grouped">型号热力</button>
          <button class="secondary" data-view="month">整月表格</button>
        </div>
      </div>
      <div class="panel schedule-legend">
        <span class="schedule-legend-item"><span class="schedule-legend-dot full"></span>满租</span>
        <span class="schedule-legend-item"><span class="schedule-legend-dot tight"></span>余量不足 1/3</span>
        <span class="schedule-legend-item"><span class="schedule-legend-dot open"></span>空档充足</span>
        <span class="schedule-legend-item"><span class="schedule-legend-dot rent"></span>租期</span>
        <span class="schedule-legend-item"><span class="schedule-legend-dot shipping"></span>发货</span>
        <span class="schedule-legend-item"><span class="schedule-legend-dot return"></span>归还物流</span>
        <span class="schedule-legend-item"><span class="schedule-legend-dot buffer"></span>缓冲</span>
      </div>
      <div id="scheduleGroups" class="cards"></div>
      <div id="scheduleMatrix" class="cards" style="display:none"></div>
    </section>

    <section id="tab-mine">
      <div class="panel soft grid">
        <div class="section-label">Deposit</div>
        <div class="panel-title"><strong>免押管理</strong><button class="ghost" data-action="refresh-deposits">刷新免押</button></div>
        <div id="mineSummary" class="meta">手机端可以直接查看、搜索、复制邀约和完结免押单。创建免押仍需要选择一个订单，以沿用现有免押 API 的业务规则。</div>
      </div>
      <div class="panel grid">
        <div class="panel-title"><strong>筛选免押单</strong><button class="ghost" id="refreshDeposits">刷新</button></div>
        <label>关键词<input id="depositKeyword" placeholder="免押单号 / 订单号 / 客户 / 手机号 / 设备" /></label>
        <label>状态<select id="depositStatus">
          <option value="">全部状态</option>
          <option value="pending_review">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
          <option value="completed">已完结</option>
          <option value="cancelled">已取消</option>
        </select></label>
      </div>
      <div class="panel grid">
        <div class="panel-title"><strong>创建免押单</strong><span class="pill">需关联订单</span></div>
        <label>选择订单<select id="depositCreateOrderId"><option value="">先刷新订单列表</option></select></label>
        <div class="actions">
          <button id="createDepositFromTab">创建免押单</button>
          <button class="secondary" data-action="jump-tab" data-tab-target="orders">去订单中心</button>
        </div>
      </div>
      <div id="depositCards" class="cards"></div>
    </section>
  </main>
  <div id="scheduleDetailSheet" class="sheet-backdrop" hidden>
    <div class="sheet">
      <div class="sheet-head">
        <div>
          <strong id="scheduleDetailTitle">档期详情</strong>
          <div class="meta" id="scheduleDetailMeta"></div>
        </div>
        <button class="sheet-close" id="closeScheduleDetail">关闭</button>
      </div>
      <div id="scheduleDetailBody" class="sheet-grid"></div>
    </div>
  </div>
  <div id="orderDetailSheet" class="sheet-backdrop" hidden>
    <div class="sheet">
      <div class="sheet-head">
        <div>
          <strong id="orderDetailTitle">订单详情</strong>
          <div class="meta" id="orderDetailMeta"></div>
        </div>
        <button class="sheet-close" id="closeOrderDetail">关闭</button>
      </div>
      <div id="orderDetailBody" class="sheet-grid"></div>
    </div>
  </div>
  <div id="toast" class="toast"></div>
  <script>
    var state = { models: [], stores: [], orders: [], deposits: [], taskCounts: { ship: 0, returned: 0, overdue: 0, missing: 0 }, lastAvailability: null, taskDatePreset: 'today', taskType: 'all', scheduleView: 'grouped', scheduleOverview: null, scheduleExpanded: Object.create(null), selectedOrderDetail: null, orderCount: 0, totalTaskCount: 0 }
    var $ = function(id) { return document.getElementById(id) }
    var esc = function(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]) }) }
    function formatLocalDate(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') }
    function parseLocalDate(dateText) {
      var match = String(dateText || '').trim().match(/^(\\d{4})-(\\d{2})-(\\d{2})$/)
      if (!match) return null
      var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      if (Number.isNaN(date.getTime())) return null
      return date
    }
    var today = function() { return formatLocalDate(new Date()) }
    function addDays(dateText, days) {
      var d = parseLocalDate(dateText)
      if (!d) return ''
      d.setDate(d.getDate() + Number(days || 0))
      return formatLocalDate(d)
    }
    function diffDays(start, end) {
      var startDate = parseLocalDate(start)
      var endDate = parseLocalDate(end)
      if (!startDate || !endDate) return ''
      return Math.max(1, Math.round((endDate - startDate) / 86400000) + 1)
    }
    function dateDisplayText(value) {
      var d = parseLocalDate(value)
      return d ? d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日' : '请选择日期'
    }
    function monthDisplayText(value) {
      var match = String(value || '').match(/^(\\d{4})-(\\d{2})$/)
      return match ? Number(match[1]) + '年' + Number(match[2]) + '月' : '请选择月份'
    }
    function syncDateControl(id) {
      var input = $(id)
      var display = $(id + 'Display')
      if (!input || !display) return
      display.textContent = dateDisplayText(input.value)
      display.classList.toggle('placeholder', !input.value)
    }
    function bindDateControl(id) {
      $(id).addEventListener('change', function(){ syncDateControl(id) })
      syncDateControl(id)
    }
    function syncMonthControl(id) {
      var input = $(id)
      var display = $(id + 'Display')
      if (!input || !display) return
      display.textContent = monthDisplayText(input.value)
      display.classList.toggle('placeholder', !input.value)
    }
    function bindMonthControl(id) {
      $(id).addEventListener('change', function(){ syncMonthControl(id) })
      syncMonthControl(id)
    }
    function formatAvailabilityWarning(value) {
      var warning = String(value || '')
      if (warning.indexOf('DestAddress is illegal') >= 0) {
        return '顺丰无法根据当前区域查询时效，请至少填写省+市（如：四川省绵阳市）；当前按本地估算展示。'
      }
      return warning
    }
    function extractPhone(value) {
      var match = String(value || '').replace(/\\s+/g, '').match(/1[3-9]\\d{9}/)
      return match ? match[0] : ''
    }
    function syncCreatePhoneFromAddress() {
      var addressInput = $('createAddress')
      var phoneInput = $('customerPhone')
      if (!addressInput || !phoneInput) return
      var nextPhone = extractPhone(addressInput.value)
      if (!nextPhone || String(phoneInput.value || '').trim()) return
      phoneInput.value = nextPhone
    }
    function toast(message) { var el = $('toast'); el.textContent = message; el.classList.add('show'); setTimeout(function(){ el.classList.remove('show') }, 1600) }
    function money(value) { var n = Number(value || 0); return n ? '¥' + (Number.isInteger(n) ? n : n.toFixed(2)) : '-' }
    function orderAddress(order) { return [order.province, order.city, order.district, order.address].filter(Boolean).join('') || order.address || '-' }
    function clearAvailabilityAddressDefaults() { $('address').value = '' }
    function currentMonth() { return today().slice(0, 7) }
    function scheduleBlockShortLabel(cell) {
      if (!cell || !cell.blockType) return ''
      if (cell.blockType === 'shipping') return '发'
      if (cell.blockType === 'return_shipping') return '回'
      if (cell.blockType === 'buffer') return '缓'
      var label = String(cell.label || '')
      return label ? label.slice(0, 2) : '租'
    }
    function scheduleBlockLabel(cell) {
      if (!cell || !cell.blockType) return '空闲'
      if (cell.blockType === 'shipping') return '发货'
      if (cell.blockType === 'return_shipping') return '归还物流'
      if (cell.blockType === 'buffer') return '缓冲'
      return '租期'
    }
    function scheduleCellClass(cell) {
      if (!cell || !cell.blockType) return 'schedule-cell-empty'
      if (cell.blockType === 'shipping') return 'schedule-cell-shipping'
      if (cell.blockType === 'return_shipping') return 'schedule-cell-return'
      if (cell.blockType === 'buffer') return 'schedule-cell-buffer'
      if (cell.blockType === 'rent') return 'schedule-cell-rent'
      return 'schedule-cell-empty'
    }
    function scheduleHeatClass(stat) {
      var total = Number(stat && stat.total || 0)
      var occupied = Number(stat && stat.occupied || 0)
      if (!total) return 'schedule-heat-open'
      var available = Math.max(0, total - occupied)
      if (available <= 0) return 'schedule-heat-full'
      if ((available / total) < (1 / 3)) return 'schedule-heat-tight'
      return 'schedule-heat-open'
    }
    function scheduleDayLabel(day) {
      var dateText = String(day && day.date || '')
      return {
        month: dateText.slice(5, 7),
        day: String(day && day.day || dateText.slice(8, 10)).replace(/^0/, ''),
      }
    }
    function attr(value) { return esc(value).replace(/&#39;/g, '&#39;') }
    function getScheduleGroupDayStats(group) {
      return (state.scheduleOverview && state.scheduleOverview.days || []).map(function(_, idx) {
        var occupied = 0
        ;(group.rows || []).forEach(function(row) {
          var cell = row.cells && row.cells[idx]
          if (cell && (cell.blockType === 'rent' || cell.blockType === 'shipping')) occupied += 1
        })
        return { occupied: occupied, total: Number(group.totalUnits || 0) }
      })
    }
    function findScheduleContext(modelCode, unitId, date) {
      var overview = state.scheduleOverview || {}
      var group = (overview.groups || []).find(function(item){ return item.modelCode === modelCode })
      if (!group) return null
      var row = (group.rows || []).find(function(item){ return String(item.unitId) === String(unitId) })
      if (!row) return null
      var dayIndex = (overview.days || []).findIndex(function(item){ return item.date === date })
      if (dayIndex < 0) return null
      return { group: group, row: row, day: overview.days[dayIndex], cell: row.cells && row.cells[dayIndex], dayIndex: dayIndex }
    }
    function bindDateDays(startId, daysId, endId) {
      var syncEnd = function() { var s = $(startId).value; var n = Number($(daysId).value || 0); if (s && n > 0) { $(endId).value = addDays(s, n - 1); syncDateControl(endId) } }
      $(startId).addEventListener('change', syncEnd)
      $(daysId).addEventListener('input', syncEnd)
      $(endId).addEventListener('change', function(){ $(daysId).value = diffDays($(startId).value, $(endId).value) || $(daysId).value })
    }
    function switchTab(name) {
      document.querySelectorAll('.tab').forEach(function(btn){ btn.classList.toggle('active', btn.dataset.tab === name) })
      document.querySelectorAll('main section').forEach(function(sec){ sec.classList.toggle('active', sec.id === 'tab-' + name) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (name === 'orders') loadOrders()
      if (name === 'today') loadTasks()
      if (name === 'fulfillment') loadScheduleOverview()
      if (name === 'mine') { loadDeposits(); loadOrders() }
    }
    function setSelectOptions(select, values, emptyText) {
      select.innerHTML = (emptyText ? '<option value="">' + emptyText + '</option>' : '') + values.map(function(value){ return '<option value="' + esc(value) + '">' + esc(value) + '</option>' }).join('')
    }
    async function fetchJson(url, options) {
      var res = await fetch(url, options || {})
      var data = await res.json().catch(function(){ return { ok: false, message: '返回数据不是 JSON' } })
      if (!res.ok || data.ok === false) throw new Error(data.message || ('请求失败 ' + res.status))
      return data
    }
    function setText(id, value) {
      var el = $(id)
      if (el) el.textContent = value
    }
    function setHtml(id, value) {
      var el = $(id)
      if (el) el.innerHTML = value
    }
    function taskSummaryCounts(tasks) {
      return {
        ship: Number((tasks.pendingShip || []).length || 0),
        returned: Number((tasks.pendingReturn || []).length || 0),
        overdue: Number((tasks.overdueReturn || []).length || 0),
        missing: Number((tasks.pendingInfo || []).length || 0),
      }
    }
    function updateHeroMeta(options) {
      var opts = options || {}
      if (typeof opts.totalTasks === 'number') state.totalTaskCount = opts.totalTasks
      if (typeof opts.orderCount === 'number') state.orderCount = opts.orderCount
      var totalTasks = Number(state.totalTaskCount || 0)
      var models = Number(state.models && state.models.length || 0)
      setText('heroTodayCount', String(totalTasks))
      setText('heroModelCount', String(models))
      setText('tabBadgeToday', totalTasks > 99 ? '99+' : String(totalTasks))
      setText('tabBadgeOrders', state.orderCount > 99 ? '99+' : String(state.orderCount))
      var notify = $('homeNotifyBadge')
      if (notify) {
        notify.textContent = totalTasks > 99 ? '99+' : String(totalTasks)
        notify.style.display = totalTasks > 0 ? 'inline-flex' : 'none'
      }
      var focusText = '优先处理待发货与待归还'
      if (opts.overdue > 0) focusText = '有逾期待完结订单，建议优先回收'
      else if (opts.ship > 0) focusText = '今天先推进待发货，再核对档期'
      else if (totalTasks === 0) focusText = '今天待办较少，可以优先处理新询单'
      setText('heroFocusText', focusText)
    }
    function renderTodayHeroStats(tasks) {
      var counts = taskSummaryCounts(tasks || {})
      state.taskCounts = counts
      renderHomeOverview()
      return counts
    }
    function renderHomeOverview() {
      var counts = state.taskCounts || { ship: 0, returned: 0, overdue: 0, missing: 0 }
      var total = counts.ship + counts.returned + counts.overdue + counts.missing
      setHtml('todayOverviewStats', ''
        + '<div class="overview-metric"><span>今日待办</span><b>' + total + '</b><small>待处理事项</small></div>'
        + '<div class="overview-metric"><span>进行中订单</span><b>' + Number(state.orderCount || 0) + '</b><small>当前筛选</small></div>'
        + '<div class="overview-metric"><span>待发货</span><b>' + counts.ship + '</b><small>需要物流</small></div>'
        + '<div class="overview-metric"><span>待归还</span><b>' + counts.returned + '</b><small>关注回收</small></div>'
        + '<div class="overview-metric"><span>逾期待完结</span><b>' + counts.overdue + '</b><small>优先处理</small></div>'
        + '<div class="overview-metric"><span>待补资料</span><b>' + counts.missing + '</b><small>补齐后推进</small></div>')
    }
    function updateHeroDate() {
      var now = new Date()
      setText('heroDateText', now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · 移动运营工作台')
    }
    async function loadBootstrap() {
      var modelsRes = await fetchJson('/api/mobile/model-codes')
      state.models = modelsRes.modelCodes || []
      setSelectOptions($('modelCode'), state.models)
      setSelectOptions($('scheduleModelCode'), state.models, '全部型号')
      setSelectOptions($('createModelCode'), state.models)
      setSelectOptions($('orderModelCode'), state.models, '全部型号')
      ;['rentDayOptions','createRentDayOptions'].forEach(function(id){
        $(id).innerHTML = Array.from({ length: 30 }, function(_, i){ return '<option value="' + (i + 1) + '">' }).join('')
      })
      var storesRes = await fetchJson('/api/mobile/stores')
      state.stores = storesRes.stores || []
      $('createStore').innerHTML = state.stores.map(function(store){ return '<option value="' + store.id + '">' + esc(store.name || store.code) + '</option>' }).join('')
      var start = today()
      $('rentStartDate').value = start
      $('rentDays').value = 3
      $('rentEndDate').value = addDays(start, 2)
      $('address').value = ${JSON.stringify(DEFAULT_AVAILABILITY_ADDRESS)}
      $('createRentStartDate').value = start
      $('createRentDays').value = 3
      $('createRentEndDate').value = addDays(start, 2)
      $('scheduleMonth').value = currentMonth()
      $('orderFrom').value = start.slice(0, 7) + '-01'
      $('orderTo').value = addDays(start, 31)
      ;['rentStartDate','rentEndDate','createRentStartDate','createRentEndDate','orderFrom','orderTo'].forEach(syncDateControl)
      syncMonthControl('scheduleMonth')
      updateHeroDate()
      updateHeroMeta({ totalTasks: 0, orderCount: 0 })
      await Promise.all([loadTasks(), loadOrders()])
    }
    function todoRowsFromCounts(counts) {
      return [
        { key: 'ship', icon: '▣', title: '待发货订单', meta: '需要确认发货或创建寄件', count: counts.ship, tab: 'orders', tone: counts.ship > 0 ? '' : 'neutral' },
        { key: 'return', icon: '↩', title: '待归还订单', meta: '关注回收、验机和完结', count: counts.returned, tab: 'orders', tone: counts.returned > 0 ? '' : 'neutral' },
        { key: 'overdue', icon: '!', title: '逾期待完结', meta: '优先联系客户并处理回收', count: counts.overdue, tab: 'orders', tone: counts.overdue > 0 ? '' : 'neutral' },
        { key: 'missing', icon: '□', title: '待补资料', meta: '补齐地址、手机号等信息', count: counts.missing, tab: 'orders', tone: counts.missing > 0 ? '' : 'neutral' },
      ]
    }
    function renderTodoList(counts) {
      setHtml('todoList', todoRowsFromCounts(counts).map(function(row) {
        return '<div class="home-row" role="button" onclick="switchTab(\\'' + row.tab + '\\')"><div class="home-row-icon">' + row.icon + '</div><div><div class="home-row-title">' + row.title + '</div><div class="home-row-meta">' + row.meta + '</div></div><span class="home-count ' + row.tone + '">' + row.count + '</span></div>'
      }).join(''))
    }
    function renderAlerts(counts) {
      var alerts = []
      if (counts.overdue > 0) alerts.push({ icon: '!', tone: 'danger', title: '有逾期待完结订单', meta: '请优先处理回收和订单完结' })
      if (counts.missing > 0) alerts.push({ icon: '□', tone: 'warning', title: '有订单资料不完整', meta: '补齐收货信息后再推进寄件或免押' })
      if (counts.ship > 0) alerts.push({ icon: '▣', tone: 'warning', title: '有待发货订单', meta: '建议进入订单中心核对免押和寄件状态' })
      if (!alerts.length) alerts.push({ icon: '✓', tone: '', title: '暂无紧急提醒', meta: '当前没有逾期、待发货或资料缺失事项' })
      setHtml('alertCards', alerts.slice(0, 3).map(function(item) {
        return '<div class="home-row alert-row ' + item.tone + '"><div class="home-row-icon">' + item.icon + '</div><div><div class="home-row-title">' + item.title + '</div><div class="home-row-meta">' + item.meta + '</div></div></div>'
      }).join(''))
    }
    function taskRows(tasks) {
      var rows = []
      ;(tasks.pendingInfo || []).forEach(function(order){ rows.push({ group: '待补资料', action: '', order: order, tone: 'orange' }) })
      ;(tasks.overdueReturn || []).forEach(function(order){ rows.push({ group: '逾期待完结', action: 'return', order: order, tone: 'red' }) })
      ;(tasks.pendingShip || []).forEach(function(order){ rows.push({ group: '待发货', action: 'ship', order: order, tone: 'green' }) })
      ;(tasks.pendingReturn || []).forEach(function(order){ rows.push({ group: '待归还', action: 'return', order: order, tone: 'orange' }) })
      return rows
    }
    function renderTaskCards(data) {
      var tasks = data.tasks || {}
      var counts = renderTodayHeroStats(tasks)
      renderTodoList(counts)
      renderAlerts(counts)
      updateHeroMeta({
        totalTasks: counts.ship + counts.returned + counts.overdue + counts.missing,
        overdue: counts.overdue,
        ship: counts.ship,
      })
      var rows = taskRows(data.tasks || {})
      state.todayTaskRows = rows
    }
    async function loadTasks() {
      try {
        setHtml('todoList', '<div class="empty">加载中...</div>')
        setHtml('alertCards', '<div class="empty">正在同步运营提醒...</div>')
        var data = await fetchJson('/api/mobile/fulfillment-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskDatePreset: state.taskDatePreset, taskType: state.taskType })
        })
        renderTaskCards(data)
      } catch (error) {
        setHtml('todoList', '<div class="alert-error"><strong>待办加载失败</strong>' + esc(error.message || error) + '</div>')
        setHtml('alertCards', '<div class="home-row alert-row danger"><div class="home-row-icon">!</div><div><div class="home-row-title">待办加载失败</div><div class="home-row-meta">' + esc(error.message || error) + '</div></div></div>')
      }
    }
    async function markOrder(orderId, action) {
      try {
        await fetchJson(action === 'ship' ? '/api/mobile/orders/mark-shipped' : '/api/mobile/orders/mark-returned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderId })
        })
        toast(action === 'ship' ? '已确认发货' : '已确认归还')
        await Promise.all([loadTasks(), loadOrders()])
        if (state.selectedOrderDetail && Number(state.selectedOrderDetail.order && state.selectedOrderDetail.order.id) === Number(orderId)) {
          await refreshSelectedOrderDetail()
        }
      } catch (error) { toast(error.message || '操作失败') }
    }
    function renderScheduleTableRows(rows, days, options) {
      var opts = options || {}
      return (rows || []).map(function(row) {
        var firstCell = opts.isModelRow
          ? '<td class="schedule-model-cell"><div class="schedule-row-meta"><strong>' + esc(row.label || row.unitCode || '') + '</strong><span>' + esc(row.meta || '') + '</span></div></td>'
          : '<td><div class="schedule-row-meta"><strong>' + esc(row.unitCode || '-') + '</strong><span>' + money(row.unitFee || 0) + '</span></div></td>'
        var cells = (days || []).map(function(day, index) {
          if (opts.isModelRow) {
            var stat = row.dayStats && row.dayStats[index] ? row.dayStats[index] : { occupied: 0, total: 0 }
            return '<td><button class="schedule-cell-heat ' + scheduleHeatClass(stat) + '" data-action="open-schedule-heat" data-model="' + attr(row.modelCode) + '" data-date="' + attr(day.date) + '">' + esc(stat.occupied) + '</button></td>'
          }
          var cell = row.cells && row.cells[index] ? row.cells[index] : null
          var canOpen = cell && (cell.blockType || cell.orderId)
          var btnClass = 'schedule-cell-btn ' + scheduleCellClass(cell) + (canOpen ? ' schedule-clickable' : '')
          var text = scheduleBlockShortLabel(cell)
          var title = row.unitCode + ' ' + day.date + ' ' + scheduleBlockLabel(cell) + (cell && cell.label ? ' ' + cell.label : '')
          return '<td><button class="' + btnClass + '" title="' + esc(title) + '" data-action="open-schedule-detail" data-model="' + attr(row.modelCode || opts.modelCode || '') + '" data-unit-id="' + attr(row.unitId || '') + '" data-date="' + attr(day.date) + '">' + esc(text) + '</button></td>'
        }).join('')
        return '<tr>' + firstCell + cells + '</tr>'
      }).join('')
    }
    function renderScheduleGroupedView(overview) {
      var groups = overview && overview.groups || []
      if (!groups.length) {
        $('scheduleGroups').innerHTML = '<div class="panel empty">当前月份暂无设备或档期数据</div>'
        $('scheduleMatrix').innerHTML = ''
        $('scheduleGroups').style.display = ''
        $('scheduleMatrix').style.display = 'none'
        return
      }
      $('scheduleGroups').style.display = ''
      $('scheduleMatrix').style.display = 'none'
      $('scheduleGroups').innerHTML = groups.map(function(group) {
        var expanded = Boolean(state.scheduleExpanded[group.modelCode])
        var freeCount = Math.max(0, Number(group.totalUnits || 0) - Number(group.occupiedUnits || 0))
        var dayStats = getScheduleGroupDayStats(group)
        var heat = (overview.days || []).map(function(day, index) {
          var stat = dayStats[index] || { occupied: 0, total: 0 }
          return '<button class="group-heat-cell ' + scheduleHeatClass(stat) + '" title="' + esc(day.date + ' 占用 ' + stat.occupied + '/' + stat.total) + '" data-action="open-schedule-heat" data-model="' + attr(group.modelCode) + '" data-date="' + attr(day.date) + '">' + esc(String(day.day || '').replace(/^0/, '')) + '</button>'
        }).join('')
        var table = expanded
          ? '<div class="schedule-scroll"><table class="schedule-table"><thead><tr><th class="schedule-sticky-head">设备</th>' + (overview.days || []).map(function(day) {
              var label = scheduleDayLabel(day)
              return '<th><div class="schedule-day-head"><span class="month">' + esc(label.month) + '月</span><span class="day">' + esc(label.day) + '</span></div></th>'
            }).join('') + '</tr></thead><tbody>' + renderScheduleTableRows((group.rows || []).map(function(row){ return { modelCode: group.modelCode, unitId: row.unitId, unitCode: row.unitCode, unitFee: row.unitFee, cells: row.cells } }), overview.days || [], { modelCode: group.modelCode }) + '</tbody></table></div>'
          : ''
        return '<article class="card group-card"><div class="group-head"><div><div class="group-title">' + esc(group.modelCode) + '</div><div class="group-meta">共 ' + esc(group.totalUnits) + ' 台｜在租 ' + esc(group.occupiedUnits) + ' 台｜空闲 ' + esc(freeCount) + ' 台｜月租金 ' + money(group.modelFee || 0) + '</div></div><button class="ghost" data-action="toggle-schedule-group" data-model="' + attr(group.modelCode) + '">' + (expanded ? '收起' : '展开') + '</button></div><div class="group-heat">' + heat + '</div>' + table + '</article>'
      }).join('')
      $('scheduleMatrix').innerHTML = ''
    }
    function renderScheduleMonthView(overview) {
      var groups = overview && overview.groups || []
      if (!groups.length) {
        $('scheduleMatrix').innerHTML = '<div class="panel empty">当前月份暂无设备或档期数据</div>'
        $('scheduleGroups').innerHTML = ''
        $('scheduleGroups').style.display = 'none'
        $('scheduleMatrix').style.display = ''
        return
      }
      var rows = []
      groups.forEach(function(group) {
        rows.push({
          isModelRow: true,
          modelCode: group.modelCode,
          label: group.modelCode,
          meta: '共 ' + group.totalUnits + ' 台｜在租 ' + group.occupiedUnits + ' 台',
          dayStats: getScheduleGroupDayStats(group),
        })
        ;(group.rows || []).forEach(function(row) {
          rows.push({ modelCode: group.modelCode, unitId: row.unitId, unitCode: row.unitCode, unitFee: row.unitFee, cells: row.cells })
        })
      })
      var head = (overview.days || []).map(function(day) {
        var label = scheduleDayLabel(day)
        return '<th><div class="schedule-day-head"><span class="month">' + esc(label.month) + '月</span><span class="day">' + esc(label.day) + '</span></div></th>'
      }).join('')
      var body = rows.map(function(row) {
        if (row.isModelRow) return renderScheduleTableRows([row], overview.days || [], { isModelRow: true })
        return renderScheduleTableRows([row], overview.days || [], { modelCode: row.modelCode })
      }).join('')
      $('scheduleGroups').style.display = 'none'
      $('scheduleMatrix').style.display = ''
      $('scheduleMatrix').innerHTML = '<div class="panel"><div class="panel-title"><strong>' + esc(overview.month || '') + ' 整月表格</strong><span class="pill">' + esc(overview.summary && overview.summary.totalUnits || 0) + ' 台设备</span></div><div class="schedule-scroll"><table class="schedule-table"><thead><tr><th class="schedule-sticky-head">型号 / 设备</th>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>'
    }
    function renderScheduleOverview() {
      var overview = state.scheduleOverview
      renderScheduleSummary(overview)
      if (state.scheduleView === 'month') {
        renderScheduleMonthView(overview)
        return
      }
      renderScheduleGroupedView(overview)
    }
    function renderScheduleSummary(overview) {
      var summary = overview && overview.summary || {}
      var totalUnits = Number(summary.totalUnits || 0)
      var occupiedUnits = Number(summary.occupiedUnits || 0)
      var availableUnits = Math.max(0, totalUnits - occupiedUnits)
      var usageRate = totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) + '%' : '-'
      var monthText = overview && overview.month ? overview.month : ($('scheduleMonth') && $('scheduleMonth').value || currentMonth())
      setHtml('scheduleSummary', ''
        + '<div class="panel-title"><strong>' + esc(monthText) + ' 档期概览</strong><span class="pill">' + (totalUnits ? '共 ' + totalUnits + ' 台' : '暂无设备') + '</span></div>'
        + '<div class="schedule-overview-grid">'
        + '<div class="schedule-overview-card"><span>设备总数</span><b>' + totalUnits + '</b><strong>当前筛选范围</strong></div>'
        + '<div class="schedule-overview-card"><span>在租 / 占用</span><b>' + occupiedUnits + '</b><strong>占用率 ' + esc(usageRate) + '</strong></div>'
        + '<div class="schedule-overview-card"><span>可安排设备</span><b>' + availableUnits + '</b><strong>可继续接新单</strong></div>'
        + '<div class="schedule-overview-card"><span>本月租金</span><b>' + money(summary.totalFee || 0) + '</b><strong>按订单租期分摊</strong></div>'
        + '</div>')
    }
    async function loadScheduleOverview() {
      try {
        setHtml('scheduleSummary', '<div class="panel-title"><strong>档期概览</strong></div><div class="empty">加载中...</div>')
        $('scheduleGroups').innerHTML = '<div class="panel empty">加载中...</div>'
        $('scheduleMatrix').innerHTML = ''
        var params = new URLSearchParams({
          month: $('scheduleMonth').value || currentMonth(),
          modelCode: $('scheduleModelCode').value || '',
        })
        var data = await fetchJson('/api/mobile/schedule/overview?' + params.toString())
        state.scheduleOverview = data.overview || null
        renderScheduleOverview()
      } catch (error) {
        var html = '<div class="panel"><div class="alert-error"><strong>排期加载失败</strong>' + esc(error.message || error) + '</div></div>'
        $('scheduleGroups').style.display = ''
        $('scheduleMatrix').style.display = 'none'
        $('scheduleGroups').innerHTML = html
        $('scheduleMatrix').innerHTML = ''
      }
    }
    function toggleScheduleGroup(modelCode) {
      state.scheduleExpanded[modelCode] = !state.scheduleExpanded[modelCode]
      renderScheduleOverview()
    }
    function closeScheduleDetail() {
      $('scheduleDetailSheet').hidden = true
      $('scheduleDetailTitle').textContent = '档期详情'
      $('scheduleDetailMeta').textContent = ''
      $('scheduleDetailBody').innerHTML = ''
    }
    function renderScheduleDetailBody(items) {
      return (items || []).map(function(item) {
        return '<div class="sheet-kv"><small>' + esc(item.label || '') + '</small><div>' + esc(item.value || '-') + '</div></div>'
      }).join('')
    }
    async function openScheduleDetail(modelCode, unitId, date) {
      var context = findScheduleContext(modelCode, unitId, date)
      if (!context) return
      $('scheduleDetailSheet').hidden = false
      $('scheduleDetailTitle').textContent = (context.row.unitCode || modelCode || '-') + ' · ' + date
      $('scheduleDetailMeta').textContent = scheduleBlockLabel(context.cell)
      $('scheduleDetailBody').innerHTML = '<div class="panel empty">加载中...</div>'
      if (!context.cell || !context.cell.orderId) {
        $('scheduleDetailBody').innerHTML = renderScheduleDetailBody([
          { label: '型号', value: modelCode },
          { label: '设备', value: context.row.unitCode || '-' },
          { label: '日期', value: date },
          { label: '状态', value: scheduleBlockLabel(context.cell) },
          { label: '备注', value: context.cell && context.cell.label ? context.cell.label : '当前日期空闲' },
        ])
        return
      }
      try {
        var detail = await fetchJson('/api/mobile/orders/detail?orderId=' + encodeURIComponent(context.cell.orderId))
        var order = detail.order || {}
        $('scheduleDetailTitle').textContent = (order.modelCode || modelCode || '-') + ' #' + (order.orderNo || order.id || context.cell.orderId)
        $('scheduleDetailMeta').textContent = (order.unitCode || context.row.unitCode || '-') + '｜' + (order.orderStatus || scheduleBlockLabel(context.cell))
        $('scheduleDetailBody').innerHTML = renderScheduleDetailBody([
          { label: '客户', value: order.customerName || context.cell.label || '-' },
          { label: '店铺', value: order.storeName || '-' },
          { label: '设备', value: order.unitCode || context.row.unitCode || '-' },
          { label: '租期', value: (order.rentStartDate || '-') + ' 至 ' + (order.rentEndDate || '-') },
          { label: '租金', value: money(order.fee) },
          { label: '发货', value: order.plannedShipAt || '-' },
          { label: '到货', value: order.expectedArriveAt || '-' },
          { label: '物流', value: order.latestLogisticsStatus || '-' },
          { label: '地址', value: order.address || '-' },
        ])
      } catch (error) {
        $('scheduleDetailBody').innerHTML = '<div class="alert-error"><strong>订单详情加载失败</strong>' + esc(error.message || error) + '</div>'
      }
    }
    function openScheduleHeat(modelCode, date) {
      var overview = state.scheduleOverview || {}
      var group = (overview.groups || []).find(function(item){ return item.modelCode === modelCode })
      if (!group) return
      var dayIndex = (overview.days || []).findIndex(function(item){ return item.date === date })
      if (dayIndex < 0) return
      var occupied = []
      ;(group.rows || []).forEach(function(row) {
        var cell = row.cells && row.cells[dayIndex]
        if (cell && (cell.blockType === 'rent' || cell.blockType === 'shipping')) {
          occupied.push((row.unitCode || '-') + '｜' + scheduleBlockLabel(cell) + (cell.label ? '｜' + cell.label : ''))
        }
      })
      $('scheduleDetailSheet').hidden = false
      $('scheduleDetailTitle').textContent = modelCode + ' · ' + date
      $('scheduleDetailMeta').textContent = '当日占用 ' + occupied.length + '/' + Number(group.totalUnits || 0) + ' 台'
      $('scheduleDetailBody').innerHTML = renderScheduleDetailBody([
        { label: '型号', value: modelCode },
        { label: '日期', value: date },
        { label: '占用情况', value: occupied.length ? occupied.join('\\n') : '当天暂无占用，可直接安排新单。' },
      ])
    }
    function renderAvailability(data) {
      state.lastAvailability = data
      var a = data.availability || {}
      var units = a.availableUnits || []
      $('availabilityStatus').textContent = a.available ? '有档期' : '无档期'
      $('availabilityStatus').className = 'pill ' + (a.available ? 'green' : 'red')
      var unitOptions = '<option value="">自动分配</option>' + units.map(function(unit){ return '<option value="' + unit.id + '">' + esc(unit.unitCode || unit.unit_code) + '</option>' }).join('')
      $('createUnitId').innerHTML = unitOptions
      var reply = data.customerReply || ''
      var warning = a.plan && a.plan.fallbackReason ? formatAvailabilityWarning(a.plan.fallbackReason) : ''
      var summary = String(data.message || '').split('\\n').filter(function(line){ return line.indexOf('提示：') !== 0 }).join('\\n')
      var html = '<div class="card"><div class="card-head"><div><div class="name">' + esc(a.modelCode || data.parsed.modelCode || '') + '</div><div class="meta">租期：' + esc((a.plan && a.plan.rentStartDate) || data.parsed.rentStartDate || '') + ' 至 ' + esc((a.plan && a.plan.rentEndDate) || data.parsed.rentEndDate || '') + '</div></div><span class="pill ' + (a.available ? 'green' : 'red') + '">' + (a.available ? '可用 ' + units.length + ' 台' : '暂无可用') + '</span></div>'
      html += '<div class="order-highlights">'
      html += '<span class="order-highlight">计划发货 ' + esc(a.plan && a.plan.plannedShipAt || '-') + '</span>'
      html += '<span class="order-highlight">预计到货 ' + esc(a.plan && a.plan.expectedArriveAt || '-') + '</span>'
      if (a.quote && a.quote.ok) html += '<span class="order-highlight">参考报价 ' + money(a.quote.totalPrice || 0) + '</span>'
      html += '</div>'
      html += '<div class="result">' + esc(summary) + '</div>'
      if (warning) html += '<div class="alert-error"><strong>物流计算提醒</strong>' + esc(warning) + '</div>'
      if (reply) html += '<div class="reply" id="customerReply">' + esc(reply) + '</div><div class="actions"><button onclick="copyReply()">复制回复</button><button class="secondary" onclick="fillCreateFromAvailability()">去建单</button></div>'
      html += '</div>'
      $('availabilityResult').innerHTML = html
    }
    async function queryAvailability() {
      try {
        $('availabilityResult').innerHTML = '<div class="panel empty">查询中...</div>'
        var data = await fetchJson('/api/mobile/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelCode: $('modelCode').value,
            rentStartDate: $('rentStartDate').value,
            rentEndDate: $('rentEndDate').value,
            address: $('address').value,
            transitDays: $('transitDays').value
          })
        })
        renderAvailability(data)
      } catch (error) {
        $('availabilityStatus').textContent = '失败'
        $('availabilityStatus').className = 'pill red'
        $('availabilityResult').innerHTML = '<div class="panel"><div class="alert-error"><strong>查询失败</strong>' + esc(error.message || error) + '</div></div>'
      }
    }
    async function copyReply() {
      var text = $('customerReply') ? $('customerReply').innerText : ''
      if (!text) return
      await navigator.clipboard.writeText(text)
      toast('已复制')
    }
    function fillCreateFromAvailability() {
      var data = state.lastAvailability
      if (!data) { toast('没有可用的查询结果'); return }
      var a = data.availability || {}
      $('createModelCode').value = a.modelCode || data.parsed.modelCode || ''
      $('createRentStartDate').value = (a.plan && a.plan.rentStartDate) || data.parsed.rentStartDate || ''
      $('createRentEndDate').value = (a.plan && a.plan.rentEndDate) || data.parsed.rentEndDate || ''
      $('createRentDays').value = diffDays($('createRentStartDate').value, $('createRentEndDate').value) || ''
      syncDateControl('createRentStartDate')
      syncDateControl('createRentEndDate')
      $('createAddress').value = data.parsed.address || $('address').value || ''
      syncCreatePhoneFromAddress()
      if (a.quote && a.quote.ok) $('fee').value = Number(a.quote.totalPrice || 0)
      var units = a.availableUnits || []
      $('createUnitId').innerHTML = '<option value="">自动分配</option>' + units.map(function(unit){ return '<option value="' + unit.id + '">' + esc(unit.unitCode || unit.unit_code) + '</option>' }).join('')
      switchTab('inquiry')
    }
    async function createOrderFromForm() {
      try {
        $('createResult').innerHTML = '<div class="panel empty">创建中...</div>'
        var data = await fetchJson('/api/mobile/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: $('createStore').value,
            modelCode: $('createModelCode').value,
            unitId: $('createUnitId').value,
            rentStartDate: $('createRentStartDate').value,
            rentEndDate: $('createRentEndDate').value,
            customerName: $('customerName').value,
            customerPhone: $('customerPhone').value,
            address: $('createAddress').value,
            fee: $('fee').value,
            deposit: $('deposit').value,
            inquiryEventId: state.lastAvailability ? state.lastAvailability.inquiryEventId : '',
            plannedShipAt: state.lastAvailability && state.lastAvailability.availability && state.lastAvailability.availability.plan ? state.lastAvailability.availability.plan.plannedShipAt : '',
            expectedArriveAt: state.lastAvailability && state.lastAvailability.availability && state.lastAvailability.availability.plan ? state.lastAvailability.availability.plan.expectedArriveAt : ''
          })
        })
        $('createResult').innerHTML = '<div class="card"><div class="card-head"><div><div class="name">建单成功 #' + data.order.id + '</div><div class="meta">' + esc(data.order.modelCode) + '｜' + esc(data.order.unitCode || '-') + '</div></div><span class="pill green">已锁档</span></div><div class="order-highlights"><span class="order-highlight">租期 ' + esc(data.order.rentStartDate) + ' - ' + esc(data.order.rentEndDate) + '</span><span class="order-highlight">发货 ' + esc(data.order.plannedShipAt || '-') + '</span></div><div class="actions"><button onclick="openOrderDetail(' + data.order.id + ')">打开订单详情</button><button class="secondary" onclick="switchTab(\\'orders\\')">去订单中心</button></div></div>'
        await Promise.all([loadTasks(), loadOrders()])
      } catch (error) {
        $('createResult').innerHTML = '<div class="panel"><div class="alert-error"><strong>创建失败</strong>' + esc(error.message || error) + '</div></div>'
      }
    }
    function renderOrders(data) {
      var rows = data.orders || []
      state.orders = rows
      state.orderCount = rows.length
      updateHeroMeta({ orderCount: rows.length })
      renderHomeOverview()
      renderDepositOrderOptions()
      if (!rows.length) { $('orderCards').innerHTML = '<div class="panel empty">暂无订单</div>'; return }
      $('orderCards').innerHTML = rows.map(function(o){
        return '<article class="card"><div class="card-head"><div><div class="name">#' + o.id + ' ' + esc(o.customerName || '待补资料') + '</div><div class="meta"><strong>' + esc(o.modelCode) + '</strong>｜' + esc(o.unitCode || '-') + '｜' + esc(o.storeName || '') + '</div></div><span class="pill">' + esc(o.orderStatus || '-') + '</span></div><div class="order-highlights"><span class="order-highlight">租金 ' + money(o.fee) + '</span><span class="order-highlight">发货 ' + esc(o.plannedShipAt || '-') + '</span></div><div class="meta">租期：' + esc(o.rentStartDate) + ' 至 ' + esc(o.rentEndDate) + '<br>' + esc(o.address || '-') + '</div><div class="actions"><button onclick="openOrderDetail(' + o.id + ')">订单详情</button>' + (o.actualShipAt ? '<button class="secondary" onclick="markOrder(' + o.id + ', \\'return\\')">确认归还</button>' : '<button class="secondary" onclick="markOrder(' + o.id + ', \\'ship\\')">确认发货</button>') + '</div></article>'
      }).join('')
    }
    function renderDepositOrderOptions() {
      var select = $('depositCreateOrderId')
      if (!select) return
      var rows = state.orders || []
      select.innerHTML = '<option value="">选择要创建免押的订单</option>' + rows.map(function(o) {
        var label = '#' + o.id + ' ' + (o.customerName || '待补资料') + '｜' + (o.modelCode || '-') + '｜' + (o.rentStartDate || '-')
        return '<option value="' + esc(o.id) + '">' + esc(label) + '</option>'
      }).join('')
    }
    async function loadOrders() {
      try {
        $('orderCards').innerHTML = '<div class="panel empty">加载中...</div>'
        var params = new URLSearchParams({
          modelCode: $('orderModelCode').value,
          status: $('orderStatus').value,
          from: $('orderFrom').value,
          to: $('orderTo').value
        })
        var data = await fetchJson('/api/mobile/orders?' + params.toString())
        renderOrders(data)
      } catch (error) {
        $('orderCards').innerHTML = '<div class="panel"><div class="alert-error"><strong>订单加载失败</strong>' + esc(error.message || error) + '</div></div>'
      }
    }
    function depositTone(status) {
      if (status === 'approved' || status === 'completed') return 'green'
      if (status === 'rejected' || status === 'cancelled') return 'red'
      return 'orange'
    }
    function renderDeposits(data) {
      var rows = data.orders || []
      state.deposits = rows
      var container = $('depositCards')
      if (!container) return
      if (data.stale && data.message) {
        toast('免押远端同步失败，已展示本地记录')
      }
      if (!rows.length) {
        container.innerHTML = '<div class="panel empty">暂无免押单</div>'
        return
      }
      container.innerHTML = rows.map(function(item) {
        var actions = '<div class="actions">'
          + (item.reviewUrl ? '<button onclick="copyDepositLink(\\'' + attr(item.depositOrderNo) + '\\')">复制邀约</button>' : '')
          + (item.status === 'approved' ? '<button class="secondary" onclick="finishDepositOrder(\\'' + attr(item.depositOrderNo) + '\\')">完结免押</button>' : '')
          + (item.sourceOrderId ? '<button class="secondary" onclick="openOrderDetail(' + Number(item.sourceOrderId) + ')">关联订单</button>' : '')
          + '</div>'
        if (actions === '<div class="actions"></div>') actions = '<div class="meta">暂无可用操作</div>'
        return '<article class="card"><div class="card-head"><div><div class="name">' + esc(item.customerName || item.productName || '免押单') + '</div><div class="meta"><strong>' + esc(item.depositOrderNo || '-') + '</strong><br>' + esc(item.modelCode || '-') + '｜' + esc(item.unitCode || '-') + '</div></div><span class="pill ' + depositTone(item.status) + '">' + esc(item.statusLabel || item.status || '-') + '</span></div><div class="order-highlights"><span class="order-highlight">免押 ' + money(item.depositAmount) + '</span><span class="order-highlight">租金 ' + money(item.rentAmount) + '</span></div><div class="meta">租期：' + esc(item.rentStartDate || '-') + ' 至 ' + esc(item.rentEndDate || '-') + '<br>关联订单：' + esc(item.sourceOrderNo || item.sourceOrderId || '-') + '</div>' + actions + '</article>'
      }).join('')
    }
    async function loadDeposits() {
      var container = $('depositCards')
      try {
        if (container) container.innerHTML = '<div class="panel empty">加载中...</div>'
        var params = new URLSearchParams({
          keyword: $('depositKeyword') ? $('depositKeyword').value : '',
          status: $('depositStatus') ? $('depositStatus').value : '',
          limit: '50',
        })
        var data = await fetchJson('/api/mobile/deposit/orders?' + params.toString())
        renderDeposits(data)
      } catch (error) {
        if (container) container.innerHTML = '<div class="panel"><div class="alert-error"><strong>免押单加载失败</strong>' + esc(error.message || error) + '</div></div>'
      }
    }
    async function createDepositFromTab() {
      var orderId = $('depositCreateOrderId') ? $('depositCreateOrderId').value : ''
      if (!orderId) {
        toast('请先选择订单')
        return
      }
      try {
        var result = await fetchJson('/api/mobile/deposit/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderId })
        })
        toast(result.message || '免押单已创建')
        await Promise.all([loadDeposits(), loadOrders()])
      } catch (error) {
        toast(error.message || '创建免押单失败')
      }
    }
    async function copyDepositLink(depositOrderNo) {
      var item = (state.deposits || []).find(function(row){ return row.depositOrderNo === depositOrderNo })
      if (!item || !item.reviewUrl) {
        toast('暂无免押邀约链接')
        return
      }
      await navigator.clipboard.writeText(item.reviewUrl)
      toast('免押邀约已复制')
    }
    async function finishDepositOrder(depositOrderNo) {
      if (!depositOrderNo) return
      try {
        var result = await fetchJson('/api/mobile/deposit/orders/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ depositOrderNo: depositOrderNo })
        })
        toast(result.message || '免押单已完结')
        await loadDeposits()
        if (state.selectedOrderDetail) await refreshSelectedOrderDetail()
      } catch (error) {
        toast(error.message || '完结免押单失败')
      }
    }
    function closeOrderDetail() {
      $('orderDetailSheet').hidden = true
      $('orderDetailTitle').textContent = '订单详情'
      $('orderDetailMeta').textContent = ''
      $('orderDetailBody').innerHTML = ''
      state.selectedOrderDetail = null
    }
    function renderOrderDetail(detail) {
      var order = detail.order || {}
      var deposit = detail.latestDepositOrder || null
      var shipment = detail.shipment || null
      var depositHtml = deposit
        ? '<div class="detail-card"><small>免押状态</small><div>' + esc(deposit.statusLabel || '-') + ' ' + esc(deposit.depositOrderNo || '') + '</div></div>'
          + '<div class="detail-card"><small>免押金额</small><div>' + money(deposit.depositAmount) + '</div></div>'
        : '<div class="detail-card"><small>免押状态</small><div>未创建</div></div><div class="detail-card"><small>处理建议</small><div>建单后从这里直接创建免押单</div></div>'
      var shipmentHtml = shipment
        ? '<div class="detail-card"><small>寄件状态</small><div>' + esc(shipment.statusLabel || '-') + '</div></div>'
          + '<div class="detail-card"><small>运单号</small><div>' + esc(shipment.trackingNo || shipment.shipmentNo || '-') + '</div></div>'
        : '<div class="detail-card"><small>寄件状态</small><div>未创建</div></div><div class="detail-card"><small>处理建议</small><div>免押通过后可直接创建顺丰寄件</div></div>'
      var actions = '<div class="detail-actions">'
        + '<button onclick="createDepositForSelectedOrder()">创建免押单</button>'
        + (deposit && deposit.reviewUrl ? '<button class="secondary" onclick="copySelectedDepositLink()">复制免押邀约</button>' : '')
        + (deposit && deposit.status === 'approved' ? '<button class="secondary" onclick="finishDepositForSelectedOrder()">完结免押单</button>' : '')
        + '<button class="secondary" onclick="createShipmentForSelectedOrder()">创建顺丰寄件</button>'
        + (shipment && shipment.id ? '<button class="secondary" onclick="cancelShipmentForSelectedOrder()">取消寄件单</button>' : '')
        + '</div>'
      $('orderDetailTitle').textContent = '#' + (order.id || '-') + ' ' + (order.customerName || '订单详情')
      $('orderDetailMeta').textContent = [order.modelCode || '-', order.unitCode || '-', order.orderStatus || '-'].join('｜')
      $('orderDetailBody').innerHTML = ''
        + '<div class="detail-section">'
        + '<div class="detail-section-title">订单概览</div>'
        + '<div class="detail-grid-two">'
        + '<div class="detail-card"><small>租期</small><div>' + esc(order.rentStartDate || '-') + ' 至 ' + esc(order.rentEndDate || '-') + '</div></div>'
        + '<div class="detail-card"><small>租金 / 押金</small><div>' + money(order.fee) + ' / ' + money(order.deposit) + '</div></div>'
        + '<div class="detail-card"><small>客户</small><div>' + esc(order.customerName || '-') + ' ' + esc(order.customerPhone || '') + '</div></div>'
        + '<div class="detail-card"><small>发货计划</small><div>' + esc(order.plannedShipAt || '-') + '</div></div>'
        + '</div>'
        + '<div class="detail-card"><small>收货地址</small><div>' + esc(order.address || '-') + '</div></div>'
        + '</div>'
        + '<div class="detail-section"><div class="detail-section-title">免押管理</div><div class="detail-grid-two">' + depositHtml + '</div></div>'
        + '<div class="detail-section"><div class="detail-section-title">寄件管理</div><div class="detail-grid-two">' + shipmentHtml + '</div></div>'
        + actions
    }
    async function openOrderDetail(orderId) {
      try {
        $('orderDetailSheet').hidden = false
        $('orderDetailTitle').textContent = '订单详情'
        $('orderDetailMeta').textContent = ''
        $('orderDetailBody').innerHTML = '<div class="panel empty">加载中...</div>'
        var detail = await fetchJson('/api/mobile/orders/detail?orderId=' + encodeURIComponent(orderId))
        state.selectedOrderDetail = detail
        renderOrderDetail(detail)
      } catch (error) {
        $('orderDetailBody').innerHTML = '<div class="alert-error"><strong>订单详情加载失败</strong>' + esc(error.message || error) + '</div>'
      }
    }
    async function refreshSelectedOrderDetail() {
      if (!state.selectedOrderDetail || !state.selectedOrderDetail.order || !state.selectedOrderDetail.order.id) return
      var detail = await fetchJson('/api/mobile/orders/detail?orderId=' + encodeURIComponent(state.selectedOrderDetail.order.id))
      state.selectedOrderDetail = detail
      renderOrderDetail(detail)
    }
    async function createDepositForSelectedOrder() {
      var detail = state.selectedOrderDetail
      if (!detail || !detail.order) return
      try {
        var result = await fetchJson('/api/mobile/deposit/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: detail.order.id })
        })
        toast(result.message || '免押单已创建')
        await refreshSelectedOrderDetail()
      } catch (error) {
        toast(error.message || '创建免押单失败')
      }
    }
    async function finishDepositForSelectedOrder() {
      var detail = state.selectedOrderDetail
      var deposit = detail && detail.latestDepositOrder
      if (!deposit || !deposit.depositOrderNo) return
      try {
        var result = await fetchJson('/api/mobile/deposit/orders/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ depositOrderNo: deposit.depositOrderNo })
        })
        toast(result.message || '免押单已完结')
        await refreshSelectedOrderDetail()
      } catch (error) {
        toast(error.message || '完结免押单失败')
      }
    }
    async function copySelectedDepositLink() {
      var detail = state.selectedOrderDetail
      var deposit = detail && detail.latestDepositOrder
      var text = deposit && deposit.reviewUrl
      if (!text) return
      await navigator.clipboard.writeText(text)
      toast('免押邀约已复制')
    }
    async function createShipmentForSelectedOrder() {
      var detail = state.selectedOrderDetail
      if (!detail || !detail.order) return
      try {
        var result = await fetchJson('/api/mobile/shipments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: detail.order.id })
        })
        toast(result.message || '寄件单已创建')
        await Promise.all([refreshSelectedOrderDetail(), loadOrders()])
      } catch (error) {
        toast(error.message || '创建寄件单失败')
      }
    }
    async function cancelShipmentForSelectedOrder() {
      var detail = state.selectedOrderDetail
      var shipment = detail && detail.shipment
      if (!shipment || !shipment.id) return
      try {
        var result = await fetchJson('/api/mobile/shipments/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shipmentId: shipment.id })
        })
        toast(result.message || '寄件单已取消')
        await Promise.all([refreshSelectedOrderDetail(), loadOrders()])
      } catch (error) {
        toast(error.message || '取消寄件单失败')
      }
    }
    window.markOrder = markOrder
    window.switchTab = switchTab
    window.copyReply = copyReply
    window.fillCreateFromAvailability = fillCreateFromAvailability
    window.toggleScheduleGroup = toggleScheduleGroup
    window.openScheduleDetail = openScheduleDetail
    window.openScheduleHeat = openScheduleHeat
    window.openOrderDetail = openOrderDetail
    window.createDepositForSelectedOrder = createDepositForSelectedOrder
    window.finishDepositForSelectedOrder = finishDepositForSelectedOrder
    window.copySelectedDepositLink = copySelectedDepositLink
    window.copyDepositLink = copyDepositLink
    window.finishDepositOrder = finishDepositOrder
    window.createShipmentForSelectedOrder = createShipmentForSelectedOrder
    window.cancelShipmentForSelectedOrder = cancelShipmentForSelectedOrder
    document.addEventListener('click', function(event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-action]') : null
      if (!target) return
      var action = target.dataset.action || ''
      if (action === 'jump-tab') {
        switchTab(target.dataset.tabTarget || 'today')
        return
      }
      if (action === 'refresh-tasks') {
        loadTasks()
        return
      }
      if (action === 'refresh-orders') {
        loadOrders()
        return
      }
      if (action === 'refresh-schedule') {
        loadScheduleOverview()
        return
      }
      if (action === 'refresh-deposits') {
        loadDeposits()
        return
      }
      if (action === 'mobile-placeholder') {
        toast(target.dataset.message || '该功能后续接入移动端')
        return
      }
      if (action === 'toggle-schedule-group') {
        toggleScheduleGroup(target.dataset.model || '')
        return
      }
      if (action === 'open-schedule-detail') {
        openScheduleDetail(target.dataset.model || '', target.dataset.unitId || '', target.dataset.date || '')
        return
      }
      if (action === 'open-schedule-heat') {
        openScheduleHeat(target.dataset.model || '', target.dataset.date || '')
      }
    })
    document.querySelectorAll('.tab').forEach(function(btn){ btn.addEventListener('click', function(){ switchTab(btn.dataset.tab) }) })
    document.querySelectorAll('#taskDateSeg button').forEach(function(btn){ btn.addEventListener('click', function(){ state.taskDatePreset = btn.dataset.date; document.querySelectorAll('#taskDateSeg button').forEach(function(x){ x.classList.toggle('active', x === btn) }); loadTasks() }) })
    document.querySelectorAll('#taskTypeSeg button').forEach(function(btn){ btn.addEventListener('click', function(){ state.taskType = btn.dataset.type; document.querySelectorAll('#taskTypeSeg button').forEach(function(x){ x.classList.toggle('active', x === btn) }); loadTasks() }) })
    document.querySelectorAll('#scheduleViewSeg button').forEach(function(btn){ btn.addEventListener('click', function(){ state.scheduleView = btn.dataset.view; document.querySelectorAll('#scheduleViewSeg button').forEach(function(x){ x.classList.toggle('active', x === btn) }); renderScheduleOverview() }) })
    $('refreshTasks').addEventListener('click', loadTasks)
    $('refreshSchedule').addEventListener('click', loadScheduleOverview)
    $('refreshDeposits').addEventListener('click', loadDeposits)
    $('createDepositFromTab').addEventListener('click', createDepositFromTab)
    $('queryAvailability').addEventListener('click', queryAvailability)
    $('clearAvailabilityAddress').addEventListener('click', clearAvailabilityAddressDefaults)
    $('fillFromAvailability').addEventListener('click', fillCreateFromAvailability)
    $('createOrderBtn').addEventListener('click', createOrderFromForm)
    $('createAddress').addEventListener('input', syncCreatePhoneFromAddress)
    $('createAddress').addEventListener('paste', function(){ setTimeout(syncCreatePhoneFromAddress, 0) })
    $('refreshOrders').addEventListener('click', loadOrders)
    $('closeScheduleDetail').addEventListener('click', closeScheduleDetail)
    $('scheduleDetailSheet').addEventListener('click', function(event){ if (event.target === $('scheduleDetailSheet')) closeScheduleDetail() })
    $('closeOrderDetail').addEventListener('click', closeOrderDetail)
    $('orderDetailSheet').addEventListener('click', function(event){ if (event.target === $('orderDetailSheet')) closeOrderDetail() })
    ;['rentStartDate','rentEndDate','createRentStartDate','createRentEndDate','orderFrom','orderTo'].forEach(bindDateControl)
    bindMonthControl('scheduleMonth')
    ;['scheduleMonth','scheduleModelCode'].forEach(function(id){ $(id).addEventListener('change', loadScheduleOverview) })
    ;['orderModelCode','orderStatus','orderFrom','orderTo'].forEach(function(id){ $(id).addEventListener('change', loadOrders) })
    $('depositStatus').addEventListener('change', loadDeposits)
    $('depositKeyword').addEventListener('keydown', function(event){ if (event.key === 'Enter') loadDeposits() })
    bindDateDays('rentStartDate', 'rentDays', 'rentEndDate')
    bindDateDays('createRentStartDate', 'createRentDays', 'createRentEndDate')
    loadBootstrap().catch(function(error){ toast(error.message || '初始化失败') })
  </script>
</body>
</html>`
}

function buildAvailabilityFormHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>查询档期</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #111827; }
    header { position: sticky; top: 0; background: #fff; padding: 14px 16px; border-bottom: 1px solid #e5e7eb; }
    h1 { margin: 0; font-size: 18px; }
    main { padding: 14px; display: grid; gap: 12px; }
    label { display: grid; gap: 6px; font-size: 13px; color: #374151; }
    input, select, textarea { box-sizing: border-box; width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; font-size: 15px; background: #fff; }
    input[type="date"] { display: block; min-width: 0; max-width: 100%; }
    textarea { min-height: 86px; resize: vertical; }
    button { border: 0; border-radius: 8px; padding: 11px 12px; background: #2563eb; color: #fff; font-size: 15px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    pre { white-space: pre-wrap; word-break: break-word; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; line-height: 1.6; font-size: 13px; }
    .hint { color: #667085; font-size: 12px; }
  </style>
</head>
<body>
  <header><h1>查询档期</h1><div class="hint">选择型号和租期；顺丰试算地址至少填省+市，也可粘贴完整收货信息。</div></header>
  <main>
    <label>型号<select id="modelCode"></select></label>
    <div class="row">
      <label>开始日期<input id="rentStartDate" type="date" /></label>
      <label>结束日期<input id="rentEndDate" type="date" /></label>
    </div>
    <label>收货地址 / 城市区域<textarea id="address" placeholder="例如：四川省绵阳市；区县和详细地址可不填"></textarea></label>
    <label>运输天数<input id="transitDays" type="number" min="0" placeholder="可不填，使用顺丰时效" /></label>
    <button id="submitBtn">查询档期</button>
    <pre id="output">请选择信息后查询。</pre>
  </main>
  <script>
    async function loadModels() {
      const select = document.getElementById('modelCode')
      const res = await fetch('/api/mobile/model-codes')
      const data = await res.json()
      select.innerHTML = (data.modelCodes || []).map((code) => '<option value="' + code.replace(/"/g, '&quot;') + '">' + code + '</option>').join('')
    }
    async function submitQuery() {
      const output = document.getElementById('output')
      output.textContent = '查询中...'
      const body = {
        modelCode: document.getElementById('modelCode').value,
        rentStartDate: document.getElementById('rentStartDate').value,
        rentEndDate: document.getElementById('rentEndDate').value,
        address: document.getElementById('address').value,
        transitDays: document.getElementById('transitDays').value,
      }
      try {
        const res = await fetch('/api/mobile/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        output.textContent = data.message || JSON.stringify(data, null, 2)
      } catch (error) {
        output.textContent = '查询失败：' + (error.message || error)
      }
    }
    document.getElementById('submitBtn').addEventListener('click', submitQuery)
    loadModels().catch((error) => { document.getElementById('output').textContent = '型号加载失败：' + (error.message || error) })
  </script>
</body>
</html>`
}

function buildMissingCard(parsed, missing) {
  return buildFeishuCard({
    config: { wide_screen_mode: true },
    header: { template: 'orange', title: { tag: 'plain_text', content: '信息不完整' } },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            `缺少：${missing.join('、')}`,
            '',
            parsed.intent === 'booking'
              ? '示例：记档期 pocket4 5.22租5天 李双双 13800138000 四川省成都市武侯区天府长岛50号 租金300'
              : '示例：查档期 pocket4 5.22 租5天 发成都武侯',
          ].join('\n'),
        },
      },
    ],
  })
}

function buildAvailabilityQueryCard(missing = [], options = {}) {
  const baseUrl = String(options.publicBaseUrl || '').replace(/\/+$/, '')
  const url = `${baseUrl || 'http://127.0.0.1:8787'}/mobile/availability`
  return buildFeishuCard({
    config: { wide_screen_mode: true },
    header: { template: 'orange', title: { tag: 'plain_text', content: '填写查档期信息' } },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            missing.length ? `缺少：${missing.join('、')}` : '可以用表单选择型号、租期并粘贴地址。',
            '',
            '你也可以继续直接发：`查档期 pocket3 6.1 租3天 发成都武侯`。',
          ].join('\n'),
        },
      },
      {
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { tag: 'plain_text', content: '打开查询表单' },
          type: 'primary',
          url,
        }],
      },
    ],
  })
}

function buildAmbiguousBookingContextCard(contexts = []) {
  const rows = contexts.map((context, index) => {
    const parsed = context.parsed || {}
    return `${index + 1}. ${parsed.modelCode || '-'} ${parsed.rentStartDate || '-'} 至 ${parsed.rentEndDate || '-'}`
  })
  return buildFeishuCard({
    config: { wide_screen_mode: true },
    header: { template: 'orange', title: { tag: 'plain_text', content: '请引用要记档期的查档期消息' } },
    elements: [{
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: [
          '这个群里最近查过多个档期，直接发 `记档期` 容易记错。',
          '',
          ...rows,
          '',
          '请回复其中一条查档期结果，再发送 `记档期`。',
        ].join('\n'),
      },
    }],
  })
}

function buildAvailabilityCard(parsed, availability, options = {}) {
  const bookingSnapshot = buildFeishuBookingSnapshot(parsed, availability)
  const customerAddress = [bookingSnapshot.province, bookingSnapshot.city, bookingSnapshot.district, bookingSnapshot.address]
    .filter(Boolean)
    .join(' ')
  const lines = [
    `**型号**：${availability.modelCode}`,
    `**租期**：${availability.plan.rentStartDate} 至 ${availability.plan.rentEndDate}`,
    `**占用窗口**：${availability.plan.requiredStartDate} 至 ${availability.plan.requiredEndDate}`,
    `**物流**：发货 ${availability.plan.shipDate || '-'}，到货 ${availability.plan.arriveDate || '-'}`,
    `**${formatAvailabilityQuote(availability.quote).replace(/^租金：/, '租金**：')}`,
    `**${formatAvailabilityDeposit(availability.depositExemption, availability.quote).replace(/^免押：/, '免押**：')}`,
    `**可用**：${availability.counts.availableUnits}/${availability.counts.totalUnits} 台`,
  ]
  if (availability.availableUnits?.length) {
    lines.push(`**可用设备**：${availability.availableUnits.slice(0, 8).map((unit) => unit.unitCode).join('、')}`)
  }
  if (parsed.intent === 'booking') {
    lines.push(`**店铺**：小狗相机`)
    lines.push(`**客户**：${bookingSnapshot.customerName || '-'} ${bookingSnapshot.customerPhone || ''}`.trim())
    lines.push(`**地址**：${customerAddress || '-'}`)
    lines.push(`**建单租金**：¥${Number(bookingSnapshot.fee || 0).toFixed(2)}`)
  }
  if (availability.plan.fallbackReason) lines.push(`**提示**：${availability.plan.fallbackReason}`)

  const customerReply = buildCustomerAvailabilityReply(availability, options)
  if (customerReply) {
    lines.push(`**租客回复**：会在下一条纯文本消息单独发送，直接复制那条即可。`)
  }

  const actions = []
  if (parsed.intent === 'booking' && availability.availableUnits?.length) {
    for (const unit of availability.availableUnits.slice(0, 5)) {
      actions.push({
      tag: 'button',
      text: { tag: 'plain_text', content: `用 ${unit.unitCode} 建单` },
      type: 'primary',
      value: {
        action_type: 'confirm_booking',
        command_text: parsed.text,
        chat_id: options.chatId || '',
        booking_snapshot_id: rememberBookingSnapshotForAction(bookingSnapshot),
        unit_id: unit.id,
      },
    })
    }
  }

  return buildFeishuCard({
    config: { wide_screen_mode: true },
    header: {
      template: availability.available ? 'green' : 'red',
      title: { tag: 'plain_text', content: availability.available ? '档期可用' : '当前无可用档期' },
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: lines.join('\n') } },
      ...(actions.length ? [{ tag: 'action', actions }] : []),
    ],
  })
}

function extractFeishuText(payload) {
  const content = payload?.event?.message?.content || payload?.message?.content || ''
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      return parsed.text || ''
    } catch {
      return content
    }
  }
  return content?.text || ''
}

function extractFeishuMessageId(payload) {
  return payload?.event?.message?.message_id
    || payload?.event?.message?.message_id_v2
    || payload?.message?.message_id
    || payload?.message?.message_id_v2
    || ''
}

function extractFeishuReferencedMessageId(payload) {
  return payload?.event?.message?.parent_id
    || payload?.event?.message?.root_id
    || payload?.event?.message?.parent_message_id
    || payload?.message?.parent_id
    || payload?.message?.root_id
    || payload?.message?.parent_message_id
    || ''
}

function extractFeishuChatId(payload) {
  return payload?.event?.message?.chat_id
    || payload?.event?.message?.chat_id_v2
    || payload?.message?.chat_id
    || payload?.open_chat_id
    || ''
}

function extractFeishuAction(payload) {
  return payload?.event?.action?.value || payload?.action?.value || {}
}

function verifyFeishuToken(payload, config) {
  const expected = String(config.FEISHU_VERIFICATION_TOKEN || '').trim()
  if (!expected) return true
  const actual = payload?.header?.token || payload?.token || ''
  return actual === expected
}

function decryptFeishuPayload(payload, config) {
  const encrypted = payload?.encrypt
  if (!encrypted) return payload

  const encryptKey = String(config.FEISHU_ENCRYPT_KEY || '').trim()
  if (!encryptKey) throw new Error('飞书事件已加密，但未配置 Encrypt Key')

  const encryptedBytes = Buffer.from(encrypted, 'base64')
  if (encryptedBytes.length <= 16) throw new Error('飞书加密事件格式无效')

  const key = crypto.createHash('sha256').update(encryptKey, 'utf8').digest()
  const iv = encryptedBytes.subarray(0, 16)
  const cipherText = encryptedBytes.subarray(16)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  const plainText = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8')
  return JSON.parse(plainText)
}

async function getTenantAccessToken(config) {
  const appId = String(config.FEISHU_APP_ID || '').trim()
  const appSecret = String(config.FEISHU_APP_SECRET || '').trim()
  if (!appId || !appSecret) return ''
  if (tenantTokenCache?.token && tenantTokenCache.expiresAt > Date.now() + 60_000) return tenantTokenCache.token

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const body = await response.json()
  if (!response.ok || body.code !== 0) {
    throw new Error(body.msg || `获取飞书 tenant_access_token 失败：${response.status}`)
  }
  tenantTokenCache = {
    token: body.tenant_access_token,
    expiresAt: Date.now() + Math.max(1, Number(body.expire || 7200) - 120) * 1000,
  }
  return tenantTokenCache.token
}

function buildFeishuSendError(response, body) {
  const parts = []
  if (body?.code !== undefined) parts.push(`code=${body.code}`)
  if (body?.msg) parts.push(`msg=${body.msg}`)
  const violations = Array.isArray(body?.permission_violations) ? body.permission_violations : []
  if (violations.length) {
    const scopes = violations.flatMap((item) => item?.scopes || []).filter(Boolean)
    if (scopes.length) parts.push(`scopes=${scopes.join(',')}`)
  }
  if (body?.error?.permission_violations?.length) {
    const scopes = body.error.permission_violations.flatMap((item) => item?.scopes || []).filter(Boolean)
    if (scopes.length) parts.push(`scopes=${scopes.join(',')}`)
  }
  if (body?.error?.help_url) parts.push(`help=${body.error.help_url}`)
  if (!parts.length) parts.push(`status=${response.status}`)
  return `飞书发消息失败: ${parts.join(' | ')}`
}

async function sendFeishuMessage({ chatId, message, config }) {
  if (chatId) {
    const trySend = async ({ forceRefresh = false } = {}) => {
      if (forceRefresh) tenantTokenCache = null
      const token = await getTenantAccessToken(config)
      if (!token) return null

      const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ receive_id: chatId, ...message }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.code !== 0) {
        const error = new Error(buildFeishuSendError(response, body))
        error.responseStatus = response.status
        error.responseBody = body
        throw error
      }
      return { ok: true, source: 'feishu_app', body, messageId: body?.data?.message_id || body?.data?.message_id_v2 || '' }
    }

    try {
      const sent = await trySend()
      if (sent) return sent
    } catch (error) {
      const code = Number(error?.responseBody?.code || 0)
      const shouldRetry = error?.responseStatus === 401
        || error?.responseStatus === 403
        || [99991661, 99991663, 99991668, 99991672].includes(code)
      if (!shouldRetry) throw error
      const retried = await trySend({ forceRefresh: true })
      if (retried) return retried
      throw error
    }
  }

  const webhook = String(config.FEISHU_WEBHOOK_ORDER || config.FEISHU_WEBHOOK_SALES || '').trim()
  if (!webhook) return { ok: false, message: '未配置飞书应用凭据或 Webhook' }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(message),
  })
  return { ok: response.ok, source: 'feishu_webhook', status: response.status }
}

async function rememberFeishuNotifyChat(chatId, config = {}) {
  if (!chatId) return
  if (String(config.MOBILE_FEISHU_NOTIFY_CHAT_ID || '') === String(chatId)) return
  await saveConfig({ MOBILE_FEISHU_NOTIFY_CHAT_ID: chatId })
  mergeGatewayConfigCache({ ...config, MOBILE_FEISHU_NOTIFY_CHAT_ID: chatId })
}

async function runFulfillmentTasks(parsed = {}) {
  const range = resolveTaskDateRange(parsed)
  const tasks = await listFulfillmentTasks(range)
  const titleDate = parsed.taskDatePreset === 'tomorrow' ? '明日' : '今日'
  const typeName = parsed.taskType === 'ship' ? '待发货' : parsed.taskType === 'return' ? '待归还' : '履约待办'
  return { ok: true, parsed, tasks, message: buildFulfillmentCard(tasks, { title: `${titleDate}${typeName}`, taskType: parsed.taskType || 'all', taskDatePreset: parsed.taskDatePreset || 'today' }) }
}

async function recordInquirySafely({ source = 'mobile_h5', storeId, chatId, messageId, parsed, availability } = {}) {
  if (!shouldRecordInquiryEvent(parsed)) {
    console.log('[mobile-gateway] inquiry event skipped: test command')
    return null
  }
  try {
    const created = await recordInquiryEventFromAvailability({ source, storeId, chatId, messageId, parsed, availability })
    if (created?.id) {
      parsed.inquiryEventId = created.id
      availability.inquiryEventId = created.id
    }
    return created
  } catch (error) {
    console.warn('[mobile-gateway] inquiry event skipped:', error?.message || error)
    return null
  }
}

async function runAvailabilityFromText(text, options = {}) {
  const parsed = await parseCommandText(text)
  const missing = getMissingFields({ ...parsed, intent: 'availability' })
  if (missing.length) return { ok: false, parsed, missing, message: `缺少：${missing.join('、')}` }
  const payload = buildAvailabilityPayload(parsed)
  const availability = await checkScheduleAvailability(payload)
  const inquiry = await recordInquirySafely({ ...options, parsed, availability })
  return {
    ok: availability.ok,
    parsed,
    payload,
    availability,
    inquiryEventId: inquiry?.id || null,
    customerReply: buildCustomerAvailabilityReply(availability),
    message: formatAvailabilityText(availability),
  }
}

function normalizeMobileAvailabilityAddress(value = '') {
  const rawValue = String(value || '').trim()
  const parsed = parseRecipientAddress(rawValue)
  const hasRecognizedRegion = !!(parsed.province || parsed.city || parsed.district)
  return {
    ...parsed,
    address: hasRecognizedRegion ? parsed.address : rawValue,
  }
}

async function runAvailabilityFromBody(body = {}, options = {}) {
  if (body.text) return runAvailabilityFromText(body.text, options)
  const pastedAddress = normalizeMobileAvailabilityAddress(body.address)
  const parseText = [
    '查档期',
    body.modelCode || '',
    body.rentStartDate && body.rentEndDate ? `${body.rentStartDate}到${body.rentEndDate}` : '',
    body.address ? `发${body.address}` : '',
    Number(body.transitDays) > 0 ? `物流${Number(body.transitDays)}天` : '',
  ].filter(Boolean).join(' ')
  const parsedFromText = await parseCommandText(parseText)
  const parsed = {
    ...parsedFromText,
    intent: 'availability',
    text: parseText,
    modelCode: body.modelCode || '',
    rentStartDate: body.rentStartDate || '',
    rentEndDate: body.rentEndDate || '',
    rentDays: parsedFromText.rentDays || 0,
    province: body.province || pastedAddress.province || parsedFromText.province || '',
    city: body.city || pastedAddress.city || parsedFromText.city || '',
    district: body.district || pastedAddress.district || parsedFromText.district || '',
    address: body.addressDetail || pastedAddress.address || '',
    customerName: '',
    customerPhone: '',
    shippingMode: body.shippingMode || 'land',
    returnBufferDays: Number(body.returnBufferDays ?? 2),
    ...(Number(body.transitDays) > 0 ? { transitDays: Number(body.transitDays) } : {}),
  }
  const missing = getMissingFields(parsed)
  if (missing.length) return { ok: false, parsed, missing, message: `缺少：${missing.join('、')}` }
  const payload = buildAvailabilityPayload(parsed)
  const availability = await checkScheduleAvailability(payload)
  const inquiry = await recordInquirySafely({ ...options, parsed, availability })
  return {
    ok: availability.ok,
    parsed,
    payload,
    availability,
    inquiryEventId: inquiry?.id || null,
    customerReply: buildCustomerAvailabilityReply(availability),
    message: formatAvailabilityText(availability),
  }
}

function getBookingMissingFields(parsed) {
  const missing = []
  if (!parsed?.modelCode) missing.push('型号')
  if (!parsed?.rentStartDate) missing.push('开始日期')
  if (!parsed?.rentEndDate) missing.push('结束日期或租赁天数')
  return missing
}

function inspectFeishuEventPayload(payload, config = {}) {
  const normalized = decryptFeishuPayload(payload, config)
  const eventType = normalized?.header?.event_type || normalized?.type || normalized?.event?.type || ''
  const action = extractFeishuAction(normalized)
  return {
    payload: normalized,
    eventType,
    action,
    isCardActionTrigger: eventType === 'card.action.trigger' && Boolean(action),
  }
}

async function createBookingFromParsed(parsed, override = {}) {
  const missing = getBookingMissingFields(parsed)
  if (missing.length) return { ok: false, parsed, missing, message: `缺少：${missing.join('、')}` }

  const availability = await checkScheduleAvailability(buildAvailabilityPayload(parsed))
  if (!availability.ok || !availability.available) {
    return { ok: false, parsed, availability, message: formatAvailabilityText(availability) }
  }
  const unitId = override.unitId || availability.availableUnits?.[0]?.id
  const result = await createOrder({
    modelCode: parsed.modelCode,
    unitId,
    customerName: parsed.customerName,
    customerPhone: parsed.customerPhone,
    province: parsed.province,
    city: parsed.city,
    district: parsed.district,
    address: parsed.address,
    rentStartDate: parsed.rentStartDate,
    rentEndDate: parsed.rentEndDate,
    fee: parsed.fee || 0,
    deposit: parsed.deposit || 0,
    shippingMode: parsed.shippingMode,
    plannedShipAt: availability.plan?.plannedShipAt,
    expectedArriveAt: availability.plan?.expectedArriveAt,
    latestLogisticsStatus: buildBookingLatestLogisticsStatus(parsed),
  })
  const inquiryEventId = Number(override.inquiryEventId || parsed.inquiryEventId || 0) || null
  if (inquiryEventId) {
    await linkInquiryEventToOrder({ inquiryEventId, orderId: result.id, finalFee: parsed.fee || availability.quote?.totalPrice || 0 }).catch((error) => {
      console.warn('[mobile-gateway] inquiry link skipped:', error?.message || error)
    })
  } else {
    await linkRecentInquiryToOrder({
      source: override.source || 'feishu',
      chatId: override.chatId || '',
      modelCode: parsed.modelCode,
      rentStartDate: parsed.rentStartDate,
      rentEndDate: parsed.rentEndDate,
      orderId: result.id,
      finalFee: parsed.fee || availability.quote?.totalPrice || 0,
    }).catch(() => {})
  }
  try {
    sendCommand({
      cmd: 'notify:order',
      payload: {
        type: 'order_created',
        orderId: result.id,
        modelCode: parsed.modelCode,
        unitId: result.unitId,
        rentRange: `${parsed.rentStartDate} ~ ${parsed.rentEndDate}`,
        fee: parsed.fee || 0,
        address: [parsed.province, parsed.city, parsed.district, parsed.address].filter(Boolean).join(' '),
        plannedShipAt: result.plannedShipAt,
        expectedArriveAt: result.expectedArriveAt,
        shippingMode: parsed.shippingMode,
        latestStatus: buildBookingLatestLogisticsStatus(parsed),
      },
    })
  } catch (error) {
    console.warn('[mobile-gateway] notify:order skipped:', error?.message || error)
  }
  return { ok: true, parsed, availability, result, message: `已建单 #${result.id}，设备 ${availability.availableUnits.find((unit) => unit.id === unitId)?.unitCode || result.unitId}` }
}

async function createBookingFromText(text, override = {}) {
  const parsed = await parseCommandText(text)
  const resolved = resolveBookingAvailabilityContext(parsed, override.chatId, {
    referencedMessageId: override.referencedMessageId || '',
    now: override.now || Date.now(),
  })
  const merged = mergeBookingParsedWithAvailabilityContext(parsed, resolved.context, { now: override.now || Date.now() })
  return createBookingFromParsed(merged, override)
}

async function sendBookingActionResult({ chatId, config, message }) {
  if (!chatId) {
    console.warn('[mobile-gateway] booking action result skipped: missing chat id')
    return null
  }
  const sent = await sendFeishuMessage({ chatId, config, message: buildFeishuText(message) })
  console.log('[mobile-gateway] feishu confirm result sent:', sent)
  return sent
}

async function sendBookingActionCardResult({ chatId, config, created }) {
  if (!chatId) {
    console.warn('[mobile-gateway] booking action result skipped: missing chat id')
    return null
  }
  const sent = await sendFeishuMessage({ chatId, config, message: buildBookingResultCard(created) })
  console.log('[mobile-gateway] feishu confirm result sent:', sent)
  return sent
}

async function processConfirmBookingAction({ action, chatId, config }) {
  const actionChatId = action.chat_id
    || chatId
    || String(config.MOBILE_FEISHU_NOTIFY_CHAT_ID || '').trim()
  const actionKey = action.booking_snapshot_id ? `${action.booking_snapshot_id}:${action.unit_id || ''}` : ''

  if (actionKey && bookingResultByActionKey.has(actionKey)) {
    const previous = bookingResultByActionKey.get(actionKey)
    if (previous.created) {
      await sendBookingActionCardResult({ chatId: actionChatId, config, created: previous.created })
    } else {
      await sendBookingActionResult({ chatId: actionChatId, config, message: previous.message })
    }
    return previous
  }
  if (actionKey && bookingActionInFlight.has(actionKey)) {
    const message = '建单处理中，请稍后看群消息。'
    await sendBookingActionResult({ chatId: actionChatId, config, message })
    return { ok: true, message }
  }

  if (actionKey) bookingActionInFlight.add(actionKey)
  try {
    const bookingSnapshot = getBookingSnapshotForAction(action.booking_snapshot_id)
      || (action.booking_snapshot && typeof action.booking_snapshot === 'object'
        ? action.booking_snapshot
        : null)
    const created = bookingSnapshot
      ? await createBookingFromParsed(bookingSnapshot, { unitId: action.unit_id, chatId: actionChatId })
      : await createBookingFromText(action.command_text || '', { unitId: action.unit_id, chatId: actionChatId })
    const message = buildBookingResultMessage(created)
    const result = { ok: Boolean(created.ok), message, created }
    if (actionKey) bookingResultByActionKey.set(actionKey, result)
    await sendBookingActionCardResult({ chatId: actionChatId, config, created })
    return result
  } catch (error) {
    const message = `建单失败：${error?.message || error || '未知错误'}`
    const created = { ok: false, message }
    if (actionKey) bookingResultByActionKey.set(actionKey, { ok: false, message, created })
    await sendBookingActionCardResult({ chatId: actionChatId, config, created }).catch((sendError) => {
      console.error('[mobile-gateway] send booking failure result failed:', sendError)
    })
    return { ok: false, message }
  } finally {
    if (actionKey) bookingActionInFlight.delete(actionKey)
  }
}

function scheduleConfirmBookingAction({ action, chatId, config }) {
  setTimeout(() => {
    processConfirmBookingAction({ action, chatId, config }).catch((error) => {
      console.error('[mobile-gateway] background booking action failed:', error)
    })
  }, 0)
}

async function handleFeishuEvent(payload, options = {}) {
  const config = options.config || await getGatewayConfig()
  const inspected = options.inspected || inspectFeishuEventPayload(payload, config)
  payload = inspected.payload
  const eventType = inspected.eventType
  console.log('[mobile-gateway] feishu event received:', {
    type: eventType || 'unknown',
    hasMessage: Boolean(payload?.event?.message),
    hasAction: Boolean(payload?.event?.action || payload?.action),
  })
  if (!verifyFeishuToken(payload, config)) return { status: 403, body: { ok: false, message: 'invalid feishu token' } }

  if (payload?.type === 'url_verification') {
    return { status: 200, body: { challenge: payload.challenge || '' } }
  }

  const action = inspected.action || extractFeishuAction(payload)
  const chatId = extractFeishuChatId(payload)
  const messageId = extractFeishuMessageId(payload)
  const referencedMessageId = extractFeishuReferencedMessageId(payload)
  if (chatId) await rememberFeishuNotifyChat(chatId, config)
  console.log('[mobile-gateway] feishu event context:', {
    type: eventType || 'unknown',
    chatId: chatId ? 'present' : 'missing',
    actionType: action?.action_type || '',
  })
  if (action?.action_type === 'confirm_booking') {
    scheduleConfirmBookingAction({ action, chatId, config })
    return { status: 200, body: buildFeishuCardCallbackResponse('已收到建单请求，后台处理中') }
  }
  if (action?.action_type === 'mark_shipped') {
    const orderId = Number(action.order_id || 0)
    const result = await batchMarkOrdersShipped({ orderIds: [orderId], latestLogisticsStatus: '飞书确认已发货' })
    const first = result.results?.[0]
    const message = first?.ok ? `订单 #${orderId} 已确认发货。` : `订单 #${orderId} 发货确认失败：${first?.message || '未知错误'}`
    if (chatId) {
      if (first?.ok) {
        const refreshed = await runFulfillmentTasks({
          intent: 'fulfillment_tasks',
          taskDatePreset: action.task_date_preset || 'today',
          taskType: action.task_type || 'all',
        })
        await sendFeishuMessage({ chatId, config, message: refreshed.message })
      } else {
        await sendFeishuMessage({ chatId, config, message: buildFeishuText(message) })
      }
    }
    return {
      status: 200,
      body: buildFeishuCardCallbackResponse(message, first?.ok ? 'success' : 'error'),
    }
  }
  if (action?.action_type === 'mark_returned') {
    const orderId = Number(action.order_id || 0)
    const result = await markOrderReturned({ orderId, latestLogisticsStatus: '飞书确认已归还' })
    const message = result.ok
      ? `订单 #${orderId} 已确认归还。请同步完结免押单。`
      : `订单 #${orderId} 归还确认失败：${result.message || '未知错误'}`
    if (chatId) {
      if (result.ok) {
        const refreshed = await runFulfillmentTasks({
          intent: 'fulfillment_tasks',
          taskDatePreset: action.task_date_preset || 'today',
          taskType: action.task_type || 'all',
        })
        await sendFeishuMessage({ chatId, config, message: refreshed.message })
        await sendFeishuMessage({ chatId, config, message: buildFeishuText('已确认归还，请同步完结免押单。') })
      } else {
        await sendFeishuMessage({ chatId, config, message: buildFeishuText(message) })
      }
    }
    return {
      status: 200,
      body: buildFeishuCardCallbackResponse(message, result.ok ? 'success' : 'error'),
    }
  }

  const text = extractFeishuText(payload).trim()
  if (!text) {
    console.log('[mobile-gateway] feishu event ignored: empty text')
    return { status: 200, body: { ok: true, ignored: true } }
  }

  const rawParsed = await parseCommandText(text)
  const bookingContext = rawParsed.intent === 'booking'
    ? resolveBookingAvailabilityContext(rawParsed, chatId, { referencedMessageId })
    : { status: 'none', context: null, contexts: [] }
  const parsed = rawParsed.intent === 'booking'
    ? mergeBookingParsedWithAvailabilityContext(rawParsed, bookingContext.context)
    : rawParsed
  console.log('[mobile-gateway] feishu command parsed:', {
    intent: parsed.intent,
    modelCode: parsed.modelCode || '',
    hasRentStart: Boolean(parsed.rentStartDate),
    hasRentEnd: Boolean(parsed.rentEndDate),
  })
  if (parsed.intent === 'unknown') return { status: 200, body: { ok: true, ignored: true } }

  if (parsed.intent === 'fulfillment_action') {
    const orderId = Number(parsed.orderId || 0)
    let ok = false
    let message = ''
    if (!orderId) {
      message = '请带上订单号，例如：确认发货 13357'
    } else if (parsed.actionType === 'mark_shipped') {
      const result = await batchMarkOrdersShipped({ orderIds: [orderId], latestLogisticsStatus: '飞书确认已发货' })
      const first = result.results?.[0]
      ok = Boolean(first?.ok)
      message = ok ? `订单 #${orderId} 已确认发货。` : `订单 #${orderId} 发货确认失败：${first?.message || '未知错误'}`
    } else if (parsed.actionType === 'mark_returned') {
      const result = await markOrderReturned({ orderId, latestLogisticsStatus: '飞书确认已归还' })
      ok = Boolean(result.ok)
      message = ok
        ? `订单 #${orderId} 已确认归还。请同步完结免押单。`
        : `订单 #${orderId} 归还确认失败：${result.message || '未知错误'}`
    } else {
      message = '暂不支持这个处理动作，请使用：确认发货 订单号，或确认归还 订单号。'
    }

    if (chatId) {
      await sendFeishuMessage({ chatId, config, message: buildFeishuText(message) })
      if (ok) {
        const refreshed = await runFulfillmentTasks({
          intent: 'fulfillment_tasks',
          taskDatePreset: parsed.taskDatePreset || 'today',
          taskType: parsed.taskType || 'all',
        })
        await sendFeishuMessage({ chatId, config, message: refreshed.message })
      }
    }
    return { status: 200, body: { ok: true, parsed, handled: ok, sent: Boolean(chatId), message } }
  }

  if (rawParsed.intent === 'booking' && bookingContext.status === 'ambiguous') {
    const message = buildAmbiguousBookingContextCard(bookingContext.contexts)
    if (chatId) await sendFeishuMessage({ chatId, config, message })
    return { status: 200, body: { ok: true, parsed, ambiguous: true, sent: Boolean(chatId) } }
  }

  if (parsed.intent === 'fulfillment_tasks') {
    const result = await runFulfillmentTasks(parsed)
    if (chatId) {
      const sent = await sendFeishuMessage({ chatId, config, message: result.message })
      console.log('[mobile-gateway] feishu fulfillment reply sent:', sent)
    }
    return { status: 200, body: { ok: true, parsed, sent: Boolean(chatId) } }
  }

  const missing = parsed.intent === 'booking' ? getBookingMissingFields(parsed) : getMissingFields(parsed)
  let message
  if (missing.length) {
    message = parsed.intent === 'availability'
      ? buildAvailabilityQueryCard(missing, { publicBaseUrl: getPublicBaseUrl(config) })
      : buildMissingCard(parsed, missing)
  } else {
    const availability = await checkScheduleAvailability(buildAvailabilityPayload(parsed))
    const inquiry = await recordInquirySafely({
      source: 'feishu',
      chatId,
      messageId,
      parsed,
      availability,
    })
    let context = null
    if (chatId && availability?.ok) context = rememberAvailabilityContext(chatId, parsed, availability, Date.now(), { messageId, inquiryEventId: inquiry?.id })
    message = buildAvailabilityCard(parsed, availability, {
      availableTemplate: config.MOBILE_AVAILABLE_REPLY_TEMPLATE,
      unavailableTemplate: config.MOBILE_UNAVAILABLE_REPLY_TEMPLATE,
      chatId,
    })
    if (chatId && parsed.intent === 'availability' && context) {
      const sent = await sendFeishuMessage({ chatId, config, message })
      rememberAvailabilityContextAlias(chatId, sent?.messageId, context)
      console.log('[mobile-gateway] feishu reply sent:', sent)
      const customerReply = buildCustomerAvailabilityReply(availability, {
        availableTemplate: config.MOBILE_AVAILABLE_REPLY_TEMPLATE,
        unavailableTemplate: config.MOBILE_UNAVAILABLE_REPLY_TEMPLATE,
      })
      if (customerReply) {
        await sendFeishuMessage({ chatId, config, message: buildCustomerReplyMessage(customerReply) })
      }
      return { status: 200, body: { ok: true, parsed, sent: true } }
    }
  }

  if (chatId) {
    const sent = await sendFeishuMessage({ chatId, config, message })
    console.log('[mobile-gateway] feishu reply sent:', sent)
  } else {
    console.log('[mobile-gateway] feishu reply skipped: missing chat id')
  }
  return { status: 200, body: { ok: true, parsed, sent: Boolean(chatId) } }
}

function inferReceiverFromAddress({ customerName, customerPhone, address } = {}) {
  const raw = String(address || '').trim()
  const phone = String(customerPhone || '').trim() || (raw.match(/1[3-9]\d{9}/)?.[0] || '')
  let name = String(customerName || '').trim()
  if (!name && raw) {
    const firstLine = raw.split(/\n|\r|，|,|\s{2,}/).map((item) => item.trim()).filter(Boolean)[0] || ''
    const withoutPhone = firstLine.replace(/1[3-9]\d{9}/g, '').trim()
    if (withoutPhone && withoutPhone.length <= 8 && !/[省市区县镇路街号栋单元室]/.test(withoutPhone)) {
      name = withoutPhone
    }
  }
  return { customerName: name, customerPhone: phone, address: raw }
}

async function createMobileOrder(body = {}) {
  const modelCode = String(body.modelCode || '').trim()
  const rentStartDate = String(body.rentStartDate || '').slice(0, 10)
  const rentEndDate = String(body.rentEndDate || '').slice(0, 10)
  if (!modelCode) return { ok: false, message: '请选择型号' }
  if (!rentStartDate || !rentEndDate) return { ok: false, message: '请选择租期' }

  const receiver = inferReceiverFromAddress(body)
  const requestedUnitId = Number(body.unitId)
  const result = await createOrder({
    storeId: body.storeId || undefined,
    orderNo: body.orderNo || undefined,
    modelCode,
    unitId: Number.isFinite(requestedUnitId) && requestedUnitId > 0 ? requestedUnitId : undefined,
    customerName: receiver.customerName || undefined,
    customerPhone: receiver.customerPhone || undefined,
    province: body.province || undefined,
    city: body.city || undefined,
    district: body.district || undefined,
    address: receiver.address || undefined,
    rentStartDate,
    rentEndDate,
    fee: Number(body.fee || 0),
    deposit: Number(body.deposit || 0),
    orderStatus: body.orderStatus || 'waiting_payment',
    plannedShipAt: body.plannedShipAt || undefined,
    expectedArriveAt: body.expectedArriveAt || undefined,
    trackingNo: body.trackingNo || undefined,
    shippingMode: body.shippingMode || 'land',
    latestLogisticsStatus: receiver.customerName && receiver.customerPhone && receiver.address ? body.latestLogisticsStatus : '待补资料',
  })
  const inquiryEventId = Number(body.inquiryEventId || 0)
  if (inquiryEventId) {
    await linkInquiryEventToOrder({ inquiryEventId, orderId: result.id, finalFee: Number(body.fee || 0) }).catch((error) => {
      console.warn('[mobile-gateway] mobile inquiry link skipped:', error?.message || error)
    })
  }
  const order = await getOrderById(result.id)
  return { ok: true, result, order: normalizeMobileOrder(order || { id: result.id, model_code: modelCode, rent_start_date: rentStartDate, rent_end_date: rentEndDate }) }
}

async function createMobileDepositOrder(body = {}) {
  const orderId = Number(body.orderId || body.sourceOrderId || 0)
  const sourceOrder = orderId ? await getOrderById(orderId) : null
  if (!sourceOrder) return { ok: false, message: '请先选择订单' }
  const mergedSettings = await mergeDepositSettings(body.settings || {})
  const rentStartDate = body.rentStartDate || sourceOrder.rent_start_date
  const rentEndDate = body.rentEndDate || sourceOrder.rent_end_date
  const params = {
    sourceOrderId: sourceOrder.id,
    sourceOrderNo: sourceOrder.order_no || String(sourceOrder.id),
    productName: body.productName || sourceOrder.model_code || sourceOrder.unit_code || '租赁设备',
    modelCode: body.modelCode || sourceOrder.model_code || '',
    unitCode: body.unitCode || sourceOrder.unit_code || '',
    customerName: body.customerName || sourceOrder.customer_name || '',
    customerPhone: body.customerPhone || sourceOrder.customer_phone || '',
    depositAmount: Number(body.depositAmount || sourceOrder.deposit || 0),
    rentAmount: Number(body.rentAmount || sourceOrder.fee || 0),
    rentStartDate,
    rentEndDate,
    rentDays: diffDaysBetweenDates(rentStartDate, rentEndDate),
    receivingInfo: body.receivingInfo || [sourceOrder.customer_name, sourceOrder.customer_phone, [sourceOrder.province, sourceOrder.city, sourceOrder.district, sourceOrder.address].filter(Boolean).join('')].filter(Boolean).join(' '),
  }
  const result = await createMerchantDepositOrder(params, mergedSettings)
  if (!result?.success || !result.depositOrder?.depositOrderNo) {
    return { ok: false, message: result?.message || '创建免押单失败', raw: result?.raw }
  }
  await upsertStoredDepositOrder({
    ...result.depositOrder,
    orderId: sourceOrder.id,
    sourceType: 'order',
    sourceOrderId: sourceOrder.id,
    sourceOrderNo: sourceOrder.order_no || String(sourceOrder.id),
    productName: params.productName,
    modelCode: params.modelCode,
    unitCode: params.unitCode,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    rentAmount: params.rentAmount,
    depositAmount: params.depositAmount,
    rentStartDate,
    rentEndDate,
    rentDays: params.rentDays,
    isLatest: true,
  }, {
    eventType: 'create',
    eventSource: 'mobile_h5',
    forceEvent: true,
    eventPayload: result.raw || result.depositOrder,
  })
  const normalized = normalizeMobileDepositOrder({
    ...result.depositOrder,
    sourceOrderId: sourceOrder.id,
    sourceOrderNo: sourceOrder.order_no || String(sourceOrder.id),
    modelCode: params.modelCode,
    unitCode: params.unitCode,
    productName: params.productName,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    rentAmount: params.rentAmount,
    depositAmount: params.depositAmount,
    rentStartDate,
    rentEndDate,
    rentDays: params.rentDays,
  })
  return { ok: true, message: result.message || '创建免押单成功', depositOrder: normalized }
}

function diffDaysBetweenDates(start, end) {
  const startDate = parseLocalDate(start)
  const endDate = parseLocalDate(end)
  if (!startDate || !endDate) return 0
  return Math.max(1, Math.round((endDate - startDate) / 86400000) + 1)
}

function parseLocalDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

async function finishMobileDepositOrder(body = {}) {
  const orderNo = String(body.depositOrderNo || body.orderNo || '').trim()
  if (!orderNo) return { ok: false, message: 'depositOrderNo required' }
  const mergedSettings = await mergeDepositSettings(body.settings || {})
  const result = await finishMerchantDepositOrder(orderNo, mergedSettings)
  if (!result?.success) return { ok: false, message: result?.message || '完结免押单失败', raw: result?.raw }
  const latest = await getStoredDepositOrder(orderNo)
  if (latest) {
    await upsertStoredDepositOrder({
      ...latest,
      status: 'completed',
      statusLabel: getDepositStatusLabel('completed'),
    }, {
      eventType: 'finish',
      eventSource: 'mobile_h5',
      forceEvent: true,
      eventPayload: result.raw || { orderNo, status: 'completed' },
      keepLatestFlag: true,
    })
  }
  const refreshed = await getStoredDepositOrder(orderNo)
  return { ok: true, message: result.message || '完结免押单成功', depositOrder: refreshed ? normalizeMobileDepositOrder(refreshed) : { depositOrderNo: orderNo, status: 'completed', statusLabel: getDepositStatusLabel('completed') } }
}

async function createMobileShipment(body = {}) {
  const linkedOrderId = Number(body.orderId || body.linkedOrderId || 0)
  if (!linkedOrderId) return { ok: false, message: 'orderId required' }
  const order = await getOrderById(linkedOrderId)
  if (!order) return { ok: false, message: '订单不存在' }
  const payload = {
    linkedOrderId,
    productCode: body.productCode || 'sf_standard',
    senderName: body.senderName || undefined,
    senderMobile: body.senderMobile || undefined,
    senderProvince: body.senderProvince || undefined,
    senderCity: body.senderCity || undefined,
    senderDistrict: body.senderDistrict || undefined,
    senderAddress: body.senderAddress || undefined,
    receiverName: body.receiverName || order.customer_name || undefined,
    receiverMobile: body.receiverMobile || order.customer_phone || undefined,
    receiverProvince: body.receiverProvince || order.province || undefined,
    receiverCity: body.receiverCity || order.city || undefined,
    receiverDistrict: body.receiverDistrict || order.district || undefined,
    receiverAddress: body.receiverAddress || order.address || undefined,
    cargoName: body.cargoName || '租赁设备',
    weightKg: Number(body.weightKg || 1) || 1,
    plannedSendAt: body.plannedSendAt || order.planned_ship_at || undefined,
    saveSenderAsDefault: Boolean(body.saveSenderAsDefault),
  }
  const result = await placeSfShipment(payload)
  if (!result?.shipment) return { ok: false, message: result?.message || '寄件下单失败' }
  return {
    ok: Boolean(result.ok) || result.status === 'submitted',
    message: result.message || '寄件单已处理',
    status: result.status || result.shipment.status,
    shipment: normalizeMobileShipment(result.shipment),
    paymentNotice: result.paymentNotice || '',
    estimateWarning: result.estimateWarning || '',
  }
}

async function listMobileOrders(req) {
  const query = getQuery(req)
  const orders = await listOrders({
    modelCode: query.get('modelCode') || undefined,
    status: query.get('status') || undefined,
    storeId: query.get('storeId') || undefined,
    from: query.get('from') || undefined,
    to: query.get('to') || undefined,
    quickFilter: query.get('quickFilter') || undefined,
  })
  return orders.map(normalizeMobileOrder)
}

async function getMobileScheduleOverview(req) {
  const query = getQuery(req)
  return getScheduleMonthlyOverview({
    month: query.get('month') || undefined,
    modelCode: query.get('modelCode') || undefined,
  })
}

async function route(req, res) {
  const path = normalizePath(req)
  if (req.method === 'GET' && path === '/health') {
    jsonResponse(res, 200, { ok: true, service: 'xianyu-mobile-gateway' })
    return
  }

  if (req.method === 'GET' && path === '/') {
    textResponse(res, 200, 'Xianyu Mobile Gateway is running.')
    return
  }

  if (req.method === 'GET' && path === '/mobile') {
    htmlResponse(res, 200, buildMobileWorkbenchHtml())
    return
  }

  if (req.method === 'GET' && path === '/mobile/availability') {
    htmlResponse(res, 200, buildMobileWorkbenchHtml())
    return
  }

  if (req.method === 'GET' && path === '/mobile/manifest.json') {
    jsonResponse(res, 200, buildMobileManifest(req))
    return
  }

  if (req.method === 'GET' && path === '/mobile/icon.png') {
    const iconPath = nodePath.join(__dirname, '..', 'assets', 'icon.png')
    if (iconPath && fs.existsSync(iconPath)) {
      binaryResponse(res, 200, fs.readFileSync(iconPath), 'image/png')
    } else {
      jsonResponse(res, 404, { ok: false, message: 'icon not found' })
    }
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/model-codes') {
    jsonResponse(res, 200, { ok: true, modelCodes: await getModelCodes() })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/stores') {
    const stores = await listStores({ status: 'active' })
    jsonResponse(res, 200, { ok: true, stores })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/orders') {
    jsonResponse(res, 200, { ok: true, orders: await listMobileOrders(req) })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/orders/detail') {
    const orderId = Number(getQuery(req).get('orderId') || 0)
    const detail = await getMobileOrderDetail(orderId)
    jsonResponse(res, detail ? 200 : 404, detail ? { ok: true, ...detail } : { ok: false, message: '订单不存在' })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/deposit/orders') {
    const query = getQuery(req)
    const result = await listMobileDepositOrders({
      sourceOrderId: query.get('sourceOrderId') || undefined,
      status: query.get('status') || undefined,
      keyword: query.get('keyword') || undefined,
      limit: query.get('limit') || undefined,
      page: query.get('page') || undefined,
    })
    jsonResponse(res, 200, result)
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/shipments/pending') {
    const query = getQuery(req)
    const result = await listSfPendingShipmentOrders({
      date: query.get('date') || undefined,
      includeOverdue: query.get('includeOverdue') !== 'false',
    })
    jsonResponse(res, 200, { ok: true, ...result })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/shipments') {
    const query = getQuery(req)
    const linkedOrderId = Number(query.get('linkedOrderId') || 0) || undefined
    const shipments = await listSfShipments({
      linkedOrderId,
      status: query.get('status') || undefined,
      keyword: query.get('keyword') || undefined,
    })
    jsonResponse(res, 200, { ok: true, shipments: (shipments || []).map(normalizeMobileShipment) })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/schedule/overview') {
    jsonResponse(res, 200, { ok: true, overview: await getMobileScheduleOverview(req) })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/inquiries') {
    const query = getQuery(req)
    const events = await listInquiryEvents({
      source: query.get('source') || undefined,
      storeId: query.get('storeId') || undefined,
      modelCode: query.get('modelCode') || undefined,
      from: query.get('from') || undefined,
      to: query.get('to') || undefined,
      limit: query.get('limit') || 100,
    })
    jsonResponse(res, 200, { ok: true, events })
    return
  }

  if (req.method === 'GET' && path === '/api/mobile/inquiry-stats') {
    const query = getQuery(req)
    const stats = await getInquiryStats({
      source: query.get('source') || undefined,
      storeId: query.get('storeId') || undefined,
      modelCode: query.get('modelCode') || undefined,
      from: query.get('from') || undefined,
      to: query.get('to') || undefined,
      limit: query.get('limit') || 500,
    })
    jsonResponse(res, 200, { ok: true, stats })
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 404, { ok: false, message: 'not found' })
    return
  }

  const body = await readBody(req)
  if (path === '/api/mobile/parse') {
    jsonResponse(res, 200, { ok: true, parsed: await parseCommandText(body.text || '') })
    return
  }
  if (path === '/api/mobile/availability') {
    const result = await runAvailabilityFromBody(body, { source: body.source || 'mobile_h5', storeId: body.storeId || undefined })
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/fulfillment-tasks') {
    const parsed = body.text ? await parseCommandText(body.text) : { intent: 'fulfillment_tasks', taskDatePreset: body.taskDatePreset || 'today', taskType: body.taskType || 'all' }
    const result = await runFulfillmentTasks(parsed)
    jsonResponse(res, 200, { ok: true, parsed, tasks: result.tasks, digest: buildFulfillmentDigest(result.tasks, { taskType: parsed.taskType || 'all' }) })
    return
  }
  if (path === '/api/mobile/bookings/create') {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID()
    const result = body.text ? await createBookingFromText(body.text, body) : { ok: false, message: 'text required' }
    jsonResponse(res, result.ok ? 200 : 400, { requestId, ...result })
    return
  }
  if (path === '/api/mobile/orders/create') {
    const result = await createMobileOrder(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/deposit/orders/create') {
    const result = await createMobileDepositOrder(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/deposit/orders/finish') {
    const result = await finishMobileDepositOrder(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/orders/mark-shipped') {
    const orderId = Number(body.orderId || 0)
    if (!orderId) {
      jsonResponse(res, 400, { ok: false, message: 'orderId required' })
      return
    }
    const result = await batchMarkOrdersShipped({ orderIds: [orderId], latestLogisticsStatus: '手机端确认已发货' })
    const first = result.results?.[0]
    jsonResponse(res, first?.ok ? 200 : 400, { ok: Boolean(first?.ok), result, message: first?.message || '操作失败' })
    return
  }
  if (path === '/api/mobile/orders/mark-returned') {
    const orderId = Number(body.orderId || 0)
    if (!orderId) {
      jsonResponse(res, 400, { ok: false, message: 'orderId required' })
      return
    }
    const result = await markOrderReturned({ orderId, latestLogisticsStatus: '手机端确认已归还' })
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/shipments/create') {
    const result = await createMobileShipment(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/shipments/cancel') {
    const shipmentId = Number(body.shipmentId || 0)
    if (!shipmentId) {
      jsonResponse(res, 400, { ok: false, message: 'shipmentId required' })
      return
    }
    const result = await cancelSfShipment({ shipmentId })
    jsonResponse(res, result.ok ? 200 : 400, { ...result, shipment: result.shipment ? normalizeMobileShipment(result.shipment) : null })
    return
  }
  if (path === '/api/mobile/shipments/routes') {
    const result = await querySfShipmentRoutes(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/shipments/fee') {
    const result = await querySfShipmentFee(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/shipments/promise-time') {
    const result = await querySfShipmentPromiseTime(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/mobile/shipments/actual-paid') {
    const result = await updateSfShipmentActualPaid(body)
    jsonResponse(res, result.ok ? 200 : 400, result)
    return
  }
  if (path === '/api/feishu/events') {
    const config = await getGatewayConfig()
    const inspected = inspectFeishuEventPayload(body, config)
    if (!verifyFeishuToken(inspected.payload, config)) {
      jsonResponse(res, 403, { ok: false, message: 'invalid feishu token' })
      return
    }
    if (inspected.payload?.type === 'url_verification') {
      const result = await handleFeishuEvent(inspected.payload, { config, inspected })
      jsonResponse(res, result.status, result.body)
      return
    }
    if (inspected.isCardActionTrigger) {
      jsonResponse(res, 200, buildFeishuCardCallbackResponse('已收到请求，后台处理中'))
      setTimeout(() => {
        handleFeishuEvent(inspected.payload, { config, inspected }).catch((error) => {
          console.error('[mobile-gateway] async action handling failed:', error)
        })
      }, 0)
      return
    }
    const messageId = extractFeishuMessageId(inspected.payload)
    if (!shouldProcessFeishuMessage(messageId)) {
      jsonResponse(res, 200, { ok: true, ignored: true, duplicate: true })
      return
    }
    jsonResponse(res, 200, { ok: true, accepted: true })
    setTimeout(() => {
      handleFeishuEvent(inspected.payload, { config, inspected }).catch((error) => {
        console.error('[mobile-gateway] async message handling failed:', error)
      })
    }, 0)
    return
  }

  jsonResponse(res, 404, { ok: false, message: 'not found' })
}

async function startMobileGateway() {
  if (server) return server
  const config = await getGatewayConfig({ forceRefresh: true })
  if (!isEnabled(config.MOBILE_GATEWAY_ENABLED ?? 'true')) return null
  const host = String(process.env.XIANYU_MOBILE_GATEWAY_HOST || config.MOBILE_GATEWAY_HOST || '127.0.0.1').trim()
  const port = Number(process.env.XIANYU_MOBILE_GATEWAY_PORT || config.MOBILE_GATEWAY_PORT || 8787)
  server = http.createServer((req, res) => {
    route(req, res).catch((error) => {
      console.error('[mobile-gateway] request error:', error)
      jsonResponse(res, 500, { ok: false, message: error.message || 'internal error' })
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolve)
  })
  console.log(`[mobile-gateway] listening at http://${host}:${port}`)
  startFulfillmentReminderLoop()
  return server
}

function shouldSendReminderAt(now = new Date()) {
  const hour = now.getHours()
  const minute = now.getMinutes()
  if (hour === 8 && minute <= 10) return 'morning'
  if (hour === 20 && minute <= 10) return 'tomorrow'
  return ''
}

async function sendScheduledFulfillmentReminder(kind, now = new Date()) {
  const config = await getConfig()
  if (!isEnabled(config.MOBILE_FULFILLMENT_REMINDER_ENABLED ?? 'true')) return { ok: false, message: 'disabled' }
  const chatId = String(config.MOBILE_FEISHU_NOTIFY_CHAT_ID || '').trim()
  if (!chatId) return { ok: false, message: 'missing notify chat id' }
  const today = normalizeDateOnly(now)
  const key = `${today}:${kind}`
  for (const persistedKey of parseFulfillmentReminderSentKeys(config[FULFILLMENT_REMINDER_SENT_CONFIG_KEY])) {
    sentFulfillmentReminderKeys.add(persistedKey)
  }
  if (sentFulfillmentReminderKeys.has(key)) return { ok: false, message: 'already sent' }

  const date = kind === 'tomorrow' ? addLocalDays(today, 1) : today
  const tasks = await listFulfillmentTasks({ dateFrom: date, dateTo: date })
  const title = kind === 'tomorrow' ? '明日履约提醒' : '今日履约提醒'
  const message = buildFulfillmentCard(tasks, { title, taskType: 'all' })
  const sent = await sendFeishuMessage({ chatId, config, message })
  sentFulfillmentReminderKeys.add(key)
  const nextSentKeys = appendFulfillmentReminderSentKey(config[FULFILLMENT_REMINDER_SENT_CONFIG_KEY], key)
  await saveConfig({ [FULFILLMENT_REMINDER_SENT_CONFIG_KEY]: nextSentKeys })
  mergeGatewayConfigCache({ [FULFILLMENT_REMINDER_SENT_CONFIG_KEY]: nextSentKeys })
  console.log('[mobile-gateway] scheduled fulfillment reminder sent:', { kind, sent })
  return { ok: true, sent }
}

function startFulfillmentReminderLoop() {
  if (fulfillmentReminderTimer) return
  fulfillmentReminderTimer = setInterval(() => {
    const kind = shouldSendReminderAt(new Date())
    if (!kind) return
    sendScheduledFulfillmentReminder(kind).catch((error) => {
      console.error('[mobile-gateway] scheduled fulfillment reminder failed:', error)
    })
  }, 60 * 1000)
}

function stopMobileGateway() {
  if (fulfillmentReminderTimer) {
    clearInterval(fulfillmentReminderTimer)
    fulfillmentReminderTimer = null
  }
  if (!server) return
  server.close()
  server = null
}

module.exports = {
  buildMobileWorkbenchHtml,
  buildAvailabilityContextRecord,
  buildAvailabilityCard,
  buildAvailabilityQueryCard,
  buildBookingLatestLogisticsStatus,
  buildBookingResultMessage,
  buildBookingResultCard,
  buildFeishuCardCallbackResponse,
  inspectFeishuEventPayload,
  buildCustomerAvailabilityReply,
  buildCustomerReplyMessage,
  buildCustomerReplyCard,
  buildFulfillmentCard,
  buildFulfillmentDigest,
  buildFeishuBookingSnapshot,
  appendFulfillmentReminderSentKey,
  createBookingFromText,
  decryptFeishuPayload,
  getBookingMissingFields,
  handleFeishuEvent,
  mergeBookingParsedWithAvailabilityContext,
  parseFulfillmentReminderSentKeys,
  rememberAvailabilityContext,
  resetMobileGatewayContextForTests,
  resolveBookingAvailabilityContext,
  shouldRecordInquiryEvent,
  shouldProcessFeishuMessage,
  normalizeMobileAvailabilityAddress,
  runAvailabilityFromText,
  runAvailabilityFromBody,
  runFulfillmentTasks,
  sendScheduledFulfillmentReminder,
  startMobileGateway,
  stopMobileGateway,
}
