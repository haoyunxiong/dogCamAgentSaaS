const {
  EXECUTE_POLICY,
  buildUnsupportedOperationResponse,
  getOperationPolicy,
  normalizeOperationType,
} = require('./safeOpsPolicy')
const {
  buildStableIdempotencyKey,
  normalizeActor,
} = require('./safeOpsPersistence')
const {
  hashIdempotencyKey,
  hashPayload,
} = require('./safeOpsCrypto')
const { createSafeOpsRepository } = require('./safeOpsRepository')
const { loadMysqlConfig } = require('./mysqlConfig')

const ORDER_INTERNAL_NOTE_OPERATION_TYPE = 'order.internal_note.update'
const DEVICE_BASIC_UPDATE_OPERATION_TYPE = 'device.basic.update'
const ENABLED_OPERATION_TYPES = new Set([
  ORDER_INTERNAL_NOTE_OPERATION_TYPE,
  DEVICE_BASIC_UPDATE_OPERATION_TYPE,
])

function assertLocalSafeOpsWriteTarget() {
  const config = loadMysqlConfig()
  const host = String(config.host || '').trim().toLowerCase()
  const database = String(config.database || '').trim()
  const envLabel = String(process.env.XIANYU_ENV_LABEL || '').trim().toLowerCase()
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('safeOps execute refused: MySQL host is not local')
  }
  if (database !== 'xianyu_agent') {
    throw new Error('safeOps execute refused: database is not xianyu_agent')
  }
  if (envLabel === 'production' || envLabel === 'prod') {
    throw new Error('safeOps execute refused: production environment label')
  }
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeInternalNote(value) {
  const text = String(value ?? '').trim()
  return text.length > 5000 ? text.slice(0, 5000) : text
}

function getInternalNotePayload(request = {}) {
  const payload = request.payload || {}
  return {
    orderId: normalizeText(payload.orderId || request.target?.id),
    internalNote: normalizeInternalNote(payload.internalNote ?? payload.internal_note),
    rawPayload: payload,
  }
}

function findUnsupportedInternalNoteFields(payload = {}) {
  return Object.keys(payload).filter((key) => !['orderId', 'internalNote', 'internal_note'].includes(key))
}

function buildInternalNoteAfterSnapshot(beforeSnapshot, internalNote) {
  return {
    ...(beforeSnapshot || {}),
    internalNote: {
      hasValue: Boolean(internalNote),
      length: internalNote.length,
      preview: internalNote
        ? `${internalNote.slice(0, 2)}***${internalNote.slice(-2)}`
        : '',
    },
  }
}

const DEVICE_BASIC_ALLOWED_FIELDS = Object.freeze(['city', 'note', 'status'])
const DEVICE_BASIC_ALLOWED_STATUS_VALUES = new Set(['idle', 'repair', 'offline'])
const DEVICE_BASIC_FORBIDDEN_OCCUPIED_STATUS_VALUES = new Set([
  'active',
  'busy',
  'rented',
  'occupied',
  'locked',
  'reserved',
])
const DEVICE_BASIC_STATUS_ALIASES = Object.freeze({
  available: 'idle',
  idle: 'idle',
  '可租': 'idle',
  '空闲': 'idle',
  maintenance: 'repair',
  repair: 'repair',
  '维修中': 'repair',
  '维护中': 'repair',
  inactive: 'offline',
  disabled: 'offline',
  offline: 'offline',
  '停用': 'offline',
})

function getDeviceBasicPayload(request = {}) {
  const payload = request.payload || {}
  const patch = payload.patch && typeof payload.patch === 'object' && !Array.isArray(payload.patch)
    ? payload.patch
    : {}
  return {
    unitId: normalizeText(payload.unitId || payload.deviceId || request.target?.id),
    patch,
    rawPayload: payload,
  }
}

function findUnsupportedDeviceBasicPayloadFields(payload = {}) {
  return Object.keys(payload).filter((key) => !['unitId', 'deviceId', 'patch'].includes(key))
}

