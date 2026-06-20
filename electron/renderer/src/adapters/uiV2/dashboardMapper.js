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

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function todayText() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeOrderStatus(row = {}) {
  const status = String(pick(row, ['status', 'order_status', 'orderStatus'], '')).trim()
  return STATUS_LABELS[status] || status || '待确认'
}

function normalizeDeviceStatus(row = {}) {
  const status = String(pick(row, ['status', 'effective_status', 'raw_status', 'rawStatus'], '')).trim()
  return DEVICE_STATUS_LABELS[status] || status || '可租'
}

function orderDate(row = {}) {
  return toDate(pick(row, ['created_at', 'createdAt', 'rent_start_date', 'rentStart', 'rentStartDate']))
}

function orderAmount(row = {}) {
  return toNumber(pick(row, ['fee', 'rent_amount', 'rentAmount', 'amount']))
}

function orderNo(row = {}) {
  return String(pick(row, ['order_no', 'orderNo', 'id'], '未编号'))
}

function customerName(row = {}) {
  return String(pick(row, ['customer_name', 'customerName'], '未填写客户'))
}

function orderModel(row = {}) {
  return String(pick(row, ['model_code', 'modelCode', 'model', 'unit_code', 'unitCode'], '未填写型号'))
}

function orderSource(row = {}) {
  const source = String(pick(row, ['source_channel', 'sourceChannel', 'channel'], 'manual'))
  return SOURCE_CHANNEL_LABELS[source] || source || '手工'
}

function isPendingOrder(row = {}) {
  return ['待确认', '待押金', '待分配设备', '待发货', '待归还', '待验机', '异常'].includes(normalizeOrderStatus(row))
}

function isActiveOrder(row = {}) {
  return normalizeOrderStatus(row) === '租赁中'
}

function isRepairDevice(row = {}) {
  return ['维修中', '维修', '异常'].includes(normalizeDeviceStatus(row))
}

function isIdleDevice(row = {}) {
  return ['可租', '空闲'].includes(normalizeDeviceStatus(row))
}

function isBusyDevice(row = {}) {
  return ['在租', '已预订', '占用'].includes(normalizeDeviceStatus(row))
}

