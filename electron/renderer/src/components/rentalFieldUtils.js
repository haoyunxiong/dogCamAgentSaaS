export function buildRentDaySuggestions(maxDays = 30) {
  return Array.from({ length: Math.max(0, Number(maxDays) || 0) }, (_, index) => {
    const value = index + 1
    return { value, label: `${value}天` }
  })
}

export function parseLocalDateValue(dateText) {
  const text = String(dateText || '').trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, monthIndex, day)
  if (
    !Number.isFinite(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function formatLocalDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function addLocalDateDays(dateText, days) {
  const base = parseLocalDateValue(dateText)
  if (!base) return ''
  const next = new Date(base)
  next.setDate(next.getDate() + Number(days || 0))
  return formatLocalDateValue(next)
}

export function diffInclusiveLocalDates(startDate, endDate) {
  const start = parseLocalDateValue(startDate)
  const end = parseLocalDateValue(endDate)
  if (!start || !end) return 0
  return Math.max(1, Math.round((end - start) / 86400000) + 1)
}

export function normalizeRentDayInput(rawValue, minValue = 1) {
  if (rawValue == null) return null
  const text = String(rawValue).trim()
  if (!text) return null
  const digits = text.replace(/[^\d]/g, '')
  if (!digits) return null
  const normalized = Number(digits)
  if (!Number.isFinite(normalized) || normalized < minValue) return null
  return Math.round(normalized)
}
