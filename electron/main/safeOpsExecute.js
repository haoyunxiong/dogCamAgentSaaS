const {
  EXECUTE_POLICY,
  buildUnsupportedOperationResponse,
  getOperationPolicy,
  normalizeOperationType,
} = require('./safeOpsPolicy')
const {
  evaluateSafeOpsPermission,
  normalizeActorContext,
} = require('./safeOpsActorContext')
const { executeExternalOperation } = require('./safeOpsExternalGateway')
const { isExternalOperationType } = require('./safeOpsExternalPolicy')
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
const SCHEDULE_BLOCK_CREATE_OPERATION_TYPE = 'schedule.block.create'
const SCHEDULE_BLOCK_CANCEL_OPERATION_TYPE = 'schedule.block.cancel'
const LOGISTICS_LOCAL_RECORD_CREATE_OPERATION_TYPE = 'logistics.local_record.create'
const ENABLED_OPERATION_TYPES = new Set([
  ORDER_INTERNAL_NOTE_OPERATION_TYPE,
  DEVICE_BASIC_UPDATE_OPERATION_TYPE,
  SCHEDULE_BLOCK_CREATE_OPERATION_TYPE,
  SCHEDULE_BLOCK_CANCEL_OPERATION_TYPE,
  LOGISTICS_LOCAL_RECORD_CREATE_OPERATION_TYPE,
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

const SCHEDULE_CREATE_ALLOWED_BLOCK_TYPES = new Set(['manual_hold', 'internal_hold', 'maintenance', 'block', 'buffer'])
const SCHEDULE_CREATE_ALLOWED_STATUSES = new Set(['active'])
const SCHEDULE_CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'deleted', 'inactive'])
const LOGISTICS_LOCAL_ALLOWED_CARRIERS = new Set(['manual', 'sf', 'jd', 'ems', 'deppon', 'zto', 'sto', 'yto', 'yunda', 'other'])
const LOGISTICS_LOCAL_ALLOWED_SHIPPING_MODES = new Set(['manual', 'express', 'pickup', 'dropoff', 'same_city', 'return'])
const LOGISTICS_LOCAL_ALLOWED_STATUSES = new Set(['pending', 'pending_pickup', 'picked_up', 'in_transit', 'delivered', 'returned', 'exception', 'cancelled', 'manual_recorded'])

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

function normalizeDateOnly(value) {
  const text = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const date = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10) === text ? text : ''
}

function normalizeDateTimeText(value) {
  const text = normalizeText(value).replace('T', ' ')
  if (!text) return ''
  if (!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(text)) return ''
  return text.slice(0, 30)
}

function getScheduleBlockCreatePayload(request = {}) {
  const payload = request.payload || {}
  return {
    unitId: normalizeText(payload.unitId || payload.deviceId || request.target?.id),
    orderId: normalizeText(payload.orderId),
    modelCode: normalizeText(payload.modelCode),
    blockType: normalizeText(payload.blockType || payload.block_type || 'manual_hold') || 'manual_hold',
    startDate: normalizeDateOnly(payload.startDate || payload.start_date),
    endDate: normalizeDateOnly(payload.endDate || payload.end_date),
    plannedShipAt: normalizeText(payload.plannedShipAt || payload.planned_ship_at),
    expectedArriveAt: normalizeText(payload.expectedArriveAt || payload.expected_arrive_at),
    status: normalizeText(payload.status || 'active') || 'active',
    note: String(payload.note ?? '').trim().slice(0, 2000),
    rawPayload: payload,
  }
}

function getScheduleBlockCancelPayload(request = {}) {
  const payload = request.payload || {}
  return {
    blockId: normalizeText(payload.blockId || payload.block_id || payload.scheduleBlockId || request.target?.id),
    rawPayload: payload,
  }
}

function findUnsupportedScheduleCreatePayloadFields(payload = {}) {
  return Object.keys(payload).filter((key) => ![
    'unitId',
    'deviceId',
    'orderId',
    'modelCode',
    'blockType',
    'block_type',
    'startDate',
    'start_date',
    'endDate',
    'end_date',
    'plannedShipAt',
    'planned_ship_at',
    'expectedArriveAt',
    'expected_arrive_at',
    'status',
    'note',
    'source',
    'reason',
  ].includes(key))
}

