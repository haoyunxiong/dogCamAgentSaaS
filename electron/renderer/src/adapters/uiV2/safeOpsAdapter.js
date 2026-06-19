import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'

const SAFE_OPS_MODE = 'dry-run-only'
const EXECUTE_DISABLED_POLICY = Object.freeze({
  enabled: false,
  code: 'SAFE_OP_EXECUTE_DISABLED',
  writeWillExecute: false,
  externalCallWillExecute: false,
})

const SAFE_OP_POLICIES = Object.freeze([
  { operationType: 'order.internal_note.update', domain: 'Orders', riskLevel: 'low', requiresExternalCredential: false, allowExecute: true },
  { operationType: 'device.basic.update', domain: 'Devices', riskLevel: 'medium-low', requiresExternalCredential: false, allowExecute: true, allowedFields: ['city', 'note', 'status'] },
  { operationType: 'schedule.block.create', domain: 'Schedule', riskLevel: 'medium-high', requiresExternalCredential: false, allowExecute: true },
  { operationType: 'schedule.block.cancel', domain: 'Schedule', riskLevel: 'medium', requiresExternalCredential: false, allowExecute: true },
  { operationType: 'order.status.transition.preview', domain: 'Orders', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'order.edit.preview', domain: 'Orders', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'device.update.preview', domain: 'Devices', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'device.delete.preview', domain: 'Devices', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'schedule.block.preview', domain: 'Schedule', riskLevel: 'high', requiresExternalCredential: false },
  { operationType: 'logistics.shipment.preview', domain: 'Logistics', riskLevel: 'critical', requiresExternalCredential: true },
  { operationType: 'deposit.create.preview', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true },
  { operationType: 'deposit.finish.preview', domain: 'Deposit', riskLevel: 'critical', requiresExternalCredential: true },
])

const POLICY_BY_OPERATION = new Map(SAFE_OP_POLICIES.map((policy) => [policy.operationType, policy]))

const LOCAL_PREVIEW_SUMMARIES = Object.freeze({
  'order.internal_note.update': 'Renderer noop internal note preview. Real local write requires Electron safeOps execute and will not call external services.',
  'device.basic.update': 'Renderer noop device basic update preview. Real local write requires Electron safeOps execute and will only update city, note, status.',
  'schedule.block.create': 'Renderer noop schedule block create preview. Real local write requires Electron safeOps execute and will only insert one local schedule block.',
  'schedule.block.cancel': 'Renderer noop schedule block cancel preview. Real local write requires Electron safeOps execute and will only soft-cancel one local schedule block.',
  'order.status.transition.preview': 'Renderer noop order status preview. This is dry-run only and will not change order state, schedule, logistics, or notifications.',
  'order.edit.preview': 'Renderer noop order edit preview. This is dry-run only and will not change order fields, fees, devices, schedule, or logistics.',
  'device.update.preview': 'Renderer noop device update preview. This is dry-run only and will not change device profile, inventory, or availability.',
  'device.delete.preview': 'Renderer noop device delete preview. This is dry-run only and will not delete device data, schedule blocks, or order relations.',
  'schedule.block.preview': 'Renderer noop schedule block preview. This is dry-run only and will not write schedule data or lock inventory.',
  'logistics.shipment.preview': 'Renderer noop shipment preview. This is dry-run only and will not save shipment drafts, create waybills, charge fees, or call carrier services.',
  'deposit.create.preview': 'Renderer noop deposit create preview. This is dry-run only and will not create deposit orders or change local cache.',
  'deposit.finish.preview': 'Renderer noop deposit finish preview. This is dry-run only and will not finish deposit orders or change local cache.',
})

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeOperationType(operationType) {
  return String(operationType || '').trim()
}

function getSafeOpsBridge() {
  if (isUiV2PreviewMode()) return null
  if (!hasUiV2RuntimeBridge()) return null

  const safeOps = window.electronAPI?.safeOps
  if (!safeOps || typeof safeOps.getPolicy !== 'function' || typeof safeOps.preview !== 'function') {
    return null
  }

  return safeOps
}

function buildLocalPolicy() {
  return {
    ok: true,
    mode: 'policy',
    safeMode: SAFE_OPS_MODE,
    writeEnabled: false,
    externalWritesEnabled: false,
    operations: cloneJson(SAFE_OP_POLICIES).map((policy) => ({
      ...policy,
      allowPreview: true,
      allowWrite: Boolean(policy.allowExecute),
      allowExecute: Boolean(policy.allowExecute),
      requiresDbMigrationForWrite: !policy.allowExecute,
      requiresUserConfirmationForWrite: true,
    })),
    audit: { mode: 'noop', persisted: false },
    confirmToken: { enabled: false, requiredForWrite: true, persisted: false },
    idempotency: { mode: 'noop', requiredForWrite: true, persisted: false },
    execute: cloneJson(EXECUTE_DISABLED_POLICY),
    persistence: { mode: 'noop', available: false, reason: 'renderer-preview-no-bridge' },
    source: 'renderer-noop',
  }
}

