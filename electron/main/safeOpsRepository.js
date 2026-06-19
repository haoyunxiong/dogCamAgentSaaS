const mysql = require('mysql2/promise')
const { loadMysqlConfig } = require('./mysqlConfig')

const SAFE_OPS_TABLES = Object.freeze([
  'operation_audit_logs',
  'operation_confirm_tokens',
  'operation_idempotency_keys',
  'operation_rollback_plans',
])

const LEDGER_TABLE = 'schema_migrations'
const MIGRATION_VERSION = '20260618_0001_create_safe_ops_tables'

let sharedPool = null

function jsonOrNull(value) {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}

function dateOrNull(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeDbStatus(error) {
  return {
    mode: 'noop',
    available: false,
    reason: error?.message || String(error || 'safeOps persistence unavailable'),
  }
}

function assertLocalSafeTarget(config) {
  const host = String(config.host || '').trim().toLowerCase()
  const database = String(config.database || '').trim().toLowerCase()
  const envLabel = String(process.env.XIANYU_ENV_LABEL || '').trim().toLowerCase()
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('safeOps persistence disabled: MySQL host is not local')
  }
  if (!database || /(^|[_-])(prod|production|online|live)([_-]|$)/i.test(database)) {
    throw new Error('safeOps persistence disabled: database target is not confirmed local/test')
  }
  if (envLabel === 'production' || envLabel === 'prod') {
    throw new Error('safeOps persistence disabled: XIANYU_ENV_LABEL is production')
  }
}

function createPool(config = loadMysqlConfig()) {
  assertLocalSafeTarget(config)
  return mysql.createPool({
    host: config.host,
    port: Number(config.port || 3306),
    user: config.user,
    password: config.password || '',
    database: config.database,
    charset: config.charset || 'utf8mb4',
    timezone: config.timezone || '+08:00',
    waitForConnections: true,
    connectionLimit: Number(config.connectionLimit || 4),
  })
}

function getSharedPool() {
  if (!sharedPool) sharedPool = createPool()
  return sharedPool
}

async function withConnection(fn) {
  const pool = getSharedPool()
  const conn = await pool.getConnection()
  try {
    return await fn(conn)
  } finally {
    conn.release()
  }
}

async function listExistingSafeOpsTables(conn) {
  const tableNames = [LEDGER_TABLE, ...SAFE_OPS_TABLES]
  const placeholders = tableNames.map(() => '?').join(',')
  const [rows] = await conn.execute(`
    SELECT TABLE_NAME AS tableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${placeholders})
  `, tableNames)
  return new Set(rows.map((row) => row.tableName))
}

function createNoopResult(action, payload = {}, reason = 'safeOps DB persistence unavailable') {
  return {
    ok: true,
    action,
    mode: 'noop',
    available: false,
    persisted: false,
    reason,
    payload,
  }
}

function createNoopSafeOpsRepository(reason = 'safeOps DB persistence unavailable') {
  return {
    mode: 'noop',
    available: false,
    reason,
    async healthCheckSafeOpsTables() {
      return {
        ok: false,
        mode: 'noop',
        available: false,
        reason,
        tables: SAFE_OPS_TABLES.map((table) => ({ table, exists: false })),
      }
    },
    async createAuditLog(payload) {
      return createNoopResult('createAuditLog', payload, reason)
    },
    async updateAuditLogStatus(payload) {
      return createNoopResult('updateAuditLogStatus', payload, reason)
    },
    async getAuditLog(payload) {
      return createNoopResult('getAuditLog', payload, reason)
    },
    async createConfirmToken(payload) {
      return createNoopResult('createConfirmToken', payload, reason)
    },
    async consumeConfirmToken(payload) {
      return createNoopResult('consumeConfirmToken', payload, reason)
    },
    async getConfirmToken(payload) {
      return createNoopResult('getConfirmToken', payload, reason)
    },
    async createIdempotencyKey(payload) {
      return createNoopResult('createIdempotencyKey', payload, reason)
    },
    async getIdempotencyKey(payload) {
      return createNoopResult('getIdempotencyKey', payload, reason)
    },
    async markIdempotencyResult(payload) {
      return createNoopResult('markIdempotencyResult', payload, reason)
    },
    async createRollbackPlan(payload) {
      return createNoopResult('createRollbackPlan', payload, reason)
    },
    async getRollbackPlan(payload) {
      return createNoopResult('getRollbackPlan', payload, reason)
    },
    async persistAuditLog(payload) {
      return createNoopResult('persistAuditLog', payload, reason)
    },
    async createConfirmTokenLegacy(payload) {
      return createNoopResult('createConfirmToken', payload, reason)
    },
    async claimIdempotencyKey(payload) {
      return createNoopResult('claimIdempotencyKey', payload, reason)
    },
    async saveRollbackPlan(payload) {
      return createNoopResult('saveRollbackPlan', payload, reason)
    },
    async markAuditStatus(payload) {
      return createNoopResult('markAuditStatus', payload, reason)
    },
  }
}

