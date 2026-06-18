import { mapRealCustomers } from './customersMapper.js'

const SOURCE_CHANNEL_LABELS = {
  xianyu: '闲鱼',
  wechat: '私域',
  private: '私域',
  xiaohongshu: '小红书',
  douyin: '抖音',
  manual: '手工',
  other: '其他',
}

const STATUS_LABELS = {
  waiting_payment: '待押金',
  paid: '待发货',
  shipping: '待发货',
  active: '租赁中',
  completed: '已完成',
  cancelled: '已取消',
  overdue: '异常',
  exception: '异常',
  abnormal: '异常',
}

const DEVICE_STATUS_LABELS = {
  idle: '可租',
  busy: '在租',
  repair: '维修中',
  offline: '停用',
}

function pick(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function extractRows(payload, keys = []) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function toNumber(value) {
  const next = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(next) ? next : 0
}

function toDate(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 10)
}

function parseDate(value) {
  const normalized = toDate(value)
  const date = normalized ? new Date(`${normalized}T00:00:00`) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function formatDay(date) {
  return date.toISOString().slice(5, 10)
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function formatCurrency(value) {
  return Math.round(toNumber(value)).toLocaleString()
}

function normalizeStatus(row = {}) {
  const status = String(pick(row, ['status', 'order_status', 'orderStatus'], '')).trim()
  return STATUS_LABELS[status] || status || '待确认'
}

function normalizeDeviceStatus(row = {}) {
  const status = String(pick(row, ['status', 'effective_status', 'raw_status', 'rawStatus'], '')).trim()
  return DEVICE_STATUS_LABELS[status] || status || '可租'
}

function orderDate(row = {}) {
  return toDate(pick(row, ['created_at', 'createdAt', 'rent_start_date', 'rentStartDate', 'rentStart']))
}

function orderAmount(row = {}) {
  return toNumber(pick(row, ['fee', 'rent_amount', 'rentAmount', 'amount']))
}

function orderModel(row = {}) {
  return String(pick(row, ['model_code', 'modelCode', 'model', 'unit_code', 'unitCode'], '未填写型号'))
}

function orderSource(row = {}) {
  const source = String(pick(row, ['source_channel', 'sourceChannel', 'channel'], 'manual'))
  return SOURCE_CHANNEL_LABELS[source] || source || '手工'
}

function orderStore(row = {}) {
  return String(pick(row, ['store_name', 'storeName', 'store_code', 'storeCode'], '未分配门店'))
}

function orderRentDays(row = {}) {
  const start = parseDate(pick(row, ['rent_start_date', 'rentStartDate', 'rentStart']))
  const end = parseDate(pick(row, ['rent_end_date', 'rentEndDate', 'rentEnd']))
  if (!start || !end) return 0
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
}

function depositStatus(row = {}) {
  if (Number(pick(row, ['is_deposit_free', 'isDepositFree'], 0)) === 1) return '免押通过'
  return String(pick(row, ['depositStatus', 'deposit_status', 'statusLabel', 'status_label', 'status'], '押金正常'))
}

function groupRows(rows = [], resolver, valueResolver = () => 1) {
  const map = new Map()
  rows.forEach((row) => {
    const key = resolver(row)
    if (!key) return
    map.set(key, (map.get(key) || 0) + valueResolver(row))
  })
  return Array.from(map.entries()).sort((left, right) => right[1] - left[1])
}

function latestDateFromOrders(orders = []) {
  const dates = orders.map((order) => parseDate(orderDate(order))).filter(Boolean)
  if (!dates.length) return new Date()
  return new Date(Math.max(...dates.map((date) => date.getTime())))
}

function lastDays(endDate, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(endDate)
    next.setDate(endDate.getDate() - (count - 1 - index))
    return next
  })
}

function trendRows(orders = [], endDate = latestDateFromOrders(orders)) {
  return lastDays(endDate, 7).map((date) => {
    const day = formatDate(date)
    const amount = orders
      .filter((order) => orderDate(order) === day)
      .reduce((sum, order) => sum + orderAmount(order), 0)
    return {
      label: formatDay(date),
      value: Math.round(amount),
      valueLabel: amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : String(Math.round(amount)),
    }
  })
}

function currentMonthFromEndDate(endDate) {
  return endDate.toISOString().slice(0, 7)
}

function durationBucket(days) {
  if (days <= 0) return '未填写'
  if (days <= 3) return '1-3天'
  if (days <= 7) return '4-7天'
  if (days <= 15) return '8-15天'
  if (days <= 30) return '16-30天'
  return '30天以上'
}

function percentRows(entries = [], total = 0) {
  return entries.map(([label, value]) => ({
    label,
    value,
    valueLabel: total ? `${Math.round((value / total) * 100)}%` : '0%',
  }))
}

function normalizeSources({ orders = [], devices = [], scheduleBlocks = [], inquiries = [], deposits = [] } = {}) {
  const normalizedOrders = extractRows(orders, ['orders'])
  const normalizedDevices = extractRows(devices, ['units', 'devices'])
  const normalizedBlocks = extractRows(scheduleBlocks, ['blocks'])
  const normalizedInquiries = extractRows(inquiries, ['events', 'inquiries'])
  const normalizedDeposits = extractRows(deposits, ['orders', 'depositOrders'])
  const customers = mapRealCustomers({
    orders: normalizedOrders,
    inquiries: normalizedInquiries,
    deposits: normalizedDeposits,
  })

  return {
    orders: normalizedOrders,
    devices: normalizedDevices,
    scheduleBlocks: normalizedBlocks,
    inquiries: normalizedInquiries,
    deposits: normalizedDeposits,
    customers,
  }
}

