function formatFilterDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addFilterDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: formatFilterDate(start),
    to: formatFilterDate(end),
  }
}

function dateRangeForPreset(preset) {
  const now = new Date()
  if (preset === 'today') {
    const today = formatFilterDate(now)
    return { from: today, to: today }
  }
  if (preset === 'last7') {
    return { from: formatFilterDate(addFilterDays(now, -6)), to: formatFilterDate(now) }
  }
  if (preset === 'nextMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    return { from: formatFilterDate(start), to: formatFilterDate(end) }
  }
  return currentMonthRange()
}

export function createDefaultOrderFilters() {
  return {
    modelCode: '',
    status: '',
    storeId: '',
    from: '',
    to: '',
    dateField: 'created_at',
    datePreset: 'thisMonth',
    keyword: '',
    quickFilter: 'all',
    paymentStatus: '',
    depositStatus: '',
  }
}

export function useOrderFilters(deps) {
  function applyDatePreset(preset = deps.filters.datePreset) {
    if (preset === 'custom') return
    const range = dateRangeForPreset(preset)
    deps.filters.from = range.from
    deps.filters.to = range.to
  }

  function applyDefaultMonthFilters() {
    deps.filters.dateField = 'created_at'
    deps.filters.datePreset = 'thisMonth'
    applyDatePreset('thisMonth')
  }

  function applyQuickFilter(key) {
    deps.filters.quickFilter = key
    const visibleIds = new Set(deps.orderGroups.value.flatMap((group) => group.rows.map((order) => order.id)))
    deps.selectedOrderIds.value = deps.selectedOrderIds.value.filter((id) => visibleIds.has(id))
    deps.refreshSelectedOrder()
  }

  function resetFilters() {
    Object.assign(deps.filters, createDefaultOrderFilters())
    applyDefaultMonthFilters()
    deps.showAdvancedFilters.value = false
    deps.loadOrders()
  }

  return {
    applyDatePreset,
    applyDefaultMonthFilters,
    applyQuickFilter,
    resetFilters,
  }
}
