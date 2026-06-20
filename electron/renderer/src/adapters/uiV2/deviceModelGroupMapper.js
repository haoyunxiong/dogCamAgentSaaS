import {
  formatCurrency,
  formatZhShortDate,
  groupBy,
  normalizeDate,
  paginateRows,
  safeIncludes,
} from './viewModelUtils.js'

const STATUS_BUCKETS = {
  可租: 'free',
  空闲: 'free',
  在租: 'rented',
  占用: 'rented',
  已预订: 'reserved',
  待清洁: 'reserved',
  维修: 'repair',
  维修中: 'repair',
  异常: 'repair',
  停用: 'offline',
}

function statusBucket(device = {}) {
  return STATUS_BUCKETS[device.status] || 'unknown'
}

export function decorateDeviceUnit(device = {}) {
  const residualValue = device.raw?.residual_value ?? device.raw?.residualValue ?? device.residualValue
  return {
    ...device,
    assetNo: device.assetNo || device.id || '未编号',
    model: device.model || '未填写型号',
    serialNo: device.serialNo || '暂无记录',
    location: device.location || '未分配门店',
    currentOrderId: device.currentOrderId || '暂无记录',
    nextBookingDate: device.nextBookingDate ? formatZhShortDate(device.nextBookingDate, '暂无预约') : '暂无预约',
    lastCheckedAt: device.lastCheckedAt ? formatZhShortDate(device.lastCheckedAt, '暂无记录') : '暂无记录',
    residualValueLabel: residualValue === null || residualValue === undefined || residualValue === '' ? '无法判断' : formatCurrency(residualValue),
    purchaseCostLabel: device.purchaseCost === null || device.purchaseCost === undefined || device.purchaseCost === '' ? '无法判断' : formatCurrency(device.purchaseCost),
    noteLabel: device.conditionNote || '暂无记录',
  }
}

export function buildDeviceModelGroups(devices = [], { orders = [] } = {}) {
  const groups = groupBy(devices.map(decorateDeviceUnit), (device) => device.model || '未填写型号')
  return Array.from(groups.entries()).map(([model, units], index) => {
    const count = (bucket) => units.filter((unit) => statusBucket(unit) === bucket).length
    const orderRows = orders.filter((order) => order.model === model || order.deviceSummary?.includes(model))
    const revenue30d = orderRows.length
      ? orderRows.reduce((sum, order) => sum + Number(order.rentAmount || order.totalAmount || 0), 0)
      : null
    const free = count('free')
    const rented = count('rented')
    const reserved = count('reserved')
    const repair = count('repair')
    const offline = count('offline')
    const availableDates = units
      .map((unit) => normalizeDate(unit.nextBookingDate))
      .filter(Boolean)
      .sort()
    const utilization = units.length ? Math.round(((rented + reserved) / units.length) * 100) : 0

    return {
      id: `MODEL-${index + 1}-${model}`,
      model,
      total: units.length,
      free,
      rented,
      reserved,
      repair,
      offline,
      recentlyAvailableAt: free > 0 ? '今天可租' : (availableDates[0] ? formatZhShortDate(availableDates[0]) : '无法判断'),
      utilization30d: units.length ? `${utilization}%` : '无法判断',
      revenue30dLabel: revenue30d === null ? '无法判断' : formatCurrency(revenue30d, '¥0'),
      riskLabel: repair || offline ? '有不可租设备' : free ? '库存可用' : '余量紧张',
      units,
    }
  }).sort((left, right) => right.total - left.total)
}

export function filterDeviceModelGroups(groups = [], filters = {}) {
  return groups.filter((group) => {
    const matchModel = !filters.model || filters.model === '全部型号' || group.model === filters.model
    const matchKeyword = safeIncludes(`${group.model}${group.riskLabel}${group.units.map((unit) => `${unit.assetNo}${unit.serialNo}`).join('')}`, filters.keyword)
    const matchStatus = !filters.status || filters.status === '全部状态' || filters.status === '全部' || (
      filters.status === '可租' ? group.free > 0
        : filters.status === '在租' ? group.rented > 0
          : filters.status === '维修中' ? group.repair > 0
            : filters.status === '停用' ? group.offline > 0
              : true
    )
    return matchModel && matchKeyword && matchStatus
  })
}

export function filterDeviceUnits(devices = [], filters = {}) {
  return devices.map(decorateDeviceUnit).filter((device) => {
    const matchModel = !filters.model || filters.model === '全部型号' || device.model === filters.model
    const matchLocation = !filters.location || filters.location === '全部门店' || device.location === filters.location
    const matchStatus = !filters.status || filters.status === '全部状态' || filters.status === '全部' || device.status === filters.status
    const matchKeyword = safeIncludes(`${device.assetNo}${device.model}${device.serialNo}${device.location}${device.noteLabel}`, filters.keyword)
    return matchModel && matchLocation && matchStatus && matchKeyword
  })
}

export function paginateDeviceRows(rows = [], page = 1, pageSize = 20) {
  return paginateRows(rows, page, pageSize)
}

export function buildDeviceGroupMetrics(groups = []) {
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const free = groups.reduce((sum, group) => sum + group.free, 0)
  const rented = groups.reduce((sum, group) => sum + group.rented, 0)
  const reserved = groups.reduce((sum, group) => sum + group.reserved, 0)
  const repair = groups.reduce((sum, group) => sum + group.repair, 0)
  const offline = groups.reduce((sum, group) => sum + group.offline, 0)
  return [
    { key: 'models', label: '型号数', value: groups.length, unit: '类', trend: '型号分组视图', tone: 'info' },
    { key: 'total', label: '总设备', value: total, unit: '台', trend: '真实单机资产', tone: 'info' },
    { key: 'free', label: '可租', value: free, unit: '台', trend: '可立即分配', tone: 'success' },
    { key: 'rented', label: '在租/占用', value: rented + reserved, unit: '台', trend: `在租 ${rented} / 预订 ${reserved}`, tone: 'warning' },
    { key: 'repair', label: '维修', value: repair, unit: '台', trend: '不可分配', tone: 'warning' },
    { key: 'offline', label: '停用', value: offline, unit: '台', trend: '退出可租池', tone: 'danger' },
  ]
}
