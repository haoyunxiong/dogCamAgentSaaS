import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'

const SAFE_OPS_MODE = 'dry-run-only'
const EXECUTE_DISABLED_POLICY = Object.freeze({
  enabled: false,
  code: 'SAFE_OP_EXECUTE_DISABLED',
  writeWillExecute: false,
  externalCallWillExecute: false,
})
const EXTERNAL_EXECUTE_DISABLED_POLICY = Object.freeze({
  enabled: false,
  code: 'SAFE_OP_EXTERNAL_DISABLED',
  writeWillExecute: false,
  externalCallWillExecute: false,
})
const EXTERNAL_OPERATION_TYPES = Object.freeze([
  'logistics.sf.create_order',
  'logistics.sf.cancel_order',
  'deposit.create',
  'deposit.finish',
  'xianyu.order.sync',
])

const SAFE_OP_POLICIES = Object.freeze([
  { operationType: 'order.internal_note.update', domain: 'Orders', riskLevel: 'low', requiresExternalCredential: false, allowExecute: true },
  { operationType: 'device.basic.update', domain: 'Devices', riskLevel: 'medium-low', requiresExternalCredential: false, allowExecute: true, allowedFields: ['city', 'note', 'status'] },
  { operationType: 'schedule.block.create', domain: 'Schedule', riskLevel: 'medium-high', requiresExternalCredential: false, allowExecute: true },
  { operationType: 'schedule.block.cancel', domain: 'Schedule', riskLevel: 'medium', requiresExternalCredential: false, allowExecute: true },
  { operationType: 'logistics.local_record.create', domain: 'Logistics', riskLevel: 'medium', requiresExternalCredential: false, allowExecute: true },
  { operationType: 'order.status.transition.preview', domain: 'Orders', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'order.edit.preview', domain: 'Orders', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'device.update.preview', domain: 'Devices', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'device.delete.preview', domain: 'Devices', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'schedule.block.preview', domain: 'Schedule', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'logistics.shipment.preview', domain: 'Logistics', riskLevel: 'critical', requiresExternalCredential: true },
  { operationType: 'deposit.create.preview', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true },
  { operationType: 'deposit.finish.preview', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true },
  { operationType: 'logistics.sf.create_order', domain: 'Logistics', riskLevel: 'critical', requiresExternalCredential: true, providerName: 'sf_express', gatewayStatus: 'disabled' },
  { operationType: 'logistics.sf.cancel_order', domain: 'Logistics', riskLevel: 'critical', requiresExternalCredential: true, providerName: 'sf_express', gatewayStatus: 'disabled' },
  { operationType: 'deposit.create', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true, providerName: 'deposit_service', gatewayStatus: 'disabled' },
  { operationType: 'deposit.finish', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true, providerName: 'deposit_service', gatewayStatus: 'disabled' },
  { operationType: 'xianyu.order.sync', domain: 'Orders', riskLevel: 'critical', requiresExternalCredential: true, providerName: 'xianyu_platform', gatewayStatus: 'disabled' },
])

const POLICY_BY_OPERATION = new Map(SAFE_OP_POLICIES.map((policy) => [policy.operationType, policy]))

const LOCAL_PREVIEW_SUMMARIES = Object.freeze({
  'order.internal_note.update': 'Renderer noop internal note preview. Real local write requires Electron safeOps execute and will not call external services.',
  'device.basic.update': 'Renderer noop device basic update preview. Real local write requires Electron safeOps execute and will only update city, note, status.',
  'schedule.block.create': 'Renderer noop schedule block create preview. Real local write requires Electron safeOps execute and will only insert one local schedule block.',
  'schedule.block.cancel': 'Renderer noop schedule block cancel preview. Real local write requires Electron safeOps execute and will only soft-cancel one local schedule block.',
  'logistics.local_record.create': 'Renderer noop local logistics record preview. Real local write requires Electron safeOps execute and will only insert one local shipping_records row.',
  'order.status.transition.preview': 'Renderer noop order status preview. This is dry-run only and will not change order state, schedule, logistics, or notifications.',
  'order.edit.preview': 'Renderer noop order edit preview. This is dry-run only and will not change order fields, fees, devices, schedule, or logistics.',
  'device.update.preview': 'Renderer noop device update preview. This is dry-run only and will not change device profile, inventory, or availability.',
  'device.delete.preview': 'Renderer noop device delete preview. This is dry-run only and will not delete device data, schedule blocks, or order relations.',
  'schedule.block.preview': 'Renderer noop schedule block preview. This is dry-run only and will not write schedule data or lock inventory.',
  'logistics.shipment.preview': 'Renderer noop shipment preview. This is dry-run only and will not save shipment drafts, create waybills, charge fees, or call carrier services.',
  'deposit.create.preview': 'Renderer noop deposit create preview. This is dry-run only and will not create deposit orders or change local cache.',
  'deposit.finish.preview': 'Renderer noop deposit finish preview. This is dry-run only and will not finish deposit orders or change local cache.',
  'logistics.sf.create_order': 'External gateway disabled. SF Express real order creation is not open and no external call will run.',
  'logistics.sf.cancel_order': 'External gateway disabled. SF Express real cancellation is not open and no external call will run.',
  'deposit.create': 'External gateway disabled. Deposit real creation is not open and no external call will run.',
  'deposit.finish': 'External gateway disabled. Deposit real finish is not open and no external call will run.',
  'xianyu.order.sync': 'External gateway disabled. Xianyu real order sync is not open and no external call will run.',
})

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeOperationType(operationType) {
  return String(operationType || '').trim()
}

