function normalizeText(value) {
  return String(value ?? '').trim()
}

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value)
    if (text) return text
  }
  return ''
}

function parseDateOnly(value) {
  const text = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null

  const [year, month, day] = text.split('-').map((part) => Number(part))
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return {
    text,
    time: parsed.getTime(),
  }
}

function addRecord(records, type, id) {
  const normalizedType = normalizeText(type)
  const normalizedId = normalizeText(id)
  if (!normalizedType || !normalizedId) return
  if (records.some((record) => record.type === normalizedType && record.id === normalizedId)) return
  records.push({ type: normalizedType, id: normalizedId })
}

function isValidNumberLike(value) {
  if (value === null || value === undefined || value === '') return false
  const number = Number(value)
  return Number.isFinite(number)
}

function createDateRangeReview({ startDate, endDate, startLabel = 'startDate', endLabel = 'endDate' } = {}) {
  const startText = normalizeText(startDate)
  const endText = normalizeText(endDate)
  const parsedStart = parseDateOnly(startText)
  const parsedEnd = parseDateOnly(endText)
  const blockers = []

  if (!startText) {
    blockers.push(`Missing ${startLabel}; date range impact cannot be previewed.`)
  } else if (!parsedStart) {
    blockers.push(`Invalid ${startLabel}; expected YYYY-MM-DD.`)
  }

  if (!endText) {
    blockers.push(`Missing ${endLabel}; date range impact cannot be previewed.`)
  } else if (!parsedEnd) {
    blockers.push(`Invalid ${endLabel}; expected YYYY-MM-DD.`)
  }

  if (parsedStart && parsedEnd && parsedStart.time > parsedEnd.time) {
    blockers.push(`${startLabel} must be earlier than or equal to ${endLabel}.`)
  }

  return {
    blockers,
    rangeLabel: parsedStart && parsedEnd ? `${parsedStart.text} to ${parsedEnd.text}` : 'the requested date range',
  }
}

module.exports = {
  addRecord,
  createDateRangeReview,
  firstText,
  isValidNumberLike,
  normalizeText,
  parseDateOnly,
}