function findUnsupportedScheduleCancelPayloadFields(payload = {}) {
  return Object.keys(payload).filter((key) => ![
    'blockId',
    'block_id',
    'scheduleBlockId',
    'source',
    'reason',
  ].includes(key))
}

function getLogisticsLocalRecordPayload(request = {}) {
  const payload = request.payload || {}
  return {
    orderId: normalizeText(payload.orderId || payload.order_id || request.target?.id),
    carrier: normalizeText(payload.carrier || 'manual').toLowerCase() || 'manual',
    trackingNo: normalizeText(payload.trackingNo || payload.tracking_no),
    shippingMode: normalizeText(payload.shippingMode || payload.shipping_mode || 'manual').toLowerCase() || 'manual',
    latestStatus: normalizeText(payload.latestStatus || payload.latest_status || 'manual_recorded').toLowerCase() || 'manual_recorded',
    shipFromCity: normalizeText(payload.shipFromCity || payload.ship_from_city).slice(0, 100),
    shipToCity: normalizeText(payload.shipToCity || payload.ship_to_city).slice(0, 100),
    plannedShipAt: normalizeDateTimeText(payload.plannedShipAt || payload.planned_ship_at),
    actualShipAt: normalizeDateTimeText(payload.actualShipAt || payload.actual_ship_at),
    expectedArriveAt: normalizeDateTimeText(payload.expectedArriveAt || payload.expected_arrive_at),
    actualArriveAt: normalizeDateTimeText(payload.actualArriveAt || payload.actual_arrive_at),
    rawPayload: payload,
  }
}

function findUnsupportedLogisticsLocalPayloadFields(payload = {}) {
  return Object.keys(payload).filter((key) => ![
    'orderId',
    'order_id',
    'carrier',
    'trackingNo',
    'tracking_no',
    'shippingMode',
    'shipping_mode',
    'latestStatus',
    'latest_status',
    'shipFromCity',
    'ship_from_city',
    'shipToCity',
    'ship_to_city',
    'plannedShipAt',
    'planned_ship_at',
    'actualShipAt',
    'actual_ship_at',
    'expectedArriveAt',
    'expected_arrive_at',
    'actualArriveAt',
    'actual_arrive_at',
    'source',
    'reason',
  ].includes(key))
}

