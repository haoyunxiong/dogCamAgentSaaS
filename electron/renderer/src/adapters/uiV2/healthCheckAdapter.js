import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'
import { buildSafeOpsActor } from './actorContextAdapter.js'
import { safeOpsAdapter } from './safeOpsAdapter.js'

const UI_V2_DEMO_ROUTES = Object.freeze([
  '/#/ui-v2/dashboard',
  '/#/ui-v2/orders',
  '/#/ui-v2/devices',
  '/#/ui-v2/schedule',
  '/#/ui-v2/logistics',
  '/#/ui-v2/deposit',
  '/#/ui-v2/settings',
])

function getSafeOpsBridge() {
  if (isUiV2PreviewMode()) return null
  if (!hasUiV2RuntimeBridge()) return null
  return window.electronAPI?.safeOps || null
}

function buildLocalHealthFallback(policy = {}) {
  const external = policy.external || {}
  const actor = buildSafeOpsActor('ui-v2-health-check')
  const externalProviders = Array.isArray(external.providers) ? external.providers : []
  const externalOperations = Array.isArray(external.operations) ? external.operations : []
  const gatedOperations = policy.execute?.enabledOperationTypes || [
    'order.internal_note.update',
    'device.basic.update',
    'schedule.block.create',
    'schedule.block.cancel',
    'logistics.local_record.create',
  ]
  return {
    ok: true,
    mode: 'renderer-local-demo-readiness',
    status: 'ready-for-local-demo',
    actorContext: actor,
    checks: [
      { key: 'db', label: 'Local MySQL connection', status: 'preview-only', detail: 'Renderer preview cannot inspect DB directly.' },
      { key: 'safeops_tables', label: 'safeOps tables', status: policy.persistence?.available ? 'ready' : 'preview-only', detail: policy.persistence?.reason || 'Checked through safeOps policy fallback.' },
      { key: 'external_gateway', label: 'External real APIs', status: external.realEnabled === false ? 'ready' : 'blocked', detail: 'real mode and external writes must remain disabled.' },
      { key: 'rollback', label: 'Rollback executor', status: 'ready', detail: 'rollback executor unavailable by design.' },
    ],
    safeOps: {
      safeMode: policy.safeMode || 'gated-internal-write',
      writeEnabled: Boolean(policy.writeEnabled),
      executeEnabled: Boolean(policy.executeEnabled),
      gatedOperations,
      rollbackExecutable: false,
    },
    external: {
      providers: externalProviders,
      operations: externalOperations,
      realEnabled: false,
      externalWritesEnabled: false,
    },
    renderer: {
      routes: UI_V2_DEMO_ROUTES.map((route) => ({
        route,
        configured: true,
        httpCheckedByMain: false,
        reason: 'Route is configured in UI-V2 local demo.',
      })),
    },
    checklist: [
      '本地 Demo 可查看。',
      '外部真实调用未开放。',
      'rollback executor 未开放。',
      '生产上线尚未开启。',
    ],
  }
}

export async function getLocalDemoHealthCheck() {
  try {
    const actor = buildSafeOpsActor('ui-v2-health-check')
    const bridge = getSafeOpsBridge()
    if (bridge && typeof bridge.healthCheck === 'function') {
      const result = await bridge.healthCheck({ actor })
      if (result && typeof result === 'object') return result
    }
    const policy = await safeOpsAdapter.getPolicy({ actor })
    return buildLocalHealthFallback(policy)
  } catch (error) {
    return {
      ok: false,
      mode: 'renderer-local-demo-readiness',
      status: 'blocked',
      code: 'SAFE_OP_HEALTH_CHECK_ERROR',
      message: error?.message || 'health check fallback failed safely',
    }
  }
}

export const healthCheckAdapter = {
  getLocalDemoHealthCheck,
}