function countBy(rows = [], resolver) {
  const counts = new Map()
  for (const row of rows) {
    const key = resolver(row)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
}

function topLabel(rows = [], resolver, fallback = '暂无数据') {
  return countBy(rows, resolver)[0]?.[0] || fallback
}

function normalizeSources({ orders = [], devices = [], scheduleOverview = {}, scheduleBlocks = [], inquiries = [], deposits = [] } = {}) {
  const normalizedOrders = extractRows(orders, ['orders'])
  const normalizedDevices = extractRows(devices, ['units', 'devices'])
  const normalizedBlocks = extractRows(scheduleBlocks, ['blocks'])
  const normalizedInquiries = extractRows(inquiries, ['events', 'inquiries'])
  const normalizedDeposits = extractRows(deposits, ['orders', 'depositOrders'])

  return {
    orders: normalizedOrders,
    devices: normalizedDevices,
    scheduleOverview: scheduleOverview && typeof scheduleOverview === 'object' ? scheduleOverview : {},
    scheduleBlocks: normalizedBlocks,
    inquiries: normalizedInquiries,
    deposits: normalizedDeposits,
    customers: mapRealCustomers({
      orders: normalizedOrders,
      inquiries: normalizedInquiries,
      deposits: normalizedDeposits,
    }),
  }
}

export function mapDashboardMetrics(sources = {}) {
  const normalized = normalizeSources(sources)
  const month = currentMonth()
  const today = todayText()
  const orders = normalized.orders
  const devices = normalized.devices
  const totalAmount = orders.reduce((sum, order) => sum + orderAmount(order), 0)
  const idleDevices = devices.filter(isIdleDevice).length
  const busyDevices = devices.filter(isBusyDevice).length
  const repairDevices = devices.filter(isRepairDevice).length

  return [
    { key: 'todayOrders', label: '今日订单', value: orders.filter((order) => orderDate(order) === today).length, unit: '单', trend: '本地数据库', tone: 'info' },
    { key: 'monthOrders', label: '本月订单', value: orders.filter((order) => orderDate(order).startsWith(month)).length, unit: '单', trend: month, tone: 'info' },
    { key: 'pendingOrders', label: '待处理订单', value: orders.filter(isPendingOrder).length, unit: '单', trend: '只读汇总', tone: 'warning' },
    { key: 'activeOrders', label: '租赁中订单', value: orders.filter(isActiveOrder).length, unit: '单', trend: '履约中', tone: 'success' },
    { key: 'orderAmount', label: '订单金额', value: `¥${Math.round(totalAmount).toLocaleString()}`, unit: '', trend: '基础汇总', tone: 'success' },
    { key: 'devices', label: '设备总数', value: devices.length, unit: '台', trend: `空闲 ${idleDevices} / 占用 ${busyDevices} / 维修 ${repairDevices}`, tone: 'info' },
  ]
}

export function mapDashboardTasks(sources = {}) {
  const { orders } = normalizeSources(sources)
  const tasks = []

  orders.forEach((order, index) => {
    const status = normalizeOrderStatus(order)
    const no = orderNo(order)
    const model = orderModel(order)
    const name = customerName(order)
    if (['待发货', '待归还', '待押金', '待验机', '异常'].includes(status)) {
      tasks.push({
        id: `REAL-TASK-${index + 1}`,
        type: status === '异常' ? '异常处理' : status,
        title: `${model} · ${name}`,
        orderId: no,
        priority: ['异常', '待押金'].includes(status) ? 'high' : 'medium',
        dueAt: toDate(pick(order, ['rent_end_date', 'rentEndDate', 'rentEnd', 'created_at', 'createdAt'])) || '待确认',
        status,
        actionLabel: '查看订单',
      })
    }
  })

  return tasks.slice(0, 8)
}

export function mapDashboardRisks(sources = {}) {
  const { orders, devices, scheduleBlocks } = normalizeSources(sources)
  const risks = []

  orders.forEach((order, index) => {
    const status = normalizeOrderStatus(order)
    const riskLevel = String(pick(order, ['riskLevel', 'risk_level'], status === '异常' ? '高' : ''))
    if (status === '异常' || ['中', '高'].includes(riskLevel)) {
      risks.push({
        id: `REAL-RISK-ORDER-${index + 1}`,
        type: status === '异常' ? '订单异常' : '风险订单',
        level: riskLevel === '高' || status === '异常' ? '高' : '中',
        title: `${orderNo(order)} 需要人工复核`,
        relatedOrderId: orderNo(order),
        description: `${customerName(order)} · ${orderModel(order)} · ${status}`,
        suggestedAction: '查看订单',
      })
    }
  })

  devices.filter(isRepairDevice).slice(0, 3).forEach((device, index) => {
    risks.push({
      id: `REAL-RISK-DEVICE-${index + 1}`,
      type: '设备异常',
      level: normalizeDeviceStatus(device) === '异常' ? '高' : '中',
      title: `${pick(device, ['unit_code', 'unitCode', 'assetNo', 'id'], '设备')} 当前不可租`,
      relatedOrderId: '',
      description: `${pick(device, ['model_code', 'modelCode', 'model'], '未填写型号')} · ${normalizeDeviceStatus(device)}`,
      suggestedAction: '查看设备',
    })
  })

  scheduleBlocks.slice(0, 3).forEach((block, index) => {
    const blockType = String(pick(block, ['block_type', 'blockType'], ''))
    if (blockType.includes('conflict') || pick(block, ['conflictType'])) {
      risks.push({
        id: `REAL-RISK-SCHEDULE-${index + 1}`,
        type: '档期冲突',
        level: '中',
        title: '档期占用需要复核',
        relatedOrderId: String(pick(block, ['order_no', 'orderNo', 'order_id', 'orderId'], '')),
        description: `${pick(block, ['unit_code', 'unitCode', 'unit_id', 'unitId'], '设备')} · ${toDate(pick(block, ['start_date', 'startDate']))}`,
        suggestedAction: '查看档期',
      })
    }
  })

  return risks.slice(0, 6)
}

export function mapDashboardOverview(sources = {}) {
  const normalized = normalizeSources(sources)
  const idle = normalized.devices.filter(isIdleDevice).length
  const busy = normalized.devices.filter(isBusyDevice).length
  const repair = normalized.devices.filter(isRepairDevice).length
  const occupiedBlocks = normalized.scheduleBlocks.length
  const topModel = topLabel(normalized.orders, orderModel)
  const topSource = topLabel(normalized.orders, orderSource)

  return {
    idle,
    busy,
    repair,
    occupiedBlocks,
    customerCount: normalized.customers.length,
    topModel,
    topSource,
  }
}
