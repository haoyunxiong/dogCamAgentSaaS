const {
  generateConfirmTokenValue,
  generateOperationId,
  hashConfirmToken,
  hashIdempotencyKey,
  hashImpact,
  hashPayload,
  sha256Hex,
  redactSensitive,
} = require('./safeOpsCrypto')
const { createSafeOpsRepository } = require('./safeOpsRepository')

const DEFAULT_CONFIRM_TOKEN_TTL_MS = 10 * 60 * 1000
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_ROLLBACK_TTL_MS = 30 * 24 * 60 * 60 * 1000

function nowIso() {
  return new Date().toISOString()
}

function addMsIso(baseDate, ms) {
  return new Date(baseDate.getTime() + ms).toISOString()
}

function normalizeActor(actor = {}) {
  return {
    id: String(actor.id || actor.actorId || 'unknown').trim() || 'unknown',
    role: String(actor.role || 'operator').trim() || 'operator',
    source: String(actor.source || 'safeops').trim() || 'safeops',
    sessionId: actor.sessionId ? String(actor.sessionId) : null,
  }
}

function normalizeTarget(target = {}) {
  return {
    ...redactSensitive(target || {}),
    type: target?.type ? String(target.type) : null,
    id: target?.id ? String(target.id) : null,
  }
}

function createOperationIdentity(request = {}, impact = {}) {
  return {
    operationId: generateOperationId('safeop'),
    operationType: String(request.operationType || '').trim(),
    payloadHash: hashPayload(request.payload || {}),
    impactHash: hashImpact(impact || {}),
  }
}

function buildAuditLogPayload({
  request = {},
  impact = {},
  mode = 'dry-run',
  status = 'previewed',
  operationId,
  beforeSnapshot = null,
  afterSnapshot = null,
} = {}) {
  const identity = operationId
    ? {
        operationId,
        operationType: String(request.operationType || '').trim(),
        payloadHash: hashPayload(request.payload || {}),
        impactHash: hashImpact(impact || {}),
      }
    : createOperationIdentity(request, impact)

  return {
    operationId: identity.operationId,
    operationType: identity.operationType,
    mode,
    status,
    actor: normalizeActor(request.actor || {}),
    target: normalizeTarget(request.target || {}),
    payloadHash: identity.payloadHash,
    impactHash: identity.impactHash,
    payloadPreview: redactSensitive(request.payload || {}),
    impactPreview: redactSensitive(impact || {}),
    beforeSnapshot: redactSensitive(beforeSnapshot),
    afterSnapshot: redactSensitive(afterSnapshot),
    externalRequest: null,
    externalResponse: null,
    rollbackPlanId: null,
    createdAt: nowIso(),
  }
}

function buildNoopAuditDescriptor(auditPayload = {}) {
  return {
    mode: 'noop',
    persisted: false,
    operationId: auditPayload.operationId || null,
    payloadHash: auditPayload.payloadHash || null,
    impactHash: auditPayload.impactHash || null,
    status: auditPayload.status || 'previewed',
  }
}

function buildConfirmTokenPayload({
  request = {},
  impact = {},
  token = null,
  operationId = null,
  ttlMs = DEFAULT_CONFIRM_TOKEN_TTL_MS,
} = {}) {
  const createdAt = new Date()
  return {
    operationId,
    operationType: String(request.operationType || '').trim(),
    actor: normalizeActor(request.actor || {}),
    payloadHash: hashPayload(request.payload || {}),
    impactHash: hashImpact(impact || {}),
    tokenHash: hashConfirmToken(token),
    tokenPreview: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : null,
    status: 'pending',
    oneTimeUse: true,
    expiresAt: addMsIso(createdAt, ttlMs),
    createdAt: createdAt.toISOString(),
  }
}

