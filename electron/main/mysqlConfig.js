const fs = require('fs')
const path = require('path')

const DEFAULT_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'xianyu_agent',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: '+08:00',
}

function readJsonIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return {}
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    throw new Error(`MySQL config file invalid: ${filePath}: ${err.message}`)
  }
}

function candidateConfigPaths() {
  const candidates = []
  if (process.env.XIANYU_MYSQL_CONFIG) candidates.push(process.env.XIANYU_MYSQL_CONFIG)
  candidates.push(path.resolve(process.cwd(), 'mysql-connection.json'))
  candidates.push(path.resolve(process.cwd(), '..', 'mysql-connection.json'))
  candidates.push(path.resolve(__dirname, '..', '..', 'mysql-connection.json'))
  candidates.push(path.resolve(__dirname, '..', '..', '..', 'mysql-connection.json'))
  return Array.from(new Set(candidates))
}

function loadFileConfig() {
  for (const filePath of candidateConfigPaths()) {
    if (fs.existsSync(filePath)) return readJsonIfExists(filePath)
  }
  return {}
}

function loadEnvConfig() {
  const env = process.env
  const config = {}
  if (env.XIANYU_MYSQL_HOST) config.host = env.XIANYU_MYSQL_HOST
  if (env.XIANYU_MYSQL_PORT) config.port = Number(env.XIANYU_MYSQL_PORT)
  if (env.XIANYU_MYSQL_USER) config.user = env.XIANYU_MYSQL_USER
  if (env.XIANYU_MYSQL_PASSWORD !== undefined) config.password = env.XIANYU_MYSQL_PASSWORD
  if (env.XIANYU_MYSQL_DATABASE) config.database = env.XIANYU_MYSQL_DATABASE
  if (env.XIANYU_MYSQL_CHARSET) config.charset = env.XIANYU_MYSQL_CHARSET
  if (env.XIANYU_MYSQL_TIMEZONE) config.timezone = env.XIANYU_MYSQL_TIMEZONE
  return config
}

function normalizeConfig(config) {
  const next = { ...config }
  delete next.socketPath
  delete next.unix_socket
  next.port = Number(next.port || DEFAULT_CONFIG.port)
  next.connectionLimit = Number(next.connectionLimit || DEFAULT_CONFIG.connectionLimit)
  return next
}

function loadMysqlConfig(overrides = {}) {
  return normalizeConfig({
    ...DEFAULT_CONFIG,
    ...loadFileConfig(),
    ...loadEnvConfig(),
    ...overrides,
  })
}

function describeMysqlConfig(config) {
  const endpoint = config.socketPath || `${config.host}:${config.port}`
  return `${config.user}@${endpoint}/${config.database}`
}

module.exports = { DEFAULT_CONFIG, loadMysqlConfig, describeMysqlConfig }
