#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { spawnSync } = require('child_process')
const { loadMysqlConfig } = require('../electron/main/mysqlConfig')

const ROOT_DIR = path.resolve(__dirname, '..')
const BACKUP_DIR = path.join(ROOT_DIR, 'data/db-backups')
const BACKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000

const MIGRATIONS = Object.freeze([
  {
    version: '20260618_0001_create_safe_ops_tables',
    name: 'create_safe_ops_tables',
    sqlPath: path.join(ROOT_DIR, 'scripts/migrations/20260618_0001_create_safe_ops_tables.sql'),
    rollbackPath: path.join(ROOT_DIR, 'scripts/migrations/20260618_0001_create_safe_ops_tables.rollback.sql'),
    shape: 'safe_ops_tables',
  },
  {
    version: '20260619_0002_add_rental_orders_internal_note',
    name: 'add_rental_orders_internal_note',
    sqlPath: path.join(ROOT_DIR, 'scripts/migrations/20260619_0002_add_rental_orders_internal_note.sql'),
    rollbackPath: path.join(ROOT_DIR, 'scripts/migrations/20260619_0002_add_rental_orders_internal_note.rollback.sql'),
    shape: 'rental_orders_internal_note',
  },
  {
    version: '20260621_0003_create_schedule_holds',
    name: 'create_schedule_holds',
    sqlPath: path.join(ROOT_DIR, 'scripts/migrations/20260621_0003_create_schedule_holds.sql'),
    rollbackPath: path.join(ROOT_DIR, 'scripts/migrations/20260621_0003_create_schedule_holds.rollback.sql'),
    shape: 'schedule_holds',
  },
])

const MIGRATION_WORKTREE_ALLOWLIST = Object.freeze(new Set([
  'scripts/migrations/20260619_0002_add_rental_orders_internal_note.sql',
  'scripts/migrations/20260619_0002_add_rental_orders_internal_note.rollback.sql',
  'scripts/migrations/20260621_0003_create_schedule_holds.sql',
  'scripts/migrations/20260621_0003_create_schedule_holds.rollback.sql',
  'scripts/run_safeops_migration.js',
  'scripts/mysql_schema.sql',
  'docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md',
  'docs/xiaogou-saas-roadmap/phases/phase-04-operation-safe-mode/README.md',
  'docs/xiaogou-saas-roadmap/phases/phase-04-operation-safe-mode/phase-04-plus-six-stage-roadmap.md',
]))

const SAFE_OPS_TABLES = Object.freeze([
  'operation_audit_logs',
  'operation_confirm_tokens',
  'operation_idempotency_keys',
  'operation_rollback_plans',
])

const LEDGER_TABLE = 'schema_migrations'

const LEGACY_TABLES = Object.freeze([
  'rental_orders',
  'schedule_units',
  'schedule_blocks',
  'shipping_records',
  'schedule_holds',
])

const REQUIRED_COLUMNS = Object.freeze({
  schema_migrations: ['version', 'name', 'checksum', 'applied_at', 'applied_by', 'status'],
  rental_orders: ['internal_note'],
  schedule_holds: [
    'hold_no',
    'merchant_id',
    'store_id',
    'actor_id',
    'actor_role',
    'model_code',
    'unit_id',
    'rent_start_date',
    'rent_end_date',
    'occupation_start_at',
    'occupation_end_at',
    'planned_ship_at',
    'expected_arrive_at',
    'query_address_json',
    'address_parse_json',
    'sf_estimate_json',
    'status',
    'expires_at',
    'converted_order_id',
    'idempotency_key_hash',
    'client_request_id',
  ],
  operation_audit_logs: ['operation_id', 'operation_type', 'payload_hash', 'impact_hash', 'before_snapshot_json', 'after_snapshot_json'],
  operation_confirm_tokens: ['token_hash', 'operation_type', 'payload_hash', 'impact_hash'],
  operation_idempotency_keys: ['key_hash', 'operation_type', 'payload_hash'],
  operation_rollback_plans: ['operation_id', 'operation_type', 'before_snapshot_json', 'after_snapshot_json'],
})

