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
}

const NEXT_ACTIONS = {
  待确认: '确认租期',
  待押金: '核对押金',
  待分配设备: '分配设备',
  待发货: '查看履约信息',
  租赁中: '跟进租期',
  待归还: '提醒归还',
  待验机: '验机入库',
  已完成: '查看归档',
  已取消: '查看归档',
  异常: '处理异常',
}

function pick(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function toDate(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 10)
}

function toDateTime(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 19)
}

function toNumber(value) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function maskPhone(value) {
  const phone = String(value || '').trim()
  if (!phone) return '未填写'
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function formatAddress(row) {
  return [
    pick(row, ['province', 'customer_province']),
    pick(row, ['city', 'customer_city']),
    pick(row, ['district', 'customer_district']),
    pick(row, ['address', 'customer_address']),
  ].filter(Boolean).join(' ') || '未填写地址'
}

function getTodayText() {
  return new Date().toISOString().slice(0, 10)
}

function isFinishedStatus(status) {
  return ['completed', 'cancelled'].includes(status)
}

function isPendingReturn(row) {
  const status = String(pick(row, ['order_status', 'orderStatus'])).trim()
  const rentEnd = toDate(pick(row, ['rent_end_date', 'rentEndDate']))
  return !isFinishedStatus(status) && !!rentEnd && rentEnd <= getTodayText()
}

function isPendingShip(row) {
  const status = String(pick(row, ['order_status', 'orderStatus'])).trim()
  const plannedShipAt = pick(row, ['planned_ship_at', 'plannedShipAt'])
  const actualShipAt = pick(row, ['actual_ship_at', 'actualShipAt'])
  return !isFinishedStatus(status)
    && !!plannedShipAt
    && String(plannedShipAt).slice(0, 10) <= getTodayText()
    && !actualShipAt
}

function mapOrderStatus(row) {
  const rawStatus = String(pick(row, ['order_status', 'orderStatus'])).trim()
  if (isPendingReturn(row)) return '待归还'
  if (isPendingShip(row)) return '待发货'
  return STATUS_LABELS[rawStatus] || rawStatus || '待确认'
}

function mapRiskLevel(row) {
  if (isPendingReturn(row)) return '中'
  const status = String(pick(row, ['order_status', 'orderStatus'])).trim()
  if (status === 'cancelled') return '低'
  return '正常'
}

function mapDepositStatus(row) {
  if (Number(pick(row, ['is_deposit_free', 'isDepositFree'], 0)) === 1) return '免押通过'
  const deposit = toNumber(pick(row, ['deposit', 'deposit_amount', 'depositAmount']))
  return deposit > 0 ? '已收' : '待收'
}

function mapShippingStatus(row) {
  const latest = pick(row, ['latest_logistics_status', 'latestLogisticsStatus'])
  if (latest) return latest
  if (pick(row, ['actual_ship_at', 'actualShipAt'])) return '已发货'
  if (pick(row, ['tracking_no', 'trackingNo'])) return '待查询'
  return '待下单'
}

export function extractRealOrders(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.orders)) return payload.orders
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.groups)) {
    return payload.groups.flatMap((group) => group.rows || [])
  }
  return []
}

export function extractRealOrder(payload) {
  return payload?.order || payload?.data || payload || null
}

export function mapRealOrder(row = {}) {
  const orderNo = String(pick(row, ['order_no', 'orderNo'], '') || pick(row, ['id'], '未编号'))
  const id = pick(row, ['id'], orderNo)
  const status = mapOrderStatus(row)
  const model = String(pick(row, ['model_code', 'modelCode', 'unit_code', 'unitCode'], '未填写设备'))
  const unitCode = pick(row, ['unit_code', 'unitCode'])
  const unitId = pick(row, ['unit_id', 'unitId'])
  const sourceChannel = pick(row, ['source_channel', 'sourceChannel'], 'manual')
  const rentAmount = toNumber(pick(row, ['fee', 'rent_amount', 'rentAmount']))
  const depositAmount = toNumber(pick(row, ['deposit', 'deposit_amount', 'depositAmount']))
  const rawCustomerPhone = pick(row, ['customer_phone', 'customerPhone'])

  return {
    id: String(orderNo || id),
    rawId: id,
    orderNo,
    customerName: pick(row, ['customer_name', 'customerName'], '未填写客户'),
    phoneMasked: maskPhone(rawCustomerPhone),
    channel: SOURCE_CHANNEL_LABELS[sourceChannel] || sourceChannel || '手工',
    status,
    rentStart: toDate(pick(row, ['rent_start_date', 'rentStartDate'])),
    rentEnd: toDate(pick(row, ['rent_end_date', 'rentEndDate'])),
    model,
    deviceIds: [unitCode || (unitId ? `UNIT-${unitId}` : '')].filter(Boolean),
    depositStatus: mapDepositStatus(row),
    depositAmount,
    rentAmount,
    shippingStatus: mapShippingStatus(row),
    riskLevel: mapRiskLevel(row),
    assignee: pick(row, ['source_name', 'sourceName'], '未分配'),
    nextAction: NEXT_ACTIONS[status] || '查看详情',
    address: formatAddress(row),
    note: pick(row, ['remark', 'note'], '真实订单只读接入，当前页面不执行写操作。'),
    createdAt: toDateTime(pick(row, ['created_at', 'createdAt'])) || toDate(pick(row, ['rent_start_date', 'rentStartDate'])),
    storeName: pick(row, ['store_name', 'storeName'], '未分配门店'),
    sourceChannel,
    raw: row,
  }
}

export function mapRealOrders(rows = []) {
  return extractRealOrders(rows).map((row) => mapRealOrder(row))
}

export function buildOrderStatusTabs(orders = [], allLabel = '全部') {
  const values = Array.from(new Set(orders.map((order) => order.status).filter(Boolean)))
  return [
    { label: allLabel, value: allLabel, count: orders.length },
    ...values.map((value) => ({
      label: value,
      value,
      count: orders.filter((order) => order.status === value).length,
    })),
  ]
}

export function resolveOrderDetailId(orderKey, rawOrders = []) {
  const key = String(orderKey || '').trim()
  if (!key) return ''
  const exact = rawOrders.find((order) => String(pick(order, ['order_no', 'orderNo'])) === key)
  if (exact?.id != null) return exact.id
  const idMatch = rawOrders.find((order) => String(order?.id) === key)
  if (idMatch?.id != null) return idMatch.id
  return /^\d+$/.test(key) ? key : ''
}
