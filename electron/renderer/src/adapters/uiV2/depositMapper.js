const STATUS_LABELS = {
  pending: '待审核',
  reviewing: '待复核',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
  finished: '已完结',
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

function buildTimeline(status, row = {}, sourceLabel = '') {
  const createdAt = toDate(pick(row, ['thirdPartyCreatedAt', 'third_party_created_at', 'createdAt', 'created_at'])) || '暂无记录'
  const updatedAt = toDate(pick(row, ['updatedAt', 'updated_at', 'syncedAt', 'synced_at'])) || createdAt
  return [
    { label: '接口/缓存同步', desc: sourceLabel || '暂无记录', done: Boolean(sourceLabel), current: false },
    { label: '创建记录', desc: createdAt, done: createdAt !== '暂无记录', current: status === '待审核' },
    { label: '审核状态', desc: status || '暂无记录', done: !['待审核', '待复核'].includes(status), current: ['待审核', '待复核'].includes(status) },
    { label: '最近更新', desc: updatedAt, done: updatedAt !== '暂无记录', current: false },
  ]
}

export function mapStoredDepositReviews(payload = [], options = {}) {
  const sourceLabel = options.sourceLabel || (payload?.stale ? '接口失败回退本地缓存' : '免押接口同步')
  const sourceCode = options.sourceCode || (payload?.stale ? 'deposit-local-cache-stale' : 'deposit-api-sync')
  const readonlyReason = options.readonlyReason || '来自免押接口刷新后的本地同步记录；状态变化会沉淀到本地审计缓存。'

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
      channel: pick(row, ['sourceType', 'source_type'], sourceLabel),
      assignee: '只读模式',
      submittedAt: toDate(pick(row, ['thirdPartyCreatedAt', 'third_party_created_at', 'createdAt', 'created_at'])) || '未记录',
      riskReason: readonlyReason,
      nextAction: nextAction(status),
      sourceLabel,
      dataSourceLabel: sourceLabel,
      syncedAtLabel: toDate(pick(row, ['syncedAt', 'synced_at', 'updatedAt', 'updated_at', 'createdAt', 'created_at'])) || '暂无记录',
      localCacheStatus: sourceCode.includes('cache') ? '本地缓存' : '已同步到本地缓存',
      orderLinkedStatus: pick(row, ['sourceOrderNo', 'source_order_no', 'orderNo', 'order_no']) ? '已关联订单' : '未绑定订单',
      timeline: buildTimeline(status, row, sourceLabel),
      meta: {
        readonly: true,
        source: sourceCode,
        syncedFromRemote: sourceCode === 'deposit-api-sync',
        stale: Boolean(payload?.stale),
        isLatest: pick(row, ['isLatest', 'is_latest'], ''),
      },
      raw: row,
    }
  })
}
