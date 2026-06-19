const {
  getExternalOperationPolicy,
  getExternalPolicy,
} = require('./safeOpsExternalPolicy')

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

function buildExternalImpact(operationPolicy) {
  return {
    summary: `${operationPolicy.operationType} is blocked by the external gateway. Real external calls are disabled by default and will not run in Phase 3A.`,
    affectedRecords: [],
    externalEffects: [],
  }
}

function previewExternalOperation(operationInput = {}) {
  const operationType = normalizeText(operationInput.operationType)
  const operationPolicy = getExternalOperationPolicy(operationType)
  if (!operationPolicy) return buildUnsupportedExternalOperation(operationType)

  const provider = operationPolicy.provider || {}
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
    externalGateway: {
      providerName: operationPolicy.providerName,
      providerStatus: provider.status || 'disabled',
      currentMode: provider.currentMode || 'disabled',
      realEnabled: false,
      sandboxEnabled: false,
      mockEnabled: false,
      externalWritesEnabled: false,
      externalCallWillExecute: false,
      compensationRequired: Boolean(provider.compensationRequired),
      timeoutMs: provider.timeoutMs || null,
      retryPolicy: provider.retryPolicy || { enabled: false, maxAttempts: 0, backoffMs: 0 },
      sensitiveFields: provider.sensitiveFields || [],
      redactionRules: provider.redactionRules || {},
    },
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
      currentMode: provider.currentMode || 'disabled',
      realEnabled: false,
      sandboxEnabled: false,
      mockEnabled: false,
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
