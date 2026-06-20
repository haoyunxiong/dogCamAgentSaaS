const {
  DEFAULT_EXTERNAL_MODE,
  EXTERNAL_MODES,
  getExternalOperationPolicy,
  getExternalPolicy,
} = require('./safeOpsExternalPolicy')
const { sha256Hex } = require('./safeOpsCrypto')

function normalizeText(value) {
  return String(value || '').trim()
}

function buildUnsupportedExternalOperation(operationType) {
  return {
    ok: false,
    supported: false,
    code: 'SAFE_OP_EXTERNAL_UNSUPPORTED',
    message: operationType
      ? `Unsupported external safe operation: ${operationType}`
      : 'Unsupported external safe operation: operationType is required',
    mode: 'external-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
  }
}

function buildExternalAuditShape(operationPolicy) {
  return {
    mode: 'external-audit-shape',
    required: true,
    persisted: false,
    providerName: operationPolicy.providerName,
    operationType: operationPolicy.operationType,
    externalRequestId: null,
    externalResponseId: null,
    redactedRequest: {},
    redactedResponse: null,
    status: 'blocked',
  }
}

function buildExternalIdempotencyShape(operationPolicy) {
  return {
    mode: 'external-idempotency-shape',
    required: true,
    persisted: false,
    providerName: operationPolicy.providerName,
    operationType: operationPolicy.operationType,
    externalIdempotencyKeyHash: null,
    payloadHash: null,
    status: 'blocked',
  }
}

function buildExternalImpact(operationPolicy, mode = 'disabled') {
  const modeLabel = mode === 'mock'
    ? '模拟预览'
    : (mode === 'sandbox' ? '沙盒预览' : '默认关闭')
  return {
    summary: `${operationPolicy.operationType} ${modeLabel}：外部真实动作已关闭，不会发送外部请求，不会写发货记录、订单状态、档期或费用。`,
    affectedRecords: [],
    externalEffects: [],
  }
}

function normalizeMode(operationInput = {}, provider = {}, operationPolicy = {}) {
  const requestedMode = normalizeText(operationInput.mode || operationInput.payload?.mode || provider.currentMode || DEFAULT_EXTERNAL_MODE)
  if (!EXTERNAL_MODES.includes(requestedMode)) {
    return {
      mode: DEFAULT_EXTERNAL_MODE,
      warnings: ['不支持的外部网关模式已降级为默认关闭。'],
    }
  }
  if (requestedMode === 'real') {
    return {
      mode: 'real',
      warnings: [],
    }
  }
  const previewModes = Array.isArray(operationPolicy.previewModes) && operationPolicy.previewModes.length
    ? operationPolicy.previewModes
    : (Array.isArray(provider.previewModes) ? provider.previewModes : [DEFAULT_EXTERNAL_MODE])
  if (!previewModes.includes(requestedMode)) {
    return {
      mode: DEFAULT_EXTERNAL_MODE,
      warnings: ['当前外部网关模式不允许预览，已降级为默认关闭。'],
    }
  }
  return {
    mode: requestedMode,
    warnings: [],
  }
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length < 7) return '<redacted-phone>'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function maskName(value) {
  const text = normalizeText(value)
  if (!text) return null
  return {
    hasValue: true,
    length: text.length,
    preview: text.length <= 1 ? '*' : `${text.slice(0, 1)}*`,
  }
}

function maskAddress(value, city = '') {
  const text = normalizeText(value)
  return {
    hasValue: Boolean(text),
    length: text.length,
    city: normalizeText(city) || null,
    preview: text ? '<redacted-address>' : null,
  }
}

function maskIdentity(value) {
  const text = normalizeText(value)
  return {
    hasValue: Boolean(text),
    length: text.length,
    preview: text ? '<redacted-identity>' : null,
  }
}

function maskAccount(value) {
  const text = normalizeText(value)
  if (!text) return null
  if (text.length <= 4) return '<redacted-account>'
  return `${text.slice(0, 2)}***${text.slice(-2)}`
}

