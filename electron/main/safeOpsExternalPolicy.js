const EXTERNAL_MODES = Object.freeze(['disabled', 'mock', 'sandbox', 'real'])
const DEFAULT_EXTERNAL_MODE = 'disabled'

const PROVIDER_POLICIES = Object.freeze([
  {
    providerName: 'sf_express',
    displayName: 'SF Express',
    allowedModes: EXTERNAL_MODES,
    currentMode: DEFAULT_EXTERNAL_MODE,
    realEnabled: false,
    sandboxEnabled: true,
    mockEnabled: true,
    externalWritesEnabled: false,
    requiresConfirm: true,
    requiresIdempotency: true,
    requiresAudit: true,
    previewModes: ['disabled', 'mock', 'sandbox'],
    sensitiveFields: [
      'accessToken',
      'refreshToken',
      'appKey',
      'appSecret',
      'customerPhone',
      'receiverAddress',
      'phone',
      'address',
      'contactName',
      'token',
      'apiKey',
      'cookie',
    ],
    redactionRules: {
      accessToken: 'hash-only',
      refreshToken: 'hash-only',
      appKey: 'mask',
      appSecret: 'never-log',
      customerPhone: 'mask-phone',
      receiverAddress: 'mask-address',
      phone: 'mask-phone',
      address: 'mask-address',
      contactName: 'mask-name',
      token: 'hash-only',
      apiKey: 'mask',
      cookie: 'never-log',
    },
    timeoutMs: 8000,
    retryPolicy: {
      enabled: false,
      maxAttempts: 0,
      backoffMs: 0,
    },
    compensationRequired: true,
    status: 'disabled',
  },
  {
    providerName: 'deposit_service',
    displayName: 'Deposit Service',
    allowedModes: EXTERNAL_MODES,
    currentMode: DEFAULT_EXTERNAL_MODE,
    realEnabled: false,
    sandboxEnabled: true,
    mockEnabled: true,
    externalWritesEnabled: false,
    requiresConfirm: true,
    requiresIdempotency: true,
    requiresAudit: true,
    previewModes: ['disabled', 'mock', 'sandbox'],
    sensitiveFields: [
      'appId',
      'appSecret',
      'userEid',
      'customerName',
      'customerPhone',
      'idCardNo',
      'phone',
      'address',
      'contactName',
      'idCard',
      'realName',
      'token',
      'apiKey',
      'cookie',
      'paymentAccount',
    ],
    redactionRules: {
      appId: 'mask',
      appSecret: 'never-log',
      userEid: 'mask',
      customerName: 'mask-name',
      customerPhone: 'mask-phone',
      idCardNo: 'never-log',
      phone: 'mask-phone',
      address: 'mask-address',
      contactName: 'mask-name',
      idCard: 'never-log',
      realName: 'mask-name',
      token: 'hash-only',
      apiKey: 'mask',
      cookie: 'never-log',
      paymentAccount: 'mask',
    },
    timeoutMs: 10000,
    retryPolicy: {
      enabled: false,
      maxAttempts: 0,
      backoffMs: 0,
    },
    compensationRequired: true,
    status: 'disabled',
  },
  {
    providerName: 'xianyu_platform',
    displayName: 'Xianyu Platform',
    allowedModes: EXTERNAL_MODES,
    currentMode: DEFAULT_EXTERNAL_MODE,
    realEnabled: false,
    sandboxEnabled: true,
    mockEnabled: true,
    externalWritesEnabled: false,
    requiresConfirm: true,
    requiresIdempotency: true,
    requiresAudit: true,
    previewModes: ['disabled', 'mock', 'sandbox'],
    sensitiveFields: [
      'accessToken',
      'refreshToken',
      'cookie',
      'sellerId',
      'buyerPhone',
      'phone',
      'address',
      'contactName',
      'buyerName',
      'sellerName',
      'itemTitle',
      'token',
      'apiKey',
      'session',
    ],
    redactionRules: {
      accessToken: 'hash-only',
      refreshToken: 'hash-only',
      cookie: 'never-log',
      sellerId: 'mask',
      buyerPhone: 'mask-phone',
      phone: 'mask-phone',
      address: 'mask-address',
      contactName: 'mask-name',
      buyerName: 'mask-name',
      sellerName: 'mask-name',
      itemTitle: 'never-log',
      token: 'hash-only',
      apiKey: 'mask',
      session: 'never-log',
    },
    timeoutMs: 10000,
    retryPolicy: {
      enabled: false,
      maxAttempts: 0,
      backoffMs: 0,
    },
    compensationRequired: true,
    status: 'disabled',
  },
])

