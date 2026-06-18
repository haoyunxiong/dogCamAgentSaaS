const SAFE_OPS_SAFE_MODE = 'dry-run-only'

const AUDIT_POLICY = Object.freeze({
  mode: 'noop',
  persisted: false,
})

const CONFIRM_TOKEN_POLICY = Object.freeze({
  enabled: false,
})

const IDEMPOTENCY_POLICY = Object.freeze({
  mode: 'noop',
})

const OPERATION_POLICIES = Object.freeze([
  {
    operationType: 'order.status.transition.preview',
    domain: 'Orders',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
  },
  {
    operationType: 'order.edit.preview',
    domain: 'Orders',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
  },
  {
    operationType: 'device.update.preview',
    domain: 'Devices',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
  },
  {
    operationType: 'device.delete.preview',
    domain: 'Devices',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
  },
  {
    operationType: 'schedule.block.preview',
    domain: 'Schedule',
    riskLevel: 'high',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
  },
  {
    operationType: 'logistics.shipment.preview',
    domain: 'Logistics',
    riskLevel: 'critical',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: true,
    requiresUserConfirmationForWrite: true,
  },
  {
    operationType: 'deposit.create.preview',
    domain: 'Deposit',
    riskLevel: 'critical',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: true,
    requiresUserConfirmationForWrite: true,
  },
  {
    operationType: 'deposit.finish.preview',
    domain: 'Deposit',
    riskLevel: 'critical',
    allowPreview: true,
    allowWrite: false,
    requiresDbMigrationForWrite: true,
    requiresExternalCredential: true,
    requiresUserConfirmationForWrite: true,
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
    writeEnabled: false,
    externalWritesEnabled: false,
    operations: cloneJson(OPERATION_POLICIES),
    audit: cloneJson(AUDIT_POLICY),
    confirmToken: cloneJson(CONFIRM_TOKEN_POLICY),
    idempotency: cloneJson(IDEMPOTENCY_POLICY),
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
  IDEMPOTENCY_POLICY,
  OPERATION_POLICIES,
  SAFE_OPS_SAFE_MODE,
  buildUnsupportedOperationResponse,
  getOperationPolicy,
  getSafeOpsPolicy,
  normalizeOperationType,
}
