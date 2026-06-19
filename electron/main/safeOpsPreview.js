const {
  AUDIT_POLICY,
  EXECUTE_POLICY,
  IDEMPOTENCY_POLICY,
  buildUnsupportedOperationResponse,
  getOperationPolicy,
  normalizeOperationType,
} = require('./safeOpsPolicy')
const { persistSafeOperationContext } = require('./safeOpsPersistence')
const { createSafeOpsRepository } = require('./safeOpsRepository')
const {
  buildDepositCreatePreview,
  buildDepositFinishPreview,
} = require('./safeOpsDepositPreview')
const {
  buildDeviceDeletePreview,
  buildDeviceUpdatePreview,
} = require('./safeOpsDevicePreview')
const { buildLogisticsShipmentPreview } = require('./safeOpsLogisticsPreview')
const {
  buildOrderEditPreview,
  buildOrderStatusTransitionPreview,
} = require('./safeOpsOrderPreview')
const { buildScheduleBlockPreview } = require('./safeOpsSchedulePreview')

const IMPACT_SUMMARIES = Object.freeze({
  'order.internal_note.update': 'Order internal note update preview. This reads the local order and prepares a confirm-required internal DB write for rental_orders.internal_note only.',
  'order.status.transition.preview': 'Order status transition dry-run only. No order, schedule, logistics, or notification state will be changed.',
  'order.edit.preview': 'Order edit dry-run only. No order, fee, schedule, or logistics record will be changed.',
  'device.update.preview': 'Device update dry-run only. No device profile, inventory, or availability state will be changed.',
  'device.delete.preview': 'Device delete dry-run only. No device, schedule block, or historical order relation will be removed.',
  'schedule.block.preview': 'Schedule block dry-run only. No schedule record will be created, updated, or deleted.',
  'logistics.shipment.preview': 'Shipment dry-run only. No shipment draft will be saved, no carrier API will be called, and no cost will be incurred.',
  'deposit.create.preview': 'Deposit create dry-run only. No deposit platform API will be called and no local deposit order will be written.',
  'deposit.finish.preview': 'Deposit finish dry-run only. No deposit platform API will be called and no local deposit state will be changed.',
})