const REQUIRED_INDEXES = Object.freeze({
  operation_audit_logs: [
    'uniq_operation_audit_logs_operation_id',
    'idx_operation_audit_logs_type_status_created',
    'idx_operation_audit_logs_actor_created',
    'idx_operation_audit_logs_target',
    'idx_operation_audit_logs_idempotency',
  ],
  operation_confirm_tokens: [
    'uniq_operation_confirm_tokens_token_hash',
    'idx_operation_confirm_tokens_actor_operation_status',
    'idx_operation_confirm_tokens_expires_at',
    'idx_operation_confirm_tokens_preview_audit',
  ],
  operation_idempotency_keys: [
    'uniq_operation_idempotency_actor_type_key',
    'idx_operation_idempotency_status_lock',
    'idx_operation_idempotency_expires_at',
    'idx_operation_idempotency_audit_log',
  ],
  operation_rollback_plans: [
    'idx_operation_rollback_plans_operation_id',
    'idx_operation_rollback_plans_audit_log',
    'idx_operation_rollback_plans_type_status',
    'idx_operation_rollback_plans_target',
    'idx_operation_rollback_plans_expires_at',
  ],
  schedule_holds: [
    'hold_no',
    'idx_schedule_holds_unit_window_status',
    'idx_schedule_holds_model_status_expires',
    'idx_schedule_holds_store_status',
    'idx_schedule_holds_client_request',
    'idx_schedule_holds_converted_order',
  ],
})

function usage() {
  console.log(`Usage:
  SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --dry-run
  SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --verify
  SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --apply
  SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --rollback --i-understand-rollback-risk

Default mode prints this help and never executes SQL.
Run backup first before --apply:
  node scripts/backup_mysql.js

Recommended schema-only backup before --apply:
  mysqldump --no-data --databases <database> > data/db-backups/mysql-schema-YYYYMMDD-HHMMSS.sql`)
}

function fail(message, details = []) {
  console.error(`[safeOps migration] ${message}`)
  for (const detail of details.filter(Boolean)) console.error(`  - ${detail}`)
  process.exit(1)
}

function maskValue(value) {
  const text = String(value || '')
  if (!text) return '<empty>'
  if (text === '127.0.0.1' || text === 'localhost') return text
  if (text.length <= 2) return '*'.repeat(text.length)
  return `${text.slice(0, 1)}***${text.slice(-1)}`
}

function sanitizeError(error, config = {}) {
  let text = String(error?.message || error || 'unknown error')
  if (config.password) text = text.split(String(config.password)).join('<redacted>')
  return text
}

