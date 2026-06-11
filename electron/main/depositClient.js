'use strict'

/**
 * 免押开放平台客户端
 * 通过 Electron main process 代理调用真实免押接口。
 *
 * 重要：不在 renderer 前端直接 fetch 真实接口（符合接口文档安全要求）。
 * appId / appSecret 仅在 main process 中使用，不暴露给 renderer。
 *
 * 当前实现：create / detail / list / finish。
 */

const REQUEST_TIMEOUT_MS = 15000

function resolveTimeoutMs(settings = {}) {
  const value = Number(settings.timeoutMs)
  return Number.isFinite(value) && value > 0 ? value : REQUEST_TIMEOUT_MS
}

function validateSettings(settings = {}) {
  const {
    baseUrl,
    appId,
    appSecret,
    userEid,
  } = settings

  if (!baseUrl) return '免押接口地址未配置 (baseUrl)'
  if (!appId) return '免押 appId 未配置'
  if (!appSecret) return '免押 appSecret 未配置'
  if (!userEid) return '免押 userEid 未配置'
  return ''
}

function buildApiUrl(baseUrl, path, query = {}) {
  const url = new URL(`${String(baseUrl).replace(/\/+$/, '')}${path}`)
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function buildAuthHeaders(settings = {}) {
  return {
    appId: String(settings.appId || ''),
    appSecret: String(settings.appSecret || ''),
    userEid: String(settings.userEid || ''),
  }
}

async function requestJson(apiUrl, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), resolveTimeoutMs({ timeoutMs }))

  try {
    const response = await fetch(apiUrl, {
      ...fetchOptions,
      signal: controller.signal,
    })
    clearTimeout(timer)

    let data
    try {
      data = await response.json()
    } catch {
      return { success: false, message: '接口返回格式异常，无法解析 JSON' }
    }

    if (!data) return { success: false, message: '接口返回格式异常，无法解析响应' }

    const code = Number(data.code)
    const message = data.message || data.msg || ''
    if (code !== 1) {
      return {
        success: false,
        message: message || `免押接口请求失败 (code=${code})`,
        raw: data,
      }
    }

    return {
      success: true,
      message: message || 'success',
      data: data.data,
      raw: data,
    }
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      return { success: false, message: '请求超时，请稍后重试' }
    }
    return { success: false, message: err.message || '网络请求失败，请稍后重试' }
  }
}

// ═══════════════════════════════════════
//  时间转换
// ═══════════════════════════════════════

/**
 * 日期字符串 / 毫秒时间戳 → 毫秒时间戳。
 * @param {string|number} value — YYYY-MM-DD 字符串 或 13位毫秒时间戳
 * @param {boolean} endOfDay — 是否取当天 23:59:59.999
 * @returns {number|null}
 */
function dateToMillis(value, endOfDay = false) {
  if (value == null || value === '') return null

  // 已经是数字时间戳（> 1e12 即 13 位毫秒）
  if (typeof value === 'number' && value > 1e12) return value

  const str = String(value).trim()

  // YYYY-MM-DD
  const dateMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    const y = Number(dateMatch[1])
    const m = Number(dateMatch[2]) - 1
    const d = Number(dateMatch[3])
    if (endOfDay) {
      return new Date(y, m, d, 23, 59, 59, 999).getTime()
    }
    return new Date(y, m, d, 0, 0, 0, 0).getTime()
  }

  // 兜底：尝试 Date 解析
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.getTime()

  return null
}

// ═══════════════════════════════════════
//  创建免押单
// ═══════════════════════════════════════

/**
 * 调用真实免押接口创建免押单。
 *
 * POST /openapi/order/createMerchantDepositOrder
 * Content-Type: multipart/form-data（由 fetch + FormData 自动设置）
 *
 * @param {Object} params — 前端传入参数，包含：
 *   productName, depositAmount, rentAmount, rentStartDate, rentEndDate,
 *   sourceOrderNo, modelCode, unitCode, customerName, customerPhone,
 *   receivingInfo（可选，直接从订单获取的收货信息）
 * @param {Object} settings — 配置，包含：
 *   baseUrl, appId, appSecret, userEid, notify_url,
 *   contractSupplementaryContent, receivingInfoFallback
 * @returns {Promise<{success: boolean, message: string, depositOrder?: object, raw?: object}>}
 */
