const {
  addRecord,
  firstText,
  normalizeText,
} = require('./safeOpsValidationUtils')

const ALLOWED_DEVICE_STATUSES = new Set([
  'available',
  'idle',
  'reserved',
  'rented',
  'cleaning',
  'maintenance',
  'repair',
  'disabled',
  'lost',
  'retired',
  'exception',
  '可租',
  '空闲',
  '已预约',
  '在租',
  '待清洁',
  '维修中',
  '维护中',
  '停用',
  '遗失',
  '报废',
  '异常',
])

function addDeviceRecords(records, request = {}) {
  const target = request.target || {}
  const payload = request.payload || {}

  addRecord(records, 'device', firstText(target.id, payload.deviceId, payload.assetNo))
  addRecord(records, 'unit', firstText(payload.unitId, payload.deviceId))
  addRecord(records, 'model', payload.modelCode)
  addRecord(records, 'order', payload.orderId)
}

function getTargetStatus(payload = {}) {
  return firstText(payload.targetStatus, payload.status, payload.nextStatus)
}

function buildDeviceUpdatePreview(request = {}) {
  const payload = request.payload || {}
  const warnings = []
  const blockers = []
  const records = []
  const deviceRef = firstText(request.target?.id, payload.deviceId, payload.unitId, payload.assetNo, payload.modelCode)
  const targetStatus = getTargetStatus(payload)

  addDeviceRecords(records, request)

  if (!deviceRef) {
    warnings.push('Missing deviceId/unitId/modelCode; device impact can only be summarized at payload level.')
  }

  if (!targetStatus) {
    warnings.push('Missing target status; this preview cannot verify whether the new device state is allowed.')
  } else if (!ALLOWED_DEVICE_STATUSES.has(normalizeText(targetStatus))) {
    blockers.push(`Unsupported device status: ${targetStatus}.`)
  }

  warnings.push('This is a static device review only; real linked order, schedule occupation, and inventory checks require a later DB read-only preview slice.')

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for device update ${deviceRef || 'without device id'}. This will not change device profile, inventory, availability, or schedule data.`,
      affectedRecords: records,
      externalEffects: [],
    },
  }
}

function buildDeviceDeletePreview(request = {}) {
  const payload = request.payload || {}
  const warnings = []
  const blockers = []
  const records = []
  const deviceRef = firstText(request.target?.id, payload.deviceId, payload.unitId, payload.assetNo, payload.modelCode)

  addDeviceRecords(records, request)

  if (!deviceRef) {
    warnings.push('Missing deviceId/unitId/modelCode; delete impact can only be summarized at payload level.')
  }

  blockers.push('Device delete is high risk and remains disabled in dry-run mode; later DB read-only preview must verify linked orders, schedule occupation, and inventory history.')

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for device delete ${deviceRef || 'without device id'}. This will not delete devices, inventory rows, schedule blocks, or order relations.`,
      affectedRecords: records,
      externalEffects: [],
    },
  }
}

module.exports = {
  buildDeviceDeletePreview,
  buildDeviceUpdatePreview,
}
