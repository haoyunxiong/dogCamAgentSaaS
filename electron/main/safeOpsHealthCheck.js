const { getDemoActorContext } = require('./safeOpsActorContext')
const { getExternalPolicy } = require('./safeOpsExternalPolicy')
const {
  SAFE_OPS_ENABLED_EXECUTE_OPERATION_TYPES,
  getSafeOpsPolicy,
} = require('./safeOpsPolicy')
const { getSafeOpsPersistenceStatus } = require('./safeOpsPersistence')

const UI_V2_ROUTE_CHECKS = Object.freeze([
  '/#/ui-v2/dashboard',
  '/#/ui-v2/orders',
  '/#/ui-v2/devices',
  '/#/ui-v2/schedule',
  '/#/ui-v2/logistics',
  '/#/ui-v2/deposit',
  '/#/ui-v2/settings',
])

function normalizeStatus(ok) {
  return ok ? 'ready' : 'blocked'
}

async function getSafeOpsHealthCheck(input = {}) {
  try {
    const policy = getSafeOpsPolicy()
    const external = getExternalPolicy()
    const persistence = await getSafeOpsPersistenceStatus()
    const safeOpsTablesReady = Boolean(persistence?.available)
    const migrationReady = Boolean(persistence?.migration && persistence.migration.status === 'applied')
    const externalRealDisabled = external.realEnabled === false && external.externalWritesEnabled === false
    const rollbackUnavailable = policy.operations.every((operation) => operation.rollbackExecutable !== true)
    const actorContext = getDemoActorContext(input.actor || {}).current

    const checks = [
      {
        key: 'db',
        label: '本地数据库连接',
        status: normalizeStatus(Boolean(persistence?.available)),
        detail: persistence?.available ? '安全操作持久化可用' : (persistence?.reason || '安全操作持久化不可用'),
      },
      {
        key: 'schema_migrations',
        label: '迁移记录',
        status: normalizeStatus(migrationReady),
        detail: migrationReady ? `迁移 ${persistence.migration.version} 已应用` : '迁移记录缺失或尚未应用',
      },
      {
        key: 'safeops_tables',
        label: '安全操作表',
        status: normalizeStatus(safeOpsTablesReady),
        detail: safeOpsTablesReady ? '审计、确认令牌、幂等、回滚占位表可用' : '安全操作表尚未全部可用',
      },
      {
        key: 'external_gateway',
        label: '外部真实调用',
        status: normalizeStatus(externalRealDisabled),
        detail: externalRealDisabled ? '真实模式和外部写入已关闭' : '外部真实模式未完全关闭',
      },
      {
        key: 'rollback',
        label: '自动回滚执行器',
        status: normalizeStatus(rollbackUnavailable),
        detail: rollbackUnavailable ? '自动回滚执行器按设计未开放' : '自动回滚执行器异常开启',
      },
    ]

    const ok = checks.every((check) => check.status === 'ready')
    return {
      ok,
      mode: '本地演示健康检查',
      status: ok ? 'ready-for-local-demo' : 'blocked',
      environment: {
        label: process.env.XIANYU_ENV_LABEL || 'local',
        productionEnabled: false,
        externalRealEnabled: false,
        rollbackExecutable: false,
      },
      actorContext,
      checks,
      db: {
        mode: persistence?.mode || 'noop',
        available: Boolean(persistence?.available),
        migration: persistence?.migration || null,
        tables: persistence?.tables || [],
      },
      safeOps: {
        safeMode: policy.safeMode,
        writeEnabled: policy.writeEnabled,
        executeEnabled: policy.executeEnabled,
        gatedOperations: [...SAFE_OPS_ENABLED_EXECUTE_OPERATION_TYPES],
        rollbackExecutable: false,
      },
      external: {
        providers: external.providers.map((provider) => ({
          providerName: provider.providerName,
          currentMode: provider.currentMode,
          realEnabled: Boolean(provider.realEnabled),
          mockEnabled: Boolean(provider.mockEnabled),
          sandboxEnabled: Boolean(provider.sandboxEnabled),
          externalWritesEnabled: Boolean(provider.externalWritesEnabled),
          status: provider.status || 'disabled',
        })),
        operations: external.operations.map((operation) => ({
          operationType: operation.operationType,
          providerName: operation.providerName,
          previewModes: operation.previewModes || ['disabled'],
          realEnabled: Boolean(operation.realEnabled),
          status: operation.status || 'disabled',
        })),
        realEnabled: false,
        externalWritesEnabled: false,
      },
      renderer: {
        routes: UI_V2_ROUTE_CHECKS.map((route) => ({
          route,
          configured: true,
          httpCheckedByMain: false,
          reason: 'main 健康检查不发起 HTTP 请求；页面可达性由本地冒烟命令验证',
        })),
      },
      checklist: [
        '仅允许本地数据库；不允许写生产库。',
        '外部真实调用保持关闭。',
        '自动回滚执行器保持未开放。',
        '未来生产发布前必须先确认迁移备份和回滚流程。',
        '日志和预览必须保持敏感字段脱敏。',
      ],
    }
  } catch (error) {
    return {
      ok: false,
      mode: '本地演示健康检查',
      status: 'blocked',
      code: 'SAFE_OP_HEALTH_CHECK_ERROR',
      message: error?.message || '安全操作健康检查失败，未执行任何写入。',
    }
  }
}

module.exports = {
  UI_V2_ROUTE_CHECKS,
  getSafeOpsHealthCheck,
}
