#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { loadMysqlConfig } = require('../electron/main/mysqlConfig')

function pad2(value) {
  return String(value).padStart(2, '0')
}

function stamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    '-',
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join('')
}

function resolveDumpBin() {
  if (process.env.XIANYU_MYSQLDUMP_BIN) return process.env.XIANYU_MYSQLDUMP_BIN

  const candidates = [
    path.resolve(process.cwd(), '../.tools/mysql/mysql-8.4.9-macos15-arm64/bin/mysqldump'),
    path.resolve(__dirname, '../../.tools/mysql/mysql-8.4.9-macos15-arm64/bin/mysqldump'),
    'mysqldump',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return 'mysqldump'
}

function main() {
  const config = loadMysqlConfig()
  const backupDir = path.resolve(process.cwd(), 'data/db-backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const outputPath = path.join(backupDir, `mysql-dump-${stamp()}.sql`)
  const dumpBin = resolveDumpBin()

  const args = [
    '--default-character-set=utf8mb4',
    '--single-transaction',
    '--skip-lock-tables',
    '--routines',
    '--triggers',
    '--events',
    '--databases',
    config.database,
  ]

  if (config.socketPath) {
    args.unshift(`--socket=${config.socketPath}`)
  } else {
    args.unshift(`--port=${Number(config.port || 3306)}`)
    args.unshift(`--host=${config.host || '127.0.0.1'}`)
  }
  args.unshift(`--user=${config.user || 'root'}`)

  const env = {
    ...process.env,
    MYSQL_PWD: config.password || '',
  }

  const result = spawnSync(dumpBin, args, {
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `mysqldump exited with status ${result.status}`)
  }

  fs.writeFileSync(outputPath, result.stdout, 'utf8')
  process.stdout.write(`${outputPath}\n`)
}

try {
  main()
} catch (error) {
  console.error(`[backup_mysql] ${error.message}`)
  process.exit(1)
}