function buildPreviewImpact(operationType) {
  return {
    summary: IMPACT_SUMMARIES[operationType] || 'safeOps dry-run only. No real write will run.',
    affectedRecords: [],
    externalEffects: [],
  }
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeInternalNote(value) {
  const text = String(value ?? '').trim()
  return text.length > 5000 ? text.slice(0, 5000) : text
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

function getOrderInternalNotePayload(request = {}) {
  const payload = request.payload || {}
  return {
    orderId: normalizeText(payload.orderId || request.target?.id),
    internalNote: normalizeInternalNote(payload.internalNote ?? payload.internal_note),
    rawPayload: payload,
  }
}

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
  const warnings = []
  const blockers = []
  const unsupportedFields = Object.keys(patch).filter((field) => !DEVICE_BASIC_ALLOWED_FIELDS.includes(field))

  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload.patch fields for device.basic.update: ${unsupportedFields.join(', ')}.`)
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'city')) {
    const city = normalizeText(patch.city)
    normalizedPatch.city = city.length > 100 ? city.slice(0, 100) : city
    if (city.length > 100) warnings.push('city exceeded 100 characters and will be truncated before execution.')
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'note')) {
    const note = String(patch.note ?? '').trim()
    normalizedPatch.note = note.length > 2000 ? note.slice(0, 2000) : note
    if (note.length > 2000) warnings.push('note exceeded 2000 characters and will be truncated before execution.')
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
    warnings,
    blockers,
  }
}

function buildDeviceBasicAfterSnapshot(beforeSnapshot, patch = {}) {
  if (!beforeSnapshot) return null
  const afterSnapshot = {
    ...beforeSnapshot,
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'city')) {
    afterSnapshot.city = patch.city ?? ''
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    afterSnapshot.status = patch.status || null
  }
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

function buildDeviceBasicChangeRecords(unitId, patch = {}) {
  return Object.keys(patch).map((field) => ({
    type: 'schedule_unit',
    id: String(unitId),
    field,
  }))
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

function normalizeScheduleBlockCreatePayload(request = {}) {
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

function normalizeScheduleBlockCancelPayload(request = {}) {
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

function normalizeLogisticsLocalRecordCreatePayload(request = {}) {
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

function buildScheduleCreateAfterSnapshot(payload, unitRecord = null) {
  return {
    blockId: null,
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

function buildScheduleConflictCheck(conflicts, blockers = []) {
  const conflictRecords = Array.isArray(conflicts?.records) ? conflicts.records : []
  return {
    checked: true,
    passed: !blockers.length && conflictRecords.length === 0,
    conflictCount: conflictRecords.length,
    conflicts: conflictRecords,
  }
}

function buildScheduleCreateAffectedRecords(payload, unitId, orderId = null) {
  const records = [
    { type: 'schedule_block', id: 'new', action: 'create' },
  ]
  if (unitId || payload.unitId) records.push({ type: 'unit', id: String(unitId || payload.unitId) })
  if (orderId || payload.orderId) records.push({ type: 'order', id: String(orderId || payload.orderId) })
  return records
}

function findUnsupportedInternalNoteFields(payload = {}) {
  return Object.keys(payload).filter((key) => !['orderId', 'internalNote', 'internal_note'].includes(key))
}

function buildInternalNoteAfterSnapshot(beforeSnapshot, internalNote) {
  const length = internalNote.length
  return {
    ...(beforeSnapshot || {}),
    internalNote: {
      hasValue: Boolean(internalNote),
      length,
      preview: internalNote
        ? `${internalNote.slice(0, 2)}***${internalNote.slice(-2)}`
        : '',
    },
  }
}

async function buildOrderInternalNoteUpdatePreview(request = {}) {
  const warnings = []
  const blockers = []
  const { orderId, internalNote, rawPayload } = getOrderInternalNotePayload(request)
  const unsupportedFields = findUnsupportedInternalNoteFields(rawPayload)

  if (!orderId) blockers.push('Missing orderId; internal note update requires an existing local order id.')
  if (rawPayload.internalNote === undefined && rawPayload.internal_note === undefined) {
    blockers.push('Missing internalNote; no internal note value was supplied.')
  }
  if (String(rawPayload.internalNote ?? rawPayload.internal_note ?? '').length > 5000) {
    warnings.push('internalNote exceeded 5000 characters and will be truncated before execution.')
  }
  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload fields for order.internal_note.update: ${unsupportedFields.join(', ')}.`)
  }

  let beforeSnapshot = null
  let afterSnapshot = null
  if (!blockers.length) {
    const repository = await createSafeOpsRepository({ enabled: true })
    const result = await repository.getRentalOrderInternalNoteSnapshot({ orderId })
    if (!result.available) {
      blockers.push(result.reason || 'safeOps DB repository is unavailable; cannot preview local order.')
    } else if (!result.record) {
      blockers.push('Target order does not exist in local rental_orders.')
    } else {
      beforeSnapshot = result.record
      afterSnapshot = buildInternalNoteAfterSnapshot(beforeSnapshot, internalNote)
    }
  }

  warnings.push('This preview only prepares a local internal note update. It will not change order status, amount, customer, address, rental period, device, schedule, logistics, or any external platform.')

  return {
    warnings,
    blockers,
    beforeSnapshot,
    afterSnapshot,
    normalizedPayload: {
      orderId,
      internalNote,
    },
    impact: {
      summary: blockers.length
        ? 'Cannot preview order internal note update until blockers are resolved. No business write will run.'
        : `Preview local internal note update for order ${beforeSnapshot?.orderId || orderId}. This preview will not write rental_orders.`,
      affectedRecords: orderId
        ? [{ type: 'order', id: orderId, field: 'internal_note' }]
        : [],
      externalEffects: [],
    },
  }
}

