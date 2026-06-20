import {
  extractRows,
  formatCurrency,
  formatZhShortDate,
  normalizeDate,
  paginateRows,
  pick,
  safeIncludes,
  toNumber,
} from './viewModelUtils.js'

const ORDER_STATUS_LABELS = {
  waiting_payment: '待押金',
  paid: '待发货',
  shipping: '待发货',
  active: '租赁中',
  completed: '已完成',
  cancelled: '已取消',
}

const SHIPPING_STATUS_LABELS = {
  manual_recorded: '待揽收',
  pending: '待揽收',
  pending_pickup: '待揽收',
  picked_up: '运输中',
  in_transit: '运输中',
  delivered: '已签收',
  returned: '已签收',
  exception: '异常',
  cancelled: '历史记录',
  draft: '待创建运单',
  submitted: '待揽收',
  placed: '待揽收',
}

function orderNo(order = {}) {
  return String(pick(order, ['order_no', 'orderNo', 'id'], '未编号'))
}

function orderStatus(order = {}) {
  const status = String(pick(order, ['order_status', 'orderStatus', 'status'], '')).trim()
  return ORDER_STATUS_LABELS[status] || order.status || status || '待确认'
}

function statusLabel(record = {}, fallback = '待创建运单') {
  const raw = String(pick(record, ['latest_status', 'latestStatus', 'shippingStatus', 'status'], '')).trim()
  return SHIPPING_STATUS_LABELS[raw] || raw || fallback
}

function orderNeedsShipment(order = {}) {
  const status = orderStatus(order)
  if (['已完成', '已取消'].includes(status)) return false
  if (status === '待发货') return true
  if (pick(order, ['planned_ship_at', 'plannedShipAt']) && !pick(order, ['actual_ship_at', 'actualShipAt'])) return true
  if (pick(order, ['tracking_no', 'trackingNo'])) return false
  return false
}

function mapRecord(record = {}, order = {}, index = 0, source = 'shipping_records') {
  const stage = statusLabel(record, '待揽收')
  const no = orderNo(order)
  const trackingNo = pick(record, ['tracking_no', 'trackingNo'], pick(order, ['tracking_no', 'trackingNo'], ''))
  return {
    id: `${source}-${pick(record, ['id'], `${no}-${index}`)}`,
    entityType: source === 'shipping_records' ? '物流记录' : '顺丰记录',
    orderId: no,
    rawOrderId: pick(order, ['id'], ''),
    customerName: pick(order, ['customer_name', 'customerName'], '未填写客户'),
    model: pick(order, ['model_code', 'modelCode', 'unit_code', 'unitCode'], '未填写设备'),
    logisticsStage: stage,
    carrier: pick(record, ['carrier', 'shipping_mode', 'shippingMode', 'provider'], source === 'sf_shipments' ? '顺丰速运' : '本地记录'),
    trackingNo: trackingNo || '暂无记录',
    sentAt: formatZhShortDate(pick(record, ['actual_ship_at', 'actualShipAt', 'created_at', 'createdAt']), '暂无记录'),
    expectedArriveAt: formatZhShortDate(pick(record, ['expected_arrive_at', 'expectedArriveAt']), '暂无记录'),
    latestTrace: pick(record, ['latest_status', 'latestStatus', 'statusLabel', 'status_label'], stage),
    risk: stage === '异常' ? '需复核' : '正常',
    nextAction: stage === '异常' ? '复核物流' : stage === '已签收' ? '查看记录' : '跟进物流',
    amountLabel: formatCurrency(toNumber(pick(record, ['insured_amount', 'insuredAmount'], pick(order, ['deposit', 'deposit_amount', 'depositAmount'], 0))), '无法判断'),
    timeline: buildTimeline(stage, record),
    raw: { order, record, source },
  }
}

function buildShipmentTask(order = {}) {
  const no = orderNo(order)
  return {
    id: `task-${pick(order, ['id'], no)}`,
    entityType: '发货任务',
    orderId: no,
    rawOrderId: pick(order, ['id'], ''),
    customerName: pick(order, ['customer_name', 'customerName'], '未填写客户'),
    model: pick(order, ['model_code', 'modelCode', 'unit_code', 'unitCode'], '未填写设备'),
    logisticsStage: '待创建运单',
    carrier: '未选择',
    trackingNo: '暂无记录',
    sentAt: '暂无记录',
    expectedArriveAt: formatZhShortDate(pick(order, ['expected_arrive_at', 'expectedArriveAt']), '暂无记录'),
    latestTrace: '尚未创建本地物流记录',
    risk: '无法判断',
    nextAction: '创建本地记录或预览顺丰',
    amountLabel: formatCurrency(pick(order, ['deposit', 'deposit_amount', 'depositAmount'], ''), '无法判断'),
    timeline: buildTimeline('待创建运单', {}),
    raw: { order, record: null, source: 'shipment_task' },
  }
}

