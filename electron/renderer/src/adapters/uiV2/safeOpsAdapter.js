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

const LOCAL_PREVIEW_SUMMARIES = Object.freeze({
  'order.status.transition.preview': 'Renderer noop order status preview. This is dry-run only and will not change order state, schedule, logistics, or notifications.',
  'order.edit.preview': 'Renderer noop order edit preview. This is dry-run only and will not change order fields, fees, devices, schedule, or logistics.',
  'device.update.preview': 'Renderer noop device update preview. This is dry-run only and will not change device profile, inventory, or availability.',
  'device.delete.preview': 'Renderer noop device delete preview. This is dry-run only and will not delete device data, schedule blocks, or order relations.',
  'schedule.block.preview': 'Renderer noop schedule block preview. This is dry-run only and will not write schedule data or lock inventory.',
  'logistics.shipment.preview': 'Renderer noop shipment preview. This is dry-run only and will not save shipment drafts, create waybills, charge fees, or call carrier services.',
  'deposit.create.preview': 'Renderer noop deposit create preview. This is dry-run only and will not create deposit orders or change local cache.',
  'deposit.finish.preview': 'Renderer noop deposit finish preview. This is dry-run only and will not finish deposit orders or change local cache.',
})

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
    confirmToken: { enabled: false, requiredForWrite: true, persisted: false },
    idempotency: { mode: 'noop', requiredForWrite: true, persisted: false },
    execute: cloneJson(EXECUTE_DISABLED_POLICY),
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
    execute: cloneJson(EXECUTE_DISABLED_POLICY),
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