function maskTitle(value) {
  const text = normalizeText(value)
  return {
    hasValue: Boolean(text),
    length: text.length,
    preview: text ? '<redacted-title>' : null,
  }
}

function asNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function buildSfRequestPayloadPreview(payload = {}, mode = 'mock') {
  const packagePayload = payload.package && typeof payload.package === 'object' ? payload.package : {}
  const servicePayload = payload.service && typeof payload.service === 'object' ? payload.service : {}
  const senderCity = normalizeText(payload.senderCity || payload.shipFromCity)
  const receiverCity = normalizeText(payload.receiverCity || payload.shipToCity)

  return {
    providerName: 'sf_express',
    operationType: 'logistics.sf.create_order',
    externalAction: 'create_order',
    mode,
    realRequestWillBeSent: false,
    order: {
      orderId: normalizeText(payload.orderId || payload.order_id) || null,
      shipmentId: normalizeText(payload.shipmentId || payload.shipment_id) || null,
      modelCode: normalizeText(payload.modelCode || payload.model_code) || null,
    },
    sender: {
      contactName: maskName(payload.senderName || payload.senderContactName || payload.sender_contact_name),
      phoneMasked: maskPhone(payload.senderPhone || payload.sender_phone),
      city: senderCity || null,
      address: maskAddress(payload.senderAddress || payload.sender_address, senderCity),
    },
    receiver: {
      contactName: maskName(payload.receiverName || payload.receiverContactName || payload.receiver_contact_name || payload.contactName),
      phoneMasked: maskPhone(payload.receiverPhone || payload.receiver_phone || payload.phone),
      city: receiverCity || null,
      address: maskAddress(payload.receiverAddress || payload.receiver_address || payload.address, receiverCity),
    },
    package: {
      weightKg: asNumberOrNull(packagePayload.weightKg || packagePayload.weight_kg || payload.weightKg || payload.weight_kg),
      quantity: asNumberOrNull(packagePayload.quantity || packagePayload.count || payload.quantity || payload.packageCount) || 1,
      goodsType: normalizeText(packagePayload.goodsType || packagePayload.goods_type || payload.goodsType || payload.goods_type || 'rental_device'),
      insuredAmount: asNumberOrNull(packagePayload.insuredAmount || packagePayload.insured_amount || payload.insuredAmount || payload.insured_amount),
    },
    service: {
      productCode: normalizeText(servicePayload.productCode || servicePayload.product_code || payload.productCode || 'sf_standard'),
      payMethod: normalizeText(servicePayload.payMethod || servicePayload.pay_method || payload.payMethod || 'monthly_settlement_preview'),
      remark: payload.remark ? '<redacted-remark>' : null,
    },
  }
}

function buildMockWaybillPreview(payloadPreview = {}) {
  const stableSource = JSON.stringify({
    providerName: payloadPreview.providerName,
    operationType: payloadPreview.operationType,
    order: payloadPreview.order,
    package: payloadPreview.package,
    service: payloadPreview.service,
  })
  const digest = sha256Hex(stableSource).slice(0, 12).toUpperCase()
  return {
    waybillNo: `SFMOCK${digest}`,
    providerName: 'sf_express',
    status: 'mock_preview_only',
    willCreateWaybill: false,
    willReserveTrackingNo: false,
    willChargeFee: false,
    routePreview: {
      fromCity: payloadPreview.sender?.city || null,
      toCity: payloadPreview.receiver?.city || null,
    },
  }
}

function buildSandboxPayloadPreview(payloadPreview = {}) {
  return {
    endpointMode: 'sandbox-preview-only',
    providerName: 'sf_express',
    operation: 'create_order',
    willSendHttpRequest: false,
    payloadShape: {
      order: payloadPreview.order,
      sender: payloadPreview.sender,
      receiver: payloadPreview.receiver,
      package: payloadPreview.package,
      service: payloadPreview.service,
    },
  }
}