async function buildDeviceBasicUpdatePreview(request = {}) {
  const warnings = []
  const blockers = []
  const { unitId, patch, rawPayload } = getDeviceBasicPayload(request)
  const unsupportedPayloadFields = findUnsupportedDeviceBasicPayloadFields(rawPayload)
  const normalized = normalizeDeviceBasicPatch(patch)
  warnings.push(...normalized.warnings)
  blockers.push(...normalized.blockers)

  if (!unitId) {
    blockers.push('unitId or deviceId is required for device.basic.update.')
  }
  if (unsupportedPayloadFields.length) {
    blockers.push(`Unsupported payload fields for device.basic.update: ${unsupportedPayloadFields.join(', ')}.`)
  }

  let beforeSnapshot = null
  let afterSnapshot = null
  let rawUnit = null
  if (!blockers.length) {
    const repository = await createSafeOpsRepository({ enabled: true })
    const result = await repository.getScheduleUnitBasicSnapshot({ unitId })
    if (!result.available) {
      blockers.push(result.reason || 'safeOps DB repository is unavailable; cannot preview local device.')
    } else if (!result.record || !result.raw) {
      blockers.push('Target device does not exist in local schedule_units.')
    } else {
      beforeSnapshot = result.record
      rawUnit = result.raw
      if (Object.prototype.hasOwnProperty.call(normalized.normalizedPatch, 'status')) {
        const nextStatus = normalized.normalizedPatch.status
        const currentStatus = normalizeDeviceBasicStatus(rawUnit.status)
        if (nextStatus !== currentStatus) {
          const risk = await repository.getScheduleUnitOccupationRisk({ unitId: rawUnit.id })
          if (!risk.available) {
            blockers.push(risk.reason || 'Cannot verify device occupation risk; status update is blocked.')
          } else if (risk.hasRisk) {
            blockers.push(`Status update blocked: device has ${risk.blockCount || 0} active/current-future schedule block(s) and ${risk.orderCount || 0} unfinished order(s).`)
          }
        }
      }
      if (!blockers.length) {
        afterSnapshot = buildDeviceBasicAfterSnapshot(beforeSnapshot, normalized.normalizedPatch)
      }
    }
  }

  warnings.push('This preview only prepares a local schedule_units basic-field update. It will not change model_code, unit_code, serial_no, purchase_cost, residual_value, inventory, schedule blocks, orders, logistics, Python, or external services.')

  return {
    warnings,
    blockers,
    beforeSnapshot,
    afterSnapshot,
    normalizedPayload: {
      unitId: rawUnit?.id ? String(rawUnit.id) : unitId,
      patch: normalized.normalizedPatch,
    },
    impact: {
      summary: blockers.length
        ? 'Cannot preview device.basic.update until blockers are resolved. No business write will run.'
        : `Preview local device basic update for schedule unit ${beforeSnapshot?.unitCodeMasked || unitId}. This preview will not write schedule_units.`,
      affectedRecords: unitId
        ? buildDeviceBasicChangeRecords(rawUnit?.id || unitId, normalized.normalizedPatch)
        : [],
      externalEffects: [],
    },
  }
}

async function buildScheduleBlockCreatePreview(request = {}) {
  const warnings = []
  const blockers = []
  const payload = normalizeScheduleBlockCreatePayload(request)
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

  let unitResult = null
  let orderResult = null
  let conflicts = { records: [], count: 0 }
  let afterSnapshot = null
  let normalizedOrderId = payload.orderId || null
  if (!blockers.length) {
    const repository = await createSafeOpsRepository({ enabled: true })
    unitResult = await repository.getScheduleUnitForBlock({ unitId: payload.unitId })
    if (!unitResult.available) {
      blockers.push(unitResult.reason || 'safeOps DB repository is unavailable; cannot preview schedule unit.')
    } else if (!unitResult.record || !unitResult.raw) {
      blockers.push('Target unit does not exist in local schedule_units.')
    } else if (payload.modelCode && payload.modelCode !== unitResult.raw.model_code) {
      blockers.push('modelCode does not match the target schedule unit.')
    }

    if (!blockers.length && payload.orderId) {
      orderResult = await repository.getRentalOrderExists({ orderId: payload.orderId })
      if (!orderResult.available) {
        blockers.push(orderResult.reason || 'safeOps DB repository is unavailable; cannot verify linked order.')
      } else if (!orderResult.exists) {
        blockers.push('Linked order_id does not exist in local rental_orders.')
      } else if (orderResult.raw?.id) {
        normalizedOrderId = String(orderResult.raw.id)
      }
    }

    if (!blockers.length) {
      conflicts = await repository.listScheduleBlockConflicts({
        unitId: unitResult.raw.id,
        startDate: payload.startDate,
        endDate: payload.endDate,
      })
      if (!conflicts.available) {
        blockers.push(conflicts.reason || 'safeOps DB repository is unavailable; cannot check schedule conflicts.')
      } else if (conflicts.count > 0) {
        blockers.push(`Schedule conflict detected: ${conflicts.count} overlapping active/current block(s).`)
      }
    }

    if (!blockers.length) {
      afterSnapshot = buildScheduleCreateAfterSnapshot({
        ...payload,
        unitId: String(unitResult.raw.id),
        orderId: normalizedOrderId,
        modelCode: unitResult.raw.model_code,
      }, unitResult.record)
    }
  }

  if (!payload.orderId) {
    warnings.push('No orderId supplied; this will be treated as internal/manual schedule occupation only.')
  }
  warnings.push('This preview only prepares one local schedule_blocks insert. It will not update orders, devices, logistics, Python, or external services.')

  const conflictCheck = buildScheduleConflictCheck(conflicts, blockers)
  const normalizedUnitId = unitResult?.raw?.id ? String(unitResult.raw.id) : payload.unitId
  return {
    warnings,
    blockers,
    beforeSnapshot: unitResult?.record ? { unit: unitResult.record, conflictCheck } : null,
    afterSnapshot,
    conflictCheck,
    normalizedPayload: {
      unitId: normalizedUnitId,
      orderId: normalizedOrderId,
      modelCode: unitResult?.raw?.model_code || payload.modelCode,
      blockType: payload.blockType,
      startDate: payload.startDate,
      endDate: payload.endDate,
      plannedShipAt: payload.plannedShipAt || null,
      expectedArriveAt: payload.expectedArriveAt || null,
      status: payload.status,
      note: payload.note,
    },
    impact: {
      summary: blockers.length
        ? 'Cannot preview schedule.block.create until blockers are resolved. No schedule write will run.'
        : `Preview one local schedule block from ${payload.startDate} to ${payload.endDate}. This preview will not write schedule_blocks.`,
      affectedRecords: buildScheduleCreateAffectedRecords(payload, normalizedUnitId, normalizedOrderId),
      externalEffects: [],
    },
  }
}

