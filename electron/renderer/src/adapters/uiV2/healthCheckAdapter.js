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
    mode: '本地演示健康检查',
    status: 'ready-for-local-demo',
    actorContext: actor,
    checks: [
      { key: 'db', label: '本地数据库连接', status: 'preview-only', detail: '浏览器预览不能直接检查数据库，Electron 桌面环境会通过 preload 检查。' },
      { key: 'safeops_tables', label: '安全操作表', status: policy.persistence?.available ? 'ready' : 'preview-only', detail: policy.persistence?.reason || '已通过安全策略降级检查。' },
      { key: 'external_gateway', label: '外部真实调用', status: external.realEnabled === false ? 'ready' : 'blocked', detail: '真实模式和外部写入必须保持关闭。' },
      { key: 'rollback', label: '自动回滚执行器', status: 'ready', detail: '自动回滚执行器按设计未开放。' },
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
        reason: '该页面已纳入本地演示路由。',
      })),
    },
    checklist: [
      '本地演示可查看。',
      '外部真实调用未开放。',
      '自动回滚执行器未开放。',
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
      mode: '本地演示健康检查',
      status: 'blocked',
      code: 'SAFE_OP_HEALTH_CHECK_ERROR',
      message: error?.message || '健康检查降级失败，未执行任何写入。',
    }
  }
}

export const healthCheckAdapter = {
  getLocalDemoHealthCheck,
}
