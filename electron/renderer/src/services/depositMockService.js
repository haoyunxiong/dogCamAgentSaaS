/**
 * 免押单 Mock Service
 * 使用 localStorage 持久化 + 内存 Map 缓存。
 * 同一 sourceOrderId 可创建多张，新单 isLatest=true，旧单 isLatest=false。
 */

import { depositApiConfig } from '../config/depositConfig.js'
import { getDepositDisplaySettings } from './depositSettingsService.js'
import { validateCreateParams } from './depositValidationService.js'

const STORAGE_KEY = 'xianyu.depositOrders.v1'

// 内存缓存：key = depositOrderNo, value = DepositFreeOrder
const store = new Map()
// 派生索引：key = sourceOrderId, value = depositOrderNo[]
let orderHistory = new Map()

// ── 工具函数 ──

function generateDepositNo() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DF${ts}${rand}`
}

function nowISO() {
  return new Date().toISOString()
}

function getSourceHistoryKey(source = {}) {
  if (source.sourceOrderId !== undefined && source.sourceOrderId !== null && source.sourceOrderId !== '') {
    return `id:${source.sourceOrderId}`
  }
  const sourceOrderNo = String(source.sourceOrderNo || '').trim()
  if (sourceOrderNo) return `no:${sourceOrderNo}`
  return ''
}

const STATUS_LABELS = depositApiConfig.statuses
const ACTIVE_STATUSES = ['pending_review', 'approved']

function syncLatestFlagForHistoryKey(historyKey) {
  if (!historyKey) return
  const nos = (orderHistory.get(historyKey) || []).filter((no) => store.has(no))
  if (!nos.length) {
    orderHistory.delete(historyKey)
    return
  }

  let latestNo = null
  let latestTime = -Infinity
  for (const no of nos) {
    const order = store.get(no)
    if (!order) continue
    order.isLatest = false
    const time = new Date(order.createdAt || 0).getTime()
    if (time >= latestTime) {
      latestTime = time
      latestNo = no
    }
  }

  if (latestNo && store.get(latestNo)) {
    store.get(latestNo).isLatest = true
    store.get(latestNo).updatedAt = nowISO()
  }

  orderHistory.set(historyKey, nos)
}

// ── localStorage 持久化 ──

function isStorageAvailable() {
  try {
    const key = '__deposit_test__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

const STORAGE_OK = isStorageAvailable()

/**
 * 从 localStorage 加载并重建内存缓存。
 * 每次查询前调用，保证跨页面/刷新后数据一致。
 */
function loadStore() {
  if (!STORAGE_OK) return

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      store.clear()
      orderHistory.clear()
      return
    }
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return

    store.clear()
    orderHistory.clear()

    for (const item of arr) {
      const normalized = normalizeOrder(item)
      store.set(normalized.depositOrderNo, normalized)

      const historyKey = getSourceHistoryKey(normalized)
      if (historyKey) {
        const nos = orderHistory.get(historyKey) || []
        nos.push(normalized.depositOrderNo)
        orderHistory.set(historyKey, nos)
      }
    }
  } catch (e) {
    console.warn('[depositMock] loadStore 失败，降级使用内存数据:', e)
  }
}

/**
 * 将内存缓存序列化写入 localStorage。
 * 每次变更后调用。
 */
function saveStore() {
  if (!STORAGE_OK) return

  try {
    const arr = Array.from(store.values())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch (e) {
    console.warn('[depositMock] saveStore 失败:', e)
  }
}

/**
 * 补全旧数据缺失字段，保证数据结构一致。
 */
function normalizeOrder(o) {
  const now = nowISO()
  const display = getDepositDisplaySettings()
  return {
    id: o.id || o.depositOrderNo || '',
    sourceType: o.sourceType || 'order',
    sourceOrderId: o.sourceOrderId ?? null,
    sourceOrderNo: o.sourceOrderNo || '',
    depositOrderNo: o.depositOrderNo || o.id || '',
    productName: o.productName || '租赁设备',
    modelCode: o.modelCode || '',
    unitCode: o.unitCode || '',
    customerName: o.customerName || '',
    customerPhone: o.customerPhone || '',
    depositAmount: Number(o.depositAmount ?? 0),
    rentAmount: Number(o.rentAmount ?? 0),
    rentStartDate: o.rentStartDate || '',
    rentEndDate: o.rentEndDate || '',
    rentDays: Number(o.rentDays ?? 0),
    qrImageUrl: o.qrImageUrl || '',
    reviewUrl: o.reviewUrl || '',
    posterDataUrl: o.posterDataUrl || null,
    status: o.status || 'pending_review',
    isLatest: o.isLatest !== undefined ? Boolean(o.isLatest) : true,
    expiresInText: o.expiresInText || display.expiresInText,
    contactPhones: o.contactPhones || display.contactPhones,
    workTime: o.workTime || display.workTime,
    expiresAt: o.expiresAt || now,
    createdAt: o.createdAt || now,
    updatedAt: o.updatedAt || o.createdAt || now,
  }
}

// ── 创建免押单 ──

/**
 * @param {Object} params
 * @returns {Promise<Object>}
 */
export async function mockCreateDepositOrder(params = {}) {
  await new Promise((r) => setTimeout(r, 800))

  // 加载最新数据
  loadStore()

  const validationMessage = validateCreateParams(params)
  if (validationMessage) {
    return { success: false, message: validationMessage }
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const depositOrderNo = generateDepositNo()
  const reviewUrl = `https://deposit.example.com/review/${depositOrderNo}`
  const qrImageUrl = 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#fff"/>
      <rect x="40" y="40" width="120" height="120" rx="8" fill="#0f766e"/>
      <text x="100" y="90" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">支付宝</text>
      <text x="100" y="115" text-anchor="middle" fill="#fff" font-size="12">扫码免押</text>
      <text x="100" y="148" text-anchor="middle" fill="#fff" font-size="10">${depositOrderNo.slice(-8)}</text>
    </svg>`
  )

  // 同订单旧单标记为非最新
  const historyKey = getSourceHistoryKey(params)
  const existingNos = historyKey ? (orderHistory.get(historyKey) || []) : []
  for (const no of existingNos) {
    const old = store.get(no)
    if (old) {
      old.isLatest = false
      old.updatedAt = nowISO()
    }
  }

  const display = getDepositDisplaySettings()

  const order = {
    id: depositOrderNo,
    sourceType: params.sourceType || 'order',
    sourceOrderId: params.sourceOrderId,
    sourceOrderNo: params.sourceOrderNo || '',
    depositOrderNo,
    productName: params.productName || '租赁设备',
    modelCode: params.modelCode || '',
    unitCode: params.unitCode || '',
    customerName: params.customerName || '',
    customerPhone: params.customerPhone || '',
    depositAmount: Number(params.depositAmount ?? 0),
    rentAmount: Number(params.rentAmount ?? 0),
    rentStartDate: params.rentStartDate || '',
    rentEndDate: params.rentEndDate || '',
    rentDays: Number(params.rentDays ?? 0),
    qrImageUrl,
    reviewUrl,
    posterDataUrl: null,
    status: 'pending_review',
    isLatest: true,
    expiresInText: display.expiresInText,
    contactPhones: display.contactPhones,
    workTime: display.workTime,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  store.set(depositOrderNo, order)
  if (historyKey) {
    const nos = orderHistory.get(historyKey) || []
    nos.push(depositOrderNo)
    orderHistory.set(historyKey, nos)
  }

  // 持久化
  saveStore()

  return {
    success: true,
    depositOrder: { ...order },
  }
}

// ── 查询方法 ──

/**
 * 列出所有免押单（支持筛选）
 */
export async function listDepositOrders(filters = {}) {
  await new Promise((r) => setTimeout(r, 200))

  // 从 localStorage 加载最新数据
  loadStore()

  let orders = Array.from(store.values())

  if (filters.status) {
    orders = orders.filter((o) => o.status === filters.status)
  }
  if (filters.isLatest !== undefined && filters.isLatest !== null && filters.isLatest !== '') {
    const wantLatest = filters.isLatest === true || filters.isLatest === 'true'
    orders = orders.filter((o) => o.isLatest === wantLatest)
  }
  if (filters.keyword) {
    const kw = String(filters.keyword).toLowerCase()
    orders = orders.filter((o) =>
      o.depositOrderNo.toLowerCase().includes(kw) ||
      o.sourceOrderNo.toLowerCase().includes(kw) ||
      (o.customerName || '').toLowerCase().includes(kw) ||
      (o.customerPhone || '').toLowerCase().includes(kw) ||
      (o.unitCode || '').toLowerCase().includes(kw) ||
      (o.productName || '').toLowerCase().includes(kw),
    )
  }

  // 按创建时间倒序
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return { orders, total: orders.length }
}

/**
 * 根据免押单号查详情
 */
export async function getDepositOrder(depositNo) {
  await new Promise((r) => setTimeout(r, 100))
  loadStore()
  const order = store.get(depositNo)
  return order ? { ...order } : null
}

export async function bindDepositOrderSource(depositNo, source = {}) {
  await new Promise((r) => setTimeout(r, 120))
  loadStore()
  const order = store.get(depositNo)
  if (!order) return { success: false, message: '免押单不存在' }

  const previousHistoryKey = getSourceHistoryKey(order)
  Object.assign(order, {
    sourceType: 'order',
    sourceOrderId: source.sourceOrderId ?? order.sourceOrderId ?? null,
    sourceOrderNo: source.sourceOrderNo || order.sourceOrderNo || '',
    productName: source.productName || order.productName || '',
    modelCode: source.modelCode || order.modelCode || '',
    unitCode: source.unitCode || order.unitCode || '',
    customerName: source.customerName || order.customerName || '',
    customerPhone: source.customerPhone || order.customerPhone || '',
    updatedAt: nowISO(),
  })

  if (previousHistoryKey && orderHistory.has(previousHistoryKey)) {
    orderHistory.set(previousHistoryKey, (orderHistory.get(previousHistoryKey) || []).filter((no) => no !== depositNo))
  }
  const nextHistoryKey = getSourceHistoryKey(order)
  if (nextHistoryKey) {
    const nos = orderHistory.get(nextHistoryKey) || []
    if (!nos.includes(depositNo)) nos.push(depositNo)
    orderHistory.set(nextHistoryKey, nos)
    syncLatestFlagForHistoryKey(nextHistoryKey)
  }
  saveStore()
  return { success: true, depositOrder: { ...order } }
}

/**
 * 根据来源订单查询所有免押单
 */
export function getDepositOrdersBySource(sourceOrderId) {
  loadStore()
  const keys = [
    getSourceHistoryKey({ sourceOrderId }),
    getSourceHistoryKey({ sourceOrderNo: sourceOrderId }),
  ].filter(Boolean)
  const nos = keys.flatMap((key) => orderHistory.get(key) || [])
  return Array.from(new Set(nos)).map((no) => store.get(no)).filter(Boolean)
}

/**
 * 获取最新的免押单
 */
export function getLatestDepositOrder(sourceOrderId) {
  const orders = getDepositOrdersBySource(sourceOrderId)
  return orders.find((o) => o.isLatest) || orders[orders.length - 1] || null
}

// ── 状态变更 ──

/**
 * 作废免押单
 */
export async function cancelDepositOrder(depositNo) {
  await new Promise((r) => setTimeout(r, 300))
  loadStore()

  const order = store.get(depositNo)
  if (!order) return { success: false, message: '免押单不存在' }
  if (order.status === 'cancelled') return { success: false, message: '免押单已作废' }
  if (!ACTIVE_STATUSES.includes(order.status)) {
    return { success: false, message: '仅待审核、已通过的免押单可取消' }
  }

  order.status = 'cancelled'
  order.updatedAt = nowISO()

  saveStore()
  return { success: true, depositOrder: { ...order } }
}

/**
 * 完结免押单
 */
export async function completeDepositOrder(depositNo) {
  await new Promise((r) => setTimeout(r, 300))
  loadStore()

  const order = store.get(depositNo)
  if (!order) return { success: false, message: '免押单不存在' }
  if (order.status === 'completed') return { success: false, message: '免押单已完结' }
  if (!ACTIVE_STATUSES.includes(order.status)) {
    return { success: false, message: '仅待审核、已通过的免押单可完结' }
  }

  order.status = 'completed'
  order.updatedAt = nowISO()

  saveStore()
  return { success: true, depositOrder: { ...order } }
}

/**
 * 删除免押单。仅允许删除已结束类状态，避免误删仍有效的单据。
 */
export async function deleteDepositOrder(depositNo) {
  await new Promise((r) => setTimeout(r, 200))
  loadStore()

  const order = store.get(depositNo)
  if (!order) return { success: false, message: '免押单不存在' }
  if (!['cancelled', 'completed', 'rejected'].includes(order.status)) {
    return { success: false, message: '仅已取消、已完结、已拒绝的免押单可删除' }
  }

  store.delete(depositNo)
  const historyKey = getSourceHistoryKey(order)
  if (historyKey) {
    const nextNos = (orderHistory.get(historyKey) || []).filter((no) => no !== depositNo)
    if (nextNos.length) {
      orderHistory.set(historyKey, nextNos)
      syncLatestFlagForHistoryKey(historyKey)
    } else {
      orderHistory.delete(historyKey)
    }
  }

  saveStore()
  return { success: true }
}

async function batchRun(depositNos = [], fn) {
  const results = []
  for (const no of depositNos) {
    results.push({ depositNo: no, ...(await fn(no)) })
  }
  const successCount = results.filter((item) => item.success).length
  const failedCount = results.length - successCount
  return {
    success: successCount > 0 || results.length === 0,
    results,
    successCount,
    failedCount,
  }
}

export async function batchCancelDepositOrders(depositNos = []) {
  return batchRun(depositNos, cancelDepositOrder)
}

export async function batchCompleteDepositOrders(depositNos = []) {
  return batchRun(depositNos, completeDepositOrder)
}

export async function batchDeleteDepositOrders(depositNos = []) {
  return batchRun(depositNos, deleteDepositOrder)
}

// ── 工具方法 ──

/**
 * 状态中文映射
 */
export function getDepositStatusLabel(status) {
  return STATUS_LABELS[status] || status || '-'
}

/**
 * 清空所有 mock 数据（仅开发调试用，不在页面自动调用）
 */
export function clearDepositOrders() {
  store.clear()
  orderHistory.clear()
  if (STORAGE_OK) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
  }
}