function buildDepositRequestPayloadPreview(payload = {}, mode = 'mock', operationPolicy = {}) {
  const servicePayload = payload.service && typeof payload.service === 'object' ? payload.service : {}
  const finishPayload = payload.finish && typeof payload.finish === 'object' ? payload.finish : {}
  const action = operationPolicy.externalAction || 'create'
  return {
    providerName: 'deposit_service',
    operationType: operationPolicy.operationType,
    externalAction: action,
    mode,
    realRequestWillBeSent: false,
    order: {
      orderId: normalizeText(payload.orderId || payload.order_id) || null,
      orderNo: normalizeText(payload.orderNo || payload.order_no) || null,
      reviewId: normalizeText(payload.reviewId || payload.review_id) || null,
      modelCode: normalizeText(payload.modelCode || payload.model_code) || null,
    },
    deposit: {
      depositOrderId: normalizeText(payload.depositOrderId || payload.deposit_order_id) || null,
      requestedFreeAmount: asNumberOrNull(payload.requestedFreeAmount || payload.requested_free_amount),
      depositAmount: asNumberOrNull(payload.depositAmount || payload.deposit_amount),
      currency: normalizeText(payload.currency || 'CNY') || 'CNY',
      riskLevel: normalizeText(payload.riskLevel || payload.risk_level) || null,
      reviewStatus: normalizeText(payload.reviewStatus || payload.review_status) || null,
      depositStatus: normalizeText(payload.depositStatus || payload.deposit_status) || null,
    },
    customer: {
      realName: maskName(payload.realName || payload.real_name || payload.customerName || payload.customer_name),
      contactName: maskName(payload.contactName || payload.contact_name || payload.customerName || payload.customer_name),
      phoneMasked: maskPhone(payload.phone || payload.customerPhone || payload.customer_phone),
      address: maskAddress(payload.address || payload.customerAddress || payload.customer_address),
      userEidMasked: maskAccount(payload.userEid || payload.user_eid),
      idCard: maskIdentity(payload.idCard || payload.id_card || payload.idCardNo || payload.id_card_no),
      paymentAccountMasked: maskAccount(payload.paymentAccount || payload.payment_account),
    },
    finish: {
      reason: normalizeText(finishPayload.reason || payload.finishReason || payload.finish_reason || payload.reason) || null,
      requestedStatus: normalizeText(finishPayload.status || payload.finishStatus || payload.finish_status || 'finish_preview') || 'finish_preview',
      shouldReleaseDeposit: false,
      shouldNotifyExternalService: false,
    },
    service: {
      appIdMasked: maskAccount(servicePayload.appId || payload.appId || payload.app_id),
      productCode: normalizeText(servicePayload.productCode || servicePayload.product_code || payload.productCode || 'deposit_free_preview'),
      scenario: normalizeText(servicePayload.scenario || payload.scenario || 'rental_deposit_free_preview'),
      remark: payload.remark ? '<redacted-remark>' : null,
    },
  }
}

function buildMockDepositPreview(payloadPreview = {}, operationPolicy = {}) {
  const stableSource = JSON.stringify({
    providerName: payloadPreview.providerName,
    operationType: payloadPreview.operationType,
    externalAction: payloadPreview.externalAction,
    order: payloadPreview.order,
    deposit: payloadPreview.deposit,
    service: payloadPreview.service,
  })
  const digest = sha256Hex(stableSource).slice(0, 12).toUpperCase()
  const action = operationPolicy.externalAction || payloadPreview.externalAction || 'create'
  return {
    mockDepositNo: `DEPMOCK${digest}`,
    providerName: 'deposit_service',
    operation: action,
    status: action === 'finish' ? 'mock_finish_preview_only' : 'mock_create_preview_only',
    willCreateDepositOrder: false,
    willFinishDepositOrder: false,
    willChangeCreditState: false,
    willChargeOrReleaseFunds: false,
    willNotifyCustomer: false,
    amountPreview: {
      requestedFreeAmount: payloadPreview.deposit?.requestedFreeAmount || null,
      depositAmount: payloadPreview.deposit?.depositAmount || null,
      currency: payloadPreview.deposit?.currency || 'CNY',
    },
  }
}

