/**
 * 免押 API Service 适配层
 * 支持 mock / real 双模式切换。
 *
 * 当前模式：mock（转发到 depositMockService）
 * 切换到 real：在设置页将接口模式改为 'real'，配置 baseUrl 和 auth
 */

import { getDepositApiSettings, getDepositDisplaySettings } from './depositSettingsService.js'

// ═══════════════════════════════════════
//  Mock 导入（internal，外部组件不应直接 import）
// ═══════════════════════════════════════

import {
  mockCreateDepositOrder,
  listDepositOrders as mockListDepositOrders,
  getDepositOrder as mockGetDepositOrder,
  cancelDepositOrder as mockCancelDepositOrder,
  completeDepositOrder as mockCompleteDepositOrder,
  getDepositOrdersBySource as mockGetDepositOrdersBySource,
  getDepositStatusLabel as mockGetDepositStatusLabel,
  clearDepositOrders as mockClearDepositOrders,
  deleteDepositOrder as mockDeleteDepositOrder,
  batchCancelDepositOrders as mockBatchCancelDepositOrders,
  batchCompleteDepositOrders as mockBatchCompleteDepositOrders,
  batchDeleteDepositOrders as mockBatchDeleteDepositOrders,
  bindDepositOrderSource as mockBindDepositOrderSource,
} from './depositMockService.js'

const REAL_LINKS_KEY = 'xianyu.depositRealOrderLinks.v1'
let realLinksCache = null
let realLinksLoaded = false
let realLinksLoading = null

// ═══════════════════════════════════════
//  配置读取（优先 MySQL 主配置，fallback localStorage）
//  与其他配置（顺丰、飞书等）保持一致：MySQL 有表的读 MySQL。
// ═══════════════════════════════════════

let _modeFromMainConfig = null

/**
 * 页面初始化时调用，从主配置（MySQL）同步免押模式。
 * 调用方应在 onMounted 中传入 configStore.config?.DEPOSIT_API_MODE。
 */
export function initDepositMode(mainConfigDepositApiMode) {
  if (mainConfigDepositApiMode === 'real' || mainConfigDepositApiMode === 'mock') {
    _modeFromMainConfig = mainConfigDepositApiMode
    console.log('[depositApi] 模式已从主配置同步:', mainConfigDepositApiMode)
  } else {
    console.warn('[depositApi] 主配置 DEPOSIT_API_MODE 无效或未设置:', mainConfigDepositApiMode)
  }
}

function getConfig() {
  return getDepositApiSettings()
}

function isRealMode() {
  // 优先读取主配置 MySQL（与其他配置架构保持一致）
  if (_modeFromMainConfig === 'real') return true
  if (_modeFromMainConfig === 'mock') return false
  // fallback: 读取 localStorage（向后兼容）
  const localMode = getDepositApiSettings().mode
  console.log('[depositApi] _modeFromMainConfig 未初始化，fallback localStorage:', localMode)
  return localMode === 'real'
}

function getRealIpcSettings() {
  const apiSettings = getDepositApiSettings()
  return {
    baseUrl: apiSettings.baseUrl,
    userEid: apiSettings.userEid,
    notify_url: apiSettings.notifyUrl || '',
    contractSupplementaryContent: apiSettings.contractSupplementaryContent || '',
    receivingInfoFallback: apiSettings.receivingInfoFallback || '待补充',
  }
}

function requireDepositIpc(methodName) {
  const fn = window.electronAPI?.[methodName]
  if (typeof fn !== 'function') {
    throw new Error(`免押主进程接口 ${methodName} 不可用，请重启 Electron 应用`)
  }
  return fn
}

function apiDepositStatus(status) {
  const map = {
    pending_review: '0',
    approved: '1',
    completed: '2',
    cancelled: '3',
  }
  return map[status] || 'all'
}

