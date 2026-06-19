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

function getOrderInternalNotePayload(request = {}) {
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

async function buildDomainPreview(operationType, request) {
  switch (operationType) {
    case 'order.internal_note.update':
      return buildOrderInternalNoteUpdatePreview(request)
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
    }
    const persistence = await persistSafeOperationContext({
      request: { ...request, operationType },
      policy,
      impact: domainPreview.impact,
      previewResponse: baseResponse,
      mode: 'dry-run',
      status,
      issueConfirmToken: true,
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