function buildTimeline(stage, record = {}) {
  return [
    { label: '创建运单/记录', desc: stage === '待创建运单' ? '暂无记录' : '已有记录', done: stage !== '待创建运单', current: stage === '待创建运单' },
    { label: '揽收', desc: formatZhShortDate(pick(record, ['actual_ship_at', 'actualShipAt']), stage), done: ['运输中', '已签收'].includes(stage), current: stage === '待揽收' },
    { label: '运输', desc: stage, done: stage === '已签收', current: stage === '运输中' },
    { label: '签收', desc: formatZhShortDate(pick(record, ['actual_arrive_at', 'actualArriveAt']), stage), done: stage === '已签收', current: stage === '已签收' },
  ]
}

export function mapLogisticsWorkspace({ orders = [], recordsByOrder = {}, sfShipments = [] } = {}) {
  const orderRows = extractRows(orders, ['orders'])
  const orderById = new Map(orderRows.map((order) => [String(pick(order, ['id'], '')), order]))
  const orderByNo = new Map(orderRows.map((order) => [orderNo(order), order]))
  const records = []
  const orderIdsWithRecords = new Set()

  Object.entries(recordsByOrder || {}).forEach(([key, payload]) => {
    const rows = extractRows(payload, ['records'])
    const order = orderById.get(String(key)) || orderByNo.get(String(key)) || {}
    rows.forEach((record, index) => {
      orderIdsWithRecords.add(String(key))
      orderIdsWithRecords.add(orderNo(order))
      records.push(mapRecord(record, order, index, 'shipping_records'))
    })
  })

  extractRows(sfShipments, ['shipments']).forEach((shipment, index) => {
    const relatedOrder = orderById.get(String(pick(shipment, ['order_id', 'orderId'], '')))
      || orderByNo.get(String(pick(shipment, ['order_no', 'orderNo'], '')))
      || {}
    const mapped = mapRecord(shipment, relatedOrder, index, 'sf_shipments')
    orderIdsWithRecords.add(String(mapped.rawOrderId || mapped.orderId))
    records.push(mapped)
  })

  const tasks = orderRows
    .filter((order) => orderNeedsShipment(order))
    .filter((order) => !orderIdsWithRecords.has(String(pick(order, ['id'], ''))) && !orderIdsWithRecords.has(orderNo(order)))
    .map(buildShipmentTask)

  const rows = [...tasks, ...records]
  return {
    rows,
    tasks,
    records,
    metrics: buildLogisticsMetrics({ tasks, records, rows }),
  }
}

export function buildLogisticsMetrics({ tasks = [], records = [], rows = [] } = {}) {
  return [
    { key: 'task', label: '待创建运单', value: rows.filter((row) => row.logisticsStage === '待创建运单').length, unit: '单', trend: '发货任务', tone: 'warning' },
    { key: 'pickup', label: '待揽收', value: rows.filter((row) => row.logisticsStage === '待揽收').length, unit: '单', trend: '物流记录', tone: 'warning' },
    { key: 'transit', label: '运输中', value: rows.filter((row) => row.logisticsStage === '运输中').length, unit: '单', trend: '物流记录', tone: 'info' },
    { key: 'signed', label: '已签收', value: rows.filter((row) => row.logisticsStage === '已签收').length, unit: '单', trend: '物流记录', tone: 'success' },
    { key: 'exception', label: '异常', value: rows.filter((row) => row.logisticsStage === '异常').length, unit: '单', trend: '需人工复核', tone: 'danger' },
    { key: 'records', label: '物流记录', value: records.length, unit: '条', trend: `发货任务 ${tasks.length}`, tone: 'info' },
  ]
}

export function filterLogisticsRows(rows = [], filters = {}) {
  return rows.filter((row) => {
    const matchTab = !filters.status || filters.status === '全部' || (
      filters.status === '历史记录'
        ? ['已签收', '历史记录'].includes(row.logisticsStage)
        : row.logisticsStage === filters.status
    )
    const matchKeyword = safeIncludes(`${row.orderId}${row.customerName}${row.model}${row.trackingNo}${row.latestTrace}`, filters.keyword)
    return matchTab && matchKeyword
  })
}

export function paginateLogisticsRows(rows = [], page = 1, pageSize = 20) {
  return paginateRows(rows, page, pageSize)
}

export function normalizeLogisticsRows(rows = []) {
  return extractRows(rows, ['rows']).map((row) => {
    if (row.logisticsStage) return row
    const stage = row.shippingStatus || row.status || '待创建运单'
    return {
      ...row,
      entityType: row.entityType || '物流记录',
      rawOrderId: row.rawOrderId || row.meta?.rawOrderId || '',
      logisticsStage: stage,
      carrier: row.carrier || '本地记录',
      trackingNo: row.trackingNo || '暂无记录',
      sentAt: row.sentAt || row.pickupTime || '暂无记录',
      expectedArriveAt: row.expectedArriveAt || '暂无记录',
      latestTrace: row.latestTrace || stage,
      risk: row.risk || (stage === '异常' ? '需复核' : '正常'),
      amountLabel: row.amountLabel || formatCurrency(row.insuredAmount, '无法判断'),
      timeline: row.timeline || buildTimeline(stage, row),
    }
  })
}

export function isRecentLogisticsDate(value) {
  const normalized = normalizeDate(value)
  return Boolean(normalized)
}