function detectConfigSource() {
  if (process.env.XIANYU_MYSQL_HOST || process.env.XIANYU_MYSQL_PORT || process.env.XIANYU_MYSQL_USER || process.env.XIANYU_MYSQL_DATABASE) {
    return 'env:XIANYU_MYSQL_*'
  }
  if (process.env.XIANYU_MYSQL_CONFIG) {
    return fs.existsSync(process.env.XIANYU_MYSQL_CONFIG)
      ? 'env:XIANYU_MYSQL_CONFIG'
      : 'env:XIANYU_MYSQL_CONFIG missing'
  }
  const candidates = [
    path.resolve(process.cwd(), 'mysql-connection.json'),
    path.resolve(process.cwd(), '..', 'mysql-connection.json'),
    path.resolve(__dirname, '..', 'mysql-connection.json'),
    path.resolve(__dirname, '..', '..', 'mysql-connection.json'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  return found ? `file:${path.basename(found)}` : 'default:mysqlConfig'
}

function printMaskedDbConfig(config) {
  console.log('[safeOps migration] DB target:')
  console.log(`  host: ${maskValue(config.host)}`)
  console.log(`  port: ${Number(config.port || 3306)}`)
  console.log(`  database: ${maskValue(config.database)}`)
  console.log(`  user: ${maskValue(config.user)}`)
  console.log(`  configSource: ${detectConfigSource()}`)
  console.log(`  XIANYU_ENV_LABEL: ${process.env.XIANYU_ENV_LABEL || '<unset>'}`)
}

function parseArgs(argv) {
  const flags = new Set(argv.slice(2))
  const modes = ['--dry-run', '--apply', '--verify', '--rollback'].filter((flag) => flags.has(flag))
  if (flags.has('--help') || flags.has('-h') || modes.length === 0) return { mode: 'help', flags }
  if (modes.length > 1) fail('Choose exactly one mode.', modes)
  return { mode: modes[0].slice(2), flags }
}

function assertGitClean() {
  const result = spawnSync('git', ['status', '--porcelain=v1', '-z'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  })
  if (result.error) fail('Unable to check git status.', [result.error.message])
  if (result.status !== 0) fail('git status failed.', [result.stderr || result.stdout])
  const dirtyFiles = result.stdout
    .split('\0')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((filePath) => filePath.includes(' -> ') ? filePath.split(' -> ').pop() : filePath)
  const unexpected = dirtyFiles.filter((filePath) => !MIGRATION_WORKTREE_ALLOWLIST.has(filePath))
  if (unexpected.length) {
    fail('Git worktree has files outside the safeOps migration allowlist.', unexpected)
  }
  if (dirtyFiles.length) {
    console.log('[safeOps migration] Git worktree contains only expected migration files:')
    for (const filePath of dirtyFiles) console.log(`  ${filePath}`)
  }
}

function warnGitDirtyForVerify() {
  const result = spawnSync('git', ['status', '--porcelain=v1'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  })
  if (result.error || result.status !== 0) {
    console.log('[safeOps migration] Verify could not inspect git status; continuing without executing migration SQL.')
    return
  }
  const dirtyFiles = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!dirtyFiles.length) return
  console.log('[safeOps migration] Verify is running with a dirty worktree; this mode is read-only and will not execute migration SQL:')
  for (const filePath of dirtyFiles) console.log(`  ${filePath}`)
}

function assertLocalGuard(config) {
  const errors = []
  const envLabel = String(process.env.XIANYU_ENV_LABEL || '').trim().toLowerCase()
  const host = String(config.host || '').trim().toLowerCase()
  const database = String(config.database || '').trim().toLowerCase()
  const user = String(config.user || '').trim().toLowerCase()

  if (process.env.SAFEOPS_MIGRATION_APPROVED !== 'local') {
    errors.push('SAFEOPS_MIGRATION_APPROVED must equal "local".')
  }
  if (envLabel === 'production' || envLabel === 'prod') {
    errors.push('XIANYU_ENV_LABEL must not be production.')
  }
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    errors.push('DB host must be 127.0.0.1 or localhost.')
  }
  if (!database) {
    errors.push('DB database is required.')
  }
  if (/(^|[_-])(prod|production|online|live)([_-]|$)/i.test(database)) {
    errors.push('DB database name looks production-like.')
  }
  if (['xianyu_app', 'prod', 'production'].includes(user)) {
    errors.push('DB user looks like a production user.')
  }
  if (errors.length) fail('Local/test database guard failed.', errors)
}

function stripSqlComments(statement) {
  return statement
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
}

