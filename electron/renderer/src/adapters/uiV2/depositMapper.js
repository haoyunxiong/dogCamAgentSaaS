const STATUS_LABELS = {
  pending: '待审核',
  reviewing: '待复核',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
  finished: '已完成',
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

function toNumber(value) {
  const next = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(next) ? next : 0
}

function toDate(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 10)
}

function maskPhone(value) {
  const phone = String(value || '').replace(/\D/g, '')
  if (!phone) return '未填写'
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function reviewStatus(row = {}) {
  const label = String(pick(row, ['statusLabel', 'status_label'], '')).trim()
  if (label) return label
  const status = String(pick(row, ['status'], '')).trim()
  return STATUS_LABELS[status] || status || '待审核'
}

function riskLevel(row = {}) {
  const status = reviewStatus(row)
  if (['已拒绝', '失败', '免押失败'].some((text) => status.includes(text))) return '高'
  const amount = toNumber(pick(row, ['depositAmount', 'deposit_amount', 'requestedFreeAmount']))
  if (amount >= 3000) return '中'
  return '低'
}

function nextAction(status) {
  if (['待审核', '待复核'].includes(status)) return '只读查看'
  if (status.includes('拒绝') || status.includes('失败')) return '只读复核'
  return '查看记录'
}

export function mapStoredDepositReviews(payload = []) {
  return extractRows(payload, ['orders', 'depositOrders']).map((row, index) => {
    const status = reviewStatus(row)
    const requestedFreeAmount = toNumber(pick(row, ['depositAmount', 'deposit_amount', 'requestedFreeAmount']))
    const rentStart = toDate(pick(row, ['rentStartDate', 'rent_start_date']))
    const rentEnd = toDate(pick(row, ['rentEndDate', 'rent_end_date']))

    return {
      id: String(pick(row, ['depositOrderNo', 'deposit_order_no'], `DEP-${index + 1}`)),
      orderNo: String(pick(row, ['sourceOrderNo', 'source_order_no', 'orderNo', 'order_no'], '未绑定订单')),
      customerName: pick(row, ['customerName', 'customer_name'], '未填写客户'),
      phoneMasked: maskPhone(pick(row, ['customerPhone', 'customer_phone'])),
      model: pick(row, ['productName', 'product_name', 'modelCode', 'model_code', 'unitCode', 'unit_code'], '未填写设备'),
      rentPeriod: [rentStart, rentEnd].filter(Boolean).join(' - ') || '未填写租期',
      depositAmount: requestedFreeAmount,
      requestedFreeAmount,
      depositStatus: status,
      reviewStatus: status,
      riskLevel: riskLevel(row),
      channel: pick(row, ['sourceType', 'source_type'], '本地缓存'),
      assignee: '只读模式',
      submittedAt: toDate(pick(row, ['thirdPartyCreatedAt', 'third_party_created_at', 'createdAt', 'created_at'])) || '未记录',
      riskReason: '来自免押本地缓存的只读记录，本轮不执行审核、创建、完结、取消或远程刷新。',
      nextAction: nextAction(status),
      meta: {
        readonly: true,
        source: 'deposit-local-cache',
        isLatest: pick(row, ['isLatest', 'is_latest'], ''),
      },
      raw: row,
    }
  })
}