function loadRealLinksFromLocalStorage() {
  try {
    const raw = localStorage.getItem(REAL_LINKS_KEY)
    const rows = raw ? JSON.parse(raw) : []
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function saveRealLinksToLocalStorage(rows) {
  try {
    localStorage.setItem(REAL_LINKS_KEY, JSON.stringify(rows))
  } catch { /* ignore */ }
}

async function ensureRealLinksLoaded() {
  if (realLinksLoaded && Array.isArray(realLinksCache)) return realLinksCache
  if (realLinksLoading) return realLinksLoading

  realLinksLoading = (async () => {
    const listStored = window.electronAPI?.depositListStoredOrders
    if (typeof listStored === 'function') {
      try {
        const rows = await listStored({})
        realLinksCache = Array.isArray(rows) ? rows : []
        realLinksLoaded = true
        saveRealLinksToLocalStorage(realLinksCache)
        return realLinksCache
      } catch (error) {
        console.warn('[depositApi] 读取主进程免押缓存失败，回退 localStorage:', error)
      }
    }
    realLinksCache = loadRealLinksFromLocalStorage()
    realLinksLoaded = true
    return realLinksCache
  })()

  try {
    return await realLinksLoading
  } finally {
    realLinksLoading = null
  }
}

function loadRealLinks() {
  if (!Array.isArray(realLinksCache)) {
    realLinksCache = loadRealLinksFromLocalStorage()
  }
  return realLinksCache
}

async function refreshStoredRealLink(depositNo) {
  const getter = window.electronAPI?.depositGetStoredOrder
  if (typeof getter !== 'function' || !depositNo) return getRealLink(depositNo)
  try {
    const row = await getter({ orderNo: depositNo })
    if (row?.depositOrderNo) {
      const rows = loadRealLinks().filter((item) => item.depositOrderNo !== row.depositOrderNo)
      rows.push(row)
      realLinksCache = rows
      saveRealLinksToLocalStorage(rows)
      return row
    }
  } catch (error) {
    console.warn('[depositApi] 刷新主进程免押缓存失败:', error)
  }
  return getRealLink(depositNo)
}

function getRealSourceHistoryKey(source = {}) {
  if (source.sourceOrderId !== undefined && source.sourceOrderId !== null && source.sourceOrderId !== '') {
    return `id:${source.sourceOrderId}`
  }
  const sourceOrderNo = String(source.sourceOrderNo || '').trim()
  if (sourceOrderNo) return `no:${sourceOrderNo}`
  return ''
}

function rememberRealDepositOrder(order) {
  if (!order?.depositOrderNo) return
  const historyKey = getRealSourceHistoryKey(order)
  const orderIsLatest = order.isLatest !== undefined ? Boolean(order.isLatest) : true
  const rows = loadRealLinks()
    .filter((item) => item.depositOrderNo !== order.depositOrderNo)
    .map((item) => (
      orderIsLatest && historyKey && getRealSourceHistoryKey(item) === historyKey
        ? { ...item, isLatest: false, updatedAt: item.updatedAt || new Date().toISOString() }
        : item
    ))
  const now = new Date().toISOString()
  rows.push({
    ...order,
    sourceType: order.sourceType || 'order',
    isLatest: orderIsLatest,
    updatedAt: order.updatedAt || now,
    createdAt: order.createdAt || now,
  })
  realLinksCache = rows
  saveRealLinksToLocalStorage(rows)
}

async function notifyRealStatusChange(order, previousStatus) {
  if (!order?.depositOrderNo || !previousStatus || previousStatus === order.status) return
  const fn = window.electronAPI?.depositNotifyStatusChange
  if (typeof fn !== 'function') return
  try {
    await fn({
      depositOrderNo: order.depositOrderNo,
      depositStatus: order.status,
      depositStatusLabel: mockGetDepositStatusLabel(order.status),
      previousDepositStatus: previousStatus,
      previousDepositStatusLabel: mockGetDepositStatusLabel(previousStatus),
      sourceOrderId: order.sourceOrderId,
      sourceOrderNo: order.sourceOrderNo,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      modelCode: order.modelCode,
      unitId: order.unitCode,
      rentRange: [order.rentStartDate, order.rentEndDate].filter(Boolean).join(' ~ '),
      fee: order.rentAmount,
    })
  } catch (e) {
    console.warn('[depositApi] 免押状态飞书通知失败:', e)
  }
}

function getRealLink(depositNo) {
  return loadRealLinks().find((item) => item.depositOrderNo === depositNo)
}

function mergeRealLink(order) {
  if (!order?.depositOrderNo) return order
  const local = loadRealLinks().find((item) => item.depositOrderNo === order.depositOrderNo)
  return local ? {
    ...local,
    ...order,
    sourceType: local.sourceType || order.sourceType,
    sourceOrderId: local.sourceOrderId !== undefined && local.sourceOrderId !== null ? local.sourceOrderId : order.sourceOrderId,
    sourceOrderNo: local.sourceOrderNo || order.sourceOrderNo,
    rentStartDate: order.rentStartDate || local.rentStartDate,
    rentEndDate: order.rentEndDate || local.rentEndDate,
    rentDays: Number(order.rentDays || 0) > 0 ? order.rentDays : local.rentDays,
    reviewUrl: order.reviewUrl || local.reviewUrl,
    qrImageUrl: order.qrImageUrl || local.qrImageUrl,
    isLatest: local.isLatest !== undefined ? Boolean(local.isLatest) : order.isLatest,
    createdAt: local.createdAt || order.createdAt,
  } : order
}

function updateRealLinkStatus(depositNo, status) {
  const rows = loadRealLinks()
  const previous = rows.find((item) => item.depositOrderNo === depositNo)
  const next = rows.map((item) => (
    item.depositOrderNo === depositNo
      ? { ...item, status, updatedAt: new Date().toISOString() }
      : item
  ))
  realLinksCache = next
  saveRealLinksToLocalStorage(next)
  return previous
}

function bindRealDepositOrderSource(depositNo, source = {}) {
  const previous = getRealLink(depositNo)
  if (!previous) {
    return { success: false, message: '未找到本地免押单记录，请先刷新详情后再绑定' }
  }
  const next = {
    ...previous,
    sourceType: 'order',
    sourceOrderId: source.sourceOrderId ?? previous.sourceOrderId ?? null,
    sourceOrderNo: source.sourceOrderNo || previous.sourceOrderNo || '',
    productName: source.productName || previous.productName || '',
    modelCode: source.modelCode || previous.modelCode || '',
    unitCode: source.unitCode || previous.unitCode || '',
    customerName: source.customerName || previous.customerName || '',
    customerPhone: source.customerPhone || previous.customerPhone || '',
    updatedAt: new Date().toISOString(),
  }
  rememberRealDepositOrder(next)
  return { success: true, depositOrder: next }
}

export function applyDepositStatusPush(payload = {}) {
  void ensureRealLinksLoaded()
  const depositOrderNo = payload.depositOrderNo || payload.orderNo
  if (!depositOrderNo) return null

  const previous = getRealLink(depositOrderNo) || {}
  const order = normalizeDepositOrder({
    orderNo: depositOrderNo,
    out_order_no: payload.sourceOrderNo,
    scheme_url: payload.reviewUrl,
    qr_code_url: payload.qrImageUrl,
    deposit_status: payload.status,
    customer_name: payload.customerName,
    customer_mobile: payload.customerPhone,
    product_deposit: payload.depositAmount,
    count_deposit_price: payload.rentAmount,
    rent_start_time: payload.rentStartDate,
    rent_end_time: payload.rentEndDate,
  }, {
    ...previous,
    depositOrderNo,
    status: payload.status || previous.status,
    sourceOrderNo: payload.sourceOrderNo || previous.sourceOrderNo,
    reviewUrl: payload.reviewUrl || previous.reviewUrl,
    qrImageUrl: payload.qrImageUrl || previous.qrImageUrl,
    updatedAt: new Date().toISOString(),
  })

  const merged = mergeRealLink({ ...previous, ...order, updatedAt: new Date().toISOString() })
  rememberRealDepositOrder(merged)
  return merged
}

// ═══════════════════════════════════════
//  字段拾取
// ═══════════════════════════════════════

/**
 * 按候选字段名数组从 raw 对象中取值。
 * 返回第一个 truthy 值（0 和 false 算有效值），都没有则返回 undefined。
 */
function pickField(raw, candidates) {
  if (!raw || !Array.isArray(candidates)) return undefined
  for (const key of candidates) {
    const v = raw[key]
    if (v !== undefined && v !== null) return v
  }
  return undefined
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeDateValue(value) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    if (/^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) return trimmed.slice(0, 10).replaceAll('/', '-')
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  const millis = numeric < 1e12 ? numeric * 1000 : numeric
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function normalizeDateTimeValue(value) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return value
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  const millis = numeric < 1e12 ? numeric * 1000 : numeric
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString()
}

function calcRentDays(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`)
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(1, Math.round((end - start) / 86400000) + 1)
}

function parseSupplementaryField(text, label) {
  const source = String(text || '').trim()
  if (!source || !label) return ''
  const escapedLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedLabel}[：:]\\s*([^；;\\n\\r]+)`))
  return match?.[1]?.trim() || ''
}

