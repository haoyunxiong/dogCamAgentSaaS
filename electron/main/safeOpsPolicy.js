const {
  EXTERNAL_OPERATION_POLICIES,
  getExternalPolicy,
} = require('./safeOpsExternalPolicy')

const SAFE_OPS_SAFE_MODE = 'gated-internal-write'
const SAFE_OPS_WRITE_ENABLED = true
const SAFE_OPS_EXECUTE_ENABLED = true
const SAFE_OPS_ENABLED_EXECUTE_OPERATION_TYPES = Object.freeze([
  'order.internal_note.update',
  'device.basic.update',
  'schedule.block.create',
  'schedule.block.cancel',
  'logistics.local_record.create',
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

const EXTERNAL_SAFE_OPERATION_POLICIES = Object.freeze(
  EXTERNAL_OPERATION_POLICIES.map((operation) => Object.freeze({
    operationType: operation.operationType,
    domain: operation.domain,
    riskLevel: operation.riskLevel,
    scope: 'external-gateway-disabled',
    providerName: operation.providerName,
    externalAction: operation.externalAction,
    allowPreview: true,
    allowWrite: false,
    allowExecute: false,
    externalCallAllowed: false,
    externalCallWillExecute: false,
    externalWritesEnabled: false,
    requiresConfirm: true,
    requiresIdempotency: true,
    requiresAudit: true,
    rollbackExecutable: false,
    compensationRequired: true,
    requiresDbMigrationForWrite: false,
    requiresExternalCredential: true,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
    gatewayStatus: 'disabled',
  }))
)

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
    operationType: 'device.basic.update',
    domain: 'Devices',
    riskLevel: 'medium-low',
    scope: 'internal-db-only',
    allowPreview: true,
    allowWrite: true,
    allowExecute: true,
    allowedFields: ['city', 'note', 'status'],
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
    operationType: 'schedule.block.create',
    domain: 'Schedule',
    riskLevel: 'medium-high',
    scope: 'internal-db-only',
    allowPreview: true,
    allowWrite: true,
    allowExecute: true,
    allowedFields: [
      'unit_id',
      'order_id',
      'model_code',
      'block_type',
      'start_date',
      'end_date',
      'planned_ship_at',
      'expected_arrive_at',
      'status',
      'note',
    ],
    allowedBlockTypes: ['manual_hold', 'internal_hold', 'maintenance', 'block', 'buffer'],
    allowedStatuses: ['active'],
    externalCallAllowed: false,
    requiresConfirm: true,
    requiresIdempotency: true,
    requiresConflictCheck: true,
    rollbackExecutable: false,
    requiresDbMigrationForWrite: false,
    requiresExternalCredential: false,
    requiresUserConfirmationForWrite: true,
    requiresIdempotencyKeyForWrite: true,
  },
  {
    operationType: 'schedule.block.cancel',
    domain: 'Schedule',
    riskLevel: 'medium',
    scope: 'internal-db-only',
    allowPreview: true,
    allowWrite: true,
    allowExecute: true,
    allowedFields: ['block_id', 'status', 'note'],
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
    operationType: 'logistics.local_record.create',
    domain: 'Logistics',
    riskLevel: 'medium',
    scope: 'internal-db-only',
    allowPreview: true,
    allowWrite: true,
    allowExecute: true,
    allowedTable: 'shipping_records',
    readOnlyTables: ['rental_orders'],
    allowedFields: [
      'order_id',
      'carrier',
      'tracking_no',
      'shipping_mode',
      'latest_status',
      'ship_from_city',
      'ship_to_city',
      'planned_ship_at',
      'actual_ship_at',
      'expected_arrive_at',
      'actual_arrive_at',
    ],
    allowedCarriers: ['manual', 'sf', 'jd', 'ems', 'deppon', 'zto', 'sto', 'yto', 'yunda', 'other'],
    allowedShippingModes: ['manual', 'express', 'pickup', 'dropoff', 'same_city', 'return'],
    allowedLatestStatuses: ['pending', 'pending_pickup', 'picked_up', 'in_transit', 'delivered', 'returned', 'exception', 'cancelled', 'manual_recorded'],
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
  ...EXTERNAL_SAFE_OPERATION_POLICIES,
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
    external: getExternalPolicy(),
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
