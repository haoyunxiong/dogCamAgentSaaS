#!/usr/bin/env node
const path = require('path')
const XLSX = require('xlsx')
const mysql = require('mysql2/promise')
const { loadMysqlConfig } = require('../main/mysqlConfig')

const DEFAULT_XLSX = path.join(__dirname, '../../data/imports/档期表-export.xlsx')
const TODAY = '2026-05-20'

const DB_CONFIG = loadMysqlConfig()

const CURRENT_INVENTORY_COUNTS = {
  '大疆POCKET3': 7,
  '大疆POCKET4': 6,
  acepro2: 7,
  IXUS210: 4,
  IXUS130: 16,
  IXUS300: 3,
  IXUS220: 1,
  IXUS115: 1,
  IXUS95: 1,
  '佳能740': 1,
  g7x2: 5,
  R50: 2,
  g12: 11,
  gr3x: 7,
  '神牛闪光灯': 5,
  x100vi: 1,
  '苹果7p': 1,
  w2s: 1,
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function dateText(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function parseSheetMonth(sheetName) {
  const matched = String(sheetName).match(/^(\d{4})\.(\d{1,2})$/)
  if (!matched) return null
  return { year: Number(matched[1]), month: Number(matched[2]) }
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUnitLabel(value) {
  return normalizeText(value)
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, '')
}

function numericRevenue(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function suffixNumber(value, fallback = '01') {
  const text = String(value || fallback)
  const n = Number.parseInt(text, 10)
  return pad2(Number.isFinite(n) ? n : Number.parseInt(fallback, 10))
}

function mapUnit(label, existingByModelSuffix) {
  const code = normalizeUnitLabel(label)
  if (!code) return null

  const exactRules = [
    [/^POCKET4-?(\d+)$/i, (m) => ({ modelCode: '大疆POCKET4', suffix: suffixNumber(m[1]) })],
    [/^POCKET3-?(\d+)$/i, (m) => ({ modelCode: '大疆POCKET3', suffix: suffixNumber(m[1]) })],
    [/^POCKET-?(\d+)(?:-xzy)?$/i, (m) => ({ modelCode: '大疆POCKET3', suffix: suffixNumber(m[1]) })],
    [/^acepro2-?(\d+)(?:-妈)?$/i, (m) => ({ modelCode: 'acepro2', suffix: suffixNumber(m[1]) })],
    [/^(?:iuxs|ixus)-?210-?(\d+)$/i, (m) => ({ modelCode: 'IXUS210', suffix: suffixNumber(m[1]) })],
    [/^(?:iuxs|ixus)-?130-?(\d+)(?:-zxy)?$/i, (m) => ({ modelCode: 'IXUS130', suffix: suffixNumber(m[1]) })],
    [/^(?:iuxs|ixus)-?115-?(\d+)$/i, (m) => ({ modelCode: 'IXUS115', suffix: suffixNumber(m[1]) })],
    [/^(?:iuxs|ixus)-?105-?(\d+)$/i, (m) => ({ modelCode: 'IXUS105', suffix: suffixNumber(m[1]) })],
    [/^(?:iuxs|ixus)-?220-?(\d+)$/i, (m) => ({ modelCode: 'IXUS220', suffix: suffixNumber(m[1]) })],
    [/^(?:iuxs|ixus)-?95-?(\d+)$/i, (m) => ({ modelCode: 'IXUS95', suffix: suffixNumber(m[1]) })],
    [/^(?:ixsu|ixus)-?300-?(\d+)$/i, (m) => ({ modelCode: 'IXUS300', suffix: suffixNumber(m[1]) })],
    [/^sx740hs-?(\d+)$/i, (m) => ({ modelCode: '佳能740', suffix: suffixNumber(m[1]) })],
    [/^g7x2-?(\d+)$/i, (m) => ({ modelCode: 'g7x2', suffix: suffixNumber(m[1]) })],
    [/^R50(?:-?(\d+))?$/i, (m) => ({ modelCode: 'R50', suffix: suffixNumber(m[1] || '01') })],
    [/^g12-?(\d+)(?:-zxy|-xzy)?$/i, (m) => ({ modelCode: 'g12', suffix: suffixNumber(m[1]) })],
    [/^gr3x(?:-?(\d+))?(?:-zxy|-xzy)?$/i, (m) => ({ modelCode: 'gr3x', suffix: suffixNumber(m[1] || '01') })],
    [/^x100vi(?:-?(\d+))?$/i, (m) => ({ modelCode: 'x100vi', suffix: suffixNumber(m[1] || '01') })],
    [/^7p(?:-?(\d+))?$/i, (m) => ({ modelCode: '苹果7p', suffix: suffixNumber(m[1] || '01') })],
    [/^w2s(?:-?(\d+))?$/i, (m) => ({ modelCode: 'w2s', suffix: suffixNumber(m[1] || '01') })],
    [/^闪光灯(\d+)$/i, (m) => ({ modelCode: '神牛闪光灯', suffix: suffixNumber(m[1]) })],
  ]

  for (const [regex, build] of exactRules) {
    const matched = code.match(regex)
    if (!matched) continue
    const mapped = build(matched)
    const existing = existingByModelSuffix.get(`${mapped.modelCode}::${mapped.suffix}`)
    const currentCount = CURRENT_INVENTORY_COUNTS[mapped.modelCode] || 0
    const isCurrentInventory = currentCount > 0 && Number(mapped.suffix) <= currentCount
    return {
      sourceUnitCode: code,
      modelCode: mapped.modelCode,
      suffix: mapped.suffix,
      unitCode: existing?.unit_code || `${mapped.modelCode}-${mapped.suffix}`,
      unitId: existing?.id || null,
      historicalOnly: !isCurrentInventory,
    }
  }

  return null
}

function extractCustomerName(text) {
  let value = normalizeText(text)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/若有疑问可致电.*$/g, '')
    .replace(/发货|到货|运输|归还|闪送|半日达|自提|送货上门/g, ' ')
    .replace(/维修|换新|置换|丢失|自用|占用/g, ' ')
    .replace(/[()（）:：/\\、,，;；\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (value === '√') return ''
  if (!value) return ''
  return value.slice(0, 80)
}

function classifyCell(text) {
  const value = normalizeText(text)
  if (!value) return null
  const hasShip = /(发货|运输|闪送|半日达|到货)/.test(value)
  const hasReturn = /归还/.test(value)
  const hasUnavailable = /(维修|换新|置换|丢失|自用)/.test(value)
  const customerName = extractCustomerName(value)
  if (hasShip && !hasReturn) return { blockType: 'shipping', customerName, raw: value }
  if (hasReturn) return { blockType: 'return_shipping', customerName, raw: value }
  return { blockType: 'rent', customerName: customerName || (hasUnavailable ? value : ''), raw: value }
}

function shouldSkipRow(label, row, revenueCol, dayCols) {
  const code = normalizeUnitLabel(label)
  if (!code) return true
  if (/^(当前数据情况|合计|总计|总收益|型号|设备|收益|备注)/.test(code)) return true
  const hasDayData = dayCols.some((col) => Boolean(normalizeText(row[col])))
  return !hasDayData && numericRevenue(row[revenueCol]) === 0
}

function buildRowSignature(sheetName, sourceUnitCode, row, revenueCol, dayCols) {
  const dayValues = dayCols.map((index) => normalizeText(row[index]))
  return [
    sheetName,
    normalizeUnitLabel(sourceUnitCode),
    dayValues.join('|'),
    revenueCol >= 0 ? numericRevenue(row[revenueCol]) : 0,
  ].join('::')
}

function findHeaderRowIndex(rows) {
  return rows.findIndex((row) => normalizeUnitLabel(row?.[0]) === '当前数据情况：' || normalizeUnitLabel(row?.[0]) === '当前数据情况')
}

function chooseRunCustomer(days) {
  const counts = new Map()
  for (const day of days) {
    if (!day.customerName) continue
    counts.set(day.customerName, (counts.get(day.customerName) || 0) + 1)
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (best?.[0]) return best[0]
  if (days.some((day) => day.raw.includes('维修'))) return '维修'
  if (days.some((day) => day.raw.includes('换新'))) return '换新'
  if (days.some((day) => day.raw.includes('置换'))) return '置换'
  if (days.some((day) => day.raw.includes('丢失'))) return '丢失'
  if (days.some((day) => day.raw.includes('自用'))) return '自用'
  return '占用'
}

function buildRuns(dayItems) {
  const runs = []
  let current = null
  for (const item of dayItems) {
    if (!item.classified) {
      if (current) runs.push(current)
      current = null
      continue
    }
    const customer = item.classified.customerName
    const differentCustomer = current?.customerName && customer && current.customerName !== customer
    if (!current || differentCustomer) {
      if (current) runs.push(current)
      current = { days: [], customerName: customer || '' }
    }
    current.days.push({ ...item, ...item.classified })
    if (!current.customerName && customer) current.customerName = customer
    if (item.classified.blockType === 'return_shipping') {
      runs.push(current)
      current = null
    }
  }
  if (current) runs.push(current)
  return runs.map((run) => ({ ...run, customerName: chooseRunCustomer(run.days) }))
}

function groupBlocksForRun(run) {
  const groups = []
  let current = null
  let seenRent = false
  for (const day of run.days) {
    const blockType = day.blockType === 'shipping' && seenRent ? 'return_shipping' : day.blockType
    if (!current || current.blockType !== blockType) {
      if (current) groups.push(current)
      current = { blockType, startDate: day.date, endDate: day.date, raws: [day.raw] }
    } else {
      current.endDate = day.date
      current.raws.push(day.raw)
    }
    if (blockType === 'rent') seenRent = true
  }
  if (current) groups.push(current)
  return groups
}

function parseWorkbook(xlsxPath, existingByModelSuffix) {
  const workbook = XLSX.readFile(xlsxPath, { cellDates: true })
  const orders = []
  const rowsSummary = []
  const skippedRows = []
  let dedupedRows = 0

  for (const sheetName of workbook.SheetNames) {
    const monthInfo = parseSheetMonth(sheetName)
    if (!monthInfo) continue
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false, defval: '' })
    const headerRowIndex = findHeaderRowIndex(rows)
    if (headerRowIndex < 0) {
      skippedRows.push({ sheetName, rowIndex: 1, sourceUnitCode: '', reason: '未找到月表表头' })
      continue
    }
    const header = rows[headerRowIndex] || []
    const revenueCol = header.findIndex((value) => normalizeText(value) === '收益')
    const dayCols = header
      .map((value, index) => ({ value: Number.parseInt(String(value), 10), index }))
      .filter((item) => Number.isInteger(item.value) && item.value >= 1 && item.value <= 31)
    const seenRowSignatures = new Set()

    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || []
      const sourceUnitCode = normalizeText(row[0])
      if (shouldSkipRow(sourceUnitCode, row, revenueCol, dayCols.map((item) => item.index))) continue
      const rowSignature = buildRowSignature(sheetName, sourceUnitCode, row, revenueCol, dayCols.map((item) => item.index))
      if (seenRowSignatures.has(rowSignature)) {
        dedupedRows += 1
        continue
      }
      seenRowSignatures.add(rowSignature)
      const mapped = mapUnit(sourceUnitCode, existingByModelSuffix)
      if (!mapped) {
        skippedRows.push({ sheetName, rowIndex: rowIndex + 1, sourceUnitCode, reason: '无法识别设备编号' })
        continue
      }
      const dayItems = dayCols.map(({ value: day, index }) => ({
        day,
        date: dateText(monthInfo.year, monthInfo.month, day),
        rawValue: row[index],
        classified: classifyCell(row[index]),
      }))
      const runs = buildRuns(dayItems).filter((run) => run.days.length)
      const revenue = revenueCol >= 0 ? numericRevenue(row[revenueCol]) : 0
      const totalRunDays = runs.reduce((sum, run) => sum + run.days.length, 0) || 1
      rowsSummary.push({ sheetName, sourceUnitCode, mapped, revenue, runs: runs.length })

      runs.forEach((run, runIndex) => {
        const firstDate = run.days[0].date
        const lastDate = run.days[run.days.length - 1].date
        const fee = Number(((revenue * run.days.length) / totalRunDays).toFixed(2))
        const orderStatus = lastDate < TODAY ? 'completed' : firstDate <= TODAY && lastDate >= TODAY ? 'active' : 'paid'
        orders.push({
          orderNo: `NUMBERS-${sheetName.replace('.', '')}-${mapped.unitCode}-${runIndex + 1}`,
          customerName: run.customerName,
          modelCode: mapped.modelCode,
          unitCode: mapped.unitCode,
          unitId: mapped.unitId,
          sourceUnitCode: mapped.sourceUnitCode,
          historicalOnly: mapped.historicalOnly,
          rentStartDate: firstDate,
          rentEndDate: lastDate,
          fee,
          orderStatus,
          blocks: groupBlocksForRun(run),
        })
      })
    }
  }

  return { orders, rowsSummary, skippedRows, dedupedRows }
}

function buildExistingUnitMaps(units) {
  const existingByModelSuffix = new Map()
  for (const unit of units) {
    const suffixMatched = String(unit.unit_code || '').match(/(\d+)(?!.*\d)/)
    if (!suffixMatched) continue
    existingByModelSuffix.set(`${unit.model_code}::${suffixNumber(suffixMatched[1])}`, unit)
  }
  return existingByModelSuffix
}

async function ensureHistoricalUnits(connection, parsed) {
  const missing = new Map()
  for (const row of parsed.rowsSummary) {
    if (!row.mapped.historicalOnly) continue
    missing.set(`${row.mapped.modelCode}::${row.mapped.unitCode}`, row.mapped)
  }
  for (const unit of missing.values()) {
    await connection.execute(`
      INSERT INTO schedule_units (model_code, unit_code, status, note, city, purchase_cost, updated_at)
      VALUES (?, ?, 'offline', 'Numbers历史档期导入', '成都', 0, NOW())
      ON DUPLICATE KEY UPDATE
        status = 'offline',
        note = VALUES(note),
        updated_at = NOW()
    `, [unit.modelCode, unit.unitCode])
    const [rows] = await connection.execute('SELECT id FROM schedule_units WHERE unit_code = ? LIMIT 1', [unit.unitCode])
    unit.unitId = rows[0]?.id || null
  }
  for (const order of parsed.orders) {
    if (!order.unitId && order.historicalOnly) {
      const [rows] = await connection.execute('SELECT id FROM schedule_units WHERE unit_code = ? LIMIT 1', [order.unitCode])
      order.unitId = rows[0]?.id || null
    }
  }
  return missing.size
}

async function createBackups(connection) {
  const suffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const tables = ['rental_orders', 'schedule_blocks', 'shipping_records', 'schedule_units']
  for (const table of tables) {
    await connection.execute(`CREATE TABLE ${table}_bak_numbers_${suffix} AS SELECT * FROM ${table}`)
  }
  return tables.map((table) => `${table}_bak_numbers_${suffix}`)
}

async function applyImport(connection, parsed) {
  await connection.beginTransaction()
  try {
    const backupTables = await createBackups(connection)
    const historicalUnitCount = await ensureHistoricalUnits(connection, parsed)
    await connection.execute(`
      CREATE TEMPORARY TABLE numbers_import_order_ids AS
      SELECT id FROM rental_orders WHERE order_no LIKE 'NUMBERS-%'
    `)
    await connection.execute('DELETE FROM shipping_records WHERE order_id IN (SELECT id FROM numbers_import_order_ids)')
    await connection.execute('DELETE FROM schedule_blocks WHERE order_id IN (SELECT id FROM numbers_import_order_ids)')
    await connection.execute('DELETE FROM rental_orders WHERE id IN (SELECT id FROM numbers_import_order_ids)')
    await connection.execute('DROP TEMPORARY TABLE numbers_import_order_ids')

    let insertedOrders = 0
    let insertedBlocks = 0
    const [storeRows] = await connection.execute("SELECT id FROM stores WHERE code = 'xiaogou' LIMIT 1")
    const storeId = storeRows[0]?.id || null

    for (const order of parsed.orders) {
      if (!order.unitId) continue
      const [result] = await connection.execute(`
        INSERT INTO rental_orders (
          store_id, order_no, customer_name, model_code, unit_id,
          rent_start_date, rent_end_date, fee, deposit, order_status,
          planned_ship_at, expected_arrive_at, shipping_mode, latest_logistics_status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'land', ?, NOW())
      `, [
        storeId,
        order.orderNo,
        order.customerName,
        order.modelCode,
        order.unitId,
        order.rentStartDate,
        order.rentEndDate,
        order.fee,
        order.orderStatus,
        `${order.rentStartDate}T00:00:00`,
        `${order.rentStartDate}T00:00:00`,
        `Numbers导入：${order.sourceUnitCode}`,
      ])
      insertedOrders += 1
      const orderId = result.insertId
      for (const block of order.blocks) {
        await connection.execute(`
          INSERT INTO schedule_blocks (
            unit_id, order_id, model_code, block_type, start_date, end_date,
            planned_ship_at, expected_arrive_at, status, note, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())
        `, [
          order.unitId,
          orderId,
          order.modelCode,
          block.blockType,
          block.startDate,
          block.endDate,
          `${order.rentStartDate}T00:00:00`,
          `${order.rentStartDate}T00:00:00`,
          block.raws.join(' / ').slice(0, 255),
        ])
        insertedBlocks += 1
      }
    }
    await connection.commit()
    return { backupTables, historicalUnitCount, insertedOrders, insertedBlocks }
  } catch (error) {
    await connection.rollback()
    throw error
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const xlsxPathArg = process.argv.find((arg) => arg.endsWith('.xlsx'))
  const xlsxPath = xlsxPathArg || DEFAULT_XLSX
  const connection = await mysql.createConnection(DB_CONFIG)
  try {
    const [units] = await connection.execute('SELECT id, unit_code, model_code, status FROM schedule_units')
    const parsed = parseWorkbook(xlsxPath, buildExistingUnitMaps(units))
    const mappedCurrentRows = parsed.rowsSummary.filter((row) => !row.mapped.historicalOnly).length
    const historicalRows = parsed.rowsSummary.filter((row) => row.mapped.historicalOnly).length
    const missingOrderCount = parsed.orders.filter((order) => !order.unitId && !order.historicalOnly).length
    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      xlsxPath,
      sourceRows: parsed.rowsSummary.length,
      mappedCurrentRows,
      historicalRows,
      skippedRows: parsed.skippedRows.length,
      dedupedRows: parsed.dedupedRows,
      parsedOrders: parsed.orders.length,
      parsedBlocks: parsed.orders.reduce((sum, order) => sum + order.blocks.length, 0),
      missingOrderCount,
      sampleOrders: parsed.orders.slice(0, 8),
      skippedRowsSample: parsed.skippedRows.slice(0, 20),
    }
    if (apply) {
      summary.applied = await applyImport(connection, parsed)
    }
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