function buildDepositSandboxPayloadPreview(payloadPreview = {}) {
  return {
    endpointMode: 'sandbox-preview-only',
    providerName: 'deposit_service',
    operation: payloadPreview.externalAction || 'create',
    willSendHttpRequest: false,
    payloadShape: {
      order: payloadPreview.order,
      deposit: payloadPreview.deposit,
      customer: payloadPreview.customer,
      finish: payloadPreview.finish,
      service: payloadPreview.service,
    },
  }
}

const XIANYU_SYNC_DIRECTIONS = new Set([
  'pull_remote_order',
  'push_local_state',
  'reconcile_status',
])

function normalizeXianyuSyncDirection(value) {
  const text = normalizeText(value)
  return XIANYU_SYNC_DIRECTIONS.has(text) ? text : 'pull_remote_order'
}

function buildXianyuRequestPayloadPreview(payload = {}, mode = 'mock', operationPolicy = {}) {
  const syncDirection = normalizeXianyuSyncDirection(payload.syncDirection || payload.sync_direction || payload.direction)
  const credentials = payload.credentials && typeof payload.credentials === 'object' ? payload.credentials : {}
  const tokenValue = payload.token || payload.accessToken || payload.access_token || credentials.token || credentials.accessToken
  const refreshTokenValue = payload.refreshToken || payload.refresh_token || credentials.refreshToken
  const cookieValue = payload.cookie || credentials.cookie
  const sessionValue = payload.session || credentials.session
  const apiKeyValue = payload.apiKey || payload.api_key || credentials.apiKey
  return {
    providerName: 'xianyu_platform',
    operationType: operationPolicy.operationType || 'xianyu.order.sync',
    externalAction: operationPolicy.externalAction || 'sync_order',
    mode,
    realRequestWillBeSent: false,
    sync: {
      direction: syncDirection,
      willPullRemoteOrder: false,
      willPushLocalState: false,
      willReconcileStatus: false,
      willWriteLocalOrder: false,
      willUpdateRemoteOrder: false,
    },
    order: {
      orderId: normalizeText(payload.orderId || payload.order_id) || null,
      orderNo: normalizeText(payload.orderNo || payload.order_no) || null,
      localOrderId: normalizeText(payload.localOrderId || payload.local_order_id) || null,
      xianyuOrderId: normalizeText(payload.xianyuOrderId || payload.xianyu_order_id || payload.remoteOrderId || payload.remote_order_id) || null,
      channel: 'xianyu',
    },
    buyer: {
      buyerIdMasked: maskAccount(payload.buyerId || payload.buyer_id),
      contactName: maskName(payload.contactName || payload.contact_name || payload.buyerName || payload.buyer_name),
      buyerName: maskName(payload.buyerName || payload.buyer_name),
      phoneMasked: maskPhone(payload.buyerPhone || payload.buyer_phone || payload.phone),
      address: maskAddress(payload.receiverAddress || payload.receiver_address || payload.address, payload.receiverCity || payload.receiver_city),
    },
    seller: {
      sellerIdMasked: maskAccount(payload.sellerId || payload.seller_id),
      sellerName: maskName(payload.sellerName || payload.seller_name),
    },
    item: {
      itemId: normalizeText(payload.itemId || payload.item_id) || null,
      skuId: normalizeText(payload.skuId || payload.sku_id) || null,
      modelCode: normalizeText(payload.modelCode || payload.model_code) || null,
      title: maskTitle(payload.itemTitle || payload.item_title || payload.title),
    },
    credentials: {
      tokenHash: tokenValue ? sha256Hex(String(tokenValue)).slice(0, 16) : null,
      refreshTokenHash: refreshTokenValue ? sha256Hex(String(refreshTokenValue)).slice(0, 16) : null,
      cookiePresent: Boolean(cookieValue),
      sessionPresent: Boolean(sessionValue),
      apiKeyMasked: maskAccount(apiKeyValue),
    },
    service: {
      scenario: normalizeText(payload.scenario || 'xianyu_order_sync_preview'),
      requestedAt: normalizeText(payload.requestedAt || payload.requested_at) || null,
      remark: payload.remark || payload.reason ? '<redacted-remark>' : null,
    },
  }
}