async function buildScheduleBlockCancelPreview(request = {}) {
  const warnings = []
  const blockers = []
  const payload = normalizeScheduleBlockCancelPayload(request)
  const unsupportedFields = findUnsupportedScheduleCancelPayloadFields(payload.rawPayload)

  if (unsupportedFields.length) {
    blockers.push(`Unsupported payload fields for schedule.block.cancel: ${unsupportedFields.join(', ')}.`)
  }
  if (!payload.blockId) blockers.push('blockId is required for schedule.block.cancel.')

  let beforeSnapshot = null
  let afterSnapshot = null
  if (!blockers.length) {
    const repository = await createSafeOpsRepository({ enabled: true })
    const blockResult = await repository.getScheduleBlockSnapshot({ blockId: payload.blockId })
    if (!blockResult.available) {
      blockers.push(blockResult.reason || 'safeOps DB repository is unavailable; cannot preview schedule block.')
    } else if (!blockResult.record || !blockResult.raw) {
      blockers.push('Target schedule block does not exist.')
    } else if (SCHEDULE_CANCELLED_STATUSES.has(normalizeText(blockResult.raw.status).toLowerCase())) {
      blockers.push('Target schedule block is already cancelled or inactive.')
    } else {
      beforeSnapshot = blockResult.record
      afterSnapshot = buildScheduleCancelAfterSnapshot(beforeSnapshot)
    }
  }

  warnings.push('This preview only prepares a local schedule_blocks soft cancel. It will not delete rows, update orders, update devices, call Python, or call external services.')

  return {
    warnings,
    blockers,
    beforeSnapshot,
    afterSnapshot,
    conflictCheck: {
      checked: false,
      passed: !blockers.length,
      reason: 'cancel operation validates current block status instead of date conflicts',
    },
    normalizedPayload: {
      blockId: payload.blockId,
    },
    impact: {
      summary: blockers.length
        ? 'Cannot preview schedule.block.cancel until blockers are resolved. No schedule write will run.'
        : `Preview soft-cancel of schedule block ${beforeSnapshot?.blockId || payload.blockId}. This preview will not write schedule_blocks.`,
      affectedRecords: payload.blockId
        ? [{ type: 'schedule_block', id: String(payload.blockId), action: 'cancel' }]
        : [],
      externalEffects: [],
    },
  }
}

