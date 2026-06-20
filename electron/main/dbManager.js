const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const Database = require('better-sqlite3')
const mysqlAdapter = require('./mysqlAdapter')
const {
  buildDepositExemptionSummary,
  buildPricingRowsFromLadder,
  pickDepositExemptionRule,
  resolveQuoteFromPricingRows,
} = require('./rentalOpsRules')
const {
  buildInquiryEventRecord,
  summarizeInquiryStats,
} = require('./rentalInquiryMetrics')
const {
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
  validateCreateOrderPrerequisites,
  validateExpressShipmentData,
  validatePickupTimeWindow,
} = require('./sfShippingService')
let sfTokenCache = null

let inquiryOptimizationModules = null

let runtimeDataDir = ''
const SNAPSHOT_RETENTION = 12

function snapshotStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

async function createRuntimeBackupSnapshot(reason = 'manual') {
  if (!runtimeDataDir) return null
  const backupDir = path.join(runtimeDataDir, 'db-backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const tables = {
    config: await mysqlAdapter.all('SELECT `key`, `value`, updated_at FROM config ORDER BY `key`'),
    prompts: await mysqlAdapter.all('SELECT name, content, updated_at FROM prompts ORDER BY name'),
    stores: await mysqlAdapter.all('SELECT * FROM stores ORDER BY sort_order ASC, id ASC'),
    schedule_units: await mysqlAdapter.all('SELECT * FROM schedule_units ORDER BY id ASC'),
    schedule_blocks: await mysqlAdapter.all('SELECT * FROM schedule_blocks ORDER BY id ASC'),
    rental_orders: await mysqlAdapter.all('SELECT * FROM rental_orders ORDER BY id ASC'),
    shipping_records: await mysqlAdapter.all('SELECT * FROM shipping_records ORDER BY id ASC'),
    sf_shipments: await mysqlAdapter.all('SELECT * FROM sf_shipments ORDER BY id ASC'),
    sf_shipment_events: await mysqlAdapter.all('SELECT * FROM sf_shipment_events ORDER BY id ASC'),
    item_model_mapping: await mysqlAdapter.all('SELECT * FROM item_model_mapping ORDER BY item_id ASC'),
    rental_pricing: await mysqlAdapter.all('SELECT * FROM rental_pricing ORDER BY id ASC'),
    deposit_exemption_rules: await mysqlAdapter.all('SELECT * FROM deposit_exemption_rules ORDER BY id ASC'),
    inquiry_events: await mysqlAdapter.all('SELECT * FROM inquiry_events ORDER BY id ASC'),
    knowledge: await mysqlAdapter.all('SELECT * FROM knowledge ORDER BY id ASC'),
  }

  const payload = {
    reason,
    createdAt: new Date().toISOString(),
    tables,
  }
  const filename = `snapshot-${snapshotStamp()}.json`
  const tempPath = path.join(backupDir, `${filename}.tmp`)
  const targetPath = path.join(backupDir, filename)
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8')
  fs.renameSync(tempPath, targetPath)

  const files = fs.readdirSync(backupDir)
    .filter((name) => name.startsWith('snapshot-') && name.endsWith('.json'))
    .sort()
  while (files.length > SNAPSHOT_RETENTION) {
    const stale = files.shift()
    if (!stale) break
    fs.unlinkSync(path.join(backupDir, stale))
  }
  return targetPath
}

const DEFAULT_STORE_CODE = 'xiaogou'
const DEFAULT_STORE_NAME = '小狗相机'
const STORE_PRESETS = [
  { code: DEFAULT_STORE_CODE, name: DEFAULT_STORE_NAME, status: 'active', isDefault: 1, sortOrder: 10 },
  { code: 'kuaimen', name: '快门相机', status: 'active', isDefault: 0, sortOrder: 20 },
]

const CURRENT_INVENTORY_COUNTS = {
  '大疆POCKET3': 7,
  '大疆POCKET4': 6,
  acepro2: 7,
  IXUS210: 4,
  IXUS130: 16,
  IXUS300: 3,
  IXUS220: 1,
  IXUS115: 1,
  IXUS95: 1,
  '佳能740': 1,
  g7x2: 5,
  R50: 2,
  g12: 11,
  gr3x: 7,
  '神牛闪光灯': 5,
  x100vi: 1,
  '苹果7p': 1,
  w2s: 1,
}

function extractUnitSuffixNumber(unitCode) {
  const matched = String(unitCode || '').match(/(\d+)(?!.*\d)/)
  if (!matched) return null
  const value = Number.parseInt(matched[1], 10)
  return Number.isFinite(value) ? value : null
}

function isCurrentInventoryUnit(unit) {
  if (unit?.status && unit.status !== 'offline') return true
  return isPresetInventoryUnit(unit)
}

function isPresetInventoryUnit(unit) {
  const count = CURRENT_INVENTORY_COUNTS[unit?.model_code]
  if (!count) return false
  const suffix = extractUnitSuffixNumber(unit?.unit_code)
  return suffix != null && suffix >= 1 && suffix <= count
}

function isRestorableScheduleUnit(unit) {
  if (!unit) return false
  return unit.status === 'offline' || !isPresetInventoryUnit(unit)
}

async function archiveHistoricalScheduleUnit(unit = {}) {
  const unitId = Number(unit.id || 0)
  const unitCode = String(unit.unit_code || '').trim()
  if (!unitId || !unitCode) return null
  const archivedCode = `${unitCode}__archived_${unitId}`
  await mysqlAdapter.run(`
    UPDATE schedule_units
    SET unit_code = ?, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [archivedCode, unitId])
  return archivedCode
}

function getInquiryOptimizationModules() {
  if (!inquiryOptimizationModules) {
    inquiryOptimizationModules = {
      ...require('./inquiryOptimizationConfig'),
      ...require('./inquiryOptimizationEngine'),
    }
  }
  return inquiryOptimizationModules
}

function nowExpr() {
  return "NOW()"
}

function normalizeTags(tags) {
  if (!tags) return null
  if (Array.isArray(tags)) return JSON.stringify(tags)
  return String(tags)
}

function parseTags(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return String(value)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  }
}

function rowToKnowledge(row) {
  return {
    ...row,
    tags: parseTags(row.tags),
  }
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatLocalDateTime(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function normalizeDateTime(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.replace(' ', 'T').length === 16 ? `${trimmed.replace(' ', 'T')}:00` : trimmed.replace(' ', 'T')
    }
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? trimmed : formatLocalDateTime(parsed)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : formatLocalDateTime(parsed)
}

function firstNonEmpty(values = []) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return null
}

function normalizeStoreIdValue(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeMoneyValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0
}

function firstDefined(values = []) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function normalizeDepositStatusValue(value) {
  const normalized = String(value ?? '').trim()
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
  const map = {
    pending_review: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    completed: '已完结',
    cancelled: '已取消',
  }
  return map[status] || status || '未知'
}

function parseDepositSupplementaryFields(raw = {}) {
  const text = String(firstDefined([
    raw.deposit_farther,
    raw.depositFarther,
    raw.contractSupplementaryContent,
  ]) || '').trim()
  const parseField = (label) => {
    const match = text.match(new RegExp(`${String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[：:]\\s*([^；;\\n\\r]+)`))
    return match?.[1]?.trim() || ''
  }
  return {
    sourceOrderNo: parseField('来源订单'),
    modelCode: parseField('型号'),
    unitCode: parseField('设备编号'),
  }
}

function normalizeDepositDateValue(value) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    if (/^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) return trimmed.slice(0, 10).replaceAll('/', '-')
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value || '')
  const millis = numeric < 1e12 ? numeric * 1000 : numeric
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) return String(value || '')
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function normalizeDepositDateTimeValue(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) {
    return normalizeDateTime(value)
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return normalizeDateTime(value)
  const millis = numeric < 1e12 ? numeric * 1000 : numeric
  return normalizeDateTime(new Date(millis))
}

function calcDepositRentDays(startDate, endDate, explicitDays = 0) {
  const explicit = Number(explicitDays)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  if (!startDate || !endDate) return 0
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`)
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(1, Math.round((end - start) / 86400000) + 1)
}

function normalizeDepositOrderSnapshot(order = {}, overrides = {}) {
  const supplementary = parseDepositSupplementaryFields(order)
  const status = normalizeDepositStatusValue(firstDefined([
    order.status,
    order.depositStatus,
    order.deposit_status,
    overrides.status,
  ]))
  const rentStartDate = normalizeDepositDateValue(firstDefined([
    order.rentStartDate,
    order.rent_start_time,
    order.rent_start_date,
    overrides.rentStartDate,
  ]))
  const rentEndDate = normalizeDepositDateValue(firstDefined([
    order.rentEndDate,
    order.rent_end_time,
    order.rent_end_date,
    overrides.rentEndDate,
  ]))
  const createdAt = normalizeDepositDateTimeValue(firstDefined([
    order.createdAt,
    order.created_at,
    order.create_time,
    overrides.createdAt,
  ]))
  const updatedAt = normalizeDepositDateTimeValue(firstDefined([
    order.updatedAt,
    order.updated_at,
    order.update_time,
    createdAt,
    overrides.updatedAt,
  ]))
  const depositOrderNo = String(firstDefined([
    order.depositOrderNo,
    order.orderNo,
    order.order_no,
    order.out_order_no,
    overrides.depositOrderNo,
  ]) || '').trim()

  return {
    depositOrderNo,
    orderId: normalizeStoreIdValue(firstDefined([order.orderId, order.order_id, overrides.orderId])),
    sourceType: String(firstDefined([order.sourceType, overrides.sourceType]) || 'order'),
    sourceOrderId: firstDefined([order.sourceOrderId, order.source_order_id, overrides.sourceOrderId]),
    sourceOrderNo: String(firstDefined([order.sourceOrderNo, order.source_order_no, order.out_order_no, supplementary.sourceOrderNo, overrides.sourceOrderNo]) || '').trim(),
    productName: String(firstDefined([order.productName, order.product_name, overrides.productName]) || '').trim(),
    modelCode: String(firstDefined([order.modelCode, order.model_code, supplementary.modelCode, overrides.modelCode]) || '').trim(),
    unitCode: String(firstDefined([order.unitCode, order.unit_code, supplementary.unitCode, overrides.unitCode]) || '').trim(),
    customerName: String(firstDefined([order.customerName, order.customer_name, order.customer_nickname, overrides.customerName]) || '').trim(),
    customerPhone: String(firstDefined([order.customerPhone, order.customer_mobile, order.customer_phone, overrides.customerPhone]) || '').trim(),
    depositAmount: normalizeMoneyValue(firstDefined([order.depositAmount, order.product_deposit, order.deposit_amount, overrides.depositAmount])),
    rentAmount: normalizeMoneyValue(firstDefined([order.rentAmount, order.count_deposit_price, order.daily_deposit_price, order.rent_amount, overrides.rentAmount])),
    rentStartDate,
    rentEndDate,
    rentDays: calcDepositRentDays(rentStartDate, rentEndDate, firstDefined([order.rentDays, order.rent_days, order.deposit_period, overrides.rentDays])),
    status,
    statusLabel: String(firstDefined([order.statusLabel, order.depositStatusLabel, overrides.statusLabel]) || getDepositStatusLabel(status)),
    reviewUrl: String(firstDefined([order.reviewUrl, order.scheme_url, order.schemeUrl, overrides.reviewUrl]) || '').trim(),
    qrImageUrl: String(firstDefined([order.qrImageUrl, order.qr_code_url, order.qrCodeUrl, overrides.qrImageUrl]) || '').trim(),
    isLatest: Number(firstDefined([order.isLatest, overrides.isLatest]) === false ? 0 : (firstDefined([order.isLatest, overrides.isLatest]) ? 1 : 1)),
    thirdPartyCreatedAt: createdAt,
    thirdPartyUpdatedAt: updatedAt,
    rawSnapshotJson: JSON.stringify(order),
  }
}

function normalizeTraceItem(item, index = 0) {
  if (!item || typeof item !== 'object') return null
  const status = firstNonEmpty([item.status, item.latest_status, item.context, item.content, item.desc, item.description, item.remark, item.message])
  if (!status) return null
  return {
    id: item.id || `trace_${index}`,
    latest_status: String(status),
    actual_ship_at: normalizeDateTime(firstNonEmpty([item.actual_ship_at, item.actualShipAt, item.ship_time, item.shipTime, item.time, item.timestamp])),
    expected_arrive_at: normalizeDateTime(firstNonEmpty([item.expected_arrive_at, item.expectedArriveAt, item.eta, item.estimated_delivery_time, item.estimatedDeliveryTime])),
    tracking_no: firstNonEmpty([item.tracking_no, item.trackingNo]),
    created_at: normalizeDateTime(firstNonEmpty([item.created_at, item.createdAt, item.time, item.timestamp])) || normalizeDateTime(new Date()),
  }
}

function normalizeLogisticsResponse(payload) {
  const data = payload?.data ?? payload?.result ?? payload?.payload ?? payload
  const tracesSource = Array.isArray(data?.traces)
    ? data.traces
    : Array.isArray(data?.trace_list)
      ? data.trace_list
      : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.items)
          ? data.items
          : []
  const traces = tracesSource.map((item, index) => normalizeTraceItem(item, index)).filter(Boolean)
  const latestTrace = traces[0] || null
  const latestStatus = firstNonEmpty([
    data?.latest_status,
    data?.latestStatus,
    data?.status,
    data?.state,
    data?.message,
    data?.desc,
    latestTrace?.latest_status,
  ])
  return {
    latestStatus: latestStatus ? String(latestStatus) : null,
    actualShipAt: normalizeDateTime(firstNonEmpty([data?.actual_ship_at, data?.actualShipAt, data?.ship_time, data?.shipTime, latestTrace?.actual_ship_at])),
    expectedArriveAt: normalizeDateTime(firstNonEmpty([data?.expected_arrive_at, data?.expectedArriveAt, data?.eta, data?.estimated_delivery_time, data?.estimatedDeliveryTime, latestTrace?.expected_arrive_at])),
    traces,
  }
}

function estimateEtaDays(city, shippingMode = 'land') {
  if (shippingMode === 'next_morning') return 1
  if (shippingMode === 'express') return 1.5
  if (!city) return 2.5
  const remoteKeywords = ['新疆', '西藏', '青海', '甘肃', '内蒙古', '海南', '宁夏', '黑龙江']
  if (remoteKeywords.some((keyword) => String(city).includes(keyword))) return 4
  return 2
}

function parseCsvConfig(value) {
  return String(value || '')
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseHour(value, fallback) {
  const normalized = String(value ?? fallback).trim()
  if (normalized === '23') return 18
  const hour = Number.parseInt(normalized, 10)
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : fallback
}

function parseDayCount(value, fallback) {
  const days = Number.parseInt(String(value ?? fallback), 10)
  return Number.isFinite(days) && days >= 0 ? days : fallback
}

function parseJsonSafely(value, fallback = null) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function parseCookieValue(cookiesText, key) {
  const parts = String(cookiesText || '').split(';')
  for (const part of parts) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const name = part.slice(0, index).trim()
    if (name === key) return part.slice(index + 1).trim()
  }
  return ''
}

function extractTextFragments(value, bucket = []) {
  if (value === null || value === undefined) return bucket
  if (typeof value === 'string' || typeof value === 'number') {
    bucket.push(String(value))
    return bucket
  }
  if (Array.isArray(value)) {
    for (const item of value) extractTextFragments(item, bucket)
    return bucket
  }
  if (typeof value === 'object') {
    for (const nested of Object.values(value)) extractTextFragments(nested, bucket)
  }
  return bucket
}

function extractBusinessCodes(itemInfo = {}) {
  const fragments = []
  for (const key of ['title', 'desc', 'description', 'richTextDesc', 'summary']) {
    extractTextFragments(itemInfo?.[key], fragments)
  }
  const bizPatterns = [
    /商品编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})/i,
    /业务编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})/i,
    /biz[_\s-]*item[_\s-]*code\s*[:：=]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})/i,
  ]
  const modelPatterns = [
    /型号编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})/i,
    /机型编码\s*[:：]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})/i,
    /机型\s*[:：]\s*([\u4e00-\u9fa5A-Za-z0-9][\u4e00-\u9fa5A-Za-z0-9._\-\s]{0,63})/i,
    /model[_\s-]*code\s*[:：=]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})/i,
  ]
  const result = { bizItemCode: '', modelCode: '', codeSource: '' }
  for (const fragment of fragments) {
    if (!result.bizItemCode) {
      const matched = bizPatterns.map((pattern) => pattern.exec(fragment)).find(Boolean)
      if (matched) {
        result.bizItemCode = matched[1].trim()
        result.codeSource = result.codeSource || 'description'
      }
    }
    if (!result.modelCode) {
      const matched = modelPatterns.map((pattern) => pattern.exec(fragment)).find(Boolean)
      if (matched) {
        result.modelCode = matched[1].trim()
        result.codeSource = result.codeSource || 'description'
      }
    }
    if (result.bizItemCode && result.modelCode) break
  }
  return result
}

function parseListingOwnerKeywords(rawValue = '') {
  return String(rawValue || '')
    .split(/[,，\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function itemDescriptionMarksOwner(itemInfo = {}, keywords = []) {
  const fragments = []
  for (const key of ['title', 'desc', 'description', 'richTextDesc', 'summary']) {
    extractTextFragments(itemInfo?.[key], fragments)
  }
  const codes = extractBusinessCodes(itemInfo)
  if (codes.bizItemCode && codes.modelCode) {
    return { matched: true, reason: 'business_code_and_model', bizItemCode: codes.bizItemCode, modelCode: codes.modelCode, matchedKeyword: '' }
  }
  if (keywords.length) {
    const normalizedText = fragments.join('\n').toLowerCase()
    const matchedKeyword = keywords.find((keyword) => normalizedText.includes(keyword.toLowerCase())) || ''
    if (matchedKeyword) {
      return { matched: true, reason: `keyword:${matchedKeyword}`, bizItemCode: codes.bizItemCode, modelCode: codes.modelCode, matchedKeyword }
    }
  }
  return { matched: false, reason: '', bizItemCode: codes.bizItemCode, modelCode: codes.modelCode, matchedKeyword: '' }
}

function extractItemOwnerId(itemInfo = {}) {
  const idKeys = new Set([
    'userId', 'sellerId', 'ownerId', 'accountId', 'fishUserId', 'publisherId',
    'user_id', 'seller_id', 'owner_id', 'account_id', 'seller_id_str', 'user_id_str',
    'ownerUserId', 'sellerUserId', 'publisherUserId', 'itemUserId', 'userIdStr',
    'owner_user_id', 'seller_user_id', 'publisher_user_id', 'item_user_id',
  ])
  const objectKeys = new Set([
    'sellerDO', 'seller', 'userDO', 'user', 'owner', 'ownerDO', 'publisher', 'publisherDO',
    'itemUserDO', 'sellerInfo', 'userInfo', 'accountDO', 'shareData', 'trackParams', 'author',
    'publisherInfo', 'ownerInfo', 'loginUserInfo',
  ])
  const visited = new Set()
  const walk = (node) => {
    if (node === null || node === undefined) return ''
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item)
        if (found) return found
      }
      return ''
    }
    if (typeof node !== 'object') return ''
    if (visited.has(node)) return ''
    visited.add(node)
    for (const key of idKeys) {
      const value = node[key]
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim()
    }
    for (const [key, value] of Object.entries(node)) {
      if (objectKeys.has(key) || key.endsWith('DO') || key.endsWith('Info')) {
        const found = walk(value)
        if (found) return found
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') {
        const found = walk(value)
        if (found) return found
      }
    }
    return ''
  }
  return walk(itemInfo)
}

function extractFirstImageUrl(value) {
  const candidates = []
  const visit = (node, key = '') => {
    if (node === null || node === undefined || candidates.length) return
    if (typeof node === 'string') {
      if (/^https?:\/\//i.test(node) && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(node)) candidates.push(node)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key)
      return
    }
    if (typeof node === 'object') {
      const preferredKeys = ['picUrl', 'imageUrl', 'coverUrl', 'mainPic', 'itemPicUrl', 'url', 'src']
      for (const preferredKey of preferredKeys) {
        if (node[preferredKey]) visit(node[preferredKey], preferredKey)
        if (candidates.length) return
      }
      for (const [childKey, childValue] of Object.entries(node)) {
        if (/pic|image|cover|avatar|url/i.test(childKey)) visit(childValue, childKey)
        if (candidates.length) return
      }
    }
  }
  visit(value)
  return candidates[0] || ''
}

function resolveReceiverProvince(province, city = '') {
  if (province) return String(province)
  const normalizedCity = String(city || '')
  const cityProvinceMap = {
    成都: '四川省',
    成都市: '四川省',
    杭州: '浙江省',
    杭州市: '浙江省',
    北京: '北京市',
    北京市: '北京市',
    上海: '上海市',
    上海市: '上海市',
    广州: '广东省',
    广州市: '广东省',
    深圳: '广东省',
    深圳市: '广东省',
    南京: '江苏省',
    南京市: '江苏省',
    武汉: '湖北省',
    武汉市: '湖北省',
    西安: '陕西省',
    西安市: '陕西省',
    重庆: '重庆市',
    重庆市: '重庆市',
  }
  if (cityProvinceMap[normalizedCity]) return cityProvinceMap[normalizedCity]
  return String(city || '').includes('四川') ? '四川省' : ''
}

function isSpecialSfRegion({ province, city = '', district = '' }, config = {}) {
  const normalizedProvince = resolveReceiverProvince(province, city)
  const specialRegions = parseCsvConfig(config.SF_SICHUAN_SPECIAL_REGIONS || '甘孜,阿坝')
  const target = `${city} ${district}`
  if (specialRegions.some((keyword) => target.includes(keyword))) return true
  if (normalizedProvince) return !normalizedProvince.includes('四川')
  return false
}

function resolveRequiredArrivalDate(rentStartDate, config = {}) {
  const start = new Date(`${rentStartDate}T00:00:00`)
  start.setDate(start.getDate() - parseDayCount(config.SHIP_ARRIVE_AHEAD_DAYS, 1))
  return start
}

function resolveTrialLeadDays({ province, city, district }, config = {}) {
  return isSpecialSfRegion({ province, city, district }, config) ? 3 : 2
}

function resolveTrialSendDate(rentStartDate, { province, city, district }, config = {}) {
  const requiredArrivalDate = resolveRequiredArrivalDate(rentStartDate, config)
  const trialDate = new Date(requiredArrivalDate)
  trialDate.setDate(trialDate.getDate() - resolveTrialLeadDays({ province, city, district }, config))
  return trialDate
}

function resolveSendHour({ province, city, district }, config = {}) {
  const defaultHour = parseHour(config.SF_DEFAULT_SEND_HOUR, 18)
  const specialHour = parseHour(config.SF_SPECIAL_SEND_HOUR, 18)
  return isSpecialSfRegion({ province, city, district }, config) ? specialHour : defaultHour
}

function resolvePlannedSendDateTime({ rentStartDate, province, city, district }, config = {}, serviceDate = null) {
  const baseDate = serviceDate || formatLocalDateTime(resolveRequiredArrivalDate(rentStartDate, config)).slice(0, 10)
  return new Date(`${baseDate}T${pad2(resolveSendHour({ province, city, district }, config))}:00:00`)
}

function applySendHour(date, { province, city, district }, config = {}) {
  const baseDate = formatLocalDateTime(date).slice(0, 10)
  return new Date(`${baseDate}T${pad2(resolveSendHour({ province, city, district }, config))}:00:00`)
}

function resolveSendDateTimeString(date, location, config = {}) {
  const baseDate = formatLocalDateTime(date).slice(0, 10)
  return `${baseDate}T${pad2(resolveSendHour(location, config))}:00:00`
}

function isBeforeDateTime(left, right) {
  if (!left || !right) return false
  return new Date(left).getTime() < new Date(right).getTime()
}

function normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt) {
  const normalized = normalizeDateTime(expectedArriveAt)
  if (!normalized) return null
  if (isBeforeDateTime(normalized, formatLocalDateTime(trialShipAt))) return null
  return normalized
}

function normalizeExpectedArrivalForFallback(date, location, config = {}) {
  return resolveSendDateTimeString(date, location, config)
}

function resolveStableLocalDate(date) {
  return formatLocalDateTime(date).slice(0, 10)
}

function buildSfTimeFields(trialShipAt, location, config = {}) {
  const sendTime = resolveSendDateTimeString(trialShipAt, location, config)
  return {
    expectedShippingTime: sendTime,
    sendStartTm: sendTime,
  }
}

function buildRequestSendTime(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config).expectedShippingTime
}

function buildFallbackExpectedAt(rentStartDate, location, config = {}) {
  return normalizeExpectedArrivalForFallback(resolveRequiredArrivalDate(rentStartDate, config), location, config)
}

function buildTransitGuardMessage(trialShipAt, expectedArriveAt) {
  return `顺丰返回送达时间早于试算寄件时间（试算 ${formatLocalDateTime(trialShipAt)}，送达 ${expectedArriveAt}）`
}

function buildFallbackReasonWithTrial(reason, trialShipAt, location, config = {}) {
  return reason ? `${reason}（试算寄件时间 ${resolveSendDateTimeString(trialShipAt, location, config)}）` : null
}

function normalizeTransitDays(days) {
  return Math.max(1, Number.parseInt(String(days || 1), 10) || 1)
}

function buildStableDate(date) {
  return resolveStableLocalDate(date)
}

function buildPlanShipAt(plannedShipDate, location, config = {}) {
  return resolveSendDateTimeString(plannedShipDate, location, config)
}

function normalizeGuardedArrival(expectedArriveAt, trialShipAt) {
  return normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
}

function buildGuardFailureReason(expectedArriveAt, trialShipAt) {
  return buildTransitGuardMessage(trialShipAt, expectedArriveAt)
}

function buildSendTimePayload(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config)
}

function resolveStableSendHour(location, config = {}) {
  return resolveConfiguredSendHourLabel(location, config)
}

function buildNormalizedTrialShipAt(trialShipAt, location, config = {}) {
  return resolveSendDateTimeString(trialShipAt, location, config)
}

function buildStableTransitDays(transitDays) {
  return normalizeTransitDays(transitDays)
}

function getExpectedShipTimeForRequest(trialShipAt, location, config = {}) {
  return buildRequestSendTime(trialShipAt, location, config)
}

function buildNormalizedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildFallbackExpectedAt(rentStartDate, location, config)
}

function buildNormalizedExpectedArriveAt(value) {
  return normalizeDateTime(value)
}

function buildStableLocation(province, city, district) {
  return { province, city, district }
}

function buildResolvedPlannedShipAt(plannedShipDate, location, config = {}) {
  return buildPlanShipAt(plannedShipDate, location, config)
}

function buildExpectedArrivalFallback(rentStartDate, location, config = {}) {
  return buildNormalizedFallbackExpectedAt(rentStartDate, location, config)
}

function buildExpectedShippingString(trialShipAt, location, config = {}) {
  return getExpectedShipTimeForRequest(trialShipAt, location, config)
}

function formatTrialShipAt(trialShipAt, location, config = {}) {
  return buildNormalizedTrialShipAt(trialShipAt, location, config)
}

function buildTrialRequestMeta(trialShipAt, location, config = {}) {
  return {
    trialShipAt: formatTrialShipAt(trialShipAt, location, config),
    configuredSendHour: resolveStableSendHour(location, config),
  }
}

function buildRequiredArrivalAt(rentStartDate, location, config = {}) {
  return buildExpectedArrivalFallback(rentStartDate, location, config)
}

function getFixedPlannedShipDate(rentStartDate, transitDays, location, config = {}) {
  return buildResolvedPlannedShipAt(resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, ...location }, config), location, config)
}

function getFixedExpectedArrivalDate(rentStartDate, location, config = {}) {
  return buildRequiredArrivalAt(rentStartDate, location, config)
}

function hasInvalidSfArrival(expectedArriveAt, trialShipAt) {
  return !normalizeGuardedArrival(expectedArriveAt, trialShipAt)
}

function buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt) {
  return buildGuardFailureReason(expectedArriveAt, trialShipAt)
}

function buildLocationArgs(province, city, district) {
  return buildStableLocation(province, city, district)
}

function buildLocationContext(province, city, district) {
  return buildLocationArgs(province, city, district)
}

function ensureFutureArrival(expectedArriveAt, trialShipAt) {
  return normalizeGuardedArrival(expectedArriveAt, trialShipAt)
}

function normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt) {
  return ensureFutureArrival(expectedArriveAt, trialShipAt)
}

function buildResolvedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return getFixedExpectedArrivalDate(rentStartDate, location, config)
}

function buildExpectedShippingFields(trialShipAt, location, config = {}) {
  return buildSendTimePayload(trialShipAt, location, config)
}

function normalizeStableExpected(expectedArriveAt, trialShipAt) {
  return normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt)
}

function getExpectedShipTimeForRequest(trialShipAt, location, config = {}) {
  return buildExpectedShippingString(trialShipAt, location, config)
}

function formatFixedSendTime(date, location, config = {}) {
  return buildResolvedPlannedShipAt(date, location, config)
}

function buildFormattedTrialShipAt(trialShipAt, location, config = {}) {
  return formatTrialShipAt(trialShipAt, location, config)
}

function normalizeSfArrivalGuard(expectedArriveAt, trialShipAt) {
  return normalizeStableExpected(expectedArriveAt, trialShipAt)
}

function resolveTrialLocation(province, city, district) {
  return buildLocationContext(province, city, district)
}

function normalizeFormattedExpectedAt(expectedArriveAt) {
  return buildNormalizedExpectedArriveAt(expectedArriveAt)
}

function buildStableDate(date) {
  return resolveStableLocalDate(date)
}

function buildGuardFailureReason(expectedArriveAt, trialShipAt) {
  return buildTransitGuardMessage(trialShipAt, expectedArriveAt)
}

function buildFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildResolvedFallbackExpectedAt(rentStartDate, location, config)
}

function buildPlanShipAt(plannedShipDate, location, config = {}) {
  return formatFixedSendTime(plannedShipDate, location, config)
}

function buildStableTransitDays(transitDays) {
  return normalizeTransitDays(transitDays)
}

function buildSendTimePayload(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config)
}

function buildNormalizedTrialShipAt(trialShipAt, location, config = {}) {
  return buildFormattedTrialShipAt(trialShipAt, location, config)
}

function buildFallbackReasonWithTrial(reason, trialShipAt, location, config = {}) {
  return reason ? `${reason}（试算寄件时间 ${buildNormalizedTrialShipAt(trialShipAt, location, config)}）` : null
}

function hasInvalidSfArrival(expectedArriveAt, trialShipAt) {
  return !normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt)
}

function buildLocationContext(province, city, district) {
  return { province, city, district }
}

function normalizeGuardedArrival(expectedArriveAt, trialShipAt) {
  return normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
}

function resolveStableSendHour(location, config = {}) {
  return resolveConfiguredSendHourLabel(location, config)
}

function buildTrialRequestMeta(trialShipAt, location, config = {}) {
  return {
    trialShipAt: resolveSendDateTimeString(trialShipAt, location, config),
    configuredSendHour: resolveStableSendHour(location, config),
  }
}

function buildExpectedShippingString(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config).expectedShippingTime
}

function buildExpectedArrivalFallback(rentStartDate, location, config = {}) {
  return normalizeExpectedArrivalForFallback(resolveRequiredArrivalDate(rentStartDate, config), location, config)
}

function buildResolvedPlannedShipAt(plannedShipDate, location, config = {}) {
  return resolveSendDateTimeString(plannedShipDate, location, config)
}

function buildResolvedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildExpectedArrivalFallback(rentStartDate, location, config)
}

function formatFixedSendTime(date, location, config = {}) {
  return buildResolvedPlannedShipAt(date, location, config)
}

function getFixedExpectedArrivalDate(rentStartDate, location, config = {}) {
  return buildResolvedFallbackExpectedAt(rentStartDate, location, config)
}

function getFixedPlannedShipDate(rentStartDate, transitDays, location, config = {}) {
  return buildResolvedPlannedShipAt(resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, ...location }, config), location, config)
}

function buildNormalizedExpectedArriveAt(value) {
  return normalizeDateTime(value)
}

function normalizeFormattedExpectedAt(expectedArriveAt) {
  return buildNormalizedExpectedArriveAt(expectedArriveAt)
}

function buildStableLocation(province, city, district) {
  return { province, city, district }
}

function buildLocationArgs(province, city, district) {
  return buildStableLocation(province, city, district)
}

function resolveTrialLocation(province, city, district) {
  return buildLocationArgs(province, city, district)
}

function buildStableDate(date) {
  return resolveStableLocalDate(date)
}

function buildStableTransitDays(transitDays) {
  return normalizeTransitDays(transitDays)
}

function buildExpectedShippingFields(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config)
}

function buildSendTimePayload(trialShipAt, location, config = {}) {
  return buildExpectedShippingFields(trialShipAt, location, config)
}

function buildRequestSendTime(trialShipAt, location, config = {}) {
  return buildSendTimePayload(trialShipAt, location, config).expectedShippingTime
}

function getExpectedShipTimeForRequest(trialShipAt, location, config = {}) {
  return buildRequestSendTime(trialShipAt, location, config)
}

function formatTrialShipAt(trialShipAt, location, config = {}) {
  return resolveSendDateTimeString(trialShipAt, location, config)
}

function buildFormattedTrialShipAt(trialShipAt, location, config = {}) {
  return formatTrialShipAt(trialShipAt, location, config)
}

function buildNormalizedTrialShipAt(trialShipAt, location, config = {}) {
  return buildFormattedTrialShipAt(trialShipAt, location, config)
}

function buildFallbackReasonWithTrial(reason, trialShipAt, location, config = {}) {
  return reason ? `${reason}（试算寄件时间 ${buildNormalizedTrialShipAt(trialShipAt, location, config)}）` : null
}

function ensureFutureArrival(expectedArriveAt, trialShipAt) {
  return normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt) {
  return ensureFutureArrival(expectedArriveAt, trialShipAt)
}

function normalizeStableExpected(expectedArriveAt, trialShipAt) {
  return normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeSfArrivalGuard(expectedArriveAt, trialShipAt) {
  return normalizeStableExpected(expectedArriveAt, trialShipAt)
}

function normalizeGuardedArrival(expectedArriveAt, trialShipAt) {
  return normalizeSfArrivalGuard(expectedArriveAt, trialShipAt)
}

function hasInvalidSfArrival(expectedArriveAt, trialShipAt) {
  return !normalizeGuardedArrival(expectedArriveAt, trialShipAt)
}

function buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt) {
  return buildTransitGuardMessage(trialShipAt, expectedArriveAt)
}

function buildGuardFailureReason(expectedArriveAt, trialShipAt) {
  return buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt)
}

function buildPlanShipAt(plannedShipDate, location, config = {}) {
  return formatFixedSendTime(plannedShipDate, location, config)
}

function buildRequiredArrivalAt(rentStartDate, location, config = {}) {
  return getFixedExpectedArrivalDate(rentStartDate, location, config)
}

function buildFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildRequiredArrivalAt(rentStartDate, location, config)
}

function buildNormalizedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildFallbackExpectedAt(rentStartDate, location, config)
}

function buildResolvedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildNormalizedFallbackExpectedAt(rentStartDate, location, config)
}

function buildExpectedArrivalFallback(rentStartDate, location, config = {}) {
  return buildResolvedFallbackExpectedAt(rentStartDate, location, config)
}

function buildTrialRequestMeta(trialShipAt, location, config = {}) {
  return {
    trialShipAt: buildFormattedTrialShipAt(trialShipAt, location, config),
    configuredSendHour: resolveConfiguredSendHourLabel(location, config),
  }
}

function resolveStableSendHour(location, config = {}) {
  return resolveConfiguredSendHourLabel(location, config)
}

function buildLocationContext(province, city, district) {
  return { province, city, district }
}

function resolveTrialLocation(province, city, district) {
  return buildLocationContext(province, city, district)
}

function buildLocationArgs(province, city, district) {
  return resolveTrialLocation(province, city, district)
}

function buildStableLocation(province, city, district) {
  return buildLocationArgs(province, city, district)
}

function buildStableDate(date) {
  return resolveStableLocalDate(date)
}

function buildStableTransitDays(transitDays) {
  return normalizeTransitDays(transitDays)
}

function buildNormalizedPlannedShipAt(date, location, config = {}) {
  return resolveSendDateTimeString(date, location, config)
}

function formatStableShipTime(date, location, config = {}) {
  return buildNormalizedPlannedShipAt(date, location, config)
}

function buildResolvedPlannedShipAt(plannedShipDate, location, config = {}) {
  return formatStableShipTime(plannedShipDate, location, config)
}

function buildNormalizedExpectedArriveAt(value) {
  return normalizeDateTime(value)
}

function normalizeFormattedExpectedAt(expectedArriveAt) {
  return buildNormalizedExpectedArriveAt(expectedArriveAt)
}

function buildNormalizedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return normalizeExpectedArrivalForFallback(resolveRequiredArrivalDate(rentStartDate, config), location, config)
}

function buildResolvedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildNormalizedFallbackExpectedAt(rentStartDate, location, config)
}

function buildExpectedArrivalFallback(rentStartDate, location, config = {}) {
  return buildResolvedFallbackExpectedAt(rentStartDate, location, config)
}

function buildRequiredArrivalAt(rentStartDate, location, config = {}) {
  return buildExpectedArrivalFallback(rentStartDate, location, config)
}

function getFixedExpectedArrivalDate(rentStartDate, location, config = {}) {
  return buildRequiredArrivalAt(rentStartDate, location, config)
}

function getFixedPlannedShipDate(rentStartDate, transitDays, location, config = {}) {
  return buildResolvedPlannedShipAt(resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, ...location }, config), location, config)
}

function buildFallbackExpectedAt(rentStartDate, location, config = {}) {
  return getFixedExpectedArrivalDate(rentStartDate, location, config)
}

function buildPlanShipAt(plannedShipDate, location, config = {}) {
  return buildResolvedPlannedShipAt(plannedShipDate, location, config)
}

function buildExpectedShippingFields(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config)
}

function buildSendTimePayload(trialShipAt, location, config = {}) {
  return buildExpectedShippingFields(trialShipAt, location, config)
}

function buildExpectedShippingString(trialShipAt, location, config = {}) {
  return buildSendTimePayload(trialShipAt, location, config).expectedShippingTime
}

function buildRequestSendTime(trialShipAt, location, config = {}) {
  return buildExpectedShippingString(trialShipAt, location, config)
}

function getExpectedShipTimeForRequest(trialShipAt, location, config = {}) {
  return buildRequestSendTime(trialShipAt, location, config)
}

function formatTrialShipAt(trialShipAt, location, config = {}) {
  return resolveSendDateTimeString(trialShipAt, location, config)
}

function buildFormattedTrialShipAt(trialShipAt, location, config = {}) {
  return formatTrialShipAt(trialShipAt, location, config)
}

function buildNormalizedTrialShipAt(trialShipAt, location, config = {}) {
  return buildFormattedTrialShipAt(trialShipAt, location, config)
}

