function createNoopResult(action, payload = {}) {
  return {
    ok: true,
    action,
    mode: 'noop',
    persisted: false,
    payload,
  }
}

function createNoopSafeOpsRepository() {
  return {
    mode: 'noop',
    persistAuditLog(payload) {
      return createNoopResult('persistAuditLog', payload)
    },
    createConfirmToken(payload) {
      return createNoopResult('createConfirmToken', payload)
    },
    claimIdempotencyKey(payload) {
      return createNoopResult('claimIdempotencyKey', payload)
    },
    saveRollbackPlan(payload) {
      return createNoopResult('saveRollbackPlan', payload)
    },
    markAuditStatus(payload) {
      return createNoopResult('markAuditStatus', payload)
    },
  }
}

function callRepositoryMethod(repository, methodName, payload) {
  if (!repository || typeof repository[methodName] !== 'function') {
    return createNoopResult(methodName, payload)
  }
  return repository[methodName](payload)
}

function createSafeOpsRepository({ repository = null, enabled = false, executeEnabled = false } = {}) {
  if (!enabled || !executeEnabled || !repository) return createNoopSafeOpsRepository()

  return {
    mode: 'adapter',
    persistAuditLog(payload) {
      return callRepositoryMethod(repository, 'persistAuditLog', payload)
    },
    createConfirmToken(payload) {
      return callRepositoryMethod(repository, 'createConfirmToken', payload)
    },
    claimIdempotencyKey(payload) {
      return callRepositoryMethod(repository, 'claimIdempotencyKey', payload)
    },
    saveRollbackPlan(payload) {
      return callRepositoryMethod(repository, 'saveRollbackPlan', payload)
    },
    markAuditStatus(payload) {
      return callRepositoryMethod(repository, 'markAuditStatus', payload)
    },
  }
}

module.exports = {
  createNoopSafeOpsRepository,
  createSafeOpsRepository,
}