const EXTERNAL_OPERATION_POLICIES = Object.freeze([
  {
    operationType: 'logistics.sf.create_order',
    providerName: 'sf_express',
    domain: 'Logistics',
    riskLevel: 'critical',
    externalAction: 'create_order',
    previewModes: ['disabled', 'mock', 'sandbox'],
    issueConfirmTokenForPreview: true,
    realEnabled: false,
    status: 'disabled',
  },
  {
    operationType: 'logistics.sf.cancel_order',
    providerName: 'sf_express',
    domain: 'Logistics',
    riskLevel: 'critical',
    externalAction: 'cancel_order',
    previewModes: ['disabled'],
    issueConfirmTokenForPreview: false,
    realEnabled: false,
    status: 'disabled',
  },
  {
    operationType: 'deposit.create',
    providerName: 'deposit_service',
    domain: 'Deposit',
    riskLevel: 'critical',
    externalAction: 'create',
    previewModes: ['disabled', 'mock', 'sandbox'],
    issueConfirmTokenForPreview: true,
    realEnabled: false,
    status: 'disabled',
  },
  {
    operationType: 'deposit.finish',
    providerName: 'deposit_service',
    domain: 'Deposit',
    riskLevel: 'critical',
    externalAction: 'finish',
    previewModes: ['disabled', 'mock', 'sandbox'],
    issueConfirmTokenForPreview: true,
    realEnabled: false,
    status: 'disabled',
  },
  {
    operationType: 'xianyu.order.sync',
    providerName: 'xianyu_platform',
    domain: 'Orders',
    riskLevel: 'critical',
    externalAction: 'sync_order',
    previewModes: ['disabled', 'mock', 'sandbox'],
    issueConfirmTokenForPreview: true,
    realEnabled: false,
    status: 'disabled',
  },
])

const PROVIDER_POLICY_BY_NAME = new Map(
  PROVIDER_POLICIES.map((provider) => [provider.providerName, Object.freeze({ ...provider })])
)
const EXTERNAL_OPERATION_BY_TYPE = new Map(
  EXTERNAL_OPERATION_POLICIES.map((operation) => [operation.operationType, Object.freeze({ ...operation })])
)

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeText(value) {
  return String(value || '').trim()
}

function isExternalOperationType(operationType) {
  return EXTERNAL_OPERATION_BY_TYPE.has(normalizeText(operationType))
}

function getExternalOperationPolicy(operationType) {
  const operation = EXTERNAL_OPERATION_BY_TYPE.get(normalizeText(operationType))
  if (!operation) return null
  const provider = PROVIDER_POLICY_BY_NAME.get(operation.providerName)
  return {
    ...cloneJson(operation),
    provider: provider ? cloneJson(provider) : null,
  }
}

function getExternalPolicy() {
  return {
    ok: true,
    mode: 'external-policy',
    defaultMode: DEFAULT_EXTERNAL_MODE,
    modes: cloneJson(EXTERNAL_MODES),
    realEnabled: false,
    externalWritesEnabled: false,
    providers: cloneJson(PROVIDER_POLICIES),
    operations: cloneJson(EXTERNAL_OPERATION_POLICIES),
    realModeGuard: {
      required: true,
      enabled: false,
      envFlagRequired: true,
      localConfigRequired: true,
      status: 'not-implemented',
    },
    audit: {
      required: true,
      payloadShape: {
        providerName: 'string',
        operationType: 'string',
        mode: 'disabled|mock|sandbox|real',
        externalRequestId: 'string|null',
        externalResponseId: 'string|null',
        redactedRequest: 'object',
        redactedResponse: 'object|null',
        status: 'blocked|previewed|failed|completed',
      },
    },
    idempotency: {
      required: true,
      payloadShape: {
        providerName: 'string',
        operationType: 'string',
        externalIdempotencyKeyHash: 'string',
        payloadHash: 'string',
        status: 'pending|blocked|completed|failed',
      },
    },
  }
}

module.exports = {
  DEFAULT_EXTERNAL_MODE,
  EXTERNAL_MODES,
  EXTERNAL_OPERATION_POLICIES,
  PROVIDER_POLICIES,
  getExternalOperationPolicy,
  getExternalPolicy,
  isExternalOperationType,
}