function modelRanking(orders = [], devices = [], scheduleBlocks = []) {
  const revenueByModel = groupRows(orders, orderModel, orderAmount)
  const ordersByModel = new Map(groupRows(orders, orderModel))
  const devicesByModel = new Map(groupRows(devices, (device) => String(pick(device, ['model_code', 'modelCode', 'model'], '未填写型号'))))
  const occupiedByModel = new Map(groupRows(scheduleBlocks, (block) => String(pick(block, ['model_code', 'modelCode', 'model'], '未填写型号'))))

  return revenueByModel.slice(0, 5).map(([model, revenue], index) => {
    const orderCount = ordersByModel.get(model) || 0
    const deviceCount = devicesByModel.get(model) || 0
    const occupiedCount = occupiedByModel.get(model) || 0
    const utilization = deviceCount ? Math.min(100, Math.round((occupiedCount / Math.max(deviceCount, 1)) * 100)) : 0
    return {
      rank: index + 1,
      model,
      orders: orderCount,
      revenue: formatCurrency(revenue),
      utilization: `${utilization}%`,
      signal: orderCount >= 3 ? '订单集中，优先保障库存' : orderCount > 0 ? '保持可租池' : '暂无明显信号',
    }
  })
}

export function mapRealReport(sources = {}) {
  const normalized = normalizeSources(sources)
  const endDate = latestDateFromOrders(normalized.orders)
  const month = currentMonthFromEndDate(endDate)
  const lastSevenDates = new Set(lastDays(endDate, 7).map(formatDate))
  const totalAmount = normalized.orders.reduce((sum, order) => sum + orderAmount(order), 0)
  const monthOrders = normalized.orders.filter((order) => orderDate(order).startsWith(month))
  const lastSevenOrders = normalized.orders.filter((order) => lastSevenDates.has(orderDate(order)))
  const busyDevices = normalized.devices.filter((device) => ['在租', '已预订', '占用'].includes(normalizeDeviceStatus(device))).length
  const utilization = normalized.devices.length ? Math.round((busyDevices / normalized.devices.length) * 100) : 0
  const exceptionCount = normalized.orders.filter((order) => normalizeStatus(order) === '异常').length
  const exceptionRate = normalized.orders.length ? Number(((exceptionCount / normalized.orders.length) * 100).toFixed(1)) : 0
  const channelEntries = groupRows(normalized.orders, orderSource).slice(0, 6)
  const durationEntries = groupRows(normalized.orders, (order) => durationBucket(orderRentDays(order)))
  const depositRows = normalized.deposits.length
    ? normalized.deposits
    : normalized.orders
  const depositEntries = groupRows(depositRows, depositStatus)
  const storeEntries = groupRows(normalized.orders, orderStore, orderAmount).slice(0, 5)
  const maxStoreAmount = Math.max(...storeEntries.map((entry) => entry[1]), 1)

  return {
    kpis: [
      { key: 'revenue', label: '订单金额', value: formatCurrency(totalAmount), unit: '元', trend: '基础只读汇总', tone: 'success' },
      { key: 'orders', label: '本月订单', value: monthOrders.length, unit: '单', trend: month, tone: 'info' },
      { key: 'sevenDays', label: '近7日订单', value: lastSevenOrders.length, unit: '单', trend: '按订单日期', tone: 'info' },
      { key: 'utilization', label: '设备利用率', value: utilization, unit: '%', trend: '设备状态估算', tone: 'success' },
      { key: 'customers', label: '客户数', value: normalized.customers.length, unit: '位', trend: '派生只读', tone: 'info' },
      { key: 'exception', label: '异常率', value: exceptionRate, unit: '%', trend: `${exceptionCount} 单需复核`, tone: exceptionCount ? 'warning' : 'success' },
    ],
    revenueTrend: trendRows(normalized.orders, endDate),
    channelTrend: channelEntries.map(([label, value]) => ({ label, value, valueLabel: `${value}单` })),
    depositTrend: depositEntries.map(([label, value]) => ({ label, value, valueLabel: `${value}单` })),
    durationRows: percentRows(durationEntries, normalized.orders.length),
    storeRanking: storeEntries.map(([name, value]) => ({
      name,
      value: formatCurrency(value),
      percent: Math.max(Math.round((value / maxStoreAmount) * 100), 6),
    })),
    modelRanking: modelRanking(normalized.orders, normalized.devices, normalized.scheduleBlocks),
    insights: [
      {
        title: normalized.orders.length ? '订单金额已接入基础只读汇总' : '暂无真实订单数据',
        desc: normalized.orders.length ? '当前报表只统计订单金额和订单数，不包含利润、税务、对账或复杂财务口径。' : '真实订单为空时保留空态，不使用 mock 数据伪装真实结果。',
      },
      {
        title: normalized.devices.length ? '设备利用率来自设备状态估算' : '暂无设备状态数据',
        desc: '利用率为基础运营指标，仅用于 MVP 观察，不作为财务或资产 ROI 结论。',
      },
      {
        title: normalized.deposits.length ? '免押状态来自本地缓存' : '免押状态按订单押金字段降级',
        desc: '本轮不调用远程免押查询，不执行免押审核，也不写入状态。',
      },
    ],
  }
}