async function createMerchantDepositOrder(params, settings = {}) {
  const {
    baseUrl,
    appId,
    appSecret,
    userEid,
    notify_url: notifyUrl,
    contractSupplementaryContent,
    receivingInfoFallback,
  } = settings

  const settingsError = validateSettings(settings)
  if (settingsError) return { success: false, message: settingsError }

  if (!params.productName || !String(params.productName).trim()) {
    return { success: false, message: '商品名称不能为空' }
  }
  if (params.depositAmount == null || params.depositAmount === '') {
    return { success: false, message: '押金金额不能为空' }
  }
  const depositAmount = Number(params.depositAmount)
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return { success: false, message: '押金金额必须大于 0' }
  }

  // ── 租期时间戳转换 ──
  const startMillis = dateToMillis(params.rentStartDate, false)
  const endMillis = dateToMillis(params.rentEndDate, true)

  if (startMillis === null) {
    return { success: false, message: `租期开始日期格式错误：${params.rentStartDate}` }
  }
  if (endMillis === null) {
    return { success: false, message: `租期结束日期格式错误：${params.rentEndDate}` }
  }
  if (endMillis < startMillis) {
    return { success: false, message: '租期结束日期不能早于开始日期' }
  }

  // ── 合同补充内容 ──
  let supplementary = (contractSupplementaryContent || '').trim()
  if (!supplementary) {
    const parts = []
    if (params.sourceOrderNo) parts.push(`来源订单：${params.sourceOrderNo}`)
    if (params.modelCode) parts.push(`型号：${params.modelCode}`)
    if (params.unitCode) parts.push(`设备编号：${params.unitCode}`)
    supplementary = parts.join('；')
  }

  // ── 收货信息 ──
  let receivingInfo = (params.receivingInfo || '').trim()
  if (!receivingInfo) {
    const parts = [
      params.customerName || '',
      params.customerPhone || '',
      receivingInfoFallback || '',
    ].filter(Boolean)
    receivingInfo = parts.join(' ')
  }

  // ── 构建请求 ──
  const apiUrl = `${String(baseUrl).replace(/\/+$/, '')}/openapi/order/createMerchantDepositOrder`

  // 使用 FormData 构建 multipart/form-data 请求体
  // Content-Type 由 fetch 自动设置为 multipart/form-data; boundary=...
  // 注意：不要手动设置 Content-Type header
  const formData = new FormData()
  formData.append('product_name', String(params.productName || '').trim())
  formData.append('product_deposit', String(depositAmount))
  formData.append('count_deposit_price', String(params.rentAmount ?? '0'))
  formData.append('tenancyDaterangeStart', String(startMillis))
  formData.append('tenancyDaterangeEnd', String(endMillis))
  formData.append('notify_url', notifyUrl || '')
  formData.append('contractSupplementaryContent', supplementary)
  formData.append('receivingInfo', receivingInfo)

  // ── 发起请求（fetch + FormData，Content-Type 自动为 multipart/form-data） ──
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), resolveTimeoutMs(settings))

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: buildAuthHeaders(settings),
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timer)

    // ── 解析响应 ──
    let data
    try {
      data = await response.json()
    } catch {
      return { success: false, message: '接口返回格式异常，无法解析 JSON' }
    }

    if (!data) {
      return { success: false, message: '接口返回格式异常，无法解析响应' }
    }

    const code = Number(data.code)
    const message = data.message || data.msg || ''

    if (code === 1) {
      // 成功
      const now = new Date().toISOString()
      const apiData = data.data || {}

      const depositOrder = {
        // 来自真实接口
        depositOrderNo: apiData.orderNo || '',
        qrImageUrl: apiData.qr_code_url || '',
        reviewUrl: apiData.qr_code_url || '',  // 创建接口不返回 scheme_url，fallback 为二维码
        status: 'pending_review',

        // 前端 fallback 补齐
        sourceOrderId: params.sourceOrderId,
        sourceOrderNo: params.sourceOrderNo || '',
        productName: String(params.productName || '').trim(),
        modelCode: params.modelCode || '',
        unitCode: params.unitCode || '',
        customerName: params.customerName || '',
        customerPhone: params.customerPhone || '',
        depositAmount: Number(params.depositAmount ?? 0),
        rentAmount: Number(params.rentAmount ?? 0),
        rentStartDate: params.rentStartDate || '',
        rentEndDate: params.rentEndDate || '',
        rentDays: Number(params.rentDays ?? 0),
        isLatest: true,

        // 时间
        createdAt: now,
        updatedAt: now,
      }

      return {
        success: true,
        message: message || '创建免押单成功',
        depositOrder,
        raw: data,
      }
    }

    // 失败
    return {
      success: false,
      message: message || `创建免押单失败 (code=${code})`,
      raw: data,
    }
  } catch (err) {
    clearTimeout(timer)

    if (err.name === 'AbortError') {
      return { success: false, message: '请求超时，请稍后重试' }
    }

    return {
      success: false,
      message: err.message || '网络请求失败，请稍后重试',
    }
  }
}