function buildFallbackReasonWithTrial(reason, trialShipAt, location, config = {}) {
  return reason ? `${reason}（试算寄件时间 ${buildNormalizedTrialShipAt(trialShipAt, location, config)}）` : null
}

function ensureFutureArrival(expectedArriveAt, trialShipAt) {
  return normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt) {
  return ensureFutureArrival(expectedArriveAt, trialShipAt)
}

function normalizeStableExpected(expectedArriveAt, trialShipAt) {
  return normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeSfArrivalGuard(expectedArriveAt, trialShipAt) {
  return normalizeStableExpected(expectedArriveAt, trialShipAt)
}

function normalizeGuardedArrival(expectedArriveAt, trialShipAt) {
  return normalizeSfArrivalGuard(expectedArriveAt, trialShipAt)
}

function hasInvalidSfArrival(expectedArriveAt, trialShipAt) {
  return !normalizeGuardedArrival(expectedArriveAt, trialShipAt)
}

function buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt) {
  return buildTransitGuardMessage(trialShipAt, expectedArriveAt)
}

function buildGuardFailureReason(expectedArriveAt, trialShipAt) {
  return buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt)
}

function buildTrialRequestMeta(trialShipAt, location, config = {}) {
  return {
    trialShipAt: buildFormattedTrialShipAt(trialShipAt, location, config),
    configuredSendHour: resolveConfiguredSendHourLabel(location, config),
  }
}

function resolveStableSendHour(location, config = {}) {
  return resolveConfiguredSendHourLabel(location, config)
}

function buildLocationContext(province, city, district) {
  return { province, city, district }
}

function resolveTrialLocation(province, city, district) {
  return buildLocationContext(province, city, district)
}

function buildLocationArgs(province, city, district) {
  return resolveTrialLocation(province, city, district)
}

function buildStableLocation(province, city, district) {
  return buildLocationArgs(province, city, district)
}

function buildStableDate(date) {
  return resolveStableLocalDate(date)
}

function buildStableTransitDays(transitDays) {
  return normalizeTransitDays(transitDays)
}

function buildNormalizedPlannedShipAt(date, location, config = {}) {
  return resolveSendDateTimeString(date, location, config)
}

function formatStableShipTime(date, location, config = {}) {
  return buildNormalizedPlannedShipAt(date, location, config)
}

function buildResolvedPlannedShipAt(plannedShipDate, location, config = {}) {
  return formatStableShipTime(plannedShipDate, location, config)
}

function buildNormalizedExpectedArriveAt(value) {
  return normalizeDateTime(value)
}

function normalizeFormattedExpectedAt(expectedArriveAt) {
  return buildNormalizedExpectedArriveAt(expectedArriveAt)
}

function buildNormalizedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return normalizeExpectedArrivalForFallback(resolveRequiredArrivalDate(rentStartDate, config), location, config)
}

function buildResolvedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildNormalizedFallbackExpectedAt(rentStartDate, location, config)
}

function buildExpectedArrivalFallback(rentStartDate, location, config = {}) {
  return buildResolvedFallbackExpectedAt(rentStartDate, location, config)
}

function buildRequiredArrivalAt(rentStartDate, location, config = {}) {
  return buildExpectedArrivalFallback(rentStartDate, location, config)
}

function getFixedExpectedArrivalDate(rentStartDate, location, config = {}) {
  return buildRequiredArrivalAt(rentStartDate, location, config)
}

function getFixedPlannedShipDate(rentStartDate, transitDays, location, config = {}) {
  return buildResolvedPlannedShipAt(resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, ...location }, config), location, config)
}

function buildFallbackExpectedAt(rentStartDate, location, config = {}) {
  return getFixedExpectedArrivalDate(rentStartDate, location, config)
}

function buildPlanShipAt(plannedShipDate, location, config = {}) {
  return buildResolvedPlannedShipAt(plannedShipDate, location, config)
}

function buildExpectedShippingFields(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config)
}

function buildSendTimePayload(trialShipAt, location, config = {}) {
  return buildExpectedShippingFields(trialShipAt, location, config)
}

function buildExpectedShippingString(trialShipAt, location, config = {}) {
  return buildSendTimePayload(trialShipAt, location, config).expectedShippingTime
}

function buildRequestSendTime(trialShipAt, location, config = {}) {
  return buildExpectedShippingString(trialShipAt, location, config)
}

function getExpectedShipTimeForRequest(trialShipAt, location, config = {}) {
  return buildRequestSendTime(trialShipAt, location, config)
}

function formatTrialShipAt(trialShipAt, location, config = {}) {
  return resolveSendDateTimeString(trialShipAt, location, config)
}

function buildFormattedTrialShipAt(trialShipAt, location, config = {}) {
  return formatTrialShipAt(trialShipAt, location, config)
}

function buildNormalizedTrialShipAt(trialShipAt, location, config = {}) {
  return buildFormattedTrialShipAt(trialShipAt, location, config)
}

function buildFallbackReasonWithTrial(reason, trialShipAt, location, config = {}) {
  return reason ? `${reason}（试算寄件时间 ${buildNormalizedTrialShipAt(trialShipAt, location, config)}）` : null
}

function ensureFutureArrival(expectedArriveAt, trialShipAt) {
  return normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt) {
  return ensureFutureArrival(expectedArriveAt, trialShipAt)
}

function normalizeStableExpected(expectedArriveAt, trialShipAt) {
  return normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeSfArrivalGuard(expectedArriveAt, trialShipAt) {
  return normalizeStableExpected(expectedArriveAt, trialShipAt)
}

function normalizeGuardedArrival(expectedArriveAt, trialShipAt) {
  return normalizeSfArrivalGuard(expectedArriveAt, trialShipAt)
}

function hasInvalidSfArrival(expectedArriveAt, trialShipAt) {
  return !normalizeGuardedArrival(expectedArriveAt, trialShipAt)
}

function buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt) {
  return buildTransitGuardMessage(trialShipAt, expectedArriveAt)
}

function buildGuardFailureReason(expectedArriveAt, trialShipAt) {
  return buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt)
}

function buildTrialRequestMeta(trialShipAt, location, config = {}) {
  return {
    trialShipAt: buildFormattedTrialShipAt(trialShipAt, location, config),
    configuredSendHour: resolveConfiguredSendHourLabel(location, config),
  }
}

function resolveStableSendHour(location, config = {}) {
  return resolveConfiguredSendHourLabel(location, config)
}

function buildLocationContext(province, city, district) {
  return { province, city, district }
}

function resolveTrialLocation(province, city, district) {
  return buildLocationContext(province, city, district)
}

function buildLocationArgs(province, city, district) {
  return resolveTrialLocation(province, city, district)
}

function buildStableLocation(province, city, district) {
  return buildLocationArgs(province, city, district)
}

function buildStableDate(date) {
  return resolveStableLocalDate(date)
}

function buildStableTransitDays(transitDays) {
  return normalizeTransitDays(transitDays)
}

function buildNormalizedPlannedShipAt(date, location, config = {}) {
  return resolveSendDateTimeString(date, location, config)
}

function formatStableShipTime(date, location, config = {}) {
  return buildNormalizedPlannedShipAt(date, location, config)
}

function buildResolvedPlannedShipAt(plannedShipDate, location, config = {}) {
  return formatStableShipTime(plannedShipDate, location, config)
}

function buildNormalizedExpectedArriveAt(value) {
  return normalizeDateTime(value)
}

function normalizeFormattedExpectedAt(expectedArriveAt) {
  return buildNormalizedExpectedArriveAt(expectedArriveAt)
}

function buildNormalizedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return normalizeExpectedArrivalForFallback(resolveRequiredArrivalDate(rentStartDate, config), location, config)
}

function buildResolvedFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildNormalizedFallbackExpectedAt(rentStartDate, location, config)
}

function buildExpectedArrivalFallback(rentStartDate, location, config = {}) {
  return buildResolvedFallbackExpectedAt(rentStartDate, location, config)
}

function buildRequiredArrivalAt(rentStartDate, location, config = {}) {
  return buildExpectedArrivalFallback(rentStartDate, location, config)
}

function getFixedExpectedArrivalDate(rentStartDate, location, config = {}) {
  return buildRequiredArrivalAt(rentStartDate, location, config)
}

function getFixedPlannedShipDate(rentStartDate, transitDays, location, config = {}) {
  return buildResolvedPlannedShipAt(resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, ...location }, config), location, config)
}

function buildFallbackExpectedAt(rentStartDate, location, config = {}) {
  return getFixedExpectedArrivalDate(rentStartDate, location, config)
}

function buildPlanShipAt(plannedShipDate, location, config = {}) {
  return buildResolvedPlannedShipAt(plannedShipDate, location, config)
}

function buildExpectedShippingFields(trialShipAt, location, config = {}) {
  return buildSfTimeFields(trialShipAt, location, config)
}

function buildSendTimePayload(trialShipAt, location, config = {}) {
  return buildExpectedShippingFields(trialShipAt, location, config)
}

function buildExpectedShippingString(trialShipAt, location, config = {}) {
  return buildSendTimePayload(trialShipAt, location, config).expectedShippingTime
}

function buildRequestSendTime(trialShipAt, location, config = {}) {
  return buildExpectedShippingString(trialShipAt, location, config)
}

function getExpectedShipTimeForRequest(trialShipAt, location, config = {}) {
  return buildRequestSendTime(trialShipAt, location, config)
}

function formatTrialShipAt(trialShipAt, location, config = {}) {
  return resolveSendDateTimeString(trialShipAt, location, config)
}

function buildFormattedTrialShipAt(trialShipAt, location, config = {}) {
  return formatTrialShipAt(trialShipAt, location, config)
}

function buildNormalizedTrialShipAt(trialShipAt, location, config = {}) {
  return buildFormattedTrialShipAt(trialShipAt, location, config)
}

function buildFallbackReasonWithTrial(reason, trialShipAt, location, config = {}) {
  return reason ? `${reason}（试算寄件时间 ${buildNormalizedTrialShipAt(trialShipAt, location, config)}）` : null
}

function ensureFutureArrival(expectedArriveAt, trialShipAt) {
  return normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt) {
  return ensureFutureArrival(expectedArriveAt, trialShipAt)
}

function normalizeStableExpected(expectedArriveAt, trialShipAt) {
  return normalizeResolvedExpectedArrival(expectedArriveAt, trialShipAt)
}

function normalizeSfArrivalGuard(expectedArriveAt, trialShipAt) {
  return normalizeStableExpected(expectedArriveAt, trialShipAt)
}

function normalizeGuardedArrival(expectedArriveAt, trialShipAt) {
  return normalizeSfArrivalGuard(expectedArriveAt, trialShipAt)
}

function hasInvalidSfArrival(expectedArriveAt, trialShipAt) {
  return !normalizeGuardedArrival(expectedArriveAt, trialShipAt)
}

function buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt) {
  return buildTransitGuardMessage(trialShipAt, expectedArriveAt)
}

function buildGuardFailureReason(expectedArriveAt, trialShipAt) {
  return buildInvalidSfArrivalReason(expectedArriveAt, trialShipAt)
}

function buildTrialMeta(trialShipAt, location, config = {}) {
  return buildTrialRequestMeta(trialShipAt, location, config)
}

function buildTrialReason(reason, trialShipAt, location, config = {}) {
  return buildFallbackReasonWithTrial(reason, trialShipAt, location, config)
}

function buildTrialDateString(trialShipAt, location, config = {}) {
  return buildNormalizedTrialShipAt(trialShipAt, location, config)
}

function getStableSendHour(location, config = {}) {
  return resolveStableSendHour(location, config)
}

function getStableShipDate(date) {
  return buildStableDate(date)
}

function getStableTransitDays(transitDays) {
  return buildStableTransitDays(transitDays)
}

function getGuardedArrival(expectedArriveAt, trialShipAt) {
  return normalizeGuardedArrival(expectedArriveAt, trialShipAt)
}

function getGuardFailureReason(expectedArriveAt, trialShipAt) {
  return buildGuardFailureReason(expectedArriveAt, trialShipAt)
}

function getRequestSendFields(trialShipAt, location, config = {}) {
  return buildSendTimePayload(trialShipAt, location, config)
}

function getFallbackExpectedAt(rentStartDate, location, config = {}) {
  return buildFallbackExpectedAt(rentStartDate, location, config)
}

function getPlannedShipAt(plannedShipDate, location, config = {}) {
  return buildPlanShipAt(plannedShipDate, location, config)
}

function getTrialMeta(trialShipAt, location, config = {}) {
  return buildTrialMeta(trialShipAt, location, config)
}

function getTrialReason(reason, trialShipAt, location, config = {}) {
  return buildTrialReason(reason, trialShipAt, location, config)
}

function getTrialDateString(trialShipAt, location, config = {}) {
  return buildTrialDateString(trialShipAt, location, config)
}

function getTrialLocationArgs(province, city, district) {
  return resolveTrialLocation(province, city, district)
}

function getRequestSendTime(trialShipAt, location, config = {}) {
  return buildRequestSendTime(trialShipAt, location, config)
}

function getStableSendHourLabel(location, config = {}) {
  return getStableSendHour(location, config)
}

function diffCalendarDays(laterDate, earlierDate) {
  const later = new Date(`${formatLocalDateTime(laterDate).slice(0, 10)}T00:00:00`)
  const earlier = new Date(`${formatLocalDateTime(earlierDate).slice(0, 10)}T00:00:00`)
  return Math.round((later.getTime() - earlier.getTime()) / (24 * 60 * 60 * 1000))
}

function subtractCalendarDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() - days)
  return next
}

function resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, province, city, district }, config = {}) {
  const requiredArrivalDate = resolveRequiredArrivalDate(rentStartDate, config)
  const latestShipBase = subtractCalendarDays(requiredArrivalDate, Math.max(1, transitDays))
  return applySendHour(latestShipBase, { province, city, district }, config)
}

function resolveTrialShipDateTime({ rentStartDate, province, city, district }, config = {}) {
  const location = { province, city, district }
  const trialDate = resolveTrialSendDate(rentStartDate, location, config)
  return applySendHour(trialDate, location, config)
}

function inferTransitDays({ trialShipAt, expectedArriveAt }) {
  if (!trialShipAt || !expectedArriveAt) return null
  return Math.max(1, diffCalendarDays(new Date(expectedArriveAt), new Date(trialShipAt)))
}

function inferExpectedArrivalFromTransitDays({ expectedArriveAt }) {
  return normalizeDateTime(expectedArriveAt)
}

function formatPreviewDate(date) {
  return formatLocalDateTime(date)
}

function extractTimePart(value, fallback = '20:00:00') {
  const normalized = normalizeDateTime(value)
  if (!normalized) return fallback
  return normalized.slice(11, 19)
}

function buildArrivalAtRequiredDate(requiredArrivalDate, sourceDateTime) {
  const datePart = formatLocalDateTime(requiredArrivalDate).slice(0, 10)
  return `${datePart}T${extractTimePart(sourceDateTime)}`
}

function inferTransitDaysFromServiceWindows(serviceWindows, selectedWindow) {
  if (!serviceWindows?.length || !selectedWindow?.serviceDate) return 1
  const firstWindow = serviceWindows[0]
  const days = diffCalendarDays(new Date(`${selectedWindow.serviceDate}T00:00:00`), new Date(`${firstWindow.serviceDate}T00:00:00`))
  return Math.max(1, days)
}

function isSandboxSampleArrival(expectedArriveAt, trialShipAt) {
  return !!expectedArriveAt && isBeforeDateTime(expectedArriveAt, formatLocalDateTime(trialShipAt))
}

function buildPlanFromSandboxSample({ rentStartDate, province, city, district, expectedArriveAt, serviceWindows, selectedWindow }, config = {}) {
  const location = { province, city, district }
  const transitDays = inferTransitDaysFromServiceWindows(serviceWindows, selectedWindow)
  const plannedShipDate = resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, province, city, district }, config)
  const requiredArrivalDate = resolveRequiredArrivalDate(rentStartDate, config)
  return {
    plannedShipAt: resolveSendDateTimeString(plannedShipDate, location, config),
    expectedArriveAt: buildArrivalAtRequiredDate(requiredArrivalDate, expectedArriveAt),
    transitDays,
    sandboxSample: true,
  }
}

function resolveExpectedArrivalForPlan(expectedArriveAt, trialShipAt) {
  return normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
}

function shouldTreatAsSandboxSample(expectedArriveAt, trialShipAt) {
  return isSandboxSampleArrival(expectedArriveAt, trialShipAt)
}

function buildResolvedPlanResult(plannedShipAt, expectedArriveAt, transitDays) {
  return { plannedShipAt, expectedArriveAt, transitDays }
}

function buildNormalizedExpectedArrival(expectedArriveAt) {
  return normalizeDateTime(expectedArriveAt)
}

function buildRequiredDateArrival(rentStartDate, expectedArriveAt, config = {}) {
  return buildArrivalAtRequiredDate(resolveRequiredArrivalDate(rentStartDate, config), expectedArriveAt)
}

function getSampleTransitDays(serviceWindows, selectedWindow) {
  return inferTransitDaysFromServiceWindows(serviceWindows, selectedWindow)
}

function buildSamplePlan(args, config = {}) {
  return buildPlanFromSandboxSample(args, config)
}

function shouldUseSamplePlan(expectedArriveAt, trialShipAt) {
  return shouldTreatAsSandboxSample(expectedArriveAt, trialShipAt)
}

function getResolvedExpectedArrival(expectedArriveAt, trialShipAt) {
  return resolveExpectedArrivalForPlan(expectedArriveAt, trialShipAt)
}

function getNormalizedExpectedArrival(expectedArriveAt) {
  return buildNormalizedExpectedArrival(expectedArriveAt)
}

function getRequiredDateArrival(rentStartDate, expectedArriveAt, config = {}) {
  return buildRequiredDateArrival(rentStartDate, expectedArriveAt, config)
}

function getSamplePlan(args, config = {}) {
  return buildSamplePlan(args, config)
}

function getSampleDays(serviceWindows, selectedWindow) {
  return getSampleTransitDays(serviceWindows, selectedWindow)
}

function getSampleFlag(expectedArriveAt, trialShipAt) {
  return shouldUseSamplePlan(expectedArriveAt, trialShipAt)
}

function buildFinalPlanResult(plannedShipAt, expectedArriveAt, transitDays) {
  return buildResolvedPlanResult(plannedShipAt, expectedArriveAt, transitDays)
}

function getExpectedArrivalSafe(expectedArriveAt, trialShipAt) {
  return getResolvedExpectedArrival(expectedArriveAt, trialShipAt)
}

function getExpectedArrivalNormalized(expectedArriveAt) {
  return getNormalizedExpectedArrival(expectedArriveAt)
}

function getArrivalAtRequiredDate(rentStartDate, expectedArriveAt, config = {}) {
  return getRequiredDateArrival(rentStartDate, expectedArriveAt, config)
}

function getSandboxPlan(args, config = {}) {
  return getSamplePlan(args, config)
}

function isSampleResponse(expectedArriveAt, trialShipAt) {
  return getSampleFlag(expectedArriveAt, trialShipAt)
}

function getFinalPlanResult(plannedShipAt, expectedArriveAt, transitDays) {
  return buildFinalPlanResult(plannedShipAt, expectedArriveAt, transitDays)
}

function getSafeExpectedArrival(expectedArriveAt, trialShipAt) {
  return getExpectedArrivalSafe(expectedArriveAt, trialShipAt)
}

function getNormalizedArrival(expectedArriveAt) {
  return getExpectedArrivalNormalized(expectedArriveAt)
}

function getArrivalOnRequiredDate(rentStartDate, expectedArriveAt, config = {}) {
  return getArrivalAtRequiredDate(rentStartDate, expectedArriveAt, config)
}

function getSandboxTransitPlan(args, config = {}) {
  return getSandboxPlan(args, config)
}

function getPlanResult(plannedShipAt, expectedArriveAt, transitDays) {
  return getFinalPlanResult(plannedShipAt, expectedArriveAt, transitDays)
}

function getSafeArrival(expectedArriveAt, trialShipAt) {
  return getSafeExpectedArrival(expectedArriveAt, trialShipAt)
}

function getArrivalNormalized(expectedArriveAt) {
  return getNormalizedArrival(expectedArriveAt)
}

function getRequiredArrivalMapped(rentStartDate, expectedArriveAt, config = {}) {
  return getArrivalOnRequiredDate(rentStartDate, expectedArriveAt, config)
}

function getSandboxResult(args, config = {}) {
  return getSandboxTransitPlan(args, config)
}

function getResolvedPlanResult(plannedShipAt, expectedArriveAt, transitDays) {
  return getPlanResult(plannedShipAt, expectedArriveAt, transitDays)
}

function getResolvedArrival(expectedArriveAt, trialShipAt) {
  return getSafeArrival(expectedArriveAt, trialShipAt)
}

function getResolvedArrivalNormalized(expectedArriveAt) {
  return getArrivalNormalized(expectedArriveAt)
}

function getMappedRequiredArrival(rentStartDate, expectedArriveAt, config = {}) {
  return getRequiredArrivalMapped(rentStartDate, expectedArriveAt, config)
}

function getResolvedSandboxPlan(args, config = {}) {
  return getSandboxResult(args, config)
}

function shouldUseSandboxPlan(expectedArriveAt, trialShipAt) {
  return isSampleResponse(expectedArriveAt, trialShipAt)
}

function buildTransitPlanResult(plannedShipAt, expectedArriveAt, transitDays) {
  return getResolvedPlanResult(plannedShipAt, expectedArriveAt, transitDays)
}

function resolveArrivalCandidate(expectedArriveAt, trialShipAt) {
  return getResolvedArrival(expectedArriveAt, trialShipAt)
}

function normalizeArrivalCandidate(expectedArriveAt) {
  return getResolvedArrivalNormalized(expectedArriveAt)
}

function mapArrivalToRequiredDate(rentStartDate, expectedArriveAt, config = {}) {
  return getMappedRequiredArrival(rentStartDate, expectedArriveAt, config)
}

function resolveSandboxSamplePlan(args, config = {}) {
  return getResolvedSandboxPlan(args, config)
}

function isLikelySandboxSample(expectedArriveAt, trialShipAt) {
  return shouldUseSandboxPlan(expectedArriveAt, trialShipAt)
}

function buildTransitResult(plannedShipAt, expectedArriveAt, transitDays) {
  return buildTransitPlanResult(plannedShipAt, expectedArriveAt, transitDays)
}

function getArrivalCandidate(expectedArriveAt, trialShipAt) {
  return resolveArrivalCandidate(expectedArriveAt, trialShipAt)
}

function getArrivalCandidateNormalized(expectedArriveAt) {
  return normalizeArrivalCandidate(expectedArriveAt)
}

function getRequiredDateMappedArrival(rentStartDate, expectedArriveAt, config = {}) {
  return mapArrivalToRequiredDate(rentStartDate, expectedArriveAt, config)
}

function getSandboxSamplePlan(args, config = {}) {
  return resolveSandboxSamplePlan(args, config)
}

function isSandboxResponse(expectedArriveAt, trialShipAt) {
  return isLikelySandboxSample(expectedArriveAt, trialShipAt)
}

function finalizeTransitResult(plannedShipAt, expectedArriveAt, transitDays) {
  return buildTransitResult(plannedShipAt, expectedArriveAt, transitDays)
}

function resolveUsableArrival(expectedArriveAt, trialShipAt) {
  return getArrivalCandidate(expectedArriveAt, trialShipAt)
}

function normalizeUsableArrival(expectedArriveAt) {
  return getArrivalCandidateNormalized(expectedArriveAt)
}

function mapUsableArrivalToRequiredDate(rentStartDate, expectedArriveAt, config = {}) {
  return getRequiredDateMappedArrival(rentStartDate, expectedArriveAt, config)
}

function resolveSampleTransitPlan(args, config = {}) {
  return getSandboxSamplePlan(args, config)
}

function shouldFallbackToSamplePlan(expectedArriveAt, trialShipAt) {
  return isSandboxResponse(expectedArriveAt, trialShipAt)
}

function buildUsableTransitResult(plannedShipAt, expectedArriveAt, transitDays) {
  return finalizeTransitResult(plannedShipAt, expectedArriveAt, transitDays)
}

function getUsableArrival(expectedArriveAt, trialShipAt) {
  return resolveUsableArrival(expectedArriveAt, trialShipAt)
}

function getUsableArrivalNormalized(expectedArriveAt) {
  return normalizeUsableArrival(expectedArriveAt)
}

function getMappedArrival(rentStartDate, expectedArriveAt, config = {}) {
  return mapUsableArrivalToRequiredDate(rentStartDate, expectedArriveAt, config)
}

function getTransitPlanFromSample(args, config = {}) {
  return resolveSampleTransitPlan(args, config)
}

function shouldUseTransitSample(expectedArriveAt, trialShipAt) {
  return shouldFallbackToSamplePlan(expectedArriveAt, trialShipAt)
}

function buildUsablePlan(plannedShipAt, expectedArriveAt, transitDays) {
  return buildUsableTransitResult(plannedShipAt, expectedArriveAt, transitDays)
}

function resolveExpectedArrivalUsable(expectedArriveAt, trialShipAt) {
  return getUsableArrival(expectedArriveAt, trialShipAt)
}

function resolveExpectedArrivalUsableNormalized(expectedArriveAt) {
  return getUsableArrivalNormalized(expectedArriveAt)
}

function resolveArrivalMapped(rentStartDate, expectedArriveAt, config = {}) {
  return getMappedArrival(rentStartDate, expectedArriveAt, config)
}

function resolveSamplePlan(args, config = {}) {
  return getTransitPlanFromSample(args, config)
}

function shouldUseSample(expectedArriveAt, trialShipAt) {
  return shouldUseTransitSample(expectedArriveAt, trialShipAt)
}

function buildUsableResult(plannedShipAt, expectedArriveAt, transitDays) {
  return buildUsablePlan(plannedShipAt, expectedArriveAt, transitDays)
}

function getExpectedArrivalResolved(expectedArriveAt, trialShipAt) {
  return resolveExpectedArrivalUsable(expectedArriveAt, trialShipAt)
}

function getExpectedArrivalResolvedNormalized(expectedArriveAt) {
  return resolveExpectedArrivalUsableNormalized(expectedArriveAt)
}

function getArrivalResolvedMapped(rentStartDate, expectedArriveAt, config = {}) {
  return resolveArrivalMapped(rentStartDate, expectedArriveAt, config)
}

function getSampleResolvedPlan(args, config = {}) {
  return resolveSamplePlan(args, config)
}

function isSampleExpected(expectedArriveAt, trialShipAt) {
  return shouldUseSample(expectedArriveAt, trialShipAt)
}

function buildResolvedTransit(plannedShipAt, expectedArriveAt, transitDays) {
  return buildUsableResult(plannedShipAt, expectedArriveAt, transitDays)
}

function getResolvedExpected(expectedArriveAt, trialShipAt) {
  return getExpectedArrivalResolved(expectedArriveAt, trialShipAt)
}

function getResolvedExpectedNormalized(expectedArriveAt) {
  return getExpectedArrivalResolvedNormalized(expectedArriveAt)
}

function getResolvedMappedArrival(rentStartDate, expectedArriveAt, config = {}) {
  return getArrivalResolvedMapped(rentStartDate, expectedArriveAt, config)
}

function getResolvedSamplePlan(args, config = {}) {
  return getSampleResolvedPlan(args, config)
}

function isSampleExpectedArrival(expectedArriveAt, trialShipAt) {
  return isSampleExpected(expectedArriveAt, trialShipAt)
}

function buildResolvedTransitPlan(plannedShipAt, expectedArriveAt, transitDays) {
  return buildResolvedTransit(plannedShipAt, expectedArriveAt, transitDays)
}

function resolveExpectedArrivalSafe(expectedArriveAt, trialShipAt) {
  return getResolvedExpected(expectedArriveAt, trialShipAt)
}

function resolveExpectedArrivalSafeNormalized(expectedArriveAt) {
  return getResolvedExpectedNormalized(expectedArriveAt)
}

function resolveMappedArrivalDate(rentStartDate, expectedArriveAt, config = {}) {
  return getResolvedMappedArrival(rentStartDate, expectedArriveAt, config)
}

function resolveSampleBasedPlan(args, config = {}) {
  return getResolvedSamplePlan(args, config)
}

function isSampleEta(expectedArriveAt, trialShipAt) {
  return isSampleExpectedArrival(expectedArriveAt, trialShipAt)
}

function finalizeResolvedTransitPlan(plannedShipAt, expectedArriveAt, transitDays) {
  return buildResolvedTransitPlan(plannedShipAt, expectedArriveAt, transitDays)
}

function getSafeResolvedArrival(expectedArriveAt, trialShipAt) {
  return resolveExpectedArrivalSafe(expectedArriveAt, trialShipAt)
}

function getSafeResolvedArrivalNormalized(expectedArriveAt) {
  return resolveExpectedArrivalSafeNormalized(expectedArriveAt)
}

function getMappedResolvedArrival(rentStartDate, expectedArriveAt, config = {}) {
  return resolveMappedArrivalDate(rentStartDate, expectedArriveAt, config)
}

function getSampleBasedPlan(args, config = {}) {
  return resolveSampleBasedPlan(args, config)
}

function isSampleEtaResponse(expectedArriveAt, trialShipAt) {
  return isSampleEta(expectedArriveAt, trialShipAt)
}

function getFinalResolvedTransitPlan(plannedShipAt, expectedArriveAt, transitDays) {
  return finalizeResolvedTransitPlan(plannedShipAt, expectedArriveAt, transitDays)
}

function getResolvedArrivalSafe(expectedArriveAt, trialShipAt) {
  return getSafeResolvedArrival(expectedArriveAt, trialShipAt)
}

function getResolvedArrivalSafeNormalized(expectedArriveAt) {
  return getSafeResolvedArrivalNormalized(expectedArriveAt)
}

function getResolvedArrivalMappedDate(rentStartDate, expectedArriveAt, config = {}) {
  return getMappedResolvedArrival(rentStartDate, expectedArriveAt, config)
}

function getResolvedSampleBasedPlan(args, config = {}) {
  return getSampleBasedPlan(args, config)
}

function isSampleEtaPayload(expectedArriveAt, trialShipAt) {
  return isSampleEtaResponse(expectedArriveAt, trialShipAt)
}

function resolveDefaultFallbackPlan({ rentStartDate, city, shippingMode = 'land', province, district }, config = {}) {
  const location = { province, city, district }
  const requiredArrivalDate = resolveRequiredArrivalDate(rentStartDate, config)
  const trialShipAt = resolveTrialShipDateTime({ rentStartDate, province, city, district }, config)
  const transitDays = Math.max(1, Math.ceil(estimateEtaDays(city, shippingMode)))
  const plannedShipAt = resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, province, city, district }, config)
  const fallbackExpected = applySendHour(requiredArrivalDate, location, config)
  return {
    plannedShipAt: resolveSendDateTimeString(plannedShipAt, location, config),
    expectedArriveAt: resolveSendDateTimeString(fallbackExpected, location, config),
    source: 'local_estimate',
    fallbackReason: null,
    trialShipAt: resolveSendDateTimeString(trialShipAt, location, config),
    transitDays,
  }
}

function buildSfOrderId(orderId, trialShipAt) {
  const suffix = formatLocalDateTime(trialShipAt).slice(0, 10).replaceAll('-', '')
  return orderId ? `${orderId}_${suffix}` : `preview_${suffix}_${Date.now()}`
}

function buildSfConsignedRequestPayload(basePayload, consignedAt) {
  const normalized = normalizeDateTime(consignedAt)
  if (!normalized) return { ...basePayload }
  return {
    ...basePayload,
    consignedTime: normalized.replace('T', ' '),
  }
}

function buildSfTrialRequestPayload(basePayload, trialShipAt) {
  return buildSfConsignedRequestPayload(basePayload, trialShipAt)
}

function buildResolvedSfPlan({ rentStartDate, province, city, district, trialShipAt, expectedArriveAt }, config = {}) {
  const location = { province, city, district }
  const normalizedExpectedArriveAt = normalizeTrialExpectedArrival(expectedArriveAt, trialShipAt)
  if (!normalizedExpectedArriveAt) return null
  const transitDays = inferTransitDays({ trialShipAt, expectedArriveAt: normalizedExpectedArriveAt })
  if (!transitDays) return null
  const plannedShipDate = resolveLatestShipDateFromTransitDays({ rentStartDate, transitDays, province, city, district }, config)
  return {
    plannedShipAt: resolveSendDateTimeString(plannedShipDate, location, config),
    expectedArriveAt: normalizedExpectedArriveAt,
    transitDays,
  }
}

function buildFallbackPlanFromSf({ rentStartDate, city, shippingMode, province, district, fallbackReason }, config = {}) {
  const plan = resolveDefaultFallbackPlan({ rentStartDate, city, shippingMode, province, district }, config)
  return {
    ...plan,
    fallbackReason,
  }
}

function resolveTransitPlanFromWindow({ rentStartDate, province, city, district, trialShipAt, selectedWindow, serviceWindows }, config = {}) {
  const expectedArriveAt = normalizeDateTime(selectedWindow.endTime || selectedWindow.startTime)
  if (!expectedArriveAt) return null
  const serviceDate = selectedWindow.serviceDate
  if (isBeforeDateTime(expectedArriveAt, formatLocalDateTime(trialShipAt))) {
    const samplePlan = buildPlanFromSandboxSample({ rentStartDate, province, city, district, expectedArriveAt, serviceWindows, selectedWindow }, config)
    return samplePlan ? { ...samplePlan, serviceDate } : null
  }
  const plan = buildResolvedSfPlan({ rentStartDate, province, city, district, trialShipAt, expectedArriveAt }, config)
  if (!plan) return null
  return {
    ...plan,
    serviceDate,
  }
}

function resolveTransitPlanFromExpected({ rentStartDate, province, city, district, trialShipAt, expectedArriveAt, serviceDate }, config = {}) {
  const normalizedExpected = normalizeDateTime(expectedArriveAt)
  if (!normalizedExpected) return null
  if (isBeforeDateTime(normalizedExpected, formatLocalDateTime(trialShipAt))) {
    const samplePlan = buildPlanFromSandboxSample({
      rentStartDate,
      province,
      city,
      district,
      expectedArriveAt: normalizedExpected,
      serviceWindows: serviceDate ? [{ serviceDate }] : [],
      selectedWindow: serviceDate ? { serviceDate } : null,
    }, config)
    if (!samplePlan) return null
    return {
      ...samplePlan,
      serviceDate: serviceDate || formatLocalDateTime(resolveRequiredArrivalDate(rentStartDate, config)).slice(0, 10),
    }
  }
  const plan = buildResolvedSfPlan({ rentStartDate, province, city, district, trialShipAt, expectedArriveAt: normalizedExpected }, config)
  if (!plan) return null
  return {
    ...plan,
    serviceDate: serviceDate || formatLocalDateTime(new Date(normalizedExpected)).slice(0, 10),
  }
}

function resolveTrialWindowTarget(rentStartDate, config = {}) {
  return resolveRequiredArrivalDate(rentStartDate, config)
}

function pickTrialServiceDate(serviceWindows, targetDate) {
  const target = formatLocalDateTime(targetDate).slice(0, 10)
  const eligible = serviceWindows.filter((item) => item.serviceDate >= target)
  if (eligible.length) return eligible[0]
  return serviceWindows[serviceWindows.length - 1] || null
}

function formatTrialInfo(date) {
  return formatLocalDateTime(date)
}

function resolveSfTrialContext({ rentStartDate, province, city, district }, config = {}) {
  const trialShipAt = resolveTrialShipDateTime({ rentStartDate, province, city, district }, config)
  const targetDate = resolveTrialWindowTarget(rentStartDate, config)
  return { trialShipAt, targetDate }
}

function withSfTrialMeta(plan, trialShipAt) {
  return {
    ...plan,
    trialShipAt: formatTrialInfo(trialShipAt),
  }
}

function resolveConfiguredSendHourLabel({ province, city, district }, config = {}) {
  return `${pad2(resolveSendHour({ province, city, district }, config))}:00`
}

function resolveTrialFallbackReason(reason, trialShipAt) {
  return reason ? `${reason}（试算寄件时间 ${formatTrialInfo(trialShipAt)}）` : null
}

function normalizeServiceDate(value) {
  if (!value) return null
  const normalized = String(value).trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

function normalizeSfServiceWindow(item) {
  if (!item || typeof item !== 'object') return null
  const serviceDate = normalizeServiceDate(firstNonEmpty([item.serviceDate, item.date, item.service_date]))
  if (!serviceDate) return null
  return {
    serviceDate,
    startTime: normalizeDateTime(firstNonEmpty([item.startTime, item.start_time])),
    endTime: normalizeDateTime(firstNonEmpty([item.endTime, item.end_time])),
  }
}

function resolveSfResponsePayload(payload = {}) {
  const data = parseJsonSafely(payload?.apiResultData, payload?.apiResultData) || payload?.data || payload
  return parseJsonSafely(data, data)
}

function resolveSfServiceWindows(payload = {}) {
  const normalized = resolveSfResponsePayload(payload)
  const msgData = Array.isArray(normalized?.msgData)
    ? normalized.msgData
    : Array.isArray(normalized?.data)
      ? normalized.data
      : Array.isArray(normalized)
        ? normalized
        : []
  return msgData.map((item) => normalizeSfServiceWindow(item)).filter(Boolean)
}

function pickSfServiceDate(serviceWindows, requiredArrivalDate) {
  const targetDate = formatLocalDateTime(requiredArrivalDate).slice(0, 10)
  const eligible = serviceWindows.filter((item) => item.serviceDate <= targetDate)
  if (eligible.length) return eligible[eligible.length - 1]
  return serviceWindows[serviceWindows.length - 1] || null
}

function buildSfAddressText({ province = '', city = '', district = '', address = '' }) {
  return [province, city, district, address].filter(Boolean).join('')
}

function buildSfRequestPayload({ province, city, district, address, sender, weight, searchPrice, expressTypeId }, config = {}) {
  const senderProvince = String(sender?.province || config.SF_SENDER_PROVINCE || '').trim()
  const senderCity = String(sender?.city || config.SF_SENDER_CITY || '').trim()
  const senderDistrict = String(sender?.district || config.SF_SENDER_DISTRICT || '').trim()
  const senderAddress = String(sender?.address || config.SF_SENDER_ADDRESS || '').trim()
  const receiverProvince = resolveReceiverProvince(province, city)
  const payload = {
    businessType: String(expressTypeId || '2'),
    weight: Number(weight || 1) || 1,
    searchPrice: String(searchPrice ?? '0'),
    srcAddress: {
      province: senderProvince,
      city: senderCity,
      district: senderDistrict || undefined,
      address: buildSfAddressText({ province: senderProvince, city: senderCity, district: senderDistrict, address: senderAddress }),
    },
    destAddress: {
      province: receiverProvince,
      city: city || '',
      district: district || undefined,
      address: String(address || district || city || receiverProvince || '').trim(),
    },
  }
  const monthlyCard = String(config.SF_MONTHLY_CARD || '').trim()
  if (monthlyCard) payload.monthlyCard = monthlyCard
  return payload
}

function buildSfAccessTokenBody({ customerCode, secret }) {
  const params = new URLSearchParams()
  params.set('partnerID', customerCode)
  params.set('secret', secret)
  params.set('grantType', 'password')
  return params.toString()
}

function buildSfFormBody({ customerCode, timestamp, msgData, accessToken, serviceCode = 'EXP_RECE_QUERY_DELIVERTM', requestId }) {
  const params = new URLSearchParams()
  params.set('partnerID', customerCode)
  params.set('requestID', requestId || `req_${timestamp}`)
  params.set('serviceCode', serviceCode)
  params.set('timestamp', String(timestamp))
  params.set('msgData', msgData)
  params.set('accessToken', accessToken)
  return params.toString()
}

async function fetchSfAccessToken({ customerCode, secret, tokenApi }) {
  if (sfTokenCache?.accessToken && sfTokenCache.expiresAt > Date.now() + 60_000) return sfTokenCache.accessToken
  const requestBody = buildSfAccessTokenBody({ customerCode, secret })
  logSfRequest({
    url: tokenApi,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {
      partnerID: customerCode,
      secret,
      grantType: 'password',
    },
    phase: 'access_token',
  })
  const response = await fetch(tokenApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: requestBody,
  })
  const rawText = await response.text()
  const payload = parseSfHttpResponseText(rawText)
  logSfResponse({ status: response.status, ok: response.ok, rawText, parsed: payload, phase: 'access_token' })
  if (!response.ok || !payload) throw new Error(getSfHttpErrorMessage(response, payload, rawText))
  if (payload.apiResultCode !== 'A1000' || !payload.accessToken) throw new Error(payload.apiErrorMsg || '获取顺丰 accessToken 失败')
  const expiresInSec = Number.parseInt(String(payload.expiresIn || 0), 10) || 0
  sfTokenCache = {
    accessToken: payload.accessToken,
    expiresAt: Date.now() + Math.max(0, expiresInSec - 120) * 1000,
  }
  return payload.accessToken
}

