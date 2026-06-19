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

function jsonValue(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch (_error) {
    return null
  }
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
    async getRentalOrderInternalNoteSnapshot(payload) {
      return createNoopResult('getRentalOrderInternalNoteSnapshot', payload, reason)
    },
    async updateRentalOrderInternalNote(payload) {
      return createNoopResult('updateRentalOrderInternalNote', payload, reason)
    },
    async getScheduleUnitBasicSnapshot(payload) {
      return createNoopResult('getScheduleUnitBasicSnapshot', payload, reason)
    },
    async getScheduleUnitOccupationRisk(payload) {
      return createNoopResult('getScheduleUnitOccupationRisk', payload, reason)
    },
    async updateScheduleUnitBasicFields(payload) {
      return createNoopResult('updateScheduleUnitBasicFields', payload, reason)
    },
    async getScheduleUnitForBlock(payload) {
      return createNoopResult('getScheduleUnitForBlock', payload, reason)
    },
    async getRentalOrderExists(payload) {
      return createNoopResult('getRentalOrderExists', payload, reason)
    },
    async listScheduleBlockConflicts(payload) {
      return createNoopResult('listScheduleBlockConflicts', payload, reason)
    },
    async getScheduleBlockSnapshot(payload) {
      return createNoopResult('getScheduleBlockSnapshot', payload, reason)
    },
    async insertScheduleBlock(payload) {
      return createNoopResult('insertScheduleBlock', payload, reason)
    },
    async cancelScheduleBlock(payload) {
      return createNoopResult('cancelScheduleBlock', payload, reason)
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
    response: jsonValue(row.response_json),
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

async function updateAuditLogStatus({
  id,
  operationId,
  status,
  errorCode = null,
  errorMessage = null,
  confirmTokenId = null,
  rollbackPlanId = null,
  beforeSnapshot = undefined,
  afterSnapshot = undefined,
} = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      UPDATE operation_audit_logs
      SET status = COALESCE(?, status),
          error_code = COALESCE(?, error_code),
          error_message = COALESCE(?, error_message),
          confirm_token_id = COALESCE(?, confirm_token_id),
          rollback_plan_id = COALESCE(?, rollback_plan_id),
          before_snapshot_json = COALESCE(?, before_snapshot_json),
          after_snapshot_json = COALESCE(?, after_snapshot_json)
      WHERE ${id ? 'id = ?' : 'operation_id = ?'}
      LIMIT 1
    `, [
      status || null,
      errorCode,
      errorMessage,
      confirmTokenId,
      rollbackPlanId,
      beforeSnapshot === undefined ? null : jsonOrNull(beforeSnapshot),
      afterSnapshot === undefined ? null : jsonOrNull(afterSnapshot),
      id || operationId,
    ])
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

async function consumeConfirmToken({
  id,
  tokenHash,
  actorId,
  operationType,
  payloadHash,
  impactHash,
  previewAuditLogId = null,
} = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      UPDATE operation_confirm_tokens
      SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
      WHERE ${id ? 'id = ?' : 'token_hash = ?'}
        AND operation_type = ?
        AND actor_id <=> ?
        AND payload_hash = ?
        AND impact_hash = ?
        AND (preview_audit_log_id <=> ? OR ? IS NULL)
        AND status = 'issued'
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `, [
      id || tokenHash,
      operationType,
      actorId || null,
      payloadHash,
      impactHash,
      previewAuditLogId,
      previewAuditLogId,
    ])
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

function maskIdentifier(value) {
  const text = String(value || '')
  if (!text) return ''
  if (text.length <= 4) return '<redacted>'
  return `${text.slice(0, 2)}***${text.slice(-2)}`
}

function summarizeInternalNote(value) {
  const text = String(value || '')
  return {
    hasValue: Boolean(text.trim()),
    length: text.length,
    preview: text ? maskIdentifier(text) : '',
  }
}

function summarizeDeviceNote(value) {
  const text = String(value || '')
  return {
    hasValue: Boolean(text.trim()),
    length: text.length,
    preview: text ? maskIdentifier(text) : '',
  }
}

function mapRentalOrderInternalNoteSnapshot(row, overrideNote) {
  if (!row) return null
  const note = overrideNote === undefined ? row.internal_note : overrideNote
  return {
    orderId: String(row.id),
    orderNoMasked: maskIdentifier(row.order_no),
    orderStatus: row.order_status || null,
    modelCode: row.model_code || null,
    internalNote: summarizeInternalNote(note),
  }
}

function mapScheduleUnitBasicSnapshot(row, overridePatch = {}) {
  if (!row) return null
  const city = overridePatch.city === undefined ? row.city : overridePatch.city
  const note = overridePatch.note === undefined ? row.note : overridePatch.note
  const status = overridePatch.status === undefined ? row.status : overridePatch.status

  return {
    unitId: String(row.id),
    deviceId: String(row.id),
    unitCodeMasked: maskIdentifier(row.unit_code),
    modelCode: row.model_code || null,
    city: city ?? '',
    status: status || null,
    note: summarizeDeviceNote(note),
    updatedAt: row.updated_at || null,
  }
}

function summarizeScheduleNote(value) {
  const text = String(value || '')
  return {
    hasValue: Boolean(text.trim()),
    length: text.length,
    preview: text ? maskIdentifier(text) : '',
  }
}

function mapScheduleBlockSnapshot(row, overrideStatus) {
  if (!row) return null
  return {
    blockId: String(row.id),
    unitId: row.unit_id === null || row.unit_id === undefined ? null : String(row.unit_id),
    orderId: row.order_id === null || row.order_id === undefined ? null : String(row.order_id),
    unitCodeMasked: maskIdentifier(row.unit_code),
    modelCode: row.model_code || null,
    blockType: row.block_type || null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    plannedShipAt: row.planned_ship_at || null,
    expectedArriveAt: row.expected_arrive_at || null,
    status: overrideStatus || row.status || null,
    note: summarizeScheduleNote(row.note),
    updatedAt: row.updated_at || null,
  }
}

function mapScheduleBlockConflict(row) {
  if (!row) return null
  return {
    blockId: String(row.id),
    unitId: row.unit_id === null || row.unit_id === undefined ? null : String(row.unit_id),
    orderId: row.order_id === null || row.order_id === undefined ? null : String(row.order_id),
    blockType: row.block_type || null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    status: row.status || null,
  }
}

async function getRentalOrderInternalNoteSnapshot({ orderId } = {}) {
  return withConnection(async (conn) => {
    const normalizedOrderId = String(orderId || '').trim()
    if (!normalizedOrderId) {
      return {
        ok: true,
        mode: 'db',
        available: true,
        persisted: false,
        record: null,
      }
    }

    const numericId = /^\d+$/.test(normalizedOrderId) ? Number(normalizedOrderId) : null
    const [rows] = await conn.execute(`
      SELECT id, order_no, order_status, model_code, internal_note
      FROM rental_orders
      WHERE ${numericId !== null ? 'id = ? OR order_no = ?' : 'order_no = ?'}
      ORDER BY id ASC
      LIMIT 1
    `, numericId !== null ? [numericId, normalizedOrderId] : [normalizedOrderId])

    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: mapRentalOrderInternalNoteSnapshot(rows[0]),
      raw: rows[0] || null,
    }
  })
}

async function updateRentalOrderInternalNote({ id, internalNote } = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      UPDATE rental_orders
      SET internal_note = ?
      WHERE id = ?
      LIMIT 1
    `, [internalNote ?? null, id])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      affectedRows: result.affectedRows,
    }
  })
}

async function getScheduleUnitBasicSnapshot({ unitId, deviceId } = {}) {
  return withConnection(async (conn) => {
    const normalizedUnitId = String(unitId || deviceId || '').trim()
    if (!normalizedUnitId) {
      return {
        ok: true,
        mode: 'db',
        available: true,
        persisted: false,
        record: null,
      }
    }

    const numericId = /^\d+$/.test(normalizedUnitId) ? Number(normalizedUnitId) : null
    const [rows] = await conn.execute(`
      SELECT id, model_code, unit_code, city, status, note, updated_at
      FROM schedule_units
      WHERE ${numericId !== null ? 'id = ? OR unit_code = ?' : 'unit_code = ?'}
      ORDER BY id ASC
      LIMIT 1
    `, numericId !== null ? [numericId, normalizedUnitId] : [normalizedUnitId])

    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: mapScheduleUnitBasicSnapshot(rows[0]),
      raw: rows[0] || null,
    }
  })
}

async function getScheduleUnitOccupationRisk({ unitId } = {}) {
  return withConnection(async (conn) => {
    const normalizedUnitId = Number(unitId)
    if (!Number.isFinite(normalizedUnitId) || normalizedUnitId <= 0) {
      return {
        ok: true,
        mode: 'db',
        available: true,
        persisted: false,
        hasRisk: true,
        blockCount: 0,
        orderCount: 0,
        reason: 'schedule unit id is not numeric',
      }
    }

    const [blockRows] = await conn.execute(`
      SELECT COUNT(*) AS count
      FROM schedule_blocks
      WHERE unit_id = ?
        AND status IN ('active', 'occupied', 'locked', 'rented', 'busy')
        AND (end_date IS NULL OR end_date >= CURDATE())
    `, [normalizedUnitId])
    const [orderRows] = await conn.execute(`
      SELECT COUNT(*) AS count
      FROM rental_orders
      WHERE unit_id = ?
        AND (order_status IS NULL OR order_status NOT IN ('completed', 'cancelled'))
    `, [normalizedUnitId])

    const blockCount = Number(blockRows[0]?.count || 0)
    const orderCount = Number(orderRows[0]?.count || 0)
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      hasRisk: blockCount > 0 || orderCount > 0,
      blockCount,
      orderCount,
      reason: blockCount > 0 || orderCount > 0
        ? 'schedule unit has active/current-future schedule block or unfinished order'
        : null,
    }
  })
}

async function updateScheduleUnitBasicFields({ id, patch = {} } = {}) {
  return withConnection(async (conn) => {
    const normalizedId = Number(id)
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
      return {
        ok: false,
        mode: 'db',
        available: true,
        persisted: false,
        affectedRows: 0,
        reason: 'schedule unit id is required',
      }
    }

    const assignments = []
    const params = []
    for (const field of ['city', 'note', 'status']) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        assignments.push(`${field} = ?`)
        params.push(patch[field] ?? null)
      }
    }

    if (!assignments.length) {
      return {
        ok: false,
        mode: 'db',
        available: true,
        persisted: false,
        affectedRows: 0,
        reason: 'no allowed schedule unit fields supplied',
      }
    }

    const [result] = await conn.execute(`
      UPDATE schedule_units
      SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      LIMIT 1
    `, [...params, normalizedId])

    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      affectedRows: result.affectedRows,
    }
  })
}

async function getScheduleUnitForBlock({ unitId, deviceId } = {}) {
  return withConnection(async (conn) => {
    const normalizedUnitId = String(unitId || deviceId || '').trim()
    if (!normalizedUnitId) {
      return {
        ok: true,
        mode: 'db',
        available: true,
        persisted: false,
        record: null,
      }
    }

    const numericId = /^\d+$/.test(normalizedUnitId) ? Number(normalizedUnitId) : null
    const [rows] = await conn.execute(`
      SELECT id, model_code, unit_code, status
      FROM schedule_units
      WHERE ${numericId !== null ? 'id = ? OR unit_code = ?' : 'unit_code = ?'}
      ORDER BY id ASC
      LIMIT 1
    `, numericId !== null ? [numericId, normalizedUnitId] : [normalizedUnitId])
    const row = rows[0]
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: row ? {
        unitId: String(row.id),
        unitCodeMasked: maskIdentifier(row.unit_code),
        modelCode: row.model_code || null,
        status: row.status || null,
      } : null,
      raw: row || null,
    }
  })
}

async function getRentalOrderExists({ orderId } = {}) {
  return withConnection(async (conn) => {
    const normalizedOrderId = String(orderId || '').trim()
    if (!normalizedOrderId) {
      return {
        ok: true,
        mode: 'db',
        available: true,
        persisted: false,
        exists: false,
        record: null,
      }
    }

    const numericId = /^\d+$/.test(normalizedOrderId) ? Number(normalizedOrderId) : null
    const [rows] = await conn.execute(`
      SELECT id, order_no, order_status
      FROM rental_orders
      WHERE ${numericId !== null ? 'id = ? OR order_no = ?' : 'order_no = ?'}
      ORDER BY id ASC
      LIMIT 1
    `, numericId !== null ? [numericId, normalizedOrderId] : [normalizedOrderId])
    const row = rows[0]
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      exists: Boolean(row),
      record: row ? {
        orderId: String(row.id),
        orderNoMasked: maskIdentifier(row.order_no),
        orderStatus: row.order_status || null,
      } : null,
      raw: row || null,
    }
  })
}

async function listScheduleBlockConflicts({ unitId, startDate, endDate, excludeBlockId = null } = {}) {
  return withConnection(async (conn) => {
    const params = [unitId, endDate, startDate]
    const excludeClause = excludeBlockId ? 'AND id != ?' : ''
    if (excludeBlockId) params.push(excludeBlockId)
    const [rows] = await conn.execute(`
      SELECT id, unit_id, order_id, model_code, block_type, start_date, end_date, status
      FROM schedule_blocks
      WHERE unit_id = ?
        AND status NOT IN ('cancelled', 'canceled', 'deleted', 'inactive')
        AND start_date <= ?
        AND end_date >= ?
        ${excludeClause}
      ORDER BY start_date ASC, end_date ASC, id ASC
      LIMIT 20
    `, params)
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      count: rows.length,
      records: rows.map(mapScheduleBlockConflict).filter(Boolean),
      raw: rows,
    }
  })
}

async function getScheduleBlockSnapshot({ blockId } = {}) {
  return withConnection(async (conn) => {
    const normalizedBlockId = String(blockId || '').trim()
    if (!normalizedBlockId) {
      return {
        ok: true,
        mode: 'db',
        available: true,
        persisted: false,
        record: null,
      }
    }
    const [rows] = await conn.execute(`
      SELECT b.*, u.unit_code
      FROM schedule_blocks b
      LEFT JOIN schedule_units u ON u.id = b.unit_id
      WHERE b.id = ?
      LIMIT 1
    `, [normalizedBlockId])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: false,
      record: mapScheduleBlockSnapshot(rows[0]),
      raw: rows[0] || null,
    }
  })
}

async function insertScheduleBlock(payload = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      INSERT INTO schedule_blocks (
        unit_id, order_id, model_code, block_type, start_date, end_date,
        planned_ship_at, expected_arrive_at, status, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payload.unitId,
      payload.orderId || null,
      payload.modelCode,
      payload.blockType,
      payload.startDate,
      payload.endDate,
      payload.plannedShipAt || null,
      payload.expectedArriveAt || null,
      payload.status || 'active',
      payload.note || null,
    ])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    }
  })
}

async function cancelScheduleBlock({ blockId } = {}) {
  return withConnection(async (conn) => {
    const [result] = await conn.execute(`
      UPDATE schedule_blocks
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status NOT IN ('cancelled', 'canceled', 'deleted', 'inactive')
      LIMIT 1
    `, [blockId])
    return {
      ok: true,
      mode: 'db',
      available: true,
      persisted: true,
      affectedRows: result.affectedRows,
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
    getRentalOrderInternalNoteSnapshot,
    updateRentalOrderInternalNote,
    getScheduleUnitBasicSnapshot,
    getScheduleUnitOccupationRisk,
    updateScheduleUnitBasicFields,
    getScheduleUnitForBlock,
    getRentalOrderExists,
    listScheduleBlockConflicts,
    getScheduleBlockSnapshot,
    insertScheduleBlock,
    cancelScheduleBlock,
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