function buildUnsupportedPreview(operationType) {
  const normalizedOperationType = normalizeOperationType(operationType)
  return {
    ok: false,
    supported: false,
    code: 'SAFE_OP_UNSUPPORTED',
    message: normalizedOperationType
      ? `Unsupported safe operation: ${normalizedOperationType}`
      : 'Unsupported safe operation: operationType is required',
  }
}

function buildLocalPreview(payload = {}) {
  const operationType = normalizeOperationType(payload.operationType)
  const policy = POLICY_BY_OPERATION.get(operationType)

  if (!policy) return buildUnsupportedPreview(operationType)

  return {
    ok: true,
    supported: true,
    operationType,
    mode: 'dry-run',
    writeWillExecute: false,
    externalCallWillExecute: false,
    riskLevel: policy.riskLevel,
    warnings: [],
    blockers: [],
    impact: {
      summary: LOCAL_PREVIEW_SUMMARIES[operationType] || 'Renderer noop safeOps preview. This action is dry-run only and will not write data or call external services.',
      affectedRecords: [],
      externalEffects: [],
    },
    audit: {
      mode: 'noop',
      persisted: false,
      operationId: null,
      payloadHash: null,
      impactHash: null,
      status: 'previewed',
    },
    persistence: { mode: 'noop', available: false, reason: 'renderer-preview-no-bridge' },
    requiresConfirm: true,
    requiresIdempotencyKey: true,
    execute: cloneJson(EXECUTE_DISABLED_POLICY),
    confirmToken: null,
    confirmRequirement: {
      enabled: false,
      required: true,
      persisted: false,
      token: null,
      tokenHash: null,
      expiresAt: null,
      reason: 'renderer-preview-execute-disabled',
    },
    idempotency: {
      mode: 'noop',
      required: true,
      persisted: false,
      keyHash: null,
      status: 'not-claimed',
      reason: 'renderer-preview-execute-disabled',
    },
    rollback: {
      mode: 'noop',
      planned: false,
      persisted: false,
      canRollback: false,
      compensationRequired: false,
      reason: 'no-write-executed',
    },
    source: 'renderer-noop',
  }
}

function buildLocalExecuteDisabled(operationType) {
  return {
    ok: false,
    supported: true,
    code: 'SAFE_OP_EXECUTE_DISABLED',
    message: 'safeOps execute is unavailable in renderer preview mode.',
    operationType: normalizeOperationType(operationType),
    mode: 'execute-disabled',
    writeWillExecute: false,
    externalCallWillExecute: false,
    rollback: {
      mode: 'noop',
      planned: false,
      persisted: false,
      canRollback: false,
      compensationRequired: false,
      reason: 'renderer-preview-no-execute',
    },
    source: 'renderer-noop',
  }
}

function buildSafeError(code, message) {
  return {
    ok: false,
    supported: false,
    code,
    message: message || 'safeOps request failed safely',
  }
}

async function getPolicy(payload = {}) {
  try {
    const bridge = getSafeOpsBridge()
    if (!bridge) return buildLocalPolicy()

    const result = await bridge.getPolicy(payload || {})
    return result && typeof result === 'object' ? result : buildLocalPolicy()
  } catch (error) {
    return buildSafeError('SAFE_OP_POLICY_ERROR', error?.message)
  }
}

async function preview(payload = {}) {
  try {
    const bridge = getSafeOpsBridge()
    if (!bridge) return buildLocalPreview(payload || {})

    const result = await bridge.preview(payload || {})
    return result && typeof result === 'object'
      ? result
      : buildSafeError('SAFE_OP_PREVIEW_ERROR', 'safeOps preview returned an invalid response')
  } catch (error) {
    return buildSafeError('SAFE_OP_PREVIEW_ERROR', error?.message)
  }
}

async function execute(payload = {}) {
  try {
    const operationType = normalizeOperationType(payload.operationType)
    if (!['order.internal_note.update', 'device.basic.update', 'schedule.block.create', 'schedule.block.cancel'].includes(operationType)) {
      return buildLocalExecuteDisabled(operationType)
    }

    const bridge = getSafeOpsBridge()
    if (!bridge || typeof bridge.execute !== 'function') {
      return buildLocalExecuteDisabled(operationType)
    }

    const result = await bridge.execute(payload || {})
    return result && typeof result === 'object'
      ? result
      : buildSafeError('SAFE_OP_EXECUTE_ERROR', 'safeOps execute returned an invalid response')
  } catch (error) {
    return buildSafeError('SAFE_OP_EXECUTE_ERROR', error?.message)
  }
}

