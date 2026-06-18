const {
  addRecord,
  createDateRangeReview,
  normalizeText,
} = require('./safeOpsValidationUtils')

function buildScheduleAffectedRecords(request = {}) {
  const target = request.target || {}
  const payload = request.payload || {}
  const records = []

  addRecord(records, normalizeText(target.type) || 'schedule', target.id)
  addRecord(records, 'schedule', payload.scheduleId)
  addRecord(records, 'unit', payload.unitId || payload.deviceId)
  addRecord(records, 'model', payload.modelCode)
  addRecord(records, 'order', payload.orderId)

  return records
}

function buildScheduleBlockPreview(request = {}) {
  const payload = request.payload || {}
  const dateRangeReview = createDateRangeReview({
    startDate: payload.startDate,
    endDate: payload.endDate,
  })
  const warnings = []
  const blockers = [...dateRangeReview.blockers]

  if (!normalizeText(payload.unitId) && !normalizeText(payload.deviceId) && !normalizeText(payload.modelCode)) {
    warnings.push('Missing unitId/deviceId/modelCode; later DB read-only conflict preview is required for precise schedule conflict detection.')
  }

  if (!normalizeText(payload.orderId)) {
    warnings.push('Missing orderId; order impact can only be summarized at payload level.')
  }

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for schedule block impact across ${dateRangeReview.rangeLabel}. This will not write data, lock inventory, change orders, or change devices. Real conflict detection requires a later DB read-only preview slice.`,
      affectedRecords: buildScheduleAffectedRecords(request),
      externalEffects: [],
    },
  }
}

module.exports = {
  buildScheduleBlockPreview,
}
