const http = require('http')
const { URLSearchParams } = require('url')

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 1032
const DEFAULT_PATH = '/api/AliNotify/deposit'
const MAX_BODY_BYTES = 1024 * 1024

let server = null
let notifyHandler = null
let detailResolver = null

const state = {
  running: false,
  host: DEFAULT_HOST,
  port: DEFAULT_PORT,
  path: DEFAULT_PATH,
  url: `http://${DEFAULT_HOST}:${DEFAULT_PORT}${DEFAULT_PATH}`,
  lastReceivedAt: '',
  lastEvent: '',
  lastOrderNo: '',
  lastStatus: '',
  lastDetailSyncedAt: '',
  lastError: '',
}

function getFirstValue(payload, keys) {
  for (const key of keys) {
    const value = payload?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
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

function statusFromEvent(event) {
  const normalized = String(event || '').trim()
  const map = {
    freeze_success: 'approved',
    freeze_fail: 'rejected',
    unfreeze_success: 'completed',
    unfreeze_fail: 'approved',
  }
  return map[normalized] || ''
}

function resolveNotifyStatus(event, rawStatus) {
  const eventStatus = statusFromEvent(event)
  const normalizedRawStatus = rawStatus === '' ? '' : normalizeDepositStatus(rawStatus)
  if (eventStatus && !['completed', 'cancelled'].includes(normalizedRawStatus)) return eventStatus
  return normalizedRawStatus || 'pending_review'
}

function statusLabel(status) {
  const map = {
    pending_review: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    completed: '已完结',
    cancelled: '已取消',
  }
  return map[status] || status || '未知'
}

function normalizeDepositNotifyPayload(raw = {}) {
  const orderNo = getFirstValue(raw, ['orderNo', 'order_no', 'out_order_no', 'depositOrderNo'])
  const event = String(getFirstValue(raw, ['event', 'event_type', 'type']) || 'deposit_status_changed')
  const rawStatus = getFirstValue(raw, ['deposit_status', 'status'])
  const status = resolveNotifyStatus(event, rawStatus)
  const eventData = raw.event_data && typeof raw.event_data === 'object' ? raw.event_data : {}

  return {
    type: 'deposit_status_changed',
    depositOrderNo: orderNo,
    orderNo,
    sourceOrderNo: getFirstValue(raw, ['source_order_no', 'sourceOrderNo', 'out_trade_no']),
    status,
    statusLabel: statusLabel(status),
    depositStatus: status,
    depositStatusLabel: statusLabel(status),
    event,
    customerName: getFirstValue(raw, ['customer_name', 'customerName', 'customer_nickname']),
    customerPhone: getFirstValue(raw, ['customer_mobile', 'customerPhone', 'customer_phone']),
    residualDeposit: getFirstValue(raw, ['residual_deposit', 'residualDeposit']),
    freezeType: getFirstValue(raw, ['freeze_type', 'freezeType']),
    authTime: getFirstValue(raw, ['auth_time', 'authTime']),
    freezeTime: getFirstValue(raw, ['freeze_time', 'freezeTime']),
    unfreezeTime: getFirstValue(raw, ['unfreeze_time', 'unfreezeTime']),
    authResultCode: getFirstValue(raw, ['auth_result_code', 'authResultCode']),
    authResultMessage: getFirstValue(raw, ['auth_result_msg', 'authResultMessage']),
    rawEventData: eventData,
  }
}

function mergeDepositNotifyDetailPayload(payload, detail = {}) {
  const raw = detail?.depositOrder || detail?.data || detail || {}
  const detailStatus = getFirstValue(raw, ['deposit_status', 'depositStatus', 'status'])
  const status = detailStatus === '' ? payload.status : normalizeDepositStatus(detailStatus)

  return {
    ...payload,
    status,
    statusLabel: statusLabel(status),
    depositStatus: status,
    depositStatusLabel: statusLabel(status),
    reviewUrl: getFirstValue(raw, ['scheme_url', 'schemeUrl', 'reviewUrl']) || payload.reviewUrl || '',
    qrImageUrl: getFirstValue(raw, ['qr_code_url', 'qrImageUrl', 'qrCodeUrl', 'qrCode']) || payload.qrImageUrl || '',
    customerName: getFirstValue(raw, ['customer_name', 'customerName', 'customer_nickname']) || payload.customerName,
    customerPhone: getFirstValue(raw, ['customer_mobile', 'customerPhone', 'customer_phone']) || payload.customerPhone,
    depositAmount: getFirstValue(raw, ['product_deposit', 'depositAmount', 'deposit_amount']) || payload.depositAmount,
    rentAmount: getFirstValue(raw, ['count_deposit_price', 'rentAmount', 'rent_amount']) || payload.rentAmount,
    rentStartDate: getFirstValue(raw, ['rent_start_time', 'rentStartDate', 'rent_start_date']) || payload.rentStartDate,
    rentEndDate: getFirstValue(raw, ['rent_end_time', 'rentEndDate', 'rent_end_date']) || payload.rentEndDate,
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0

    req.on('data', (chunk) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('回调请求体超过 1MB 限制'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) {
        resolve({})
        return
      }

      const contentType = String(req.headers['content-type'] || '').toLowerCase()
      try {
        if (contentType.includes('application/x-www-form-urlencoded')) {
          resolve(Object.fromEntries(new URLSearchParams(text)))
        } else {
          resolve(JSON.parse(text))
        }
      } catch (err) {
        reject(new Error(`回调请求体解析失败：${err.message}`))
      }
    })

    req.on('error', reject)
  })
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(payload))
}

