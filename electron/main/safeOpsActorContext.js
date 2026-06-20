const OWNER_ROLE = 'owner'
const OPERATOR_ROLE = 'operator'
const VIEWER_ROLE = 'viewer'

const DEMO_ROLES = Object.freeze([OWNER_ROLE, OPERATOR_ROLE, VIEWER_ROLE])
const ROLE_LABELS = Object.freeze({
  [OWNER_ROLE]: '店主',
  [OPERATOR_ROLE]: '运营员',
  [VIEWER_ROLE]: '只读查看',
})
const DEMO_MERCHANT_CONTEXT = Object.freeze({
  merchantId: 'xiaogou-camera-rental',
  merchantName: '小狗相机租赁',
  storeId: 'shenzhen-nanshan-store',
  storeName: '深圳南山店',
})

const DEFAULT_ACTOR_CONTEXT = Object.freeze({
  id: 'demo-owner',
  role: OWNER_ROLE,
  source: 'safeops-demo',
  sessionId: 'local-demo-session',
  ...DEMO_MERCHANT_CONTEXT,
  isDemo: true,
})

const INTERNAL_EXECUTE_OPERATION_TYPES = new Set([
  'order.internal_note.update',
  'device.basic.update',
  'schedule.block.create',
  'schedule.block.cancel',
  'logistics.local_record.create',
])

const EXTERNAL_PREVIEW_OPERATION_TYPES = new Set([
  'logistics.sf.create_order',
  'deposit.create',
  'deposit.finish',
  'xianyu.order.sync',
])

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeRole(role) {
  const text = normalizeText(role).toLowerCase()
  return DEMO_ROLES.includes(text) ? text : DEFAULT_ACTOR_CONTEXT.role
}

function normalizeActorContext(actor = {}) {
  const role = normalizeRole(actor.role || actor.actorRole)
  const source = normalizeText(actor.source) || DEFAULT_ACTOR_CONTEXT.source
  const id = normalizeText(actor.id || actor.actorId) || `demo-${role}`
  return {
    id,
    role,
    roleLabel: ROLE_LABELS[role],
    source,
    sessionId: actor.sessionId ? String(actor.sessionId) : DEFAULT_ACTOR_CONTEXT.sessionId,
    merchantId: normalizeText(actor.merchantId) || DEMO_MERCHANT_CONTEXT.merchantId,
    merchantName: normalizeText(actor.merchantName) || DEMO_MERCHANT_CONTEXT.merchantName,
    storeId: normalizeText(actor.storeId) || DEMO_MERCHANT_CONTEXT.storeId,
    storeName: normalizeText(actor.storeName) || DEMO_MERCHANT_CONTEXT.storeName,
    isDemo: actor.isDemo === undefined ? true : Boolean(actor.isDemo),
  }
}

function isExternalPreviewOperation(operationType) {
  return EXTERNAL_PREVIEW_OPERATION_TYPES.has(normalizeText(operationType))
}

function isInternalExecuteOperation(operationType) {
  return INTERNAL_EXECUTE_OPERATION_TYPES.has(normalizeText(operationType))
}

function evaluateSafeOpsPermission({ actor = {}, operationType, action = 'preview' } = {}) {
  const actorContext = normalizeActorContext(actor)
  const normalizedOperationType = normalizeText(operationType)
  const normalizedAction = normalizeText(action) || 'preview'

  if (normalizedAction === 'execute') {
    if (isExternalPreviewOperation(normalizedOperationType)) {
      return {
        allowed: false,
        code: 'SAFE_OP_EXTERNAL_DISABLED',
        reason: '外部真实执行在本地演示中始终关闭。',
        actorContext,
      }
    }
    if (!isInternalExecuteOperation(normalizedOperationType)) {
      return {
        allowed: false,
        code: 'SAFE_OP_EXECUTE_DISABLED',
        reason: '本地演示只允许已加入安全门禁的内部操作执行。',
        actorContext,
      }
    }
    if (![OWNER_ROLE, OPERATOR_ROLE].includes(actorContext.role)) {
      return {
        allowed: false,
        code: 'SAFE_OP_PERMISSION_DENIED',
        reason: '只读查看角色只能查看，不能执行安全写操作。',
        actorContext,
      }
    }
    return {
      allowed: true,
      code: 'SAFE_OP_PERMISSION_ALLOWED',
      reason: `${actorContext.roleLabel}可以执行已加入门禁的内部安全操作。`,
      actorContext,
    }
  }

  if (normalizedAction === 'preview' && isExternalPreviewOperation(normalizedOperationType)) {
    if (actorContext.role !== OWNER_ROLE) {
      return {
        allowed: false,
        code: 'SAFE_OP_PERMISSION_DENIED',
        reason: '外部网关预览在本地演示中仅店主可查看。',
        actorContext,
      }
    }
  }

  return {
    allowed: true,
    code: 'SAFE_OP_PERMISSION_ALLOWED',
    reason: actorContext.role === VIEWER_ROLE
      ? '只读查看角色可以查看预览，但不能执行写操作。'
      : `${actorContext.roleLabel}可以查看该安全操作预览。`,
    actorContext,
  }
}

function getDemoActorContext(input = {}) {
  return {
    ok: true,
    mode: 'local-demo-actor-context',
    current: normalizeActorContext(input.actor || input),
    roles: DEMO_ROLES.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      canExecuteInternal: role === OWNER_ROLE || role === OPERATOR_ROLE,
      canPreviewExternal: role === OWNER_ROLE,
      canExecuteExternal: false,
    })),
    merchant: { ...DEMO_MERCHANT_CONTEXT },
    constraints: {
      realLoginEnabled: false,
      smsEnabled: false,
      oauthEnabled: false,
      paymentEnabled: false,
      externalRealEnabled: false,
      rollbackExecutable: false,
    },
  }
}

module.exports = {
  DEMO_MERCHANT_CONTEXT,
  DEMO_ROLES,
  DEFAULT_ACTOR_CONTEXT,
  evaluateSafeOpsPermission,
  getDemoActorContext,
  isExternalPreviewOperation,
  isInternalExecuteOperation,
  normalizeActorContext,
}