function buildConfirmRequirement({
  enabled = false,
  required = true,
  persisted = false,
  exists = false,
  tokenPreview = null,
  tokenId = null,
  expiresAt = null,
  reason = 'write-disabled-until-safeops-execute-is-enabled',
} = {}) {
  return {
    enabled,
    required,
    persisted,
    exists,
    tokenPreview,
    tokenId,
    token: null,
    tokenHash: null,
    expiresAt,
    reason,
  }
}

function buildIdempotencyPayload({
  request = {},
  idempotencyKey = null,
  operationId = null,
  ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS,
} = {}) {
  const createdAt = new Date()
  return {
    operationId,
    operationType: String(request.operationType || '').trim(),
    actor: normalizeActor(request.actor || {}),
    payloadHash: hashPayload(request.payload || {}),
    keyHash: hashIdempotencyKey(idempotencyKey),
    status: 'not-claimed',
    expiresAt: addMsIso(createdAt, ttlMs),
    createdAt: createdAt.toISOString(),
  }
}

function buildStableIdempotencyKey({ actor, operationType, payloadHash } = {}) {
  const actorId = normalizeActor(actor || {}).id
  return sha256Hex(`safeops-idempotency-key:${actorId}:${operationType}:${payloadHash}`)
}

function buildIdempotencyDescriptor({
  mode = 'noop',
  required = true,
  idempotencyKey = null,
  keyHash = null,
  persisted = false,
  id = null,
  status = 'not-claimed',
  duplicate = false,
  reason = 'write-disabled-until-safeops-execute-is-enabled',
} = {}) {
  return {
    mode,
    required,
    persisted,
    id,
    keyHash: keyHash || hashIdempotencyKey(idempotencyKey),
    status,
    duplicate,
    reason,
  }
}

function buildRollbackPlanPayload({
  request = {},
  operationId = null,
  beforeSnapshot = null,
  afterSnapshot = null,
  compensation = null,
  ttlMs = DEFAULT_ROLLBACK_TTL_MS,
} = {}) {
  const createdAt = new Date()
  return {
    operationId,
    operationType: String(request.operationType || '').trim(),
    actor: normalizeActor(request.actor || {}),
    target: normalizeTarget(request.target || {}),
    status: 'not_executable',
    rollbackType: compensation ? 'compensation' : 'rollback',
    beforeSnapshot: redactSensitive(beforeSnapshot),
    afterSnapshot: redactSensitive(afterSnapshot),
    compensation: redactSensitive(compensation),
    forwardEffects: [],
    compensationSteps: [],
    externalRefs: [],
    requiresConfirmation: true,
    errorMessage: 'Rollback placeholder only. No rollback executor is available in Phase 04.',
    expiresAt: addMsIso(createdAt, ttlMs),
    createdAt: createdAt.toISOString(),
  }
}

function buildRollbackDescriptor({
  mode = 'noop',
  planned = false,
  persisted = false,
  rollbackPlanId = null,
  status = 'not_executable',
  canRollback = false,
  compensationRequired = false,
  reason = 'no-write-executed',
} = {}) {
  return {
    mode,
    planned,
    persisted,
    rollbackPlanId,
    status,
    canRollback,
    compensationRequired,
    reason,
  }
}

function buildPersistenceDescriptor({ mode = 'noop', available = false, reason = null } = {}) {
  return {
    mode,
    available,
    reason,
  }
}