async function buildLogisticsLocalRecordCreatePreview(request = {}) {
  const warnings = []
  const blockers = []
  const payload = normalizeLogisticsLocalRecordCreatePayload(request)
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
  for (const [key, rawKey] of [
    ['plannedShipAt', 'plannedShipAt'],
    ['actualShipAt', 'actualShipAt'],
    ['expectedArriveAt', 'expectedArriveAt'],
    ['actualArriveAt', 'actualArriveAt'],
  ]) {
    const supplied = payload.rawPayload[rawKey] || payload.rawPayload[rawKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]
    if (supplied && !payload[key]) blockers.push(`${rawKey} must use YYYY-MM-DD or YYYY-MM-DD HH:mm format.`)
  }

  let orderResult = null
  let duplicateResult = { exists: false, record: null }
  let normalizedPayload = { ...payload, orderId: payload.orderId }
  if (!blockers.length) {
    const repository = await createSafeOpsRepository({ enabled: true })
    orderResult = await repository.getRentalOrderForLocalShipping({ orderId: payload.orderId })
    if (!orderResult.available) {
      blockers.push(orderResult.reason || 'safeOps DB repository is unavailable; cannot verify linked order.')
    } else if (!orderResult.exists || !orderResult.raw) {
      blockers.push('Linked order_id does not exist in local rental_orders.')
    } else {
      normalizedPayload = {
        ...payload,
        orderId: String(orderResult.raw.id),
      }
      duplicateResult = await repository.getShippingDuplicateRecord({
        orderId: orderResult.raw.id,
        carrier: payload.carrier,
        trackingNo: payload.trackingNo,
      })
      if (!duplicateResult.available) {
        blockers.push(duplicateResult.reason || 'safeOps DB repository is unavailable; cannot check duplicate shipping record.')
      } else if (duplicateResult.exists) {
        blockers.push('Duplicate local shipping record exists for the same order_id + carrier + tracking_no.')
      }
    }
  }

  warnings.push('This creates a local shipping_records row only; it will not call carrier APIs, query tracking routes, create a waybill, charge fees, or update order status.')
  if (payload.carrier === 'sf') warnings.push('carrier=sf is treated as local metadata only; no SF API will be called.')

  const duplicateRecordCheck = buildDuplicateRecordCheck(duplicateResult, blockers)
  const afterSnapshot = blockers.length ? null : buildLogisticsLocalAfterSnapshot(normalizedPayload)
  return {
    warnings,
    blockers,
    beforeSnapshot: orderResult?.record ? {
      order: orderResult.record,
      duplicateRecordCheck,
    } : null,
    afterSnapshot,
    duplicateRecordCheck,
    normalizedPayload: {
      orderId: normalizedPayload.orderId,
      carrier: normalizedPayload.carrier,
      trackingNo: normalizedPayload.trackingNo,
      shippingMode: normalizedPayload.shippingMode,
      latestStatus: normalizedPayload.latestStatus,
      shipFromCity: normalizedPayload.shipFromCity || null,
      shipToCity: normalizedPayload.shipToCity || null,
      plannedShipAt: normalizedPayload.plannedShipAt || null,
      actualShipAt: normalizedPayload.actualShipAt || null,
      expectedArriveAt: normalizedPayload.expectedArriveAt || null,
      actualArriveAt: normalizedPayload.actualArriveAt || null,
    },
    impact: {
      summary: blockers.length
        ? 'Cannot preview logistics.local_record.create until blockers are resolved. No shipping record will be written.'
        : `Preview one local shipping_records insert for order ${normalizedPayload.orderId}. This preview will not write shipping_records or update order status.`,
      affectedRecords: normalizedPayload.orderId
        ? [
            { type: 'shipping_record', id: 'new', action: 'create' },
            { type: 'order', id: String(normalizedPayload.orderId), action: 'read-only-check' },
          ]
        : [],
      externalEffects: [],
    },
  }
}

async function buildDomainPreview(operationType, request) {
  switch (operationType) {
    case 'order.internal_note.update':
      return buildOrderInternalNoteUpdatePreview(request)
    case 'device.basic.update':
      return buildDeviceBasicUpdatePreview(request)
    case 'schedule.block.create':
      return buildScheduleBlockCreatePreview(request)
    case 'schedule.block.cancel':
      return buildScheduleBlockCancelPreview(request)
    case 'logistics.local_record.create':
      return buildLogisticsLocalRecordCreatePreview(request)
    case 'order.status.transition.preview':
      return buildOrderStatusTransitionPreview(request)
    case 'order.edit.preview':
      return buildOrderEditPreview(request)
    case 'device.update.preview':
      return buildDeviceUpdatePreview(request)
    case 'device.delete.preview':
      return buildDeviceDeletePreview(request)
    case 'schedule.block.preview':
      return buildScheduleBlockPreview(request)
    case 'logistics.shipment.preview':
      return buildLogisticsShipmentPreview(request)
    case 'deposit.create.preview':
      return buildDepositCreatePreview(request)
    case 'deposit.finish.preview':
      return buildDepositFinishPreview(request)
    default:
      return {
        warnings: [],
        blockers: [],
        impact: buildPreviewImpact(operationType),
      }
  }
}

