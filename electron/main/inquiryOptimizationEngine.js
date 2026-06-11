const {
  DEFAULTS,
  buildDepositFreeCharge,
  normalizeInquiryOptimizationConfig,
} = require('./inquiryOptimizationConfig')

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function round2(value) {
  return Number(toNumber(value).toFixed(2))
}

function round4(value) {
  return Number(toNumber(value).toFixed(4))
}

function sum(values = []) {
  return values.reduce((total, value) => total + toNumber(value), 0)
}

function buildPlatformFeeCharge({ revenue, rate } = {}) {
  return round2(Math.max(0, toNumber(revenue)) * Math.max(0, toNumber(rate)))
}

function buildMonthlyRoi({ netProfit, analysisWindowDays, assetCost } = {}) {
  const windowDays = Math.max(1, toNumber(analysisWindowDays, DEFAULTS.analysisWindowDays))
  const cost = Math.max(0, toNumber(assetCost))
  if (cost <= 0) return 0
  return round4((((toNumber(netProfit) / windowDays) * 30) / cost))
}

function allocateMonthlyShippingExpenseByOrderCount({ total = 0, orders = [] } = {}) {
  const normalizedOrders = Array.isArray(orders) ? orders.filter(Boolean) : []
  if (!normalizedOrders.length) return []
  const totalAmount = round2(total)
  const count = normalizedOrders.length
  const baseAmount = round2(totalAmount / count)

  return normalizedOrders.map((order, index) => {
    const amount = index === count - 1
      ? round2(totalAmount - (baseAmount * (count - 1)))
      : baseAmount
    return {
      orderId: order.id ?? order.orderId ?? order.shipmentNo ?? index + 1,
      amount,
    }
  })
}

function allocateMonthlyShippingExpense({ total = 0, orders = [], mode = DEFAULTS.shippingAllocationMode } = {}) {
  if (String(mode || '').trim() === 'order_count') {
    return allocateMonthlyShippingExpenseByOrderCount({ total, orders })
  }
  return allocateMonthlyShippingExpenseByOrderCount({ total, orders })
}

function firstDefined(values = []) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function resolveRevenue(row = {}) {
  return toNumber(firstDefined([
    row.grossRevenue,
    row.revenue,
    row.totalRevenue,
    row.monthlyRevenue,
    row.quotedRevenue,
    row.convertedRevenue,
  ]), 0)
}

function resolveDepositFreeCount(row = {}) {
  return Math.max(0, Math.round(toNumber(firstDefined([
    row.depositFreeOrderCount,
    row.depositFreeOrders,
  ]), 0)))
}

function buildRowCostBreakdown(row = {}, config = {}) {
  const revenue = resolveRevenue(row)
  const platformFee = row.platformFee !== undefined && row.platformFee !== null
    ? round2(row.platformFee)
    : buildPlatformFeeCharge({ revenue, rate: config.platformFeeRate })
  const depositFreeOrderCount = resolveDepositFreeCount(row)
  const depositFreeCharge = row.depositFreeCharge !== undefined && row.depositFreeCharge !== null
    ? round2(row.depositFreeCharge)
    : round2(buildDepositFreeCharge({
      fee: firstDefined([
        row.depositFreeFeeBase,
        row.depositFreeFee,
        row.depositFreeChargeBase,
        row.finalAvg,
        row.quotedAvg,
        revenue,
      ]),
      per100Fee: config.depositFreePer100Fee,
      orderCost: config.depositFreeOrderCost,
    }) * depositFreeOrderCount)
  const shippingExpense = round2(Math.max(0, toNumber(firstDefined([
    row.shippingExpense,
    row.shippingShare,
    row.shippingCost,
  ]), 0)))
  const repairCost = round2(Math.max(0, toNumber(firstDefined([
    row.repairCost,
    row.repairExpense,
  ]), 0)))
  const otherCost = round2(Math.max(0, toNumber(firstDefined([
    row.otherCost,
    row.otherExpense,
  ]), 0)))
  const knownCosts = round2(platformFee + depositFreeCharge + shippingExpense + repairCost + otherCost)
  const netProfit = row.netProfit !== undefined && row.netProfit !== null
    ? round2(row.netProfit)
    : round2(revenue - knownCosts)
  return {
    revenue: round2(revenue),
    platformFee,
    depositFreeCharge,
    shippingExpense,
    repairCost,
    otherCost,
    totalCost: knownCosts,
    netProfit,
    depositFreeOrderCount,
  }
}

function formatPercent(value) {
  return `${(round4(value) * 100).toFixed(1)}%`
}

function clampPriceDelta(value, config = {}) {
  const maxAdjustment = Math.max(0, toNumber(config.maxPriceAdjustment, DEFAULTS.maxPriceAdjustment))
  const step = Math.max(1, toNumber(config.priceStep, DEFAULTS.priceStep))
  const delta = Math.abs(toNumber(value)) || step
  const normalized = Math.min(maxAdjustment || step, delta)
  return value < 0 ? -normalized : normalized
}