function mapAuditLog(row) {
  if (!row) return null
  return {
    id: row.id,
    operationId: row.operation_id,
    operationType: row.operation_type,
    domain: row.domain,
    riskLevel: row.risk_level,
    mode: row.mode,
    status: row.status,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorSource: row.actor_source,
    targetType: row.target_type,
    targetId: row.target_id,
    clientRequestId: row.client_request_id,
    payloadHash: row.payload_hash,
    impactHash: row.impact_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapConfirmToken(row) {
  if (!row) return null
  return {
    id: row.id,
    operationType: row.operation_type,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorSource: row.actor_source,
    payloadHash: row.payload_hash,
    impactHash: row.impact_hash,
    previewAuditLogId: row.preview_audit_log_id,
    idempotencyKeyHash: row.idempotency_key_hash,
    status: row.status,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  }
}

function mapIdempotency(row) {
  if (!row) return null
  return {
    id: row.id,
    actorId: row.actor_id,
    operationType: row.operation_type,
    payloadHash: row.payload_hash,
    keyHash: row.key_hash,
    status: row.status,
    auditLogId: row.audit_log_id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    lockedUntil: row.locked_until,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRollbackPlan(row) {
  if (!row) return null
  return {
    id: row.id,
    operationId: row.operation_id,
    auditLogId: row.audit_log_id,
    operationType: row.operation_type,
    targetType: row.target_type,
    targetId: row.target_id,
    rollbackType: row.rollback_type,
    status: row.status,
    requiresConfirmation: Boolean(row.requires_confirmation),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

async function healthCheckSafeOpsTables() {
  try {
    return await withConnection(async (conn) => {
      const existingTables = await listExistingSafeOpsTables(conn)
      const missingTables = SAFE_OPS_TABLES.filter((table) => !existingTables.has(table))
      let migration = null
      if (existingTables.has(LEDGER_TABLE)) {
        const [rows] = await conn.execute(`
          SELECT version, checksum, status, applied_at AS appliedAt
          FROM schema_migrations
          WHERE version = ?
          LIMIT 1
        `, [MIGRATION_VERSION])
        migration = rows[0] || null
      }

      return {
        ok: missingTables.length === 0,
        mode: missingTables.length === 0 ? 'db' : 'noop',
        available: missingTables.length === 0,
        reason: missingTables.length === 0 ? null : `Missing safeOps tables: ${missingTables.join(', ')}`,
        migration,
        tables: SAFE_OPS_TABLES.map((table) => ({ table, exists: existingTables.has(table) })),
      }
    })
  } catch (error) {
    return {
      ok: false,
      ...normalizeDbStatus(error),
      tables: SAFE_OPS_TABLES.map((table) => ({ table, exists: false })),
    }
  }
}

async function createAuditLog(payload = {}) {
  return withConnection(async (conn) => {
    const actor = payload.actor || {}
    const target = payload.target || {}
    const [result] = await conn.execute(`
      INSERT INTO operation_audit_logs (
        operation_id, operation_type, domain, risk_level, mode, status,
        actor_id, actor_role, actor_source, session_id, device_id, ip_address,
        target_type, target_id, client_request_id, idempotency_key_hash,
        confirm_token_id, payload_hash, impact_hash, payload_redacted_json,
        preview_response_json, before_snapshot_json, after_snapshot_json,
        external_request_redacted_json, external_response_redacted_json,
        error_code, error_message, rollback_plan_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.operationId,
      payload.operationType,
      payload.domain || 'Unknown',
      payload.riskLevel || 'unknown',
      payload.mode || 'dry-run',
      payload.status || 'previewed',
      actor.id || null,
      actor.role || null,
      actor.source || null,
      actor.sessionId || null,
      payload.deviceId || null,
      payload.ipAddress || null,
      target.type || null,
      target.id || null,
      payload.clientRequestId || null,
      payload.idempotencyKeyHash || null,
      payload.confirmTokenId || null,
      payload.payloadHash || null,
      payload.impactHash || null,
      jsonOrNull(payload.payloadPreview),
      jsonOrNull(payload.previewResponse),
      jsonOrNull(payload.beforeSnapshot),
      jsonOrNull(payload.afterSnapshot),
      jsonOrNull(payload.externalRequest),
      jsonOrNull(payload.externalResponse),
      payload.errorCode || null,
      payload.errorMessage || null,
      payload.rollbackPlanId || null,
    ])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      id: result.insertId,
      operationId: payload.operationId,
    }
  })
}

async function updateAuditLogStatus({ id, operationId, status, errorCode = null, errorMessage = null, confirmTokenId = null, rollbackPlanId = null } = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      UPDATE operation_audit_logs
      SET status = COALESCE(?, status),
          error_code = COALESCE(?, error_code),
          error_message = COALESCE(?, error_message),
          confirm_token_id = COALESCE(?, confirm_token_id),
          rollback_plan_id = COALESCE(?, rollback_plan_id)
      WHERE ${id ? 'id = ?' : 'operation_id = ?'}
      LIMIT 1
    `, [status || null, errorCode, errorMessage, confirmTokenId, rollbackPlanId, id || operationId])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      affectedRows: result.affectedRows,
    }
  })
}

async function getAuditLog({ id, operationId } = {}) {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(`
      SELECT *
      FROM operation_audit_logs
      WHERE ${id ? 'id = ?' : 'operation_id = ?'}
      LIMIT 1
    `, [id || operationId])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: mapAuditLog(rows[0]),
    }
  })
}

async function createConfirmToken(payload = {}) {
  return withConnection(async (conn) => {
    const actor = payload.actor || {}
    const [result] = await conn.execute(`
      INSERT INTO operation_confirm_tokens (
        token_hash, operation_type, actor_id, actor_role, actor_source,
        payload_hash, impact_hash, preview_audit_log_id, idempotency_key_hash,
        status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.tokenHash,
      payload.operationType,
      actor.id || null,
      actor.role || null,
      actor.source || null,
      payload.payloadHash,
      payload.impactHash,
      payload.previewAuditLogId || null,
      payload.idempotencyKeyHash || null,
      payload.status || 'issued',
      dateOrNull(payload.expiresAt),
    ])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      id: result.insertId,
      expiresAt: payload.expiresAt,
    }
  })
}

async function consumeConfirmToken({ tokenHash, actorId, operationType } = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      UPDATE operation_confirm_tokens
      SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
        AND operation_type = ?
        AND (actor_id = ? OR actor_id IS NULL)
        AND status = 'issued'
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `, [tokenHash, operationType, actorId || null])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      consumed: result.affectedRows === 1,
    }
  })
}

async function getConfirmToken({ id, tokenHash } = {}) {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(`
      SELECT *
      FROM operation_confirm_tokens
      WHERE ${id ? 'id = ?' : 'token_hash = ?'}
      LIMIT 1
    `, [id || tokenHash])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: mapConfirmToken(rows[0]),
    }
  })
}

