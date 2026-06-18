const {
  EXECUTE_POLICY,
  buildUnsupportedOperationResponse,
  getOperationPolicy,
  normalizeOperationType,
} = require('./safeOpsPolicy')
const { buildSafeOperationPersistenceContext } = require('./safeOpsPersistence')

function executeSafeOperation(request = {}) {
  try {
    const operationType = normalizeOperationType(request?.operationType)
    const policy = getOperationPolicy(operationType)

    if (!policy) {
      return {
        ...buildUnsupportedOperationResponse(operationType),
        mode: 'execute-disabled',
        writeWillExecute: false,
        externalCallWillExecute: false,
      }
    }

    const impact = {
      summary: 'safeOps execute is disabled. No business write, database write, Python bridge call, or external service call will execute.',
      affectedRecords: [],
      externalEffects: [],
    }
    const persistence = buildSafeOperationPersistenceContext(
      { ...request, operationType },
      impact,
      {
        mode: 'execute-disabled',
        status: 'rejected',
        rollback: {
          planned: false,
          canRollback: false,
          compensationRequired: false,
          reason: 'execute-disabled-no-write-executed',
        },
      }
    )

    return {
      ok: false,
      supported: true,
      code: EXECUTE_POLICY.code,
      message: 'safeOps execute is disabled in Phase 04. Start from preview; real write requires DB migration, confirmToken, idempotencyKey, audit persistence, and explicit user approval.',
      operationType,
      mode: 'execute-disabled',
      writeWillExecute: false,
      externalCallWillExecute: false,
      riskLevel: policy.riskLevel,
      warnings: [],
      blockers: [
        'safeOps execute IPC/preload is not exposed.',
        'DB-backed audit, confirmToken, idempotencyKey, and rollback persistence are not enabled.',
        'Real write capability requires a later user-approved enablement step.',
      ],
      impact,
      requiresConfirm: true,
      requiresIdempotencyKey: true,
      audit: persistence.audit,
      confirmToken: null,
      confirmRequirement: persistence.confirmRequirement,
      idempotency: persistence.idempotency,
      rollback: persistence.rollback,
    }
  } catch (error) {
    return {
      ok: false,
      supported: false,
      code: 'SAFE_OP_EXECUTE_ERROR',
      message: error?.message || 'safeOps execute failed safely',
      mode: 'execute-disabled',
      writeWillExecute: false,
      externalCallWillExecute: false,
      audit: {
        mode: 'noop',
        persisted: false,
      },
    }
  }
}

module.exports = {
  executeSafeOperation,
}
