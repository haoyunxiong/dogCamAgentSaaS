import {
  formatCurrency,
  formatZhDateRange,
  normalizeDate,
  paginateRows,
  safeIncludes,
  truncateText,
} from './viewModelUtils.js'

const ARCHIVE_STATUSES = new Set(['已完成', '已取消', '完成', '取消'])
const ACTIVE_STATUSES = new Set(['待确认', '待押金', '待分配设备', '待发货', '租赁中', '待归还', '待验机', '异常'])

export function isArchivedOrder(order = {}) {
  const status = String(order.status || '').trim()
  return ARCHIVE_STATUSES.has(status)
}

export function resolveOrderStage(order = {}) {
  const status = String(order.status || '').trim()
  if (status === '待发货') return '待发货'
  if (status === '待归还') return '待归还'
  if (status === '异常' || ['中', '高'].includes(order.riskLevel)) return '异常'
  if (status === '已完成') return '已完成'
  if (isArchivedOrder(order)) return '历史归档'
  if (ACTIVE_STATUSES.has(status)) return '进行中'
  return '进行中'
}

export function decorateOperationalOrder(order = {}) {
  const stage = resolveOrderStage(order)
  const orderNo = String(order.orderNo || order.id || '未编号')
  const rentPeriod = formatZhDateRange(order.rentStart, order.rentEnd)
  const amount = Number(order.rentAmount || order.totalAmount || 0)
  const deviceSummary = [order.model, ...(order.deviceIds || [])].filter(Boolean).join(' · ') || '未填写设备'
  const risk = order.riskLevel && order.riskLevel !== '正常' ? order.riskLevel : '正常'

  return {
    ...order,
    stage,
    isArchived: isArchivedOrder(order),
    orderNoDisplay: truncateText(orderNo, 18, '未编号'),
    fullOrderNo: orderNo,
    rentPeriod,
    amountLabel: formatCurrency(amount, '¥0'),
    deviceSummary,
    customerLine: `${order.customerName || '未填写客户'} · ${order.phoneMasked || '未填写'}`,
    riskDisplay: risk === '正常' ? '正常' : `${risk}风险`,
    ownerStore: order.storeName || order.assignee || '未分配门店',
    createdAtLabel: normalizeDate(order.createdAt) || '未填写日期',
    nextAction: order.nextAction || (stage === '历史归档' ? '查看归档' : '继续处理'),
  }
}

export function buildOrderOperationalTabs(orders = []) {
  const decorated = orders.map(decorateOperationalOrder)
  const definitions = ['进行中', '待发货', '待归还', '异常', '已完成', '历史归档']
  return definitions.map((value) => ({
    label: value,
    value,
    count: value === '进行中'
      ? decorated.filter((order) => !order.isArchived && !['待发货', '待归还', '异常'].includes(order.stage)).length
      : decorated.filter((order) => value === '历史归档' ? order.isArchived : order.stage === value).length,
  }))
}

export function filterOperationalOrders(orders = [], filters = {}) {
  const tab = filters.status || filters.tab || '进行中'
  return orders
    .map(decorateOperationalOrder)
    .filter((order) => {
      const matchTab = tab === '进行中'
        ? !order.isArchived && !['待发货', '待归还', '异常'].includes(order.stage)
        : tab === '历史归档'
          ? order.isArchived
          : order.stage === tab
      const matchChannel = !filters.channel || filters.channel === '全部渠道' || order.channel === filters.channel
      const matchDeposit = !filters.deposit || filters.deposit === '全部押金状态' || order.depositStatus === filters.deposit
      const matchShipping = !filters.shipping || filters.shipping === '全部物流状态' || order.shippingStatus === filters.shipping
      const matchRisk = !filters.risk || filters.risk === '全部风险' || order.riskLevel === filters.risk || order.riskDisplay === filters.risk
      const matchAssignee = !filters.assignee || filters.assignee === '全部负责人' || order.assignee === filters.assignee || order.storeName === filters.assignee
      const text = `${order.fullOrderNo}${order.customerName}${order.phoneMasked}${order.deviceSummary}${order.ownerStore}${order.channel}`
      return matchTab
        && matchChannel
        && matchDeposit
        && matchShipping
        && matchRisk
        && matchAssignee
        && safeIncludes(text, filters.keyword)
    })
}

export function paginateOperationalOrders(orders = [], page = 1, pageSize = 20) {
  return paginateRows(orders, page, pageSize)
}

export function buildOrderOperationalMetrics(orders = []) {
  const decorated = orders.map(decorateOperationalOrder)
  const current = decorated.filter((order) => !order.isArchived)
  const amount = current.reduce((sum, order) => sum + Number(order.rentAmount || 0), 0)
  return [
    { key: 'current', label: '当前运营订单', value: current.length, unit: '单', trend: '不含历史归档', tone: 'info' },
    { key: 'ship', label: '待发货', value: decorated.filter((order) => order.stage === '待发货').length, unit: '单', trend: '需生成或补充物流', tone: 'warning' },
    { key: 'return', label: '待归还', value: decorated.filter((order) => order.stage === '待归还').length, unit: '单', trend: '关注租期结束', tone: 'warning' },
    { key: 'risk', label: '异常订单', value: decorated.filter((order) => order.stage === '异常').length, unit: '单', trend: '需人工复核', tone: 'danger' },
    { key: 'active', label: '当前在租', value: decorated.filter((order) => order.status === '租赁中').length, unit: '单', trend: '履约中', tone: 'success' },
    { key: 'amount', label: '当前订单金额', value: Math.round(amount).toLocaleString(), unit: '元', trend: '当前运营订单', tone: 'success' },
  ]
}
