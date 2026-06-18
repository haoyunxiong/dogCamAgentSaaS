const {
  AUDIT_POLICY,
  IDEMPOTENCY_POLICY,
  buildUnsupportedOperationResponse,
  getOperationPolicy,
  normalizeOperationType,
} = require('./safeOpsPolicy')
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

function buildDomainPreview(operationType, request) {
  switch (operationType) {
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

function previewSafeOperation(request = {}) {
  try {
    const operationType = normalizeOperationType(request?.operationType)
    const policy = getOperationPolicy(operationType)

    if (!policy) {
      return buildUnsupportedOperationResponse(operationType)
    }

    const domainPreview = buildDomainPreview(operationType, request)

    return {
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
      audit: {
        mode: AUDIT_POLICY.mode,
        persisted: AUDIT_POLICY.persisted,
      },
      confirmToken: null,
      idempotency: {
        mode: IDEMPOTENCY_POLICY.mode,
      },
    }
  } catch (error) {
    return {
      ok: false,
      supported: false,
      code: 'SAFE_OP_PREVIEW_ERROR',
      message: error?.message || 'safeOps preview failed safely',
    }
  }
}

module.exports = {
  previewSafeOperation,
}
