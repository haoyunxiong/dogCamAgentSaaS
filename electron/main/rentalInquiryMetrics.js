function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toFlag(value) {
  return value ? 1 : 0
}

function round4(value) {
  return Number(toNumber(value).toFixed(4))
}

function average(values = []) {
  const nums = values.map((value) => toNumber(value, NaN)).filter((value) => Number.isFinite(value) && value > 0)
  if (!nums.length) return 0
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2))
}

function buildInquiryEventRecord({ source = 'unknown', storeId = null, chatId = '', messageId = '', parsed = {}, availability = {} } = {}) {
  const plan = availability.plan || {}
  const counts = availability.counts || {}
  const quote = availability.quote || {}
  return {
    source,
    storeId: storeId || null,
    chatId: chatId || '',
    messageId: messageId || '',
    rawText: parsed.text || '',
    modelCode: availability.modelCode || parsed.modelCode || '',
    rentStartDate: plan.rentStartDate || parsed.rentStartDate || '',
    rentEndDate: plan.rentEndDate || parsed.rentEndDate || '',
    rentDays: toNumber(parsed.rentDays || quote.days, 0),
    province: parsed.province || '',
    city: parsed.city || '',
    district: parsed.district || '',
    address: parsed.address || '',
    shippingMode: parsed.shippingMode || availability.query?.shippingMode || 'land',
    available: toFlag(availability.available),
    totalUnitCount: toNumber(counts.totalUnits, 0),
    availableUnitCount: toNumber(counts.availableUnits, 0),
    conflictUnitCount: toNumber(counts.conflictUnits, 0),
    quotedPrice: quote.ok ? toNumber(quote.totalPrice, 0) : 0,
    quoteDays: toNumber(quote.days || parsed.rentDays, 0),
    depositSummary: availability.depositExemption?.summary || '',
    plannedShipAt: plan.plannedShipAt || null,
    expectedArriveAt: plan.expectedArriveAt || null,
    shipDate: plan.shipDate || '',
    arriveDate: plan.arriveDate || '',
    availabilityStatus: availability.ok ? (availability.available ? 'available' : 'unavailable') : 'failed',
  }
}

function summarizeInquiryStats(rows = []) {
  const groups = new Map()
  for (const row of rows) {
    const modelCode = row.model_code || row.modelCode || '未分类'
    if (!groups.has(modelCode)) groups.set(modelCode, [])
    groups.get(modelCode).push(row)
  }

  const byModel = Array.from(groups.entries()).map(([modelCode, items]) => {
    const inquiries = items.length
    const available = items.filter((item) => toNumber(item.available, 0) === 1).length
    const converted = items.filter((item) => item.order_id || item.orderId).length
    return {
      modelCode,
      inquiries,
      available,
      unavailable: inquiries - available,
      converted,
      availableNotConverted: Math.max(0, available - converted),
      conversionRate: inquiries ? round4(converted / inquiries) : 0,
      avgQuotedPrice: average(items.map((item) => item.quoted_price ?? item.quotedPrice)),
      avgFinalFee: average(items.map((item) => item.final_fee ?? item.finalFee)),
    }
  }).sort((a, b) => b.inquiries - a.inquiries || a.modelCode.localeCompare(b.modelCode))

  const totalInquiries = rows.length
  const totalConverted = rows.filter((item) => item.order_id || item.orderId).length
  return {
    total: {
      inquiries: totalInquiries,
      available: rows.filter((item) => toNumber(item.available, 0) === 1).length,
      unavailable: rows.filter((item) => toNumber(item.available, 0) !== 1).length,
      converted: totalConverted,
      conversionRate: totalInquiries ? round4(totalConverted / totalInquiries) : 0,
      avgQuotedPrice: average(rows.map((item) => item.quoted_price ?? item.quotedPrice)),
      avgFinalFee: average(rows.map((item) => item.final_fee ?? item.finalFee)),
    },
    byModel,
  }
}

module.exports = {
  buildInquiryEventRecord,
  summarizeInquiryStats,
}