function normalizeExternalMode(value) {
  const mode = String(value || 'disabled').trim()
  return ['disabled', 'mock', 'sandbox', 'real'].includes(mode) ? mode : 'disabled'
}

function maskName(value) {
  const text = String(value || '').trim()
  if (!text) return null
  return {
    hasValue: true,
    length: text.length,
    preview: text.length <= 1 ? '*' : `${text.slice(0, 1)}*`,
  }
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length < 7) return '<redacted-phone>'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function maskAddress(value, city = '') {
  const text = String(value || '').trim()
  return {
    hasValue: Boolean(text),
    length: text.length,
    city: String(city || '').trim() || null,
    preview: text ? '<redacted-address>' : null,
  }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function buildLocalSfRequestPayloadPreview(payload = {}, mode = 'mock') {
  const packagePayload = payload.package && typeof payload.package === 'object' ? payload.package : {}
  const servicePayload = payload.service && typeof payload.service === 'object' ? payload.service : {}
  const senderCity = String(payload.senderCity || payload.shipFromCity || '').trim()
  const receiverCity = String(payload.receiverCity || payload.shipToCity || '').trim()
  return {
    providerName: 'sf_express',
    operationType: 'logistics.sf.create_order',
    externalAction: 'create_order',
    mode,
    realRequestWillBeSent: false,
    order: {
      orderId: String(payload.orderId || payload.order_id || '').trim() || null,
      shipmentId: String(payload.shipmentId || payload.shipment_id || '').trim() || null,
      modelCode: String(payload.modelCode || payload.model_code || '').trim() || null,
    },
    sender: {
      contactName: maskName(payload.senderName || payload.senderContactName),
      phoneMasked: maskPhone(payload.senderPhone || payload.sender_phone),
      city: senderCity || null,
      address: maskAddress(payload.senderAddress || payload.sender_address, senderCity),
    },
    receiver: {
      contactName: maskName(payload.receiverName || payload.receiverContactName || payload.contactName),
      phoneMasked: maskPhone(payload.receiverPhone || payload.receiver_phone || payload.phone),
      city: receiverCity || null,
      address: maskAddress(payload.receiverAddress || payload.receiver_address || payload.address, receiverCity),
    },
    package: {
      weightKg: numberOrNull(packagePayload.weightKg || packagePayload.weight_kg || payload.weightKg || payload.weight_kg),
      quantity: numberOrNull(packagePayload.quantity || packagePayload.count || payload.quantity || payload.packageCount) || 1,
      goodsType: String(packagePayload.goodsType || packagePayload.goods_type || payload.goodsType || 'rental_device').trim(),
      insuredAmount: numberOrNull(packagePayload.insuredAmount || packagePayload.insured_amount || payload.insuredAmount || payload.insured_amount),
    },
    service: {
      productCode: String(servicePayload.productCode || servicePayload.product_code || payload.productCode || 'sf_standard').trim(),
      payMethod: String(servicePayload.payMethod || servicePayload.pay_method || payload.payMethod || 'monthly_settlement_preview').trim(),
      remark: payload.remark ? '<redacted-remark>' : null,
    },
  }
}

function buildLocalSfMockWaybillPreview(payloadPreview = {}) {
  const orderId = payloadPreview.order?.orderId || 'preview'
  const seed = Array.from(String(orderId)).reduce((total, char) => total + char.charCodeAt(0), 0)
  return {
    waybillNo: `SFMOCK${String(seed).padStart(8, '0')}`,
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

function buildLocalSfSandboxPayloadPreview(payloadPreview = {}) {
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

function maskIdentity(value) {
  const text = String(value || '').trim()
  return {
    hasValue: Boolean(text),
    length: text.length,
    preview: text ? '<redacted-identity>' : null,
  }
}

function maskAccount(value) {
  const text = String(value || '').trim()
  if (!text) return null
  if (text.length <= 4) return '<redacted-account>'
  return `${text.slice(0, 2)}***${text.slice(-2)}`
}

function buildLocalDepositRequestPayloadPreview(payload = {}, mode = 'mock', operationType = 'deposit.create') {
  const servicePayload = payload.service && typeof payload.service === 'object' ? payload.service : {}
  const finishPayload = payload.finish && typeof payload.finish === 'object' ? payload.finish : {}
  const externalAction = operationType === 'deposit.finish' ? 'finish' : 'create'
  return {
    providerName: 'deposit_service',
    operationType,
    externalAction,
    mode,
    realRequestWillBeSent: false,
    order: {
      orderId: String(payload.orderId || payload.order_id || '').trim() || null,
      orderNo: String(payload.orderNo || payload.order_no || '').trim() || null,
      reviewId: String(payload.reviewId || payload.review_id || '').trim() || null,
      modelCode: String(payload.modelCode || payload.model_code || '').trim() || null,
    },
    deposit: {
      depositOrderId: String(payload.depositOrderId || payload.deposit_order_id || '').trim() || null,
      requestedFreeAmount: numberOrNull(payload.requestedFreeAmount || payload.requested_free_amount),
      depositAmount: numberOrNull(payload.depositAmount || payload.deposit_amount),
      currency: String(payload.currency || 'CNY').trim() || 'CNY',
      riskLevel: String(payload.riskLevel || payload.risk_level || '').trim() || null,
      reviewStatus: String(payload.reviewStatus || payload.review_status || '').trim() || null,
      depositStatus: String(payload.depositStatus || payload.deposit_status || '').trim() || null,
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
      reason: String(finishPayload.reason || payload.finishReason || payload.finish_reason || payload.reason || '').trim() || null,
      requestedStatus: String(finishPayload.status || payload.finishStatus || payload.finish_status || 'finish_preview').trim() || 'finish_preview',
      shouldReleaseDeposit: false,
      shouldNotifyExternalService: false,
    },
    service: {
      appIdMasked: maskAccount(servicePayload.appId || payload.appId || payload.app_id),
      productCode: String(servicePayload.productCode || servicePayload.product_code || payload.productCode || 'deposit_free_preview').trim(),
      scenario: String(servicePayload.scenario || payload.scenario || 'rental_deposit_free_preview').trim(),
      remark: payload.remark ? '<redacted-remark>' : null,
    },
  }
}

function buildLocalDepositMockPreview(payloadPreview = {}) {
  const seedSource = `${payloadPreview.operationType}:${payloadPreview.order?.orderId || payloadPreview.order?.orderNo || 'preview'}:${payloadPreview.deposit?.requestedFreeAmount || ''}`
  const seed = Array.from(seedSource).reduce((total, char) => total + char.charCodeAt(0), 0)
  const action = payloadPreview.externalAction || 'create'
  return {
    mockDepositNo: `DEPMOCK${String(seed).padStart(8, '0')}`,
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

function buildLocalDepositSandboxPayloadPreview(payloadPreview = {}) {
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

function getSafeOpsBridge() {
  if (isUiV2PreviewMode()) return null
  if (!hasUiV2RuntimeBridge()) return null

  const safeOps = window.electronAPI?.safeOps
  if (!safeOps || typeof safeOps.getPolicy !== 'function' || typeof safeOps.preview !== 'function') {
    return null
  }

  return safeOps
}

function buildLocalPolicy() {
  return {
    ok: true,
    mode: 'policy',
    safeMode: SAFE_OPS_MODE,
    writeEnabled: false,
    externalWritesEnabled: false,
    operations: cloneJson(SAFE_OP_POLICIES).map((policy) => ({
      ...policy,
      allowPreview: true,
      allowWrite: Boolean(policy.allowExecute),
      allowExecute: Boolean(policy.allowExecute),
      requiresDbMigrationForWrite: !policy.allowExecute,
      requiresUserConfirmationForWrite: true,
    })),
    audit: { mode: 'noop', persisted: false },
    confirmToken: { enabled: false, requiredForWrite: true, persisted: false },
    idempotency: { mode: 'noop', requiredForWrite: true, persisted: false },
    execute: cloneJson(EXECUTE_DISABLED_POLICY),
    external: {
      ok: true,
      mode: 'external-policy',
      defaultMode: 'disabled',
      modes: ['disabled', 'mock', 'sandbox', 'real'],
      realEnabled: false,
      externalWritesEnabled: false,
      providers: [
        { providerName: 'sf_express', currentMode: 'disabled', realEnabled: false, sandboxEnabled: true, mockEnabled: true, externalWritesEnabled: false, status: 'disabled', previewModes: ['disabled', 'mock', 'sandbox'] },
        { providerName: 'deposit_service', currentMode: 'disabled', realEnabled: false, sandboxEnabled: true, mockEnabled: true, externalWritesEnabled: false, status: 'disabled', previewModes: ['disabled', 'mock', 'sandbox'] },
        { providerName: 'xianyu_platform', currentMode: 'disabled', realEnabled: false, externalWritesEnabled: false, status: 'disabled' },
      ],
    },
    persistence: { mode: 'noop', available: false, reason: 'renderer-preview-no-bridge' },
    source: 'renderer-noop',
  }
}

function buildUnsupportedPreview(operationType) {
  const normalizedOperationType = normalizeOperationType(operationType)
  return {
    ok: false,
    supported: false,
    code: 'SAFE_OP_UNSUPPORTED',
    message: normalizedOperationType
      ? `Unsupported safe operation: ${normalizedOperationType}`
      : 'Unsupported safe operation: operationType is required',
  }
}

function buildLocalPreview(payload = {}) {
  const operationType = normalizeOperationType(payload.operationType)
  const policy = POLICY_BY_OPERATION.get(operationType)

  if (!policy) return buildUnsupportedPreview(operationType)
  const isExternalOperation = EXTERNAL_OPERATION_TYPES.includes(operationType)
  if (operationType === 'logistics.sf.create_order') {
    const mode = normalizeExternalMode(payload.payload?.mode)
    const requestPayloadPreview = buildLocalSfRequestPayloadPreview(payload.payload || {}, mode)
    const externalPreviewOpen = mode === 'mock' || mode === 'sandbox'
    return {
      ok: true,
      supported: true,
      operationType,
      code: externalPreviewOpen ? undefined : 'SAFE_OP_EXTERNAL_DISABLED',
      mode: externalPreviewOpen
        ? `external-preview-${mode}`
        : (mode === 'real' ? 'external-preview-real-disabled' : 'external-preview-disabled'),
      writeWillExecute: false,
      externalCallWillExecute: false,
      riskLevel: policy.riskLevel,
      warnings: externalPreviewOpen
        ? ['Renderer SF Express preview only. No external request will be sent.']
        : ['External gateway is disabled by default.', 'SF Express real order creation is not open.'],
      blockers: externalPreviewOpen
        ? []
        : [
            mode === 'real' ? 'Real mode is disabled for SF Express create order.' : 'External gateway mode is disabled.',
            'External execute is not implemented for this operationType.',
          ],
      impact: {
        summary: externalPreviewOpen
          ? `Renderer SF Express ${mode} preview. No waybill will be created and no external service will be called.`
          : 'Renderer SF Express preview is disabled. No waybill will be created and no external service will be called.',
        affectedRecords: [],
        externalEffects: [],
      },
      audit: {
        mode: 'noop',
        persisted: false,
        operationId: null,
        payloadHash: null,
        impactHash: null,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
      },
      persistence: { mode: 'noop', available: false, reason: 'renderer-preview-no-bridge' },
      requiresConfirm: true,
      requiresIdempotencyKey: true,
      execute: cloneJson(EXTERNAL_EXECUTE_DISABLED_POLICY),
      externalGateway: {
        providerName: policy.providerName,
        currentMode: mode,
        realEnabled: false,
        sandboxEnabled: true,
        mockEnabled: true,
        externalWritesEnabled: false,
        externalCallWillExecute: false,
        providerStatus: 'disabled',
        compensationRequired: true,
      },
      externalAudit: {
        mode: 'external-audit-shape',
        required: true,
        persisted: false,
        providerName: policy.providerName,
        operationType,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
      },
      externalIdempotency: {
        mode: 'external-idempotency-shape',
        required: true,
        persisted: false,
        providerName: policy.providerName,
        operationType,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
      },
      expectedExternalAction: 'create_order',
      externalPreviewMode: mode,
      realExecutionBlocked: true,
      requestPayloadPreview,
      mockWaybillPreview: mode === 'mock' ? buildLocalSfMockWaybillPreview(requestPayloadPreview) : null,
      sandboxPayloadPreview: mode === 'sandbox' ? buildLocalSfSandboxPayloadPreview(requestPayloadPreview) : null,
      confirmToken: null,
      confirmRequirement: {
        enabled: false,
        required: true,
        persisted: false,
        token: null,
        tokenHash: null,
        expiresAt: null,
        reason: externalPreviewOpen ? 'renderer-preview-no-bridge' : 'renderer-preview-execute-disabled',
      },
      idempotency: {
        mode: 'noop',
        required: true,
        persisted: false,
        keyHash: null,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
        reason: 'renderer-preview-no-bridge',
      },
      rollback: {
        mode: 'noop',
        planned: externalPreviewOpen,
        persisted: false,
        canRollback: false,
        compensationRequired: true,
        reason: 'renderer-preview-no-write-executed',
      },
      source: 'renderer-noop',
    }
  }
  if (operationType === 'deposit.create' || operationType === 'deposit.finish') {
    const mode = normalizeExternalMode(payload.payload?.mode)
    const requestPayloadPreview = buildLocalDepositRequestPayloadPreview(payload.payload || {}, mode, operationType)
    const externalPreviewOpen = mode === 'mock' || mode === 'sandbox'
    const action = operationType === 'deposit.finish' ? 'finish' : 'create'
    return {
      ok: true,
      supported: true,
      operationType,
      code: externalPreviewOpen ? undefined : 'SAFE_OP_EXTERNAL_DISABLED',
      mode: externalPreviewOpen
        ? `external-preview-${mode}`
        : (mode === 'real' ? 'external-preview-real-disabled' : 'external-preview-disabled'),
      writeWillExecute: false,
      externalCallWillExecute: false,
      riskLevel: policy.riskLevel,
      warnings: externalPreviewOpen
        ? [`Renderer deposit service ${action} preview only. No external request will be sent.`]
        : ['External gateway is disabled by default.', `Deposit service ${action} real operation is not open.`],
      blockers: externalPreviewOpen
        ? []
        : [
            mode === 'real' ? `Real mode is disabled for deposit service ${action}.` : 'External gateway mode is disabled.',
            'External execute is not implemented for this operationType.',
          ],
      impact: {
        summary: externalPreviewOpen
          ? `Renderer deposit service ${action} ${mode} preview. No deposit order will be created or finished and no external service will be called.`
          : `Renderer deposit service ${action} preview is disabled. No deposit order will be created or finished and no external service will be called.`,
        affectedRecords: [],
        externalEffects: [],
      },
      audit: {
        mode: 'noop',
        persisted: false,
        operationId: null,
        payloadHash: null,
        impactHash: null,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
      },
      persistence: { mode: 'noop', available: false, reason: 'renderer-preview-no-bridge' },
      requiresConfirm: true,
      requiresIdempotencyKey: true,
      execute: cloneJson(EXTERNAL_EXECUTE_DISABLED_POLICY),
      externalGateway: {
        providerName: policy.providerName,
        currentMode: mode,
        realEnabled: false,
        sandboxEnabled: true,
        mockEnabled: true,
        externalWritesEnabled: false,
        externalCallWillExecute: false,
        providerStatus: 'disabled',
        compensationRequired: true,
      },
      externalAudit: {
        mode: 'external-audit-shape',
        required: true,
        persisted: false,
        providerName: policy.providerName,
        operationType,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
      },
      externalIdempotency: {
        mode: 'external-idempotency-shape',
        required: true,
        persisted: false,
        providerName: policy.providerName,
        operationType,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
      },
      expectedExternalAction: action,
      externalPreviewMode: mode,
      realExecutionBlocked: true,
      requestPayloadPreview,
      mockWaybillPreview: null,
      mockDepositPreview: mode === 'mock' ? buildLocalDepositMockPreview(requestPayloadPreview) : null,
      sandboxPayloadPreview: mode === 'sandbox' ? buildLocalDepositSandboxPayloadPreview(requestPayloadPreview) : null,
      confirmToken: null,
      confirmRequirement: {
        enabled: false,
        required: true,
        persisted: false,
        token: null,
        tokenHash: null,
        expiresAt: null,
        reason: externalPreviewOpen ? 'renderer-preview-no-bridge' : 'renderer-preview-execute-disabled',
      },
      idempotency: {
        mode: 'noop',
        required: true,
        persisted: false,
        keyHash: null,
        status: externalPreviewOpen ? 'previewed' : 'blocked',
        reason: 'renderer-preview-no-bridge',
      },
      rollback: {
        mode: 'noop',
        planned: externalPreviewOpen,
        persisted: false,
        canRollback: false,
        compensationRequired: true,
        reason: 'renderer-preview-no-write-executed',
      },
      source: 'renderer-noop',
    }
  }

  return {
    ok: true,
    supported: true,
    operationType,
    mode: 'dry-run',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: isExternalOperation ? ['External gateway is disabled by default.'] : [],
    blockers: isExternalOperation ? ['External real call is disabled.', 'External execute is not implemented for this operationType.'] : [],
    impact: {
      summary: LOCAL_PREVIEW_SUMMARIES[operationType] || 'Renderer noop safeOps preview. This action is dry-run only and will not write data or call external services.',
      affectedRecords: [],
      externalEffects: [],
    },
    audit: {
      mode: 'noop',
      persisted: false,
      operationId: null,
      payloadHash: null,
      impactHash: null,
      status: 'previewed',
    },
    persistence: { mode: 'noop', available: false, reason: 'renderer-preview-no-bridge' },
    requiresConfirm: true,
    requiresIdempotencyKey: true,
    execute: cloneJson(isExternalOperation ? EXTERNAL_EXECUTE_DISABLED_POLICY : EXECUTE_DISABLED_POLICY),
    externalGateway: isExternalOperation
      ? {
          providerName: policy.providerName,
          currentMode: 'disabled',
          realEnabled: false,
          sandboxEnabled: false,
          mockEnabled: false,
          externalWritesEnabled: false,
          externalCallWillExecute: false,
          providerStatus: 'disabled',
          compensationRequired: true,
        }
      : null,
    externalAudit: isExternalOperation
      ? {
          mode: 'external-audit-shape',
          required: true,
          persisted: false,
          providerName: policy.providerName,
          operationType,
          status: 'blocked',
        }
      : null,
    externalIdempotency: isExternalOperation
      ? {
          mode: 'external-idempotency-shape',
          required: true,
          persisted: false,
          providerName: policy.providerName,
          operationType,
          status: 'blocked',
        }
      : null,
    confirmToken: null,
    confirmRequirement: {
      enabled: false,
      required: true,
      persisted: false,
      token: null,
      tokenHash: null,
      expiresAt: null,
      reason: 'renderer-preview-execute-disabled',
    },
    idempotency: {
      mode: 'noop',
      required: true,
      persisted: false,
      keyHash: null,
      status: 'not-claimed',
      reason: 'renderer-preview-execute-disabled',
    },
    rollback: {
      mode: 'noop',
      planned: false,
      persisted: false,
      canRollback: false,
      compensationRequired: false,
      reason: 'no-write-executed',
    },
    source: 'renderer-noop',
  }
}

function buildLocalExecuteDisabled(operationType) {
  const normalizedOperationType = normalizeOperationType(operationType)
  const isExternalOperation = EXTERNAL_OPERATION_TYPES.includes(normalizedOperationType)
  return {
    ok: false,
    supported: true,
    code: isExternalOperation ? 'SAFE_OP_EXTERNAL_DISABLED' : 'SAFE_OP_EXECUTE_DISABLED',
    message: isExternalOperation
      ? 'External gateway real execution is disabled. No external call will run.'
      : 'safeOps execute is unavailable in renderer preview mode.',
    operationType: normalizedOperationType,
    mode: isExternalOperation ? 'external-execute-disabled' : 'execute-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
    externalGateway: isExternalOperation
      ? {
          currentMode: 'disabled',
          realEnabled: false,
          externalWritesEnabled: false,
          externalCallWillExecute: false,
        }
      : null,
    rollback: {
      mode: 'noop',
      planned: false,
      persisted: false,
      canRollback: false,
      compensationRequired: false,
      reason: 'renderer-preview-no-execute',
    },
    source: 'renderer-noop',
  }
}

function buildSafeError(code, message) {
  return {
    ok: false,
    supported: false,
    code,
    message: message || 'safeOps request failed safely',
  }
}

async function getPolicy(payload = {}) {
  try {
    const bridge = getSafeOpsBridge()
    if (!bridge) return buildLocalPolicy()

    const result = await bridge.getPolicy(payload || {})
    return result && typeof result === 'object' ? result : buildLocalPolicy()
  } catch (error) {
    return buildSafeError('SAFE_OP_POLICY_ERROR', error?.message)
  }
}

async function preview(payload = {}) {
  try {
    const bridge = getSafeOpsBridge()
    if (!bridge) return buildLocalPreview(payload || {})

    const result = await bridge.preview(payload || {})
    return result && typeof result === 'object'
      ? result
      : buildSafeError('SAFE_OP_PREVIEW_ERROR', 'safeOps preview returned an invalid response')
  } catch (error) {
    return buildSafeError('SAFE_OP_PREVIEW_ERROR', error?.message)
  }
}

async function execute(payload = {}) {
  try {
    const operationType = normalizeOperationType(payload.operationType)
    if (!['order.internal_note.update', 'device.basic.update', 'schedule.block.create', 'schedule.block.cancel', 'logistics.local_record.create'].includes(operationType)) {
      return buildLocalExecuteDisabled(operationType)
    }

    const bridge = getSafeOpsBridge()
    if (!bridge || typeof bridge.execute !== 'function') {
      return buildLocalExecuteDisabled(operationType)
    }

    const result = await bridge.execute(payload || {})
    return result && typeof result === 'object'
      ? result
      : buildSafeError('SAFE_OP_EXECUTE_ERROR', 'safeOps execute returned an invalid response')
  } catch (error) {
    return buildSafeError('SAFE_OP_EXECUTE_ERROR', error?.message)
  }
}

export async function previewOrderInternalNoteUpdate({
  orderId,
  internalNote,
  actor,
  clientRequestId,
} = {}) {
  return preview({
    operationType: 'order.internal_note.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'order', id: String(orderId || '') },
    payload: {
      orderId: String(orderId || ''),
      internalNote: String(internalNote ?? ''),
    },
    clientRequestId: clientRequestId || `ui-v2-order-note-preview-${Date.now()}`,
  })
}

export async function executeOrderInternalNoteUpdate({
  previewResult,
  orderId,
  internalNote,
  actor,
  clientRequestId,
} = {}) {
  return execute({
    operationType: 'order.internal_note.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'order', id: String(orderId || '') },
    payload: {
      orderId: String(orderId || ''),
      internalNote: String(internalNote ?? ''),
    },
    clientRequestId: clientRequestId || `ui-v2-order-note-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewDeviceBasicUpdate({
  unitId,
  deviceId,
  patch,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return preview({
    operationType: 'device.basic.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'device', id },
    payload: {
      unitId: id,
      patch: patch || {},
    },
    clientRequestId: clientRequestId || `ui-v2-device-basic-preview-${Date.now()}`,
  })
}

export async function executeDeviceBasicUpdate({
  previewResult,
  unitId,
  deviceId,
  patch,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return execute({
    operationType: 'device.basic.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'device', id },
    payload: {
      unitId: id,
      patch: patch || {},
    },
    clientRequestId: clientRequestId || `ui-v2-device-basic-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewScheduleBlockCreate({
  unitId,
  deviceId,
  modelCode,
  blockType,
  startDate,
  endDate,
  plannedShipAt,
  expectedArriveAt,
  note,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return preview({
    operationType: 'schedule.block.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id: `new-${id}-${startDate || ''}` },
    payload: {
      unitId: id,
      modelCode: String(modelCode || ''),
      blockType: blockType || 'manual_hold',
      startDate: String(startDate || ''),
      endDate: String(endDate || ''),
      plannedShipAt: plannedShipAt || '',
      expectedArriveAt: expectedArriveAt || '',
      status: 'active',
      note: String(note || ''),
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-create-preview-${Date.now()}`,
  })
}

export async function executeScheduleBlockCreate({
  previewResult,
  unitId,
  deviceId,
  modelCode,
  blockType,
  startDate,
  endDate,
  plannedShipAt,
  expectedArriveAt,
  note,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return execute({
    operationType: 'schedule.block.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id: `new-${id}-${startDate || ''}` },
    payload: {
      unitId: id,
      modelCode: String(modelCode || ''),
      blockType: blockType || 'manual_hold',
      startDate: String(startDate || ''),
      endDate: String(endDate || ''),
      plannedShipAt: plannedShipAt || '',
      expectedArriveAt: expectedArriveAt || '',
      status: 'active',
      note: String(note || ''),
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-create-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewScheduleBlockCancel({
  blockId,
  actor,
  clientRequestId,
} = {}) {
  const id = String(blockId || '')
  return preview({
    operationType: 'schedule.block.cancel',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id },
    payload: {
      blockId: id,
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-cancel-preview-${Date.now()}`,
  })
}

export async function executeScheduleBlockCancel({
  previewResult,
  blockId,
  actor,
  clientRequestId,
} = {}) {
  const id = String(blockId || '')
  return execute({
    operationType: 'schedule.block.cancel',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id },
    payload: {
      blockId: id,
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-cancel-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewLogisticsLocalRecordCreate({
  orderId,
  carrier,
  trackingNo,
  shippingMode,
  latestStatus,
  shipFromCity,
  shipToCity,
  plannedShipAt,
  actualShipAt,
  expectedArriveAt,
  actualArriveAt,
  actor,
  clientRequestId,
} = {}) {
  const id = String(orderId || '')
  return preview({
    operationType: 'logistics.local_record.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'shipping_record', id: `new-${id}-${trackingNo || ''}` },
    payload: {
      orderId: id,
      carrier: carrier || 'manual',
      trackingNo: String(trackingNo || ''),
      shippingMode: shippingMode || 'manual',
      latestStatus: latestStatus || 'manual_recorded',
      shipFromCity: String(shipFromCity || ''),
      shipToCity: String(shipToCity || ''),
      plannedShipAt: String(plannedShipAt || ''),
      actualShipAt: String(actualShipAt || ''),
      expectedArriveAt: String(expectedArriveAt || ''),
      actualArriveAt: String(actualArriveAt || ''),
    },
    clientRequestId: clientRequestId || `ui-v2-logistics-local-record-preview-${Date.now()}`,
  })
}

export async function executeLogisticsLocalRecordCreate({
  previewResult,
  orderId,
  carrier,
  trackingNo,
  shippingMode,
  latestStatus,
  shipFromCity,
  shipToCity,
  plannedShipAt,
  actualShipAt,
  expectedArriveAt,
  actualArriveAt,
  actor,
  clientRequestId,
} = {}) {
  const id = String(orderId || '')
  return execute({
    operationType: 'logistics.local_record.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'shipping_record', id: `new-${id}-${trackingNo || ''}` },
    payload: {
      orderId: id,
      carrier: carrier || 'manual',
      trackingNo: String(trackingNo || ''),
      shippingMode: shippingMode || 'manual',
      latestStatus: latestStatus || 'manual_recorded',
      shipFromCity: String(shipFromCity || ''),
      shipToCity: String(shipToCity || ''),
      plannedShipAt: String(plannedShipAt || ''),
      actualShipAt: String(actualShipAt || ''),
      expectedArriveAt: String(expectedArriveAt || ''),
      actualArriveAt: String(actualArriveAt || ''),
    },
    clientRequestId: clientRequestId || `ui-v2-logistics-local-record-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewSfCreateOrder({
  mode = 'disabled',
  shipmentId,
  orderId,
  modelCode,
  senderName,
  senderPhone,
  senderAddress,
  senderCity,
  receiverName,
  receiverPhone,
  receiverAddress,
  receiverCity,
  weightKg,
  insuredAmount,
  packageInfo,
  service,
  reason,
  actor,
  clientRequestId,
} = {}) {
  const id = String(shipmentId || orderId || '')
  return preview({
    operationType: 'logistics.sf.create_order',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'sf_shipment_preview', id },
    payload: {
      mode: normalizeExternalMode(mode),
      shipmentId: String(shipmentId || ''),
      orderId: String(orderId || ''),
      modelCode: String(modelCode || ''),
      senderName: String(senderName || ''),
      senderPhone: String(senderPhone || ''),
      senderAddress: String(senderAddress || ''),
      senderCity: String(senderCity || ''),
      receiverName: String(receiverName || ''),
      receiverPhone: String(receiverPhone || ''),
      receiverAddress: String(receiverAddress || ''),
      receiverCity: String(receiverCity || ''),
      package: {
        ...(packageInfo || {}),
        weightKg: packageInfo?.weightKg ?? weightKg ?? null,
        insuredAmount: packageInfo?.insuredAmount ?? insuredAmount ?? null,
      },
      service: service || {},
      providerName: 'sf_express',
      reason: String(reason || ''),
      source: 'ui-v2-logistics-sf-preview',
    },
    clientRequestId: clientRequestId || `ui-v2-sf-create-order-preview-${Date.now()}`,
  })
}

export async function executeSfCreateOrder({
  previewResult,
  mode = 'disabled',
  shipmentId,
  orderId,
  actor,
  clientRequestId,
} = {}) {
  return execute({
    operationType: 'logistics.sf.create_order',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'sf_shipment_preview', id: String(shipmentId || orderId || '') },
    payload: {
      mode: normalizeExternalMode(mode),
      shipmentId: String(shipmentId || ''),
      orderId: String(orderId || ''),
      providerName: 'sf_express',
      source: 'ui-v2-logistics-sf-preview',
    },
    clientRequestId: clientRequestId || `ui-v2-sf-create-order-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

function buildDepositPayload({
  mode = 'disabled',
  orderId,
  orderNo,
  reviewId,
  depositOrderId,
  modelCode,
  customerName,
  realName,
  contactName,
  phone,
  address,
  idCard,
  paymentAccount,
  requestedFreeAmount,
  depositAmount,
  currency,
  riskLevel,
  reviewStatus,
  depositStatus,
  finishReason,
  service,
  reason,
} = {}) {
  return {
    mode: normalizeExternalMode(mode),
    orderId: String(orderId || ''),
    orderNo: String(orderNo || ''),
    reviewId: String(reviewId || ''),
    depositOrderId: String(depositOrderId || ''),
    modelCode: String(modelCode || ''),
    customerName: String(customerName || ''),
    realName: String(realName || ''),
    contactName: String(contactName || ''),
    phone: String(phone || ''),
    address: String(address || ''),
    idCard: String(idCard || ''),
    paymentAccount: String(paymentAccount || ''),
    requestedFreeAmount: requestedFreeAmount ?? '',
    depositAmount: depositAmount ?? '',
    currency: String(currency || 'CNY'),
    riskLevel: String(riskLevel || ''),
    reviewStatus: String(reviewStatus || ''),
    depositStatus: String(depositStatus || ''),
    finish: {
      reason: String(finishReason || reason || ''),
      status: 'finish_preview',
    },
    service: service || {},
    providerName: 'deposit_service',
    reason: String(reason || ''),
    source: 'ui-v2-deposit-preview',
  }
}

export async function previewDepositCreate({
  actor,
  clientRequestId,
  ...payload
} = {}) {
  const id = String(payload.reviewId || payload.orderId || payload.orderNo || '')
  return preview({
    operationType: 'deposit.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'deposit_preview', id },
    payload: buildDepositPayload(payload),
    clientRequestId: clientRequestId || `ui-v2-deposit-create-preview-${Date.now()}`,
  })
}

export async function previewDepositFinish({
  actor,
  clientRequestId,
  ...payload
} = {}) {
  const id = String(payload.depositOrderId || payload.reviewId || payload.orderId || payload.orderNo || '')
  return preview({
    operationType: 'deposit.finish',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'deposit_preview', id },
    payload: buildDepositPayload(payload),
    clientRequestId: clientRequestId || `ui-v2-deposit-finish-preview-${Date.now()}`,
  })
}

export async function executeDepositCreate({
  previewResult,
  actor,
  clientRequestId,
  ...payload
} = {}) {
  const id = String(payload.reviewId || payload.orderId || payload.orderNo || '')
  return execute({
    operationType: 'deposit.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'deposit_preview', id },
    payload: buildDepositPayload(payload),
    clientRequestId: clientRequestId || `ui-v2-deposit-create-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function executeDepositFinish({
  previewResult,
  actor,
  clientRequestId,
  ...payload
} = {}) {
  const id = String(payload.depositOrderId || payload.reviewId || payload.orderId || payload.orderNo || '')
  return execute({
    operationType: 'deposit.finish',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'deposit_preview', id },
    payload: buildDepositPayload(payload),
    clientRequestId: clientRequestId || `ui-v2-deposit-finish-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export const safeOpsAdapter = {
  getPolicy,
  preview,
  execute,
  previewOrderInternalNoteUpdate,
  executeOrderInternalNoteUpdate,
  previewDeviceBasicUpdate,
  executeDeviceBasicUpdate,
  previewScheduleBlockCreate,
  executeScheduleBlockCreate,
  previewScheduleBlockCancel,
  executeScheduleBlockCancel,
  previewLogisticsLocalRecordCreate,
  executeLogisticsLocalRecordCreate,
  previewSfCreateOrder,
  executeSfCreateOrder,
  previewDepositCreate,
  previewDepositFinish,
  executeDepositCreate,
  executeDepositFinish,
}
