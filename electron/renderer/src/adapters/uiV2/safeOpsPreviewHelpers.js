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
  return value === true ? '会执行' : '不会执行'
}

function enabledLabel(value) {
  return value === true ? '已开放' : '未开放'
}

function formatMaybe(value, fallback = '-') {
  return value === null || value === undefined || value === '' ? fallback : String(value)
}

function modeLabel(mode) {
  const labels = {
    'dry-run': '安全预览',
    write: '已写入',
    noop: '未持久化',
    disabled: '默认关闭',
    mock: '模拟预览',
    sandbox: '沙盒预览',
    real: '真实模式已关闭',
    persistence: '已持久化',
  }
  return labels[String(mode || '')] || String(mode || '安全预览')
}

function codeLabel(code, fallback = '') {
  const labels = {
    SAFE_OP_EXECUTED: '已执行',
    SAFE_OP_EXECUTE_READY: '待确认后可执行',
    SAFE_OP_EXECUTE_DISABLED: '执行未开放',
    SAFE_OP_EXTERNAL_DISABLED: '外部真实调用已关闭',
    SAFE_OP_PERMISSION_DENIED: '当前角色无权限',
    SAFE_OP_UNSUPPORTED: '操作暂不支持',
  }
  return labels[code] || fallback || formatMaybe(code, '未开放')
}

function providerLabel(providerName) {
  const labels = {
    sf_express: '顺丰网关',
    deposit_service: '免押服务',
    xianyu_platform: '闲鱼同步网关',
    external: '外部服务',
  }
  return labels[String(providerName || '')] || String(providerName || '外部服务')
}

function externalActionLabel(action) {
  const labels = {
    create_waybill: '创建运单预览',
    cancel_waybill: '取消运单预览',
    deposit_create: '创建免押预览',
    deposit_finish: '完结免押预览',
    sync_order: '订单同步预览',
    none: '无外部动作',
  }
  return labels[String(action || '')] || formatMaybe(action, '无外部动作')
}

function directionLabel(direction) {
  const labels = {
    pull_remote_order: '拉取远端订单',
    push_local_state: '推送本地状态',
    reconcile_status: '对账状态',
  }
  return labels[String(direction || '')] || formatMaybe(direction, '拉取远端订单')
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
    title: isExecuted ? '操作已执行' : (isOk ? '安全操作预览' : '安全预览不可用'),
    status: isExecuted ? '已执行' : (executeReady ? '待确认' : (isOk ? '仅预览' : '安全错误')),
    mode: modeLabel(result?.mode || 'dry-run'),
    riskLevel: result?.riskLevel || '未分级',
    summary: result?.impact?.summary || result?.message || '本次仅生成安全预览，不会写入数据，也不会调用外部服务。',
    writeWillExecute: asFlag(result?.writeWillExecute),
    externalCallWillExecute: asFlag(result?.externalCallWillExecute),
    persistenceLabel: `持久化：${enabledLabel(persistence.available)}${persistence.reason ? ` / ${persistence.reason}` : ''}`,
    auditLabel: `审计：${audit.persisted ? '已记录' : '未记录'} / 编号 ${formatMaybe(audit.auditLogId)}`,
    executeLabel: codeLabel(execute.code, executeReady ? '待确认后可执行' : `执行${enabledLabel(execute.enabled)}`),
    confirmLabel: confirmRequirement.exists
      ? `确认令牌已生成 / 过期时间 ${formatMaybe(confirmRequirement.expiresAt)}`
      : (result?.requiresConfirm ? '真实写入前必须先生成确认令牌' : '本操作不需要确认令牌'),
    idempotencyLabel: result?.requiresIdempotencyKey || idempotency.required
      ? `幂等保护：${idempotency.persisted ? '已记录' : '待记录'} / ${formatMaybe(idempotency.status, '需要')}`
      : '本操作不需要幂等键',
    rollbackLabel: result?.rollback?.planned
      ? `回滚占位：${result.rollback.persisted ? '已记录' : '未记录'} / 编号 ${formatMaybe(result.rollback.rollbackPlanId)}`
      : '未生成回滚占位',
    externalGatewayLabel: externalGateway.providerName || externalGateway.currentMode
      ? `${providerLabel(externalGateway.providerName || 'external')} / ${modeLabel(externalGateway.currentMode || 'disabled')} / 真实调用${externalGateway.realEnabled ? '已开放' : '关闭'} / 外部写入${externalGateway.externalWritesEnabled ? '已开放' : '关闭'}`
      : '未配置外部网关',
    externalPreviewModeLabel: modeLabel(result?.externalPreviewMode || externalGateway.currentMode || 'disabled'),
    expectedExternalActionLabel: externalActionLabel(result?.expectedExternalAction || 'none'),
    requestPayloadPreviewLabel: requestPayloadPreview.providerName
      ? `${providerLabel(requestPayloadPreview.providerName)} / ${externalActionLabel(requestPayloadPreview.externalAction || 'external')} / 真实请求${requestPayloadPreview.realRequestWillBeSent ? '会发送' : '不会发送'}`
      : '未生成请求预览',
    mockWaybillLabel: mockWaybillPreview.waybillNo
      ? `${mockWaybillPreview.waybillNo} / 真实运单${mockWaybillPreview.willCreateWaybill ? '会创建' : '不会创建'} / 费用${mockWaybillPreview.willChargeFee ? '会产生' : '不会产生'}`
      : '未生成模拟运单',
    mockDepositLabel: mockDepositPreview.mockDepositNo
      ? `${mockDepositPreview.mockDepositNo} / ${externalActionLabel(mockDepositPreview.operation || 'deposit')} / 资金${mockDepositPreview.willChargeOrReleaseFunds ? '会变动' : '不会变动'}`
      : '未生成免押模拟单',
    mockXianyuSyncLabel: mockXianyuSyncPreview.mockSyncId
      ? `${mockXianyuSyncPreview.mockSyncId} / ${directionLabel(mockXianyuSyncPreview.syncDirection)} / 本地写入${mockXianyuSyncPreview.willWriteLocalOrder ? '会发生' : '不会发生'} / 远端写入${mockXianyuSyncPreview.willUpdateRemoteOrder ? '会发生' : '不会发生'}`
      : '未生成闲鱼同步模拟',
    sandboxPayloadLabel: sandboxPayloadPreview.endpointMode
      ? `${modeLabel(sandboxPayloadPreview.endpointMode)} / HTTP 请求${sandboxPayloadPreview.willSendHttpRequest ? '会发送' : '不会发送'}`
      : '未生成沙盒报文',
    conflictLabel: conflictCheck.checked
      ? `${conflictCheck.passed ? '通过' : '已阻断'} / 冲突 ${formatMaybe(conflictCheck.conflictCount, 0)} 条`
      : (conflictCheck.reason || '未检查'),
    duplicateRecordLabel: duplicateRecordCheck.checked
      ? `${duplicateRecordCheck.duplicate ? '疑似重复' : '未发现重复'} / ${duplicateRecordCheck.passed ? '通过' : '已阻断'}`
      : '未检查',
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
      message: error?.message || '安全预览失败，未执行任何写入。',
      mode: 'dry-run',
      writeWillExecute: false,
      externalCallWillExecute: false,
      audit: { mode: 'noop', persisted: false },
      persistence: { mode: 'noop', available: false, reason: '预览失败' },
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