function buildLogisticsLocalBlockers(payload = {}) {
  const blockers = []
  const unsupportedFields = findUnsupportedLogisticsLocalPayloadFields(payload.rawPayload)
  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload fields for logistics.local_record.create: ${unsupportedFields.join(', ')}.`)
  }
  if (!payload.orderId) blockers.push('orderId is required for logistics.local_record.create.')
  if (!payload.trackingNo) blockers.push('trackingNo is required for logistics.local_record.create.')
  if (!LOGISTICS_LOCAL_ALLOWED_CARRIERS.has(payload.carrier)) {
    blockers.push(`Unsupported carrier for logistics.local_record.create: ${payload.carrier}.`)
  }
  if (!LOGISTICS_LOCAL_ALLOWED_SHIPPING_MODES.has(payload.shippingMode)) {
    blockers.push(`Unsupported shippingMode for logistics.local_record.create: ${payload.shippingMode}.`)
  }
  if (!LOGISTICS_LOCAL_ALLOWED_STATUSES.has(payload.latestStatus)) {
    blockers.push(`Unsupported latestStatus for logistics.local_record.create: ${payload.latestStatus}.`)
  }
  for (const [key, rawKey, snakeKey] of [
    ['plannedShipAt', 'plannedShipAt', 'planned_ship_at'],
    ['actualShipAt', 'actualShipAt', 'actual_ship_at'],
    ['expectedArriveAt', 'expectedArriveAt', 'expected_arrive_at'],
    ['actualArriveAt', 'actualArriveAt', 'actual_arrive_at'],
  ]) {
    const supplied = payload.rawPayload[rawKey] || payload.rawPayload[snakeKey]
    if (supplied && !payload[key]) blockers.push(`${rawKey} must use YYYY-MM-DD or YYYY-MM-DD HH:mm format.`)
  }
  return blockers
}

function maskLocalText(value) {
  const text = String(value || '')
  if (!text) return ''
  if (text.length <= 4) return '<redacted>'
  return `${text.slice(0, 2)}***${text.slice(-2)}`
}

function buildLogisticsLocalAfterSnapshot(payload, shippingRecordId = null) {
  return {
    shippingRecordId: shippingRecordId === null || shippingRecordId === undefined ? null : String(shippingRecordId),
    orderId: payload.orderId || null,
    carrier: payload.carrier,
    trackingNoMasked: maskLocalText(payload.trackingNo),
    shippingMode: payload.shippingMode,
    latestStatus: payload.latestStatus,
    shipFromCity: payload.shipFromCity || null,
    shipToCity: payload.shipToCity || null,
    plannedShipAt: payload.plannedShipAt || null,
    actualShipAt: payload.actualShipAt || null,
    expectedArriveAt: payload.expectedArriveAt || null,
    actualArriveAt: payload.actualArriveAt || null,
  }
}

function buildDuplicateRecordCheck(duplicateResult = {}, blockers = []) {
  return {
    checked: true,
    passed: !blockers.length && !duplicateResult.exists,
    duplicate: Boolean(duplicateResult.exists),
    duplicateRecord: duplicateResult.record || null,
  }
}

function summarizeScheduleNote(value) {
  const text = String(value || '')
  return {
    hasValue: Boolean(text.trim()),
    length: text.length,
    preview: text ? `${text.slice(0, 2)}***${text.slice(-2)}` : '',
  }
}

function buildScheduleCreateAfterSnapshot(payload, blockId = null, unitRecord = null) {
  return {
    blockId: blockId === null || blockId === undefined ? null : String(blockId),
    unitId: String(unitRecord?.unitId || payload.unitId),
    orderId: payload.orderId || null,
    unitCodeMasked: unitRecord?.unitCodeMasked || null,
    modelCode: unitRecord?.modelCode || payload.modelCode,
    blockType: payload.blockType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    plannedShipAt: payload.plannedShipAt || null,
    expectedArriveAt: payload.expectedArriveAt || null,
    status: payload.status,
    note: summarizeScheduleNote(payload.note),
  }
}

function buildScheduleCancelAfterSnapshot(beforeSnapshot = {}) {
  return {
    ...(beforeSnapshot || {}),
    status: 'cancelled',
  }
}

function buildScheduleCreateBlockers(payload = {}) {
  const blockers = []
  const unsupportedFields = findUnsupportedScheduleCreatePayloadFields(payload.rawPayload)
  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload fields for schedule.block.create: ${unsupportedFields.join(', ')}.`)
  }
  if (Array.isArray(payload.rawPayload.blocks) || Array.isArray(payload.rawPayload.unitId) || Array.isArray(payload.rawPayload.deviceId)) {
    blockers.push('Batch schedule block creation is disabled; schedule.block.create only accepts one unit_id.')
  }
  if (!payload.unitId) blockers.push('unitId or deviceId is required for schedule.block.create.')
  if (!payload.startDate) blockers.push('Valid startDate is required for schedule.block.create.')
  if (!payload.endDate) blockers.push('Valid endDate is required for schedule.block.create.')
  if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) {
    blockers.push('startDate must be before or equal to endDate.')
  }
  if (!SCHEDULE_CREATE_ALLOWED_BLOCK_TYPES.has(payload.blockType)) {
    blockers.push(`Unsupported blockType for schedule.block.create: ${payload.blockType}.`)
  }
  if (!SCHEDULE_CREATE_ALLOWED_STATUSES.has(payload.status)) {
    blockers.push(`Unsupported initial status for schedule.block.create: ${payload.status}.`)
  }
  return blockers
}