async function createIdempotencyKey(payload = {}) {
  return withConnection(async (conn) => {
    const actor = payload.actor || {}
    const [existingRows] = await conn.execute(`
      SELECT *
      FROM operation_idempotency_keys
      WHERE actor_id <=> ?
        AND operation_type = ?
        AND key_hash = ?
      LIMIT 1
    `, [actor.id || null, payload.operationType, payload.keyHash])
    if (existingRows[0]) {
      return {
        ok: true,
        mode: 'db',
        available: true,
        persisted: true,
        duplicate: true,
        id: existingRows[0].id,
        status: existingRows[0].status,
        record: mapIdempotency(existingRows[0]),
      }
    }

    const [result] = await conn.execute(`
      INSERT INTO operation_idempotency_keys (
        key_hash, actor_id, operation_type, payload_hash, status,
        audit_log_id, response_json, error_code, error_message,
        locked_until, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.keyHash,
      actor.id || null,
      payload.operationType,
      payload.payloadHash,
      payload.status || 'previewed',
      payload.auditLogId || null,
      jsonOrNull(payload.response),
      payload.errorCode || null,
      payload.errorMessage || null,
      dateOrNull(payload.lockedUntil),
      dateOrNull(payload.expiresAt),
    ])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      duplicate: false,
      id: result.insertId,
      status: payload.status || 'previewed',
    }
  })
}

async function getIdempotencyKey({ actorId, operationType, keyHash } = {}) {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(`
      SELECT *
      FROM operation_idempotency_keys
      WHERE actor_id <=> ?
        AND operation_type = ?
        AND key_hash = ?
      LIMIT 1
    `, [actorId || null, operationType, keyHash])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: mapIdempotency(rows[0]),
    }
  })
}

async function markIdempotencyResult({ id, actorId, operationType, keyHash, status, response, errorCode = null, errorMessage = null, auditLogId = null } = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      UPDATE operation_idempotency_keys
      SET status = COALESCE(?, status),
          response_json = COALESCE(?, response_json),
          error_code = COALESCE(?, error_code),
          error_message = COALESCE(?, error_message),
          audit_log_id = COALESCE(?, audit_log_id)
      WHERE ${id ? 'id = ?' : 'actor_id <=> ? AND operation_type = ? AND key_hash = ?'}
      LIMIT 1
    `, id
      ? [status || null, jsonOrNull(response), errorCode, errorMessage, auditLogId, id]
      : [status || null, jsonOrNull(response), errorCode, errorMessage, auditLogId, actorId || null, operationType, keyHash])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      affectedRows: result.affectedRows,
    }
  })
}

