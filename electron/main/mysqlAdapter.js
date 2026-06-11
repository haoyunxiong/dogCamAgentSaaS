/**
 * MySQL adapter that mimics better-sqlite3's synchronous API shape.
 * Uses mysql2's sync-like execute via a connection pool.
 * 
 * All methods return Promises, so callers must await.
 * The dbManager.js functions are converted to async.
 */
const mysql = require('mysql2/promise')
const { loadMysqlConfig, describeMysqlConfig } = require('./mysqlConfig')

let pool = null
let activeConfig = null

async function initPool(config = {}) {
  activeConfig = loadMysqlConfig(config)
  pool = mysql.createPool(activeConfig)
  // Test connection
  const conn = await pool.getConnection()
  conn.release()
  console.log('[MySQL] Pool initialized, connected to', describeMysqlConfig(activeConfig))
  return pool
}

function getPool() {
  if (!pool) throw new Error('MySQL pool not initialized. Call initPool() first.')
  return pool
}

/** Execute SQL, return [rows, fields] */
async function query(sql, params = []) {
  return getPool().execute(sql, params)
}

/** Get one row */
async function get(sql, params = []) {
  const [rows] = await query(sql, params)
  return rows[0] || null
}

/** Get all rows */
async function all(sql, params = []) {
  const [rows] = await query(sql, params)
  return rows
}

/** Run INSERT/UPDATE/DELETE, return { insertId, affectedRows } */
async function run(sql, params = []) {
  const [result] = await query(sql, params)
  return {
    lastInsertRowid: result.insertId,
    changes: result.affectedRows,
  }
}

/** Execute raw SQL (DDL etc) */
async function exec(sql) {
  // Split multiple statements if needed
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await getPool().execute(stmt)
  }
}

/** Transaction helper */
async function transaction(fn) {
  const conn = await getPool().getConnection()
  await conn.beginTransaction()
  try {
    const result = await fn({
      query: (sql, params) => conn.execute(sql, params),
      get: async (sql, params) => { const [rows] = await conn.execute(sql, params); return rows[0] || null },
      all: async (sql, params) => { const [rows] = await conn.execute(sql, params); return rows },
      run: async (sql, params) => { const [result] = await conn.execute(sql, params); return { lastInsertRowid: result.insertId, changes: result.affectedRows } },
    })
    await conn.commit()
    return result
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    activeConfig = null
  }
}

function getActiveConfig() {
  return activeConfig
}

module.exports = { initPool, getPool, query, get, all, run, exec, transaction, closePool, getActiveConfig }