function buildMockXianyuSyncPreview(payloadPreview = {}) {
  const stableSource = JSON.stringify({
    providerName: payloadPreview.providerName,
    operationType: payloadPreview.operationType,
    externalAction: payloadPreview.externalAction,
    sync: payloadPreview.sync,
    order: payloadPreview.order,
    item: payloadPreview.item,
  })
  const digest = sha256Hex(stableSource).slice(0, 12).toUpperCase()
  return {
    mockSyncId: `XYMOCK${digest}`,
    providerName: 'xianyu_platform',
    operation: 'sync_order',
    status: 'mock_sync_preview_only',
    syncDirection: payloadPreview.sync?.direction || 'pull_remote_order',
    willReadRemoteOrder: false,
    willWriteLocalOrder: false,
    willUpdateRemoteOrder: false,
    willNotifyBuyer: false,
    localOrderPreview: {
      orderId: payloadPreview.order?.orderId || null,
      orderNo: payloadPreview.order?.orderNo || null,
      xianyuOrderId: payloadPreview.order?.xianyuOrderId || null,
    },
  }
}

function buildXianyuSandboxPayloadPreview(payloadPreview = {}) {
  return {
    endpointMode: 'sandbox-preview-only',
    providerName: 'xianyu_platform',
    operation: 'sync_order',
    willSendHttpRequest: false,
    payloadShape: {
      sync: payloadPreview.sync,
      order: payloadPreview.order,
      buyer: payloadPreview.buyer,
      seller: payloadPreview.seller,
      item: payloadPreview.item,
      credentials: payloadPreview.credentials,
      service: payloadPreview.service,
    },
  }
}

function buildExternalGatewayDescriptor(operationPolicy, provider, mode) {
  return {
    providerName: operationPolicy.providerName,
    providerStatus: provider.status || 'disabled',
    currentMode: mode || provider.currentMode || 'disabled',
    realEnabled: false,
    sandboxEnabled: Boolean(provider.sandboxEnabled),
    mockEnabled: Boolean(provider.mockEnabled),
    externalWritesEnabled: false,
    externalCallWillExecute: false,
    compensationRequired: Boolean(provider.compensationRequired),
    timeoutMs: provider.timeoutMs || null,
    retryPolicy: provider.retryPolicy || { enabled: false, maxAttempts: 0, backoffMs: 0 },
    sensitiveFields: provider.sensitiveFields || [],
    redactionRules: provider.redactionRules || {},
  }
}

