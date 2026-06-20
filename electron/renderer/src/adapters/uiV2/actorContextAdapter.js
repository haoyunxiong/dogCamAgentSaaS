import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'

const ROLE_KEY = 'ui-v2-demo-role'
const ROLES = Object.freeze(['owner', 'operator', 'viewer'])
const DEFAULT_CONTEXT = Object.freeze({
  id: 'demo-owner',
  role: 'owner',
  source: 'ui-v2-demo',
  sessionId: 'local-demo-session',
  merchantId: 'demo-merchant-xiaogou-camera',
  merchantName: '小狗相机租赁 Demo 商户',
  storeId: 'demo-store-main',
  storeName: '本地 Demo 总店',
  isDemo: true,
})

function normalizeRole(role) {
  const text = String(role || '').trim().toLowerCase()
  return ROLES.includes(text) ? text : DEFAULT_CONTEXT.role
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readLocalRole() {
  if (!canUseStorage()) return DEFAULT_CONTEXT.role
  return normalizeRole(window.localStorage.getItem(ROLE_KEY) || DEFAULT_CONTEXT.role)
}

function writeLocalRole(role) {
  const normalizedRole = normalizeRole(role)
  if (canUseStorage()) window.localStorage.setItem(ROLE_KEY, normalizedRole)
  return normalizedRole
}

export function getLocalActorContext(overrides = {}) {
  const role = normalizeRole(overrides.role || readLocalRole())
  return {
    ...DEFAULT_CONTEXT,
    ...overrides,
    id: overrides.id || `demo-${role}`,
    role,
    source: overrides.source || DEFAULT_CONTEXT.source,
  }
}

function getSafeOpsBridge() {
  if (isUiV2PreviewMode()) return null
  if (!hasUiV2RuntimeBridge()) return null
  return window.electronAPI?.safeOps || null
}

export async function getCurrentActorContext(overrides = {}) {
  const localContext = getLocalActorContext(overrides)
  try {
    const bridge = getSafeOpsBridge()
    if (!bridge || typeof bridge.getActorContext !== 'function') {
      return {
        ok: true,
        source: 'renderer-local-demo',
        current: localContext,
        roles: buildRoleMatrix(),
      }
    }
    const result = await bridge.getActorContext({ actor: localContext })
    return result && typeof result === 'object'
      ? result
      : { ok: true, source: 'renderer-local-demo', current: localContext, roles: buildRoleMatrix() }
  } catch (error) {
    return {
      ok: false,
      source: 'renderer-local-demo',
      current: localContext,
      roles: buildRoleMatrix(),
      error: error?.message || 'actor context fallback',
    }
  }
}

export function setDemoRole(role) {
  return getLocalActorContext({ role: writeLocalRole(role) })
}

export function buildSafeOpsActor(source = 'ui-v2') {
  return {
    ...getLocalActorContext(),
    source,
  }
}

export function buildRoleMatrix() {
  return ROLES.map((role) => ({
    role,
    canExecuteInternal: role === 'owner' || role === 'operator',
    canPreviewExternal: role === 'owner',
    canExecuteExternal: false,
  }))
}

export function canExecuteOperation(actor = getLocalActorContext(), operationType = '') {
  const role = normalizeRole(actor.role)
  const type = String(operationType || '').trim()
  const internal = [
    'order.internal_note.update',
    'device.basic.update',
    'schedule.block.create',
    'schedule.block.cancel',
    'logistics.local_record.create',
  ].includes(type)
  return internal && (role === 'owner' || role === 'operator')
}

export function canPreviewExternalOperation(actor = getLocalActorContext(), operationType = '') {
  const role = normalizeRole(actor.role)
  const type = String(operationType || '').trim()
  const external = [
    'logistics.sf.create_order',
    'deposit.create',
    'deposit.finish',
    'xianyu.order.sync',
  ].includes(type)
  return external && role === 'owner'
}

export const actorContextAdapter = {
  buildRoleMatrix,
  buildSafeOpsActor,
  canExecuteOperation,
  canPreviewExternalOperation,
  getCurrentActorContext,
  getLocalActorContext,
  setDemoRole,
}