function buildScheduleConflictCheck(conflicts, blockers = []) {
  const conflictRecords = Array.isArray(conflicts?.records) ? conflicts.records : []
  return {
    checked: true,
    passed: !blockers.length && conflictRecords.length === 0,
    conflictCount: conflictRecords.length,
    conflicts: conflictRecords,
  }
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

async function executeScheduleBlockCreate(request = {}, policy = {}) {
  assertLocalSafeOpsWriteTarget()

  const operationType = SCHEDULE_BLOCK_CREATE_OPERATION_TYPE
  const actor = normalizeActor(request.actor || {})
  const payload = getScheduleBlockCreatePayload(request)
  const blockers = buildScheduleCreateBlockers(payload)

  if (!actor.id || actor.id === 'unknown') blockers.push('actor.id is required for safeOps execute.')
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

  const payloadHash = hashPayload(payload.rawPayload)
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
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token record is missing.'] })
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

  const unitResult = await repository.getScheduleUnitForBlock({ unitId: payload.unitId })
  if (!unitResult.record || !unitResult.raw) {
    return buildRejectedResponse({ operationType, policy, blockers: ['target unit does not exist in local schedule_units.'] })
  }
  if (payload.modelCode && payload.modelCode !== unitResult.raw.model_code) {
    return buildRejectedResponse({ operationType, policy, blockers: ['modelCode does not match the target schedule unit.'] })
  }
  let normalizedOrderId = payload.orderId || null
  if (payload.orderId) {
    const orderResult = await repository.getRentalOrderExists({ orderId: payload.orderId })
    if (!orderResult.exists) {
      return buildRejectedResponse({ operationType, policy, blockers: ['linked order_id does not exist in local rental_orders.'] })
    }
    if (orderResult.raw?.id) normalizedOrderId = String(orderResult.raw.id)
  }
  const conflicts = await repository.listScheduleBlockConflicts({
    unitId: unitResult.raw.id,
    startDate: payload.startDate,
    endDate: payload.endDate,
  })
  if (!conflicts.available) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: [conflicts.reason || 'safeOps DB persistence is unavailable for conflict check.'],
    })
  }
  if (conflicts.count > 0) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: [`Schedule conflict detected: ${conflicts.count} overlapping active/current block(s).`],
    })
  }

  const normalizedPayload = {
    unitId: String(unitResult.raw.id),
    orderId: normalizedOrderId,
    modelCode: unitResult.raw.model_code,
    blockType: payload.blockType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    plannedShipAt: payload.plannedShipAt || null,
    expectedArriveAt: payload.expectedArriveAt || null,
    status: payload.status,
    note: payload.note,
  }
  const beforeSnapshot = {
    unit: unitResult.record,
    conflictCheck: buildScheduleConflictCheck(conflicts, []),
  }
  const previewAfterSnapshot = buildScheduleCreateAfterSnapshot(normalizedPayload, null, unitResult.record)

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

  const insertResult = await repository.insertScheduleBlock(normalizedPayload)
  if (insertResult.affectedRows !== 1 || !insertResult.insertId) {
    await repository.updateAuditLogStatus({
      id: request.auditLogId,
      status: 'failed',
      errorCode: 'SAFE_OP_INSERT_FAILED',
      errorMessage: 'schedule.block.create affected no rows',
      beforeSnapshot,
      afterSnapshot: previewAfterSnapshot,
    })
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['schedule.block.create affected no rows.'],
      message: 'safeOps execute failed safely',
    })
  }

  const createdResult = await repository.getScheduleBlockSnapshot({ blockId: insertResult.insertId })
  const response = {
    ok: true,
    supported: true,
    operationType,
    mode: 'write',
    code: 'SAFE_OP_EXECUTED',
    message: 'schedule.block.create executed through safeOps.',
    writeWillExecute: true,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [],
    conflictCheck: buildScheduleConflictCheck(conflicts, []),
    impact: {
      summary: 'Inserted one local schedule_blocks row only. No order, device, logistics, Python, or external service was changed.',
      affectedRecords: [
        { type: 'schedule_block', id: String(insertResult.insertId), action: 'create' },
        { type: 'unit', id: String(unitResult.raw.id) },
      ],
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
    afterSnapshot: createdResult.record || buildScheduleCreateAfterSnapshot(normalizedPayload, insertResult.insertId, unitResult.record),
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

async function executeScheduleBlockCancel(request = {}, policy = {}) {
  assertLocalSafeOpsWriteTarget()

  const operationType = SCHEDULE_BLOCK_CANCEL_OPERATION_TYPE
  const actor = normalizeActor(request.actor || {})
  const payload = getScheduleBlockCancelPayload(request)
  const blockers = []
  const unsupportedFields = findUnsupportedScheduleCancelPayloadFields(payload.rawPayload)

  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload fields for schedule.block.cancel: ${unsupportedFields.join(', ')}.`)
  }
  if (!actor.id || actor.id === 'unknown') blockers.push('actor.id is required for safeOps execute.')
  if (!payload.blockId) blockers.push('blockId is required for schedule.block.cancel.')
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

  const payloadHash = hashPayload(payload.rawPayload)
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
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token record is missing.'] })
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

  const beforeResult = await repository.getScheduleBlockSnapshot({ blockId: payload.blockId })
  if (!beforeResult.record || !beforeResult.raw) {
    return buildRejectedResponse({ operationType, policy, blockers: ['target schedule block does not exist.'] })
  }
  if (SCHEDULE_CANCELLED_STATUSES.has(normalizeText(beforeResult.raw.status).toLowerCase())) {
    return buildRejectedResponse({ operationType, policy, blockers: ['target schedule block is already cancelled or inactive.'] })
  }

  const beforeSnapshot = beforeResult.record
  const afterSnapshot = buildScheduleCancelAfterSnapshot(beforeSnapshot)
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

  const cancelResult = await repository.cancelScheduleBlock({ blockId: beforeResult.raw.id })
  if (cancelResult.affectedRows !== 1) {
    await repository.updateAuditLogStatus({
      id: request.auditLogId,
      status: 'failed',
      errorCode: 'SAFE_OP_UPDATE_FAILED',
      errorMessage: 'schedule.block.cancel affected no rows',
      beforeSnapshot,
      afterSnapshot,
    })
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['schedule.block.cancel affected no rows.'],
      message: 'safeOps execute failed safely',
    })
  }

  const refreshedResult = await repository.getScheduleBlockSnapshot({ blockId: beforeResult.raw.id })
  const response = {
    ok: true,
    supported: true,
    operationType,
    mode: 'write',
    code: 'SAFE_OP_EXECUTED',
    message: 'schedule.block.cancel executed through safeOps.',
    writeWillExecute: true,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [],
    conflictCheck: {
      checked: false,
      passed: true,
      reason: 'cancel operation validates current block status instead of date conflicts',
    },
    impact: {
      summary: 'Soft-cancelled one local schedule_blocks row only. No order, device, logistics, Python, or external service was changed.',
      affectedRecords: [{ type: 'schedule_block', id: String(beforeResult.raw.id), action: 'cancel' }],
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

async function executeLogisticsLocalRecordCreate(request = {}, policy = {}) {
  assertLocalSafeOpsWriteTarget()

  const operationType = LOGISTICS_LOCAL_RECORD_CREATE_OPERATION_TYPE
  const actor = normalizeActor(request.actor || {})
  const payload = getLogisticsLocalRecordPayload(request)
  const blockers = buildLogisticsLocalBlockers(payload)

  if (!actor.id || actor.id === 'unknown') blockers.push('actor.id is required for safeOps execute.')
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

  const payloadHash = hashPayload(payload.rawPayload)
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
    return buildRejectedResponse({ operationType, policy, blockers: ['confirm token record is missing.'] })
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

  const orderResult = await repository.getRentalOrderForLocalShipping({ orderId: payload.orderId })
  if (!orderResult.exists || !orderResult.raw) {
    return buildRejectedResponse({ operationType, policy, blockers: ['linked order_id does not exist in local rental_orders.'] })
  }
  const normalizedPayload = {
    ...payload,
    orderId: String(orderResult.raw.id),
  }
  const duplicateResult = await repository.getShippingDuplicateRecord({
    orderId: orderResult.raw.id,
    carrier: payload.carrier,
    trackingNo: payload.trackingNo,
  })
  if (!duplicateResult.available) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: [duplicateResult.reason || 'safeOps DB persistence is unavailable for duplicate shipping record check.'],
    })
  }
  if (duplicateResult.exists) {
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['Duplicate local shipping record exists for the same order_id + carrier + tracking_no.'],
    })
  }

  const duplicateRecordCheck = buildDuplicateRecordCheck(duplicateResult, [])
  const beforeSnapshot = {
    order: orderResult.record,
    duplicateRecordCheck,
  }
  const previewAfterSnapshot = buildLogisticsLocalAfterSnapshot(normalizedPayload)

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

  const insertResult = await repository.insertLocalShippingRecord(normalizedPayload)
  if (insertResult.affectedRows !== 1 || !insertResult.insertId) {
    await repository.updateAuditLogStatus({
      id: request.auditLogId,
      status: 'failed',
      errorCode: 'SAFE_OP_INSERT_FAILED',
      errorMessage: 'logistics.local_record.create affected no rows',
      beforeSnapshot,
      afterSnapshot: previewAfterSnapshot,
    })
    return buildRejectedResponse({
      operationType,
      policy,
      blockers: ['logistics.local_record.create affected no rows.'],
      message: 'safeOps execute failed safely',
    })
  }

  const createdResult = await repository.getShippingRecordSnapshot({ recordId: insertResult.insertId })
  const response = {
    ok: true,
    supported: true,
    operationType,
    mode: 'write',
    code: 'SAFE_OP_EXECUTED',
    message: 'logistics.local_record.create executed through safeOps.',
    writeWillExecute: true,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [],
    duplicateRecordCheck,
    impact: {
      summary: 'Inserted one local shipping_records row only. No order status, schedule, device, Python, carrier API, or external service was changed.',
      affectedRecords: [
        { type: 'shipping_record', id: String(insertResult.insertId), action: 'create' },
        { type: 'order', id: String(orderResult.raw.id), action: 'read-only-check' },
      ],
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
    afterSnapshot: createdResult.record || buildLogisticsLocalAfterSnapshot(normalizedPayload, insertResult.insertId),
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

    if (isExternalOperationType(operationType)) {
      return executeExternalOperation({ ...request, operationType })
    }

    const actorContext = normalizeActorContext(request.actor || {})
    const executePermission = evaluateSafeOpsPermission({
      actor: actorContext,
      operationType,
      action: 'execute',
    })
    if (!executePermission.allowed) {
      return persistDisabledExecuteAudit(
        { ...request, operationType, actor: actorContext },
        policy,
        {
          ...buildExecuteDisabledResponse(operationType, policy),
          code: executePermission.code,
          message: executePermission.reason,
          actorContext,
          permission: {
            execute: executePermission,
          },
          blockers: [
            executePermission.reason,
            'No business write was executed.',
          ],
        }
      )
    }

    if (!ENABLED_OPERATION_TYPES.has(operationType) || !policy.allowExecute) {
      return persistDisabledExecuteAudit(
        { ...request, operationType, actor: actorContext },
        policy,
        buildExecuteDisabledResponse(operationType, policy)
      )
    }

    if (operationType === ORDER_INTERNAL_NOTE_OPERATION_TYPE) {
      return executeOrderInternalNoteUpdate({ ...request, operationType, actor: actorContext }, policy)
    }
    if (operationType === DEVICE_BASIC_UPDATE_OPERATION_TYPE) {
      return executeDeviceBasicUpdate({ ...request, operationType, actor: actorContext }, policy)
    }
    if (operationType === SCHEDULE_BLOCK_CREATE_OPERATION_TYPE) {
      return executeScheduleBlockCreate({ ...request, operationType, actor: actorContext }, policy)
    }
    if (operationType === SCHEDULE_BLOCK_CANCEL_OPERATION_TYPE) {
      return executeScheduleBlockCancel({ ...request, operationType, actor: actorContext }, policy)
    }
    if (operationType === LOGISTICS_LOCAL_RECORD_CREATE_OPERATION_TYPE) {
      return executeLogisticsLocalRecordCreate({ ...request, operationType, actor: actorContext }, policy)
    }

    return persistDisabledExecuteAudit(
      { ...request, operationType, actor: actorContext },
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
