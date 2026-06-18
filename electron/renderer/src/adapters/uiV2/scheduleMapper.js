const STATUS_LABELS = {
  repair: '维修',
  offline: '维修',
}

const BLOCK_LABELS = {
  shipping: '发货',
  rent: '已占用',
  buffer: '缓冲',
  return_shipping: '回程',
}

function pick(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function normalizeDate(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 10)
}

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value)
}

function extractRows(payload, keys = []) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.list)) return payload.list
  return []
}

function enumerateDates(count = 14) {
  const base = new Date()
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(base)
    next.setDate(base.getDate() + index)
    return next.toISOString().slice(0, 10)
  })
}

function overlapsDate(block = {}, date) {
  const start = normalizeDate(pick(block, ['start_date', 'startDate']))
  const end = normalizeDate(pick(block, ['end_date', 'endDate']))
  return Boolean(date && start && end && start <= date && end >= date)
}

function blockOrderLabel(block = {}) {
  return pick(block, ['order_no', 'orderNo', 'customer_name', 'customerName'], '')
}

function resolveCellStatus(cell = {}, unit = {}, blocks = []) {
  const rawStatus = String(pick(unit, ['raw_status', 'rawStatus', 'status'], '')).trim()
  if (STATUS_LABELS[rawStatus]) return STATUS_LABELS[rawStatus]
  if (blocks.length > 1) return '冲突'
  if (cell.blockType || cell.block_type || cell.orderId || cell.order_id || blocks.length) return '占用'
  return '可租'
}

function resolveCellLabel(status, cell = {}, blocks = []) {
  if (status === '可租') return '可租'
  if (status === '维修') return '维修'
  const block = blocks[0] || {}
  const blockType = pick(cell, ['blockType', 'block_type'], pick(block, ['block_type', 'blockType'], ''))
  return pick(cell, ['label'], blockOrderLabel(block) || BLOCK_LABELS[blockType] || status)
}

function mapUnitCell(row = {}, cell = {}, blocks = []) {
  const date = normalizeDate(pick(cell, ['date']))
  const unitId = normalizeId(pick(row, ['unitId', 'unit_id', 'id']))
  const assetNo = pick(row, ['unitCode', 'unit_code', 'assetNo', 'asset_no'], unitId ? `UNIT-${unitId}` : '未编号')
  const model = pick(row, ['modelCode', 'model_code', 'model'], '未填写型号')
  const status = resolveCellStatus(cell, row, blocks)
  const label = resolveCellLabel(status, cell, blocks)
  const orderId = pick(cell, ['orderId', 'order_id'], blockOrderLabel(blocks[0]) || pick(blocks[0], ['order_id', 'orderId'], ''))

  return {
    id: `${unitId || assetNo}-${date}`,
    deviceId: unitId || assetNo,
    assetNo,
    model,
    date,
    status,
    orderId: normalizeId(orderId),
    label,
    conflictType: status === '冲突' ? '存在多个占用记录，请在 legacy 档期页复核。' : '',
  }
}

function findOverlappingBlocks(blocks = [], unitId, date) {
  const key = normalizeId(unitId)
  return blocks.filter((block) => normalizeId(pick(block, ['unit_id', 'unitId'])) === key && overlapsDate(block, date))
}

export function extractRealScheduleBlocks(payload) {
  return extractRows(payload, ['blocks'])
}

export function extractRealScheduleUnits(payload) {
  return extractRows(payload, ['units', 'devices'])
}

export function extractRealScheduleOverview(payload) {
  if (payload && typeof payload === 'object') return payload
  return {}
}

export function mapRealScheduleDates(overview = {}, daysLimit = 14) {
  const days = extractRows(overview?.days, ['days'])
    .map((day) => normalizeDate(typeof day === 'string' ? day : day?.date))
    .filter(Boolean)
  const sourceDays = days.length ? days : enumerateDates(daysLimit)
  const today = new Date().toISOString().slice(0, 10)
  const startIndex = sourceDays.findIndex((date) => date >= today)
  const offset = startIndex >= 0 ? startIndex : 0
  return sourceDays.slice(offset, offset + daysLimit)
}

export function mapRealSchedule({ overview = {}, blocks = [], units = [], daysLimit = 14 } = {}) {
  const normalizedOverview = extractRealScheduleOverview(overview)
  const normalizedBlocks = extractRealScheduleBlocks(blocks)
  const normalizedUnits = extractRealScheduleUnits(units)
  const dates = mapRealScheduleDates(normalizedOverview, daysLimit)
  const groups = extractRows(normalizedOverview?.groups, ['groups'])
  const schedule = []

  for (const group of groups) {
    const rows = extractRows(group?.rows, ['rows'])
    for (const row of rows) {
      const cellsByDate = new Map(extractRows(row?.cells, ['cells']).map((cell) => [normalizeDate(cell?.date), cell]))
      for (const date of dates) {
        const cell = cellsByDate.get(date) || { date }
        const blocksForCell = findOverlappingBlocks(normalizedBlocks, pick(row, ['unitId', 'unit_id', 'id']), date)
        schedule.push(mapUnitCell({ modelCode: group.modelCode || group.model_code, ...row }, cell, blocksForCell))
      }
    }
  }

  if (!schedule.length && normalizedUnits.length) {
    for (const unit of normalizedUnits) {
      for (const date of dates) {
        const blocksForCell = findOverlappingBlocks(normalizedBlocks, pick(unit, ['id', 'unitId', 'unit_id']), date)
        schedule.push(mapUnitCell(unit, { date }, blocksForCell))
      }
    }
  }

  return {
    dates,
    schedule,
  }
}
