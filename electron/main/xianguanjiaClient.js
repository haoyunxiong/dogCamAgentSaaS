'use strict'

/**
 * 闲管家开放平台 (open.goofish.pro) 客户端
 *
 * 认证方式：在 query string 附加 appid / timestamp / sign，body 为 JSON。
 * 签名算法（按闲管家开放平台通用约定）：
 *   sign = md5(app_secret + appid + timestamp + body_json).toUpperCase()
 * 若后续文档明确不同（例如需要按 key 排序 URL 参数拼接），可通过
 * XGJ_SIGN_MODE 配置切换到 "sorted_query" 模式。
 *
 * 所有 API 均为 POST，成功响应形如:
 *   { code: 0, msg: "OK"|"ok", data: {...} }
 *
 * 相关文档入口: https://s.apifox.cn/3ac13d69-5a38-4536-ae9b-a54001854ef8
 */

const crypto = require('crypto')
const https = require('https')
const http = require('http')
const { URL } = require('url')

const DEFAULT_BASE_URL = 'https://open.goofish.pro'
const REQUEST_TIMEOUT_MS = 15000

function md5Hex(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex')
}

function buildSign({ appid, timestamp, bodyJson, appSecret, signMode }) {
  if (signMode === 'sorted_query') {
    // 备选算法: md5(secret + key1=val1&key2=val2 + secret)
    const parts = [`appid=${appid}`, `timestamp=${timestamp}`]
    parts.sort()
    const raw = `${appSecret}${parts.join('&')}${bodyJson}${appSecret}`
    return md5Hex(raw).toUpperCase()
  }
  // 默认: md5(app_secret + appid + timestamp + body_json)
  const raw = `${appSecret}${appid}${timestamp}${bodyJson || ''}`
  return md5Hex(raw).toUpperCase()
}

/**
 * 发起一次 POST 请求。
 * @param {Object} opts
 * @param {string} opts.path           e.g. "/api/open/order/list"
 * @param {Object} opts.body           请求体对象（将被 JSON.stringify）
 * @param {Object} opts.credentials    { appid, appSecret, baseUrl?, sellerId?, signMode? }
 * @returns {Promise<{ code: number, msg: string, data: any }>}
 */
function postSigned({ path, body = {}, credentials = {} }) {
  return new Promise((resolve, reject) => {
    const appid = String(credentials.appid || credentials.app_key || '').trim()
    const appSecret = String(credentials.appSecret || credentials.app_secret || '').trim()
    if (!appid || !appSecret) {
      reject(new Error('闲管家凭据未配置 (appid / appSecret)'))
      return
    }
    const baseUrl = (credentials.baseUrl || credentials.base_url || DEFAULT_BASE_URL).replace(/\/+$/, '')
    const signMode = credentials.signMode || credentials.sign_mode || 'default'
    const sellerId = credentials.sellerId || credentials.seller_id || ''
    const timestamp = Math.floor(Date.now() / 1000)

    const bodyJson = JSON.stringify(body || {})
    const sign = buildSign({ appid, timestamp, bodyJson, appSecret, signMode })

    const qs = new URLSearchParams()
    qs.set('appid', appid)
    qs.set('timestamp', String(timestamp))
    qs.set('sign', sign)
    if (sellerId) qs.set('seller_id', String(sellerId))

    const url = new URL(`${baseUrl}${path}?${qs.toString()}`)
    const client = url.protocol === 'https:' ? https : http
    const reqOpts = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(bodyJson),
        'User-Agent': 'XianyuAgentPro/1.0 (+electron)',
      },
      timeout: REQUEST_TIMEOUT_MS,
    }

    const req = client.request(reqOpts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let parsed
        try {
          parsed = text ? JSON.parse(text) : {}
        } catch (err) {
          reject(new Error(`闲管家返回非 JSON (HTTP ${res.statusCode}): ${text.slice(0, 200)}`))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed)
        } else {
          const msg = parsed?.msg || `HTTP ${res.statusCode}`
          const err = new Error(`闲管家 API 失败: ${msg}`)
          err.payload = parsed
          err.httpStatus = res.statusCode
          reject(err)
        }
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error(`闲管家请求超时 (${REQUEST_TIMEOUT_MS}ms)`))
    })
    req.on('error', reject)
    req.write(bodyJson)
    req.end()
  })
}