async function previewSafeOperation(request = {}) {
  try {
    const operationType = normalizeOperationType(request?.operationType)
    const policy = getOperationPolicy(operationType)

    if (!policy) {
      return buildUnsupportedOperationResponse(operationType)
    }

    const domainPreview = await buildDomainPreview(operationType, request)
    const status = domainPreview.blockers?.length ? 'blocked' : 'previewed'
    const baseResponse = {
      ok: true,
      supported: true,
      operationType,
      mode: 'dry-run',
      writeWillExecute: false,
      externalCallWillExecute: false,
      riskLevel: policy.riskLevel,
      warnings: domainPreview.warnings,
      blockers: domainPreview.blockers,
      impact: domainPreview.impact,
      conflictCheck: domainPreview.conflictCheck || null,
      duplicateRecordCheck: domainPreview.duplicateRecordCheck || null,
    }
    const persistence = await persistSafeOperationContext({
      request: { ...request, operationType },
      policy,
      impact: domainPreview.impact,
      previewResponse: baseResponse,
      mode: 'dry-run',
      status,
      issueConfirmToken: Boolean(policy.allowExecute && !domainPreview.blockers?.length),
      beforeSnapshot: domainPreview.beforeSnapshot || null,
      afterSnapshot: domainPreview.afterSnapshot || null,
    })

    const canExecute = Boolean(policy.allowExecute && !domainPreview.blockers?.length && persistence.persistence?.available)
    const executeDescriptor = canExecute
      ? {
          enabled: true,
          code: 'SAFE_OP_EXECUTE_READY',
          writeWillExecuteAfterConfirm: true,
          writeWillExecute: false,
          externalCallWillExecute: false,
          allowedOperationType: operationType,
        }
      : {
          enabled: false,
          code: EXECUTE_POLICY.code === 'SAFE_OP_EXECUTE_GATED' ? 'SAFE_OP_EXECUTE_DISABLED' : EXECUTE_POLICY.code,
          writeWillExecute: false,
          externalCallWillExecute: false,
        }

    return {
      ...baseResponse,
      persistence: persistence.persistence,
      audit: {
        mode: persistence.audit?.mode || AUDIT_POLICY.mode,
        persisted: Boolean(persistence.audit?.persisted),
        auditLogId: persistence.audit?.auditLogId || null,
        operationId: persistence.audit.operationId,
        payloadHash: persistence.audit.payloadHash,
        impactHash: persistence.audit.impactHash,
        status: persistence.audit.status,
        reason: persistence.audit?.reason,
      },
      requiresConfirm: true,
      requiresIdempotencyKey: true,
      executeEnabled: canExecute,
      execute: executeDescriptor,
      confirmToken: null,
      confirmTokenExists: Boolean(persistence.confirmRequirement?.exists),
      confirmTokenExpiresAt: persistence.confirmRequirement?.expiresAt || null,
      beforeSnapshot: domainPreview.beforeSnapshot || null,
      afterSnapshot: domainPreview.afterSnapshot || null,
      confirmRequirement: persistence.confirmRequirement,
      idempotency: {
        mode: persistence.idempotency?.mode || IDEMPOTENCY_POLICY.mode,
        required: true,
        persisted: Boolean(persistence.idempotency?.persisted),
        id: persistence.idempotency?.id || null,
        keyHash: persistence.idempotency.keyHash,
        status: persistence.idempotency.status,
        duplicate: Boolean(persistence.idempotency?.duplicate),
        reason: persistence.idempotency?.reason,
      },
      idempotencyKey: persistence.idempotency?.keyHash || null,
      rollback: persistence.rollback,
    }
  } catch (error) {
    return {
      ok: false,
      supported: false,
      code: 'SAFE_OP_PREVIEW_ERROR',
      message: error?.message || 'safeOps preview failed safely',
      writeWillExecute: false,
      externalCallWillExecute: false,
      audit: {
        mode: AUDIT_POLICY.mode,
        persisted: AUDIT_POLICY.persisted,
      },
    }
  }
}

module.exports = {
  previewSafeOperation,
}