function normalizeDeviceBasicStatus(value) {
  const text = normalizeText(value).toLowerCase()
  return DEVICE_BASIC_STATUS_ALIASES[text] || DEVICE_BASIC_STATUS_ALIASES[normalizeText(value)] || text
}

function normalizeDeviceBasicPatch(patch = {}) {
  const normalizedPatch = {}
  const blockers = []
  const unsupportedFields = Object.keys(patch).filter((field) => !DEVICE_BASIC_ALLOWED_FIELDS.includes(field))

  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload.patch fields for device.basic.update: ${unsupportedFields.join(', ')}.`)
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'city')) {
    normalizedPatch.city = normalizeText(patch.city).slice(0, 100)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'note')) {
    normalizedPatch.note = String(patch.note ?? '').trim().slice(0, 2000)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    const status = normalizeDeviceBasicStatus(patch.status)
    normalizedPatch.status = status
    if (DEVICE_BASIC_FORBIDDEN_OCCUPIED_STATUS_VALUES.has(status)) {
      blockers.push(`Device status ${status} is occupancy-derived and cannot be manually written by device.basic.update.`)
    } else if (!DEVICE_BASIC_ALLOWED_STATUS_VALUES.has(status)) {
      blockers.push(`Unsupported device.basic.update status: ${patch.status}. Allowed status values are idle, repair, offline.`)
    }
  }

  if (!Object.keys(normalizedPatch).length && !unsupportedFields.length) {
    blockers.push('payload.patch must include at least one allowed field: city, note, status.')
  }

  return {
    normalizedPatch,
    blockers,
  }
}

function buildDeviceBasicAfterSnapshot(beforeSnapshot, patch = {}) {
  if (!beforeSnapshot) return null
  const afterSnapshot = { ...beforeSnapshot }
  if (Object.prototype.hasOwnProperty.call(patch, 'city')) afterSnapshot.city = patch.city ?? ''
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) afterSnapshot.status = patch.status || null
  if (Object.prototype.hasOwnProperty.call(patch, 'note')) {
    const note = String(patch.note || '')
    afterSnapshot.note = {
      hasValue: Boolean(note.trim()),
      length: note.length,
      preview: note ? `${note.slice(0, 2)}***${note.slice(-2)}` : '',
    }
  }
  return afterSnapshot
}

function buildDisabledImpact() {
  return {
    summary: 'safeOps execute is disabled for this operation. No business write, database write, Python bridge call, or external service call will execute.',
    affectedRecords: [],
    externalEffects: [],
  }
}

function buildExecuteDisabledResponse(operationType, policy) {
  return {
    ok: false,
    supported: true,
    code: 'SAFE_OP_EXECUTE_DISABLED',
    message: 'safeOps execute is disabled for this operationType. Only explicitly gated internal DB operations are enabled.',
    operationType,
    mode: 'execute-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [
      'This operationType is not enabled for real write.',
      'Start from preview; future write capability requires separate operation-level approval.',
    ],
    impact: buildDisabledImpact(),
    requiresConfirm: true,
    requiresIdempotencyKey: true,
    confirmToken: null,
    execute: {
      enabled: false,
      code: 'SAFE_OP_EXECUTE_DISABLED',
      writeWillExecute: false,
      externalCallWillExecute: false,
    },
  }
}

async function persistDisabledExecuteAudit(request, policy, baseResponse) {
  try {
    const { persistSafeOperationContext } = require('./safeOpsPersistence')
    const persistence = await persistSafeOperationContext({
      request,
      policy,
      impact: baseResponse.impact,
      previewResponse: baseResponse,
      mode: 'execute-disabled',
      status: 'disabled',
      issueConfirmToken: false,
      rollback: {
        planned: false,
        canRollback: false,
        compensationRequired: false,
        reason: 'execute-disabled-no-write-executed',
      },
    })
    return {
      ...baseResponse,
      persistence: persistence.persistence,
      audit: persistence.audit,
      confirmRequirement: persistence.confirmRequirement,
      idempotency: persistence.idempotency,
      rollback: persistence.rollback,
    }
  } catch (_error) {
    return baseResponse
  }
}

function buildRejectedResponse({ operationType, policy, blockers, message = 'safeOps execute rejected safely' }) {
  return {
    ok: false,
    supported: true,
    code: 'SAFE_OP_EXECUTE_REJECTED',
    message,
    operationType,
    mode: 'execute-rejected',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers,
    impact: {
      summary: 'No business write was executed.',
      affectedRecords: [],
      externalEffects: [],
    },
    rollback: {
      mode: 'db',
      planned: true,
      canRollback: false,
      compensationRequired: false,
      status: 'not_executable',
      reason: 'no-write-executed',
    },
  }
}

function duplicateResponseFromIdempotency(record = {}) {
  const response = record.response || {}
  return {
    ...response,
    ok: true,
    mode: 'write',
    writeWillExecute: false,
    externalCallWillExecute: false,
    idempotency: {
      ...(response.idempotency || {}),
      mode: 'db',
      duplicate: true,
      status: record.status || 'executed',
      keyHash: record.keyHash,
      reason: 'same-result-returned-from-idempotency',
    },
  }
}

async function executeOrderInternalNoteUpdate(request = {}, policy = {}) {
  assertLocalSafeOpsWriteTarget()

  const operationType = ORDER_INTERNAL_NOTE_OPERATION_TYPE
  const actor = normalizeActor(request.actor || {})
  const { orderId, internalNote, rawPayload } = getInternalNotePayload(request)
  const unsupportedFields = findUnsupportedInternalNoteFields(rawPayload)
  const blockers = []

  if (!actor.id || actor.id === 'unknown') blockers.push('actor.id is required for safeOps execute.')
  if (!orderId) blockers.push('orderId is required for order.internal_note.update.')
  if (rawPayload.internalNote === undefined && rawPayload.internal_note === undefined) {
    blockers.push('internalNote is required for order.internal_note.update.')
  }
  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload fields for order.internal_note.update: ${unsupportedFields.join(', ')}.`)
  }
  if (!request.confirmTokenId) blockers.push('confirmTokenId is required for safeOps execute.')
  if (!request.auditLogId) blockers.push('auditLogId is required for safeOps execute.')
  if (!request.impactHash) blockers.push('impactHash from preview is required for safeOps execute.')

  if (blockers.length) {
    return buildRejectedResponse({ operationType, policy, blockers })
  }

  const repository = await createSafeOpsRepository({ enabled: true })
  const health = typeof repository.healthCheckSafeOpsTables === 'function'
    ? await repository.healthCheckSafeOpsTables()
    : { available: false, reason: repository.reason || 'safeOps repository unavailable' }
  if (!health.available) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: [health.reason || 'safeOps DB persistence is unavailable.'],
    })
  }

  const payloadHash = hashPayload(rawPayload)
  const stableIdempotencyKey = buildStableIdempotencyKey({
    actor,
    operationType,
    payloadHash,
  })
  const keyHash = hashIdempotencyKey(stableIdempotencyKey)
  const idempotencyResult = await repository.getIdempotencyKey({
    actorId: actor.id,
    operationType,
    keyHash,
  })
  const idempotencyRecord = idempotencyResult.record

  if (!idempotencyRecord) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['idempotency key is missing; execute must start from preview.'],
    })
  }
  if (idempotencyRecord.payloadHash !== payloadHash) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['payload hash does not match idempotency record.'],
    })
  }
  if (idempotencyRecord.status === 'executed' && idempotencyRecord.response) {
    return duplicateResponseFromIdempotency(idempotencyRecord)
  }

  const confirmResult = await repository.getConfirmToken({ id: request.confirmTokenId })
  const confirmRecord = confirmResult.record
  if (!confirmRecord) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['confirm token record is missing.'],
    })
  }
  if (confirmRecord.operationType !== operationType) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token operationType mismatch.'] })
  }
  if (confirmRecord.actorId !== actor.id) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token actor mismatch.'] })
  }
  if (confirmRecord.payloadHash !== payloadHash) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token payloadHash mismatch.'] })
  }
  if (confirmRecord.impactHash !== request.impactHash) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token impactHash mismatch.'] })
  }
  if (String(confirmRecord.previewAuditLogId || '') !== String(request.auditLogId || '')) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token preview audit mismatch.'] })
  }

  const beforeResult = await repository.getRentalOrderInternalNoteSnapshot({ orderId })
  if (!beforeResult.record || !beforeResult.raw) {
    return buildRejectedResponse({ operationType, policy, blockers: ['target order does not exist in local rental_orders.'] })
  }
  const beforeSnapshot = beforeResult.record
  const afterSnapshot = buildInternalNoteAfterSnapshot(beforeSnapshot, internalNote)

  const consumeResult = await repository.consumeConfirmToken({
    id: request.confirmTokenId,
    actorId: actor.id,
    operationType,
    payloadHash,
    impactHash: request.impactHash,
    previewAuditLogId: request.auditLogId,
  })
  if (!consumeResult.consumed) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['confirm token is expired, consumed, or no longer valid.'],
    })
  }

  const updateResult = await repository.updateRentalOrderInternalNote({
    id: beforeResult.raw.id,
    internalNote,
  })
  if (updateResult.affectedRows !== 1) {
    await repository.updateAuditLogStatus({
      id: request.auditLogId,
      status: 'failed',
      errorCode: 'SAFE_OP_UPDATE_FAILED',
      errorMessage: 'internal_note update affected no rows',
      beforeSnapshot,
      afterSnapshot,
    })
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['internal_note update affected no rows.'],
      message: 'safeOps execute failed safely',
    })
  }

  const refreshedResult = await repository.getRentalOrderInternalNoteSnapshot({ orderId: beforeResult.raw.id })
  const response = {
    ok: true,
    supported: true,
    operationType,
    mode: 'write',
    code: 'SAFE_OP_EXECUTED',
    message: 'order.internal_note.update executed through safeOps.',
    writeWillExecute: true,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [],
    impact: {
      summary: 'Updated local rental_orders.internal_note only. No external service was called.',
      affectedRecords: [{ type: 'order', id: beforeSnapshot.orderId, field: 'internal_note' }],
      externalEffects: [],
    },
    audit: {
      mode: 'db',
      persisted: true,
      auditLogId: request.auditLogId,
      status: 'executed',
      payloadHash,
      impactHash: request.impactHash,
    },
    confirmRequirement: {
      enabled: true,
      required: true,
      persisted: true,
      exists: true,
      tokenId: request.confirmTokenId,
      token: null,
      tokenHash: null,
      status: 'consumed',
    },
    idempotency: {
      mode: 'db',
      required: true,
      persisted: true,
      id: idempotencyRecord.id,
      keyHash,
      status: 'executed',
      duplicate: false,
      reason: 'idempotency-result-recorded',
    },
    rollback: {
      mode: 'db',
      planned: true,
      persisted: true,
      status: 'not_executable',
      canRollback: false,
      compensationRequired: false,
      reason: 'rollback-placeholder-not-executable',
    },
    beforeSnapshot,
    afterSnapshot: refreshedResult.record || afterSnapshot,
  }

  await repository.updateAuditLogStatus({
    id: request.auditLogId,
    status: 'executed',
    beforeSnapshot,
    afterSnapshot: response.afterSnapshot,
  })
  await repository.markIdempotencyResult({
    id: idempotencyRecord.id,
    status: 'executed',
    response,
    auditLogId: request.auditLogId,
  })

  return response
}