/**
 * 高层封装：每个方法都直接返回 { code, msg, data }。
 * 业务代码根据 code===0 判断成功。
 */
class XianguanjiaClient {
  constructor(credentials) {
    this.credentials = credentials || {}
  }

  setCredentials(credentials) {
    this.credentials = { ...this.credentials, ...(credentials || {}) }
  }

  hasCredentials() {
    const c = this.credentials || {}
    return Boolean((c.appid || c.app_key) && (c.appSecret || c.app_secret))
  }

  // ---- 用户 ----
  listShops() {
    return postSigned({ path: '/api/open/user/authorize/list', body: {}, credentials: this.credentials })
  }

  // ---- 商品 ----
  listProducts(body = {}) {
    return postSigned({ path: '/api/open/product/list', body, credentials: this.credentials })
  }
  getProductDetail(productId) {
    return postSigned({ path: '/api/open/product/detail', body: { product_id: productId }, credentials: this.credentials })
  }
  getProductSku(productId) {
    return postSigned({ path: '/api/open/product/sku', body: { product_id: productId }, credentials: this.credentials })
  }
  onlineProduct(productId) {
    return postSigned({ path: '/api/open/product/online', body: { product_id: productId }, credentials: this.credentials })
  }
  offlineProduct(productId) {
    return postSigned({ path: '/api/open/product/offline', body: { product_id: productId }, credentials: this.credentials })
  }
  updateProduct(body) {
    return postSigned({ path: '/api/open/product/edit', body, credentials: this.credentials })
  }
  updateStock(body) {
    return postSigned({ path: '/api/open/product/stock/edit', body, credentials: this.credentials })
  }
  deleteProduct(productId) {
    return postSigned({ path: '/api/open/product/delete', body: { product_id: productId }, credentials: this.credentials })
  }
  listCategories() {
    return postSigned({ path: '/api/open/product/category/list', body: {}, credentials: this.credentials })
  }
  listProperties(body = {}) {
    return postSigned({ path: '/api/open/product/property/list', body, credentials: this.credentials })
  }

  // ---- 订单 ----
  /**
   * body 支持：
   *   page_no, page_size, order_status (11=待付款, 12=待发货, 21=已发货, 22=已完成, 23=已退款, 24=已关闭),
   *   refund_status, pay_time/consign_time/confirm_time/refund_time/update_time 为 [start_ts, end_ts]
   */
  listOrders(body = { page_no: 1, page_size: 50 }) {
    return postSigned({ path: '/api/open/order/list', body, credentials: this.credentials })
  }
  getOrderDetail(orderNo) {
    return postSigned({ path: '/api/open/order/detail', body: { order_no: String(orderNo) }, credentials: this.credentials })
  }
  /**
   * 订单物流发货
   * 必填: order_no, waybill_no, express_code, express_name
   * 推荐填写寄件方信息（ship_name / ship_mobile + 省市区或 district_id + ship_address）
   */
  shipOrder(body) {
    return postSigned({ path: '/api/open/order/ship', body, credentials: this.credentials })
  }
  updateOrderPrice(body) {
    return postSigned({ path: '/api/open/order/price/modify', body, credentials: this.credentials })
  }
  listOrderCardSecrets(orderNo) {
    return postSigned({ path: '/api/open/order/card/list', body: { order_no: String(orderNo) }, credentials: this.credentials })
  }

  // ---- 其他 ----
  listExpressCompanies() {
    return postSigned({ path: '/api/open/express/list', body: {}, credentials: this.credentials })
  }
}

module.exports = {
  XianguanjiaClient,
  buildSign,
  DEFAULT_BASE_URL,
}