function buildSafeOperationPersistenceContext(request = {}, impact = {}, options = {}) {
  const token = options.issueConfirmToken === false ? null : generateConfirmTokenValue()
  const baseAuditPayload = buildAuditLogPayload({
    request,
    impact,
    mode: options.mode || 'dry-run',
    status: options.status || 'previewed',
    operationId: options.operationId,
  })
  const stableIdempotencyKey = options.idempotencyKey || buildStableIdempotencyKey({
    actor: request.actor || {},
    operationType: baseAuditPayload.operationType,
    payloadHash: baseAuditPayload.payloadHash,
  })
  const auditPayload = buildAuditLogPayload({
    request,
    impact,
    mode: options.mode || 'dry-run',
    status: options.status || 'previewed',
    operationId: baseAuditPayload.operationId,
    beforeSnapshot: options.beforeSnapshot || null,
    afterSnapshot: options.afterSnapshot || null,
  })

  return {
    persistence: buildPersistenceDescriptor(),
    auditPayload,
    audit: buildNoopAuditDescriptor(auditPayload),
    confirmTokenPayload: buildConfirmTokenPayload({
      request,
      impact,
      token,
      operationId: auditPayload.operationId,
    }),
    confirmRequirement: buildConfirmRequirement(options.confirm || {}),
    idempotencyPayload: buildIdempotencyPayload({
      request,
      idempotencyKey: stableIdempotencyKey,
      operationId: auditPayload.operationId,
    }),
    idempotency: buildIdempotencyDescriptor({
      idempotencyKey: stableIdempotencyKey,
      ...(options.idempotency || {}),
    }),
    rollbackPlanPayload: buildRollbackPlanPayload({
      request,
      operationId: auditPayload.operationId,
      beforeSnapshot: options.beforeSnapshot || null,
      afterSnapshot: options.afterSnapshot || null,
    }),
    rollback: buildRollbackDescriptor(options.rollback || {}),
    issuedConfirmToken: token,
    stableIdempotencyKey,
  }
}

function buildPersistenceErrorContext(context = {}, error) {
  const reason = error?.message || String(error || 'safeOps persistence failed safely')
  return {
    ...context,
    persistence: buildPersistenceDescriptor({ mode: 'noop', available: false, reason }),
    audit: {
      ...context.audit,
      mode: 'noop',
      persisted: false,
      reason,
    },
    confirmRequirement: buildConfirmRequirement({
      required: true,
      reason,
    }),
    idempotency: buildIdempotencyDescriptor({
      idempotencyKey: context.stableIdempotencyKey,
      required: true,
      reason,
    }),
    rollback: buildRollbackDescriptor({
      reason,
    }),
  }
}