async function executeDeviceBasicUpdate(request = {}, policy = {}) {
  assertLocalSafeOpsWriteTarget()

  const operationType = DEVICE_BASIC_UPDATE_OPERATION_TYPE
  const actor = normalizeActor(request.actor || {})
  const { unitId, patch, rawPayload } = getDeviceBasicPayload(request)
  const unsupportedPayloadFields = findUnsupportedDeviceBasicPayloadFields(rawPayload)
  const normalized = normalizeDeviceBasicPatch(patch)
  const blockers = [...normalized.blockers]

  if (!actor.id || actor.id === 'unknown') blockers.push('actor.id is required for safeOps execute.')
  if (!unitId) blockers.push('unitId or deviceId is required for device.basic.update.')
  if (unsupportedPayloadFields.length) {
    blockers.push(`Unsupported payload fields for device.basic.update: ${unsupportedPayloadFields.join(', ')}.`)
  }
  if (!request.confirmTokenId) blockers.push('confirmTokenId is required for safeOps execute.')
  if (!request.auditLogId) blockers.push('auditLogId is required for safeOps execute.')
  if (!request.impactHash) blockers.push('impactHash from preview is required for safeOps execute.')

  if (blockers.length) {
    return buildRejectedResponse({ operationType, policy, blockers })
  }

  const repository = await createSafeOpsRepository({ enabled: true })
  const health = typeof repository.healthCheckSafeOpsTables === 'function'
    ? await repository.healthCheckSafeOpsTables()
    : { available: false, reason: repository.reason || 'safeOps repository unavailable' }
  if (!health.available) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: [health.reason || 'safeOps DB persistence is unavailable.'],
    })
  }

  const payloadHash = hashPayload(rawPayload)
  const stableIdempotencyKey = buildStableIdempotencyKey({
    actor,
    operationType,
    payloadHash,
  })
  const keyHash = hashIdempotencyKey(stableIdempotencyKey)
  const idempotencyResult = await repository.getIdempotencyKey({
    actorId: actor.id,
    operationType,
    keyHash,
  })
  const idempotencyRecord = idempotencyResult.record

  if (!idempotencyRecord) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['idempotency key is missing; execute must start from preview.'],
    })
  }
  if (idempotencyRecord.payloadHash !== payloadHash) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['payload hash does not match idempotency record.'],
    })
  }
  if (idempotencyRecord.status === 'executed' && idempotencyRecord.response) {
    return duplicateResponseFromIdempotency(idempotencyRecord)
  }

  const confirmResult = await repository.getConfirmToken({ id: request.confirmTokenId })
  const confirmRecord = confirmResult.record
  if (!confirmRecord) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['confirm token record is missing.'],
    })
  }
  if (confirmRecord.operationType !== operationType) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token operationType mismatch.'] })
  }
  if (confirmRecord.actorId !== actor.id) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token actor mismatch.'] })
  }
  if (confirmRecord.payloadHash !== payloadHash) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token payloadHash mismatch.'] })
  }
  if (confirmRecord.impactHash !== request.impactHash) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token impactHash mismatch.'] })
  }
  if (String(confirmRecord.previewAuditLogId || '') !== String(request.auditLogId || '')) {
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token preview audit mismatch.'] })
  }

  const beforeResult = await repository.getScheduleUnitBasicSnapshot({ unitId })
  if (!beforeResult.record || !beforeResult.raw) {
    return buildRejectedResponse({ operationType, policy, blockers: ['target device does not exist in local schedule_units.'] })
  }

  const currentStatus = normalizeDeviceBasicStatus(beforeResult.raw.status)
  if (Object.prototype.hasOwnProperty.call(normalized.normalizedPatch, 'status')
    && normalized.normalizedPatch.status !== currentStatus) {
    const risk = await repository.getScheduleUnitOccupationRisk({ unitId: beforeResult.raw.id })
    if (!risk.available) {
      return buildRejectedResponse({
        operationType,
        policy,
        blockers: [risk.reason || 'Cannot verify device occupation risk; status update is blocked.'],
      })
    }
    if (risk.hasRisk) {
      return buildRejectedResponse({
        operationType,
        policy,
        blockers: [`Status update blocked: device has ${risk.blockCount || 0} active/current-future schedule block(s) and ${risk.orderCount || 0} unfinished order(s).`],
      })
    }
  }

  const beforeSnapshot = beforeResult.record
  const afterSnapshot = buildDeviceBasicAfterSnapshot(beforeSnapshot, normalized.normalizedPatch)

  const consumeResult = await repository.consumeConfirmToken({
    id: request.confirmTokenId,
    actorId: actor.id,
    operationType,
    payloadHash,
    impactHash: request.impactHash,
    previewAuditLogId: request.auditLogId,
  })
  if (!consumeResult.consumed) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['confirm token is expired, consumed, or no longer valid.'],
    })
  }

  const updateResult = await repository.updateScheduleUnitBasicFields({
    id: beforeResult.raw.id,
    patch: normalized.normalizedPatch,
  })
  if (updateResult.affectedRows !== 1) {
    await repository.updateAuditLogStatus({
      id: request.auditLogId,
      status: 'failed',
      errorCode: 'SAFE_OP_UPDATE_FAILED',
      errorMessage: 'device.basic.update affected no rows',
      beforeSnapshot,
      afterSnapshot,
    })
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['device.basic.update affected no rows.'],
      message: 'safeOps execute failed safely',
    })
  }

  const refreshedResult = await repository.getScheduleUnitBasicSnapshot({ unitId: beforeResult.raw.id })
  const response = {
    ok: true,
    supported: true,
    operationType,
    mode: 'write',
    code: 'SAFE_OP_EXECUTED',
    message: 'device.basic.update executed through safeOps.',
    writeWillExecute: true,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [],
    impact: {
      summary: 'Updated local schedule_units city/note/status only. No external service was called.',
      affectedRecords: Object.keys(normalized.normalizedPatch).map((field) => ({
        type: 'schedule_unit',
        id: String(beforeResult.raw.id),
        field,
      })),
      externalEffects: [],
    },
    audit: {
      mode: 'db',
      persisted: true,
      auditLogId: request.auditLogId,
      status: 'executed',
      payloadHash,
      impactHash: request.impactHash,
    },
    confirmRequirement: {
      enabled: true,
      required: true,
      persisted: true,
      exists: true,
      tokenId: request.confirmTokenId,
      token: null,
      tokenHash: null,
      status: 'consumed',
    },
    idempotency: {
      mode: 'db',
      required: true,
      persisted: true,
      id: idempotencyRecord.id,
      keyHash,
      status: 'executed',
      duplicate: false,
      reason: 'idempotency-result-recorded',
    },
    rollback: {
      mode: 'db',
      planned: true,
      persisted: true,
      status: 'not_executable',
      canRollback: false,
      compensationRequired: false,
      reason: 'rollback-placeholder-not-executable',
    },
    beforeSnapshot,
    afterSnapshot: refreshedResult.record || afterSnapshot,
  }

  await repository.updateAuditLogStatus({
    id: request.auditLogId,
    status: 'executed',
    beforeSnapshot,
    afterSnapshot: response.afterSnapshot,
  })
  await repository.markIdempotencyResult({
    id: idempotencyRecord.id,
    status: 'executed',
    response,
    auditLogId: request.auditLogId,
  })

  return response
}

async function executeSafeOperation(request = {}) {
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

    if (!ENABLED_OPERATION_TYPES.has(operationType) || !policy.allowExecute) {
      return persistDisabledExecuteAudit(
        { ...request, operationType },
        policy,
        buildExecuteDisabledResponse(operationType, policy)
      )
    }

    if (operationType === ORDER_INTERNAL_NOTE_OPERATION_TYPE) {
      return executeOrderInternalNoteUpdate({ ...request, operationType }, policy)
    }
    if (operationType === DEVICE_BASIC_UPDATE_OPERATION_TYPE) {
      return executeDeviceBasicUpdate({ ...request, operationType }, policy)
    }

    return persistDisabledExecuteAudit(
      { ...request, operationType },
      policy,
      buildExecuteDisabledResponse(operationType, policy)
    )
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