function extractSupplementaryFields(raw = {}, fallback = {}) {
  const supplementary = pickField(raw, ['deposit_farther', 'depositFarther', 'contractSupplementaryContent'])
    || fallback.contractSupplementaryContent
    || ''
  return {
    sourceOrderNo: parseSupplementaryField(supplementary, '来源订单'),
    modelCode: parseSupplementaryField(supplementary, '型号'),
    unitCode: parseSupplementaryField(supplementary, '设备编号'),
  }
}

// ═══════════════════════════════════════
//  字段标准化
// ═══════════════════════════════════════

/**
 * 将真实接口返回的原始对象标准化为前端统一字段。
 * 候选字段名优先从免押配置的 responseFieldMap 读取。
 *
 * @param {Object} raw    — 真实接口返回的原始对象
 * @param {Object} [fallback] — 前端本地补充字段
 * @returns {Object} 标准化后的 depositOrder 对象
 */
function normalizeDepositOrder(raw, fallback = {}) {
  if (!raw) return null

  const cfg = getConfig()
  const displaySettings = getDepositDisplaySettings()
  const fieldMap = cfg.responseFieldMap || {}
  const now = new Date().toISOString()

  // 辅助：按候选列表取值，fallback 到 fallback 参数，再 fallback 到默认值
  const get = (fieldKey, defaultVal) => {
    const candidates = fieldMap[fieldKey] || [fieldKey]
    const val = pickField(raw, candidates)
    if (val !== undefined) return val
    if (fallback[fieldKey] !== undefined) return fallback[fieldKey]
    return defaultVal
  }

  const statusMap = cfg.depositStatusMap || {}
  const rawStatus = get('status', 'pending_review')
  const normalizedRawStatus = typeof rawStatus === 'string' ? rawStatus.trim() : rawStatus
  const normalizedStatus = statusMap[String(normalizedRawStatus)] || statusMap[normalizedRawStatus] || normalizedRawStatus || 'pending_review'

  const rentStartDate = normalizeDateValue(get('rentStartDate', ''))
  const rentEndDate = normalizeDateValue(get('rentEndDate', ''))
  const explicitRentDays = Number(get('rentDays', 0))
  const rentDays = explicitRentDays > 0 ? explicitRentDays : calcRentDays(rentStartDate, rentEndDate)
  const createdAt = normalizeDateTimeValue(get('createdAt', '') || fallback.createdAt || now) || now
  const updatedAt = normalizeDateTimeValue(get('updatedAt', '') || raw.createdAt || raw.created_at || fallback.createdAt || now) || now
  const supplementaryFields = extractSupplementaryFields(raw, fallback)

  return {
    // 主键
    depositOrderNo: get('depositOrderNo', ''),

    // 关联订单
    sourceOrderId: get('sourceOrderId', null),
    sourceOrderNo: get('sourceOrderNo', '') || supplementaryFields.sourceOrderNo,

    // 商品/设备
    productName: get('productName', '租赁设备'),
    modelCode: get('modelCode', '') || supplementaryFields.modelCode,
    unitCode: get('unitCode', '') || supplementaryFields.unitCode,

    // 客户
    customerName: get('customerName', ''),
    customerPhone: get('customerPhone', ''),

    // 金额
    depositAmount: Number(get('depositAmount', 0)),
    rentAmount: Number(get('rentAmount', 0)),

    // 租期
    rentStartDate,
    rentEndDate,
    rentDays,

    // 状态
    status: normalizedStatus,
    isLatest: fallback.isLatest !== undefined ? Boolean(fallback.isLatest) : true,

    // 审核
    reviewUrl: get('reviewUrl', ''),
    qrImageUrl: get('qrImageUrl', ''),

    // 展示文案（优先接口返回值，fallback 到用户配置，再 fallback 到默认值）
    expiresInText: get('expiresInText', '') || displaySettings.expiresInText,
    contactPhones: get('contactPhones', '') || displaySettings.contactPhones,
    workTime: get('workTime', '') || displaySettings.workTime,

    // 时间
    createdAt,
    updatedAt,
  }
}