function buildXianyuOrderSyncPreview(operationInput, operationPolicy, provider) {
  const normalizedMode = normalizeMode(operationInput, provider, operationPolicy)
  const mode = normalizedMode.mode
  const payload = operationInput.payload || {}
  const gateway = buildExternalGatewayDescriptor(operationPolicy, provider, mode)
  const base = {
    ok: true,
    supported: true,
    operationType: operationPolicy.operationType,
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: operationPolicy.riskLevel,
    expectedExternalAction: 'sync_order',
    realExecutionBlocked: true,
    externalPreviewMode: mode,
    externalGateway: gateway,
    externalAudit: {
      ...buildExternalAuditShape(operationPolicy),
      status: mode === 'mock' || mode === 'sandbox' ? 'previewed' : 'blocked',
    },
    externalIdempotency: {
      ...buildExternalIdempotencyShape(operationPolicy),
      status: mode === 'mock' || mode === 'sandbox' ? 'previewed' : 'blocked',
    },
  }

  if (mode === 'mock') {
    const requestPayloadPreview = buildXianyuRequestPayloadPreview(payload, mode, operationPolicy)
    return {
      ...base,
      mode: 'external-preview-mock',
      warnings: [
        ...normalizedMode.warnings,
        '闲鱼订单同步仅生成模拟预览，不会发送外部请求。',
        '买家、卖家、商品标题、地址、电话、cookie、session、token 和 API key 字段会在预览持久化前脱敏。',
      ],
      blockers: [],
      impact: buildExternalImpact(operationPolicy, mode),
      requestPayloadPreview,
      sanitizedRequestPayload: requestPayloadPreview,
      mockWaybillPreview: null,
      mockDepositPreview: null,
      mockXianyuSyncPreview: buildMockXianyuSyncPreview(requestPayloadPreview),
      sandboxPayloadPreview: null,
    }
  }

  if (mode === 'sandbox') {
    const requestPayloadPreview = buildXianyuRequestPayloadPreview(payload, mode, operationPolicy)
    return {
      ...base,
      mode: 'external-preview-sandbox',
      warnings: [
        ...normalizedMode.warnings,
        '闲鱼订单同步仅生成沙盒预览，不会发送沙盒或真实 HTTP 请求。',
        '买家、卖家、商品标题、地址、电话、cookie、session、token 和 API key 字段会在预览持久化前脱敏。',
      ],
      blockers: [],
      impact: buildExternalImpact(operationPolicy, mode),
      requestPayloadPreview,
      sanitizedRequestPayload: requestPayloadPreview,
      mockWaybillPreview: null,
      mockDepositPreview: null,
      mockXianyuSyncPreview: null,
      sandboxPayloadPreview: buildXianyuSandboxPayloadPreview(requestPayloadPreview),
    }
  }

  return {
    ...base,
    code: 'SAFE_OP_EXTERNAL_DISABLED',
    mode: mode === 'real' ? 'external-preview-real-disabled' : 'external-preview-disabled',
    warnings: [
      ...normalizedMode.warnings,
      '外部网关默认关闭。',
      '闲鱼真实同步未开放。',
    ],
    blockers: [
      mode === 'real'
        ? '闲鱼真实模式已关闭。'
        : '外部网关当前关闭。',
      '该操作不开放外部真实执行。',
    ],
    impact: buildExternalImpact(operationPolicy, mode),
    requestPayloadPreview: buildXianyuRequestPayloadPreview(payload, 'disabled', operationPolicy),
    sanitizedRequestPayload: buildXianyuRequestPayloadPreview(payload, 'disabled', operationPolicy),
    mockWaybillPreview: null,
    mockDepositPreview: null,
    mockXianyuSyncPreview: null,
    sandboxPayloadPreview: null,
  }
}

function buildDepositOperationPreview(operationInput, operationPolicy, provider) {
  const normalizedMode = normalizeMode(operationInput, provider, operationPolicy)
  const mode = normalizedMode.mode
  const payload = operationInput.payload || {}
  const action = operationPolicy.externalAction || 'create'
  const gateway = buildExternalGatewayDescriptor(operationPolicy, provider, mode)
  const base = {
    ok: true,
    supported: true,
    operationType: operationPolicy.operationType,
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: operationPolicy.riskLevel,
    expectedExternalAction: action,
    realExecutionBlocked: true,
    externalPreviewMode: mode,
    externalGateway: gateway,
    externalAudit: {
      ...buildExternalAuditShape(operationPolicy),
      status: mode === 'mock' || mode === 'sandbox' ? 'previewed' : 'blocked',
    },
    externalIdempotency: {
      ...buildExternalIdempotencyShape(operationPolicy),
      status: mode === 'mock' || mode === 'sandbox' ? 'previewed' : 'blocked',
    },
  }

  if (mode === 'mock') {
    const requestPayloadPreview = buildDepositRequestPayloadPreview(payload, mode, operationPolicy)
    return {
      ...base,
      mode: 'external-preview-mock',
      warnings: [
        ...normalizedMode.warnings,
        '免押服务仅生成模拟预览，不会发送外部请求。',
        '客户、身份和支付相关敏感字段会在预览持久化前脱敏。',
      ],
      blockers: [],
      impact: buildExternalImpact(operationPolicy, mode),
      requestPayloadPreview,
      mockWaybillPreview: null,
      mockDepositPreview: buildMockDepositPreview(requestPayloadPreview, operationPolicy),
      sandboxPayloadPreview: null,
    }
  }

  if (mode === 'sandbox') {
    const requestPayloadPreview = buildDepositRequestPayloadPreview(payload, mode, operationPolicy)
    return {
      ...base,
      mode: 'external-preview-sandbox',
      warnings: [
        ...normalizedMode.warnings,
        '免押服务仅生成沙盒预览，不会发送沙盒或真实 HTTP 请求。',
        '客户、身份和支付相关敏感字段会在预览持久化前脱敏。',
      ],
      blockers: [],
      impact: buildExternalImpact(operationPolicy, mode),
      requestPayloadPreview,
      mockWaybillPreview: null,
      mockDepositPreview: null,
      sandboxPayloadPreview: buildDepositSandboxPayloadPreview(requestPayloadPreview),
    }
  }

  return {
    ...base,
    code: 'SAFE_OP_EXTERNAL_DISABLED',
    mode: mode === 'real' ? 'external-preview-real-disabled' : 'external-preview-disabled',
    warnings: [
      ...normalizedMode.warnings,
      '外部网关默认关闭。',
      '免押真实操作未开放。',
    ],
    blockers: [
      mode === 'real'
        ? '免押真实模式已关闭。'
        : '外部网关当前关闭。',
      '该操作不开放外部真实执行。',
    ],
    impact: buildExternalImpact(operationPolicy, mode),
    requestPayloadPreview: buildDepositRequestPayloadPreview(payload, 'disabled', operationPolicy),
    mockWaybillPreview: null,
    mockDepositPreview: null,
    sandboxPayloadPreview: null,
  }
}