function assertMigrationSqlShape(migration, sqlText) {
  const statements = splitSqlStatements(sqlText).map(stripSqlComments).filter(Boolean)
  if (migration.shape === 'safe_ops_tables') {
    const prohibited = sqlText
      .split(/\r?\n/)
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => /^(ALTER|DROP|INSERT|UPDATE|DELETE|RENAME|TRUNCATE)\b/i.test(line))
    if (prohibited.length) {
      fail('Migration SQL contains non-additive statements.', prohibited.map((item) => `${item.number}: ${item.line}`))
    }
    return
  }

  if (migration.shape === 'rental_orders_internal_note') {
    const [statement] = statements
    const allowed = /^ALTER\s+TABLE\s+`?rental_orders`?\s+ADD\s+COLUMN\s+`?internal_note`?\s+TEXT\s+NULL(?:\s+COMMENT\s+'[^']*')?$/i
    if (statements.length !== 1 || !allowed.test(statement.replace(/\s+/g, ' '))) {
      fail('Internal note migration must only add rental_orders.internal_note.', statements)
    }
    return
  }

  if (migration.shape === 'schedule_holds') {
    const prohibited = sqlText
      .split(/\r?\n/)
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => /^(ALTER|DROP|INSERT|UPDATE|DELETE|RENAME|TRUNCATE)\b/i.test(line))
    if (prohibited.length) {
      fail('schedule_holds migration must be additive only.', prohibited.map((item) => `${item.number}: ${item.line}`))
    }
    const statement = statements.join(' ')
    if (statements.length !== 1 || !/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?schedule_holds`?\s*\(/i.test(statement.replace(/\s+/g, ' '))) {
      fail('schedule_holds migration must only create schedule_holds.', statements)
    }
    return
  }

  fail('Unknown migration SQL shape.', [migration.version])
}

function checksumFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return crypto.createHash('sha256').update(text).digest('hex')
}

function findRecentBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return null
  const now = Date.now()
  const candidates = fs.readdirSync(BACKUP_DIR)
    .filter((name) => /^mysql-dump-\d{8}-\d{6}\.sql$/.test(name))
    .map((name) => {
      const filePath = path.join(BACKUP_DIR, name)
      const stat = fs.statSync(filePath)
      return { name, filePath, size: stat.size, mtimeMs: stat.mtimeMs, ageMs: now - stat.mtimeMs }
    })
    .filter((item) => item.size > 0 && item.ageMs <= BACKUP_MAX_AGE_MS)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
  return candidates[0] || null
}

function assertRecentBackup() {
  const backup = findRecentBackup()
  if (!backup) {
    fail('No recent non-empty MySQL full dump found for --apply.', [
      `Expected a recent mysql-dump-*.sql under ${BACKUP_DIR}`,
      'Run: node scripts/backup_mysql.js',
      'Also recommended: create a schema-only dump before --apply.',
    ])
  }
  console.log(`[safeOps migration] Recent backup found: ${backup.filePath}`)
}

function splitSqlStatements(sqlText) {
  return sqlText
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

function loadMysql() {
  const mysqlPath = path.join(ROOT_DIR, 'electron/node_modules/mysql2/promise')
  try {
    return require(mysqlPath)
  } catch (error) {
    fail('mysql2 dependency is not available. Run npm install in electron before using this runner.', [sanitizeError(error)])
  }
}

async function createConnection(config) {
  const mysql = loadMysql()
  return mysql.createConnection({
    host: config.host,
    port: Number(config.port || 3306),
    user: config.user,
    password: config.password || '',
    database: config.database,
    charset: config.charset || 'utf8mb4',
    timezone: config.timezone || '+08:00',
  })
}

async function readRows(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params)
  return rows
}

async function listExistingTables(conn, tableNames) {
  if (!tableNames.length) return new Set()
  const placeholders = tableNames.map(() => '?').join(',')
  const rows = await readRows(conn, `
    SELECT TABLE_NAME AS tableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${placeholders})
  `, tableNames)
  return new Set(rows.map((row) => row.tableName))
}

async function getLedgerRows(conn) {
  const existingTables = await listExistingTables(conn, [LEDGER_TABLE])
  if (!existingTables.has(LEDGER_TABLE)) return new Map()
  const versions = MIGRATIONS.map((migration) => migration.version)
  const placeholders = versions.map(() => '?').join(',')
  const rows = await readRows(conn, `
    SELECT version, name, checksum, status, applied_at AS appliedAt
    FROM schema_migrations
    WHERE version IN (${placeholders})
  `, versions)
  return new Map(rows.map((row) => [row.version, row]))
}

function validateLedgerRows(ledgerRows, checksumsByVersion) {
  for (const migration of MIGRATIONS) {
    const row = ledgerRows.get(migration.version)
    if (!row) continue
    if (row.status !== 'applied') {
      fail('schema_migrations has an abnormal status for this migration.', [
        `${migration.version}: status=${row.status}`,
      ])
    }
    const expectedChecksum = checksumsByVersion.get(migration.version)
    if (expectedChecksum && row.checksum && row.checksum !== expectedChecksum) {
      fail('schema_migrations checksum does not match migration SQL.', [
        `${migration.version}: expected=${expectedChecksum} actual=${row.checksum}`,
      ])
    }
  }
}

function getPendingMigrations(ledgerRows) {
  return MIGRATIONS.filter((migration) => !ledgerRows.has(migration.version))
}

async function columnExists(conn, tableName, columnName) {
  const rows = await readRows(conn, `
    SELECT COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  `, [tableName, columnName])
  return rows.length > 0
}

async function precheck(conn, mode, checksumsByVersion) {
  const contextRows = await readRows(conn, 'SELECT DATABASE() AS dbName, CURRENT_USER() AS currentUser, @@hostname AS hostName')
  const context = contextRows[0] || {}
  console.log('[safeOps migration] DB context:')
  console.log(`  database: ${maskValue(context.dbName)}`)
  console.log(`  currentUser: ${maskValue(context.currentUser)}`)
  console.log(`  mysqlHostName: ${maskValue(context.hostName)}`)

  const allMigrationTables = [LEDGER_TABLE, ...SAFE_OPS_TABLES]
  const existingTables = await listExistingTables(conn, allMigrationTables)
  const existingOperationTables = SAFE_OPS_TABLES.filter((table) => existingTables.has(table))
  const ledgerRows = await getLedgerRows(conn)
  validateLedgerRows(ledgerRows, checksumsByVersion)
  const pendingMigrations = getPendingMigrations(ledgerRows)
  const safeOpsLedgerRow = ledgerRows.get('20260618_0001_create_safe_ops_tables')
  const internalNoteLedgerRow = ledgerRows.get('20260619_0002_add_rental_orders_internal_note')
  const scheduleHoldsLedgerRow = ledgerRows.get('20260621_0003_create_schedule_holds')
  const hasInternalNoteColumn = await columnExists(conn, 'rental_orders', 'internal_note')
  const hasScheduleHoldsTable = (await listExistingTables(conn, ['schedule_holds'])).has('schedule_holds')

  if (existingOperationTables.length > 0 && existingOperationTables.length < SAFE_OPS_TABLES.length) {
    fail('Partial safeOps operation tables found. Stop and inspect manually.', existingOperationTables)
  }
  if (existingOperationTables.length === SAFE_OPS_TABLES.length && !safeOpsLedgerRow) {
    fail('safeOps tables already exist but ledger row is missing. Stop and inspect manually.')
  }
  if (hasInternalNoteColumn && !internalNoteLedgerRow) {
    fail('rental_orders.internal_note already exists but ledger row is missing. Stop and inspect manually.')
  }
  if (internalNoteLedgerRow && !hasInternalNoteColumn) {
    fail('schema_migrations says internal_note migration is applied, but rental_orders.internal_note is missing.')
  }
  if (hasScheduleHoldsTable && !scheduleHoldsLedgerRow) {
    fail('schedule_holds table already exists but ledger row is missing. Stop and inspect manually.')
  }
  if (scheduleHoldsLedgerRow && !hasScheduleHoldsTable) {
    fail('schema_migrations says schedule_holds migration is applied, but schedule_holds is missing.')
  }

  console.log('[safeOps migration] Precheck tables:')
  console.log(`  ${LEDGER_TABLE}: ${existingTables.has(LEDGER_TABLE) ? 'exists' : 'missing'}`)
  for (const table of SAFE_OPS_TABLES) {
    console.log(`  ${table}: ${existingTables.has(table) ? 'exists' : 'missing'}`)
  }
  console.log(`  rental_orders.internal_note: ${hasInternalNoteColumn ? 'exists' : 'missing'}`)
  console.log(`  schedule_holds: ${hasScheduleHoldsTable ? 'exists' : 'missing'}`)
  console.log('[safeOps migration] Migration ledger:')
  for (const migration of MIGRATIONS) {
    console.log(`  ${migration.version}: ${ledgerRows.has(migration.version) ? 'applied' : 'pending'}`)
  }
  console.log(`[safeOps migration] Pending migrations: ${pendingMigrations.length ? pendingMigrations.map((migration) => migration.version).join(', ') : 'none'}`)

  return { context, existingTables, existingOperationTables, ledgerRows, pendingMigrations, hasInternalNoteColumn }
}

async function executeSqlFile(conn, filePath) {
  const sqlText = fs.readFileSync(filePath, 'utf8')
  for (const statement of splitSqlStatements(sqlText)) {
    await conn.execute(statement)
  }
}

async function recordLedger(conn, migration, checksum) {
  const appliedBy = os.userInfo().username || 'local-script'
  await conn.execute(`
    INSERT INTO schema_migrations (version, name, checksum, applied_by, status)
    VALUES (?, ?, ?, ?, 'applied')
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      checksum = VALUES(checksum),
      applied_by = VALUES(applied_by),
      applied_at = CURRENT_TIMESTAMP,
      status = 'applied'
  `, [migration.version, migration.name, checksum, appliedBy])
}

async function readColumns(conn, tableName) {
  const rows = await readRows(conn, `
    SELECT COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `, [tableName])
  return new Set(rows.map((row) => row.columnName))
}

async function readIndexes(conn, tableName) {
  const rows = await readRows(conn, `
    SELECT DISTINCT INDEX_NAME AS indexName
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `, [tableName])
  return new Set(rows.map((row) => row.indexName))
}

async function verifyApplied(conn, { requireLedger = true } = {}) {
  const requiredTables = [LEDGER_TABLE, ...SAFE_OPS_TABLES]
  const existingTables = await listExistingTables(conn, [...requiredTables, ...LEGACY_TABLES])
  const missingTables = requiredTables.filter((table) => !existingTables.has(table))
  if (missingTables.length) fail('Required migration tables are missing.', missingTables)

  const missingLegacyTables = LEGACY_TABLES.filter((table) => !existingTables.has(table))
  if (missingLegacyTables.length) fail('Legacy business tables are missing after migration.', missingLegacyTables)

  if (requireLedger) {
    const ledgerRows = await getLedgerRows(conn)
    const missingLedgerRows = MIGRATIONS
      .filter((migration) => ledgerRows.get(migration.version)?.status !== 'applied')
      .map((migration) => migration.version)
    if (missingLedgerRows.length) {
      fail('schema_migrations ledger rows are missing or not applied.', missingLedgerRows)
    }
  }

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const existingColumns = await readColumns(conn, table)
    const missingColumns = columns.filter((column) => !existingColumns.has(column))
    if (missingColumns.length) fail(`Required columns missing in ${table}.`, missingColumns)
  }

  for (const [table, indexes] of Object.entries(REQUIRED_INDEXES)) {
    const existingIndexes = await readIndexes(conn, table)
    const missingIndexes = indexes.filter((indexName) => !existingIndexes.has(indexName))
    if (missingIndexes.length) fail(`Required indexes missing in ${table}.`, missingIndexes)
  }

  console.log('[safeOps migration] Verify passed: safeOps tables, key columns, key indexes, and legacy tables are present.')
}

async function assertRollbackTablesEmpty(conn) {
  const existingTables = await listExistingTables(conn, SAFE_OPS_TABLES)
  for (const table of SAFE_OPS_TABLES) {
    if (!existingTables.has(table)) continue
    const rows = await readRows(conn, `SELECT COUNT(*) AS count FROM ${table}`)
    const count = Number(rows[0]?.count || 0)
    if (count > 0) {
      fail('Rollback refused because safeOps operation tables contain data.', [`${table}: ${count} rows`])
    }
  }
}

async function verifyRolledBack(conn) {
  const existingTables = await listExistingTables(conn, [LEDGER_TABLE, ...SAFE_OPS_TABLES, ...LEGACY_TABLES])
  const stillExisting = SAFE_OPS_TABLES.filter((table) => existingTables.has(table))
  if (stillExisting.length) fail('Rollback verification failed; safeOps operation tables still exist.', stillExisting)
  if (!existingTables.has(LEDGER_TABLE)) fail('Rollback verification failed; schema_migrations should be preserved.')
  const missingLegacyTables = LEGACY_TABLES.filter((table) => !existingTables.has(table))
  if (missingLegacyTables.length) fail('Rollback verification failed; legacy tables are missing.', missingLegacyTables)
  console.log('[safeOps migration] Rollback verify passed: operation_* tables removed, schema_migrations preserved.')
}

async function withConnection(config, fn) {
  const conn = await createConnection(config)
  try {
    return await fn(conn)
  } finally {
    await conn.end()
  }
}

async function main() {
  const { mode, flags } = parseArgs(process.argv)
  if (mode === 'help') {
    usage()
    return
  }

  const config = loadMysqlConfig()
  printMaskedDbConfig(config)
  if (mode === 'verify') warnGitDirtyForVerify()
  else assertGitClean()
  assertLocalGuard(config)

  const checksumsByVersion = new Map()
  for (const migration of MIGRATIONS) {
    const checksum = checksumFile(migration.sqlPath)
    const migrationSql = fs.readFileSync(migration.sqlPath, 'utf8')
    assertMigrationSqlShape(migration, migrationSql)
    checksumsByVersion.set(migration.version, checksum)
    console.log(`[safeOps migration] ${migration.version} checksum sha256=${checksum}`)
  }

  if (mode === 'apply') {
    assertRecentBackup()
  }
  if (mode === 'rollback' && !flags.has('--i-understand-rollback-risk')) {
    fail('Rollback is refused by default. Re-run with --i-understand-rollback-risk only before safeOps tables contain business audit data.')
  }

  await withConnection(config, async (conn) => {
    if (mode === 'dry-run') {
      await precheck(conn, mode, checksumsByVersion)
      console.log('[safeOps migration] Dry-run completed. No migration SQL or DDL was executed.')
      return
    }

    if (mode === 'verify') {
      await precheck(conn, mode, checksumsByVersion)
      await verifyApplied(conn)
      return
    }

    if (mode === 'apply') {
      const result = await precheck(conn, mode, checksumsByVersion)
      if (!result.pendingMigrations.length) {
        console.log('[safeOps migration] No pending migrations. No SQL was executed.')
        await verifyApplied(conn)
        return
      }
      for (const migration of result.pendingMigrations) {
        console.log(`[safeOps migration] Applying ${migration.version}...`)
        await executeSqlFile(conn, migration.sqlPath)
        await recordLedger(conn, migration, checksumsByVersion.get(migration.version))
      }
      await verifyApplied(conn)
      console.log(`[safeOps migration] Applied ${result.pendingMigrations.map((migration) => migration.version).join(', ')}.`)
      return
    }

    if (mode === 'rollback') {
      console.error('[safeOps migration] ROLLBACK WARNING: only allowed before safeOps tables carry business audit data.')
      await precheck(conn, mode, checksumsByVersion)
      await assertRollbackTablesEmpty(conn)
      const safeOpsMigration = MIGRATIONS.find((migration) => migration.version === '20260618_0001_create_safe_ops_tables')
      await executeSqlFile(conn, safeOpsMigration.rollbackPath)
      await verifyRolledBack(conn)
      return
    }

    usage()
  })
}

main().catch((error) => {
  fail('Runner failed safely.', [sanitizeError(error)])
})
