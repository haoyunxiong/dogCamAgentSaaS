const SAFE_OPS_SAFE_MODE = 'single-operation-write'
const SAFE_OPS_WRITE_ENABLED = true
const SAFE_OPS_EXECUTE_ENABLED = true
const SAFE_OPS_ENABLED_EXECUTE_OPERATION_TYPES = Object.freeze([
  'order.internal_note.update',
])

const AUDIT_POLICY = Object.freeze({
  mode: 'noop',
  persisted: false,
  requiresDbMigrationForPersistence: true,
})

const CONFIRM_TOKEN_POLICY = Object.freeze({
  enabled: false,
  requiredForWrite: true,
  persisted: false,
  requiresDbMigrationForPersistence: true,
})

const IDEMPOTENCY_POLICY = Object.freeze({
  mode: 'noop',
  requiredForWrite: true,
  persisted: false,
  requiresDbMigrationForPersistence: true,
})

const EXECUTE_POLICY = Object.freeze({
  enabled: SAFE_OPS_EXECUTE_ENABLED,
  code: 'SAFE_OP_EXECUTE_GATED',
  enabledOperationTypes: SAFE_OPS_ENABLED_EXECUTE_OPERATION_TYPES,
  writeWillExecute: true,
  externalCallWillExecute: false,
})

const OPERATION_POLICIES = Object.freeze([
  {
    operationType: 'order.internal_note.update',
    domain: 'Orders',
    riskLevel: 'low',
    scope: 'internal-db-only',
    allowPreview: true,
    allowWrite: true,
    allowExecute: true,
    allowedFields: ['internal_note'],
    externalCallAllowed: false,
    requiresConfirm: true,
    requiresIdempotency: true,
    rollbackExecutable: false,
    requiresDbMigrationForWrite: false,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'order.status.transition.preview',
    domain: 'Orders',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'order.edit.preview',
    domain: 'Orders',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'device.update.preview',
    domain: 'Devices',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'device.delete.preview',
    domain: 'Devices',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'schedule.block.preview',
    domain: 'Schedule',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'logistics.shipment.preview',
    domain: 'Logistics',
    riskLevel: 'critical',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: true,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'deposit.create.preview',
    domain: 'Deposit',
    riskLevel: 'critical',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: true,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'deposit.finish.preview',
    domain: 'Deposit',
    riskLevel: 'critical',
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: true,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
])

const OPERATION_POLICY_BY_TYPE = new Map(
  OPERATION_POLICIES.map((operation) => [operation.operationType, Object.freeze({ ...operation })])
)

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeOperationType(operationType) {
  return String(operationType || '').trim()
}

function getOperationPolicy(operationType) {
  const normalizedOperationType = normalizeOperationType(operationType)
  const policy = OPERATION_POLICY_BY_TYPE.get(normalizedOperationType)
  return policy ? cloneJson(policy) : null
}

function getSafeOpsPolicy() {
  return {
    ok: true,
    mode: 'policy',
    safeMode: SAFE_OPS_SAFE_MODE,
    writeEnabled: SAFE_OPS_WRITE_ENABLED,
    externalWritesEnabled: false,
    executeEnabled: SAFE_OPS_EXECUTE_ENABLED,
    operations: cloneJson(OPERATION_POLICIES),
    audit: cloneJson(AUDIT_POLICY),
    confirmToken: cloneJson(CONFIRM_TOKEN_POLICY),
    idempotency: cloneJson(IDEMPOTENCY_POLICY),
    execute: cloneJson(EXECUTE_POLICY),
  }
}

function buildUnsupportedOperationResponse(operationType) {
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

module.exports = {
  AUDIT_POLICY,
  CONFIRM_TOKEN_POLICY,
  EXECUTE_POLICY,
  IDEMPOTENCY_POLICY,
  OPERATION_POLICIES,
  SAFE_OPS_ENABLED_EXECUTE_OPERATION_TYPES,
  SAFE_OPS_EXECUTE_ENABLED,
  SAFE_OPS_SAFE_MODE,
  SAFE_OPS_WRITE_ENABLED,
  buildUnsupportedOperationResponse,
  getOperationPolicy,
  getSafeOpsPolicy,
  normalizeOperationType,
}