async function createRollbackPlan(payload = {}) {
  return withConnection(async (conn) => {
    const target = payload.target || {}
    const [result] = await conn.execute(`
      INSERT INTO operation_rollback_plans (
        operation_id, audit_log_id, operation_type, target_type, target_id,
        rollback_type, status, before_snapshot_json, after_snapshot_json,
        forward_effects_json, compensation_steps_json, external_refs_json,
        requires_confirmation, confirm_token_id, expires_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.operationId,
      payload.auditLogId || null,
      payload.operationType,
      target.type || null,
      target.id || null,
      payload.rollbackType || 'rollback',
      payload.status || 'not_executable',
      jsonOrNull(payload.beforeSnapshot),
      jsonOrNull(payload.afterSnapshot),
      jsonOrNull(payload.forwardEffects),
      jsonOrNull(payload.compensationSteps),
      jsonOrNull(payload.externalRefs),
      payload.requiresConfirmation === false ? 0 : 1,
      payload.confirmTokenId || null,
      dateOrNull(payload.expiresAt),
      payload.errorMessage || null,
    ])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      id: result.insertId,
      status: payload.status || 'not_executable',
    }
  })
}

async function getRollbackPlan({ id, operationId } = {}) {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(`
      SELECT *
      FROM operation_rollback_plans
      WHERE ${id ? 'id = ?' : 'operation_id = ?'}
      ORDER BY id DESC
      LIMIT 1
    `, [id || operationId])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: mapRollbackPlan(rows[0]),
    }
  })
}

function createDbSafeOpsRepository() {
  return {
    mode: 'db',
    available: true,
    healthCheckSafeOpsTables,
    createAuditLog,
    updateAuditLogStatus,
    getAuditLog,
    createConfirmToken,
    consumeConfirmToken,
    getConfirmToken,
    createIdempotencyKey,
    getIdempotencyKey,
    markIdempotencyResult,
    createRollbackPlan,
    getRollbackPlan,
    persistAuditLog: createAuditLog,
    claimIdempotencyKey: createIdempotencyKey,
    saveRollbackPlan: createRollbackPlan,
    markAuditStatus: updateAuditLogStatus,
  }
}

async function createSafeOpsRepository({ enabled = true } = {}) {
  if (!enabled) return createNoopSafeOpsRepository('safeOps DB persistence disabled by option')
  const dbRepository = createDbSafeOpsRepository()
  const health = await dbRepository.healthCheckSafeOpsTables()
  if (!health.available) return createNoopSafeOpsRepository(health.reason)
  return dbRepository
}

async function closeSafeOpsRepositoryPool() {
  if (!sharedPool) return
  const pool = sharedPool
  sharedPool = null
  await pool.end()
}

module.exports = {
  MIGRATION_VERSION,
  SAFE_OPS_TABLES,
  closeSafeOpsRepositoryPool,
  createDbSafeOpsRepository,
  createNoopSafeOpsRepository,
  createSafeOpsRepository,
  healthCheckSafeOpsTables,
}
