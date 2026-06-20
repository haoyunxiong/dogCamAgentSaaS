export function availabilityStatusLabel(result = {}) {
  return result.classification?.label || (result.availableUnits?.length ? '风险可用' : '无档期')
}

export function availabilitySourceLabel(result = {}) {
  const plan = result.plan || {}
  if (plan.source === 'sf_deliver_time') return '顺丰真实时效'
  if (plan.source === 'transit_days') return '手动运输天数'
  if (plan.fallbackReason) return `本地预估：${plan.fallbackReason}`
  return plan.sourceLabel || '本地预估'
}

export function holdCountdownLabel(hold = {}, now = Date.now()) {
  if (!hold || hold.status !== 'active') return hold?.statusLabel || '-'
  const expires = new Date(String(hold.expiresAt || '').replace(' ', 'T')).getTime()
  if (!Number.isFinite(expires)) return '锁定中'
  const diff = Math.max(0, expires - now)
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function mapHoldRows(holds = [], now = Date.now()) {
  return holds.map((hold) => ({
    ...hold,
    countdown: holdCountdownLabel(hold, now),
    rentPeriod: `${hold.rentStartDate || '-'} 至 ${hold.rentEndDate || '-'}`,
    unitLabel: hold.unitCode || `#${hold.unitId || '-'}`,
    windowLabel: `${hold.occupationStartAt || '-'} 至 ${hold.occupationEndAt || '-'}`,
  }))
}
