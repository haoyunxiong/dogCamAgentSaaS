import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'

const SAFE_OPS_MODE = 'dry-run-only'

const SAFE_OP_POLICIES = Object.freeze([
  { operationType: 'order.status.transition.preview', domain: 'Orders', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'order.edit.preview', domain: 'Orders', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'device.update.preview', domain: 'Devices', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'device.delete.preview', domain: 'Devices', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'schedule.block.preview', domain: 'Schedule', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'logistics.shipment.preview', domain: 'Logistics', riskLevel: 'critical', requiresExternalCredential: true },
  { operationType: 'deposit.create.preview', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true },
  { operationType: 'deposit.finish.preview', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true },
])

const POLICY_BY_OPERATION = new Map(SAFE_OP_POLICIES.map((policy) => [policy.operationType, policy]))

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeOperationType(operationType) {
  return String(operationType || '').trim()
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
      allowWrite: false,
      requiresDbMigrationForWrite: true,
      requiresUserConfirmationForWrite: true,
    })),
    audit: { mode: 'noop', persisted: false },
    confirmToken: { enabled: false },
    idempotency: { mode: 'noop' },
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

  return {
    ok: true,
    supported: true,
    operationType,
    mode: 'dry-run',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [],
    impact: {
      summary: 'Renderer noop safeOps preview. This action is dry-run only and will not write data or call external services.',
      affectedRecords: [],
      externalEffects: [],
    },
    audit: { mode: 'noop', persisted: false },
    confirmToken: null,
    idempotency: { mode: 'noop' },
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

export const safeOpsAdapter = {
  getPolicy,
  preview,
}
