function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeMoney(value) {
  return Number(toNumber(value).toFixed(2))
}

function resolveRowTotalPrice(row, days = 0) {
  if (row?.total_price !== null && row?.total_price !== undefined && row?.total_price !== '') {
    return normalizeMoney(row.total_price)
  }
  return normalizeMoney(toNumber(row?.daily_price) * Math.max(1, Number(days || row?.max_days || row?.min_days || 1)))
}

function resolveQuoteFromPricingRows(rows = [], rentDays = 0) {
  const days = Math.max(1, Number.parseInt(String(rentDays || 0), 10) || 0)
  const activeRows = rows
    .filter((row) => Number(row?.active ?? 1) !== 0)
    .map((row) => ({
      ...row,
      min_days: Number.parseInt(String(row?.min_days || 0), 10) || 0,
      max_days: Number.parseInt(String(row?.max_days || 0), 10) || 0,
      extension_daily_price: toNumber(row?.extension_daily_price),
    }))
    .sort((a, b) => a.max_days - b.max_days)

  if (!activeRows.length || !days) {
    return { ok: false, reason: 'no_pricing_rows' }
  }

  const exactRow = activeRows.find((row) => days >= row.min_days && days <= row.max_days)
  if (exactRow) {
    const totalPrice = resolveRowTotalPrice(exactRow, days)
    return {
      ok: true,
      source: 'exact',
      pricingRow: exactRow,
      totalPrice,
      dailyPrice: normalizeMoney(totalPrice / days),
      baseDays: days,
      extensionDays: 0,
      extensionDailyPrice: exactRow.extension_daily_price || 0,
    }
  }

  const baseRow = [...activeRows]
    .filter((row) => row.max_days > 0 && row.max_days < days && row.extension_daily_price > 0)
    .sort((a, b) => b.max_days - a.max_days)[0]

  if (!baseRow) {
    return { ok: false, reason: 'no_matching_pricing_rule' }
  }

  const baseDays = baseRow.max_days
  const extensionDays = days - baseDays
  const basePrice = resolveRowTotalPrice(baseRow, baseDays)
  const totalPrice = normalizeMoney(basePrice + extensionDays * baseRow.extension_daily_price)

  return {
    ok: true,
    source: 'extended',
    pricingRow: baseRow,
    totalPrice,
    dailyPrice: normalizeMoney(totalPrice / days),
    baseDays,
    extensionDays,
    extensionDailyPrice: normalizeMoney(baseRow.extension_daily_price),
  }
}

function pickDepositExemptionRule(rows = [], assetValue = 0) {
  const value = toNumber(assetValue)
  if (value <= 0) return null
  const matches = rows
    .filter((row) => Number(row?.active ?? 1) !== 0)
    .map((row) => ({
      ...row,
      min_asset_value: toNumber(row?.min_asset_value),
      max_asset_value: row?.max_asset_value === null || row?.max_asset_value === undefined || row?.max_asset_value === ''
        ? null
        : toNumber(row?.max_asset_value),
      min_zhima_score: Number.parseInt(String(row?.min_zhima_score || 0), 10) || 0,
      fixed_deposit_amount: toNumber(row?.fixed_deposit_amount),
      sort_order: Number.parseInt(String(row?.sort_order || 0), 10) || 0,
    }))
    .filter((row) => value >= row.min_asset_value && (row.max_asset_value === null || value <= row.max_asset_value))
    .sort((a, b) => a.sort_order - b.sort_order || a.min_asset_value - b.min_asset_value)
  return matches[0] || null
}

function buildDepositExemptionSummary(rule, assetValue = 0) {
  if (!rule) return ''
  const parts = []
  if (Number(rule.min_zhima_score || 0) > 0) parts.push(`芝麻分 ${Number(rule.min_zhima_score)}+`)
  if (Number(rule.adult_required || 0)) parts.push('需成年')
  if (Number(rule.real_name_required || 0)) parts.push('需实名审核')
  if (rule.unsupported_cert_text) parts.push(String(rule.unsupported_cert_text).trim())

  let depositAmount = 0
  if (String(rule.deposit_mode || 'asset_value') === 'fixed') {
    depositAmount = normalizeMoney(rule.fixed_deposit_amount)
  } else {
    depositAmount = normalizeMoney(assetValue)
  }

  const tail = depositAmount > 0 ? `；未通过需全额押金 ¥${depositAmount.toFixed(2)}` : ''
  return `免押：${parts.filter(Boolean).join('，')}${tail}`
}

function buildPricingRowsFromLadder({
  modelCode = '',
  tierPrices = [],
  extensionDailyPrice = 0,
  deposit = 0,
  remark = null,
  active = 1,
} = {}) {
  const normalizedModelCode = String(modelCode || '').trim()
  if (!normalizedModelCode) return []
  const normalizedExtensionDailyPrice = normalizeMoney(extensionDailyPrice)
  const normalizedDeposit = normalizeMoney(deposit)
  return tierPrices
    .map((price, index) => ({
      day: index + 1,
      totalPrice: price,
    }))
    .filter((item) => Number.isFinite(Number(item.totalPrice)) && Number(item.totalPrice) >= 0)
    .map((item) => {
      const totalPrice = normalizeMoney(item.totalPrice)
      return {
        model_code: normalizedModelCode,
        min_days: item.day,
        max_days: item.day,
        daily_price: normalizeMoney(totalPrice / item.day),
        total_price: totalPrice,
        extension_daily_price: normalizedExtensionDailyPrice,
        deposit: normalizedDeposit,
        remark: remark ?? null,
        active: Number(active) ? 1 : 0,
      }
    })
}

function summarizePricingRowsByModel(rows = []) {
  const groups = new Map()
  for (const row of rows) {
    const modelCode = String(row?.model_code || row?.modelCode || '').trim()
    if (!modelCode) continue
    const day = Number.parseInt(String(row?.max_days || row?.min_days || 0), 10) || 0
    if (day < 1) continue
    const group = groups.get(modelCode) || {
      modelCode,
      rowIds: [],
      tiers: [],
      extensionDailyPrice: 0,
      deposit: 0,
      remark: '',
      active: false,
    }
    const totalPrice = resolveRowTotalPrice(row, day)
    group.rowIds.push(row.id)
    group.tiers.push({
      id: row.id,
      day,
      totalPrice,
      dailyPrice: normalizeMoney(toNumber(row?.daily_price) || totalPrice / day),
    })
    group.extensionDailyPrice = Math.max(group.extensionDailyPrice, toNumber(row?.extension_daily_price))
    group.deposit = Math.max(group.deposit, toNumber(row?.deposit))
    if (!group.remark && row?.remark) group.remark = String(row.remark)
    if (Number(row?.active ?? 1) !== 0) group.active = true
    groups.set(modelCode, group)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      tiers: group.tiers.sort((a, b) => a.day - b.day),
      maxTierDay: group.tiers.reduce((max, item) => Math.max(max, item.day), 0),
    }))
    .sort((a, b) => a.modelCode.localeCompare(b.modelCode, 'zh-Hans-CN'))
}

module.exports = {
  buildDepositExemptionSummary,
  buildPricingRowsFromLadder,
  pickDepositExemptionRule,
  resolveQuoteFromPricingRows,
  summarizePricingRowsByModel,
}
