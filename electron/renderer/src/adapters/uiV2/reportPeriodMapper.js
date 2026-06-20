import {
  extractRows,
  formatZhDate,
  normalizeDate,
  parseDate,
  toNumber,
} from './viewModelUtils.js'

function orderDate(order = {}) {
  return normalizeDate(order.created_at || order.createdAt || order.rent_start_date || order.rentStartDate || order.rentStart)
}

function orderAmount(order = {}) {
  return toNumber(order.fee || order.rent_amount || order.rentAmount || order.amount)
}

function minMaxDates(orders = []) {
  const dates = orders.map(orderDate).filter(Boolean).sort()
  if (!dates.length) return { from: '', to: '' }
  return { from: dates[0], to: dates[dates.length - 1] }
}

function monthLabel(value) {
  const date = parseDate(value)
  if (!date) return '暂无数据周期'
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function buildReportPeriodContext({ orders = [], activeRange = '' } = {}) {
  const rows = extractRows(orders, ['orders'])
  const coverage = minMaxDates(rows)
  const latestDate = coverage.to || ''
  const latestMonth = latestDate ? latestDate.slice(0, 7) : ''
  const periodRows = latestMonth
    ? rows.filter((order) => orderDate(order).startsWith(latestMonth))
    : []
  return {
    coverage,
    coverageLabel: coverage.from && coverage.to
      ? `${formatZhDate(coverage.from)} 至 ${formatZhDate(coverage.to)}`
      : '暂无真实订单日期',
    latestPeriodLabel: activeRange || monthLabel(latestDate),
    periodOrderCount: periodRows.length,
    periodAmount: periodRows.reduce((sum, order) => sum + orderAmount(order), 0),
    hasCoverage: Boolean(coverage.from && coverage.to),
  }
}

export function hardenReportView(report = {}, context = {}) {
  const trend = Array.isArray(report.revenueTrend) ? report.revenueTrend : []
  const hasTrendValue = trend.some((item) => Number(item.value || 0) > 0)
  const safeTrend = hasTrendValue ? trend : []
  return {
    ...report,
    period: context,
    revenueTrend: safeTrend,
    trendEmptyLabel: hasTrendValue ? '' : '该时间范围暂无数据',
    kpis: [
      ...(report.kpis || []),
      {
        key: 'coverage',
        label: '数据覆盖',
        value: context.hasCoverage ? context.latestPeriodLabel : '暂无数据',
        unit: '',
        trend: context.coverageLabel,
        tone: context.hasCoverage ? 'info' : 'warning',
      },
    ],
  }
}