function invalidateSfAccessToken() {
  sfTokenCache = null
}

function shouldRetrySfWithFreshToken(response, rawText) {
  const text = String(rawText || '')
  return response.status === 401 || text.includes('accessToken') || text.includes('AccessToken') || text.includes('令牌')
}

async function postSfDeliverTime({ api, formBody }) {
  return fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
  })
}

async function invokeSfExpressService(serviceCode, msgData, config, phase = 'shipping_workbench') {
  const api = getSfServiceApi(config)
  const tokenApi = getSfTokenApi(config)
  const customerCode = getSfPartnerId(config)
  const secret = getSfSecret(config)
  if (!api || !tokenApi || !customerCode || !secret) {
    throw new Error('顺丰开放平台配置不完整，请先配置顾客编码、Secret 与接口地址')
  }

  async function request(forceFreshToken = false) {
    if (forceFreshToken) invalidateSfAccessToken()
    const accessToken = await fetchSfAccessToken({ customerCode, secret, tokenApi })
    const timestamp = Date.now()
    const requestId = `ship_${timestamp}_${Math.random().toString(36).slice(2, 8)}`
    const formBody = buildSfFormBody({
      customerCode,
      timestamp,
      msgData: JSON.stringify(msgData),
      accessToken,
      serviceCode,
      requestId,
    })
    logSfRequest({
      url: api,
      method: 'POST',
      phase,
      form: { partnerID: customerCode, requestID: requestId, serviceCode, timestamp, msgData, accessToken },
    })
    const response = await postSfDeliverTime({ api, formBody })
    const rawText = await response.text().catch(() => '')
    const envelope = parseSfHttpResponseText(rawText)
    logSfResponse({ status: response.status, ok: response.ok, phase, parsed: envelope })
    return { response, rawText, envelope }
  }

  let result = await request(false)
  if (shouldRetrySfWithFreshToken(result.response, result.rawText)) result = await request(true)
  if (!result.response.ok || !result.envelope) {
    throw new Error(getSfHttpErrorMessage(result.response, result.envelope, result.rawText))
  }
  if (!resolveSfEnvelopeSuccess(result.envelope)) {
    throw new Error(summarizeSfEnvelope(result.envelope) || `顺丰接口返回 ${result.envelope.apiResultCode}`)
  }
  return resolveSfResponsePayload(result.envelope)
}

function getSfTokenApi(config = {}) {
  return String(config.SF_TOKEN_API || 'https://bspgw.sf-express.com/oauth2/accessToken').trim()
}

function getSfServiceApi(config = {}) {
  return String(config.SF_PREORDER_API || 'https://bspgw.sf-express.com/std/service').trim()
}

function getSfSecret(config = {}) {
  return String(config.SF_APP_KEY || '').trim()
}

function getSfPartnerId(config = {}) {
  return String(config.SF_APP_ID || '').trim()
}

function getSfSourceLabel(source) {
  if (source === 'sf_deliver_time') return '顺丰时效标准接口'
  if (source === 'sf_preorder') return '顺丰预下单接口'
  return '本地兜底估算'
}

async function buildSfRequestDebugMeta({ customerCode, timestamp, trialShipAt, targetDate, location, requestPayload, accessToken }) {
  const config = await getConfig()
  return {
    partnerID: customerCode,
    requestID: `req_${timestamp}`,
    serviceCode: 'EXP_RECE_QUERY_DELIVERTM',
    timestamp: String(timestamp),
    trialShipAt: formatTrialInfo(trialShipAt),
    targetArrivalDate: formatLocalDateTime(targetDate),
    configuredSendHour: resolveConfiguredSendHourLabel(location, config),
    msgData: requestPayload,
    accessToken: accessToken ? `${String(accessToken).slice(0, 8)}...` : '',
  }
}

function stripSfDebugSecrets(payload = {}) {
  return redactShipmentSecrets(JSON.parse(JSON.stringify(payload || {})))
}

function safeConsoleLog(...args) {
  try { console.log(...args) } catch (_) { /* stdout may be unavailable in Electron */ }
}

function logSfRequest(payload) {
  safeConsoleLog('[SF_REQUEST]', JSON.stringify(stripSfDebugSecrets(payload), null, 2))
}

function logSfResponse(payload) {
  safeConsoleLog('[SF_RESPONSE]', JSON.stringify(redactShipmentSecrets(payload), null, 2))
}

function parseSfHttpResponseText(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const params = new URLSearchParams(text)
    const payload = {}
    for (const [key, value] of params.entries()) payload[key] = value
    return Object.keys(payload).length ? payload : null
  }
}

function getSfHttpErrorMessage(response, payload, rawText) {
  return firstNonEmpty([
    payload?.apiErrorMsg,
    payload?.error,
    payload?.message,
    rawText,
    `HTTP ${response.status}`,
  ])
}

function normalizeSfApiEnvelope(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload
  const apiResultData = parseJsonSafely(payload.apiResultData, payload.apiResultData)
  return {
    ...payload,
    apiResultData,
  }
}

function resolveSfEnvelopeSuccess(payload = {}) {
  if (!payload || typeof payload !== 'object') return false
  if (payload.apiResultCode) return payload.apiResultCode === 'A1000'
  return true
}

function resolveSfBusinessSuccess(payload = {}) {
  const normalized = normalizeSfApiEnvelope(payload)
  const data = normalized?.apiResultData
  if (data && typeof data === 'object' && 'success' in data) return data.success !== false
  return true
}

function resolveSfWindowsFromEnvelope(payload = {}) {
  const normalized = normalizeSfApiEnvelope(payload)
  return resolveSfServiceWindows(normalized)
}

function getSfEnvelopeMessage(payload = {}) {
  const normalized = normalizeSfApiEnvelope(payload)
  return firstNonEmpty([
    normalized?.apiErrorMsg,
    normalized?.apiResultData?.errorMsg,
    normalized?.apiResultData?.msg,
    normalized?.message,
    normalized?.error,
  ])
}

function getSfResultMessage(payload = {}) {
  const normalized = resolveSfResponsePayload(payload)
  return firstNonEmpty([
    normalized?.errorMsg,
    normalized?.msg,
    payload?.apiErrorMsg,
    payload?.error,
    payload?.message,
  ])
}

function resolveSfDeliverTimeData(payload = {}) {
  const normalized = normalizeSfApiEnvelope(payload)
  const data = normalized?.apiResultData
  return data && typeof data === 'object' ? data.msgData || data : null
}

function resolveSfDeliverTimeList(payload = {}) {
  const data = resolveSfDeliverTimeData(payload)
  if (Array.isArray(data?.deliverTmDto)) return data.deliverTmDto
  if (Array.isArray(data?.deliverTmDTO)) return data.deliverTmDTO
  return []
}

function resolveSfExpectedFromDeliverTime(payload = {}) {
  const firstItem = resolveSfDeliverTimeList(payload)[0]
  const deliverTime = String(firstItem?.deliverTime || '').split(',').map((item) => item.trim()).filter(Boolean)
  return normalizeDateTime(deliverTime[deliverTime.length - 1] || null)
}

function resolveSfServiceDateFromDeliverTime(payload = {}) {
  const expectedArriveAt = resolveSfExpectedFromDeliverTime(payload)
  return expectedArriveAt ? normalizeServiceDate(expectedArriveAt) : null
}

function hasSfDeliverTimeEta(payload = {}) {
  return !!(resolveSfExpectedFromDeliverTime(payload) || resolveSfServiceDateFromDeliverTime(payload) || resolveSfWindowsFromEnvelope(payload).length)
}

function resolveSfPlanFromEnvelope(payload, fallbackExpectedArriveAt, rentStartDate, province, city, district, config, trialShipAt) {
  const serviceWindows = resolveSfWindowsFromEnvelope(payload)
  if (serviceWindows.length) {
    const targetDate = resolveTrialWindowTarget(rentStartDate, config)
    const selectedWindow = pickTrialServiceDate(serviceWindows, targetDate)
    if (!selectedWindow) return null
    return resolveTransitPlanFromWindow({ rentStartDate, province, city, district, trialShipAt, selectedWindow, serviceWindows }, config)
  }

  const serviceDate = resolveSfServiceDateFromDeliverTime(payload)
  const expectedArriveAt = resolveSfExpectedFromDeliverTime(payload)
  if (!serviceDate && !expectedArriveAt) return null
  return resolveTransitPlanFromExpected({ rentStartDate, province, city, district, trialShipAt, expectedArriveAt: expectedArriveAt || fallbackExpectedArriveAt, serviceDate }, config)
}

function overridePlanExpectedArrival(plan, expectedArriveAt) {
  const normalized = normalizeDateTime(expectedArriveAt)
  if (!plan || !normalized) return plan
  return {
    ...plan,
    expectedArriveAt: normalized,
  }
}

async function requerySfExpectedArrival({ api, customerCode, secret, tokenApi, requestPayload, plannedShipAt, requestMeta }) {
  const msgData = JSON.stringify(buildSfConsignedRequestPayload(requestPayload, plannedShipAt))
  const accessToken = await fetchSfAccessToken({ customerCode, secret, tokenApi })
  const timestamp = Date.now()
  const formBody = buildSfFormBody({ customerCode, timestamp, msgData, accessToken })
  logSfRequest({
    url: api,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    form: {
      partnerID: customerCode,
      requestID: `req_${timestamp}`,
      serviceCode: 'EXP_RECE_QUERY_DELIVERTM',
      timestamp: String(timestamp),
      trialShipAt: requestMeta.trialShipAt,
      targetArrivalDate: requestMeta.targetArrivalDate,
      configuredSendHour: requestMeta.configuredSendHour,
      finalPlannedShipAt: plannedShipAt,
      msgData: JSON.parse(msgData),
      accessToken,
    },
    phase: 'deliver_time_final',
  })
  const response = await postSfDeliverTime({ api, formBody })
  const rawText = await response.text().catch(() => '')
  const envelope = parseSfHttpResponseText(rawText)
  logSfResponse({
    status: response.status,
    ok: response.ok,
    rawText,
    parsed: envelope,
    phase: 'deliver_time_final',
  })
  if (!response.ok || !envelope) return null
  if (!resolveSfEnvelopeSuccess(envelope) || !resolveSfBusinessSuccess(envelope)) return null
  return resolveSfExpectedFromDeliverTime(envelope)
}

async function finalizeSfPlanExpectedArrival({ plan, api, customerCode, secret, tokenApi, requestPayload, requestMeta }) {
  if (!plan?.plannedShipAt) return plan
  try {
    const finalExpectedArriveAt = await requerySfExpectedArrival({ api, customerCode, secret, tokenApi, requestPayload, plannedShipAt: plan.plannedShipAt, requestMeta })
    return overridePlanExpectedArrival(plan, finalExpectedArriveAt)
  } catch {
    return plan
  }
}

function summarizeSfEnvelope(payload = {}) {
  return getSfEnvelopeMessage(payload)
}


async function estimateShippingWithSf({ province, city, district, address, customerName, customerPhone, rentStartDate, shippingMode = 'land', orderId }) {
  const config = await getConfig()
  const enabled = String(config.SF_OPEN_ENABLED || 'False').toLowerCase() === 'true'
  if (!enabled) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: '未开启顺丰时效标准查询' }
  }
  const api = getSfServiceApi(config)
  if (!api) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: '未配置顺丰时效查询 API' }
  }
  const tokenApi = getSfTokenApi(config)
  if (!rentStartDate) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: '缺少租期开始日期' }
  }

  const customerCode = getSfPartnerId(config)
  const secret = getSfSecret(config)
  const senderProvince = String(config.SF_SENDER_PROVINCE || '').trim()
  const senderCity = String(config.SF_SENDER_CITY || '').trim()
  if (!customerCode || !secret) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: '未配置顾客编码或密钥' }
  }
  if (!senderProvince || !senderCity) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: '未配置寄件省市' }
  }
  if (!tokenApi) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: '未配置顺丰鉴权 API' }
  }

  const requiredArrivalDate = resolveRequiredArrivalDate(rentStartDate, config)
  const fallbackExpectedArriveAt = formatLocalDateTime(requiredArrivalDate)
  const location = { province, city, district }
  const { trialShipAt, targetDate } = resolveSfTrialContext({ rentStartDate, province, city, district }, config)
  const baseRequestPayload = buildSfRequestPayload({ orderId, customerName, customerPhone, province, city, district, address, shippingMode }, config)
  const requestPayload = buildSfTrialRequestPayload(baseRequestPayload, trialShipAt)
  const msgData = JSON.stringify(requestPayload)
  const requestMeta = {
    trialShipAt: formatTrialInfo(trialShipAt),
    targetArrivalDate: formatLocalDateTime(targetDate),
    configuredSendHour: resolveConfiguredSendHourLabel(location, config),
  }

  async function requestDeliverTime(forceFreshToken = false) {
    if (forceFreshToken) invalidateSfAccessToken()
    const accessToken = await fetchSfAccessToken({ customerCode, secret, tokenApi })
    const timestamp = Date.now()
    const formBody = buildSfFormBody({ customerCode, timestamp, msgData, accessToken })
    logSfRequest({
      url: api,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      form: {
        partnerID: customerCode,
        requestID: `req_${timestamp}`,
        serviceCode: 'EXP_RECE_QUERY_DELIVERTM',
        timestamp: String(timestamp),
        trialShipAt: requestMeta.trialShipAt,
        targetArrivalDate: requestMeta.targetArrivalDate,
        configuredSendHour: requestMeta.configuredSendHour,
        msgData: requestPayload,
        accessToken,
      },
    })
    const response = await postSfDeliverTime({ api, formBody })
    const rawText = await response.text().catch(() => '')
    const envelope = parseSfHttpResponseText(rawText)
    logSfResponse({
      status: response.status,
      ok: response.ok,
      rawText,
      parsed: envelope,
      phase: 'deliver_time',
    })
    return { response, rawText, envelope }
  }

  let deliverResult
  try {
    deliverResult = await requestDeliverTime(false)
    if (shouldRetrySfWithFreshToken(deliverResult.response, deliverResult.rawText)) {
      deliverResult = await requestDeliverTime(true)
    }
  } catch (error) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: `顺丰请求失败：${error.message}` }
  }

  const { response, rawText, envelope } = deliverResult
  if (!response.ok || !envelope) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: `顺丰接口异常：${getSfHttpErrorMessage(response, envelope, rawText)}` }
  }
  if (!resolveSfEnvelopeSuccess(envelope)) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: summarizeSfEnvelope(envelope) || `顺丰接口返回 ${envelope.apiResultCode}` }
  }
  if (!resolveSfBusinessSuccess(envelope)) {
    return { ok: false, source: 'sf_deliver_time', fallbackReason: summarizeSfEnvelope(envelope) || '顺丰接口返回失败' }
  }

  const plan = resolveSfPlanFromEnvelope(envelope, fallbackExpectedArriveAt, rentStartDate, province, city, district, config, trialShipAt)
  if (!plan && !hasSfDeliverTimeEta(envelope)) {
    return buildFallbackPlanFromSf({ rentStartDate, city, shippingMode, province, district, fallbackReason: resolveTrialFallbackReason(summarizeSfEnvelope(envelope) || '顺丰未返回可用时效字段', trialShipAt) }, config)
  }
  if (!plan) {
    return buildFallbackPlanFromSf({ rentStartDate, city, shippingMode, province, district, fallbackReason: resolveTrialFallbackReason('顺丰时效字段解析失败', trialShipAt) }, config)
  }

  const finalizedPlan = await finalizeSfPlanExpectedArrival({
    plan,
    api,
    customerCode,
    secret,
    tokenApi,
    requestPayload: baseRequestPayload,
    requestMeta,
  })

  return withSfTrialMeta({
    ok: true,
    plannedShipAt: finalizedPlan.plannedShipAt,
    expectedArriveAt: finalizedPlan.expectedArriveAt,
    source: 'sf_deliver_time',
    serviceDate: finalizedPlan.serviceDate,
    fallbackReason: null,
    transitDays: finalizedPlan.transitDays,
  }, trialShipAt)
}

async function calculateShipPlan({ rentStartDate, province, city, district, address, customerName, customerPhone, shippingMode = 'land', orderId }) {
  const config = await getConfig()
  const sfPlan = await estimateShippingWithSf({ province, city, district, address, customerName, customerPhone, rentStartDate, shippingMode, orderId })
  if (sfPlan?.ok) return sfPlan
  return buildFallbackPlanFromSf({ rentStartDate, city, shippingMode, province, district, fallbackReason: sfPlan?.fallbackReason || null }, config)
}

function getSfConfigCheck(config) {
  const enabled = String(config.SF_OPEN_ENABLED || 'False').toLowerCase() === 'true'
  if (!enabled) return { ok: false, detail: '未开启' }
  const required = [config.SF_APP_ID, config.SF_APP_KEY, getSfTokenApi(config), getSfServiceApi(config), config.SF_SENDER_PROVINCE, config.SF_SENDER_CITY]
  return { ok: required.every(Boolean), detail: required.every(Boolean) ? '已配置' : '顾客编码 / Secret / API / 地址不完整' }
}

function getSfRegionRuleDetail(config) {
  const regions = parseCsvConfig(config.SF_SICHUAN_SPECIAL_REGIONS || '甘孜,阿坝')
  return regions.length ? regions.join('、') : '甘孜、阿坝'
}

function buildShippingEstimateContext({ province, city, district, address, rentStartDate, shippingMode = 'land' }) {
  return { province, city, district, address, rentStartDate, shippingMode }
}

function normalizeProvinceFromAddress({ province, city, address }) {
  if (province) return province
  const text = `${city || ''} ${address || ''}`
  const inferred = resolveReceiverProvince('', city)
  if (inferred) return inferred
  if (text.includes('四川')) return '四川省'
  return ''
}

function getOrderShippingEstimateInput(order = {}) {
  return {
    province: order.province || normalizeProvinceFromAddress(order),
    city: order.city,
    district: order.district,
    address: order.address,
    customerPhone: order.customer_phone,
    rentStartDate: order.rent_start_date,
    shippingMode: order.shipping_mode || 'land',
    orderId: order.order_no || (order.id ? `order_${order.id}` : undefined),
  }
}

function withFallbackProvince(payload = {}) {
  return {
    ...payload,
    province: payload.province || normalizeProvinceFromAddress(payload),
  }
}

function calculateShipPlanSyncFallback(rentStartDate, city, shippingMode = 'land') {
  const start = new Date(`${rentStartDate}T00:00:00`)
  const arriveAt = new Date(start)
  arriveAt.setDate(arriveAt.getDate() - 1)
  const plannedShipAt = new Date(arriveAt)
  plannedShipAt.setHours(plannedShipAt.getHours() - estimateEtaDays(city, shippingMode) * 24)
  return {
    plannedShipAt: formatLocalDateTime(plannedShipAt),
    expectedArriveAt: formatLocalDateTime(arriveAt),
    source: 'local_estimate',
  }
}

function calculateShipPlanLegacy(rentStartDate, city, shippingMode = 'land') {
  return calculateShipPlanSyncFallback(rentStartDate, city, shippingMode)
}

function normalizeDateOnly(value) {
  if (!value) return ''
  return String(value).trim().replace(' ', 'T').slice(0, 10)
}

function normalizeDateTimeWithDefaultHour(value, defaultHour = 18) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T${pad2(defaultHour)}:00:00`
  return normalizeDateTime(text)
}

function getDateTimeHour(value, fallback = 0) {
  const normalized = normalizeDateTime(value)
  const matched = String(normalized || '').match(/T(\d{2}):/)
  return matched ? Number.parseInt(matched[1], 10) : fallback
}

function addCalendarDays(dateText, days) {
  const date = new Date(`${normalizeDateOnly(dateText)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return normalizeDateOnly(dateText)
  date.setDate(date.getDate() + Number(days || 0))
  return formatLocalDateTime(date).slice(0, 10)
}

