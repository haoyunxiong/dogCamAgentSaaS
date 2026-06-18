const {
  addRecord,
  createDateRangeReview,
  firstText,
  isValidNumberLike,
  normalizeText,
} = require('./safeOpsValidationUtils')

const STATUS_ALIASES = Object.freeze({
  draft: 'draft',
  pending: 'pending',
  pending_confirm: 'pending',
  confirmed: 'confirmed',
  paid: 'paid',
  assigned: 'assigned',
  shipped: 'shipped',
  shipping: 'shipped',
  renting: 'renting',
  active: 'renting',
  returning: 'returning',
  returned: 'returned',
  completed: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  exception: 'exception',
  '待确认': 'pending',
  '待押金': 'confirmed',
  '待分配设备': 'paid',
  '待发货': 'assigned',
  '运输中': 'shipped',
  '租用中': 'renting',
  '待归还': 'returning',
  '待验机': 'returned',
  '已完成': 'completed',
  '已取消': 'cancelled',
  '异常': 'exception',
})

const STATIC_TRANSITIONS = Object.freeze({
  draft: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled', 'exception'],
  confirmed: ['paid', 'cancelled', 'exception'],
  paid: ['assigned', 'cancelled', 'exception'],
  assigned: ['shipped', 'cancelled', 'exception'],
  shipped: ['renting', 'returning', 'exception'],
  renting: ['returning', 'completed', 'exception'],
  returning: ['returned', 'completed', 'exception'],
  returned: ['completed', 'exception'],
  completed: [],
  cancelled: [],
  exception: ['pending', 'confirmed', 'cancelled'],
})

function canonicalStatus(status) {
  return STATUS_ALIASES[normalizeText(status)] || ''
}

function addOrderRecords(records, request = {}) {
  const target = request.target || {}
  const payload = request.payload || {}

  addRecord(records, 'order', firstText(target.id, payload.orderId, payload.orderNo))
  addRecord(records, 'unit', firstText(payload.unitId, payload.deviceId))
  addRecord(records, 'model', payload.modelCode)
  addRecord(records, 'schedule', payload.scheduleId)
}

function buildOrderStatusTransitionPreview(request = {}) {
  const payload = request.payload || {}
  const warnings = []
  const blockers = []
  const records = []
  const orderId = firstText(request.target?.id, payload.orderId, payload.orderNo)
  const fromStatus = normalizeText(payload.fromStatus)
  const toStatus = normalizeText(payload.toStatus)
  const canonicalFrom = canonicalStatus(fromStatus)
  const canonicalTo = canonicalStatus(toStatus)

  addOrderRecords(records, request)

  if (!orderId) warnings.push('Missing orderId/orderNo; order impact can only be summarized at payload level.')
  if (!fromStatus) blockers.push('Missing fromStatus; status transition cannot be reviewed.')
  if (!toStatus) blockers.push('Missing toStatus; status transition cannot be reviewed.')
  if (fromStatus && !canonicalFrom) blockers.push(`Unknown fromStatus: ${fromStatus}.`)
  if (toStatus && !canonicalTo) blockers.push(`Unknown toStatus: ${toStatus}.`)

  if (canonicalFrom && canonicalTo) {
    const allowedNextStatuses = STATIC_TRANSITIONS[canonicalFrom] || []
    if (!allowedNextStatuses.includes(canonicalTo)) {
      warnings.push('Static FSM review does not allow this transition; later DB read-only preview must verify locks, snapshots, and domain rules.')
    }
  }

  warnings.push('This is a static status review only; real state guards, DB locks, notifications, and schedule impact require a later DB read-only preview slice.')

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for order status transition from ${fromStatus || 'unknown'} to ${toStatus || 'unknown'}. This will not change order state, schedule, logistics, or notifications.`,
      affectedRecords: records,
      externalEffects: [],
    },
  }
}

function buildOrderEditPreview(request = {}) {
  const payload = request.payload || {}
  const warnings = []
  const blockers = []
  const records = []
  const orderId = firstText(request.target?.id, payload.orderId, payload.orderNo)
  const startDate = firstText(payload.rentStartDate, payload.startDate)
  const endDate = firstText(payload.rentEndDate, payload.endDate)
  const amount = firstText(payload.amount, payload.rentAmount, payload.totalAmount, payload.fee)

  addOrderRecords(records, request)

  if (!orderId) warnings.push('Missing orderId/orderNo; order edit impact can only be summarized at payload level.')

  if (!startDate || !endDate) {
    warnings.push('Missing rental period fields; later schedule conflict review cannot be precise.')
  } else {
    blockers.push(...createDateRangeReview({
      startDate,
      endDate,
      startLabel: 'rentStartDate',
      endLabel: 'rentEndDate',
    }).blockers)
  }

  if (!firstText(payload.unitId, payload.deviceId, payload.modelCode)) {
    warnings.push('Missing unitId/deviceId/modelCode; later device and schedule impact review cannot be precise.')
  }

  if (!amount) {
    warnings.push('Missing amount/rentAmount/fee; fee impact can only be summarized at payload level.')
  } else if (!isValidNumberLike(amount)) {
    blockers.push('Amount field must be numeric when supplied.')
  }

  warnings.push('This is a static order edit review only; real state guards, DB locks, fee snapshots, and schedule conflicts require a later DB read-only preview slice.')

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for order edit ${orderId || 'without order id'}. This will not change order fields, fees, devices, schedule, logistics, or notifications.`,
      affectedRecords: records,
      externalEffects: [],
    },
  }
}

module.exports = {
  buildOrderEditPreview,
  buildOrderStatusTransitionPreview,
}
