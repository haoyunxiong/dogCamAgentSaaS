export function pick(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

export function extractRows(payload, keys = []) {
  if (Array.isArray(payload)) return payload
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.orders)) return payload.orders
  if (Array.isArray(payload?.units)) return payload.units
  return []
}

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const next = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(next) ? next : fallback
}

export function normalizeText(value, fallback = '未填写') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function normalizeDate(value) {
  if (!value) return ''
  const text = String(value).replace('T', ' ').trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

export function parseDate(value) {
  const normalized = normalizeDate(value)
  if (!normalized) return null
  const date = new Date(`${normalized}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatZhDate(value, fallback = '未填写日期') {
  const date = parseDate(value)
  if (!date) return fallback
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatZhShortDate(value, fallback = '未填写日期') {
  const date = parseDate(value)
  if (!date) return fallback
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatZhDateRange(start, end, fallback = '未填写租期') {
  const startLabel = formatZhShortDate(start, '')
  const endLabel = formatZhShortDate(end, '')
  if (!startLabel && !endLabel) return fallback
  if (!startLabel) return `至 ${endLabel}`
  if (!endLabel) return `${startLabel} 起`
  return `${startLabel} - ${endLabel}`
}

export function formatCurrency(value, fallback = '无法判断') {
  if (value === null || value === undefined || value === '') return fallback
  return `¥${Math.round(toNumber(value)).toLocaleString()}`
}

export function maskPhone(value) {
  const phone = String(value || '').replace(/\D/g, '')
  if (!phone) return '未填写'
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

export function truncateText(value, maxLength = 24, fallback = '未填写') {
  const text = normalizeText(value, fallback)
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`
}

export function daysBetween(start, end) {
  const left = parseDate(start)
  const right = parseDate(end)
  if (!left || !right) return 0
  return Math.max(1, Math.round((right.getTime() - left.getTime()) / 86400000) + 1)
}

export function todayText() {
  return new Date().toISOString().slice(0, 10)
}

export function enumerateDates(count = 7, start = todayText()) {
  const base = parseDate(start) || new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

export function paginateRows(rows = [], page = 1, pageSize = 20) {
  const size = Math.max(1, Number(pageSize) || 20)
  const current = Math.max(1, Number(page) || 1)
  const start = (current - 1) * size
  return rows.slice(start, start + size)
}

export function groupBy(rows = [], resolver) {
  const groups = new Map()
  for (const row of rows) {
    const key = resolver(row)
    const normalized = key || '未分组'
    if (!groups.has(normalized)) groups.set(normalized, [])
    groups.get(normalized).push(row)
  }
  return groups
}

export function countBy(rows = [], resolver) {
  const counts = new Map()
  for (const row of rows) {
    const key = resolver(row)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

export function safeIncludes(source, keyword) {
  const query = String(keyword || '').trim()
  if (!query) return true
  return String(source || '').includes(query)
}