async function getMerchantDepositOrderDetail(orderNo, settings = {}) {
  const settingsError = validateSettings(settings)
  if (settingsError) return { success: false, message: settingsError }
  if (!orderNo) return { success: false, message: '免押单号不能为空' }

  const apiUrl = buildApiUrl(
    settings.baseUrl,
    '/openapi/order/getMerchantDepositOrderDetail',
    { orderNo },
  )
  const result = await requestJson(apiUrl, {
    method: 'GET',
    headers: buildAuthHeaders(settings),
    timeoutMs: settings.timeoutMs,
  })
  if (!result.success) return result

  return {
    success: true,
    message: result.message || '查询免押单详情成功',
    depositOrder: result.data || null,
    raw: result.raw,
  }
}

async function listMerchantDepositOrders(filters = {}, settings = {}) {
  const settingsError = validateSettings(settings)
  if (settingsError) return { success: false, message: settingsError }

  const apiUrl = buildApiUrl(
    settings.baseUrl,
    '/openapi/order/getMerchantDepositOrders',
    {
      rent_status: filters.rentStatus || filters.rent_status || '',
      deposit_status: filters.depositStatus || filters.deposit_status || 'all',
      keywords: filters.keyword || filters.keywords || '',
      limit: filters.limit || 50,
      page: filters.page || 1,
    },
  )
  const result = await requestJson(apiUrl, {
    method: 'GET',
    headers: buildAuthHeaders(settings),
    timeoutMs: settings.timeoutMs,
  })
  if (!result.success) return result

  const data = result.data || {}
  return {
    success: true,
    message: result.message || '查询免押单列表成功',
    orders: Array.isArray(data.lists) ? data.lists : [],
    total: Number(data.total || 0),
    page: Number(data.page || filters.page || 1),
    limit: Number(data.limit || filters.limit || 50),
    raw: result.raw,
  }
}

async function finishMerchantDepositOrder(orderNo, settings = {}) {
  const settingsError = validateSettings(settings)
  if (settingsError) return { success: false, message: settingsError }
  if (!orderNo) return { success: false, message: '免押单号不能为空' }

  const apiUrl = buildApiUrl(settings.baseUrl, '/openapi/order/finishMerchantDepositOrder')
  const formData = new FormData()
  formData.append('orderNo', String(orderNo))

  const result = await requestJson(apiUrl, {
    method: 'POST',
    headers: buildAuthHeaders(settings),
    body: formData,
    timeoutMs: settings.timeoutMs,
  })
  if (!result.success) return result

  return {
    success: true,
    message: result.message || '完结免押单成功',
    raw: result.raw,
  }
}

module.exports = {
  createMerchantDepositOrder,
  getMerchantDepositOrderDetail,
  listMerchantDepositOrders,
  finishMerchantDepositOrder,
  dateToMillis,
  resolveTimeoutMs,
}
