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
        label: 'Local MySQL connection',
        status: normalizeStatus(Boolean(persistence?.available)),
        detail: persistence?.available ? 'safeOps DB persistence is available' : (persistence?.reason || 'safeOps DB persistence unavailable'),
      },
      {
        key: 'schema_migrations',
        label: 'schema_migrations ledger',
        status: normalizeStatus(migrationReady),
        detail: migrationReady ? `migration ${persistence.migration.version} applied` : 'safeOps migration ledger is missing or not applied',
      },
      {
        key: 'safeops_tables',
        label: 'safeOps tables',
        status: normalizeStatus(safeOpsTablesReady),
        detail: safeOpsTablesReady ? 'operation audit/token/idempotency/rollback tables ready' : 'safeOps tables are not fully available',
      },
      {
        key: 'external_gateway',
        label: 'External real APIs',
        status: normalizeStatus(externalRealDisabled),
        detail: externalRealDisabled ? 'real mode and external writes are disabled' : 'external real mode is not fully disabled',
      },
      {
        key: 'rollback',
        label: 'Rollback executor',
        status: normalizeStatus(rollbackUnavailable),
        detail: rollbackUnavailable ? 'rollback executor unavailable by design' : 'rollback executor unexpectedly enabled',
      },
    ]

    const ok = checks.every((check) => check.status === 'ready')
    return {
      ok,
      mode: 'local-demo-readiness',
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
          reason: 'main health check does not make HTTP requests; route availability is verified by external smoke commands',
        })),
      },
      checklist: [
        'Local DB only; production DB writes are not allowed.',
        'External real APIs remain disabled.',
        'Rollback executor remains unavailable.',
        'Migration backup/rollback must be confirmed before any future production rollout.',
        'Logs and previews must keep sensitive fields redacted.',
      ],
    }
  } catch (error) {
    return {
      ok: false,
      mode: 'local-demo-readiness',
      status: 'blocked',
      code: 'SAFE_OP_HEALTH_CHECK_ERROR',
      message: error?.message || 'safeOps health check failed safely',
    }
  }
}

module.exports = {
  UI_V2_ROUTE_CHECKS,
  getSafeOpsHealthCheck,
}
