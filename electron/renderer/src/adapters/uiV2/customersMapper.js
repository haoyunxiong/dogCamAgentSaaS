const SOURCE_CHANNEL_LABELS = {
  xianyu: '闲鱼',
  wechat: '私域',
  private: '私域',
  xiaohongshu: '小红书',
  douyin: '抖音',
  manual: '手工',
  other: '其他',
}

const FINISHED_STATUSES = new Set(['completed', 'cancelled'])
const HIGH_RISK_STATUSES = new Set(['overdue', 'exception', 'abnormal'])
const MEDIUM_RISK_STATUSES = new Set(['pending_return', 'returning'])

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

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeDate(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 10)
}

function normalizeDateTime(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 19)
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('86')) return digits.slice(2)
  if (digits.length === 12 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

function maskPhone(value) {
  const phone = normalizePhone(value)
  if (!phone) return '未填写'
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function toNumber(value) {
  const next = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(next) ? next : 0
}

function simpleHash(value) {
  const text = String(value || 'customer')
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash.toString(36).toUpperCase()
}

function resolveSource(row = {}) {
  const source = normalizeText(pick(row, ['source_channel', 'sourceChannel', 'channel', 'source', 'sourceType'], 'manual'))
  return SOURCE_CHANNEL_LABELS[source] || source || '手工'
}

function resolveCity(row = {}) {
  return normalizeText(pick(row, ['city', 'customer_city', 'customerCity']))
    || normalizeText(pick(row, ['province', 'customer_province', 'customerProvince']))
    || normalizeText(pick(row, ['district', 'customer_district', 'customerDistrict']))
    || '未填写城市'
}

function resolveOrderNo(row = {}) {
  return normalizeText(pick(row, ['order_no', 'orderNo', 'sourceOrderNo', 'source_order_no', 'id']))
}

function resolveCustomerName(row = {}) {
  return normalizeText(pick(row, ['customer_name', 'customerName', 'name', 'buyerName'], '未填写客户'))
}

function resolveOrderDate(row = {}) {
  return normalizeDateTime(pick(row, [
    'created_at',
    'createdAt',
    'thirdPartyCreatedAt',
    'third_party_created_at',
    'rent_start_date',
    'rentStartDate',
    'updated_at',
    'updatedAt',
  ]))
}

function identityKey({ name, phone, city, lastOrderAt, orderNo }) {
  const normalizedPhone = normalizePhone(phone)
  if (normalizedPhone) return `phone:${normalizedPhone}`
  return `weak:${name || '未填写客户'}|${city || '未填写城市'}|${normalizeDate(lastOrderAt) || orderNo || 'unknown'}`
}

function isAfter(left, right) {
  if (!right) return true
  if (!left) return false
  return String(left) > String(right)
}

function isPendingReturn(row = {}) {
  const status = normalizeText(pick(row, ['order_status', 'orderStatus', 'status']))
  const rentEnd = normalizeDate(pick(row, ['rent_end_date', 'rentEndDate']))
  const today = new Date().toISOString().slice(0, 10)
  return !FINISHED_STATUSES.has(status) && !!rentEnd && rentEnd < today
}

function deriveOrderRisk(row = {}) {
  const status = normalizeText(pick(row, ['order_status', 'orderStatus', 'status']))
  if (HIGH_RISK_STATUSES.has(status)) return '高'
  if (isPendingReturn(row)) return '高'
  if (MEDIUM_RISK_STATUSES.has(status)) return '中'
  if (status === 'cancelled') return '低'
  return '正常'
}

function maxRisk(current, next) {
  const score = { 正常: 0, 低: 1, 中: 2, 高: 3 }
  return (score[next] || 0) > (score[current] || 0) ? next : current
}

function deriveDepositStatus(row = {}) {
  if (Number(pick(row, ['is_deposit_free', 'isDepositFree'], 0)) === 1) return '免押通过'
  const statusLabel = normalizeText(pick(row, ['statusLabel', 'status_label']))
  if (statusLabel) return statusLabel
  const status = normalizeText(pick(row, ['depositStatus', 'deposit_status', 'status']))
  if (status) return status
  const deposit = toNumber(pick(row, ['deposit', 'deposit_amount', 'depositAmount']))
  return deposit > 0 ? '已收押金' : '待确认'
}

function buildCustomerSeed({ key, name, phone, city, source, lastOrderAt }) {
  const normalizedPhone = normalizePhone(phone)
  const idSuffix = normalizedPhone ? normalizedPhone.slice(-8) : simpleHash(key).slice(0, 8)

  return {
    id: `CUS-${idSuffix}`,
    name: name || '未填写客户',
    phone: normalizedPhone,
    maskedPhone: maskPhone(normalizedPhone),
    phoneMasked: maskPhone(normalizedPhone),
    city: city || '未填写城市',
    orderCount: 0,
    totalAmount: 0,
    totalRent: 0,
    lastOrderAt: lastOrderAt || '',
    lastRentAt: lastOrderAt || '',
    lastOrderNo: '暂无订单',
    depositStatus: '待确认',
    depositPreference: '押金状态待确认',
    riskLevel: '正常',
    source: source || '手工',
    channel: source || '手工',
    tags: [],
    notes: '',
    note: '',
    devices: [],
    nextAction: '保持跟进',
    meta: {
      derivedReadonly: true,
      sources: [],
      rawCounts: { orders: 0, inquiries: 0, deposits: 0 },
    },
    _tagSet: new Set(),
    _sourceSet: new Set(source ? [source] : []),
    _deviceSet: new Set(),
  }
}

function finalizeCustomer(customer) {
  const tags = Array.from(customer._tagSet).slice(0, 5)
  const sources = Array.from(customer._sourceSet).filter(Boolean)
  const devices = Array.from(customer._deviceSet).filter(Boolean).slice(0, 6)
  const total = Number(customer.totalAmount || 0)

  if (customer.orderCount >= 2) tags.unshift('复租客户')
  if (total >= 5000) tags.push('高价值')
  if (['中', '高'].includes(customer.riskLevel)) tags.push('人工复核')

  const uniqueTags = Array.from(new Set(tags)).slice(0, 5)
  const primarySource = sources[0] || customer.source || '手工'
  const note = customer.riskLevel === '高'
    ? '从订单、询单和免押本地缓存只读派生，存在逾期或异常信号，接高价值设备前建议人工复核。'
    : '从订单、询单和免押本地缓存只读派生，不包含客户主表写入。'

  return {
    ...customer,
    totalAmount: total,
    totalRent: total,
    source: primarySource,
    channel: primarySource,
    tags: uniqueTags.length ? uniqueTags : ['只读派生'],
    notes: note,
    note,
    devices,
    nextAction: customer.riskLevel === '高'
      ? '复核后再接单'
      : customer.meta.rawCounts.inquiries > 0
        ? '跟进询单'
        : customer.orderCount >= 2
          ? '推荐复租套餐'
          : '保持跟进',
    meta: {
      ...customer.meta,
      sources,
    },
    _tagSet: undefined,
    _sourceSet: undefined,
    _deviceSet: undefined,
  }
}

function upsertCustomer(customers, seed) {
  if (!customers.has(seed.key)) {
    customers.set(seed.key, buildCustomerSeed(seed))
  }
  return customers.get(seed.key)
}

function addOrder(customers, order = {}, orderNoToKey) {
  const name = resolveCustomerName(order)
  const phone = pick(order, ['customer_phone', 'customerPhone', 'phone'])
  const city = resolveCity(order)
  const source = resolveSource(order)
  const orderNo = resolveOrderNo(order)
  const lastOrderAt = resolveOrderDate(order)
  const key = identityKey({ name, phone, city, lastOrderAt, orderNo })
  const customer = upsertCustomer(customers, { key, name, phone, city, source, lastOrderAt })
  const amount = toNumber(pick(order, ['fee', 'rent_amount', 'rentAmount', 'amount']))
  const model = normalizeText(pick(order, ['model_code', 'modelCode', 'unit_code', 'unitCode', 'productName']))

  customer.orderCount += 1
  customer.totalAmount += amount
  customer.totalRent = customer.totalAmount
  customer.depositStatus = deriveDepositStatus(order)
  customer.depositPreference = customer.depositStatus.includes('免押') ? '偏好免押' : '押金正常'
  customer.riskLevel = maxRisk(customer.riskLevel, deriveOrderRisk(order))
  customer.meta.rawCounts.orders += 1
  customer._sourceSet.add(source)
  if (model) customer._deviceSet.add(model)
  if (customer.depositStatus.includes('免押')) customer._tagSet.add('免押客户')
  if (isAfter(lastOrderAt, customer.lastOrderAt)) {
    customer.lastOrderAt = lastOrderAt
    customer.lastRentAt = lastOrderAt
    customer.lastOrderNo = orderNo || customer.lastOrderNo
  }
  if (orderNo) orderNoToKey.set(orderNo, key)
}

function addInquiry(customers, inquiry = {}, orderNoToKey) {
  const orderNo = resolveOrderNo(inquiry)
  const name = resolveCustomerName(inquiry)
  const phone = pick(inquiry, ['customer_phone', 'customerPhone', 'phone'])
  const city = resolveCity(inquiry)
  const source = resolveSource(inquiry)
  const lastOrderAt = resolveOrderDate(inquiry)
  let key = orderNoToKey.get(orderNo)
  if (!key && (normalizePhone(phone) || name !== '未填写客户')) {
    key = identityKey({ name, phone, city, lastOrderAt, orderNo })
  }
  if (!key) return

  const customer = upsertCustomer(customers, { key, name, phone, city, source, lastOrderAt })
  customer.meta.rawCounts.inquiries += 1
  customer._sourceSet.add(source)
  customer._tagSet.add('询单活跃')
  if (!customer.phone && normalizePhone(phone)) {
    customer.phone = normalizePhone(phone)
    customer.maskedPhone = maskPhone(phone)
    customer.phoneMasked = maskPhone(phone)
  }
  if (isAfter(lastOrderAt, customer.lastOrderAt)) {
    customer.lastOrderAt = lastOrderAt
    customer.lastRentAt = lastOrderAt
  }
}

function addDeposit(customers, deposit = {}, orderNoToKey) {
  const orderNo = normalizeText(pick(deposit, ['sourceOrderNo', 'source_order_no', 'orderNo', 'order_no', 'depositOrderNo']))
  const name = resolveCustomerName(deposit)
  const phone = pick(deposit, ['customerPhone', 'customer_phone', 'phone'])
  const city = resolveCity(deposit)
  const source = resolveSource(deposit)
  const lastOrderAt = resolveOrderDate(deposit)
  const matchedOrderKey = orderNoToKey.get(orderNo)
  const key = matchedOrderKey || identityKey({ name, phone, city, lastOrderAt, orderNo })
  const customer = upsertCustomer(customers, { key, name, phone, city, source, lastOrderAt })
  const depositStatus = deriveDepositStatus(deposit)
  const amount = toNumber(pick(deposit, ['rentAmount', 'rent_amount']))
  const model = normalizeText(pick(deposit, ['modelCode', 'model_code', 'unitCode', 'unit_code', 'productName']))

  customer.depositStatus = depositStatus
  customer.depositPreference = depositStatus.includes('免押') || depositStatus.includes('通过') ? '偏好免押' : customer.depositPreference
  customer.meta.rawCounts.deposits += 1
  customer._sourceSet.add(source)
  customer._tagSet.add('免押记录')
  if (model) customer._deviceSet.add(model)
  if (!matchedOrderKey) {
    customer.orderCount += 1
    customer.totalAmount += amount
    customer.totalRent = customer.totalAmount
    customer.lastOrderNo = orderNo || customer.lastOrderNo
  }
  if (['rejected', 'failed', '拒绝', '已拒绝'].includes(depositStatus)) {
    customer.riskLevel = maxRisk(customer.riskLevel, '中')
  }
  if (isAfter(lastOrderAt, customer.lastOrderAt)) {
    customer.lastOrderAt = lastOrderAt
    customer.lastRentAt = lastOrderAt
  }
}

export function extractRealCustomerOrders(payload) {
  return extractRows(payload, ['orders'])
}

export function extractRealCustomerInquiries(payload) {
  return extractRows(payload, ['events', 'inquiries'])
}

export function extractRealCustomerDeposits(payload) {
  return extractRows(payload, ['orders', 'depositOrders'])
}

export function mapRealCustomers({ orders = [], inquiries = [], deposits = [] } = {}) {
  const customers = new Map()
  const orderNoToKey = new Map()

  extractRealCustomerOrders(orders).forEach((order) => addOrder(customers, order, orderNoToKey))
  extractRealCustomerInquiries(inquiries).forEach((inquiry) => addInquiry(customers, inquiry, orderNoToKey))
  extractRealCustomerDeposits(deposits).forEach((deposit) => addDeposit(customers, deposit, orderNoToKey))

  return Array.from(customers.values())
    .map(finalizeCustomer)
    .sort((left, right) => String(right.lastOrderAt || '').localeCompare(String(left.lastOrderAt || '')))
}
