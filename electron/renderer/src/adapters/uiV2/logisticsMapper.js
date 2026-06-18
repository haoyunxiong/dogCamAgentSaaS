const STATUS_LABELS = {
  waiting_payment: '待押金',
  paid: '待发货',
  shipping: '待发货',
  active: '租赁中',
  completed: '已完成',
  cancelled: '已取消',
}

const SHIPPING_STATUS_LABELS = {
  pending: '待下单',
  pending_pickup: '待揽收',
  picked_up: '运输中',
  in_transit: '运输中',
  delivered: '已签收',
  returned: '已签收',
  exception: '异常',
  cancelled: '已取消',
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
  return []
}

function toDateTime(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 16)
}

function toNumber(value) {
  const next = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(next) ? next : 0
}

function orderId(row = {}) {
  return pick(row, ['id', 'order_id', 'orderId'], '')
}

function orderNo(row = {}) {
  return String(pick(row, ['order_no', 'orderNo'], pick(row, ['id'], '未编号')))
}

function orderStatus(row = {}) {
  const status = String(pick(row, ['order_status', 'orderStatus', 'status'], '')).trim()
  return STATUS_LABELS[status] || status || '待确认'
}

function shippingStatus(row = {}, order = {}) {
  const status = String(pick(row, ['latest_status', 'latestStatus', 'shippingStatus', 'status'], pick(order, ['latest_logistics_status', 'latestLogisticsStatus'], ''))).trim()
  if (!status && pick(row, ['tracking_no', 'trackingNo'], pick(order, ['tracking_no', 'trackingNo']))) return '待揽收'
  return SHIPPING_STATUS_LABELS[status] || status || '待下单'
}

function address(row = {}) {
  return [
    pick(row, ['province', 'customer_province']),
    pick(row, ['city', 'customer_city']),
    pick(row, ['district', 'customer_district']),
    pick(row, ['address', 'customer_address']),
  ].filter(Boolean).join(' ') || '未填写地址'
}

function timeline(status, record = {}) {
  const hasTracking = Boolean(pick(record, ['tracking_no', 'trackingNo']))
  const shipped = Boolean(pick(record, ['actual_ship_at', 'actualShipAt'])) || ['待揽收', '运输中', '已签收'].includes(status)
  const arrived = Boolean(pick(record, ['actual_arrive_at', 'actualArriveAt'])) || status === '已签收'
  return [
    { label: '确认寄件信息', desc: hasTracking ? '已有运单信息' : '只读待补充', done: hasTracking || shipped },
    { label: '揽收状态', desc: toDateTime(pick(record, ['actual_ship_at', 'actualShipAt'])) || status, done: shipped, current: status === '待揽收' },
    { label: '运输状态', desc: status, done: ['运输中', '已签收'].includes(status), current: status === '运输中' },
    { label: '签收状态', desc: toDateTime(pick(record, ['actual_arrive_at', 'actualArriveAt'])) || status, done: arrived, current: status === '已签收' },
  ]
}

function nextAction(status) {
  if (status === '异常') return '只读复核'
  if (status === '待下单') return '只读待补充'
  if (status === '待揽收') return '查看揽收'
  if (status === '运输中') return '查看轨迹'
  if (status === '已签收') return '查看记录'
  return '查看详情'
}

export function mapRealWaybills({ orders = [], recordsByOrder = {} } = {}) {
  return extractRows(orders, ['orders']).map((order) => {
    const id = orderId(order)
    const records = extractRows(recordsByOrder[id] || recordsByOrder[orderNo(order)] || [], ['records'])
    const record = records[0] || {}
    const status = shippingStatus(record, order)
    const trackingNo = pick(record, ['tracking_no', 'trackingNo'], pick(order, ['tracking_no', 'trackingNo'], ''))
    const no = orderNo(order)
    const insuredAmount = toNumber(pick(record, ['insured_amount', 'insuredAmount'], pick(order, ['deposit', 'deposit_amount', 'depositAmount'], 0)))

    return {
      id: String(pick(record, ['id'], `SHP-${no}`)),
      orderId: no,
      carrier: pick(record, ['shipping_mode', 'shippingMode', 'carrier'], '顺丰速运'),
      trackingNo,
      sender: pick(record, ['sender'], '小狗相机仓库'),
      receiver: pick(record, ['receiver'], pick(order, ['customer_name', 'customerName'], '未填写客户')),
      receiverAddress: pick(record, ['receiver_address', 'receiverAddress'], address(order)),
      insuredAmount,
      pickupTime: toDateTime(pick(record, ['actual_ship_at', 'actualShipAt', 'expected_arrive_at', 'expectedArriveAt'])) || '未记录',
      customerName: pick(order, ['customer_name', 'customerName'], '未填写客户'),
      model: pick(order, ['model_code', 'modelCode', 'unit_code', 'unitCode'], '未填写设备'),
      orderStatus: orderStatus(order),
      shippingStatus: status,
      nextAction: nextAction(status),
      timeline: timeline(status, record),
      meta: {
        readonly: true,
        recordCount: records.length,
        rawOrderId: id,
      },
      raw: { order, record },
    }
  })
}
