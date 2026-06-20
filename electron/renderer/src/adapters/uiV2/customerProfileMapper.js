import {
  formatCurrency,
  formatZhShortDate,
  paginateRows,
  safeIncludes,
} from './viewModelUtils.js'

const RELIABLE_TAGS = new Set(['复租客户', '高价值客户', '逾期历史', '信息不完整'])

export function decorateCustomerProfile(customer = {}) {
  const tags = (customer.tags || []).filter((tag) => RELIABLE_TAGS.has(tag))
  const lastOrderNo = customer.lastOrderNo && customer.lastOrderNo !== '暂无订单'
    ? customer.lastOrderNo
    : '暂无记录'
  const city = customer.city || '未填写城市'
  return {
    ...customer,
    city,
    phoneLabel: customer.phoneMasked || customer.maskedPhone || '未填写',
    lastOrderLabel: lastOrderNo,
    lastOrderAtLabel: formatZhShortDate(customer.lastOrderAt || customer.lastRentAt, '暂无记录'),
    totalRentLabel: formatCurrency(customer.totalRent || customer.totalAmount || 0, '¥0'),
    riskDisplay: `系统派生：${customer.riskLevel || '正常'}`,
    tags: tags.length ? tags : ['信息不完整'].filter(() => !customer.phoneLabel || customer.phoneLabel === '未填写'),
    sourceLabel: customer.channel || customer.source || '手工',
    nextAction: customer.nextAction || '保持跟进',
    profileNote: customer.note || customer.notes || '从订单、询单与免押缓存只读派生，不代表权威风控结论。',
    devicePreference: Array.isArray(customer.devices) && customer.devices.length ? customer.devices.join('、') : '暂无记录',
  }
}

export function buildCustomerProfiles(customers = []) {
  return customers.map(decorateCustomerProfile)
}

export function filterCustomerProfiles(customers = [], filters = {}) {
  return customers.map(decorateCustomerProfile).filter((customer) => {
    const matchRisk = !filters.risk || filters.risk === '全部风险' || customer.riskLevel === filters.risk || customer.riskDisplay.endsWith(filters.risk)
    const matchChannel = !filters.channel || filters.channel === '全部渠道' || customer.sourceLabel === filters.channel
    const matchKeyword = safeIncludes(`${customer.name}${customer.phoneLabel}${customer.city}${customer.lastOrderLabel}${customer.devicePreference}`, filters.keyword)
    return matchRisk && matchChannel && matchKeyword
  })
}

export function paginateCustomerProfiles(customers = [], page = 1, pageSize = 20) {
  return paginateRows(customers, page, pageSize)
}

export function buildCustomerMetrics(customers = []) {
  const rows = customers.map(decorateCustomerProfile)
  const totalAmount = rows.reduce((sum, customer) => sum + Number(customer.totalRent || customer.totalAmount || 0), 0)
  return [
    { key: 'total', label: '派生客户', value: rows.length, unit: '位', trend: '无客户主表，系统派生', tone: 'info' },
    { key: 'repeat', label: '复租客户', value: rows.filter((customer) => Number(customer.orderCount || 0) >= 2).length, unit: '位', trend: '订单数 >= 2', tone: 'success' },
    { key: 'risk', label: '高/中风险', value: rows.filter((customer) => ['高', '中'].includes(customer.riskLevel)).length, unit: '位', trend: '系统派生，需人工复核', tone: 'warning' },
    { key: 'missing', label: '信息不完整', value: rows.filter((customer) => customer.tags.includes('信息不完整')).length, unit: '位', trend: '缺手机号或城市', tone: 'warning' },
    { key: 'amount', label: '累计租金', value: Math.round(totalAmount).toLocaleString(), unit: '元', trend: '订单金额汇总', tone: 'success' },
    { key: 'avg', label: '平均客单', value: rows.length ? Math.round(totalAmount / rows.length).toLocaleString() : 0, unit: '元', trend: '只读派生', tone: 'info' },
  ]
}