async function handleRequest(req, res) {
  if (req.url.split('?')[0] !== state.path) {
    writeJson(res, 404, { code: '0', message: 'not found' })
    return
  }

  if (req.method !== 'POST') {
    writeJson(res, 405, { code: '0', message: 'method not allowed' })
    return
  }

  try {
    const rawPayload = await parseBody(req)
    let payload = normalizeDepositNotifyPayload(rawPayload)
    state.lastReceivedAt = new Date().toISOString()
    state.lastEvent = payload.event
    state.lastOrderNo = payload.depositOrderNo
    state.lastError = ''

    if (detailResolver && payload.depositOrderNo) {
      try {
        const detail = await detailResolver(payload, rawPayload)
        if (detail) {
          payload = mergeDepositNotifyDetailPayload(payload, detail)
          state.lastDetailSyncedAt = new Date().toISOString()
        }
      } catch (err) {
        state.lastError = err?.message || '回调详情同步失败'
      }
    }

    state.lastStatus = payload.status

    try {
      if (notifyHandler) await notifyHandler(payload, rawPayload)
    } catch (err) {
      state.lastError = err?.message || '飞书通知转发失败'
    }

    writeJson(res, 200, { code: '1' })
  } catch (err) {
    state.lastError = err?.message || '回调处理失败'
    writeJson(res, 400, { code: '0', message: state.lastError })
  }
}

function startDepositNotifyServer(options = {}) {
  if (server) return getDepositNotifyServerStatus()

  notifyHandler = options.notify || notifyHandler
  detailResolver = options.resolveDetail || detailResolver
  state.host = options.host || DEFAULT_HOST
  state.port = Number(options.port || DEFAULT_PORT)
  state.path = options.path || DEFAULT_PATH
  state.url = `http://${state.host}:${state.port}${state.path}`

  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      state.lastError = err?.message || '回调处理失败'
      writeJson(res, 500, { code: '0', message: state.lastError })
    })
  })

  server.on('error', (err) => {
    state.running = false
    state.lastError = err?.message || '本地免押回调服务启动失败'
    server = null
  })

  server.listen(state.port, state.host, () => {
    state.running = true
    state.lastError = ''
  })

  return getDepositNotifyServerStatus()
}

function stopDepositNotifyServer() {
  if (!server) return
  server.close()
  server = null
  state.running = false
}

function getDepositNotifyServerStatus() {
  return { ...state }
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_PATH,
  getDepositNotifyServerStatus,
  normalizeDepositNotifyPayload,
  mergeDepositNotifyDetailPayload,
  startDepositNotifyServer,
  stopDepositNotifyServer,
}