function buildSfCreateOrderPreview(operationInput, operationPolicy, provider) {
  const normalizedMode = normalizeMode(operationInput, provider, operationPolicy)
  const mode = normalizedMode.mode
  const payload = operationInput.payload || {}
  const gateway = buildExternalGatewayDescriptor(operationPolicy, provider, mode)
  const base = {
    ok: true,
    supported: true,
    operationType: operationPolicy.operationType,
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: operationPolicy.riskLevel,
    expectedExternalAction: 'create_order',
    realExecutionBlocked: true,
    externalPreviewMode: mode,
    externalGateway: gateway,
    externalAudit: {
      ...buildExternalAuditShape(operationPolicy),
      status: mode === 'mock' || mode === 'sandbox' ? 'previewed' : 'blocked',
    },
    externalIdempotency: {
      ...buildExternalIdempotencyShape(operationPolicy),
      status: mode === 'mock' || mode === 'sandbox' ? 'previewed' : 'blocked',
    },
  }

  if (mode === 'mock') {
    const requestPayloadPreview = buildSfRequestPayloadPreview(payload, mode)
    return {
      ...base,
      mode: 'external-preview-mock',
      warnings: [
        ...normalizedMode.warnings,
        '顺丰仅生成模拟预览，不会发送外部请求。',
        '寄件人和收件人敏感字段会在预览持久化前脱敏。',
      ],
      blockers: [],
      impact: buildExternalImpact(operationPolicy, mode),
      requestPayloadPreview,
      mockWaybillPreview: buildMockWaybillPreview(requestPayloadPreview),
      sandboxPayloadPreview: null,
    }
  }

  if (mode === 'sandbox') {
    const requestPayloadPreview = buildSfRequestPayloadPreview(payload, mode)
    return {
      ...base,
      mode: 'external-preview-sandbox',
      warnings: [
        ...normalizedMode.warnings,
        '顺丰仅生成沙盒预览，不会发送沙盒或真实 HTTP 请求。',
        '寄件人和收件人敏感字段会在预览持久化前脱敏。',
      ],
      blockers: [],
      impact: buildExternalImpact(operationPolicy, mode),
      requestPayloadPreview,
      mockWaybillPreview: null,
      sandboxPayloadPreview: buildSandboxPayloadPreview(requestPayloadPreview),
    }
  }

  return {
    ...base,
    code: 'SAFE_OP_EXTERNAL_DISABLED',
    mode: mode === 'real' ? 'external-preview-real-disabled' : 'external-preview-disabled',
    warnings: [
      ...normalizedMode.warnings,
      '外部网关默认关闭。',
      '顺丰真实下单未开放。',
    ],
    blockers: [
      mode === 'real'
        ? '顺丰真实模式已关闭。'
        : '外部网关当前关闭。',
      '该操作不开放外部真实执行。',
    ],
    impact: buildExternalImpact(operationPolicy, mode),
    requestPayloadPreview: buildSfRequestPayloadPreview(payload, 'disabled'),
    mockWaybillPreview: null,
    sandboxPayloadPreview: null,
  }
}