function inclusiveCalendarDays(startDateText, endDateText) {
  const start = new Date(`${normalizeDateOnly(startDateText)}T00:00:00`)
  const end = new Date(`${normalizeDateOnly(endDateText)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1)
}

function getTodayDateOnly() {
  return formatLocalDateTime(new Date()).slice(0, 10)
}

function mergeFallbackReason(current, extra) {
  if (!extra) return current || null
  return [current, extra].filter(Boolean).join('；')
}

function normalizeAvailabilityPlanWindow(plan = {}, payload = {}, config = {}) {
  const location = { province: payload.province, city: payload.city, district: payload.district }
  const today = getTodayDateOnly()
  const plannedShipAt = normalizeDateTime(plan.plannedShipAt)
  const shipDate = normalizeDateOnly(plannedShipAt)
  if (!shipDate || shipDate >= today) return plan

  const sendHour = pad2(resolveSendHour(location, config))
  const nextPlannedShipAt = `${today}T${sendHour}:00:00`
  const transitDays = Number(plan.transitDays || payload.transitDays || 0)
  const nextExpectedArriveAt = transitDays > 0
    ? `${addCalendarDays(today, Math.ceil(transitDays))}T${extractTimePart(plannedShipAt, `${sendHour}:00:00`)}`
    : plan.expectedArriveAt
  const adjustedArrivalDate = normalizeDateOnly(nextExpectedArriveAt)
  const rentStartDate = normalizeDateOnly(payload.rentStartDate)
  const lateArrivalReason = adjustedArrivalDate && rentStartDate && adjustedArrivalDate > rentStartDate
    ? `按今天发货预计 ${adjustedArrivalDate} 到货，晚于租期开始日 ${rentStartDate}`
    : null

  return {
    ...plan,
    plannedShipAt: nextPlannedShipAt,
    expectedArriveAt: nextExpectedArriveAt,
    fallbackReason: mergeFallbackReason(
      mergeFallbackReason(plan.fallbackReason, `原计划发货日 ${shipDate} 早于今天 ${today}，已按今天发货重新展示`),
      lateArrivalReason,
    ),
  }
}

function maxDateOnly(...values) {
  return values.map(normalizeDateOnly).filter(Boolean).sort().at(-1) || ''
}

function minDateOnly(...values) {
  return values.map(normalizeDateOnly).filter(Boolean).sort()[0] || ''
}

async function findAvailableUnitId(modelCode, rentStartDate, rentEndDate) {
  const units = await mysqlAdapter.all(`
    SELECT id FROM schedule_units
    WHERE model_code = ? AND status NOT IN ('offline', 'repair')
    ORDER BY unit_code ASC
  `, [modelCode])
  for (const unit of units) {
    const conflict = await findScheduleConflict({ unitId: unit.id, rentStartDate, rentEndDate })
    if (!conflict) return unit.id
  }
  return null
}

function buildOrderOccupancyWindow({ rentStartDate, rentEndDate, plannedShipAt, expectedArriveAt }) {
  const rentStart = normalizeDateOnly(rentStartDate)
  const rentEnd = normalizeDateOnly(rentEndDate)
  const shipDay = normalizeDateOnly(plannedShipAt) || rentStart
  const arriveDay = normalizeDateOnly(expectedArriveAt) || rentStart
  const bufferEndDate = rentEnd ? addCalendarDays(rentEnd, 2) : rentEnd
  return {
    startDate: minDateOnly(shipDay, arriveDay, rentStart),
    endDate: maxDateOnly(rentEnd, bufferEndDate),
  }
}

async function findScheduleConflict({ unitId, rentStartDate, rentEndDate, plannedShipAt, expectedArriveAt, excludeOrderId } = {}) {
  const resolvedUnitId = Number(unitId || 0)
  if (!resolvedUnitId) return null
  const window = buildOrderOccupancyWindow({ rentStartDate, rentEndDate, plannedShipAt, expectedArriveAt })
  if (!window.startDate || !window.endDate) return null
  const where = [
    'b.unit_id = ?',
    "b.status = 'active'",
    'NOT (b.end_date < ? OR b.start_date > ?)',
  ]
  const params = [resolvedUnitId, window.startDate, window.endDate]
  if (excludeOrderId) {
    where.push('(b.order_id IS NULL OR b.order_id != ?)')
    params.push(Number(excludeOrderId))
  }
  return await mysqlAdapter.get(`
    SELECT b.id, b.block_type, b.start_date, b.end_date, b.order_id,
      o.order_no, o.customer_name, u.unit_code
    FROM schedule_blocks b
    LEFT JOIN rental_orders o ON o.id = b.order_id
    LEFT JOIN schedule_units u ON u.id = b.unit_id
    WHERE ${where.join(' AND ')}
    ORDER BY b.start_date ASC, b.id ASC
    LIMIT 1
  `, params)
}

function formatScheduleConflictMessage(conflict) {
  if (!conflict) return ''
  const label = conflict.order_no || (conflict.order_id ? `#${conflict.order_id}` : '未知订单')
  const customer = conflict.customer_name ? `（${conflict.customer_name}）` : ''
  return `设备 ${conflict.unit_code || ''} 在 ${conflict.start_date} ~ ${conflict.end_date} 已被订单 ${label}${customer} 占用`
}

async function getModelAssetValue(modelCode) {
  const row = await mysqlAdapter.get(`
    SELECT
      MAX(COALESCE(NULLIF(residual_value, 0), purchase_cost)) AS max_asset_value,
      AVG(NULLIF(COALESCE(NULLIF(residual_value, 0), purchase_cost), 0)) AS avg_asset_value
    FROM schedule_units
    WHERE model_code = ? AND status != 'offline'
  `, [modelCode])
  return Number(row?.max_asset_value || row?.avg_asset_value || 0)
}

async function buildAvailabilityCommercialSummary({ modelCode, rentStartDate, rentEndDate }) {
  await ensureRentalPricingTable()
  await ensureDepositExemptionRulesTable()
  const rentDays = inclusiveCalendarDays(rentStartDate, rentEndDate)
  const [pricingRows, exemptionRows, assetValue] = await Promise.all([
    mysqlAdapter.all(`
      SELECT *
      FROM rental_pricing
      WHERE model_code = ? AND active = 1
      ORDER BY max_days ASC, min_days ASC
    `, [modelCode]),
    mysqlAdapter.all(`
      SELECT *
      FROM deposit_exemption_rules
      WHERE active = 1
      ORDER BY sort_order ASC, min_asset_value ASC, id ASC
    `),
    getModelAssetValue(modelCode),
  ])

  const quote = resolveQuoteFromPricingRows(pricingRows, rentDays)
  if (quote.ok && quote.pricingRow) {
    quote.days = rentDays
    quote.deposit = Number(quote.pricingRow.deposit || 0)
    quote.remark = quote.pricingRow.remark || ''
  }

  const exemptionRule = pickDepositExemptionRule(exemptionRows, assetValue)
  const depositExemption = exemptionRule ? {
    ok: true,
    assetValue: Number(assetValue || 0),
    rule: exemptionRule,
    summary: buildDepositExemptionSummary(exemptionRule, assetValue),
  } : {
    ok: false,
    assetValue: Number(assetValue || 0),
    rule: null,
    summary: '',
  }

  return { rentDays, quote, depositExemption }
}

async function resolveAvailabilityShippingPlan(payload = {}) {
  const rentStartDate = normalizeDateOnly(payload.rentStartDate)
  const shippingMode = payload.shippingMode || 'land'
  const explicitShipDate = normalizeDateOnly(payload.plannedShipAt || payload.shipDate)
  const explicitArriveDate = normalizeDateOnly(payload.expectedArriveAt || payload.arriveDate)
  const transitDays = Number(payload.transitDays || 0)
  const config = await getConfig()

  if (explicitShipDate || explicitArriveDate) {
    return normalizeAvailabilityPlanWindow({
      source: 'manual',
      plannedShipAt: explicitShipDate ? normalizeDateTimeWithDefaultHour(payload.plannedShipAt || payload.shipDate, 18) : null,
      expectedArriveAt: explicitArriveDate ? normalizeDateTimeWithDefaultHour(payload.expectedArriveAt || payload.arriveDate, 18) : null,
      fallbackReason: null,
    }, payload, config)
  }

  if (transitDays > 0 && rentStartDate) {
    const shipDate = addCalendarDays(rentStartDate, -Math.ceil(transitDays))
    return normalizeAvailabilityPlanWindow({
      source: 'transit_days',
      plannedShipAt: `${shipDate}T18:00:00`,
      expectedArriveAt: `${rentStartDate}T18:00:00`,
      transitDays: Math.ceil(transitDays),
      fallbackReason: null,
    }, payload, config)
  }

  const plan = await calculateShipPlan(withFallbackProvince({
    province: payload.province,
    city: payload.city,
    district: payload.district,
    address: payload.address,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    rentStartDate,
    shippingMode,
    orderId: payload.orderId || undefined,
  }))
  return normalizeAvailabilityPlanWindow(plan, payload, config)
}

async function checkScheduleAvailability(payload = {}) {
  const modelCode = String(payload.modelCode || '').trim()
  const rentStartDate = normalizeDateOnly(payload.rentStartDate)
  const rentEndDate = normalizeDateOnly(payload.rentEndDate)
  if (!modelCode) return { ok: false, message: '型号编码不能为空' }
  if (!rentStartDate || !rentEndDate) return { ok: false, message: '租期开始和结束日期不能为空' }
  if (rentEndDate < rentStartDate) return { ok: false, message: '租期结束日期不能早于开始日期' }

  const bufferDays = Math.max(0, Number.parseInt(String(payload.returnBufferDays ?? 2), 10) || 0)
  const shippingPlan = await resolveAvailabilityShippingPlan({ ...payload, modelCode, rentStartDate, rentEndDate })
  const commercial = await buildAvailabilityCommercialSummary({ modelCode, rentStartDate, rentEndDate })
  const shipDate = normalizeDateOnly(shippingPlan?.plannedShipAt) || rentStartDate
  const arriveDate = normalizeDateOnly(shippingPlan?.expectedArriveAt) || rentStartDate
  const bufferEndDate = addCalendarDays(rentEndDate, bufferDays)
  const requiredStartDate = minDateOnly(shipDate, arriveDate, rentStartDate)
  const requiredEndDate = maxDateOnly(rentEndDate, bufferEndDate)
  const planSource = shippingPlan?.source || 'local_estimate'
  const planSourceLabel = planSource === 'transit_days' ? '运输天数试算' : getSfSourceLabel(planSource)

  const units = await mysqlAdapter.all(`
    SELECT id, model_code, unit_code, serial_no, city, status, note, purchase_cost, residual_value
    FROM schedule_units
    WHERE model_code = ? AND status NOT IN ('offline', 'repair')
    ORDER BY unit_code ASC
  `, [modelCode])

  const blocks = await mysqlAdapter.all(`
    SELECT b.*, u.unit_code, o.order_no, o.customer_name, o.rent_start_date, o.rent_end_date, o.order_status,
      s.id AS store_id, s.code AS store_code, s.name AS store_name
    FROM schedule_blocks b
    LEFT JOIN schedule_units u ON u.id = b.unit_id
    LEFT JOIN rental_orders o ON o.id = b.order_id
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE b.model_code = ?
      AND b.status = 'active'
      AND NOT (b.end_date < ? OR b.start_date > ?)
    ORDER BY b.start_date ASC, b.end_date ASC, b.id ASC
  `, [modelCode, requiredStartDate, requiredEndDate])

  const conflictsByUnit = new Map()
  for (const block of blocks) {
    if (!block.unit_id) continue
    if (!conflictsByUnit.has(block.unit_id)) conflictsByUnit.set(block.unit_id, [])
    conflictsByUnit.get(block.unit_id).push({
      blockId: block.id,
      blockType: block.block_type,
      startDate: block.start_date,
      endDate: block.end_date,
      orderId: block.order_id,
      orderNo: block.order_no,
      customerName: block.customer_name,
      storeId: block.store_id,
      storeCode: block.store_code,
      storeName: block.store_name,
      rentStartDate: block.rent_start_date,
      rentEndDate: block.rent_end_date,
      orderStatus: block.order_status,
      note: block.note,
    })
  }

  const availableUnits = []
  const conflictUnits = []
  for (const unit of units) {
    const conflicts = (conflictsByUnit.get(unit.id) || []).filter((conflict) => {
      const isSameDayReturnArrival = conflict.blockType === 'return_shipping' && conflict.endDate === shipDate
      const canUseReturnDayForEveningShip = isSameDayReturnArrival && getDateTimeHour(shippingPlan?.plannedShipAt, 18) >= 18
      return !canUseReturnDayForEveningShip
    })
    const row = {
      id: unit.id,
      modelCode: unit.model_code,
      unitCode: unit.unit_code,
      serialNo: unit.serial_no,
      city: unit.city,
      status: unit.status,
      note: unit.note,
      purchaseCost: Number(unit.purchase_cost || 0),
      residualValue: Number(unit.residual_value || 0),
    }
    if (conflicts.length) conflictUnits.push({ ...row, conflicts })
    else availableUnits.push(row)
  }

  return {
    ok: true,
    available: availableUnits.length > 0,
    modelCode,
    query: {
      rentStartDate,
      rentEndDate,
      province: payload.province || '',
      city: payload.city || '',
      district: payload.district || '',
      address: payload.address || '',
      shippingMode: payload.shippingMode || 'land',
      returnBufferDays: bufferDays,
    },
    plan: {
      plannedShipAt: shippingPlan?.plannedShipAt || null,
      expectedArriveAt: shippingPlan?.expectedArriveAt || null,
      shipDate,
      arriveDate,
      rentStartDate,
      rentEndDate,
      bufferEndDate,
      requiredStartDate,
      requiredEndDate,
      source: planSource,
      sourceLabel: planSourceLabel,
      fallbackReason: shippingPlan?.fallbackReason || null,
    },
    quote: commercial.quote,
    depositExemption: commercial.depositExemption,
    counts: {
      totalUnits: units.length,
      availableUnits: availableUnits.length,
      conflictUnits: conflictUnits.length,
    },
    availableUnits,
    conflictUnits,
  }
}

async function rebuildOrderScheduleBlocks({ orderId, unitId, modelCode, rentStartDate, rentEndDate, plannedShipAt, expectedArriveAt }) {
  await mysqlAdapter.run('DELETE FROM schedule_blocks WHERE order_id = ?', [orderId])
  if (!unitId) return

  const shipDay = plannedShipAt ? plannedShipAt.slice(0, 10) : rentStartDate
  const arriveDay = expectedArriveAt ? expectedArriveAt.slice(0, 10) : rentStartDate
  const bufferEnd = new Date(`${rentEndDate}T00:00:00`)
  bufferEnd.setDate(bufferEnd.getDate() + 2)
  const bufferEndDate = `${bufferEnd.getFullYear()}-${pad2(bufferEnd.getMonth() + 1)}-${pad2(bufferEnd.getDate())}`

  const insertBlockSQL = `
    INSERT INTO schedule_blocks (
      unit_id, order_id, model_code, block_type, start_date, end_date,
      planned_ship_at, expected_arrive_at, status, note, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ${nowExpr()})
  `

  await mysqlAdapter.run(insertBlockSQL, [unitId, orderId, modelCode, 'shipping', shipDay, arriveDay, plannedShipAt ?? null, expectedArriveAt ?? null, '租赁发货占用'])
  await mysqlAdapter.run(insertBlockSQL, [unitId, orderId, modelCode, 'rent', rentStartDate, rentEndDate, plannedShipAt ?? null, expectedArriveAt ?? null, '租期占用'])
  await mysqlAdapter.run(insertBlockSQL, [unitId, orderId, modelCode, 'buffer', rentEndDate, bufferEndDate, null, null, '归还缓冲'])
}

async function getOrderById(orderId) {
  return await mysqlAdapter.get(`
    SELECT o.*, u.unit_code, u.purchase_cost, u.residual_value, s.code AS store_code, s.name AS store_name
    FROM rental_orders o
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE o.id = ?
  `, [orderId])
}

async function initDbManager(dataDir) {
  runtimeDataDir = dataDir || runtimeDataDir
  await mysqlAdapter.initPool()
  // Schema is managed by mysql_schema.sql — no CREATE TABLE here
  // Run ensureColumn migrations
  await ensureColumn('knowledge', 'scope_type', "VARCHAR(50) NOT NULL DEFAULT 'global'")
  await ensureColumn('knowledge', 'model_code', 'VARCHAR(100)')
  await ensureColumn('knowledge', 'biz_item_code', 'VARCHAR(100)')
  await ensureColumn('knowledge', 'tags', 'TEXT')
  await ensureColumn('knowledge', 'source_type', "VARCHAR(50) NOT NULL DEFAULT 'manual'")
  await ensureColumn('knowledge', 'status', "VARCHAR(50) NOT NULL DEFAULT 'approved'")
  await ensureColumn('knowledge', 'confidence_threshold', 'DOUBLE DEFAULT 0.75')
  await ensureKnowledgeIndexStateTable()
  await ensureColumn('rental_orders', 'province', 'VARCHAR(100)')
  await ensureColumn('rental_orders', 'is_deposit_free', 'TINYINT(1) NOT NULL DEFAULT 0')
  await ensureColumn('rental_orders', 'source_channel', 'VARCHAR(50)')
  await ensureColumn('rental_orders', 'source_name', 'VARCHAR(255)')
  await ensureColumn('rental_orders', 'remark', 'TEXT')
  await ensureStoreOrderSupport()
  await ensureColumn('schedule_units', 'purchase_cost', 'DOUBLE DEFAULT 0')
  await ensureColumn('schedule_units', 'residual_value', 'DOUBLE DEFAULT 0')
  await ensureRentalPricingTable()
  await ensureDepositExemptionRulesTable()
  await ensureDepositAuditTables()
  await ensureInquiryEventsTable()
  await ensureSfShippingTables()
  await ensureItemModelMappingTable()
  await ensureXianyuItemListingsTable()
  await ensureItemCacheTable()
  await migrateLegacyItemCacheFromChatDb()

  // Phase 1：会话回复状态机（在旧库上幂等补表）
  await mysqlAdapter.run(`
    CREATE TABLE IF NOT EXISTS session_reply_state (
      session_id VARCHAR(255) PRIMARY KEY,
      account_id INT DEFAULT 1,
      state VARCHAR(30) NOT NULL DEFAULT 'auto',
      cooldown_since DATETIME NULL,
      last_notify_at DATETIME NULL,
      last_human_msg_at DATETIME NULL,
      last_buyer_msg_at DATETIME NULL,
      last_default_reply_at DATETIME NULL,
      default_reply_count INT DEFAULT 0,
      followup_sent TINYINT DEFAULT 0,
      item_id VARCHAR(255) NULL,
      model_code VARCHAR(100) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_session_state_account (account_id, state),
      INDEX idx_session_state_updated (updated_at)
    ) ENGINE=InnoDB
  `)
  console.log('[MySQL] initDbManager done')
}

async function ensureKnowledgeIndexStateTable() {
  await mysqlAdapter.run(`
    CREATE TABLE IF NOT EXISTS knowledge_index_state (
      state_key VARCHAR(64) PRIMARY KEY,
      data_version BIGINT NOT NULL DEFAULT 0,
      built_version BIGINT NOT NULL DEFAULT 0,
      dirty TINYINT NOT NULL DEFAULT 1,
      rebuild_requested_at DATETIME NULL,
      last_built_at DATETIME NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)
  await mysqlAdapter.run(`
    INSERT INTO knowledge_index_state (state_key, data_version, built_version, dirty)
    VALUES ('knowledge', 0, 0, 1)
    ON DUPLICATE KEY UPDATE state_key = VALUES(state_key)
  `)
}

async function markKnowledgeIndexDirty() {
  await ensureKnowledgeIndexStateTable()
  await mysqlAdapter.run(`
    UPDATE knowledge_index_state
    SET data_version = data_version + 1,
        dirty = 1,
        rebuild_requested_at = ${nowExpr()},
        updated_at = ${nowExpr()}
    WHERE state_key = 'knowledge'
  `)
}

async function ensureStoresTable() {
  await mysqlAdapter.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INT NOT NULL AUTO_INCREMENT,
      code VARCHAR(100) NOT NULL,
      name VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      is_default TINYINT NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_stores_code (code)
    ) ENGINE=InnoDB
  `)
}

async function seedStores() {
  for (const store of STORE_PRESETS) {
    await mysqlAdapter.run(`
      INSERT INTO stores (code, name, status, is_default, sort_order)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        status = VALUES(status),
        is_default = VALUES(is_default),
        sort_order = VALUES(sort_order),
        updated_at = ${nowExpr()}
    `, [store.code, store.name, store.status, store.isDefault, store.sortOrder])
  }
}

async function ensureStoreOrderSupport() {
  await ensureStoresTable()
  await ensureColumn('rental_orders', 'store_id', 'INT NULL')
  await seedStores()
  const defaultStore = await mysqlAdapter.get(`
    SELECT id FROM stores
    WHERE code = ?
    LIMIT 1
  `, [DEFAULT_STORE_CODE])
  if (!defaultStore?.id) return
  await mysqlAdapter.run(`
    UPDATE rental_orders
    SET store_id = ?
    WHERE store_id IS NULL OR store_id = 0
  `, [defaultStore.id])
}

async function getDefaultStore() {
  const preferred = await mysqlAdapter.get(`
    SELECT id, code, name, status, is_default, sort_order
    FROM stores
    WHERE is_default = 1
    ORDER BY sort_order ASC, id ASC
    LIMIT 1
  `)
  if (preferred) return preferred
  return await mysqlAdapter.get(`
    SELECT id, code, name, status, is_default, sort_order
    FROM stores
    WHERE status = 'active'
    ORDER BY sort_order ASC, id ASC
    LIMIT 1
  `)
}

async function resolveStoreId(storeId) {
  const normalized = normalizeStoreIdValue(storeId)
  if (normalized) return normalized
  return (await getDefaultStore())?.id || null
}

async function listStores(filters = {}) {
  const { status, keyword } = filters
  const where = []
  const params = []
  if (status) {
    where.push('status = ?')
    params.push(status)
  }
  if (keyword) {
    where.push('(code LIKE ? OR name LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  return await mysqlAdapter.all(`
    SELECT id, code, name, status, is_default, sort_order, created_at, updated_at
    FROM stores
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY is_default DESC, sort_order ASC, id ASC
  `, params)
}

async function recordInquiryEventFromAvailability(payload = {}) {
  await ensureInquiryEventsTable()
  const storeId = await resolveStoreId(payload.storeId)
  const event = buildInquiryEventRecord({ ...payload, storeId })
  const result = await mysqlAdapter.run(`
    INSERT INTO inquiry_events (
      source, store_id, chat_id, message_id, raw_text, model_code,
      rent_start_date, rent_end_date, rent_days, province, city, district, address,
      shipping_mode, available, total_unit_count, available_unit_count, conflict_unit_count,
      quoted_price, quote_days, deposit_summary, planned_ship_at, expected_arrive_at,
      ship_date, arrive_date, availability_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
  `, [
    event.source,
    event.storeId,
    event.chatId || null,
    event.messageId || null,
    event.rawText || null,
    event.modelCode || null,
    event.rentStartDate || null,
    event.rentEndDate || null,
    event.rentDays || 0,
    event.province || null,
    event.city || null,
    event.district || null,
    event.address || null,
    event.shippingMode || 'land',
    event.available || 0,
    event.totalUnitCount || 0,
    event.availableUnitCount || 0,
    event.conflictUnitCount || 0,
    event.quotedPrice || 0,
    event.quoteDays || 0,
    event.depositSummary || null,
    event.plannedShipAt || null,
    event.expectedArriveAt || null,
    event.shipDate || null,
    event.arriveDate || null,
    event.availabilityStatus || 'unknown',
  ])
  return { ok: true, id: result.lastInsertRowid, event: { ...event, id: result.lastInsertRowid } }
}

async function linkInquiryEventToOrder({ inquiryEventId, orderId, finalFee } = {}) {
  await ensureInquiryEventsTable()
  const eventId = Number(inquiryEventId || 0)
  const resolvedOrderId = Number(orderId || 0)
  if (!eventId || !resolvedOrderId) return { ok: false, message: 'inquiryEventId and orderId required' }
  const order = await getOrderById(resolvedOrderId)
  const fee = Number(finalFee ?? order?.fee ?? 0) || 0
  const result = await mysqlAdapter.run(`
    UPDATE inquiry_events
    SET order_id = ?, final_fee = ?, converted_at = COALESCE(converted_at, ${nowExpr()}), updated_at = ${nowExpr()}
    WHERE id = ?
  `, [resolvedOrderId, fee, eventId])
  return { ok: result.changes > 0, inquiryEventId: eventId, orderId: resolvedOrderId }
}

async function linkRecentInquiryToOrder({ source, chatId, modelCode, rentStartDate, rentEndDate, orderId, finalFee } = {}) {
  await ensureInquiryEventsTable()
  const where = ['order_id IS NULL', 'created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)']
  const params = []
  if (source) {
    where.push('source = ?')
    params.push(source)
  }
  if (chatId) {
    where.push('chat_id = ?')
    params.push(chatId)
  }
  if (modelCode) {
    where.push('model_code = ?')
    params.push(modelCode)
  }
  if (rentStartDate) {
    where.push('rent_start_date = ?')
    params.push(rentStartDate)
  }
  if (rentEndDate) {
    where.push('rent_end_date = ?')
    params.push(rentEndDate)
  }
  const event = await mysqlAdapter.get(`
    SELECT id
    FROM inquiry_events
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `, params)
  if (!event?.id) return { ok: false, message: '未找到可关联询单' }
  return linkInquiryEventToOrder({ inquiryEventId: event.id, orderId, finalFee })
}

async function listInquiryEvents(filters = {}) {
  await ensureInquiryEventsTable()
  const where = []
  const params = []
  if (filters.source) {
    where.push('e.source = ?')
    params.push(filters.source)
  }
  if (filters.storeId) {
    where.push('e.store_id = ?')
    params.push(filters.storeId)
  }
  if (filters.modelCode) {
    where.push('e.model_code = ?')
    params.push(filters.modelCode)
  }
  if (filters.from) {
    where.push('e.created_at >= ?')
    params.push(`${String(filters.from).slice(0, 10)} 00:00:00`)
  }
  if (filters.to) {
    where.push('e.created_at <= ?')
    params.push(`${String(filters.to).slice(0, 10)} 23:59:59`)
  }
  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500)
  return await mysqlAdapter.all(`
    SELECT e.*, s.code AS store_code, s.name AS store_name, o.customer_name, o.unit_id, u.unit_code
    FROM inquiry_events e
    LEFT JOIN stores s ON s.id = e.store_id
    LEFT JOIN rental_orders o ON o.id = e.order_id
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ${limit}
  `, params)
}

async function getInquiryStats(filters = {}) {
  const rows = await listInquiryEvents({ ...filters, limit: filters.limit || 500 })
  return summarizeInquiryStats(rows)
}

async function ensureColumn(table, column, definition) {
  const rows = await mysqlAdapter.all(
    'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  )
  if (!rows.length) {
    try {
      await mysqlAdapter.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch (e) {
      if (!e.message.includes('Duplicate column')) throw e
    }
  }
}

async function getConfig() {
  const rows = await mysqlAdapter.all('SELECT `key`, `value` FROM config')
  const result = {}
  for (const row of rows) result[row.key] = row.value
  return result
}

async function saveConfig(data) {
  const normalizedData = { ...data }
  for (const key of ['SF_DEFAULT_SEND_HOUR', 'SF_SPECIAL_SEND_HOUR']) {
    if (String(normalizedData[key] ?? '').trim() === '23') normalizedData[key] = '18'
  }
  for (const [key, value] of Object.entries(normalizedData)) {
    await mysqlAdapter.run('INSERT INTO config (\x60key\x60, \x60value\x60, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE \x60value\x60 = VALUES(\x60value\x60), updated_at = NOW()', [key, String(value ?? '')])
  }
  try { await createRuntimeBackupSnapshot('save-config') } catch (e) { console.error('[db-backup] saveConfig snapshot failed:', e) }
}

async function getInquiryOptimizationConfig() {
  const {
    CONFIG_KEY_MAP,
    getDefaultInquiryOptimizationConfig,
    normalizeInquiryOptimizationConfig,
  } = getInquiryOptimizationModules()
  const rawConfig = await getConfig()
  const payload = {}
  for (const [field, key] of Object.entries(CONFIG_KEY_MAP)) {
    payload[field] = rawConfig[key]
  }
  return normalizeInquiryOptimizationConfig({
    ...getDefaultInquiryOptimizationConfig(),
    ...payload,
  })
}

async function saveInquiryOptimizationConfig(payload = {}) {
  const {
    CONFIG_KEY_MAP,
    normalizeInquiryOptimizationConfig,
    serializeInquiryOptimizationConfig,
  } = getInquiryOptimizationModules()
  const nextConfig = normalizeInquiryOptimizationConfig(payload)
  const serialized = serializeInquiryOptimizationConfig(nextConfig)
  const rows = {}
  for (const [field, key] of Object.entries(CONFIG_KEY_MAP)) {
    if (serialized[field] !== undefined) rows[key] = serialized[field]
  }
  await saveConfig(rows)
  return { ok: true, config: nextConfig }
}

async function getPrompts() {
  const rows = await mysqlAdapter.all('SELECT name, content FROM prompts')
  const result = {}
  for (const row of rows) result[row.name] = row.content
  return result
}

async function savePrompts(data) {
  for (const [name, content] of Object.entries(data)) {
    await mysqlAdapter.run('INSERT INTO prompts (name, content, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()', [name, String(content ?? '')])
  }
  try { await createRuntimeBackupSnapshot('save-prompts') } catch (e) { console.error('[db-backup] savePrompts snapshot failed:', e) }
}

async function listKnowledge(filters = {}) {
  const { itemId, scopeType, modelCode, bizItemCode, status, keyword } = filters
  const where = []
  const params = []

  if (itemId === '__global__') {
    where.push('(item_id IS NULL OR item_id = \'\')')
  } else if (itemId) {
    where.push('item_id = ?')
    params.push(itemId)
  }
  if (scopeType) {
    where.push('scope_type = ?')
    params.push(scopeType)
  }
  if (modelCode) {
    where.push('model_code = ?')
    params.push(modelCode)
  }
  if (bizItemCode) {
    where.push('biz_item_code = ?')
    params.push(bizItemCode)
  }
  if (status) {
    where.push('status = ?')
    params.push(status)
  }
  if (keyword) {
    where.push('(question LIKE ? OR answer LIKE ? OR model_code LIKE ? OR biz_item_code LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }

  const sql = `
    SELECT id, item_id, biz_item_code, scope_type, model_code, question, answer, tags, source_type, status, confidence_threshold, created_at, updated_at
    FROM knowledge
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, id DESC
  `
  return (await mysqlAdapter.all(sql, params)).map(rowToKnowledge)
}

async function addKnowledge({
  question,
  answer,
  itemId,
  bizItemCode,
  scopeType = 'global',
  modelCode = null,
  tags = [],
  sourceType = 'manual',
  status = 'approved',
  confidenceThreshold = 0.75,
}) {
  const result = await mysqlAdapter.run(`
    INSERT INTO knowledge (
      item_id, biz_item_code, scope_type, model_code, question, answer, tags,
      source_type, status, confidence_threshold, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
  `, [
    itemId ?? null,
    bizItemCode ?? null,
    scopeType,
    modelCode ?? null,
    question,
    answer,
    normalizeTags(tags),
    sourceType,
    status,
    confidenceThreshold,
  ])
  await markKnowledgeIndexDirty()
  return { id: result.lastInsertRowid }
}

async function updateKnowledge({
  id,
  question,
  answer,
  itemId,
  bizItemCode,
  scopeType,
  modelCode,
  tags,
  status,
  confidenceThreshold,
}) {
  const existing = await mysqlAdapter.get('SELECT * FROM knowledge WHERE id = ?', [id])
  if (!existing) return 0
  const result = await mysqlAdapter.run(`
    UPDATE knowledge
    SET item_id = ?,
      biz_item_code = ?,
        scope_type = ?,
        model_code = ?,
        question = ?,
        answer = ?,
        tags = ?,
        status = ?,
        confidence_threshold = ?,
        embedding = NULL,
        updated_at = ${nowExpr()}
    WHERE id = ?
  `, [itemId === undefined ? existing.item_id : itemId,
    bizItemCode === undefined ? existing.biz_item_code : bizItemCode,
    scopeType ?? existing.scope_type,
    modelCode === undefined ? existing.model_code : modelCode,
    question ?? existing.question,
    answer ?? existing.answer,
    normalizeTags(tags ?? existing.tags),
    status ?? existing.status,
    confidenceThreshold ?? existing.confidence_threshold,
    id,])
  if (result.changes > 0) await markKnowledgeIndexDirty()
  return result.changes
}

async function deleteKnowledge(id) {
  const result = await mysqlAdapter.run('DELETE FROM knowledge WHERE id = ?', [id])
  if (result.changes > 0) await markKnowledgeIndexDirty()
  return result.changes
}

async function batchAddKnowledge(entries, itemId, scopeType = 'global', modelCode = null, bizItemCode = null, sourceType = 'manual', status = 'approved') {
  const insertSQL = `
    INSERT INTO knowledge (item_id, biz_item_code, scope_type, model_code, question, answer, tags, source_type, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
  `
  return await mysqlAdapter.transaction(async (conn) => {
    const ids = []
    for (const { question, answer, tags } of entries) {
      const result = await conn.run(insertSQL, [itemId ?? null, bizItemCode ?? null, scopeType, modelCode ?? null, question, answer, normalizeTags(tags), sourceType, status])
      ids.push({ id: result.lastInsertRowid })
    }
    return ids
  })
  .then(async (ids) => {
    if (ids.length) await markKnowledgeIndexDirty()
    return ids
  })
}

async function listTakeoverTasks(filters = {}) {
  const { status, priority } = filters
  const where = []
  const params = []
  if (status) {
    where.push('status = ?')
    params.push(status)
  }
  if (priority) {
    where.push('priority = ?')
    params.push(priority)
  }
  const sql = `
    SELECT * FROM takeover_tasks
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC, id DESC
  `
  return await mysqlAdapter.all(sql, params)
}

// ── 会话回复状态（Phase 1） ──
async function listSessionStates(filters = {}) {
  const { onlyNonAuto = false, sessionIds } = filters || {}
  const where = []
  const params = []
  if (onlyNonAuto) {
    where.push("state <> 'auto'")
  }
  if (Array.isArray(sessionIds) && sessionIds.length > 0) {
    where.push(`session_id IN (${sessionIds.map(() => '?').join(',')})`)
    params.push(...sessionIds)
  }
  const sql = `
    SELECT * FROM session_reply_state
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC
    LIMIT 500
  `
  try {
    return await mysqlAdapter.all(sql, params)
  } catch (err) {
    // 表可能尚未创建（未执行 schema 升级）
    if (String(err && err.message || '').toLowerCase().includes("doesn't exist")) {
      return []
    }
    throw err
  }
}

async function resetSessionState(sessionId) {
  if (!sessionId) return { ok: false, error: 'missing session_id' }
  const sql = `
    UPDATE session_reply_state
    SET state = 'auto',
        cooldown_since = NULL,
        last_notify_at = NULL,
        followup_sent = 0,
        default_reply_count = 0
    WHERE session_id = ?
  `
  const result = await mysqlAdapter.run(sql, [sessionId])
  return { ok: true, affected: result && result.affectedRows ? result.affectedRows : 0 }
}

async function acceptTakeoverTask({ taskId, operator }) {
  return await mysqlAdapter.run(`
    UPDATE takeover_tasks
    SET status = 'accepted', assigned_to = ?, accepted_at = ${nowExpr()}, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [operator, taskId]).changes
}

async function closeTakeoverTask({ taskId, resolution }) {
  return await mysqlAdapter.run(`
    UPDATE takeover_tasks
    SET status = 'closed', resolution = ?, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [resolution ?? '', taskId]).changes
}

function normalizeCellText(value) {
  return String(value ?? '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n')
}

function parseExcelDayNumber(value) {
  const text = String(value ?? '').trim()
  if (!text || !/^\d{1,2}$/.test(text)) return null
  const day = Number.parseInt(text, 10)
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null
}

function buildImportMonthByFile(filePath, rows = []) {
  const base = path.basename(filePath, path.extname(filePath))
  const matched = base.match(/(20\d{2})[-_/年]?(\d{1,2})/)
  if (matched) return { year: Number.parseInt(matched[1], 10), month: Number.parseInt(matched[2], 10) }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function buildImportDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function inferModelCodeFromUnitCode(unitCode) {
  const text = String(unitCode || '').trim()
  if (!text) return ''
  return text
    .replace(/[-_]?\d+$/i, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function parseScheduleCell(cellText = '') {
  const normalized = normalizeCellText(cellText)
  if (!normalized) return { customerName: '', markers: [], rawText: '' }
  const lines = normalized.split('\n').map((item) => item.trim()).filter(Boolean)
  const markers = lines.filter((item) => item === '发货' || item === '到货')
  const customerParts = lines.filter((item) => item !== '发货' && item !== '到货')
  return {
    customerName: customerParts.join(' '),
    markers,
    rawText: normalized,
  }
}

function readOrderImportWorkbook(filePath) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error('Excel 文件不存在')
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 工作表为空')
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
  if (!rows.length) throw new Error('Excel 内容为空')
  return { workbook, sheetName, rows }
}

function buildOrderImportPreview({ filePath }) {
  const { sheetName, rows } = readOrderImportWorkbook(filePath)
  const monthInfo = buildImportMonthByFile(filePath, rows)
  const headerIndex = rows.findIndex((row = []) => row.some((cell) => parseExcelDayNumber(cell)))
  if (headerIndex < 0) throw new Error('未识别到日期表头行')
  const headerRow = rows[headerIndex] || []
  const feeColIndex = headerRow.findIndex((cell) => String(cell || '').trim() === '收益')
  if (feeColIndex < 0) throw new Error('未识别到收益列')

  const dateColumns = []
  for (let col = 1; col < feeColIndex; col += 1) {
    const day = parseExcelDayNumber(headerRow[col])
    if (!day) continue
    dateColumns.push({ colIndex: col, day, date: buildImportDate(monthInfo.year, monthInfo.month, day) })
  }
  if (!dateColumns.length) throw new Error('未识别到有效日期列')

  const unitRows = []
  const draftGroups = []
  const errors = []

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || []
    const unitCode = normalizeCellText(row[0])
    if (!unitCode) continue

    const modelCode = inferModelCodeFromUnitCode(unitCode)
    const feeText = normalizeCellText(row[feeColIndex])
    const fee = Number.parseFloat(String(row[feeColIndex] ?? '').replace(/,/g, '')) || 0
    const hasScheduleContent = dateColumns.some((column) => normalizeCellText(row[column.colIndex]))
    const looksLikeUnitRow = /\d/.test(unitCode) || unitCode.includes('-') || unitCode.includes('_')
    if (!hasScheduleContent && !feeText && !looksLikeUnitRow) continue
    if (!hasScheduleContent && !feeText) continue

    const rowDrafts = []
    const pendingShipMarkers = []
    const pendingArriveMarkers = []
    unitRows.push({
      rowIndex: rowIndex + 1,
      unitCode,
      modelCode,
      fee,
    })

    let activeSegment = null
    for (const column of dateColumns) {
      const parsed = parseScheduleCell(row[column.colIndex])
      const cellText = normalizeCellText(row[column.colIndex])
      const customerName = parsed.customerName.trim()
      const hasShipMarker = cellText.includes('发货')
      const hasArriveMarker = cellText.includes('到货')

      if (!customerName) {
        if (hasShipMarker) pendingShipMarkers.push(column.date)
        if (hasArriveMarker) pendingArriveMarkers.push(column.date)
        if (activeSegment) {
          rowDrafts.push(activeSegment)
          activeSegment = null
        }
        continue
      }

      if (activeSegment && activeSegment.customerName === customerName) {
        activeSegment.rentEndDate = column.date
        activeSegment.endDay = column.day
        activeSegment.rawTexts.push(parsed.rawText)
        activeSegment.markers.push(...parsed.markers)
        if (hasShipMarker) activeSegment.shipMarkers.push(column.date)
        if (hasArriveMarker) activeSegment.arriveMarkers.push(column.date)
        continue
      }

      if (activeSegment) rowDrafts.push(activeSegment)
      activeSegment = {
        rowIndex: rowIndex + 1,
        unitCode,
        modelCode,
        rowFee: fee,
        customerName,
        rentStartDate: column.date,
        rentEndDate: column.date,
        startDay: column.day,
        endDay: column.day,
        rawTexts: [parsed.rawText],
        markers: [...parsed.markers],
        shipMarkers: pendingShipMarkers.splice(0, pendingShipMarkers.length),
        arriveMarkers: pendingArriveMarkers.splice(0, pendingArriveMarkers.length),
      }
      if (hasShipMarker) activeSegment.shipMarkers.push(column.date)
      if (hasArriveMarker) activeSegment.arriveMarkers.push(column.date)
    }
    if (activeSegment) rowDrafts.push(activeSegment)

    const totalDays = rowDrafts.reduce((sum, item) => sum + (item.endDay - item.startDay + 1), 0)
    const allocatedFees = []
    rowDrafts.forEach((item, index) => {
      const days = item.endDay - item.startDay + 1
      if (!fee || !totalDays) {
        allocatedFees.push(0)
        return
      }
      if (index === rowDrafts.length - 1) {
        const used = allocatedFees.reduce((sum, value) => sum + value, 0)
        allocatedFees.push(Math.max(0, Number((fee - used).toFixed(2))))
        return
      }
      allocatedFees.push(Number(((fee * days) / totalDays).toFixed(2)))
    })

    rowDrafts.forEach((item, index) => {
      if (!item.arriveMarkers.length && pendingArriveMarkers.length) {
        item.arriveMarkers.push(...pendingArriveMarkers.splice(0, pendingArriveMarkers.length))
      }
      if (!item.shipMarkers.length && index > 0 && rowDrafts[index - 1]?.shipMarkers?.length) {
        item.shipMarkers.push(...rowDrafts[index - 1].shipMarkers)
      }
    })

    pendingShipMarkers.length = 0
    pendingArriveMarkers.length = 0

    rowDrafts.forEach((item, index) => {
      if (!item.shipMarkers.length && index > 0) item.shipMarkers = [...rowDrafts[index - 1].shipMarkers]
    })

    rowDrafts.forEach((item, index) => {
      if (!item.arriveMarkers.length && rowDrafts[index + 1]?.arriveMarkers?.length) {
        item.arriveMarkers = [...rowDrafts[index + 1].arriveMarkers]
      }
    })

    rowDrafts.forEach((item, index) => {
      item.shipMarkers = Array.from(new Set(item.shipMarkers)).sort()
      item.arriveMarkers = Array.from(new Set(item.arriveMarkers)).sort()
    })

    rowDrafts.forEach((item, index) => {
      item.allocatedFee = allocatedFees[index] ?? 0
    })

    rowDrafts.forEach((item) => {
      draftGroups.push({
        ...item,
        fee: item.allocatedFee,
        segmentDays: item.endDay - item.startDay + 1,
      })
    })

    continue
  }

  const previewItems = draftGroups.map((draft, index) => {
    const problems = []
    if (!draft.modelCode) problems.push('未识别型号编码')
    if (!draft.unitCode) problems.push('未识别设备编码')
    if (!draft.customerName) problems.push('未识别租客名称')
    const firstShipAt = draft.shipMarkers[0] || ''
    const lastArriveAt = draft.arriveMarkers[draft.arriveMarkers.length - 1] || ''
    return {
      draftId: `${draft.rowIndex}-${index + 1}`,
      rowIndex: draft.rowIndex,
      unitCode: draft.unitCode,
      modelCode: draft.modelCode,
      customerName: draft.customerName,
      rentStartDate: draft.rentStartDate,
      rentEndDate: draft.rentEndDate,
      fee: draft.fee,
      rowFee: draft.rowFee,
      segmentDays: draft.segmentDays,
      dayRange: `${draft.startDay}-${draft.endDay}`,
      markerSummary: Array.from(new Set(draft.markers)).join(' / ') || '-',
      firstShipAt,
      lastArriveAt,
      boundarySummary: [firstShipAt ? `发货:${firstShipAt}` : '', lastArriveAt ? `到货:${lastArriveAt}` : ''].filter(Boolean).join('，') || '-',
      rawText: draft.rawTexts.join('\n---\n'),
      canImport: problems.length === 0,
      error: problems.join('；') || '',
    }
  })

  for (const item of previewItems) {
    if (!item.canImport) errors.push({ draftId: item.draftId, rowIndex: item.rowIndex, message: item.error })
  }

  return {
    ok: true,
    filePath,
    sheetName,
    month: `${monthInfo.year}-${pad2(monthInfo.month)}`,
    totalUnits: unitRows.length,
    totalDrafts: previewItems.length,
    validDrafts: previewItems.filter((item) => item.canImport).length,
    invalidDrafts: previewItems.filter((item) => !item.canImport).length,
    units: unitRows,
    previews: previewItems,
    errors,
  }
}

async function previewOrderImportExcel({ filePath }) {
  try {
    return buildOrderImportPreview({ filePath })
  } catch (error) {
    return { ok: false, filePath, message: error.message, previews: [], units: [], errors: [] }
  }
}

async function importOrderImportExcel({ filePath } = {}) {
  const preview = buildOrderImportPreview({ filePath })
  const unitsToEnsure = preview.units.filter((unit) => unit.unitCode && unit.modelCode)
  const ensureUnit = await mysqlAdapter.run('SELECT id, unit_code, model_code FROM schedule_units WHERE unit_code = ? LIMIT 1')
  const results = []

  for (const unit of unitsToEnsure) {
    const existing = ensureUnit.get(unit.unitCode)
    if (!existing) {
      saveScheduleUnit({
        modelCode: unit.modelCode,
        unitCode: unit.unitCode,
        status: 'idle',
        note: 'Excel 导入创建',
      })
      continue
    }
    if (existing.model_code !== unit.modelCode) {
      saveScheduleUnit({
        id: existing.id,
        modelCode: unit.modelCode,
        unitCode: unit.unitCode,
        status: 'idle',
        note: 'Excel 导入校正型号',
      })
    }
  }

  for (const item of preview.previews) {
    if (!item.canImport) {
      results.push({ ...item, ok: false, message: item.error || '预检失败' })
      continue
    }

    const unit = ensureUnit.get(item.unitCode)
    if (!unit) {
      results.push({ ...item, ok: false, message: '设备创建失败' })
      continue
    }

    const overlap = await mysqlAdapter.get(`
      SELECT o.id, o.customer_name, o.rent_start_date, o.rent_end_date
      FROM rental_orders o
      WHERE o.unit_id = ?
        AND NOT (o.rent_end_date < ? OR o.rent_start_date > ?)
      LIMIT 1
    `, [unit.id, item.rentStartDate, item.rentEndDate])
    if (overlap) {
      results.push({
        ...item,
        ok: false,
        message: `已有重叠订单 #${overlap.id}（${overlap.rent_start_date}~${overlap.rent_end_date}）`,
      })
      continue
    }

    try {
      const created = await createOrder({
        orderNo: `excel-${item.unitCode}-${item.rentStartDate}-${item.rentEndDate}`,
        customerName: item.customerName,
        modelCode: item.modelCode,
        unitId: unit.id,
        rentStartDate: item.rentStartDate,
        rentEndDate: item.rentEndDate,
        fee: item.fee || 0,
        orderStatus: 'active',
        shippingMode: 'land',
        latestLogisticsStatus: 'Excel 导入占用',
      })
      results.push({
        ...item,
        ok: true,
        orderId: created.id,
        unitId: unit.id,
        message: '导入成功',
      })
    } catch (error) {
      results.push({ ...item, ok: false, message: error.message || '导入失败' })
    }
  }

  return {
    ok: true,
    filePath,
    totalUnits: preview.totalUnits,
    totalDrafts: preview.totalDrafts,
    successCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
    results,
  }
}

async function listScheduleUnits(filters = {}) {
  const { modelCode, status, keyword, activeInventoryOnly } = filters
  const where = []
  const params = []
  const effectiveStatusExpr = `
    CASE
      WHEN su.status IN ('repair', 'offline') THEN su.status
      WHEN EXISTS (
        SELECT 1 FROM schedule_blocks sb
        LEFT JOIN rental_orders ro ON ro.id = sb.order_id
        WHERE sb.unit_id = su.id
          AND sb.status = 'active'
          AND sb.start_date <= CURDATE()
          AND sb.end_date >= CURDATE()
          AND (ro.id IS NULL OR ro.order_status NOT IN ('completed', 'cancelled'))
      ) THEN 'busy'
      ELSE 'idle'
    END
  `
  if (modelCode) {
    where.push('su.model_code = ?')
    params.push(modelCode)
  }
  if (status) {
    where.push(`${effectiveStatusExpr} = ?`)
    params.push(status)
  }
  if (keyword) {
    where.push('(su.model_code LIKE ? OR su.unit_code LIKE ? OR su.serial_no LIKE ? OR su.city LIKE ? OR su.note LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  const sql = `
    SELECT
      su.*,
      ${effectiveStatusExpr} AS effective_status
    FROM schedule_units su
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY su.model_code ASC, su.unit_code ASC
  `
  const rows = await mysqlAdapter.all(sql, params)
  return rows.filter((row) => !activeInventoryOnly || isCurrentInventoryUnit(row)).map((row) => ({
    ...row,
    raw_status: row.status,
    status: row.effective_status || row.status,
  }))
}

async function saveScheduleUnit({ id, modelCode, unitCode, serialNo, city, status = 'idle', note, purchaseCost = 0, residualValue = 0 }) {
  const normalizedModelCode = String(modelCode || '').trim()
  const normalizedUnitCode = String(unitCode || '').trim()
  if (!normalizedModelCode) return { ok: false, message: '型号编码不能为空' }
  if (!normalizedUnitCode) return { ok: false, message: '设备编码不能为空' }
  const duplicate = await mysqlAdapter.get(
    'SELECT id, model_code, unit_code, status FROM schedule_units WHERE unit_code = ? AND (? IS NULL OR id != ?) LIMIT 1',
    [normalizedUnitCode, id || null, id || null],
  )
  if (duplicate && id) return { ok: false, message: `设备编码 ${normalizedUnitCode} 已存在，请换一个编号` }
  const normalizedPurchaseCost = Number(purchaseCost || 0)
  const normalizedResidualValue = Number(residualValue || 0)
  try {
    if (id) {
      const result = await mysqlAdapter.run(`
        UPDATE schedule_units
        SET model_code = ?, unit_code = ?, serial_no = ?, city = ?, status = ?, note = ?, purchase_cost = ?, residual_value = ?, updated_at = ${nowExpr()}
        WHERE id = ?
      `, [normalizedModelCode, normalizedUnitCode, serialNo ?? null, city ?? null, status, note ?? null, normalizedPurchaseCost, normalizedResidualValue, id])
      return { ok: result.changes > 0, id, message: result.changes > 0 ? '设备已更新' : '设备不存在' }
    }
    if (duplicate) {
      if (!isRestorableScheduleUnit(duplicate)) {
        return { ok: false, message: `设备编码 ${normalizedUnitCode} 已是当前设备，请换一个编号` }
      }
      await archiveHistoricalScheduleUnit(duplicate)
    }
    const result = await mysqlAdapter.run(`
      INSERT INTO schedule_units (model_code, unit_code, serial_no, city, status, note, purchase_cost, residual_value, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
    `, [normalizedModelCode, normalizedUnitCode, serialNo ?? null, city ?? null, status, note ?? null, normalizedPurchaseCost, normalizedResidualValue])
    return { ok: true, id: result.lastInsertRowid, message: '设备已保存' }
  } catch (error) {
    const text = String(error?.message || error || '')
    if (/duplicate|unique/i.test(text)) return { ok: false, message: `设备编码 ${normalizedUnitCode} 已存在，请换一个编号` }
    return { ok: false, message: `设备保存失败：${text || '未知错误'}` }
  }
}

async function syncScheduleUnitStatus(unitId) {
  if (!unitId) return
  const unit = await mysqlAdapter.get('SELECT id, status FROM schedule_units WHERE id = ? LIMIT 1', [unitId])
  if (!unit || ['repair', 'offline'].includes(unit.status)) return
  const linked = await mysqlAdapter.get(`
    SELECT COUNT(*) AS count
    FROM rental_orders
    WHERE unit_id = ?
      AND order_status NOT IN ('completed', 'cancelled')
  `, [unitId])
  const nextStatus = Number(linked?.count || 0) > 0 ? 'busy' : 'idle'
  if (unit.status === nextStatus) return
  await mysqlAdapter.run(`
    UPDATE schedule_units
    SET status = ?, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [nextStatus, unitId])
}

async function updateScheduleUnitsByModel({ modelCode, city, status, note, purchaseCost, residualValue, activeInventoryOnly }) {
  const normalizedModelCode = String(modelCode || '').trim()
  if (!normalizedModelCode) return { ok: false, message: '型号编码不能为空' }
  const assignments = []
  const params = []
  const hasPurchaseCost = purchaseCost !== undefined && purchaseCost !== null && purchaseCost !== ''
  const hasResidualValue = residualValue !== undefined && residualValue !== null && residualValue !== ''
  assignments.push('city = ?')
  params.push(city ?? null)
  if (status) {
    assignments.push('status = ?')
    params.push(status)
  }
  assignments.push('note = ?')
  params.push(note ?? null)
  if (hasPurchaseCost) {
    assignments.push('purchase_cost = ?')
    params.push(Number(purchaseCost || 0))
  }
  if (hasResidualValue) {
    assignments.push('residual_value = ?')
    params.push(Number(residualValue || 0))
  }
  assignments.push(`updated_at = ${nowExpr()}`)
  const where = ['model_code = ?']
  params.push(normalizedModelCode)
  if (activeInventoryOnly) {
    const candidates = await mysqlAdapter.all('SELECT id, model_code, unit_code FROM schedule_units WHERE model_code = ?', [normalizedModelCode])
    const ids = candidates.filter(isCurrentInventoryUnit).map((unit) => unit.id)
    if (!ids.length) return { ok: false, message: '未找到可更新的现役设备', updatedCount: 0 }
    where.length = 0
    where.push(`id IN (${ids.map(() => '?').join(', ')})`)
    params.length = 0
    params.push(city ?? null)
    if (status) params.push(status)
    params.push(note ?? null)
    if (hasPurchaseCost) params.push(Number(purchaseCost || 0))
    if (hasResidualValue) params.push(Number(residualValue || 0))
    params.push(...ids)
  }
  const result = await mysqlAdapter.run(`
    UPDATE schedule_units
    SET ${assignments.join(', ')}
    WHERE ${where.join(' AND ')}
  `, params)
  return {
    ok: result.changes > 0,
    message: result.changes > 0 ? `已更新 ${normalizedModelCode} 的 ${result.changes} 台设备` : '未找到可更新设备',
    updatedCount: result.changes || 0,
  }
}

async function deleteScheduleUnit(id) {
  const linked = await mysqlAdapter.get('SELECT COUNT(*) AS count FROM rental_orders WHERE unit_id = ?', [id])
  const blocked = Number(linked?.count || 0) > 0
  if (blocked) return { ok: false, message: '该设备已有订单记录，不能删除' }
  const result = await mysqlAdapter.run('DELETE FROM schedule_units WHERE id = ?', [id])
  return { ok: result.changes > 0, message: result.changes > 0 ? '设备已删除' : '设备不存在' }
}

async function deleteOrder({ orderId } = {}) {
  const normalizedOrderId = Number.parseInt(String(orderId || ''), 10)
  if (!Number.isFinite(normalizedOrderId) || normalizedOrderId <= 0) {
    return { ok: false, message: '订单 ID 无效' }
  }
  const order = await mysqlAdapter.get('SELECT id, order_no FROM rental_orders WHERE id = ? LIMIT 1', [normalizedOrderId])
  if (!order) return { ok: false, message: '订单不存在' }
  return await mysqlAdapter.transaction(async (tx) => {
    await tx.run('DELETE FROM shipping_records WHERE order_id = ?', [normalizedOrderId])
    await tx.run('DELETE FROM schedule_blocks WHERE order_id = ?', [normalizedOrderId])
    const result = await tx.run('DELETE FROM rental_orders WHERE id = ?', [normalizedOrderId])
    return {
      ok: result.changes > 0,
      message: result.changes > 0 ? '订单已删除，相关档期和物流记录已同步清理' : '订单删除失败',
      orderId: normalizedOrderId,
    }
  })
}

async function updateOrderFee({ orderId, fee } = {}) {
  const normalizedOrderId = Number.parseInt(String(orderId || ''), 10)
  const nextFee = Number(fee)
  if (!Number.isFinite(normalizedOrderId) || normalizedOrderId <= 0) {
    return { ok: false, message: '订单 ID 无效' }
  }
  if (!Number.isFinite(nextFee) || nextFee < 0) {
    return { ok: false, message: '订单租金无效' }
  }
  const order = await getOrderById(normalizedOrderId)
  if (!order) return { ok: false, message: '订单不存在' }
  await mysqlAdapter.run(`
    UPDATE rental_orders
    SET fee = ?, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [Number(nextFee.toFixed(2)), normalizedOrderId])
  const updatedOrder = await getOrderById(normalizedOrderId)
  return { ok: true, message: '订单租金已更新', order: updatedOrder }
}

/* =========================================================
 * Sprint 4: rental_pricing & item_model_mapping 运营维护 CRUD
 * ========================================================= */

async function ensureRentalPricingTable() {
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS rental_pricing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      model_code VARCHAR(100) NOT NULL,
      min_days INT NOT NULL,
      max_days INT NOT NULL,
      daily_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NULL,
      extension_daily_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
      remark VARCHAR(255),
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pricing_model (model_code, active)
    ) ENGINE=InnoDB
  `)
  await ensureColumn('rental_pricing', 'total_price', 'DECIMAL(10,2) NULL')
  await ensureColumn('rental_pricing', 'extension_daily_price', 'DECIMAL(10,2) NOT NULL DEFAULT 0')
}

async function ensureDepositExemptionRulesTable() {
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS deposit_exemption_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      min_asset_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      max_asset_value DECIMAL(10,2) NULL,
      min_zhima_score INT NOT NULL DEFAULT 0,
      adult_required TINYINT(1) NOT NULL DEFAULT 1,
      real_name_required TINYINT(1) NOT NULL DEFAULT 1,
      unsupported_cert_text VARCHAR(255) DEFAULT '港澳通行证不支持',
      deposit_mode VARCHAR(32) NOT NULL DEFAULT 'asset_value',
      fixed_deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      remark VARCHAR(255),
      sort_order INT NOT NULL DEFAULT 100,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_deposit_exemption_rules_active (active, sort_order),
      INDEX idx_deposit_exemption_rules_range (min_asset_value, max_asset_value)
    ) ENGINE=InnoDB
  `)
}

async function ensureDepositAuditTables() {
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS deposit_orders (
      deposit_order_no VARCHAR(120) PRIMARY KEY,
      order_id INT NULL,
      source_type VARCHAR(32) NOT NULL DEFAULT 'order',
      source_order_id VARCHAR(120) NULL,
      source_order_no VARCHAR(255) NULL,
      product_name VARCHAR(255) NULL,
      model_code VARCHAR(100) NULL,
      unit_code VARCHAR(100) NULL,
      customer_name VARCHAR(255) NULL,
      customer_phone VARCHAR(64) NULL,
      deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      rent_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      rent_start_date VARCHAR(20) NULL,
      rent_end_date VARCHAR(20) NULL,
      rent_days INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
      status_label VARCHAR(64) NULL,
      review_url TEXT NULL,
      qr_image_url TEXT NULL,
      is_latest TINYINT(1) NOT NULL DEFAULT 1,
      third_party_created_at DATETIME NULL,
      third_party_updated_at DATETIME NULL,
      last_event_type VARCHAR(64) NULL,
      last_event_source VARCHAR(64) NULL,
      last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_snapshot_json LONGTEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_deposit_orders_source_order (source_order_id, source_order_no),
      INDEX idx_deposit_orders_status (status, updated_at),
      INDEX idx_deposit_orders_model (model_code, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS deposit_order_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      deposit_order_no VARCHAR(120) NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      event_source VARCHAR(64) NOT NULL DEFAULT 'unknown',
      from_status VARCHAR(32) NULL,
      to_status VARCHAR(32) NULL,
      payload_json LONGTEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deposit_order_events_order (deposit_order_no, created_at DESC),
      INDEX idx_deposit_order_events_type (event_type, created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureItemCacheTable() {
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS item_cache (
      item_id VARCHAR(255) PRIMARY KEY,
      data LONGTEXT NOT NULL,
      price DECIMAL(10,2) NULL,
      description TEXT NULL,
      biz_item_code VARCHAR(100) NULL,
      biz_item_code_source VARCHAR(100) NULL,
      detail_source VARCHAR(100) NULL,
      detail_updated_at DATETIME NULL,
      detail_dirty TINYINT(1) NOT NULL DEFAULT 0,
      dirty_reason TEXT NULL,
      last_refresh_attempt_at DATETIME NULL,
      refresh_fail_count INT NOT NULL DEFAULT 0,
      refresh_backoff_until DATETIME NULL,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_item_cache_biz (biz_item_code),
      INDEX idx_item_cache_updated (detail_updated_at, last_updated)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureInquiryEventsTable() {
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS inquiry_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(64) NOT NULL DEFAULT 'unknown',
      store_id INT NULL,
      chat_id VARCHAR(255),
      message_id VARCHAR(255),
      raw_text TEXT,
      model_code VARCHAR(100),
      rent_start_date DATE NULL,
      rent_end_date DATE NULL,
      rent_days INT NOT NULL DEFAULT 0,
      province VARCHAR(100),
      city VARCHAR(100),
      district VARCHAR(100),
      address TEXT,
      shipping_mode VARCHAR(32) DEFAULT 'land',
      available TINYINT(1) NOT NULL DEFAULT 0,
      total_unit_count INT NOT NULL DEFAULT 0,
      available_unit_count INT NOT NULL DEFAULT 0,
      conflict_unit_count INT NOT NULL DEFAULT 0,
      quoted_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      quote_days INT NOT NULL DEFAULT 0,
      deposit_summary TEXT,
      planned_ship_at DATETIME NULL,
      expected_arrive_at DATETIME NULL,
      ship_date DATE NULL,
      arrive_date DATE NULL,
      availability_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
      order_id INT NULL,
      final_fee DECIMAL(10,2) NULL,
      converted_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_inquiry_events_created (created_at),
      INDEX idx_inquiry_events_model_created (model_code, created_at),
      INDEX idx_inquiry_events_store_created (store_id, created_at),
      INDEX idx_inquiry_events_order (order_id),
      INDEX idx_inquiry_events_chat (source, chat_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureSfShippingTables() {
  await mysqlAdapter.run(`
    CREATE TABLE IF NOT EXISTS sf_shipments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipment_no VARCHAR(80) NOT NULL UNIQUE,
      linked_order_id INT NULL,
      service_kind VARCHAR(32) NOT NULL DEFAULT 'express',
      product_code VARCHAR(40) NOT NULL,
      express_type_id INT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      sender_name VARCHAR(100),
      sender_mobile VARCHAR(50),
      sender_province VARCHAR(100),
      sender_city VARCHAR(100),
      sender_district VARCHAR(100),
      sender_address TEXT,
      receiver_name VARCHAR(100),
      receiver_mobile VARCHAR(50),
      receiver_province VARCHAR(100),
      receiver_city VARCHAR(100),
      receiver_district VARCHAR(100),
      receiver_address TEXT,
      cargo_name VARCHAR(100),
      weight_kg DECIMAL(10,3) NOT NULL DEFAULT 1,
      pay_method INT NOT NULL DEFAULT 1,
      monthly_card_tail VARCHAR(8),
      tracking_no VARCHAR(255),
      planned_send_at VARCHAR(30),
      expected_arrive_at VARCHAR(30),
      filter_result INT NULL,
      quote_fee DECIMAL(10,2) NULL,
      estimated_fee DECIMAL(10,2) NULL,
      billed_fee DECIMAL(10,2) NULL,
      actual_paid_fee DECIMAL(10,2) NULL,
      actual_paid_source VARCHAR(32) NULL,
      actual_paid_note TEXT NULL,
      expense_record_id INT NULL,
      service_message TEXT,
      precheck_result_json JSON NULL,
      submit_result_json JSON NULL,
      promise_result_json JSON NULL,
      billed_fee_detail_json JSON NULL,
      cancel_result_json JSON NULL,
      routes_result_json JSON NULL,
      fee_result_json JSON NULL,
      cancelled_at DATETIME NULL,
      routes_updated_at DATETIME NULL,
      fee_updated_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sf_shipments_status (status, created_at DESC),
      INDEX idx_sf_shipments_order (linked_order_id, created_at DESC),
      INDEX idx_sf_shipments_tracking (tracking_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await mysqlAdapter.run(`
    CREATE TABLE IF NOT EXISTS sf_shipment_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shipment_id INT NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      status VARCHAR(32),
      message TEXT,
      detail_json JSON NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sf_shipment_events_shipment (shipment_id, created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  const shipmentColumns = [
    'estimated_fee DECIMAL(10,2) NULL',
    'billed_fee DECIMAL(10,2) NULL',
    'actual_paid_fee DECIMAL(10,2) NULL',
    'actual_paid_source VARCHAR(32) NULL',
    'actual_paid_note TEXT NULL',
    'expense_record_id INT NULL',
    'billed_fee_detail_json JSON NULL',
    'cancel_result_json JSON NULL',
    'routes_result_json JSON NULL',
    'fee_result_json JSON NULL',
    'cancelled_at DATETIME NULL',
    'routes_updated_at DATETIME NULL',
    'fee_updated_at DATETIME NULL',
  ]
  for (const column of shipmentColumns) {
    try {
      await mysqlAdapter.exec(`ALTER TABLE sf_shipments ADD COLUMN ${column}`)
    } catch {}
  }
}

async function ensureItemModelMappingTable() {
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS item_model_mapping (
      item_id VARCHAR(255) PRIMARY KEY,
      model_code VARCHAR(100),
      biz_item_code VARCHAR(100),
      source VARCHAR(32) NOT NULL DEFAULT 'manual',
      note VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_item_model_mapping_model (model_code),
      INDEX idx_item_model_mapping_biz (biz_item_code)
    ) ENGINE=InnoDB
  `)
  try {
    await mysqlAdapter.exec('ALTER TABLE item_model_mapping ADD COLUMN biz_item_code VARCHAR(100) NULL AFTER model_code')
  } catch {}
  try {
    await mysqlAdapter.exec('ALTER TABLE item_model_mapping MODIFY COLUMN model_code VARCHAR(100) NULL')
  } catch {}
  try {
    await mysqlAdapter.exec('CREATE INDEX idx_item_model_mapping_biz ON item_model_mapping (biz_item_code)')
  } catch {}
}

async function ensureXianyuItemListingsTable() {
  await mysqlAdapter.exec(`
    CREATE TABLE IF NOT EXISTS xianyu_item_listings (
      account_id VARCHAR(64) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      title VARCHAR(500),
      description TEXT,
      cover_url TEXT,
      sold_price DECIMAL(10,2) DEFAULT 0,
      quantity INT DEFAULT 0,
      biz_item_code VARCHAR(100),
      model_code VARCHAR(100),
      owner_account_id VARCHAR(64),
      code_source VARCHAR(64),
      raw_json LONGTEXT,
      sync_source VARCHAR(64) NOT NULL DEFAULT 'local_cache',
      review_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      detail_updated_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id, item_id),
      INDEX idx_xianyu_item_listings_account (account_id, review_status),
      INDEX idx_xianyu_item_listings_biz (biz_item_code),
      INDEX idx_xianyu_item_listings_model (model_code),
      INDEX idx_xianyu_item_listings_owner (owner_account_id)
    ) ENGINE=InnoDB
  `)
  try { await mysqlAdapter.exec('ALTER TABLE xianyu_item_listings ADD COLUMN owner_account_id VARCHAR(64) NULL AFTER model_code') } catch {}
  try { await mysqlAdapter.exec('CREATE INDEX idx_xianyu_item_listings_owner ON xianyu_item_listings (owner_account_id)') } catch {}
}

async function recordDepositOrderEvent({
  depositOrderNo,
  eventType = 'sync',
  eventSource = 'unknown',
  fromStatus = null,
  toStatus = null,
  payload = null,
} = {}) {
  if (!depositOrderNo) return { ok: false, message: 'deposit_order_no 不能为空' }
  await ensureDepositAuditTables()
  const payloadJson = payload == null ? null : JSON.stringify(payload)
  const result = await mysqlAdapter.run(`
    INSERT INTO deposit_order_events (
      deposit_order_no, event_type, event_source, from_status, to_status, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [depositOrderNo, eventType, eventSource, fromStatus, toStatus, payloadJson])
  return { ok: true, id: result.lastInsertRowid }
}

async function getStoredDepositOrder(depositOrderNo) {
  if (!depositOrderNo) return null
  await ensureDepositAuditTables()
  return await mysqlAdapter.get(`
    SELECT
      deposit_order_no AS depositOrderNo,
      order_id AS orderId,
      source_type AS sourceType,
      source_order_id AS sourceOrderId,
      source_order_no AS sourceOrderNo,
      product_name AS productName,
      model_code AS modelCode,
      unit_code AS unitCode,
      customer_name AS customerName,
      customer_phone AS customerPhone,
      deposit_amount AS depositAmount,
      rent_amount AS rentAmount,
      rent_start_date AS rentStartDate,
      rent_end_date AS rentEndDate,
      rent_days AS rentDays,
      status,
      status_label AS statusLabel,
      review_url AS reviewUrl,
      qr_image_url AS qrImageUrl,
      is_latest AS isLatest,
      third_party_created_at AS thirdPartyCreatedAt,
      third_party_updated_at AS thirdPartyUpdatedAt,
      last_event_type AS lastEventType,
      last_event_source AS lastEventSource,
      last_synced_at AS lastSyncedAt,
      raw_snapshot_json AS rawSnapshotJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM deposit_orders
    WHERE deposit_order_no = ?
  `, [depositOrderNo])
}

async function listStoredDepositOrders(filters = {}) {
  await ensureDepositAuditTables()
  const where = []
  const params = []
  if (filters.depositOrderNo) {
    where.push('deposit_order_no = ?')
    params.push(filters.depositOrderNo)
  }
  if (filters.sourceOrderId !== undefined && filters.sourceOrderId !== null && filters.sourceOrderId !== '') {
    where.push('source_order_id = ?')
    params.push(String(filters.sourceOrderId))
  }
  if (filters.sourceOrderNo) {
    where.push('source_order_no = ?')
    params.push(filters.sourceOrderNo)
  }
  if (filters.status) {
    where.push('status = ?')
    params.push(filters.status)
  }
  if (filters.isLatest !== undefined && filters.isLatest !== null && filters.isLatest !== '') {
    where.push('is_latest = ?')
    params.push(Number(filters.isLatest) ? 1 : 0)
  }
  if (filters.keyword) {
    where.push('(deposit_order_no LIKE ? OR source_order_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR unit_code LIKE ? OR product_name LIKE ?)')
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`)
  }
  return await mysqlAdapter.all(`
    SELECT
      deposit_order_no AS depositOrderNo,
      order_id AS orderId,
      source_type AS sourceType,
      source_order_id AS sourceOrderId,
      source_order_no AS sourceOrderNo,
      product_name AS productName,
      model_code AS modelCode,
      unit_code AS unitCode,
      customer_name AS customerName,
      customer_phone AS customerPhone,
      deposit_amount AS depositAmount,
      rent_amount AS rentAmount,
      rent_start_date AS rentStartDate,
      rent_end_date AS rentEndDate,
      rent_days AS rentDays,
      status,
      status_label AS statusLabel,
      review_url AS reviewUrl,
      qr_image_url AS qrImageUrl,
      is_latest AS isLatest,
      third_party_created_at AS thirdPartyCreatedAt,
      third_party_updated_at AS thirdPartyUpdatedAt,
      last_event_type AS lastEventType,
      last_event_source AS lastEventSource,
      last_synced_at AS lastSyncedAt,
      raw_snapshot_json AS rawSnapshotJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM deposit_orders
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, created_at DESC
  `, params)
}

async function upsertStoredDepositOrder(order = {}, options = {}) {
  await ensureDepositAuditTables()
  const snapshot = normalizeDepositOrderSnapshot(order, options.overrides || {})
  if (!snapshot.depositOrderNo) return { ok: false, message: 'deposit_order_no 不能为空' }
  const previous = await getStoredDepositOrder(snapshot.depositOrderNo)
  const effectiveIsLatest = options.keepLatestFlag && previous ? Number(previous.isLatest || 0) : snapshot.isLatest
  const eventType = options.eventType || 'sync'
  const eventSource = options.eventSource || 'unknown'

  await mysqlAdapter.run(`
    INSERT INTO deposit_orders (
      deposit_order_no, order_id, source_type, source_order_id, source_order_no,
      product_name, model_code, unit_code, customer_name, customer_phone,
      deposit_amount, rent_amount, rent_start_date, rent_end_date, rent_days,
      status, status_label, review_url, qr_image_url, is_latest,
      third_party_created_at, third_party_updated_at, last_event_type, last_event_source,
      last_synced_at, raw_snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON DUPLICATE KEY UPDATE
      order_id = VALUES(order_id),
      source_type = COALESCE(NULLIF(VALUES(source_type), ''), source_type),
      source_order_id = COALESCE(NULLIF(VALUES(source_order_id), ''), source_order_id),
      source_order_no = COALESCE(NULLIF(VALUES(source_order_no), ''), source_order_no),
      product_name = COALESCE(NULLIF(VALUES(product_name), ''), product_name),
      model_code = COALESCE(NULLIF(VALUES(model_code), ''), model_code),
      unit_code = COALESCE(NULLIF(VALUES(unit_code), ''), unit_code),
      customer_name = COALESCE(NULLIF(VALUES(customer_name), ''), customer_name),
      customer_phone = COALESCE(NULLIF(VALUES(customer_phone), ''), customer_phone),
      deposit_amount = VALUES(deposit_amount),
      rent_amount = VALUES(rent_amount),
      rent_start_date = COALESCE(NULLIF(VALUES(rent_start_date), ''), rent_start_date),
      rent_end_date = COALESCE(NULLIF(VALUES(rent_end_date), ''), rent_end_date),
      rent_days = VALUES(rent_days),
      status = VALUES(status),
      status_label = COALESCE(NULLIF(VALUES(status_label), ''), status_label),
      review_url = COALESCE(NULLIF(VALUES(review_url), ''), review_url),
      qr_image_url = COALESCE(NULLIF(VALUES(qr_image_url), ''), qr_image_url),
      is_latest = VALUES(is_latest),
      third_party_created_at = COALESCE(VALUES(third_party_created_at), third_party_created_at),
      third_party_updated_at = COALESCE(VALUES(third_party_updated_at), third_party_updated_at),
      last_event_type = VALUES(last_event_type),
      last_event_source = VALUES(last_event_source),
      last_synced_at = CURRENT_TIMESTAMP,
      raw_snapshot_json = COALESCE(VALUES(raw_snapshot_json), raw_snapshot_json)
  `, [
    snapshot.depositOrderNo, snapshot.orderId, snapshot.sourceType, snapshot.sourceOrderId, snapshot.sourceOrderNo,
    snapshot.productName, snapshot.modelCode, snapshot.unitCode, snapshot.customerName, snapshot.customerPhone,
    snapshot.depositAmount, snapshot.rentAmount, snapshot.rentStartDate, snapshot.rentEndDate, snapshot.rentDays,
    snapshot.status, snapshot.statusLabel, snapshot.reviewUrl, snapshot.qrImageUrl, effectiveIsLatest,
    snapshot.thirdPartyCreatedAt, snapshot.thirdPartyUpdatedAt, eventType, eventSource, snapshot.rawSnapshotJson,
  ])

  const next = await getStoredDepositOrder(snapshot.depositOrderNo)
  const statusChanged = previous && previous.status !== next?.status
  const shouldRecordEvent = options.forceEvent || !previous || statusChanged || options.recordEventOnUpsert
  if (shouldRecordEvent) {
    await recordDepositOrderEvent({
      depositOrderNo: snapshot.depositOrderNo,
      eventType,
      eventSource,
      fromStatus: previous?.status || null,
      toStatus: next?.status || snapshot.status,
      payload: options.eventPayload ?? order,
    })
  }
  return { ok: true, order: next, previous }
}

async function bindStoredDepositOrderSource(depositOrderNo, source = {}) {
  if (!depositOrderNo) return { ok: false, message: 'depositOrderNo 不能为空' }
  await ensureDepositAuditTables()
  const existing = await getStoredDepositOrder(depositOrderNo)
  if (!existing) {
    return await upsertStoredDepositOrder({
      depositOrderNo,
      sourceType: 'order',
      sourceOrderId: source.sourceOrderId ?? null,
      sourceOrderNo: source.sourceOrderNo || '',
      productName: source.productName || '',
      modelCode: source.modelCode || '',
      unitCode: source.unitCode || '',
      customerName: source.customerName || '',
      customerPhone: source.customerPhone || '',
    }, {
      eventType: 'manual_bind',
      eventSource: 'manual_bind',
      forceEvent: true,
      eventPayload: source,
      keepLatestFlag: false,
    })
  }
  return await upsertStoredDepositOrder({
    ...existing,
    sourceType: 'order',
    sourceOrderId: source.sourceOrderId ?? existing.sourceOrderId ?? null,
    sourceOrderNo: source.sourceOrderNo || existing.sourceOrderNo || '',
    productName: source.productName || existing.productName || '',
    modelCode: source.modelCode || existing.modelCode || '',
    unitCode: source.unitCode || existing.unitCode || '',
    customerName: source.customerName || existing.customerName || '',
    customerPhone: source.customerPhone || existing.customerPhone || '',
  }, {
    eventType: 'manual_bind',
    eventSource: 'manual_bind',
    forceEvent: true,
    eventPayload: source,
    keepLatestFlag: true,
  })
}

async function upsertItemCacheRecord(record = {}) {
  await ensureItemCacheTable()
  const itemId = String(record.item_id || record.itemId || '').trim()
  if (!itemId) return { ok: false, message: 'item_id 不能为空' }
  const dataJson = typeof record.data === 'string' ? record.data : JSON.stringify(record.data || {}, null, 0)
  const price = record.price === undefined || record.price === null || record.price === '' ? null : Number(record.price)
  const description = record.description ?? null
  const bizItemCode = record.biz_item_code ?? record.bizItemCode ?? null
  const bizItemCodeSource = record.biz_item_code_source ?? record.bizItemCodeSource ?? null
  const detailSource = record.detail_source ?? record.detailSource ?? null
  const detailUpdatedAt = normalizeDateTime(record.detail_updated_at ?? record.detailUpdatedAt)
  const detailDirty = Number(record.detail_dirty ?? record.detailDirty ?? 0) ? 1 : 0
  const dirtyReason = record.dirty_reason ?? record.dirtyReason ?? null
  const lastRefreshAttemptAt = normalizeDateTime(record.last_refresh_attempt_at ?? record.lastRefreshAttemptAt)
  const refreshFailCount = Number.parseInt(String(record.refresh_fail_count ?? record.refreshFailCount ?? 0), 10) || 0
  const refreshBackoffUntil = normalizeDateTime(record.refresh_backoff_until ?? record.refreshBackoffUntil)
  const lastUpdated = normalizeDateTime(record.last_updated ?? record.lastUpdated) || new Date().toISOString()
  await mysqlAdapter.run(`
    INSERT INTO item_cache (
      item_id, data, price, description, biz_item_code, biz_item_code_source,
      detail_source, detail_updated_at, detail_dirty, dirty_reason,
      last_refresh_attempt_at, refresh_fail_count, refresh_backoff_until, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      data = VALUES(data),
      price = VALUES(price),
      description = VALUES(description),
      biz_item_code = VALUES(biz_item_code),
      biz_item_code_source = VALUES(biz_item_code_source),
      detail_source = VALUES(detail_source),
      detail_updated_at = VALUES(detail_updated_at),
      detail_dirty = VALUES(detail_dirty),
      dirty_reason = VALUES(dirty_reason),
      last_refresh_attempt_at = VALUES(last_refresh_attempt_at),
      refresh_fail_count = VALUES(refresh_fail_count),
      refresh_backoff_until = VALUES(refresh_backoff_until),
      last_updated = VALUES(last_updated)
  `, [
    itemId, dataJson, price, description, bizItemCode, bizItemCodeSource,
    detailSource, detailUpdatedAt, detailDirty, dirtyReason,
    lastRefreshAttemptAt, refreshFailCount, refreshBackoffUntil, lastUpdated,
  ])
  return { ok: true, itemId }
}

async function migrateLegacyItemCacheFromChatDb() {
  await ensureItemCacheTable()
  const existing = await mysqlAdapter.get('SELECT COUNT(*) AS count FROM item_cache')
  if (Number(existing?.count || 0) > 0) return { ok: true, migrated: 0, skipped: true }
  const chatDbPath = path.join(runtimeDataDir || process.env.XIANYU_DATA_DIR || 'E:\\XianyuAgentData', 'chat_history.db')
  if (!fs.existsSync(chatDbPath)) return { ok: true, migrated: 0 }

  const db = new Database(chatDbPath, { readonly: true, fileMustExist: true })
  let rows = []
  try {
    rows = db.prepare(`
      SELECT item_id, data, price, description, biz_item_code, biz_item_code_source,
             detail_source, detail_updated_at, detail_dirty, dirty_reason,
             last_refresh_attempt_at, refresh_fail_count, refresh_backoff_until, last_updated
      FROM items
      ORDER BY COALESCE(detail_updated_at, last_updated) DESC
    `).all()
  } finally {
    db.close()
  }
  let migrated = 0
  for (const row of rows) {
    const result = await upsertItemCacheRecord(row)
    if (result.ok) migrated += 1
  }
  return { ok: true, migrated }
}

async function getCurrentXianyuAccountId() {
  const row = await mysqlAdapter.get('SELECT value FROM config WHERE `key` = ?', ['COOKIES_STR'])
  return parseCookieValue(row?.value || '', 'unb') || 'unknown'
}

async function listPricing(filters = {}) {
  await ensureRentalPricingTable()
  const { modelCode, active, keyword } = filters
  const where = []
  const params = []
  if (modelCode) { where.push('model_code = ?'); params.push(modelCode) }
  if (active !== undefined && active !== null && active !== '') {
    where.push('active = ?'); params.push(Number(active) ? 1 : 0)
  }
  if (keyword) {
    where.push('(model_code LIKE ? OR remark LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  const sql = `
    SELECT * FROM rental_pricing
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY model_code ASC, min_days ASC
  `
  return await mysqlAdapter.all(sql, params)
}

async function upsertPricing(payload = {}) {
  await ensureRentalPricingTable()
  const modelCode = String(payload.modelCode || '').trim()
  if (!modelCode) return { ok: false, message: '型号编码不能为空' }
  const minDays = Number.parseInt(payload.minDays, 10)
  const maxDays = Number.parseInt(payload.maxDays, 10)
  if (!Number.isFinite(minDays) || minDays < 1) return { ok: false, message: 'min_days 必须是正整数' }
  if (!Number.isFinite(maxDays) || maxDays < minDays) return { ok: false, message: 'max_days 必须 ≥ min_days' }
  const dailyPrice = Number(payload.dailyPrice)
  if (!Number.isFinite(dailyPrice) || dailyPrice < 0) return { ok: false, message: '日租金必须是非负数' }
  const totalPriceRaw = payload.totalPrice === undefined || payload.totalPrice === null || payload.totalPrice === '' ? null : Number(payload.totalPrice)
  if (totalPriceRaw !== null && (!Number.isFinite(totalPriceRaw) || totalPriceRaw < 0)) return { ok: false, message: '总价必须是非负数' }
  const totalPrice = totalPriceRaw
  const extensionDailyPrice = Number(payload.extensionDailyPrice || 0)
  if (!Number.isFinite(extensionDailyPrice) || extensionDailyPrice < 0) return { ok: false, message: '续租日价必须是非负数' }
  const deposit = Number(payload.deposit || 0)
  const remark = payload.remark ?? null
  const active = payload.active === undefined ? 1 : (Number(payload.active) ? 1 : 0)

  if (payload.id) {
    const result = await mysqlAdapter.run(`
      UPDATE rental_pricing
      SET model_code = ?, min_days = ?, max_days = ?, daily_price = ?, total_price = ?, extension_daily_price = ?, deposit = ?, remark = ?, active = ?, updated_at = ${nowExpr()}
      WHERE id = ?
    `, [modelCode, minDays, maxDays, dailyPrice, totalPrice, extensionDailyPrice, deposit, remark, active, payload.id])
    return { ok: result.changes > 0, id: payload.id }
  }
  const result = await mysqlAdapter.run(`
    INSERT INTO rental_pricing (model_code, min_days, max_days, daily_price, total_price, extension_daily_price, deposit, remark, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [modelCode, minDays, maxDays, dailyPrice, totalPrice, extensionDailyPrice, deposit, remark, active])
  return { ok: true, id: result.lastInsertRowid }
}

async function deletePricing(id) {
  if (!id) return { ok: false, message: 'id 不能为空' }
  const result = await mysqlAdapter.run('DELETE FROM rental_pricing WHERE id = ?', [id])
  return { ok: result.changes > 0, message: result.changes > 0 ? '已删除' : '记录不存在' }
}

async function savePricingLadder(payload = {}) {
  await ensureRentalPricingTable()
  const modelCode = String(payload.modelCode || '').trim()
  if (!modelCode) return { ok: false, message: '型号不能为空' }
  const sourceModelCode = String(payload.sourceModelCode || modelCode).trim() || modelCode
  const tierPrices = Array.isArray(payload.tierPrices) ? payload.tierPrices : []
  const rows = buildPricingRowsFromLadder({
    modelCode,
    tierPrices,
    extensionDailyPrice: payload.extensionDailyPrice,
    deposit: payload.deposit,
    remark: payload.remark ?? null,
    active: payload.active === undefined ? 1 : payload.active,
  })
  if (!rows.length) return { ok: false, message: '请至少配置一天的租金' }

  return await mysqlAdapter.transaction(async (conn) => {
    await conn.run('DELETE FROM rental_pricing WHERE model_code = ?', [sourceModelCode])
    if (sourceModelCode !== modelCode) {
      await conn.run('DELETE FROM rental_pricing WHERE model_code = ?', [modelCode])
    }
    for (const row of rows) {
      await conn.run(`
        INSERT INTO rental_pricing (model_code, min_days, max_days, daily_price, total_price, extension_daily_price, deposit, remark, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        row.model_code,
        row.min_days,
        row.max_days,
        row.daily_price,
        row.total_price,
        row.extension_daily_price,
        row.deposit,
        row.remark,
        row.active,
      ])
    }
    return { ok: true, modelCode, savedDays: rows.length }
  })
}

async function deletePricingByModel(modelCode) {
  const normalizedModelCode = String(modelCode || '').trim()
  if (!normalizedModelCode) return { ok: false, message: '型号不能为空' }
  const result = await mysqlAdapter.run('DELETE FROM rental_pricing WHERE model_code = ?', [normalizedModelCode])
  return { ok: result.changes > 0, message: result.changes > 0 ? '已删除' : '记录不存在' }
}

async function listDepositExemptionRules(filters = {}) {
  await ensureDepositExemptionRulesTable()
  const { active, keyword } = filters
  const where = []
  const params = []
  if (active !== undefined && active !== null && active !== '') {
    where.push('active = ?')
    params.push(Number(active) ? 1 : 0)
  }
  if (keyword) {
    where.push('(remark LIKE ? OR unsupported_cert_text LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  const sql = `
    SELECT * FROM deposit_exemption_rules
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY sort_order ASC, min_asset_value ASC, id ASC
  `
  return await mysqlAdapter.all(sql, params)
}

async function upsertDepositExemptionRule(payload = {}) {
  await ensureDepositExemptionRulesTable()
  const minAssetValue = Number(payload.minAssetValue)
  if (!Number.isFinite(minAssetValue) || minAssetValue < 0) return { ok: false, message: '最低设备价值必须是非负数' }
  const maxAssetValueRaw = payload.maxAssetValue === undefined || payload.maxAssetValue === null || payload.maxAssetValue === '' ? null : Number(payload.maxAssetValue)
  if (maxAssetValueRaw !== null && (!Number.isFinite(maxAssetValueRaw) || maxAssetValueRaw < minAssetValue)) return { ok: false, message: '最高设备价值必须大于等于最低设备价值' }
  const minZhimaScore = Number.parseInt(String(payload.minZhimaScore || 0), 10) || 0
  if (minZhimaScore < 0) return { ok: false, message: '芝麻分必须是非负整数' }
  const adultRequired = payload.adultRequired === undefined ? 1 : (Number(payload.adultRequired) ? 1 : 0)
  const realNameRequired = payload.realNameRequired === undefined ? 1 : (Number(payload.realNameRequired) ? 1 : 0)
  const unsupportedCertText = String(payload.unsupportedCertText || '港澳通行证不支持').trim()
  const depositMode = String(payload.depositMode || 'asset_value').trim() === 'fixed' ? 'fixed' : 'asset_value'
  const fixedDepositAmount = Number(payload.fixedDepositAmount || 0)
  if (!Number.isFinite(fixedDepositAmount) || fixedDepositAmount < 0) return { ok: false, message: '固定押金必须是非负数' }
  const remark = payload.remark ?? null
  const sortOrder = Number.parseInt(String(payload.sortOrder || 100), 10) || 100
  const active = payload.active === undefined ? 1 : (Number(payload.active) ? 1 : 0)

  if (payload.id) {
    const result = await mysqlAdapter.run(`
      UPDATE deposit_exemption_rules
      SET min_asset_value = ?, max_asset_value = ?, min_zhima_score = ?, adult_required = ?, real_name_required = ?, unsupported_cert_text = ?, deposit_mode = ?, fixed_deposit_amount = ?, remark = ?, sort_order = ?, active = ?, updated_at = ${nowExpr()}
      WHERE id = ?
    `, [minAssetValue, maxAssetValueRaw, minZhimaScore, adultRequired, realNameRequired, unsupportedCertText, depositMode, fixedDepositAmount, remark, sortOrder, active, payload.id])
    return { ok: result.changes > 0, id: payload.id }
  }

  const result = await mysqlAdapter.run(`
    INSERT INTO deposit_exemption_rules (
      min_asset_value, max_asset_value, min_zhima_score, adult_required, real_name_required,
      unsupported_cert_text, deposit_mode, fixed_deposit_amount, remark, sort_order, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [minAssetValue, maxAssetValueRaw, minZhimaScore, adultRequired, realNameRequired, unsupportedCertText, depositMode, fixedDepositAmount, remark, sortOrder, active])
  return { ok: true, id: result.lastInsertRowid }
}

async function deleteDepositExemptionRule(id) {
  if (!id) return { ok: false, message: 'id 不能为空' }
  const result = await mysqlAdapter.run('DELETE FROM deposit_exemption_rules WHERE id = ?', [id])
  return { ok: result.changes > 0, message: result.changes > 0 ? '已删除' : '记录不存在' }
}

async function listItemMapping(filters = {}) {
  await ensureItemModelMappingTable()
  const { modelCode, bizItemCode, source, keyword } = filters
  const where = []
  const params = []
  if (modelCode) { where.push('model_code = ?'); params.push(modelCode) }
  if (bizItemCode) { where.push('biz_item_code = ?'); params.push(bizItemCode) }
  if (source) { where.push('source = ?'); params.push(source) }
  if (keyword) {
    where.push('(item_id LIKE ? OR biz_item_code LIKE ? OR model_code LIKE ? OR note LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  const sql = `
    SELECT * FROM item_model_mapping
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC
    LIMIT 500
  `
  return await mysqlAdapter.all(sql, params)
}

async function upsertItemMapping(payload = {}) {
  await ensureItemModelMappingTable()
  const itemId = String(payload.itemId || '').trim()
  const modelCode = String(payload.modelCode || '').trim() || null
  const bizItemCode = String(payload.bizItemCode || '').trim() || null
  if (!itemId) return { ok: false, message: 'item_id 不能为空' }
  if (!modelCode && !bizItemCode) return { ok: false, message: '商品编码和型号编码至少填写一个' }
  const source = payload.source || 'manual'
  const note = payload.note ?? null
  const result = await mysqlAdapter.run(`
    INSERT INTO item_model_mapping (item_id, model_code, biz_item_code, source, note)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE model_code = VALUES(model_code), biz_item_code = VALUES(biz_item_code), source = VALUES(source), note = VALUES(note), updated_at = ${nowExpr()}
  `, [itemId, modelCode, bizItemCode, source, note])
  return { ok: true, itemId, affected: result.changes }
}

async function deleteItemMapping(itemId) {
  if (!itemId) return { ok: false, message: 'item_id 不能为空' }
  const result = await mysqlAdapter.run('DELETE FROM item_model_mapping WHERE item_id = ?', [itemId])
  return { ok: result.changes > 0, message: result.changes > 0 ? '已删除' : '记录不存在' }
}

async function listXianyuItemListings(filters = {}) {
  await ensureXianyuItemListingsTable()
  await ensureItemModelMappingTable()
  const accountId = filters.accountId || await getCurrentXianyuAccountId()
  const { reviewStatus, keyword, bizItemCode, modelCode } = filters
  const where = ['l.account_id = ?']
  const params = [accountId]
  if (reviewStatus) { where.push('l.review_status = ?'); params.push(reviewStatus) }
  if (bizItemCode) { where.push('l.biz_item_code = ?'); params.push(bizItemCode) }
  if (modelCode) { where.push('l.model_code = ?'); params.push(modelCode) }
  if (keyword) {
    where.push('(l.item_id LIKE ? OR l.title LIKE ? OR l.biz_item_code LIKE ? OR l.model_code LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  return await mysqlAdapter.all(`
    SELECT l.*, m.source AS mapping_source, m.note AS mapping_note,
           m.biz_item_code AS mapped_biz_item_code, m.model_code AS mapped_model_code
    FROM xianyu_item_listings l
    LEFT JOIN item_model_mapping m ON m.item_id = l.item_id
    WHERE ${where.join(' AND ')}
    ORDER BY l.last_seen_at DESC, l.updated_at DESC
    LIMIT 500
  `, params)
}

async function syncXianyuItemListingsFromLocalCache(options = {}) {
  await ensureXianyuItemListingsTable()
  await ensureItemModelMappingTable()
  await ensureItemCacheTable()
  const accountId = options.accountId || await getCurrentXianyuAccountId()
  const config = await getConfig()
  const listingOwnerKeywords = parseListingOwnerKeywords(config.LISTING_OWNER_KEYWORDS)
  let rows = []
  rows = await mysqlAdapter.all(`
    SELECT item_id, data, price, description, biz_item_code, biz_item_code_source, detail_source, detail_updated_at, last_updated
    FROM item_cache
    ORDER BY COALESCE(detail_updated_at, last_updated) DESC
    LIMIT ?
  `, [Number(options.limit || 80)])

  if (!rows.length) {
    const chatDbPath = path.join(runtimeDataDir || process.env.XIANYU_DATA_DIR || 'E:\\XianyuAgentData', 'chat_history.db')
    if (fs.existsSync(chatDbPath)) {
      const db = new Database(chatDbPath, { readonly: true, fileMustExist: true })
      try {
        rows = db.prepare(`
          SELECT item_id, data, price, description, biz_item_code, biz_item_code_source, detail_source, detail_updated_at, last_updated
          FROM items
          ORDER BY COALESCE(detail_updated_at, last_updated) DESC
          LIMIT ?
        `).all(Number(options.limit || 80))
      } finally {
        db.close()
      }
      for (const row of rows) {
        await upsertItemCacheRecord(row)
      }
    }
  }

  if (!rows.length) {
    return { ok: false, message: '未找到可同步的商品缓存（MySQL item_cache 与本地 chat_history.db 均为空）' }
  }

  let synced = 0
  let inferred = 0
  let mapped = 0
  let skippedOtherOwner = 0
  let skippedUnknownOwner = 0
  let syncedByOwnerMarker = 0
  await cleanupUnsafeLocalCacheListings(accountId, listingOwnerKeywords)
  for (const row of rows) {
    if (!row.item_id) continue
    const itemInfo = parseJsonSafely(row.data, {}) || {}
    const ownerAccountId = extractItemOwnerId(itemInfo)
    const inferredCodes = extractBusinessCodes(itemInfo)
    const bizItemCode = row.biz_item_code || inferredCodes.bizItemCode || null
    const modelCode = inferredCodes.modelCode || null
    const ownerMarker = itemDescriptionMarksOwner(itemInfo, listingOwnerKeywords)
    let isOwnerMarkerCandidate = false
    if (!ownerAccountId) {
      if (!ownerMarker.matched) {
        skippedUnknownOwner += 1
        continue
      }
      isOwnerMarkerCandidate = true
      syncedByOwnerMarker += 1
    } else if (String(ownerAccountId) !== String(accountId)) {
      skippedOtherOwner += 1
      continue
    }
    const ownerAccountIdForInsert = ownerAccountId || accountId
    const title = itemInfo.title || itemInfo.itemTitle || itemInfo.subject || ''
    const description = itemInfo.desc || itemInfo.description || row.description || ''
    const coverUrl = extractFirstImageUrl(itemInfo)
    const soldPrice = Number(itemInfo.soldPrice ?? row.price ?? 0) || 0
    const quantity = Number.parseInt(itemInfo.quantity ?? itemInfo.stock ?? 0, 10) || 0
    const codeSource = row.biz_item_code_source || inferredCodes.codeSource || (isOwnerMarkerCandidate ? ownerMarker.reason : null)
    await mysqlAdapter.run(`
      INSERT INTO xianyu_item_listings (
        account_id, item_id, title, description, cover_url, sold_price, quantity,
        biz_item_code, model_code, owner_account_id, code_source, raw_json, sync_source, review_status,
        last_seen_at, detail_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local_cache', 'pending', ${nowExpr()}, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title), description = VALUES(description), cover_url = VALUES(cover_url),
        sold_price = VALUES(sold_price), quantity = VALUES(quantity),
        biz_item_code = COALESCE(VALUES(biz_item_code), biz_item_code),
        model_code = COALESCE(VALUES(model_code), model_code),
        owner_account_id = VALUES(owner_account_id),
        code_source = COALESCE(VALUES(code_source), code_source),
        raw_json = VALUES(raw_json), sync_source = VALUES(sync_source),
        last_seen_at = ${nowExpr()}, detail_updated_at = VALUES(detail_updated_at), updated_at = ${nowExpr()}
    `, [accountId, row.item_id, title, description, coverUrl || null, soldPrice, quantity, bizItemCode, modelCode, ownerAccountIdForInsert, codeSource, row.data || null, row.detail_updated_at || row.last_updated || null])
    synced += 1
    if (bizItemCode || modelCode) inferred += 1
    if (bizItemCode || modelCode) {
      await upsertItemMapping({
        itemId: row.item_id,
        bizItemCode: bizItemCode || '',
        modelCode: modelCode || '',
        source: 'listing_sync',
        note: isOwnerMarkerCandidate ? `账号 ${accountId} 描述归属标记命中(${ownerMarker.reason})，待人工审核` : `账号 ${accountId} 本地缓存自动解析，待人工审核`,
      })
      mapped += 1
    }
  }
  return { ok: true, accountId, synced, inferred, mapped, skippedOtherOwner, skippedUnknownOwner, syncedByCodeFallback: syncedByOwnerMarker, syncedByOwnerMarker, source: 'local_cache', ownership: 'owner_or_description_marker' }
}

async function cleanupUnsafeLocalCacheListings(accountId, listingOwnerKeywords = []) {
  const rows = await mysqlAdapter.all(`
    SELECT account_id, item_id, raw_json, sync_source, review_status
    FROM xianyu_item_listings
    WHERE account_id = ? AND sync_source = 'local_cache' AND review_status = 'pending'
    LIMIT 1000
  `, [accountId])
  for (const row of rows) {
    const itemInfo = parseJsonSafely(row.raw_json, {}) || {}
    const ownerAccountId = extractItemOwnerId(itemInfo)
    const ownerMarker = itemDescriptionMarksOwner(itemInfo, listingOwnerKeywords)
    if ((!ownerAccountId && !ownerMarker.matched) || (ownerAccountId && String(ownerAccountId) !== String(accountId))) {
      await mysqlAdapter.run('DELETE FROM xianyu_item_listings WHERE account_id = ? AND item_id = ? AND review_status = ?', [accountId, row.item_id, 'pending'])
    }
  }
}

async function reviewXianyuItemListing(payload = {}) {
  await ensureXianyuItemListingsTable()
  const accountId = payload.accountId || await getCurrentXianyuAccountId()
  const itemId = String(payload.itemId || '').trim()
  if (!itemId) return { ok: false, message: 'item_id 不能为空' }
  const bizItemCode = String(payload.bizItemCode || '').trim() || null
  const modelCode = String(payload.modelCode || '').trim() || null
  const status = payload.reviewStatus || 'reviewed'
  await mysqlAdapter.run(`
    UPDATE xianyu_item_listings
    SET biz_item_code = ?, model_code = ?, review_status = ?, updated_at = ${nowExpr()}
    WHERE account_id = ? AND item_id = ?
  `, [bizItemCode, modelCode, status, accountId, itemId])
  if (status === 'reviewed' && (bizItemCode || modelCode)) {
    await upsertItemMapping({ itemId, bizItemCode, modelCode, source: 'manual', note: payload.note || `账号 ${accountId} 帖子审核确认` })
  }
  return { ok: true, accountId, itemId }
}

function buildMonthRange(monthText) {
  const matched = String(monthText || '').match(/^(\d{4})-(\d{2})$/)
  if (!matched) throw new Error('月份格式需为 YYYY-MM')
  const year = Number.parseInt(matched[1], 10)
  const month = Number.parseInt(matched[2], 10)
  const start = `${year}-${pad2(month)}-01`
  const endDate = new Date(year, month, 0)
  const end = `${year}-${pad2(month)}-${pad2(endDate.getDate())}`
  return { year, month, start, end, totalDays: endDate.getDate() }
}

function enumerateMonthDays({ year, month, totalDays }) {
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    return {
      day,
      date: `${year}-${pad2(month)}-${pad2(day)}`,
      label: String(day),
    }
  })
}

function resolveDateOverlap(rangeStart, rangeEnd, date) {
  return rangeStart <= date && rangeEnd >= date
}

function calculateDateDiffInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
}

async function getScheduleMonthlyOverview({ month, modelCode } = {}) {
  const monthRange = buildMonthRange(month || formatLocalDateTime(new Date()).slice(0, 7))
  const days = enumerateMonthDays(monthRange)
  const allUnits = await listScheduleUnits(modelCode ? { modelCode } : {})
  const blocks = await listScheduleBlocks({ modelCode, from: monthRange.start, to: monthRange.end })
  const orders = await listOrders({ modelCode, from: monthRange.start, to: monthRange.end })
  const blockUnitIds = new Set(blocks.map((block) => block.unit_id).filter(Boolean))
  const units = allUnits.filter((unit) => unit.raw_status !== 'offline' || blockUnitIds.has(unit.id))

  const orderMap = new Map(orders.map((order) => [order.id, order]))
  const unitRows = new Map()

  for (const unit of units) {
    unitRows.set(unit.id, {
      unitId: unit.id,
      unitCode: unit.unit_code,
      modelCode: unit.model_code,
      unitFee: 0,
      purchaseCost: Number(unit.purchase_cost || 0),
      occupied: false,
      cells: days.map((item) => ({ date: item.date, day: item.day, blockType: '', label: '', orderId: null, feePortion: 0 })),
    })
  }

  const blockPriority = { shipping: 3, rent: 2, buffer: 1 }
  for (const block of blocks) {
    if (!block.unit_id || !unitRows.has(block.unit_id)) continue
    const row = unitRows.get(block.unit_id)
    for (const cell of row.cells) {
      if (!resolveDateOverlap(block.start_date, block.end_date, cell.date)) continue
      const currentPriority = blockPriority[cell.blockType] || 0
      const nextPriority = blockPriority[block.block_type] || 0
      if (nextPriority < currentPriority) continue
      const order = block.order_id ? orderMap.get(block.order_id) : null
      cell.blockType = block.block_type
      cell.orderId = block.order_id || null
      cell.label = order?.customer_name || (block.block_type === 'shipping' ? '发货' : block.block_type === 'buffer' ? '缓冲' : '占用')
      if (block.block_type === 'rent') row.occupied = true
    }
  }

  for (const order of orders) {
    if (!order.unit_id || !unitRows.has(order.unit_id)) continue
    const unitRow = unitRows.get(order.unit_id)
    const totalDays = calculateDateDiffInclusive(order.rent_start_date, order.rent_end_date)
    let coveredDays = 0
    for (const cell of unitRow.cells) {
      if (resolveDateOverlap(order.rent_start_date, order.rent_end_date, cell.date)) coveredDays += 1
    }
    if (!coveredDays) continue
    const monthFee = Number((((Number(order.fee) || 0) * coveredDays) / totalDays).toFixed(2))
    unitRow.unitFee = Number((unitRow.unitFee + monthFee).toFixed(2))
    const feePerDay = Number((monthFee / coveredDays).toFixed(2))
    for (const cell of unitRow.cells) {
      if (!resolveDateOverlap(order.rent_start_date, order.rent_end_date, cell.date)) continue
      cell.feePortion = Number((cell.feePortion + feePerDay).toFixed(2))
      if (!cell.label || cell.blockType === 'rent') cell.label = order.customer_name || '占用'
    }
  }

  const groupsMap = new Map()
  for (const row of unitRows.values()) {
    if (!groupsMap.has(row.modelCode)) {
      groupsMap.set(row.modelCode, {
        modelCode: row.modelCode,
        modelFee: 0,
        assetValue: 0,
        occupiedUnits: 0,
        totalUnits: 0,
        rows: [],
      })
    }
    const group = groupsMap.get(row.modelCode)
    group.totalUnits += 1
    if (row.occupied) group.occupiedUnits += 1
    group.modelFee = Number((group.modelFee + row.unitFee).toFixed(2))
    group.assetValue = Number((group.assetValue + Number(row.purchaseCost || 0)).toFixed(2))
    group.rows.push(row)
  }

  const groups = Array.from(groupsMap.values())
    .sort((a, b) => a.modelCode.localeCompare(b.modelCode))
    .map((group) => ({
      ...group,
      rows: group.rows.sort((a, b) => a.unitCode.localeCompare(b.unitCode)),
    }))

  return {
    month: `${monthRange.year}-${pad2(monthRange.month)}`,
    days,
    summary: {
      totalUnits: units.length,
      occupiedUnits: Array.from(unitRows.values()).filter((row) => row.occupied).length,
      totalFee: Number(groups.reduce((sum, group) => sum + group.modelFee, 0).toFixed(2)),
      totalAssetValue: Number(groups.reduce((sum, group) => sum + Number(group.assetValue || 0), 0).toFixed(2)),
    },
    groups,
  }
}

async function listScheduleBlocks(filters = {}) {
  const { modelCode, unitId, from, to } = filters
  const where = []
  const params = []
  if (modelCode) {
    where.push('b.model_code = ?')
    params.push(modelCode)
  }
  if (unitId) {
    where.push('b.unit_id = ?')
    params.push(unitId)
  }
  if (from) {
    where.push('b.end_date >= ?')
    params.push(from)
  }
  if (to) {
    where.push('b.start_date <= ?')
    params.push(to)
  }
  const sql = `
    SELECT b.*, u.unit_code, o.order_no, o.customer_name, o.order_status,
      s.id AS store_id, s.code AS store_code, s.name AS store_name
    FROM schedule_blocks b
    LEFT JOIN schedule_units u ON u.id = b.unit_id
    LEFT JOIN rental_orders o ON o.id = b.order_id
    LEFT JOIN stores s ON s.id = o.store_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY b.start_date ASC, b.id DESC
  `
  return await mysqlAdapter.all(sql, params)
}

function applyOrderDateFilters(where, params, { dateField = 'rent_overlap', from, to } = {}) {
  const field = ['created_at', 'rent_start_date', 'rent_end_date', 'rent_overlap'].includes(dateField)
    ? dateField
    : 'rent_overlap'
  if (field === 'created_at') {
    if (from) { where.push('DATE(o.created_at) >= ?'); params.push(from) }
    if (to) { where.push('DATE(o.created_at) <= ?'); params.push(to) }
    return
  }
  if (field === 'rent_start_date') {
    if (from) { where.push('o.rent_start_date >= ?'); params.push(from) }
    if (to) { where.push('o.rent_start_date <= ?'); params.push(to) }
    return
  }
  if (field === 'rent_end_date') {
    if (from) { where.push('o.rent_end_date >= ?'); params.push(from) }
    if (to) { where.push('o.rent_end_date <= ?'); params.push(to) }
    return
  }
  if (from) { where.push('o.rent_end_date >= ?'); params.push(from) }
  if (to) { where.push('o.rent_start_date <= ?'); params.push(to) }
}

async function queryOrders(filters = {}) {
  const { status, modelCode, from, to, quickFilter, storeId, dateField } = filters
  const where = []
  const params = []
  const today = formatLocalDateTime(new Date()).slice(0, 10)
  if (status) {
    where.push('o.order_status = ?')
    params.push(status)
  }
  if (modelCode) {
    where.push('o.model_code = ?')
    params.push(modelCode)
  }
  if (storeId) {
    where.push('o.store_id = ?')
    params.push(storeId)
  }
  applyOrderDateFilters(where, params, { dateField, from, to })
  if (quickFilter === 'pending_ship') {
    where.push("o.order_status NOT IN ('completed', 'cancelled') AND IFNULL(o.planned_ship_at, '') != '' AND substr(o.planned_ship_at, 1, 10) <= ? AND IFNULL(o.actual_ship_at, '') = ''")
    params.push(today)
  }
  if (quickFilter === 'active') {
    where.push("o.order_status NOT IN ('completed', 'cancelled') AND o.rent_start_date <= ? AND o.rent_end_date >= ?")
    params.push(today, today)
  }
  if (quickFilter === 'finished') {
    where.push("o.order_status IN ('completed', 'cancelled')")
  }
  if (quickFilter === 'pending_return') {
    where.push("o.order_status NOT IN ('completed', 'cancelled') AND o.rent_end_date <= ?")
    params.push(today)
  }
  const sql = `
    SELECT o.*, u.unit_code, s.code AS store_code, s.name AS store_name
    FROM rental_orders o
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    LEFT JOIN stores s ON s.id = o.store_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.created_at DESC, o.id DESC
  `
  return await mysqlAdapter.all(sql, params)
}

async function listOrders(filters = {}) {
  return queryOrders(filters)
}

async function listOrdersFlat(filters = {}) {
  return queryOrders(filters)
}

function groupOrdersByModel(orders = []) {
  const groups = new Map()
  for (const order of orders) {
    const key = order.model_code || '未分类'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(order)
  }
  return Array.from(groups.entries()).map(([modelCode, rows]) => ({
    modelCode,
    rows,
    count: rows.length,
  }))
}

async function listOrdersGrouped(filters = {}) {
  const orders = await queryOrders(filters)
  return groupOrdersByModel(orders)
}

async function listOrderGroups(filters = {}) {
  return listOrdersGrouped(filters)
}

async function getOrderSummaryCounters(filters = {}) {
  const baseFilters = {
    modelCode: filters.modelCode,
    storeId: filters.storeId,
    dateField: filters.dateField,
    from: filters.from,
    to: filters.to,
  }
  const [all, pendingShip, active, pendingReturn, finished] = await Promise.all([
    queryOrders(baseFilters),
    queryOrders({ ...baseFilters, quickFilter: 'pending_ship' }),
    queryOrders({ ...baseFilters, quickFilter: 'active' }),
    queryOrders({ ...baseFilters, quickFilter: 'pending_return' }),
    queryOrders({ ...baseFilters, quickFilter: 'finished' }),
  ])
  return {
    all: all.length,
    pendingShip: pendingShip.length,
    active: active.length,
    pendingReturn: pendingReturn.length,
    finished: finished.length,
  }
}

async function getOrderOverviewStats(filters = {}) {
  return await getOrderSummaryCounters(filters)
}

async function getOrderActionAlerts() {
  const [pendingShip, pendingReturn] = await Promise.all([
    queryOrders({ quickFilter: 'pending_ship' }),
    queryOrders({ quickFilter: 'pending_return' }),
  ])
  return {
    pendingShip,
    pendingReturn,
  }
}

async function listOrderActionAlerts() {
  return await getOrderActionAlerts()
}

async function listFulfillmentTasks({ dateFrom, dateTo } = {}) {
  const today = formatLocalDateTime(new Date()).slice(0, 10)
  const from = dateFrom || today
  const to = dateTo || from
  const pendingInfo = await mysqlAdapter.all(`
    SELECT o.*, u.unit_code, s.code AS store_code, s.name AS store_name
    FROM rental_orders o
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE o.order_status NOT IN ('completed', 'cancelled')
      AND (
        IFNULL(o.customer_name, '') = ''
        OR IFNULL(o.customer_phone, '') = ''
        OR IFNULL(o.address, '') = ''
        OR IFNULL(o.fee, 0) <= 0
        OR IFNULL(o.latest_logistics_status, '') LIKE '%待补资料%'
      )
      AND (
        IFNULL(o.planned_ship_at, '') = ''
        OR substr(o.planned_ship_at, 1, 10) <= ?
      )
    ORDER BY IFNULL(o.planned_ship_at, '9999-12-31') ASC, o.id ASC
  `, [to])

  const pendingShip = await mysqlAdapter.all(`
    SELECT o.*, u.unit_code, s.code AS store_code, s.name AS store_name
    FROM rental_orders o
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE o.order_status NOT IN ('completed', 'cancelled')
      AND IFNULL(o.planned_ship_at, '') != ''
      AND substr(o.planned_ship_at, 1, 10) BETWEEN ? AND ?
      AND IFNULL(o.actual_ship_at, '') = ''
    ORDER BY substr(o.planned_ship_at, 1, 16) ASC, o.id ASC
  `, [from, to])

  const pendingReturn = await mysqlAdapter.all(`
    SELECT o.*, u.unit_code, s.code AS store_code, s.name AS store_name
    FROM rental_orders o
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE o.order_status NOT IN ('completed', 'cancelled')
      AND o.rent_end_date BETWEEN ? AND ?
    ORDER BY o.rent_end_date ASC, o.id ASC
  `, [from, to])

  const overdueReturn = await mysqlAdapter.all(`
    SELECT o.*, u.unit_code, s.code AS store_code, s.name AS store_name
    FROM rental_orders o
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE o.order_status NOT IN ('completed', 'cancelled')
      AND o.rent_end_date < ?
    ORDER BY o.rent_end_date ASC, o.id ASC
  `, [today])

  return { dateFrom: from, dateTo: to, pendingInfo, pendingShip, pendingReturn, overdueReturn }
}

async function batchMarkOrdersShipped({ orderIds = [], actualShipAt, latestLogisticsStatus }) {
  const normalizedActualShipAt = normalizeDateTime(actualShipAt) || formatLocalDateTime(new Date())
  const results = []
  for (const orderId of orderIds) {
    const order = await getOrderById(orderId)
    if (!order) {
      results.push({ orderId, ok: false, message: '订单不存在' })
      continue
    }
    const result = await updateShipping({
      orderId,
      trackingNo: order.tracking_no,
      shippingMode: order.shipping_mode,
      latestLogisticsStatus: latestLogisticsStatus || '已发货',
      actualShipAt: normalizedActualShipAt,
      expectedArriveAt: order.expected_arrive_at,
    })
    if (result?.ok) {
      await mysqlAdapter.run(`
        UPDATE rental_orders
        SET order_status = CASE WHEN order_status IN ('waiting_payment', 'paid') THEN 'shipping' ELSE order_status END, updated_at = ${nowExpr()}
        WHERE id = ?
      `, [orderId])
    }
    results.push({ orderId, ok: !!result?.ok, message: result?.ok ? '已确认发货' : '发货失败' })
  }
  return { ok: true, results }
}

async function markOrderReturned({ orderId, returnedAt, latestLogisticsStatus }) {
  const normalizedReturnedAt = normalizeDateTime(returnedAt) || formatLocalDateTime(new Date())
  const result = await mysqlAdapter.run(`
    UPDATE rental_orders
    SET order_status = 'completed', latest_logistics_status = ?, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [latestLogisticsStatus || '已归还', orderId])
  if (!result.changes) return { ok: false, message: '订单不存在' }
  const existing = await mysqlAdapter.get('SELECT id FROM shipping_records WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId])
  if (existing) {
    await mysqlAdapter.run(`
      UPDATE shipping_records
      SET latest_status = ?, actual_arrive_at = ?, updated_at = ${nowExpr()}
      WHERE id = ?
    `, [latestLogisticsStatus || '已归还', normalizedReturnedAt, existing.id])
  } else {
    await mysqlAdapter.run(`
      INSERT INTO shipping_records (order_id, latest_status, actual_arrive_at, updated_at)
      VALUES (?, ?, ?, ${nowExpr()})
    `, [orderId, latestLogisticsStatus || '已归还', normalizedReturnedAt])
  }
  await mysqlAdapter.run('DELETE FROM schedule_blocks WHERE order_id = ?', [orderId])
  const order = await getOrderById(orderId)
  await syncScheduleUnitStatus(order?.unit_id)
  return { ok: true, order }
}

/**
 * 发起归还物流：租期结束时自动生成 return_shipping 档期块，
 * 将订单状态改为 returning，保留 rent 块，删除 buffer 块，新增 return_shipping 块。
 * returnTransitDays: 归还物流天数（默认根据城市估算：同省2天，其他3天）
 */
async function initiateReturnSchedule({ orderId, returnTransitDays }) {
  const order = await getOrderById(orderId)
  if (!order) return { ok: false, message: '订单不存在' }
  if (order.order_status === 'completed') return { ok: false, message: '订单已完成，无需归还' }

  // 估算归还物流天数
  const transit = returnTransitDays || estimateReturnTransitDays(order)

  // 归还取件日 = 租期结束日 + 1
  const endDate = new Date(`${order.rent_end_date}T00:00:00`)
  const pickupDate = new Date(endDate)
  pickupDate.setDate(pickupDate.getDate() + 1)
  const returnArriveDate = new Date(pickupDate)
  returnArriveDate.setDate(returnArriveDate.getDate() + transit)

  const fmtDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  const pickupStr = fmtDate(pickupDate)
  const arriveStr = fmtDate(returnArriveDate)

  // 更新订单状态为 returning
  await mysqlAdapter.run(`
    UPDATE rental_orders
    SET order_status = 'returning', latest_logistics_status = '待归还取件', updated_at = ${nowExpr()}
    WHERE id = ?
  `, [orderId])
  // 删除旧的 buffer 和 return_shipping 块，保留 shipping 和 rent
  await mysqlAdapter.run("DELETE FROM schedule_blocks WHERE order_id = ? AND block_type IN ('buffer', 'return_shipping')", [orderId])
  // 插入归还物流块
  await mysqlAdapter.run(`
    INSERT INTO schedule_blocks (
      unit_id, order_id, model_code, block_type, start_date, end_date,
      planned_ship_at, expected_arrive_at, status, note, updated_at
    ) VALUES (?, ?, ?, 'return_shipping', ?, ?, ?, ?, 'active', ?, ${nowExpr()})
  `, [order.unit_id, orderId, order.model_code,
    pickupStr, arriveStr,
    `${pickupStr}T10:00:00`, `${arriveStr}T18:00:00`,
    `归还物流 预计${transit}天到仓`])
  return { ok: true, order: await getOrderById(orderId), pickupDate: pickupStr, arriveDate: arriveStr, transitDays: transit }
}

async function estimateReturnTransitDays(order) {
  // 简单估算：根据客户地址中的省份信息
  const addr = (order.customer_province || order.customer_address || '').toLowerCase()
  const senderProvince = ((await mysqlAdapter.get("SELECT value FROM config WHERE `key` = 'SF_SENDER_PROVINCE'"))?.value || '四川').replace('省', '')
  if (addr.includes(senderProvince.replace('省', ''))) return 2 // 同省
  // 偏远地区
  const remote = ['新疆', '西藏', '内蒙古', '青海', '宁夏', '甘肃', '黑龙江']
  if (remote.some(r => addr.includes(r))) return 5
  return 3 // 默认
}

/**
 * 自动扫描所有即将到期的订单（租期结束日 <= 指定日期），为尚未生成归还物流的订单批量发起归还调度。
 */
async function autoInitiateReturnSchedules({ daysAhead = 1 } = {}) {
  const target = new Date()
  target.setDate(target.getDate() + daysAhead)
  const fmtDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  const targetStr = fmtDate(target)

  const orders = await mysqlAdapter.all(`
    SELECT id FROM rental_orders
    WHERE order_status = 'active' AND rent_end_date <= ?
    AND id NOT IN (SELECT DISTINCT order_id FROM schedule_blocks WHERE block_type = 'return_shipping')
  `, [targetStr])

  const results = []
  for (const o of orders) {
    results.push({ orderId: o.id, ...(await initiateReturnSchedule({ orderId: o.id })) })
  }
  return { ok: true, count: results.length, results }
}

async function batchMarkOrdersReturned({ orderIds = [], returnedAt, latestLogisticsStatus }) {
  const results = []
  for (const orderId of orderIds) {
    results.push({ orderId, ...(await markOrderReturned({ orderId, returnedAt, latestLogisticsStatus })) })
  }
  return { ok: true, results }
}

async function extendOrder({ orderId, rentEndDate, extraFee = 0, expectedArriveAt, latestLogisticsStatus }) {
  const order = await getOrderById(orderId)
  if (!order) return { ok: false, message: '订单不存在' }
  const nextFee = Number((Number(order.fee || 0) + Number(extraFee || 0)).toFixed(2))
  const normalizedExpectedArriveAt = normalizeDateTime(expectedArriveAt) || order.expected_arrive_at || null
  const result = await mysqlAdapter.run(`
    UPDATE rental_orders
    SET rent_end_date = ?, fee = ?, expected_arrive_at = ?, latest_logistics_status = ?, order_status = CASE WHEN order_status = 'completed' THEN 'active' ELSE order_status END, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [rentEndDate, nextFee, normalizedExpectedArriveAt, latestLogisticsStatus || order.latest_logistics_status || '延期中', orderId])
  if (!result.changes) return { ok: false, message: '延期失败' }
  const refreshed = await getOrderById(orderId)
  await rebuildOrderScheduleBlocks({
    orderId,
    unitId: refreshed.unit_id,
    modelCode: refreshed.model_code,
    rentStartDate: refreshed.rent_start_date,
    rentEndDate: refreshed.rent_end_date,
    plannedShipAt: refreshed.planned_ship_at,
    expectedArriveAt: refreshed.expected_arrive_at,
  })
  return { ok: true, order: refreshed }
}

async function batchExtendOrders({ items = [], latestLogisticsStatus }) {
  const results = []
  for (const item of items) {
    results.push({ orderId: item.orderId, ...(await extendOrder({
      orderId: item.orderId,
      rentEndDate: item.rentEndDate,
      extraFee: item.extraFee,
      expectedArriveAt: item.expectedArriveAt,
      latestLogisticsStatus,
    })) })
  }
  return { ok: true, results }
}

function sfStoredJson(value) {
  return value == null ? null : JSON.stringify(redactShipmentSecrets(value))
}

function parseSfStoredJson(value) {
  if (!value) return null
  return parseJsonSafely(value, null)
}

function sfMonthlyCardTail(value) {
  const text = String(value || '').trim()
  return text ? `****${text.slice(-4)}` : null
}

function createSfShipmentNo() {
  return `SFS${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

function sfProductDefinition(productCode, config = {}) {
  const definition = SF_PRODUCTS[productCode] || SF_PRODUCTS.sf_standard
  if (productCode === 'sf_standard') return { ...definition, expressTypeId: Number(config.SF_STANDARD_EXPRESS_TYPE_ID || definition.expressTypeId || 2) }
  if (productCode === 'sf_half_day') return { ...definition, expressTypeId: Number(config.SF_HALF_DAY_EXPRESS_TYPE_ID || definition.expressTypeId || 263) }
  if (productCode === 'sf_land_package') return { ...definition, expressTypeId: 231 }
  return definition
}

function mapSfShipmentRow(row) {
  if (!row) return null
  return {
    ...row,
    precheckResult: parseSfStoredJson(row.precheck_result_json),
    submitResult: parseSfStoredJson(row.submit_result_json),
    promiseResult: parseSfStoredJson(row.promise_result_json),
    billedFeeDetail: parseSfStoredJson(row.billed_fee_detail_json),
    cancelResult: parseSfStoredJson(row.cancel_result_json),
    routesResult: parseSfStoredJson(row.routes_result_json),
    feeResult: parseSfStoredJson(row.fee_result_json),
  }
}

async function getSfShipmentDetail({ shipmentId }) {
  await ensureSfShippingTables()
  const row = await mysqlAdapter.get('SELECT * FROM sf_shipments WHERE id = ? LIMIT 1', [shipmentId])
  if (!row) return null
  const events = await mysqlAdapter.all('SELECT * FROM sf_shipment_events WHERE shipment_id = ? ORDER BY created_at DESC, id DESC', [shipmentId])
  return { ...mapSfShipmentRow(row), events: events.map((item) => ({ ...item, detail: parseSfStoredJson(item.detail_json) })) }
}

async function addSfShipmentEvent(shipmentId, eventType, status, message, detail) {
  await mysqlAdapter.run(`
    INSERT INTO sf_shipment_events (shipment_id, event_type, status, message, detail_json)
    VALUES (?, ?, ?, ?, ?)
  `, [shipmentId, eventType, status || null, message || null, sfStoredJson(detail)])
}

async function listSfShipments({ status, linkedOrderId, keyword } = {}) {
  await ensureSfShippingTables()
  const where = []
  const params = []
  if (status) { where.push('status = ?'); params.push(status) }
  if (linkedOrderId) { where.push('linked_order_id = ?'); params.push(linkedOrderId) }
  if (keyword) {
    where.push('(shipment_no LIKE ? OR tracking_no LIKE ? OR receiver_name LIKE ? OR receiver_mobile LIKE ?)')
    const pattern = `%${keyword}%`
    params.push(pattern, pattern, pattern, pattern)
  }
  const rows = await mysqlAdapter.all(`
    SELECT * FROM sf_shipments
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, id DESC
    LIMIT 200
  `, params)
  return rows.map(mapSfShipmentRow)
}

async function saveSfShipmentDraft(payload = {}) {
  await ensureSfShippingTables()
  const config = await getConfig()
  const order = payload.linkedOrderId ? await getOrderById(payload.linkedOrderId) : null
  const productCode = payload.productCode || 'sf_standard'
  const product = sfProductDefinition(productCode, config)
  const values = {
    shipmentNo: payload.shipmentNo || createSfShipmentNo(),
    linkedOrderId: payload.linkedOrderId || null,
    serviceKind: product.serviceKind || 'express',
    productCode,
    expressTypeId: product.expressTypeId || null,
    senderName: payload.senderName || config.SF_SENDER_CONTACT || '',
    senderMobile: payload.senderMobile || config.SF_SENDER_MOBILE || '',
    senderProvince: payload.senderProvince || config.SF_SENDER_PROVINCE || '',
    senderCity: payload.senderCity || config.SF_SENDER_CITY || '',
    senderDistrict: payload.senderDistrict || config.SF_SENDER_DISTRICT || '',
    senderAddress: payload.senderAddress || config.SF_SENDER_ADDRESS || '',
    receiverName: payload.receiverName || order?.customer_name || '',
    receiverMobile: payload.receiverMobile || order?.customer_phone || '',
    receiverProvince: payload.receiverProvince || order?.province || '',
    receiverCity: payload.receiverCity || order?.city || '',
    receiverDistrict: payload.receiverDistrict || order?.district || '',
    receiverAddress: payload.receiverAddress || order?.address || '',
    cargoName: payload.cargoName || config.SF_CARGO_NAME || '租赁设备',
    weightKg: Number(payload.weightKg || 1) || 1,
    plannedSendAt: payload.plannedSendAt || order?.planned_ship_at || null,
  }
  let shipmentId = Number(payload.id || payload.shipmentId || 0) || null
  if (shipmentId) {
    const existingShipment = await mysqlAdapter.get('SELECT status FROM sf_shipments WHERE id = ? LIMIT 1', [shipmentId])
    if (existingShipment && ['submitting', 'submitted', 'result_pending', 'manual_review', 'rejected', 'cancelled'].includes(existingShipment.status)) {
      throw new Error('已进入正式下单流程的寄件单不能修改，请新建草稿')
    }
    await mysqlAdapter.run(`
      UPDATE sf_shipments SET
        linked_order_id = ?, service_kind = ?, product_code = ?, express_type_id = ?,
        sender_name = ?, sender_mobile = ?, sender_province = ?, sender_city = ?, sender_district = ?, sender_address = ?,
        receiver_name = ?, receiver_mobile = ?, receiver_province = ?, receiver_city = ?, receiver_district = ?, receiver_address = ?,
        cargo_name = ?, weight_kg = ?, monthly_card_tail = ?, planned_send_at = ?,
        status = 'draft', estimated_fee = NULL, precheck_result_json = NULL, service_message = NULL, updated_at = ${nowExpr()}
      WHERE id = ?
    `, [values.linkedOrderId, values.serviceKind, values.productCode, values.expressTypeId,
      values.senderName, values.senderMobile, values.senderProvince, values.senderCity, values.senderDistrict, values.senderAddress,
      values.receiverName, values.receiverMobile, values.receiverProvince, values.receiverCity, values.receiverDistrict, values.receiverAddress,
      values.cargoName, values.weightKg, sfMonthlyCardTail(config.SF_MONTHLY_CARD), values.plannedSendAt, shipmentId])
  } else {
    const result = await mysqlAdapter.run(`
      INSERT INTO sf_shipments (
        shipment_no, linked_order_id, service_kind, product_code, express_type_id, status,
        sender_name, sender_mobile, sender_province, sender_city, sender_district, sender_address,
        receiver_name, receiver_mobile, receiver_province, receiver_city, receiver_district, receiver_address,
        cargo_name, weight_kg, pay_method, monthly_card_tail, planned_send_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [values.shipmentNo, values.linkedOrderId, values.serviceKind, values.productCode, values.expressTypeId,
      values.senderName, values.senderMobile, values.senderProvince, values.senderCity, values.senderDistrict, values.senderAddress,
      values.receiverName, values.receiverMobile, values.receiverProvince, values.receiverCity, values.receiverDistrict, values.receiverAddress,
      values.cargoName, values.weightKg, sfMonthlyCardTail(config.SF_MONTHLY_CARD), values.plannedSendAt])
    shipmentId = result.lastInsertRowid
    await addSfShipmentEvent(shipmentId, 'draft_created', 'draft', '寄件草稿已创建')
  }
  if (payload.saveSenderAsDefault) {
    await saveConfig({
      SF_SENDER_CONTACT: values.senderName,
      SF_SENDER_MOBILE: values.senderMobile,
      SF_SENDER_PROVINCE: values.senderProvince,
      SF_SENDER_CITY: values.senderCity,
      SF_SENDER_DISTRICT: values.senderDistrict,
      SF_SENDER_ADDRESS: values.senderAddress,
    })
    await addSfShipmentEvent(shipmentId, 'sender_default_saved', 'draft', '本单寄件地址已保存为默认寄件地址')
  }
  return await getSfShipmentDetail({ shipmentId })
}

function shipmentAsServiceInput(shipment, config = {}) {
  return {
    productType: shipment.product_code,
    expressTypeId: shipment.express_type_id,
    shipmentNo: shipment.shipment_no,
    monthlyCard: config.SF_MONTHLY_CARD || '',
    sendStartTime: shipment.planned_send_at || undefined,
    cargoName: shipment.cargo_name || '租赁设备',
    weightKg: Number(shipment.weight_kg || 1),
    sender: {
      name: shipment.sender_name, mobile: shipment.sender_mobile,
      province: shipment.sender_province, city: shipment.sender_city,
      district: shipment.sender_district, address: shipment.sender_address,
    },
    receiver: {
      name: shipment.receiver_name, mobile: shipment.receiver_mobile,
      province: shipment.receiver_province, city: shipment.receiver_city,
      district: shipment.receiver_district, address: shipment.receiver_address,
    },
  }
}

function validationErrorMessage(result) {
  return result?.ok === false ? (result.errors || []).join('；') || '寄件信息不完整' : ''
}

async function updateSfShipmentResult(shipmentId, fields = {}) {
  await mysqlAdapter.run(`
    UPDATE sf_shipments SET
      status = COALESCE(?, status),
      tracking_no = COALESCE(?, tracking_no),
      expected_arrive_at = COALESCE(?, expected_arrive_at),
      filter_result = COALESCE(?, filter_result),
      quote_fee = COALESCE(?, quote_fee),
      estimated_fee = COALESCE(?, estimated_fee),
      billed_fee = COALESCE(?, billed_fee),
      actual_paid_fee = COALESCE(?, actual_paid_fee),
      actual_paid_source = COALESCE(?, actual_paid_source),
      actual_paid_note = COALESCE(?, actual_paid_note),
      expense_record_id = COALESCE(?, expense_record_id),
      service_message = COALESCE(?, service_message),
      precheck_result_json = COALESCE(?, precheck_result_json),
      submit_result_json = COALESCE(?, submit_result_json),
      promise_result_json = COALESCE(?, promise_result_json),
      billed_fee_detail_json = COALESCE(?, billed_fee_detail_json),
      cancel_result_json = COALESCE(?, cancel_result_json),
      routes_result_json = COALESCE(?, routes_result_json),
      fee_result_json = COALESCE(?, fee_result_json),
      cancelled_at = CASE WHEN ? THEN ${nowExpr()} ELSE cancelled_at END,
      routes_updated_at = CASE WHEN ? THEN ${nowExpr()} ELSE routes_updated_at END,
      fee_updated_at = CASE WHEN ? THEN ${nowExpr()} ELSE fee_updated_at END,
      updated_at = ${nowExpr()}
    WHERE id = ?
  `, [fields.status ?? null, fields.trackingNo ?? null, fields.expectedArriveAt ?? null,
    fields.filterResult ?? null, fields.quoteFee ?? null, fields.estimatedFee ?? null,
    fields.billedFee ?? null, fields.actualPaidFee ?? null, fields.actualPaidSource ?? null,
    fields.actualPaidNote ?? null, fields.expenseRecordId ?? null, fields.message ?? null,
    fields.precheckResult === undefined ? null : sfStoredJson(fields.precheckResult),
    fields.submitResult === undefined ? null : sfStoredJson(fields.submitResult),
    fields.promiseResult === undefined ? null : sfStoredJson(fields.promiseResult),
    fields.billedFeeDetail === undefined ? null : sfStoredJson(fields.billedFeeDetail),
    fields.cancelResult === undefined ? null : sfStoredJson(fields.cancelResult),
    fields.routesResult === undefined ? null : sfStoredJson(fields.routesResult),
    fields.feeResult === undefined ? null : sfStoredJson(fields.feeResult),
    fields.markCancelled ? 1 : 0, fields.markRoutesUpdated ? 1 : 0, fields.markFeeUpdated ? 1 : 0,
    shipmentId])
}

async function precheckSfShipment(payload = {}) {
  const shipment = payload.shipmentId ? await getSfShipmentDetail({ shipmentId: payload.shipmentId }) : await saveSfShipmentDraft(payload)
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  if (['submitting', 'submitted', 'result_pending', 'manual_review', 'rejected', 'cancelled'].includes(shipment.status)) {
    return { ok: false, message: '该寄件单已进入正式下单流程；需要修改资料时请新建寄件单，勿复用客户订单号' }
  }
  if (shipment.service_kind === 'intra_city_quote') return await quoteSfIntraCity({ shipmentId: shipment.id })
  const config = await getConfig()
  const serviceInput = shipmentAsServiceInput(shipment, config)
  const validation = validateExpressShipmentData(serviceInput)
  if (validation?.ok === false) return { ok: false, message: validationErrorMessage(validation) }
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_PRE_ORDER', buildPreOrderPayload(serviceInput), config, 'pre_order')
    const result = normalizePreOrderResult(envelope)
    const mapped = mapFilterResult(result.filterResult)
    const status = result.ok === false || mapped.status === 'rejected' ? 'precheck_failed' : 'prechecked'
    await updateSfShipmentResult(shipment.id, { status, message: result.message, precheckResult: result })
    await addSfShipmentEvent(shipment.id, 'precheck', status, result.message, result)
    return { ...result, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
  } catch (error) {
    await updateSfShipmentResult(shipment.id, { status: 'precheck_failed', message: error.message })
    await addSfShipmentEvent(shipment.id, 'precheck', 'precheck_failed', error.message)
    return { ok: false, message: error.message, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
  }
}

async function syncSfShipmentToRentalOrder(shipment, result) {
  if (!shipment?.linked_order_id || !result?.trackingNo) return
  await updateShipping({
    orderId: shipment.linked_order_id,
    trackingNo: result.trackingNo,
    shippingMode: 'sf',
    latestLogisticsStatus: result.message || '顺丰已下单',
    actualShipAt: shipment.planned_send_at || null,
    expectedArriveAt: result.expectedArriveAt || null,
  })
}

async function applySfOrderResult(shipment, normalized, eventType) {
  const state = mapFilterResult(normalized.filterResult)
  const status = state?.status === 'waybill_created'
    ? 'submitted'
    : (state?.status === 'rejected' || state?.status === 'manual_review' ? state.status : 'result_pending')
  const expectedArriveAt = normalized.expectedArriveAt || shipment.expected_arrive_at || null
  await updateSfShipmentResult(shipment.id, {
    status,
    trackingNo: normalized.trackingNo,
    expectedArriveAt,
    filterResult: normalized.filterResult,
    message: normalized.message,
    submitResult: normalized,
  })
  await addSfShipmentEvent(shipment.id, eventType, status, normalized.message, normalized)
  if (status === 'submitted') await syncSfShipmentToRentalOrder(shipment, { ...normalized, expectedArriveAt })
  return { ...normalized, expectedArriveAt, status, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
}

async function submitSfShipment({ shipmentId } = {}) {
  const shipment = await getSfShipmentDetail({ shipmentId })
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  if (shipment.service_kind !== 'express') return { ok: false, message: '顺丰同城当前仅支持询价，不能正式下单' }
  if (shipment.status !== 'prechecked') {
    return { ok: false, message: '该寄件单未处于可提交状态；已发起过下单的记录请查询结果，勿重复提交' }
  }
  const config = await getConfig()
  const serviceInput = shipmentAsServiceInput(shipment, config)
  const validation = validateCreateOrderPrerequisites(serviceInput)
  if (validation?.ok === false) return { ok: false, message: validationErrorMessage(validation) }
  const lock = await mysqlAdapter.run(`
    UPDATE sf_shipments
    SET status = 'submitting', service_message = ?, updated_at = ${nowExpr()}
    WHERE id = ? AND status = 'prechecked'
  `, ['正在提交顺丰订单', shipment.id])
  if (!lock.changes) {
    return { ok: false, message: '该寄件单已发起过提交或状态已变化，请刷新后查询结果，勿重复提交' }
  }
  await addSfShipmentEvent(shipment.id, 'submit_started', 'submitting', '已发起正式下单请求')
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_CREATE_ORDER', buildExpressOrderPayload(serviceInput), config, 'create_order')
    return await applySfOrderResult(shipment, normalizeCreateOrderResult(envelope), 'submit_result')
  } catch (error) {
    if (String(serviceInput.monthlyCard || '').trim() && isMonthlyCardFailureMessage(error.message)) {
      const fallbackInput = { ...serviceInput, monthlyCard: '' }
      await addSfShipmentEvent(shipment.id, 'submit_retry_sender_pay', 'submitting', `月结不可用，改为寄付重试：${error.message}`)
      try {
        const fallbackEnvelope = await invokeSfExpressService('EXP_RECE_CREATE_ORDER', buildExpressOrderPayload(fallbackInput), config, 'create_order_sender_pay')
        const normalized = normalizeCreateOrderResult(fallbackEnvelope)
        normalized.message = [normalized.message, '月结不可用，已自动改为寄付提交'].filter(Boolean).join('；')
        const applied = await applySfOrderResult(shipment, normalized, 'submit_result_sender_pay')
        return { ...applied, paymentNotice: '月结不可用，已自动改为寄付提交' }
      } catch (fallbackError) {
        await updateSfShipmentResult(shipment.id, { status: 'result_pending', message: `寄付重试后结果未确认：${fallbackError.message}` })
        await addSfShipmentEvent(shipment.id, 'submit_unknown_sender_pay', 'result_pending', fallbackError.message)
        return { ok: false, status: 'result_pending', message: '月结不可用，已自动改为寄付重试；下单结果未确认，请使用订单结果查询，勿重复提交。' }
      }
    }
    await updateSfShipmentResult(shipment.id, { status: 'result_pending', message: `下单响应未确认：${error.message}` })
    await addSfShipmentEvent(shipment.id, 'submit_unknown', 'result_pending', error.message)
    return { ok: false, status: 'result_pending', message: '下单结果未确认，请使用订单结果查询，勿重复提交。' }
  }
}

async function recoverSfShipmentResult({ shipmentId } = {}) {
  const shipment = await getSfShipmentDetail({ shipmentId })
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  const config = await getConfig()
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_SEARCH_ORDER_RESP', { orderId: shipment.shipment_no }, config, 'search_order_result')
    return await applySfOrderResult(shipment, normalizeOrderSearchResult(envelope), 'result_recovered')
  } catch (error) {
    await addSfShipmentEvent(shipment.id, 'result_recover_failed', shipment.status, error.message)
    return { ok: false, message: error.message }
  }
}

function buildSfPreviewShipment(payload = {}, config = {}) {
  const productCode = payload.productCode || 'sf_standard'
  const product = sfProductDefinition(productCode, config)
  return {
    product_code: productCode,
    express_type_id: product.expressTypeId,
    service_kind: product.serviceKind,
    shipment_no: payload.shipmentNo || 'preview',
    sender_name: payload.senderName || config.SF_SENDER_CONTACT || '',
    sender_mobile: payload.senderMobile || config.SF_SENDER_MOBILE || '',
    sender_province: payload.senderProvince || config.SF_SENDER_PROVINCE || '',
    sender_city: payload.senderCity || config.SF_SENDER_CITY || '',
    sender_district: payload.senderDistrict || config.SF_SENDER_DISTRICT || '',
    sender_address: payload.senderAddress || config.SF_SENDER_ADDRESS || '',
    receiver_name: payload.receiverName || '',
    receiver_mobile: payload.receiverMobile || '',
    receiver_province: payload.receiverProvince || '',
    receiver_city: payload.receiverCity || '',
    receiver_district: payload.receiverDistrict || '',
    receiver_address: payload.receiverAddress || '',
    cargo_name: payload.cargoName || config.SF_CARGO_NAME || '租赁设备',
    weight_kg: Number(payload.weightKg || 1) || 1,
    planned_send_at: payload.plannedSendAt || null,
  }
}

async function quoteSfExpressShipment(payload = {}) {
  const config = await getConfig()
  const shipment = payload.shipmentId
    ? await getSfShipmentDetail({ shipmentId: payload.shipmentId })
    : buildSfPreviewShipment(payload, config)
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  if (shipment.service_kind !== 'express') return { ok: false, message: '当前产品不支持速运价格查询' }
  const serviceInput = shipmentAsServiceInput(shipment, config)
  const validation = validateCreateOrderPrerequisites(serviceInput)
  if (!validation.ok) return { ok: false, message: validationErrorMessage(validation) }
  const requestPayload = buildSfConsignedRequestPayload(buildSfRequestPayload({
    province: shipment.receiver_province,
    city: shipment.receiver_city,
    district: shipment.receiver_district,
    address: shipment.receiver_address,
    sender: serviceInput.sender,
    weight: serviceInput.weightKg,
    searchPrice: '1',
    expressTypeId: shipment.express_type_id,
  }, config), shipment.planned_send_at)
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_QUERY_DELIVERTM', requestPayload, config, 'delivery_quote')
    const result = normalizeDeliveryTimeQuoteResult(envelope, { expressTypeId: shipment.express_type_id })
    if (shipment.id) {
      await updateSfShipmentResult(shipment.id, {
        expectedArriveAt: result.expectedArriveAt,
        estimatedFee: result.estimatedFee,
        message: result.message || (result.ok ? '时效与预计费用查询完成' : undefined),
      })
      await addSfShipmentEvent(shipment.id, 'delivery_quote', shipment.status, result.message || '时效与预计费用查询完成', result)
      return { ...result, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
    }
    return result
  } catch (error) {
    return { ok: false, message: `预计费用与送达时间查询失败：${error.message}` }
  }
}

async function estimateSfShipmentExpectedArrival(shipment) {
  const result = await quoteSfExpressShipment({ shipmentId: shipment.id })
  if (result.ok && result.expectedArriveAt) {
    return { ...result, source: 'sf_deliver_time', message: `发货前预计送达：${result.expectedArriveAt}` }
  }
  return {
    ...result,
    ok: false,
    source: 'sf_deliver_time',
    message: result.message || '未查到发货前预计送达时间，将继续校验并下单；请在运单产生后关注物流状态。',
  }
}

async function placeSfShipment(payload = {}) {
  const shipment = payload.shipmentId
    ? await getSfShipmentDetail({ shipmentId: payload.shipmentId })
    : await saveSfShipmentDraft(payload)
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  if (shipment.service_kind !== 'express') return { ok: false, message: '顺丰同城当前仅支持询价，不能正式下单', shipment }
  if (shipment.status !== 'draft' && shipment.status !== 'precheck_failed') {
    return { ok: false, message: '该寄件单已进入下单流程，请查看现有结果，勿重复提交', shipment }
  }
  const config = await getConfig()
  const validation = validateCreateOrderPrerequisites(shipmentAsServiceInput(shipment, config))
  if (!validation.ok) return { ok: false, message: validationErrorMessage(validation), shipment }

  const deliveryEstimate = await estimateSfShipmentExpectedArrival(shipment)
  const precheck = await precheckSfShipment({ shipmentId: shipment.id })
  if (!precheck.ok || precheck.shipment?.status !== 'prechecked') {
    return {
      ...precheck,
      deliveryEstimate,
      estimateWarning: deliveryEstimate.ok ? '' : deliveryEstimate.message,
    }
  }

  const submitted = await submitSfShipment({ shipmentId: shipment.id })
  let result = submitted
  if (submitted.status === 'result_pending') {
    const recovered = await recoverSfShipmentResult({ shipmentId: shipment.id })
    result = recovered.status ? recovered : {
      ...submitted,
      message: `${submitted.message || '下单结果待确认'}；自动补查未确认结果：${recovered.message || '请稍后重试'}`,
    }
  }
  return {
    ...result,
    expectedArriveAt: result.expectedArriveAt || deliveryEstimate.expectedArriveAt || null,
    deliveryEstimate,
    estimateWarning: deliveryEstimate.ok ? '' : deliveryEstimate.message,
    paymentNotice: submitted.paymentNotice || result.paymentNotice,
  }
}

async function querySfShipmentPromiseTime({ shipmentId, trackingNo, verifyMobile } = {}) {
  const shipment = shipmentId ? await getSfShipmentDetail({ shipmentId }) : null
  const config = await getConfig()
  const waybillNo = trackingNo || shipment?.tracking_no
  if (!waybillNo) return { ok: false, message: '请先填写运单号' }
  const monthlyCard = String(config.SF_MONTHLY_CARD || '').trim()
  const mobile = String(verifyMobile || shipment?.receiver_mobile || '').trim()
  if (!monthlyCard && !mobile) return { ok: false, message: '未配置月结卡号时，请填写收件手机号用于运单校验' }
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_SEARCH_PROMITM', buildPromiseTimePayload({ waybillNo, monthlyCard, verifyMobile: mobile }), config, 'promise_time')
    const result = normalizePromiseTimeResult(envelope)
    if (shipment) {
      await updateSfShipmentResult(shipment.id, {
        expectedArriveAt: result.expectedArriveAt,
        message: result.ok ? result.message : undefined,
        promiseResult: result,
      })
      await addSfShipmentEvent(shipment.id, 'promise_time', shipment.status, result.message, result)
      if (shipment.linked_order_id && result.expectedArriveAt) {
        await updateShipping({
          orderId: shipment.linked_order_id,
          trackingNo: shipment.tracking_no,
          shippingMode: 'sf',
          latestLogisticsStatus: result.message || '已查询预计派送时间',
          actualShipAt: shipment.planned_send_at || null,
          expectedArriveAt: result.expectedArriveAt,
        })
      }
    }
    return { ...result, shipment: shipment ? await getSfShipmentDetail({ shipmentId: shipment.id }) : null }
  } catch (error) {
    return { ok: false, message: error.message }
  }
}

async function cancelSfShipment({ shipmentId } = {}) {
  const shipment = await getSfShipmentDetail({ shipmentId })
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  if (shipment.status === 'cancelled') return { ok: true, status: 'cancelled', message: '该寄件单已取消', shipment }
  if (shipment.status !== 'submitted') {
    return { ok: false, message: '只有已成功创建且尚未取消的顺丰订单可发起取消' }
  }
  const config = await getConfig()
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_UPDATE_ORDER', buildCancelOrderPayload({
      shipmentNo: shipment.shipment_no,
      waybillNo: shipment.tracking_no,
    }), config, 'cancel_order')
    const result = normalizeCancelOrderResult(envelope)
    if (!result.ok) return result
    await updateSfShipmentResult(shipment.id, {
      status: 'cancelled',
      message: result.message,
      cancelResult: result,
      markCancelled: true,
    })
    await addSfShipmentEvent(shipment.id, 'cancel_order', 'cancelled', result.message, result)
    if (shipment.linked_order_id) {
      await updateShipping({
        orderId: shipment.linked_order_id,
        trackingNo: shipment.tracking_no,
        shippingMode: 'sf',
        latestLogisticsStatus: '顺丰寄件已取消',
        actualShipAt: null,
        expectedArriveAt: shipment.expected_arrive_at,
      })
    }
    return { ...result, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
  } catch (error) {
    await addSfShipmentEvent(shipment.id, 'cancel_failed', shipment.status, error.message)
    return { ok: false, message: error.message }
  }
}

async function querySfShipmentRoutes({ shipmentId, trackingNo, verifyMobile, checkPhoneNo } = {}) {
  const shipment = shipmentId ? await getSfShipmentDetail({ shipmentId }) : null
  const waybillNo = trackingNo || shipment?.tracking_no
  if (!waybillNo) return { ok: false, message: '请先填写运单号' }
  const config = await getConfig()
  const phoneForCheck = checkPhoneNo || verifyMobile || shipment?.receiver_mobile || shipment?.sender_mobile
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_SEARCH_ROUTES', buildRouteQueryPayload({ waybillNo, checkPhoneNo: phoneForCheck }), config, 'routes')
    const result = normalizeRouteResult(envelope)
    if (shipment) {
      await updateSfShipmentResult(shipment.id, {
        message: result.latestStatus || result.message,
        routesResult: result,
        markRoutesUpdated: true,
      })
      await addSfShipmentEvent(shipment.id, 'routes', shipment.status, result.latestStatus || result.message, result)
      if (shipment.linked_order_id && result.latestStatus) {
        await updateShipping({
          orderId: shipment.linked_order_id,
          trackingNo: shipment.tracking_no,
          shippingMode: 'sf',
          latestLogisticsStatus: result.latestStatus,
          actualShipAt: shipment.planned_send_at || null,
          expectedArriveAt: shipment.expected_arrive_at,
        })
      }
      return { ...result, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
    }
    return result
  } catch (error) {
    return { ok: false, message: error.message }
  }
}

async function syncSfActualPaidExpense(shipment, actualPaid) {
  if (actualPaid.actualPaidFee === null || actualPaid.actualPaidFee === undefined) return null
  const order = shipment.linked_order_id ? await getOrderById(shipment.linked_order_id) : null
  const modelCode = order?.model_code || 'SF_STANDALONE'
  const expenseDate = String(shipment.planned_send_at || formatLocalDateTime(new Date())).slice(0, 10)
  const description = [
    `顺丰寄件 ${shipment.shipment_no}`,
    shipment.tracking_no ? `运单 ${shipment.tracking_no}` : '',
    actualPaid.source === 'manual' ? `人工修正：${actualPaid.note}` : '按顺丰清单运费入账',
  ].filter(Boolean).join('；')
  if (shipment.expense_record_id) {
    await mysqlAdapter.run(`
      UPDATE expense_records
      SET model_code = ?, expense_type = 'shipping_sf', amount = ?, description = ?, expense_date = ?, order_id = ?
      WHERE id = ?
    `, [modelCode, actualPaid.actualPaidFee, description, expenseDate, shipment.linked_order_id || null, shipment.expense_record_id])
    return shipment.expense_record_id
  }
  return await addExpenseRecord({
    model_code: modelCode,
    expense_type: 'shipping_sf',
    amount: actualPaid.actualPaidFee,
    description,
    expense_date: expenseDate,
    order_id: shipment.linked_order_id || null,
  })
}

async function querySfShipmentFee({ shipmentId, trackingNo, verifyMobile, checkPhoneNo } = {}) {
  const shipment = shipmentId ? await getSfShipmentDetail({ shipmentId }) : null
  const waybillNo = trackingNo || shipment?.tracking_no
  if (!waybillNo) return { ok: false, message: '请先填写运单号' }
  const config = await getConfig()
  const phoneForCheck = checkPhoneNo || verifyMobile || shipment?.receiver_mobile || shipment?.sender_mobile
  const monthlyCard = String(config.SF_MONTHLY_CARD || '').trim()
  if (!monthlyCard) {
    return { ok: false, message: '清单运费查询需要配置顺丰月结卡号；未配置时可在运单详情中手动填写实际支付金额用于月度统计。' }
  }
  try {
    const envelope = await invokeSfExpressService('EXP_RECE_QUERY_SFWAYBILL', buildWaybillFeePayload({ waybillNo, checkPhoneNo: phoneForCheck, monthlyCard }), config, 'waybill_fee')
    const result = normalizeWaybillFeeResult(envelope)
    if (!shipment || !result.ok || result.billedFee === null) return result
    const actualPaid = resolveActualPaidPolicy({
      billedFee: result.billedFee,
      existingActualPaidFee: shipment.actual_paid_fee,
      existingSource: shipment.actual_paid_source,
      existingNote: shipment.actual_paid_note,
    })
    const expenseRecordId = await syncSfActualPaidExpense(shipment, actualPaid)
    await updateSfShipmentResult(shipment.id, {
      billedFee: result.billedFee,
      billedFeeDetail: result.items,
      actualPaidFee: actualPaid.actualPaidFee,
      actualPaidSource: actualPaid.source,
      actualPaidNote: actualPaid.note,
      expenseRecordId,
      feeResult: result,
      markFeeUpdated: true,
      message: result.message || '清单运费查询完成',
    })
    await addSfShipmentEvent(shipment.id, 'waybill_fee', shipment.status, result.message || '清单运费查询完成', result)
    return { ...result, actualPaidFee: actualPaid.actualPaidFee, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
  } catch (error) {
    return { ok: false, message: error.message }
  }
}

function sfPendingOrderMissingFields(order = {}) {
  return [
    [order.customer_name, '收件人'],
    [order.customer_phone, '手机号'],
    [order.province, '省份'],
    [order.city, '城市'],
    [order.address, '详细地址'],
    [order.planned_ship_at, '计划取件时间'],
  ].filter(([value]) => !String(value || '').trim()).map(([, label]) => label)
}

function mapSfPendingShipmentOrder(row = {}) {
  const missingFields = sfPendingOrderMissingFields(row)
  const existingShipment = row.shipment_id ? {
    id: row.shipment_id,
    shipmentNo: row.shipment_no,
    status: row.shipment_status,
    trackingNo: row.shipment_tracking_no,
  } : null
  const canReuseDraft = ['draft', 'precheck_failed'].includes(row.shipment_status)
  const canCreateAfterClosedShipment = ['cancelled', 'rejected'].includes(row.shipment_status)
  const blockedByShipment = row.shipment_id && !canReuseDraft && !canCreateAfterClosedShipment
  return {
    ...row,
    existingShipment,
    missingFields,
    selectable: missingFields.length === 0 && !blockedByShipment,
    selectDisabledReason: missingFields.length
      ? `缺少${missingFields.join('、')}`
      : (blockedByShipment ? `已有顺丰寄件单：${row.shipment_no || row.shipment_status}` : ''),
  }
}

async function listSfPendingShipmentOrders({ date, includeOverdue = true } = {}) {
  await ensureSfShippingTables()
  const targetDate = String(date || formatLocalDateTime(new Date()).slice(0, 10)).slice(0, 10)
  const comparator = includeOverdue === false ? '= ?' : '<= ?'
  const rows = await mysqlAdapter.all(`
    SELECT o.*, u.unit_code, s.code AS store_code, s.name AS store_name,
      sh.id AS shipment_id, sh.shipment_no, sh.status AS shipment_status,
      sh.tracking_no AS shipment_tracking_no, sh.updated_at AS shipment_updated_at
    FROM rental_orders o
    LEFT JOIN schedule_units u ON u.id = o.unit_id
    LEFT JOIN stores s ON s.id = o.store_id
    LEFT JOIN sf_shipments sh ON sh.id = (
      SELECT s2.id
      FROM sf_shipments s2
      WHERE s2.linked_order_id = o.id
      ORDER BY s2.updated_at DESC, s2.id DESC
      LIMIT 1
    )
    WHERE o.order_status NOT IN ('completed', 'cancelled')
      AND IFNULL(o.planned_ship_at, '') != ''
      AND substr(o.planned_ship_at, 1, 10) ${comparator}
      AND IFNULL(o.actual_ship_at, '') = ''
    ORDER BY substr(o.planned_ship_at, 1, 16) ASC, o.id ASC
  `, [targetDate])
  return {
    date: targetDate,
    includeOverdue: includeOverdue !== false,
    orders: rows.map(mapSfPendingShipmentOrder),
  }
}

async function batchPlaceSfShipments(payload = {}) {
  const orderIds = Array.from(new Set((payload.orderIds || []).map((id) => Number(id)).filter(Boolean)))
  if (!orderIds.length) return { ok: false, message: '请选择需要寄件的订单', results: [] }
  const results = []
  for (const orderId of orderIds) {
    const order = await getOrderById(orderId)
    if (!order) {
      results.push({ orderId, ok: false, message: '订单不存在' })
      continue
    }
    const missingFields = sfPendingOrderMissingFields(order)
    if (missingFields.length) {
      results.push({ orderId, ok: false, message: `订单资料不完整：${missingFields.join('、')}` })
      continue
    }
    if (order.order_status === 'completed' || order.order_status === 'cancelled' || order.actual_ship_at) {
      results.push({ orderId, ok: false, message: '订单不在待发货状态' })
      continue
    }
    const existing = await mysqlAdapter.get(`
      SELECT * FROM sf_shipments
      WHERE linked_order_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `, [orderId])
    if (existing && !['draft', 'precheck_failed', 'cancelled', 'rejected'].includes(existing.status)) {
      results.push({
        orderId,
        ok: existing.status === 'submitted',
        skipped: true,
        shipmentId: existing.id,
        shipmentNo: existing.shipment_no,
        trackingNo: existing.tracking_no,
        status: existing.status,
        message: existing.status === 'submitted' ? '已有顺丰运单，未重复下单' : `已有顺丰寄件单处于${existing.status}，未重复下单`,
      })
      continue
    }
    try {
      const draftPayload = buildBatchShipmentPayloadFromOrder(order, payload)
      const reusableDraft = existing && ['draft', 'precheck_failed'].includes(existing.status)
        ? await saveSfShipmentDraft({ ...draftPayload, id: existing.id })
        : null
      const result = reusableDraft
        ? await placeSfShipment({ shipmentId: reusableDraft.id })
        : await placeSfShipment(draftPayload)
      results.push({
        orderId,
        ok: !!result.ok && result.status === 'submitted',
        shipmentId: result.shipment?.id,
        shipmentNo: result.shipment?.shipment_no,
        trackingNo: result.trackingNo || result.shipment?.tracking_no,
        status: result.status || result.shipment?.status,
        message: result.message || (result.ok ? '寄件成功' : '寄件失败'),
      })
    } catch (error) {
      results.push({ orderId, ok: false, message: error.message })
    }
  }
  return {
    ok: results.some((item) => item.ok),
    total: results.length,
    successCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length,
    results,
  }
}

async function updateSfShipmentActualPaid({ shipmentId, actualPaidFee, note } = {}) {
  const shipment = await getSfShipmentDetail({ shipmentId })
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  const actualPaid = resolveActualPaidPolicy({
    billedFee: shipment.billed_fee === null || shipment.billed_fee === undefined ? null : Number(shipment.billed_fee),
    requestedActualPaidFee: actualPaidFee,
    requestedNote: note,
  })
  if (!actualPaid.ok) return actualPaid
  const expenseRecordId = await syncSfActualPaidExpense(shipment, actualPaid)
  await updateSfShipmentResult(shipment.id, {
    actualPaidFee: actualPaid.actualPaidFee,
    actualPaidSource: actualPaid.source,
    actualPaidNote: actualPaid.note,
    expenseRecordId,
  })
  await addSfShipmentEvent(shipment.id, 'actual_paid_updated', shipment.status, '实际支付金额已更新', actualPaid)
  return { ...actualPaid, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
}

async function quoteSfIntraCity({ shipmentId } = {}) {
  const shipment = await getSfShipmentDetail({ shipmentId })
  if (!shipment) return { ok: false, message: '寄件单不存在' }
  const config = await getConfig()
  const api = String(config.SF_INTRACITY_API || '').trim()
  const required = ['SF_INTRACITY_COMPANY_CODE', 'SF_INTRACITY_ACCESS_CODE', 'SF_INTRACITY_CHECKWORD', 'SF_INTRACITY_PROJECT_CODE', 'SF_INTRACITY_SHOP_ID']
  if (!api || required.some((key) => !String(config[key] || '').trim())) {
    return { ok: false, message: '顺丰同城询价配置不完整' }
  }
  const msgData = buildIntraCityQuotePayload({
    config: {
      projectCode: config.SF_INTRACITY_PROJECT_CODE,
      shopId: config.SF_INTRACITY_SHOP_ID,
      shopType: config.SF_INTRACITY_SHOP_TYPE,
    },
    cityName: shipment.receiver_city || shipment.sender_city,
    address: [shipment.receiver_province, shipment.receiver_city, shipment.receiver_district, shipment.receiver_address].filter(Boolean).join(''),
    weightGram: Math.round(Number(shipment.weight_kg || 1) * 1000),
  })
  const request = {
    CompanyCode: config.SF_INTRACITY_COMPANY_CODE,
    AccessCode: config.SF_INTRACITY_ACCESS_CODE,
    Checkword: config.SF_INTRACITY_CHECKWORD,
    ServiceCode: 'FEE_TIME_SERVICE',
    ...msgData,
  }
  try {
    const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
    const rawText = await response.text()
    const envelope = parseSfHttpResponseText(rawText)
    if (!response.ok || !envelope) throw new Error(getSfHttpErrorMessage(response, envelope, rawText))
    const result = normalizeIntraCityQuoteResult(envelope)
    await updateSfShipmentResult(shipment.id, {
      status: result.ok ? 'quoted' : 'quote_failed',
      quoteFee: result.fee,
      message: result.message,
      precheckResult: result,
    })
    await addSfShipmentEvent(shipment.id, 'intracity_quote', result.ok ? 'quoted' : 'quote_failed', result.message, result)
    return { ...result, shipment: await getSfShipmentDetail({ shipmentId: shipment.id }) }
  } catch (error) {
    await updateSfShipmentResult(shipment.id, { status: 'quote_failed', message: error.message })
    await addSfShipmentEvent(shipment.id, 'intracity_quote', 'quote_failed', error.message)
    return { ok: false, message: error.message }
  }
}


async function createOrder({
  storeId,
  sessionId,
  orderNo,
  customerName,
  customerPhone,
  province,
  city,
  district,
  address,
  modelCode,
  unitId,
  rentStartDate,
  rentEndDate,
  fee = 0,
  deposit = 0,
  isDepositFree = 0,
  orderStatus = 'waiting_payment',
  plannedShipAt,
  expectedArriveAt,
  trackingNo,
  shippingMode,
  latestLogisticsStatus,
  sourceChannel,
  sourceName,
  remark,
}) {
  const normalizedModelCode = String(modelCode || '').trim()
  const normalizedRentStartDate = normalizeDateOnly(rentStartDate)
  const normalizedRentEndDate = normalizeDateOnly(rentEndDate)
  if (!normalizedModelCode) return { ok: false, message: '型号编码不能为空' }
  if (!normalizedRentStartDate || !normalizedRentEndDate) return { ok: false, message: '租期开始和结束日期不能为空' }
  if (normalizedRentEndDate < normalizedRentStartDate) return { ok: false, message: '租期结束日期不能早于开始日期' }
  const resolvedStoreId = await resolveStoreId(storeId)
  const resolvedProvince = province || normalizeProvinceFromAddress({ province, city, address })
  const resolvedShippingMode = shippingMode || 'land'
  const resolvedUnitId = unitId ?? await findAvailableUnitId(normalizedModelCode, normalizedRentStartDate, normalizedRentEndDate)
  const shipPlan = (!plannedShipAt || !expectedArriveAt)
    ? await calculateShipPlan(withFallbackProvince({ province: resolvedProvince, city, district, address, customerName, customerPhone, rentStartDate: normalizedRentStartDate, shippingMode: resolvedShippingMode, orderId: orderNo || undefined }))
    : { plannedShipAt, expectedArriveAt }
  const resolvedPlannedShipAt = plannedShipAt || shipPlan.plannedShipAt
  const resolvedExpectedArriveAt = expectedArriveAt || shipPlan.expectedArriveAt
  if (resolvedUnitId) {
    const conflict = await findScheduleConflict({
      unitId: resolvedUnitId,
      rentStartDate: normalizedRentStartDate,
      rentEndDate: normalizedRentEndDate,
      plannedShipAt: resolvedPlannedShipAt,
      expectedArriveAt: resolvedExpectedArriveAt,
    })
    if (conflict) return { ok: false, message: formatScheduleConflictMessage(conflict) }
  }

  const result = await mysqlAdapter.run(`
    INSERT INTO rental_orders (
      store_id, session_id, order_no, customer_name, customer_phone, province, city, district, address,
      model_code, unit_id, rent_start_date, rent_end_date, fee, deposit, is_deposit_free,
      order_status, planned_ship_at, expected_arrive_at, tracking_no, shipping_mode, latest_logistics_status,
      source_channel, source_name, remark, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
  `, [resolvedStoreId,
    sessionId ?? null,
    orderNo ?? null,
    customerName ?? null,
    customerPhone ?? null,
    resolvedProvince ?? null,
    city ?? null,
    district ?? null,
    address ?? null,
    normalizedModelCode,
    resolvedUnitId ?? null,
    normalizedRentStartDate,
    normalizedRentEndDate,
    fee,
    deposit,
    Number(isDepositFree) ? 1 : 0,
    orderStatus,
    resolvedPlannedShipAt ?? null,
    resolvedExpectedArriveAt ?? null,
    trackingNo ?? null,
    resolvedShippingMode ?? null,
    latestLogisticsStatus ?? null,
    sourceChannel ?? null,
    sourceName ?? null,
    remark ?? null,])
  const orderId = result.lastInsertRowid
  await rebuildOrderScheduleBlocks({
    orderId,
    unitId: resolvedUnitId,
    modelCode: normalizedModelCode,
    rentStartDate: normalizedRentStartDate,
    rentEndDate: normalizedRentEndDate,
    plannedShipAt: resolvedPlannedShipAt,
    expectedArriveAt: resolvedExpectedArriveAt,
  })
  await syncScheduleUnitStatus(resolvedUnitId)

  if (trackingNo || resolvedShippingMode || latestLogisticsStatus || resolvedExpectedArriveAt) {
    await mysqlAdapter.run(`
      INSERT INTO shipping_records (order_id, tracking_no, shipping_mode, latest_status, actual_ship_at, expected_arrive_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ${nowExpr()})
    `, [orderId, trackingNo ?? null, resolvedShippingMode ?? null, latestLogisticsStatus ?? null, null, resolvedExpectedArriveAt ?? null])
  }

  return {
    ok: true,
    id: orderId,
    unitId: resolvedUnitId,
    plannedShipAt: resolvedPlannedShipAt,
    expectedArriveAt: resolvedExpectedArriveAt,
    source: shipPlan?.source || 'manual',
    fallbackReason: shipPlan?.fallbackReason || null,
  }
}

async function updateOrder({
  orderId,
  storeId,
  orderNo,
  customerName,
  customerPhone,
  province,
  city,
  district,
  address,
  modelCode,
  unitId,
  rentStartDate,
  rentEndDate,
  fee = 0,
  deposit = 0,
  orderStatus,
  plannedShipAt,
  expectedArriveAt,
  trackingNo,
  shippingMode,
  latestLogisticsStatus,
  sourceChannel,
  sourceName,
  remark,
} = {}) {
  const normalizedOrderId = Number.parseInt(String(orderId || ''), 10)
  if (!normalizedOrderId) return { ok: false, message: '订单 ID 不能为空' }
  const existing = await getOrderById(normalizedOrderId)
  if (!existing) return { ok: false, message: '订单不存在' }

  const normalizedModelCode = String(modelCode || existing.model_code || '').trim()
  const normalizedRentStartDate = normalizeDateOnly(rentStartDate || existing.rent_start_date)
  const normalizedRentEndDate = normalizeDateOnly(rentEndDate || existing.rent_end_date)
  if (!normalizedModelCode) return { ok: false, message: '型号编码不能为空' }
  if (!normalizedRentStartDate || !normalizedRentEndDate) return { ok: false, message: '租期开始和结束日期不能为空' }
  if (normalizedRentEndDate < normalizedRentStartDate) return { ok: false, message: '租期结束日期不能早于开始日期' }

  const resolvedStoreId = await resolveStoreId(storeId || existing.store_id)
  const resolvedProvince = province || normalizeProvinceFromAddress({ province, city, address }) || existing.province
  const resolvedShippingMode = shippingMode || existing.shipping_mode || 'land'
  const resolvedUnitId = unitId ?? existing.unit_id ?? await findAvailableUnitId(normalizedModelCode, normalizedRentStartDate, normalizedRentEndDate)
  const shipPlan = (!plannedShipAt || !expectedArriveAt)
    ? await calculateShipPlan(withFallbackProvince({
      province: resolvedProvince,
      city: city ?? existing.city,
      district: district ?? existing.district,
      address: address ?? existing.address,
      customerName: customerName ?? existing.customer_name,
      customerPhone: customerPhone ?? existing.customer_phone,
      rentStartDate: normalizedRentStartDate,
      shippingMode: resolvedShippingMode,
      orderId: orderNo || existing.order_no || undefined,
    }))
    : { plannedShipAt, expectedArriveAt }
  const resolvedPlannedShipAt = plannedShipAt || shipPlan.plannedShipAt
  const resolvedExpectedArriveAt = expectedArriveAt || shipPlan.expectedArriveAt

  if (resolvedUnitId) {
    const conflict = await findScheduleConflict({
      unitId: resolvedUnitId,
      rentStartDate: normalizedRentStartDate,
      rentEndDate: normalizedRentEndDate,
      plannedShipAt: resolvedPlannedShipAt,
      expectedArriveAt: resolvedExpectedArriveAt,
      excludeOrderId: normalizedOrderId,
    })
    if (conflict) return { ok: false, message: formatScheduleConflictMessage(conflict) }
  }

  await mysqlAdapter.run(`
    UPDATE rental_orders
    SET store_id = ?, order_no = ?, customer_name = ?, customer_phone = ?, province = ?, city = ?, district = ?, address = ?,
      model_code = ?, unit_id = ?, rent_start_date = ?, rent_end_date = ?, fee = ?, deposit = ?,
      order_status = COALESCE(?, order_status), planned_ship_at = ?, expected_arrive_at = ?, tracking_no = ?,
      shipping_mode = ?, latest_logistics_status = ?, source_channel = ?, source_name = ?, remark = ?, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [
    resolvedStoreId,
    orderNo ?? null,
    customerName ?? null,
    customerPhone ?? null,
    resolvedProvince ?? null,
    city ?? null,
    district ?? null,
    address ?? null,
    normalizedModelCode,
    resolvedUnitId ?? null,
    normalizedRentStartDate,
    normalizedRentEndDate,
    Number(fee) || 0,
    Number(deposit) || 0,
    orderStatus || null,
    resolvedPlannedShipAt ?? null,
    resolvedExpectedArriveAt ?? null,
    trackingNo ?? null,
    resolvedShippingMode ?? null,
    latestLogisticsStatus ?? null,
    sourceChannel ?? null,
    sourceName ?? null,
    remark ?? null,
    normalizedOrderId,
  ])

  await rebuildOrderScheduleBlocks({
    orderId: normalizedOrderId,
    unitId: resolvedUnitId,
    modelCode: normalizedModelCode,
    rentStartDate: normalizedRentStartDate,
    rentEndDate: normalizedRentEndDate,
    plannedShipAt: resolvedPlannedShipAt,
    expectedArriveAt: resolvedExpectedArriveAt,
  })
  if (existing.unit_id && existing.unit_id !== resolvedUnitId) await syncScheduleUnitStatus(existing.unit_id)
  await syncScheduleUnitStatus(resolvedUnitId)
  return {
    ok: true,
    order: await getOrderById(normalizedOrderId),
    plannedShipAt: resolvedPlannedShipAt,
    expectedArriveAt: resolvedExpectedArriveAt,
    source: shipPlan?.source || 'manual',
    fallbackReason: shipPlan?.fallbackReason || null,
  }
}

async function updateShipping({ orderId, trackingNo, shippingMode, latestLogisticsStatus, actualShipAt, expectedArriveAt }) {
  await mysqlAdapter.run(`
    UPDATE rental_orders
    SET tracking_no = ?, shipping_mode = COALESCE(?, shipping_mode), latest_logistics_status = ?, actual_ship_at = ?, expected_arrive_at = COALESCE(?, expected_arrive_at), updated_at = ${nowExpr()}
    WHERE id = ?
  `, [trackingNo ?? null, shippingMode ?? null, latestLogisticsStatus ?? null, actualShipAt ?? null, expectedArriveAt ?? null, orderId])
  const existing = await mysqlAdapter.get('SELECT id FROM shipping_records WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId])
  if (existing) {
    await mysqlAdapter.run(`
      UPDATE shipping_records
      SET tracking_no = ?, shipping_mode = ?, latest_status = ?, actual_ship_at = ?, expected_arrive_at = ?, updated_at = ${nowExpr()}
      WHERE id = ?
    `, [trackingNo ?? null, shippingMode ?? null, latestLogisticsStatus ?? null, actualShipAt ?? null, expectedArriveAt ?? null, existing.id])
  } else {
    await mysqlAdapter.run(`
      INSERT INTO shipping_records (order_id, tracking_no, shipping_mode, latest_status, actual_ship_at, expected_arrive_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ${nowExpr()})
    `, [orderId, trackingNo ?? null, shippingMode ?? null, latestLogisticsStatus ?? null, actualShipAt ?? null, expectedArriveAt ?? null])
  }

  const order = await getOrderById(orderId)
  if (order) {
    await rebuildOrderScheduleBlocks({
      orderId,
      unitId: order.unit_id,
      modelCode: order.model_code,
      rentStartDate: order.rent_start_date,
      rentEndDate: order.rent_end_date,
      plannedShipAt: order.planned_ship_at,
      expectedArriveAt: expectedArriveAt ?? order.expected_arrive_at,
    })
  }

  return { ok: true, order: await getOrderById(orderId) }
}

async function listLearningCandidates(filters = {}) {
  const { reviewStatus = 'pending', modelCode } = filters
  const where = []
  const params = []
  if (reviewStatus) {
    where.push('review_status = ?')
    params.push(reviewStatus)
  }
  if (modelCode) {
    where.push('model_code = ?')
    params.push(modelCode)
  }
  const sql = `
    SELECT * FROM learning_candidates
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC, id DESC
  `
  return (await mysqlAdapter.all(sql, params)).map((row) => ({ ...row, tags: parseTags(row.tags) }))
}

async function approveLearningCandidate({ candidateId, scopeType = 'global', modelCode, bizItemCode, tags = [] }) {
  const candidate = await mysqlAdapter.get('SELECT * FROM learning_candidates WHERE id = ?', [candidateId])
  if (!candidate) return { ok: false, message: 'candidate not found' }

  let resolvedBizItemCode = bizItemCode ?? null
  if (!resolvedBizItemCode && scopeType === 'biz_item' && candidate.item_id) {
    const mapping = await mysqlAdapter.get('SELECT biz_item_code FROM item_model_mapping WHERE item_id = ? LIMIT 1', [candidate.item_id])
    resolvedBizItemCode = mapping?.biz_item_code ?? null
  }

  const knowledgeId = await mysqlAdapter.transaction(async (conn) => {
    const result = await conn.run(`
      INSERT INTO knowledge (item_id, biz_item_code, scope_type, model_code, question, answer, tags, source_type, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'human_takeover', 'approved', ${nowExpr()})
    `, [
      candidate.item_id ?? null,
      resolvedBizItemCode,
      scopeType,
      modelCode ?? candidate.model_code ?? null,
      candidate.question,
      candidate.final_answer,
      normalizeTags(tags.length ? tags : parseTags(candidate.tags)),
    ])
    await conn.run(`
      UPDATE learning_candidates
      SET review_status = 'approved', reviewer = 'ui', reviewed_at = ${nowExpr()}
      WHERE id = ?
    `, [candidateId])
    return result.lastInsertRowid
  })

  return { ok: true, id: knowledgeId }
}

async function rejectLearningCandidate(candidateId) {
  const result = await mysqlAdapter.run(`
    UPDATE learning_candidates
    SET review_status = 'rejected', reviewer = 'ui', reviewed_at = ${nowExpr()}
    WHERE id = ?
  `, [candidateId])
  return { ok: result.changes > 0 }
}

// Sprint 6+ : 结构化学习建议（价格/档期/物流/售后 等不进知识库的候选）
async function listStructuredSuggestions(filters = {}) {
  const { category, status = 'pending', limit = 200 } = filters || {}
  const where = []
  const params = []
  if (category) { where.push('category = ?'); params.push(category) }
  if (status) { where.push('status = ?'); params.push(status) }
  const sql = `
    SELECT * FROM structured_learning_suggestions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY id DESC
    LIMIT ?
  `
  params.push(Number(limit) || 200)
  try {
    return await mysqlAdapter.all(sql, params)
  } catch (e) {
    return []
  }
}

async function updateStructuredSuggestionStatus({ id, status } = {}) {
  if (!id || !status) return { ok: false, message: 'id and status required' }
  try {
    const result = await mysqlAdapter.run(
      `UPDATE structured_learning_suggestions SET status = ?, updated_at = ${nowExpr()} WHERE id = ?`,
      [status, id],
    )
    return { ok: (result.changes || 0) > 0 }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}

// Sprint 7+ : 一次性清理旧的重复候选 / 重复结构化建议
async function dedupLegacyLearningCandidates() {
  let learningDeleted = 0
  let structuredDeleted = 0
  try {
    const r = await mysqlAdapter.run(`
      DELETE lc1 FROM learning_candidates lc1
      INNER JOIN learning_candidates lc2
        ON lc1.id > lc2.id
       AND LOWER(TRIM(lc1.question)) = LOWER(TRIM(lc2.question))
       AND LOWER(TRIM(lc1.final_answer)) = LOWER(TRIM(lc2.final_answer))
    `)
    learningDeleted = r.changes || 0
  } catch (e) {
    learningDeleted = 0
  }
  try {
    const r = await mysqlAdapter.run(`
      DELETE sl1 FROM structured_learning_suggestions sl1
      INNER JOIN structured_learning_suggestions sl2
        ON sl1.id > sl2.id
       AND sl1.category = sl2.category
       AND LOWER(TRIM(COALESCE(sl1.user_message, ''))) = LOWER(TRIM(COALESCE(sl2.user_message, '')))
       AND LOWER(TRIM(COALESCE(sl1.bot_or_human_reply, ''))) = LOWER(TRIM(COALESCE(sl2.bot_or_human_reply, '')))
    `)
    structuredDeleted = r.changes || 0
  } catch (e) {
    structuredDeleted = 0
  }
  return { ok: true, learningDeleted, structuredDeleted }
}

async function getDashboardStats() {
  const pendingTakeovers = (await mysqlAdapter.get(`SELECT COUNT(*) AS count FROM takeover_tasks WHERE status IN ('new', 'notified', 'timeout', 'escalated')`))?.count || 0
  const activeOrders = (await mysqlAdapter.get(`SELECT COUNT(*) AS count FROM rental_orders WHERE order_status NOT IN ('completed', 'cancelled')`))?.count || 0
  const pendingLearning = (await mysqlAdapter.get(`SELECT COUNT(*) AS count FROM learning_candidates WHERE review_status = 'pending'`))?.count || 0
  const activeBlocks = (await mysqlAdapter.get(`SELECT COUNT(*) AS count FROM schedule_blocks WHERE status = 'active'`))?.count || 0
  return { pendingTakeovers, activeOrders, pendingLearning, activeBlocks }
}

// Sprint 7：运营指标聚合（"机器人今天干了啥"）
async function safeCount(sql) {
  try {
    const row = await mysqlAdapter.get(sql)
    return Number(row?.count || 0)
  } catch (e) {
    return 0
  }
}

async function getOpsMetrics() {
  const [
    autoReplyToday,
    manualTakeoverToday,
    takeoverPending,
    bookingDraftsToday,
    bookingConvertedToday,
    structuredPending,
    feishuPending,
  ] = await Promise.all([
    safeCount(`SELECT COUNT(*) AS count FROM chat_messages WHERE role='assistant' AND DATE(created_at) = CURDATE()`),
    safeCount(`SELECT COUNT(*) AS count FROM takeover_tasks WHERE DATE(created_at) = CURDATE()`),
    safeCount(`SELECT COUNT(*) AS count FROM takeover_tasks WHERE status IN ('new','notified')`),
    safeCount(`SELECT COUNT(*) AS count FROM booking_drafts WHERE DATE(updated_at) = CURDATE()`),
    safeCount(`SELECT COUNT(*) AS count FROM booking_drafts WHERE DATE(updated_at) = CURDATE() AND (state='order_drafted' OR (state='closed' AND closed_reason='success'))`),
    safeCount(`SELECT COUNT(*) AS count FROM structured_learning_suggestions WHERE status='pending'`),
    safeCount(`SELECT COUNT(*) AS count FROM feishu_pending_replies WHERE status='pending'`),
  ])
  const total = autoReplyToday + manualTakeoverToday
  const hitRate = total > 0 ? Math.round((autoReplyToday / total) * 10000) / 10000 : 0
  const conversionRate = bookingDraftsToday > 0
    ? Math.round((bookingConvertedToday / bookingDraftsToday) * 10000) / 10000
    : 0
  return {
    generatedAt: new Date().toISOString(),
    autoReplyToday,
    manualTakeoverToday,
    takeoverPending,
    hitRate,
    bookingDraftsToday,
    bookingConvertedToday,
    bookingConversionRate: conversionRate,
    structuredPending,
    feishuPending,
  }
}

async function listShippingRecords(orderId) {
  return await mysqlAdapter.all(`
    SELECT * FROM shipping_records
    WHERE order_id = ?
    ORDER BY created_at DESC, id DESC
  `, [orderId])
}

async function queryLogistics({ orderId, trackingNo } = {}) {
  const config = await getConfig()
  const enabled = String(config.LOGISTICS_QUERY_ENABLED || 'False').toLowerCase() === 'true'
  if (!enabled) {
    return { ok: false, message: '未开启真实物流查询，请先在设置页开启并配置 API。' }
  }
  const api = String(config.LOGISTICS_QUERY_API || '').trim()
  if (!api) {
    return { ok: false, message: '未配置物流查询 API 地址。' }
  }

  const order = orderId ? await getOrderById(orderId) : null
  const resolvedTrackingNo = String(trackingNo || order?.tracking_no || '').trim()
  if (!resolvedTrackingNo) {
    return { ok: false, message: '请先填写运单号。' }
  }

  const headers = { 'Content-Type': 'application/json' }
  const token = String(config.LOGISTICS_QUERY_TOKEN || '').trim()
  if (token) headers.Authorization = `Bearer ${token}`

  const payload = {
    trackingNo: resolvedTrackingNo,
    orderId: orderId ?? null,
    carrier: 'sf',
  }

  let response
  try {
    response = await fetch(api, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch (error) {
    return { ok: false, message: `物流查询请求失败：${error.message}` }
  }

  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    const errorMessage = firstNonEmpty([json?.message, json?.error, `HTTP ${response.status}`])
    return { ok: false, message: `物流查询失败：${errorMessage}` }
  }

  const normalized = normalizeLogisticsResponse(json)
  if (!orderId) {
    return { ok: true, message: normalized.latestStatus || '查询成功', ...normalized }
  }

  const nextTrackingNo = resolvedTrackingNo
  const nextShippingMode = order?.shipping_mode || null
  const nextLatestStatus = normalized.latestStatus || order?.latest_logistics_status || '已查询物流'
  const nextActualShipAt = normalized.actualShipAt || order?.actual_ship_at || null
  const nextExpectedArriveAt = normalized.expectedArriveAt || order?.expected_arrive_at || null

  await mysqlAdapter.run(`
    UPDATE rental_orders
    SET tracking_no = ?, latest_logistics_status = ?, actual_ship_at = ?, expected_arrive_at = ?, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [nextTrackingNo, nextLatestStatus, nextActualShipAt, nextExpectedArriveAt, orderId])
  if (normalized.traces.length) {
    const insertTraceSQL = `
      INSERT INTO shipping_records (order_id, tracking_no, shipping_mode, latest_status, actual_ship_at, expected_arrive_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
    `
    await mysqlAdapter.transaction(async (conn) => {
      for (const item of normalized.traces) {
        await conn.run(insertTraceSQL, [
          orderId,
          item.tracking_no || nextTrackingNo,
          nextShippingMode,
          item.latest_status,
          item.actual_ship_at,
          item.expected_arrive_at,
          item.created_at || formatLocalDateTime(new Date()),
        ])
      }
    })
  } else {
    const existing = await mysqlAdapter.get('SELECT id FROM shipping_records WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId])
    if (existing) {
      await mysqlAdapter.run(`
        UPDATE shipping_records
        SET tracking_no = ?, shipping_mode = ?, latest_status = ?, actual_ship_at = ?, expected_arrive_at = ?, updated_at = ${nowExpr()}
        WHERE id = ?
      `, [nextTrackingNo, nextShippingMode, nextLatestStatus, nextActualShipAt, nextExpectedArriveAt, existing.id])
    } else {
      await mysqlAdapter.run(`
        INSERT INTO shipping_records (order_id, tracking_no, shipping_mode, latest_status, actual_ship_at, expected_arrive_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ${nowExpr()})
      `, [orderId, nextTrackingNo, nextShippingMode, nextLatestStatus, nextActualShipAt, nextExpectedArriveAt])
    }
  }

  const refreshedOrder = await getOrderById(orderId)
  if (refreshedOrder) {
    await rebuildOrderScheduleBlocks({
      orderId,
      unitId: refreshedOrder.unit_id,
      modelCode: refreshedOrder.model_code,
      rentStartDate: refreshedOrder.rent_start_date,
      rentEndDate: refreshedOrder.rent_end_date,
      plannedShipAt: refreshedOrder.planned_ship_at,
      expectedArriveAt: refreshedOrder.expected_arrive_at,
    })
  }

  return {
    ok: true,
    message: nextLatestStatus,
    latestStatus: nextLatestStatus,
    actualShipAt: nextActualShipAt,
    expectedArriveAt: nextExpectedArriveAt,
    traces: await listShippingRecords(orderId),
    order: await getOrderById(orderId),
  }
}

async function getSystemCheck() {
  const config = await getConfig()
  const stats = await getDashboardStats()
  return {
    checks: [
      { key: 'apiKey', label: 'API Key', ok: !!config.API_KEY, detail: config.API_KEY ? '已配置' : '缺失' },
      { key: 'cookies', label: '闲鱼 Cookies', ok: !!config.COOKIES_STR, detail: config.COOKIES_STR ? '已配置' : '缺失' },
      { key: 'salesWebhook', label: '飞书销售通知', ok: !!config.FEISHU_WEBHOOK_SALES, detail: config.FEISHU_WEBHOOK_SALES ? '已配置' : '缺失' },
      { key: 'orderWebhook', label: '飞书履约通知', ok: !!config.FEISHU_WEBHOOK_ORDER, detail: config.FEISHU_WEBHOOK_ORDER ? '已配置' : '缺失' },
      { key: 'feishuAppId', label: '飞书应用 App ID', ok: !!config.FEISHU_APP_ID, detail: config.FEISHU_APP_ID ? '已配置' : '缺失' },
      { key: 'feishuAppSecret', label: '飞书应用 Secret', ok: !!config.FEISHU_APP_SECRET, detail: config.FEISHU_APP_SECRET ? '已配置' : '缺失' },
      { key: 'feishuVerifyToken', label: '飞书事件校验 Token', ok: !!config.FEISHU_VERIFICATION_TOKEN, detail: config.FEISHU_VERIFICATION_TOKEN ? '已配置' : '缺失' },
      { key: 'replyMode', label: '回复模式', ok: !!config.REPLY_MODE_DEFAULT, detail: config.REPLY_MODE_DEFAULT || 'faq_strict' },
      { key: 'xiaohongshu', label: '小红书增强', ok: String(config.XIAOHONGSHU_ENABLED || 'False').toLowerCase() === 'true', detail: config.XIAOHONGSHU_ENABLED || 'False' },
      { key: 'phoneAlert', label: '电话升级', ok: String(config.PHONE_ALERT_ENABLED || 'False').toLowerCase() === 'true', detail: config.PHONE_ALERT_ENABLED || 'False' },
      { key: 'sfOpen', label: '顺丰时效查询', ...getSfConfigCheck(config) },
      { key: 'sfRule', label: '川内特殊地区', ok: true, detail: getSfRegionRuleDetail(config) },
    ],
    stats,
  }
}

function generateXiaohongshuKeyword({ modelCode, userMessage }) {
  const keyword = [modelCode, userMessage].filter(Boolean).join(' ').trim()
  return { keyword: keyword || '闲鱼租赁 使用教程' }
}

async function estimateShippingPreview({ province, city, district, address, rentStartDate, shippingMode = 'land' }) {
  if (!rentStartDate) return null
  return await calculateShipPlan(withFallbackProvince({ province, city, district, address, rentStartDate, shippingMode }))
}

// ═══════════════════════════════════════════════════════════════════════════
// 飞书待确认回复
// ═══════════════════════════════════════════════════════════════════════════

async function createFeishuPendingReply(payload) {
  const result = await mysqlAdapter.run(`
    INSERT INTO feishu_pending_replies (
      session_id, item_id, model_code, user_question, ai_draft, search_result,
      reply_type, status, feishu_message_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ${nowExpr()}, ${nowExpr()})
  `, [
    payload.session_id, payload.item_id ?? null, payload.model_code ?? null,
    payload.user_question, payload.ai_draft ?? null, payload.search_result ?? null,
    payload.reply_type ?? 'faq_miss', payload.feishu_message_id ?? null,
  ])
  return result.lastInsertRowid
}

async function listFeishuPendingReplies(status = 'pending') {
  return await mysqlAdapter.all('SELECT * FROM feishu_pending_replies WHERE status = ? ORDER BY created_at DESC', [status])
}

async function resolveFeishuPendingReply(id, finalReply, approvedBy) {
  await mysqlAdapter.run(`
    UPDATE feishu_pending_replies
    SET status = 'approved', final_reply = ?, approved_by = ?, resolved_at = ${nowExpr()}, updated_at = ${nowExpr()}
    WHERE id = ?
  `, [finalReply, approvedBy ?? 'manual', id])
  return await mysqlAdapter.get('SELECT * FROM feishu_pending_replies WHERE id = ?', [id])
}

async function rejectFeishuPendingReply(id) {
  await mysqlAdapter.run(`UPDATE feishu_pending_replies SET status = 'rejected', resolved_at = ${nowExpr()}, updated_at = ${nowExpr()} WHERE id = ?`, [id])
}

// ═══════════════════════════════════════════════════════════════════════════
// 市场监控
// ═══════════════════════════════════════════════════════════════════════════

async function createMarketSnapshot(payload) {
  const result = await mysqlAdapter.run(`
    INSERT INTO market_snapshots (
      model_code, snapshot_time, total_listings, avg_price, min_price, max_price,
      median_price, sold_count, price_band_json, source, created_at
    ) VALUES (?, ${nowExpr()}, ?, ?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
  `, [
    payload.model_code, payload.total_listings ?? 0,
    payload.avg_price ?? 0, payload.min_price ?? 0, payload.max_price ?? 0,
    payload.median_price ?? 0, payload.sold_count ?? 0,
    payload.price_band_json ? JSON.stringify(payload.price_band_json) : null,
    payload.source ?? 'xianyu',
  ])
  return result.lastInsertRowid
}

async function listMarketSnapshots(filters = {}) {
  const { modelCode, startDate, endDate, limit } = filters
  const where = []
  const params = []
  if (modelCode) { where.push('model_code = ?'); params.push(modelCode) }
  if (startDate) { where.push('snapshot_time >= ?'); params.push(startDate) }
  if (endDate) { where.push('snapshot_time <= ?'); params.push(endDate) }
  const sql = `
    SELECT * FROM market_snapshots
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY snapshot_time DESC
    ${limit ? `LIMIT ${Number(limit)}` : 'LIMIT 500'}
  `
  return await mysqlAdapter.all(sql, params)
}

async function getMarketTrend(modelCode, days = 30) {
  const rows = await mysqlAdapter.all(`
    SELECT
      date(snapshot_time) as day,
      AVG(avg_price) as avg_price,
      MIN(min_price) as min_price,
      MAX(max_price) as max_price,
      AVG(total_listings) as avg_listings,
      SUM(sold_count) as total_sold
    FROM market_snapshots
    WHERE model_code = ? AND snapshot_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
    GROUP BY day ORDER BY day ASC
  `, [modelCode, days])
  return rows
}

async function batchCreateMarketListings(snapshotId, listings) {
  const insertListingSQL = `
    INSERT INTO market_listings (
      snapshot_id, model_code, listing_id, title, price, seller_name,
      location, is_rental, status, first_seen_at, last_seen_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ${nowExpr()}, ${nowExpr()}, ${nowExpr()})
  `
  await mysqlAdapter.transaction(async (conn) => {
    for (const item of listings) {
      await conn.run(insertListingSQL, [snapshotId, item.model_code, item.listing_id, item.title ?? null,
        item.price ?? 0, item.seller_name ?? null, item.location ?? null, item.is_rental ? 1 : 0])
    }
  })
}

async function getMarketAlerts(modelCode, days = 7) {
  // 检测价格异动：最近快照 vs 之前平均值
  const recent = await mysqlAdapter.get(`
    SELECT avg_price, total_listings, snapshot_time FROM market_snapshots
    WHERE model_code = ? ORDER BY snapshot_time DESC LIMIT 1
  `, [modelCode])
  const baseline = await mysqlAdapter.get(`
    SELECT AVG(avg_price) as avg_price, AVG(total_listings) as avg_listings FROM market_snapshots
    WHERE model_code = ? AND snapshot_time >= DATE_SUB(NOW(), INTERVAL ? DAY) AND snapshot_time < DATE_SUB(NOW(), INTERVAL 1 DAY)
  `, [modelCode, days])
  if (!recent || !baseline || !baseline.avg_price) return null
  const priceDelta = ((recent.avg_price - baseline.avg_price) / baseline.avg_price * 100).toFixed(1)
  const listingDelta = baseline.avg_listings ? ((recent.total_listings - baseline.avg_listings) / baseline.avg_listings * 100).toFixed(1) : 0
  return {
    modelCode, snapshotTime: recent.snapshot_time,
    currentPrice: recent.avg_price, baselinePrice: baseline.avg_price, priceDeltaPct: Number(priceDelta),
    currentListings: recent.total_listings, baselineListings: baseline.avg_listings, listingDeltaPct: Number(listingDelta),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 费用报表
// ═══════════════════════════════════════════════════════════════════════════

async function addExpenseRecord(payload) {
  const result = await mysqlAdapter.run(`
    INSERT INTO expense_records (model_code, unit_id, expense_type, amount, description, expense_date, order_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ${nowExpr()})
  `, [
    payload.model_code, payload.unit_id ?? null, payload.expense_type,
    payload.amount, payload.description ?? null, payload.expense_date, payload.order_id ?? null,
  ])
  return result.lastInsertRowid
}

async function listExpenseRecords(filters = {}) {
  const { modelCode, expenseType, startDate, endDate } = filters
  const where = []
  const params = []
  if (modelCode) { where.push('model_code = ?'); params.push(modelCode) }
  if (expenseType) { where.push('expense_type = ?'); params.push(expenseType) }
  if (startDate) { where.push('expense_date >= ?'); params.push(startDate) }
  if (endDate) { where.push('expense_date <= ?'); params.push(endDate) }
  const sql = `SELECT * FROM expense_records ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY expense_date DESC LIMIT 1000`
  return await mysqlAdapter.all(sql, params)
}

function normalizeDateOnlyInput(value) {
  if (!value) return ''
  const text = String(value).trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function addDateOnlyDays(baseDate, deltaDays) {
  const normalized = normalizeDateOnlyInput(baseDate)
  if (!normalized) return ''
  const next = new Date(`${normalized}T00:00:00`)
  next.setDate(next.getDate() + deltaDays)
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`
}

function daysInMonth(month) {
  const [yearText, monthText] = String(month || '').split('-')
  const year = Number.parseInt(yearText, 10)
  const monthIndex = Number.parseInt(monthText, 10)
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) return 0
  return new Date(year, monthIndex, 0).getDate()
}

function deriveOptimizationDateRange(config, filters = {}) {
  const today = formatLocalDateTime(new Date()).slice(0, 10)
  const to = normalizeDateOnlyInput(filters.to) || today
  const from = normalizeDateOnlyInput(filters.from) || addDateOnlyDays(to, 1 - Number(config.analysisWindowDays || 14))
  return { from, to }
}

function safeParseJsonObject(value) {
  if (!value || typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

async function uploadMonthlyShippingBill(payload = {}) {
  const month = String(payload.month || '').trim().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, message: '月份格式必须是 YYYY-MM' }
  const amount = Number(payload.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: '月付账单金额必须大于 0' }
  const {
    normalizeInquiryOptimizationConfig,
  } = getInquiryOptimizationModules()
  const config = normalizeInquiryOptimizationConfig(payload.config || await getInquiryOptimizationConfig())
  const allocationMode = payload.allocationMode || config.shippingAllocationMode || 'order_count'
  const reminderDay = Number(payload.reminderDay || config.shippingBillReminderDay || 1)
  const expenseDate = `${month}-${pad2(Math.max(1, Math.min(daysInMonth(month) || 1, reminderDay)))}`
  const description = JSON.stringify({
    kind: 'monthly_shipping_bill',
    month,
    allocationMode,
    uploadedAt: formatLocalDateTime(new Date()),
    note: String(payload.note || '').trim(),
  })
  const expenseId = await addExpenseRecord({
    model_code: '__shared__',
    unit_id: null,
    expense_type: 'shipping_monthly',
    amount: Number(amount.toFixed(2)),
    description,
    expense_date: expenseDate,
    order_id: null,
  })
  return { ok: true, expenseId, month, amount: Number(amount.toFixed(2)), allocationMode }
}

async function getRentalOptimizationSuggestions(filters = {}) {
  const {
    buildDepositFreeCharge,
    summarizeInquiryOptimization,
    allocateMonthlyShippingExpenseByOrderCount,
  } = getInquiryOptimizationModules()
  const config = await getInquiryOptimizationConfig()
  const { from, to } = deriveOptimizationDateRange(config, filters)
  const scopedFilters = {
    ...filters,
    from,
    to,
  }
  const [inquiryRows, orderRows, unitRows, expenseRows] = await Promise.all([
    listInquiryEvents({ ...scopedFilters, limit: 1000 }),
    listOrders(scopedFilters),
    listScheduleUnits({ activeInventoryOnly: true }),
    listExpenseRecords({ startDate: from, endDate: to }),
  ])

  const stats = summarizeInquiryStats(inquiryRows)
  const models = new Map()
  for (const row of stats.byModel) {
    models.set(row.modelCode, {
      modelCode: row.modelCode,
      inquiries: Number(row.inquiries || 0),
      available: Number(row.available || 0),
      unavailable: Number(row.unavailable || 0),
      converted: Number(row.converted || 0),
      availableNotConverted: Number(row.availableNotConverted || 0),
      quotedAvg: Number(row.avgQuotedPrice || 0),
      finalAvg: Number(row.avgFinalFee || 0),
      inventoryUnits: 0,
      activeAssetCost: 0,
      revenue: 0,
      platformFee: 0,
      depositFreeCharge: 0,
      depositFreeOrderCount: 0,
      repairCost: 0,
      otherCost: 0,
      shippingCost: 0,
      missingCostData: false,
      completedOrderCount: 0,
    })
  }

  for (const unit of unitRows) {
    const modelCode = unit.model_code || unit.modelCode
    if (!modelCode) continue
    if (!models.has(modelCode)) {
      models.set(modelCode, {
        modelCode,
        inquiries: 0,
        available: 0,
        unavailable: 0,
        converted: 0,
        availableNotConverted: 0,
        quotedAvg: 0,
        finalAvg: 0,
        inventoryUnits: 0,
        activeAssetCost: 0,
        revenue: 0,
        platformFee: 0,
        depositFreeCharge: 0,
        depositFreeOrderCount: 0,
        repairCost: 0,
        otherCost: 0,
        shippingCost: 0,
        missingCostData: false,
        completedOrderCount: 0,
      })
    }
    const current = models.get(modelCode)
    current.inventoryUnits += 1
    current.activeAssetCost = Number((current.activeAssetCost + Number(unit.purchase_cost || 0)).toFixed(2))
  }

  const completedOrders = []
  for (const order of orderRows) {
    const modelCode = order.model_code || order.modelCode
    if (!modelCode) continue
    if (!models.has(modelCode)) continue
    const current = models.get(modelCode)
    const fee = Number(order.fee || 0)
    current.revenue = Number((current.revenue + fee).toFixed(2))
    current.platformFee = Number((current.platformFee + fee * Number(config.platformFeeRate || 0)).toFixed(2))
    if (String(order.order_status || '') === 'completed') {
      current.completedOrderCount += 1
      completedOrders.push(order)
      if (Number(order.is_deposit_free || 0) === 1) {
        current.depositFreeOrderCount += 1
        current.depositFreeCharge = Number((current.depositFreeCharge + buildDepositFreeCharge({
          fee,
          per100Fee: config.depositFreePer100Fee,
          orderCost: config.depositFreeOrderCost,
        })).toFixed(2))
      }
    }
  }

  const sharedShippingRows = []
  for (const expense of expenseRows) {
    const type = String(expense.expense_type || '')
    if (type === 'shipping_monthly') {
      sharedShippingRows.push(expense)
      continue
    }
    const modelCode = expense.model_code
    if (!modelCode || !models.has(modelCode)) continue
    const current = models.get(modelCode)
    const amount = Number(expense.amount || 0)
    if (type === 'repair') current.repairCost = Number((current.repairCost + amount).toFixed(2))
    else if (type === 'shipping_sf') current.shippingCost = Number((current.shippingCost + amount).toFixed(2))
    else current.otherCost = Number((current.otherCost + amount).toFixed(2))
  }

  if (sharedShippingRows.length && completedOrders.length) {
    const ordersById = new Map(completedOrders.map((order) => [String(order.id), order]))
    for (const expense of sharedShippingRows) {
      const meta = safeParseJsonObject(expense.description)
      const allocation = allocateMonthlyShippingExpenseByOrderCount({
        total: Number(expense.amount || 0),
        orders: completedOrders,
      })
      for (const item of allocation) {
        const order = ordersById.get(String(item.orderId))
        const modelCode = order?.model_code
        if (!modelCode || !models.has(modelCode)) continue
        const current = models.get(modelCode)
        current.shippingCost = Number((current.shippingCost + Number(item.amount || 0)).toFixed(2))
        if (!meta?.month) current.missingCostData = true
      }
    }
  }

  const rows = Array.from(models.values()).map((row) => {
    const missingCostData = row.activeAssetCost <= 0 || (row.completedOrderCount > 0 && row.shippingCost <= 0)
    const totalCost = row.platformFee + row.depositFreeCharge + row.repairCost + row.otherCost + row.shippingCost
    return {
      ...row,
      shippingCost: Number(row.shippingCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      netProfit: Number((row.revenue - totalCost).toFixed(2)),
      missingCostData,
    }
  })

  const recommendation = summarizeInquiryOptimization({ config, models: rows })
  return {
    ok: true,
    config,
    window: { from, to, analysisWindowDays: Number(config.analysisWindowDays || 14) },
    stats: stats.total,
    rows: recommendation.rows,
    summary: recommendation.summary || {
      totalModels: recommendation.rows.length,
      actionableModels: recommendation.rows.filter((row) => row.action !== 'observe').length,
    },
  }
}

async function getRevenueReport(filters = {}) {
  const { startDate, endDate, modelCode, storeId } = filters
  const where = ['order_status NOT IN (\'cancelled\')']
  const orderWhere = ['o.order_status NOT IN (\'cancelled\')']
  const params = []
  if (startDate) { where.push('rent_start_date >= ?'); params.push(startDate) }
  if (endDate) { where.push('rent_end_date <= ?'); params.push(endDate) }
  if (modelCode) { where.push('model_code = ?'); params.push(modelCode) }
  if (storeId) { where.push('store_id = ?'); params.push(storeId) }
  if (startDate) orderWhere.push('o.rent_start_date >= ?')
  if (endDate) orderWhere.push('o.rent_end_date <= ?')
  if (modelCode) orderWhere.push('o.model_code = ?')
  if (storeId) orderWhere.push('o.store_id = ?')

  const revenueByModel = await mysqlAdapter.all(`
    SELECT model_code, COUNT(*) as order_count, SUM(fee) as total_revenue, AVG(fee) as avg_fee,
      SUM(deposit) as total_deposit
    FROM rental_orders WHERE ${where.join(' AND ')}
    GROUP BY model_code ORDER BY total_revenue DESC
  `, params)

  const revenueByMonth = await mysqlAdapter.all(`
    SELECT substr(rent_start_date, 1, 7) as month, COUNT(*) as order_count,
      SUM(fee) as total_revenue, AVG(fee) as avg_fee
    FROM rental_orders WHERE ${where.join(' AND ')}
    GROUP BY month ORDER BY month ASC
  `, params)

  const revenueByStore = await mysqlAdapter.all(`
    SELECT COALESCE(s.name, '${DEFAULT_STORE_NAME}') AS store_name, o.store_id,
      COUNT(*) as order_count, SUM(o.fee) as total_revenue, AVG(o.fee) as avg_fee, SUM(o.deposit) as total_deposit
    FROM rental_orders o
    LEFT JOIN stores s ON s.id = o.store_id
    WHERE ${orderWhere.join(' AND ')}
    GROUP BY o.store_id, COALESCE(s.name, '${DEFAULT_STORE_NAME}')
    ORDER BY total_revenue DESC, order_count DESC
  `, params)

  const expenseWhere = []
  const expenseParams = []
  if (startDate) { expenseWhere.push('expense_date >= ?'); expenseParams.push(startDate) }
  if (endDate) { expenseWhere.push('expense_date <= ?'); expenseParams.push(endDate) }
  if (modelCode) { expenseWhere.push('model_code = ?'); expenseParams.push(modelCode) }

  const expenseByType = await mysqlAdapter.all(`
    SELECT expense_type, SUM(amount) as total FROM expense_records
    ${expenseWhere.length ? `WHERE ${expenseWhere.join(' AND ')}` : ''}
    GROUP BY expense_type ORDER BY total DESC
  `, expenseParams)

  const expenseByModel = await mysqlAdapter.all(`
    SELECT model_code, SUM(amount) as total FROM expense_records
    ${expenseWhere.length ? `WHERE ${expenseWhere.join(' AND ')}` : ''}
    GROUP BY model_code ORDER BY total DESC
  `, expenseParams)

  return { revenueByModel, revenueByMonth, revenueByStore, expenseByType, expenseByModel }
}

module.exports = {
  initDbManager,
  getConfig,
  saveConfig,
  getPrompts,
  savePrompts,
  listKnowledge,
  addKnowledge,
  updateKnowledge,
  deleteKnowledge,
  batchAddKnowledge,
  listTakeoverTasks,
  acceptTakeoverTask,
  closeTakeoverTask,
  // 会话回复状态（Phase 1）
  listSessionStates,
  resetSessionState,
  listStores,
  recordInquiryEventFromAvailability,
  linkInquiryEventToOrder,
  linkRecentInquiryToOrder,
  listInquiryEvents,
  getInquiryStats,
  listScheduleUnits,
  saveScheduleUnit,
  updateScheduleUnitsByModel,
  deleteScheduleUnit,
  // Sprint 4
  listPricing,
  upsertPricing,
  deletePricing,
  savePricingLadder,
  deletePricingByModel,
  listDepositExemptionRules,
  upsertDepositExemptionRule,
  deleteDepositExemptionRule,
  listItemMapping,
  upsertItemMapping,
  deleteItemMapping,
  listXianyuItemListings,
  syncXianyuItemListingsFromLocalCache,
  reviewXianyuItemListing,
  listScheduleBlocks,
  getScheduleMonthlyOverview,
  checkScheduleAvailability,
  listOrders,
  listOrderGroups,
  listOrderActionAlerts,
  listFulfillmentTasks,
  getOrderOverviewStats,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  updateOrderFee,
  previewOrderImportExcel,
  importOrderImportExcel,
  updateShipping,
  markOrderReturned,
  initiateReturnSchedule,
  autoInitiateReturnSchedules,
  extendOrder,
  batchMarkOrdersShipped,
  batchMarkOrdersReturned,
  batchExtendOrders,
  listShippingRecords,
  listLearningCandidates,
  approveLearningCandidate,
  rejectLearningCandidate,
  listStructuredSuggestions,
  updateStructuredSuggestionStatus,
  dedupLegacyLearningCandidates,
  getDashboardStats,
  getOpsMetrics,
  getSystemCheck,
  generateXiaohongshuKeyword,
  estimateShippingPreview,
  queryLogistics,
  listSfShipments,
  getSfShipmentDetail,
  saveSfShipmentDraft,
  precheckSfShipment,
  placeSfShipment,
  submitSfShipment,
  recoverSfShipmentResult,
  quoteSfExpressShipment,
  cancelSfShipment,
  querySfShipmentRoutes,
  querySfShipmentFee,
  listSfPendingShipmentOrders,
  batchPlaceSfShipments,
  updateSfShipmentActualPaid,
  querySfShipmentPromiseTime,
  quoteSfIntraCity,
  estimateShippingWithSf,
  // 飞书待确认回复
  createFeishuPendingReply,
  listFeishuPendingReplies,
  resolveFeishuPendingReply,
  rejectFeishuPendingReply,
  // 市场监控
  createMarketSnapshot,
  listMarketSnapshots,
  getMarketTrend,
  batchCreateMarketListings,
  getMarketAlerts,
  // 费用报表
  addExpenseRecord,
  listExpenseRecords,
  getRevenueReport,
  getRentalOptimizationSuggestions,
  getInquiryOptimizationConfig,
  saveInquiryOptimizationConfig,
  getStoredDepositOrder,
  listStoredDepositOrders,
  upsertStoredDepositOrder,
  bindStoredDepositOrderSource,
  recordDepositOrderEvent,
  createRuntimeBackupSnapshot,
  uploadMonthlyShippingBill,
}
