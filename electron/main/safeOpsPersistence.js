const {
  generateOperationId,
  hashConfirmToken,
  hashIdempotencyKey,
  hashImpact,
  hashPayload,
  redactSensitive,
} = require('./safeOpsCrypto')

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
    beforeSnapshot: null,
    afterSnapshot: null,
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
    status: 'pending',
    oneTimeUse: true,
    expiresAt: addMsIso(createdAt, ttlMs),
    createdAt: createdAt.toISOString(),
  }
}

function buildConfirmRequirement({
  required = true,
  reason = 'write-disabled-until-safeops-execute-is-enabled',
} = {}) {
  return {
    enabled: false,
    required,
    persisted: false,
    token: null,
    tokenHash: null,
    expiresAt: null,
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

function buildIdempotencyDescriptor({
  required = true,
  idempotencyKey = null,
  reason = 'write-disabled-until-safeops-execute-is-enabled',
} = {}) {
  return {
    mode: 'noop',
    required,
    persisted: false,
    keyHash: hashIdempotencyKey(idempotencyKey),
    status: 'not-claimed',
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
    status: 'not-planned',
    rollbackType: compensation ? 'compensation' : 'rollback',
    beforeSnapshot: redactSensitive(beforeSnapshot),
    afterSnapshot: redactSensitive(afterSnapshot),
    compensation: redactSensitive(compensation),
    expiresAt: addMsIso(createdAt, ttlMs),
    createdAt: createdAt.toISOString(),
  }
}

function buildRollbackDescriptor({
  planned = false,
  canRollback = false,
  compensationRequired = false,
  reason = 'no-write-executed',
} = {}) {
  return {
    mode: 'noop',
    planned,
    persisted: false,
    canRollback,
    compensationRequired,
    reason,
  }
}

function buildSafeOperationPersistenceContext(request = {}, impact = {}, options = {}) {
  const auditPayload = buildAuditLogPayload({
    request,
    impact,
    mode: options.mode || 'dry-run',
    status: options.status || 'previewed',
    operationId: options.operationId,
  })

  return {
    auditPayload,
    audit: buildNoopAuditDescriptor(auditPayload),
    confirmTokenPayload: buildConfirmTokenPayload({
      request,
      impact,
      operationId: auditPayload.operationId,
    }),
    confirmRequirement: buildConfirmRequirement(options.confirm || {}),
    idempotencyPayload: buildIdempotencyPayload({
      request,
      idempotencyKey: options.idempotencyKey,
      operationId: auditPayload.operationId,
    }),
    idempotency: buildIdempotencyDescriptor({
      idempotencyKey: options.idempotencyKey,
      ...(options.idempotency || {}),
    }),
    rollbackPlanPayload: buildRollbackPlanPayload({
      request,
      operationId: auditPayload.operationId,
    }),
    rollback: buildRollbackDescriptor(options.rollback || {}),
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
  createOperationIdentity,
  normalizeActor,
  normalizeTarget,
}