// ═══════════════════════════════════════
//  Real 模式 — 通过 Electron main process 代理请求
//  （符合接口文档安全要求：不在前端直接 fetch）
// ═══════════════════════════════════════

/**
 * 真实创建免押单
 * 通过 IPC → main process → depositClient 调用真实接口。
 * appId/appSecret 仅在 main process 中使用，不暴露给 renderer。
 */
async function realCreateDepositOrder(params) {
  try {
    await ensureRealLinksLoaded()
    // 通过 IPC 调用 main process 代理
    const result = await requireDepositIpc('depositCreateOrder')(params, getRealIpcSettings())

    if (result.success && result.depositOrder) {
      // 标准化 + 前端补齐未返回的字段
      result.depositOrder = normalizeDepositOrder(result.depositOrder, {
        sourceOrderId: params.sourceOrderId,
        sourceOrderNo: params.sourceOrderNo,
        productName: params.productName,
        modelCode: params.modelCode,
        unitCode: params.unitCode,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        depositAmount: params.depositAmount,
        rentAmount: params.rentAmount,
        rentStartDate: params.rentStartDate,
        rentEndDate: params.rentEndDate,
        rentDays: params.rentDays,
        isLatest: true,
      })

      if (!result.depositOrder.depositOrderNo) {
        console.warn('[depositApi] 真实接口未返回 depositOrderNo')
      }
      rememberRealDepositOrder(result.depositOrder)
    }

    return result
  } catch (e) {
    console.error('[depositApi] realCreateDepositOrder 异常:', e)
    return {
      success: false,
      message: e.message || '网络请求失败，请重试',
    }
  }
}

