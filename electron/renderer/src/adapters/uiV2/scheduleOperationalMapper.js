import {
  enumerateDates,
  formatZhShortDate,
  groupBy,
  normalizeDate,
  paginateRows,
  safeIncludes,
} from './viewModelUtils.js'

function overlaps(slot = {}, date) {
  const start = normalizeDate(slot.startDate || slot.start_date || slot.date)
  const end = normalizeDate(slot.endDate || slot.end_date || slot.date)
  return Boolean(date && start && end && start <= date && end >= date)
}

function normalizeSlot(slot = {}) {
  return {
    ...slot,
    date: normalizeDate(slot.date || slot.startDate || slot.start_date),
    deviceId: String(slot.deviceId || slot.unitId || slot.unit_id || ''),
    assetNo: slot.assetNo || slot.unitCode || slot.unit_code || slot.deviceId || '未编号',
    model: slot.model || slot.modelCode || slot.model_code || '未填写型号',
    status: slot.status || '可租',
    label: slot.label || slot.orderId || slot.orderNo || slot.blockType || '暂无记录',
    orderId: slot.orderId || slot.orderNo || '暂无记录',
  }
}

function resolveDeviceStatus(device = {}, slots = [], date = '') {
  if (['维修', '维修中', '停用', '异常'].includes(device.status)) return device.status === '停用' ? '停用' : '维修'
  const matches = slots.filter((slot) => {
    const normalized = normalizeSlot(slot)
    return String(normalized.deviceId) === String(device.id || device.rawId || device.assetNo) && overlaps(normalized, date)
  })
  if (matches.length > 1) return '冲突'
  if (matches.length === 1) return '占用'
  return '可租'
}

export function buildScheduleDates(dates = [], daysLimit = 7) {
  const normalized = (dates || []).map(normalizeDate).filter(Boolean)
  return normalized.length ? normalized.slice(0, daysLimit) : enumerateDates(daysLimit)
}

export function buildScheduleModelAvailability({ devices = [], schedule = [], dates = [] } = {}) {
  const targetDates = buildScheduleDates(dates)
  const groups = groupBy(devices, (device) => device.model || '未填写型号')
  return Array.from(groups.entries()).map(([model, units]) => {
    const dayCells = targetDates.map((date) => {
      const statuses = units.map((device) => resolveDeviceStatus(device, schedule, date))
      const occupied = statuses.filter((status) => ['占用', '维修', '停用'].includes(status)).length
      const conflict = statuses.filter((status) => status === '冲突').length
      const unavailable = statuses.filter((status) => ['维修', '停用'].includes(status)).length
      const available = Math.max(0, units.length - occupied - conflict)
      const ratio = units.length ? Math.round((available / units.length) * 100) : 0
      return {
        date,
        label: formatZhShortDate(date),
        total: units.length,
        occupied,
        conflict,
        unavailable,
        available,
        ratio,
        status: conflict > 0 ? '冲突' : ratio === 0 ? '满租' : ratio <= 30 ? '紧张' : '可安排',
        summary: `总 ${units.length} / 可用 ${available} / 占用 ${occupied} / 冲突 ${conflict}`,
      }
    })
    return {
      id: `SCHEDULE-MODEL-${model}`,
      model,
      total: units.length,
      dates: dayCells,
      risk: dayCells.some((cell) => cell.conflict > 0)
        ? '存在冲突'
        : dayCells.some((cell) => cell.ratio <= 30)
          ? '余量紧张'
          : '余量正常',
    }
  }).sort((left, right) => right.total - left.total)
}

export function buildScheduleUnitRows({ devices = [], schedule = [], dates = [] } = {}) {
  const targetDates = buildScheduleDates(dates)
  return devices.map((device) => {
    const cells = targetDates.map((date) => {
      const slot = schedule
        .map(normalizeSlot)
        .find((item) => String(item.deviceId) === String(device.id || device.rawId || device.assetNo) && item.date === date)
      const status = slot?.status || resolveDeviceStatus(device, schedule, date)
      return {
        id: `${device.id}-${date}`,
        date,
        label: slot?.label || status,
        status,
        orderId: slot?.orderId || '暂无记录',
        rawSlot: slot || null,
      }
    })
    return {
      id: device.id,
      assetNo: device.assetNo || device.id || '未编号',
      model: device.model || '未填写型号',
      location: device.location || '未分配门店',
      status: device.status || '可租',
      cells,
    }
  })
}

export function filterScheduleModels(rows = [], filters = {}) {
  return rows.filter((row) => {
    const matchModel = !filters.model || filters.model === '全部型号' || row.model === filters.model
    const matchKeyword = safeIncludes(`${row.model}${row.risk}${row.dates.map((cell) => cell.summary).join('')}`, filters.keyword)
    const matchStatus = !filters.status || filters.status === '全部' || filters.status === '全部型号' || (
      filters.status === '可安排' ? row.dates.some((cell) => cell.status === '可安排')
        : filters.status === '满租' ? row.dates.some((cell) => cell.status === '满租')
          : filters.status === '余量不足' ? row.dates.some((cell) => ['紧张', '满租', '冲突'].includes(cell.status))
            : true
    )
    return matchModel && matchKeyword && matchStatus
  })
}

export function filterScheduleUnits(rows = [], filters = {}) {
  return rows.filter((row) => {
    const matchModel = !filters.model || filters.model === '全部型号' || row.model === filters.model
    const matchKeyword = safeIncludes(`${row.assetNo}${row.model}${row.location}${row.cells.map((cell) => cell.label).join('')}`, filters.keyword)
    const matchStatus = !filters.status || filters.status === '全部' || filters.status === '全部型号' || row.cells.some((cell) => cell.status === filters.status)
    return matchModel && matchKeyword && matchStatus
  })
}

export function paginateScheduleRows(rows = [], page = 1, pageSize = 20) {
  return paginateRows(rows, page, pageSize)
}

export function slotClass(status) {
  if (status === '可安排' || status === '可租') return 'slot-ok'
  if (status === '紧张') return 'slot-mid'
  if (status === '满租' || status === '占用') return 'slot-full'
  if (status === '冲突') return 'slot-low'
  return 'slot-off'
}
