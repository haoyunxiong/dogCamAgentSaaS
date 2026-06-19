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
    ? 'mock preview'
    : (mode === 'sandbox' ? 'sandbox payload preview' : 'disabled preview')
  return {
    summary: `${operationPolicy.operationType} ${modeLabel}: real external action "${operationPolicy.externalAction || 'external_write'}" is disabled. No external request, shipping record write, order status update, schedule change, or fee charge will run.`,
    affectedRecords: [],
    externalEffects: [],
  }
}

function normalizeMode(operationInput = {}, provider = {}, operationPolicy = {}) {
  const requestedMode = normalizeText(operationInput.mode || operationInput.payload?.mode || provider.currentMode || DEFAULT_EXTERNAL_MODE)
  if (!EXTERNAL_MODES.includes(requestedMode)) {
    return {
      mode: DEFAULT_EXTERNAL_MODE,
      warnings: [`Unsupported external gateway mode "${requestedMode}" was downgraded to disabled.`],
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
      warnings: [`External gateway mode "${requestedMode}" is not allowed for preview and was downgraded to disabled.`],
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
        'SF Express mock preview only. No external request will be sent.',
        'Sensitive sender/receiver fields are redacted before preview persistence.',
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
        'SF Express sandbox payload preview only. No sandbox or real HTTP request will be sent.',
        'Sensitive sender/receiver fields are redacted before preview persistence.',
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
      'External gateway is disabled by default.',
      'SF Express real order creation is not open.',
    ],
    blockers: [
      mode === 'real'
        ? 'Real mode is disabled for SF Express create order.'
        : 'External gateway mode is disabled.',
      'External execute is not implemented for this operationType.',
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

  return {
    ok: true,
    supported: true,
    operationType,
    mode: 'external-preview-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: operationPolicy.riskLevel,
    warnings: [
      'External gateway is disabled by default.',
      'Mock, sandbox, and real external execution are not open in Phase 3A.',
    ],
    blockers: [
      'External real call is disabled.',
      'External execute is not implemented for this operationType.',
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
    message: 'External gateway real execution is disabled by default. No external call was made.',
    operationType,
    mode: 'external-execute-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: operationPolicy.riskLevel,
    warnings: [],
    blockers: [
      'External writes are disabled.',
      'Real mode requires separate policy, credentials, idempotency, audit, compensation, and user confirmation.',
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