function realUnsupported(methodName) {
  return {
    success: false,
    message: `Real 模式 ${methodName} 暂未接入，请切回 Mock 测试或等待真实接口接入`,
  }
}

function filterRealOrders(orders = [], filters = {}) {
  let next = Array.from(orders)
  if (filters.status) {
    next = next.filter((order) => order.status === filters.status)
  }
  if (filters.isLatest !== undefined && filters.isLatest !== null && filters.isLatest !== '') {
    const wantLatest = filters.isLatest === true || filters.isLatest === 'true'
    next = next.filter((order) => Boolean(order.isLatest) === wantLatest)
  }
  if (filters.keyword) {
    const kw = String(filters.keyword).toLowerCase()
    next = next.filter((order) => [
      order.depositOrderNo,
      order.sourceOrderNo,
      order.customerName,
      order.customerPhone,
      order.unitCode,
      order.productName,
    ].some((value) => String(value || '').toLowerCase().includes(kw)))
  }
  return next.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

async function realListDepositOrders(filters = {}) {
  await ensureRealLinksLoaded()
  console.log('[depositApi] realListDepositOrders 调用中, filters:', filters)
  const result = await requireDepositIpc('depositListOrders')({
    depositStatus: filters.status ? apiDepositStatus(filters.status) : 'all',
    keyword: filters.keyword || '',
    page: filters.page || 1,
    limit: filters.limit || 50,
  }, getRealIpcSettings())

  console.log('[depositApi] realListDepositOrders 返回: success=' + result.success + ', orders=' + (result.orders?.length || 0) + ', total=' + (result.total || 0))
  if (!result.success) throw new Error(result.message || '查询免押单列表失败')
  const apiOrders = (result.orders || [])
    .map((order) => mergeRealLink(normalizeDepositOrder(order, { isLatest: true })))
    .filter(Boolean)
  const byNo = new Map()
  for (const order of loadRealLinks()) {
    if (order?.depositOrderNo) byNo.set(order.depositOrderNo, order)
  }
  for (const order of apiOrders) {
    if (order?.depositOrderNo) byNo.set(order.depositOrderNo, order)
  }

  const orders = filterRealOrders(Array.from(byNo.values()), filters)
  for (const order of apiOrders) {
    const previous = getRealLink(order.depositOrderNo)
    await notifyRealStatusChange(order, previous?.status)
    rememberRealDepositOrder(order)
  }
  return { orders, total: result.total || orders.length }
}

async function realGetDepositOrder(depositNo) {
  await ensureRealLinksLoaded()
  const result = await requireDepositIpc('depositGetOrderDetail')({ orderNo: depositNo }, getRealIpcSettings())
  if (!result.success) throw new Error(result.message || '查询免押单详情失败')
  const order = mergeRealLink(normalizeDepositOrder(result.depositOrder, { isLatest: true }))
  const previous = getRealLink(order.depositOrderNo)
  await notifyRealStatusChange(order, previous?.status)
  rememberRealDepositOrder(order)
  return order
}

async function realCompleteDepositOrder(depositNo) {
  const result = await requireDepositIpc('depositFinishOrder')({ orderNo: depositNo }, getRealIpcSettings())
  return {
    success: Boolean(result.success),
    message: result.message || (result.success ? '免押单已完结' : '完结免押单失败'),
    raw: result.raw,
  }
}

// ═══════════════════════════════════════
//  对外 API（根据 mode 分发）
// ═══════════════════════════════════════

/**
 * 创建免押单
 */
export async function createDepositOrder(params) {
  if (isRealMode()) {
    return realCreateDepositOrder(params)
  }
  return mockCreateDepositOrder(params)
}

/**
 * 列出免押单
 */
export async function listDepositOrders(filters) {
  if (isRealMode()) {
    return realListDepositOrders(filters)
  }
  return mockListDepositOrders(filters)
}

/**
 * 查免押单详情
 */
export async function getDepositOrder(depositNo) {
  if (isRealMode()) {
    return realGetDepositOrder(depositNo)
  }
  return mockGetDepositOrder(depositNo)
}

export async function bindDepositOrderSource(depositNo, source = {}) {
  if (isRealMode()) {
    await ensureRealLinksLoaded()
    const result = bindRealDepositOrderSource(depositNo, source)
    if (result.success) {
      const binder = window.electronAPI?.depositBindOrderSource
      if (typeof binder === 'function') {
        const stored = await binder({ orderNo: depositNo, source })
        if (stored?.order?.depositOrderNo) {
          rememberRealDepositOrder(stored.order)
          result.depositOrder = stored.order
        }
      }
    }
    return result
  }
  return mockBindDepositOrderSource(depositNo, source)
}

/**
 * 作废免押单
 * Real 模式下复用完结接口（finishMerchantDepositOrder 同时支持取消和完结）
 */
export async function cancelDepositOrder(depositNo) {
  if (isRealMode()) {
    await ensureRealLinksLoaded()
    const result = await realCompleteDepositOrder(depositNo)
    if (result.success) {
      const previous = updateRealLinkStatus(depositNo, 'cancelled')
      await notifyRealStatusChange({ ...(previous || {}), depositOrderNo: depositNo, status: 'cancelled' }, previous?.status)
      await refreshStoredRealLink(depositNo)
    }
    return result
  }
  return mockCancelDepositOrder(depositNo)
}

/**
 * 完结免押单
 */
export async function completeDepositOrder(depositNo) {
  if (isRealMode()) {
    await ensureRealLinksLoaded()
    const result = await realCompleteDepositOrder(depositNo)
    if (result.success) {
      const previous = updateRealLinkStatus(depositNo, 'completed')
      await notifyRealStatusChange({ ...(previous || {}), depositOrderNo: depositNo, status: 'completed' }, previous?.status)
      await refreshStoredRealLink(depositNo)
    }
    return result
  }
  return mockCompleteDepositOrder(depositNo)
}

export async function deleteDepositOrder(depositNo) {
  if (isRealMode()) {
    return realUnsupported('删除免押单')
  }
  return mockDeleteDepositOrder(depositNo)
}

export async function batchCancelDepositOrders(depositNos = []) {
  if (isRealMode()) {
    await ensureRealLinksLoaded()
    const results = []
    for (const no of depositNos) {
      const result = await realCompleteDepositOrder(no)
      results.push({ depositNo: no, ...result })
      if (result.success) {
        const previous = updateRealLinkStatus(no, 'cancelled')
        await notifyRealStatusChange({ ...(previous || {}), depositOrderNo: no, status: 'cancelled' }, previous?.status)
        await refreshStoredRealLink(no)
      }
    }
    const successCount = results.filter((item) => item.success).length
    const failedCount = results.length - successCount
    return {
      success: successCount > 0 || results.length === 0,
      message: failedCount > 0 ? `批量取消失败 ${failedCount} 个` : '批量取消完成',
      results,
      successCount,
      failedCount,
    }
  }
  return mockBatchCancelDepositOrders(depositNos)
}

export async function batchCompleteDepositOrders(depositNos = []) {
  if (isRealMode()) {
    await ensureRealLinksLoaded()
    const results = []
    for (const no of depositNos) {
      const result = await realCompleteDepositOrder(no)
      results.push({ depositNo: no, ...result })
      if (result.success) {
        const previous = updateRealLinkStatus(no, 'completed')
        await notifyRealStatusChange({ ...(previous || {}), depositOrderNo: no, status: 'completed' }, previous?.status)
        await refreshStoredRealLink(no)
      }
    }
    const successCount = results.filter((item) => item.success).length
    const failedCount = results.length - successCount
    return {
      success: successCount > 0 || results.length === 0,
      message: failedCount > 0 ? `批量完结失败 ${failedCount} 个` : '批量完结完成',
      results,
      successCount,
      failedCount,
    }
  }
  return mockBatchCompleteDepositOrders(depositNos)
}

export async function batchDeleteDepositOrders(depositNos = []) {
  if (isRealMode()) {
    return realUnsupported('批量删除免押单')
  }
  return mockBatchDeleteDepositOrders(depositNos)
}

/**
 * 按来源订单查所有免押单
 */
export function getDepositOrdersBySourceOrder(sourceOrderIdOrNo) {
  if (isRealMode()) {
    void ensureRealLinksLoaded()
    return loadRealLinks()
      .filter((order) => (
        order.sourceOrderId === sourceOrderIdOrNo ||
        String(order.sourceOrderId || '') === String(sourceOrderIdOrNo || '') ||
        order.sourceOrderNo === sourceOrderIdOrNo
      ))
      .sort((a, b) => Number(Boolean(b.isLatest)) - Number(Boolean(a.isLatest)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }
  return mockGetDepositOrdersBySource(sourceOrderIdOrNo)
}

/**
 * 清空 mock 数据（开发调试用，real 模式下无操作）
 */
export function clearDepositOrders() {
  if (isRealMode()) return
  mockClearDepositOrders()
}

/**
 * 状态中文映射（两种模式通用）
 */
export function getDepositStatusLabel(status) {
  return mockGetDepositStatusLabel(status)
}

/**
 * 导出配置查询（调试用）
 */
export function getDepositApiMode() {
  return getDepositApiSettings().mode
}
