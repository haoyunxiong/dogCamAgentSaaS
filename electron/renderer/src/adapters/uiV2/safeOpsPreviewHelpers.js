import { safeOpsAdapter } from './safeOpsAdapter.js'
import { buildSafeOpsActor } from './actorContextAdapter.js'

export function createSafeOpsPreviewState() {
  return {
    loading: false,
    result: null,
    view: null,
    error: '',
  }
}

function asFlag(value) {
  return value === true ? 'true' : 'false'
}

function disabledLabel(value) {
  return value === true ? 'enabled' : 'disabled'
}

function formatMaybe(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value)
}

export function toSafeOpsPreviewView(result = {}) {
  const isOk = Boolean(result?.ok && result?.supported)
  const audit = result?.audit || {}
  const execute = result?.execute || {}
  const idempotency = result?.idempotency || {}
  const persistence = result?.persistence || {}
  const confirmRequirement = result?.confirmRequirement || {}
  const isExecuted = result?.mode === 'write' && result?.code === 'SAFE_OP_EXECUTED'
  const executeReady = Boolean(result?.executeEnabled || execute.enabled)
  const blockers = Array.isArray(result?.blockers) ? result.blockers.filter(Boolean) : []
  const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : []
  const conflictCheck = result?.conflictCheck || {}
  const duplicateRecordCheck = result?.duplicateRecordCheck || {}
  const externalGateway = result?.externalGateway || {}
  const requestPayloadPreview = result?.requestPayloadPreview || {}
  const mockWaybillPreview = result?.mockWaybillPreview || {}
  const mockDepositPreview = result?.mockDepositPreview || {}
  const mockXianyuSyncPreview = result?.mockXianyuSyncPreview || {}
  const sandboxPayloadPreview = result?.sandboxPayloadPreview || {}

  return {
    title: isExecuted ? 'Operation executed' : (isOk ? 'Operation preview' : 'Operation preview unavailable'),
    status: isExecuted ? 'executed' : (executeReady ? 'confirm-required' : (isOk ? 'not-open' : 'safe-error')),
    mode: result?.mode || 'dry-run',
    riskLevel: result?.riskLevel || 'unknown',
    summary: result?.impact?.summary || result?.message || 'This action is preview-only and will not write data or call external services.',
    writeWillExecute: asFlag(result?.writeWillExecute),
    externalCallWillExecute: asFlag(result?.externalCallWillExecute),
    persistenceLabel: `${persistence.mode || 'noop'} / available=${asFlag(persistence.available)}`,
    auditLabel: `${audit.mode || 'noop'} / persisted=${asFlag(audit.persisted)} / id=${formatMaybe(audit.auditLogId)}`,
    executeLabel: execute.code || (executeReady ? 'SAFE_OP_EXECUTE_READY' : `execute ${disabledLabel(execute.enabled)}`),
    confirmLabel: confirmRequirement.exists
      ? `exists / expires=${formatMaybe(confirmRequirement.expiresAt)}`
      : (result?.requiresConfirm ? 'required before future write' : 'not required'),
    idempotencyLabel: result?.requiresIdempotencyKey || idempotency.required
      ? `${idempotency.mode || 'noop'} / ${idempotency.status || 'required'}`
      : 'not required',
    rollbackLabel: result?.rollback?.planned
      ? `${result.rollback.status || 'planned'} / id=${formatMaybe(result.rollback.rollbackPlanId)}`
      : 'not planned',
    externalGatewayLabel: externalGateway.providerName || externalGateway.currentMode
      ? `${externalGateway.providerName || 'external'} / mode=${externalGateway.currentMode || 'disabled'} / real=${asFlag(externalGateway.realEnabled)} / writes=${asFlag(externalGateway.externalWritesEnabled)}`
      : 'not configured',
    externalPreviewModeLabel: result?.externalPreviewMode || externalGateway.currentMode || 'disabled',
    expectedExternalActionLabel: result?.expectedExternalAction || 'none',
    requestPayloadPreviewLabel: requestPayloadPreview.providerName
      ? `${requestPayloadPreview.providerName} / ${requestPayloadPreview.externalAction || 'external'} / realRequest=${asFlag(requestPayloadPreview.realRequestWillBeSent)}`
      : 'not generated',
    mockWaybillLabel: mockWaybillPreview.waybillNo
      ? `${mockWaybillPreview.waybillNo} / create=${asFlag(mockWaybillPreview.willCreateWaybill)} / charge=${asFlag(mockWaybillPreview.willChargeFee)}`
      : 'not generated',
    mockDepositLabel: mockDepositPreview.mockDepositNo
      ? `${mockDepositPreview.mockDepositNo} / operation=${mockDepositPreview.operation || 'deposit'} / funds=${asFlag(mockDepositPreview.willChargeOrReleaseFunds)}`
      : 'not generated',
    mockXianyuSyncLabel: mockXianyuSyncPreview.mockSyncId
      ? `${mockXianyuSyncPreview.mockSyncId} / direction=${mockXianyuSyncPreview.syncDirection || 'pull_remote_order'} / localWrite=${asFlag(mockXianyuSyncPreview.willWriteLocalOrder)} / remoteWrite=${asFlag(mockXianyuSyncPreview.willUpdateRemoteOrder)}`
      : 'not generated',
    sandboxPayloadLabel: sandboxPayloadPreview.endpointMode
      ? `${sandboxPayloadPreview.endpointMode} / http=${asFlag(sandboxPayloadPreview.willSendHttpRequest)}`
      : 'not generated',
    conflictLabel: conflictCheck.checked
      ? `${conflictCheck.passed ? 'passed' : 'blocked'} / conflicts=${formatMaybe(conflictCheck.conflictCount, 0)}`
      : (conflictCheck.reason || 'not checked'),
    duplicateRecordLabel: duplicateRecordCheck.checked
      ? `${duplicateRecordCheck.duplicate ? 'duplicate' : 'clear'} / passed=${asFlag(duplicateRecordCheck.passed)}`
      : 'not checked',
    blockers,
    warnings,
    blockedReason: blockers.join('；'),
    code: result?.code || '',
  }
}

export async function runSafeOpsPreview(operationType, context = {}) {
  try {
    const result = await safeOpsAdapter.preview({
      operationType,
      actor: context.actor || buildSafeOpsActor('ui-v2-preview-helper'),
      target: context.target || {},
      payload: context.payload || {},
      clientRequestId: context.clientRequestId || `ui-v2-${operationType}-${Date.now()}`,
    })

    const view = toSafeOpsPreviewView(result)
    return {
      loading: false,
      result,
      view,
      error: result?.ok ? '' : view.summary,
    }
  } catch (error) {
    const result = {
      ok: false,
      supported: false,
      code: 'SAFE_OP_PREVIEW_ERROR',
      message: error?.message || 'safeOps preview failed safely',
      mode: 'dry-run',
      writeWillExecute: false,
      externalCallWillExecute: false,
      audit: { mode: 'noop', persisted: false },
      persistence: { mode: 'noop', available: false, reason: 'preview-error' },
      requiresConfirm: true,
      requiresIdempotencyKey: true,
      execute: { enabled: false, code: 'SAFE_OP_EXECUTE_DISABLED' },
      idempotency: { mode: 'noop', required: true, persisted: false },
      rollback: { mode: 'noop', planned: false, persisted: false },
    }

    return {
      loading: false,
      result,
      view: toSafeOpsPreviewView(result),
      error: result.message,
    }
  }
}