async function persistSafeOperationContext({
  request = {},
  policy = {},
  impact = {},
  previewResponse = null,
  mode = 'dry-run',
  status = 'previewed',
  issueConfirmToken = true,
  rollback = {},
  beforeSnapshot = null,
  afterSnapshot = null,
} = {}) {
  const context = buildSafeOperationPersistenceContext(request, impact, {
    mode,
    status,
    issueConfirmToken,
    rollback,
    beforeSnapshot,
    afterSnapshot,
  })

  try {
    const repository = await createSafeOpsRepository({ enabled: true })
    const health = typeof repository.healthCheckSafeOpsTables === 'function'
      ? await repository.healthCheckSafeOpsTables()
      : { available: false, mode: 'noop', reason: repository.reason || 'safeOps repository unavailable' }

    if (!health.available) {
      return {
        ...context,
        persistence: buildPersistenceDescriptor({
          mode: 'noop',
          available: false,
          reason: health.reason || 'safeOps tables unavailable',
        }),
      }
    }

    const idempotencyKeyHash = context.idempotencyPayload.keyHash
    const auditResult = await repository.createAuditLog({
      ...context.auditPayload,
      domain: policy.domain || 'Unknown',
      riskLevel: policy.riskLevel || 'unknown',
      clientRequestId: request.clientRequestId || null,
      idempotencyKeyHash,
      previewResponse: previewResponse || null,
    })

    const auditLogId = auditResult.id || null
    const idempotencyResult = await repository.createIdempotencyKey({
      ...context.idempotencyPayload,
      keyHash: idempotencyKeyHash,
      status,
      auditLogId,
      response: previewResponse || null,
    })

    let confirmResult = null
    if (issueConfirmToken && context.confirmTokenPayload.tokenHash) {
      confirmResult = await repository.createConfirmToken({
        ...context.confirmTokenPayload,
        status: 'issued',
        previewAuditLogId: auditLogId,
        idempotencyKeyHash,
      })
    }

    const rollbackResult = await repository.createRollbackPlan({
      ...context.rollbackPlanPayload,
      auditLogId,
      status: 'not_executable',
      rollbackType: rollback.rollbackType || 'rollback',
      forwardEffects: [],
      compensationSteps: [],
      externalRefs: [],
      requiresConfirmation: true,
    })

    if (confirmResult?.id || rollbackResult?.id) {
      await repository.updateAuditLogStatus({
        id: auditLogId,
        status,
        confirmTokenId: confirmResult?.id || null,
        rollbackPlanId: rollbackResult?.id || null,
      })
    }

    return {
      ...context,
      persistence: buildPersistenceDescriptor({ mode: 'db', available: true, reason: null }),
      audit: {
        mode: 'db',
        persisted: true,
        auditLogId,
        operationId: context.auditPayload.operationId,
        payloadHash: context.auditPayload.payloadHash,
        impactHash: context.auditPayload.impactHash,
        status,
      },
      confirmRequirement: buildConfirmRequirement({
        enabled: Boolean(confirmResult?.persisted),
        required: true,
        persisted: Boolean(confirmResult?.persisted),
        exists: Boolean(confirmResult?.persisted),
        tokenId: confirmResult?.id || null,
        tokenPreview: context.confirmTokenPayload.tokenPreview,
        expiresAt: context.confirmTokenPayload.expiresAt,
        reason: confirmResult?.persisted
          ? 'confirm-token-issued-for-future-write-only'
          : 'confirm-token-not-issued',
      }),
      idempotency: buildIdempotencyDescriptor({
        mode: 'db',
        required: true,
        persisted: Boolean(idempotencyResult?.persisted),
        id: idempotencyResult?.id || null,
        keyHash: idempotencyKeyHash,
        status: idempotencyResult?.duplicate ? 'duplicate' : (idempotencyResult?.status || status),
        duplicate: Boolean(idempotencyResult?.duplicate),
        reason: idempotencyResult?.duplicate
          ? 'duplicate-idempotency-key-for-same-actor-operation-payload'
          : 'idempotency-key-recorded',
      }),
      rollback: buildRollbackDescriptor({
        mode: 'db',
        planned: true,
        persisted: Boolean(rollbackResult?.persisted),
        rollbackPlanId: rollbackResult?.id || null,
        status: rollbackResult?.status || 'not_executable',
        canRollback: false,
        compensationRequired: false,
        reason: 'rollback-placeholder-not-executable',
      }),
    }
  } catch (error) {
    return buildPersistenceErrorContext(context, error)
  }
}

async function getSafeOpsPersistenceStatus() {
  try {
    const repository = await createSafeOpsRepository({ enabled: true })
    const health = await repository.healthCheckSafeOpsTables()
    return buildPersistenceDescriptor({
      mode: health.available ? 'db' : 'noop',
      available: Boolean(health.available),
      reason: health.reason || null,
    })
  } catch (error) {
    return buildPersistenceDescriptor({
      mode: 'noop',
      available: false,
      reason: error?.message || 'safeOps persistence health check failed safely',
    })
  }
}

module.exports = {
  DEFAULT_CONFIRM_TOKEN_TTL_MS,
  DEFAULT_IDEMPOTENCY_TTL_MS,
  DEFAULT_ROLLBACK_TTL_MS,
  buildAuditLogPayload,
  buildConfirmRequirement,
  buildConfirmTokenPayload,
  buildIdempotencyDescriptor,
  buildIdempotencyPayload,
  buildNoopAuditDescriptor,
  buildRollbackDescriptor,
  buildRollbackPlanPayload,
  buildSafeOperationPersistenceContext,
  buildStableIdempotencyKey,
  createOperationIdentity,
  getSafeOpsPersistenceStatus,
  normalizeActor,
  normalizeTarget,
  persistSafeOperationContext,
}
