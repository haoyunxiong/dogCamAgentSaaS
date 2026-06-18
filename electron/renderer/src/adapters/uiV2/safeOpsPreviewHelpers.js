import { safeOpsAdapter } from './safeOpsAdapter.js'

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

export function toSafeOpsPreviewView(result = {}) {
  const isOk = Boolean(result?.ok && result?.supported)
  const audit = result?.audit || {}
  const execute = result?.execute || {}
  const idempotency = result?.idempotency || {}

  return {
    title: isOk ? 'Operation preview / dry-run only' : 'Operation preview unavailable',
    status: isOk ? 'not-open' : 'safe-error',
    mode: result?.mode || 'dry-run',
    riskLevel: result?.riskLevel || 'unknown',
    summary: result?.impact?.summary || result?.message || 'This action is preview-only and will not write data or call external services.',
    writeWillExecute: asFlag(result?.writeWillExecute),
    externalCallWillExecute: asFlag(result?.externalCallWillExecute),
    auditLabel: `${audit.mode || 'noop'} / persisted=${asFlag(audit.persisted)}`,
    executeLabel: execute.code || `execute ${disabledLabel(execute.enabled)}`,
    confirmLabel: result?.requiresConfirm ? 'required before future write' : 'not required',
    idempotencyLabel: result?.requiresIdempotencyKey || idempotency.required
      ? 'required before future write'
      : 'not required',
    rollbackLabel: result?.rollback?.planned ? 'planned' : 'not planned',
    code: result?.code || '',
  }
}

export async function runSafeOpsPreview(operationType, context = {}) {
  try {
    const result = await safeOpsAdapter.preview({
      operationType,
      actor: context.actor || { source: 'ui-v2', role: 'operator' },
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