function buildRecommendationReason({
  action,
  unavailableRate,
  availableLoseRate,
  conversionRate,
  monthlyRoi,
  row,
  config,
}) {
  const sampleText = `${Math.max(0, Math.round(toNumber(row.inquiries)))} 条询单`
  const roiText = `月化 ROI ${formatPercent(monthlyRoi)}`

  if (action === 'observe') {
    if (row.missingCostData) return `成本数据不足，先观察；${sampleText}`
    if (toNumber(row.inquiries) < config.minInquirySamples) return `样本不足，先观察；${sampleText}`
    return `暂不调整；${sampleText}，${roiText}`
  }
  if (action === 'restock') {
    return `无档率 ${formatPercent(unavailableRate)}，${roiText}，建议补库存`
  }
  if (action === 'decrease_price') {
    return `可用未成交率 ${formatPercent(availableLoseRate)}，建议下调价格`
  }
  if (action === 'increase_price') {
    return `无档率 ${formatPercent(unavailableRate)}，转化率 ${formatPercent(conversionRate)}，可试探提价`
  }
  return `${sampleText}，${roiText}`
}

function summarizeInquiryOptimization({ config = {}, models = [] } = {}) {
  const normalizedConfig = normalizeInquiryOptimizationConfig(config)
  const rows = (Array.isArray(models) ? models : []).map((row) => {
    const inquiries = Math.max(0, Math.round(toNumber(row.inquiries)))
    const available = Math.max(0, Math.round(toNumber(row.available)))
    const unavailable = Math.max(0, Math.round(toNumber(row.unavailable, Math.max(0, inquiries - available))))
    const converted = Math.max(0, Math.round(toNumber(row.converted)))
    const availableNotConverted = Math.max(0, Math.round(toNumber(row.availableNotConverted, Math.max(0, available - converted))))
    const missingCostData = Boolean(row.missingCostData)
    const conversionRate = inquiries > 0 ? round4(converted / inquiries) : 0
    const unavailableRate = inquiries > 0 ? round4(unavailable / inquiries) : 0
    const availableLoseRate = available > 0 ? round4(availableNotConverted / available) : 0
    const monthlyRoi = buildMonthlyRoi({
      netProfit: row.netProfit,
      analysisWindowDays: normalizedConfig.analysisWindowDays,
      assetCost: firstDefined([row.activeAssetCost, row.assetCost, row.inventoryAssetCost]),
    })
    const costs = buildRowCostBreakdown(row, normalizedConfig)

    let action = 'observe'
    if (!missingCostData && inquiries >= normalizedConfig.minInquirySamples && converted >= normalizedConfig.minOrderSamples && available > 0) {
      if (unavailableRate >= 0.4 && monthlyRoi >= normalizedConfig.targetMonthlyRoiMin) {
        action = 'restock'
      } else if (availableLoseRate >= 0.5) {
        action = 'decrease_price'
      } else if (unavailableRate >= 0.2 && conversionRate >= 0.2 && monthlyRoi <= normalizedConfig.targetMonthlyRoiMax) {
        action = 'increase_price'
      }
    }

    const priceDelta = action === 'increase_price'
      ? clampPriceDelta(normalizedConfig.priceStep, normalizedConfig)
      : action === 'decrease_price'
        ? clampPriceDelta(-normalizedConfig.priceStep, normalizedConfig)
        : 0

    return {
      ...row,
      inquiries,
      available,
      unavailable,
      converted,
      availableNotConverted,
      conversionRate,
      unavailableRate,
      availableLoseRate,
      monthlyRoi,
      costs,
      action,
      priceDelta,
      reasonSummary: buildRecommendationReason({
        action,
        unavailableRate,
        availableLoseRate,
        conversionRate,
        monthlyRoi,
        row,
        config: normalizedConfig,
      }),
    }
  })

  const summary = {
    modelCount: rows.length,
    totalInquiries: sum(rows.map((row) => row.inquiries)),
    totalConverted: sum(rows.map((row) => row.converted)),
    averageMonthlyRoi: rows.length ? round4(sum(rows.map((row) => row.monthlyRoi)) / rows.length) : 0,
    actionCounts: rows.reduce((acc, row) => {
      acc[row.action] = (acc[row.action] || 0) + 1
      return acc
    }, {}),
  }

  return {
    config: normalizedConfig,
    rows,
    summary,
  }
}

module.exports = {
  allocateMonthlyShippingExpense,
  allocateMonthlyShippingExpenseByOrderCount,
  buildMonthlyRoi,
  buildPlatformFeeCharge,
  buildRecommendationReason,
  buildRowCostBreakdown,
  summarizeInquiryOptimization,
  buildDepositFreeCharge,
}