export async function previewOrderInternalNoteUpdate({
  orderId,
  internalNote,
  actor,
  clientRequestId,
} = {}) {
  return preview({
    operationType: 'order.internal_note.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'order', id: String(orderId || '') },
    payload: {
      orderId: String(orderId || ''),
      internalNote: String(internalNote ?? ''),
    },
    clientRequestId: clientRequestId || `ui-v2-order-note-preview-${Date.now()}`,
  })
}

export async function executeOrderInternalNoteUpdate({
  previewResult,
  orderId,
  internalNote,
  actor,
  clientRequestId,
} = {}) {
  return execute({
    operationType: 'order.internal_note.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'order', id: String(orderId || '') },
    payload: {
      orderId: String(orderId || ''),
      internalNote: String(internalNote ?? ''),
    },
    clientRequestId: clientRequestId || `ui-v2-order-note-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewDeviceBasicUpdate({
  unitId,
  deviceId,
  patch,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return preview({
    operationType: 'device.basic.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'device', id },
    payload: {
      unitId: id,
      patch: patch || {},
    },
    clientRequestId: clientRequestId || `ui-v2-device-basic-preview-${Date.now()}`,
  })
}

export async function executeDeviceBasicUpdate({
  previewResult,
  unitId,
  deviceId,
  patch,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return execute({
    operationType: 'device.basic.update',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'device', id },
    payload: {
      unitId: id,
      patch: patch || {},
    },
    clientRequestId: clientRequestId || `ui-v2-device-basic-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewScheduleBlockCreate({
  unitId,
  deviceId,
  modelCode,
  blockType,
  startDate,
  endDate,
  plannedShipAt,
  expectedArriveAt,
  note,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return preview({
    operationType: 'schedule.block.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id: `new-${id}-${startDate || ''}` },
    payload: {
      unitId: id,
      modelCode: String(modelCode || ''),
      blockType: blockType || 'manual_hold',
      startDate: String(startDate || ''),
      endDate: String(endDate || ''),
      plannedShipAt: plannedShipAt || '',
      expectedArriveAt: expectedArriveAt || '',
      status: 'active',
      note: String(note || ''),
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-create-preview-${Date.now()}`,
  })
}

export async function executeScheduleBlockCreate({
  previewResult,
  unitId,
  deviceId,
  modelCode,
  blockType,
  startDate,
  endDate,
  plannedShipAt,
  expectedArriveAt,
  note,
  actor,
  clientRequestId,
} = {}) {
  const id = String(unitId || deviceId || '')
  return execute({
    operationType: 'schedule.block.create',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id: `new-${id}-${startDate || ''}` },
    payload: {
      unitId: id,
      modelCode: String(modelCode || ''),
      blockType: blockType || 'manual_hold',
      startDate: String(startDate || ''),
      endDate: String(endDate || ''),
      plannedShipAt: plannedShipAt || '',
      expectedArriveAt: expectedArriveAt || '',
      status: 'active',
      note: String(note || ''),
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-create-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export async function previewScheduleBlockCancel({
  blockId,
  actor,
  clientRequestId,
} = {}) {
  const id = String(blockId || '')
  return preview({
    operationType: 'schedule.block.cancel',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id },
    payload: {
      blockId: id,
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-cancel-preview-${Date.now()}`,
  })
}

export async function executeScheduleBlockCancel({
  previewResult,
  blockId,
  actor,
  clientRequestId,
} = {}) {
  const id = String(blockId || '')
  return execute({
    operationType: 'schedule.block.cancel',
    actor: actor || { id: 'ui-v2-operator', source: 'ui-v2', role: 'operator' },
    target: { type: 'schedule_block', id },
    payload: {
      blockId: id,
    },
    clientRequestId: clientRequestId || `ui-v2-schedule-block-cancel-execute-${Date.now()}`,
    confirmTokenId: previewResult?.confirmRequirement?.tokenId || null,
    auditLogId: previewResult?.audit?.auditLogId || null,
    impactHash: previewResult?.audit?.impactHash || null,
    idempotencyKeyHash: previewResult?.idempotency?.keyHash || null,
  })
}

export const safeOpsAdapter = {
  getPolicy,
  preview,
  execute,
  previewOrderInternalNoteUpdate,
  executeOrderInternalNoteUpdate,
  previewDeviceBasicUpdate,
  executeDeviceBasicUpdate,
  previewScheduleBlockCreate,
  executeScheduleBlockCreate,
  previewScheduleBlockCancel,
  executeScheduleBlockCancel,
}
