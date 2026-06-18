const crypto = require('crypto')

const SENSITIVE_KEY_PATTERN = /(password|passwd|pwd|secret|token|cookie|authorization|credential|private[_-]?key|api[_-]?key|app[_-]?secret)/i
const PII_KEY_PATTERN = /(phone|mobile|tel|address|receiver|sender|customerName|name)/i

function canonicalize(value) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (Array.isArray(value)) return value.map((item) => canonicalize(item))
  if (typeof value !== 'object') return value

  return Object.keys(value)
    .sort()
    .reduce((nextValue, key) => {
      if (value[key] === undefined) return nextValue
      nextValue[key] = canonicalize(value[key])
      return nextValue
    }, {})
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value))
}

function sha256Hex(value) {
  const input = Buffer.isBuffer(value) ? value : String(value ?? '')
  return crypto.createHash('sha256').update(input).digest('hex')
}

function hashJson(value, namespace) {
  return sha256Hex(`${namespace}:${stableStringify(value)}`)
}

function hashPayload(payload) {
  return hashJson(payload || {}, 'safeops-payload')
}

function hashImpact(impact) {
  return hashJson(impact || {}, 'safeops-impact')
}

function hashConfirmToken(token) {
  return token ? sha256Hex(`safeops-confirm:${token}`) : null
}

function hashIdempotencyKey(key) {
  return key ? sha256Hex(`safeops-idempotency:${key}`) : null
}

function generateOperationId(prefix = 'op') {
  const safePrefix = String(prefix || 'op').replace(/[^a-zA-Z0-9_-]/g, '') || 'op'
  return `${safePrefix}_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`
}

function generateConfirmTokenValue() {
  return crypto.randomBytes(32).toString('hex')
}

function maskText(value) {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= 4) return '<redacted>'
  return `${text.slice(0, 2)}***${text.slice(-2)}`
}

function redactSensitive(value, keyPath = '') {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, keyPath))
  if (typeof value !== 'object') {
    if (SENSITIVE_KEY_PATTERN.test(keyPath)) return '<redacted>'
    if (PII_KEY_PATTERN.test(keyPath)) return maskText(value)
    return value
  }

  return Object.keys(value).reduce((nextValue, key) => {
    const fullKey = keyPath ? `${keyPath}.${key}` : key
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      nextValue[key] = '<redacted>'
      return nextValue
    }
    if (PII_KEY_PATTERN.test(key) && typeof value[key] !== 'object') {
      nextValue[key] = maskText(value[key])
      return nextValue
    }
    nextValue[key] = redactSensitive(value[key], fullKey)
    return nextValue
  }, {})
}

module.exports = {
  generateConfirmTokenValue,
  generateOperationId,
  hashConfirmToken,
  hashIdempotencyKey,
  hashImpact,
  hashPayload,
  redactSensitive,
  sha256Hex,
  stableStringify,
}