function previewExternalOperation(operationInput = {}) {
  const operationType = normalizeText(operationInput.operationType)
  const operationPolicy = getExternalOperationPolicy(operationType)
  if (!operationPolicy) return buildUnsupportedExternalOperation(operationType)

  const provider = operationPolicy.provider || {}
  if (operationType === 'logistics.sf.create_order') {
    return buildSfCreateOrderPreview(operationInput, operationPolicy, provider)
  }
  if (operationType === 'deposit.create' || operationType === 'deposit.finish') {
    return buildDepositOperationPreview(operationInput, operationPolicy, provider)
  }
  if (operationType === 'xianyu.order.sync') {
    return buildXianyuOrderSyncPreview(operationInput, operationPolicy, provider)
  }

  return {
    ok: true,
    supported: true,
    operationType,
    mode: 'external-preview-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: operationPolicy.riskLevel,
    warnings: [
      '外部网关默认关闭。',
      '该外部操作尚未开放模拟、沙盒或真实执行。',
    ],
    blockers: [
      '外部真实调用已关闭。',
      '该操作不开放外部真实执行。',
    ],
    impact: buildExternalImpact(operationPolicy),
    externalGateway: buildExternalGatewayDescriptor(operationPolicy, provider, provider.currentMode || 'disabled'),
    externalAudit: buildExternalAuditShape(operationPolicy),
    externalIdempotency: buildExternalIdempotencyShape(operationPolicy),
  }
}

function executeExternalOperation(operationInput = {}) {
  const operationType = normalizeText(operationInput.operationType)
  const operationPolicy = getExternalOperationPolicy(operationType)
  if (!operationPolicy) return buildUnsupportedExternalOperation(operationType)

  const provider = operationPolicy.provider || {}
  return {
    ok: false,
    supported: true,
    code: 'SAFE_OP_EXTERNAL_DISABLED',
    message: '外部真实执行默认关闭，本次没有发起外部调用。',
    operationType,
    mode: 'external-execute-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: operationPolicy.riskLevel,
    warnings: [],
    blockers: [
      '外部写入已关闭。',
      '真实模式需要单独策略、凭证、幂等、审计、补偿和用户确认。',
    ],
    impact: buildExternalImpact(operationPolicy),
    externalGateway: {
      providerName: operationPolicy.providerName,
      providerStatus: provider.status || 'disabled',
      currentMode: normalizeText(operationInput.mode || operationInput.payload?.mode || provider.currentMode || 'disabled') || 'disabled',
      realEnabled: false,
      sandboxEnabled: Boolean(provider.sandboxEnabled),
      mockEnabled: Boolean(provider.mockEnabled),
      externalWritesEnabled: false,
      externalCallWillExecute: false,
      compensationRequired: Boolean(provider.compensationRequired),
    },
    audit: {
      mode: 'noop',
      persisted: false,
      status: 'blocked',
    },
    externalAudit: buildExternalAuditShape(operationPolicy),
    externalIdempotency: buildExternalIdempotencyShape(operationPolicy),
    rollback: {
      mode: 'noop',
      planned: false,
      canRollback: false,
      compensationRequired: Boolean(provider.compensationRequired),
      status: 'unavailable',
      reason: 'external-execute-disabled-no-call-made',
    },
  }
}

module.exports = {
  executeExternalOperation,
  getExternalPolicy,
  previewExternalOperation,
}
