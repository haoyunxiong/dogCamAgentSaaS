const mysqlAdapter = require('./mysqlAdapter')
const { estimateShippingWithSf } = require('./dbManager')
const { persistSafeOperationContext } = require('./safeOpsPersistence')

const SENSITIVE_KEY_PATTERN = /(TOKEN|SECRET|KEY|COOKIE|PASSWORD|WEBHOOK|APP_KEY|APP_SECRET|ACCESS|AUTH|SESSION|CARD|PHONE|SENDER|IDCARD)/i

const LOCAL_TEST_WARNING = '当前为本地测试配置，生产环境需迁移到加密凭证存储。'

const FIELD_GROUPS = Object.freeze({
  sf: {
    provider: 'sf_express',
    title: '物流与顺丰',
    modeKeys: ['SF_REAL_ORDER_ENABLED'],
    fields: [
      { key: 'SF_APP_ID', label: '顺丰 App ID', required: true },
      { key: 'SF_APP_KEY', label: '顺丰 App Key', required: true },
      { key: 'SF_TOKEN_API', label: 'Token 接口地址', required: true },
      { key: 'SF_PREORDER_API', label: '预下单/下单接口地址', required: true },
      { key: 'SF_MONTHLY_CARD', label: '月结卡号', required: true },
      { key: 'SF_SENDER_CONTACT', label: '默认寄件人', required: true },
      { key: 'SF_SENDER_MOBILE', label: '默认寄件手机号', required: true },
      { key: 'SF_SENDER_PROVINCE', label: '默认寄件省份', required: true },
      { key: 'SF_SENDER_CITY', label: '默认寄件城市', required: true },
      { key: 'SF_SENDER_DISTRICT', label: '默认寄件区县', required: false },
      { key: 'SF_SENDER_ADDRESS', label: '默认详细发货地址', required: true },
      { key: 'SF_STANDARD_EXPRESS_TYPE_ID', label: '默认产品类型', required: false },
      { key: 'SF_INSURED_ENABLED', label: '保价设置', required: false },
      { key: 'SF_DEFAULT_STORE_ID', label: '发货门店', required: false },
      { key: 'SF_OPEN_ENABLED', label: '真实时效查询开关', required: false },
      { key: 'SF_REAL_ORDER_ENABLED', label: '真实下单开关', required: false },
    ],
  },
  deposit: {
    provider: 'deposit_service',
    title: '押金与免押',
    modeKeys: ['DEPOSIT_REAL_CREATE_ENABLED', 'DEPOSIT_REAL_FINISH_ENABLED'],
    fields: [
      { key: 'DEPOSIT_BASE_URL', label: '免押服务 Base URL', required: true },
      { key: 'DEPOSIT_APP_ID', label: 'App ID', required: true },
      { key: 'DEPOSIT_APP_SECRET', label: 'App Secret', required: true },
      { key: 'DEPOSIT_USER_EID', label: '商户用户标识', required: true },
      { key: 'DEPOSIT_NOTIFY_URL', label: '回调地址', required: false },
      { key: 'DEPOSIT_DEFAULT_RULE', label: '默认免押规则', required: false },
      { key: 'DEPOSIT_RISK_THRESHOLD', label: '风控阈值', required: false },
      { key: 'DEPOSIT_REAL_CREATE_ENABLED', label: '真实创建开关', required: false },
      { key: 'DEPOSIT_REAL_FINISH_ENABLED', label: '真实完结开关', required: false },
    ],
  },
  xianyu: {
    provider: 'xianyu_platform',
    title: '闲鱼/闲管家',
    modeKeys: ['XGJ_REAL_SYNC_ENABLED'],
    fields: [
      { key: 'xgj_appid', label: '闲管家 App ID', required: true },
      { key: 'xgj_app_secret', label: 'App Secret', required: true },
      { key: 'xgj_base_url', label: 'Base URL', required: true },
      { key: 'xgj_seller_id', label: 'Seller ID', required: true },
      { key: 'COOKIES_STR', label: 'Cookie / Session 状态', required: false },
      { key: 'xgj_sync_mode', label: '同步模式', required: false },
      { key: 'XGJ_REAL_SYNC_ENABLED', label: '真实同步开关', required: false },
    ],
  },
})

function nowIso() {
  return new Date().toISOString()
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function boolFromConfig(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase())
}

function boolToConfig(value) {
  return boolFromConfig(value) ? 'True' : 'False'
}

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERN.test(String(key || ''))
}

function redactValue(key, value) {
  const text = normalizeText(value)
  if (!text) return ''
  return isSensitiveKey(key) ? '<configured>' : text
}

function safeErrorMessage(error) {
  return String(error?.message || error || '未知错误')
    .replace(/(token|secret|key|cookie|password|session|phone|sender|card|idcard)=([^&\s]+)/ig, '$1=<redacted>')
}

async function readConfigMap() {
  const rows = await mysqlAdapter.all('SELECT `key`, `value`, updated_at FROM config')
  return new Map(rows.map((row) => [String(row.key), { value: String(row.value ?? ''), updatedAt: row.updated_at }]))
}

function getGroup(groupId) {
  const group = FIELD_GROUPS[groupId]
  if (!group) throw new Error(`未知配置模块：${groupId}`)
  return group
}

function getAllowedKeys(groupId) {
  return new Set(getGroup(groupId).fields.map((field) => field.key))
}

function buildFieldView(field, configMap) {
  const row = configMap.get(field.key)
  const value = row?.value || ''
  const sensitive = isSensitiveKey(field.key)
  return {
    ...field,
    sensitive,
    configured: Boolean(value),
    value: sensitive ? '' : value,
    displayValue: redactValue(field.key, value),
    updatedAt: row?.updatedAt || null,
  }
}

function buildGroupStatus(groupId, configMap) {
  const group = getGroup(groupId)
  const fields = group.fields.map((field) => buildFieldView(field, configMap))
  const requiredFields = fields.filter((field) => field.required)
  const configuredRequired = requiredFields.filter((field) => field.configured)
  const configuredFields = fields.filter((field) => field.configured)
  const realEnabled = group.modeKeys.some((key) => boolFromConfig(configMap.get(key)?.value))
  const readEnabled = groupId === 'sf' && boolFromConfig(configMap.get('SF_OPEN_ENABLED')?.value)
  const mode = configuredRequired.length === 0
    ? '未配置'
    : (realEnabled ? '真实调用已开启' : (readEnabled ? '测试模式' : '真实调用关闭'))
  const lastTestAt = configMap.get(`${group.provider.toUpperCase()}_LAST_TEST_AT`)?.value || ''
  const lastError = configMap.get(`${group.provider.toUpperCase()}_LAST_ERROR`)?.value || ''
  return {
    id: groupId,
    provider: group.provider,
    title: group.title,
    mode,
    completeness: {
      configured: configuredRequired.length,
      required: requiredFields.length,
      totalConfigured: configuredFields.length,
      total: fields.length,
      complete: requiredFields.length > 0 && configuredRequired.length === requiredFields.length,
    },
    lastTestAt,
    lastError,
    fields,
    warning: LOCAL_TEST_WARNING,
    sensitiveValuesReturned: false,
  }
}

async function auditExternalConfig({ operationType, actor, payload, status, impact }) {
  return persistSafeOperationContext({
    request: {
      operationType,
      actor: actor || {},
      target: { type: 'external_config', id: operationType },
      payload: payload || {},
    },
    policy: { domain: 'Settings', riskLevel: 'medium', allowWrite: true },
    impact: impact || {},
    mode: status === 'executed' ? 'write' : 'dry-run',
    status,
    issueConfirmToken: false,
  })
}

async function getExternalConfigStatus() {
  const configMap = await readConfigMap()
  return {
    ok: true,
    source: 'mysql-config',
    warning: LOCAL_TEST_WARNING,
    sensitiveValuesReturned: false,
    groups: Object.keys(FIELD_GROUPS).map((groupId) => buildGroupStatus(groupId, configMap)),
  }
}

async function saveExternalConfig({ groupId, values = {}, actor } = {}) {
  const group = getGroup(groupId)
  const allowedKeys = getAllowedKeys(groupId)
  const savedKeys = []
  const skippedSensitiveEmptyKeys = []
  const rejectedKeys = []

  for (const [key, rawValue] of Object.entries(values || {})) {
    if (!allowedKeys.has(key)) {
      rejectedKeys.push(key)
      continue
    }
    const sensitive = isSensitiveKey(key)
    const value = group.modeKeys.includes(key) ? boolToConfig(rawValue) : normalizeText(rawValue)
    if (sensitive && (!value || value === '<configured>')) {
      skippedSensitiveEmptyKeys.push(key)
      continue
    }
    await mysqlAdapter.run(`
      INSERT INTO config (\`key\`, \`value\`, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = NOW()
    `, [key, value])
    savedKeys.push(key)
  }

  await auditExternalConfig({
    operationType: `external_config.${group.provider}.save`,
    actor,
    status: savedKeys.length ? 'executed' : 'blocked',
    payload: {
      groupId,
      savedKeys,
      skippedSensitiveEmptyKeys,
      rejectedKeys,
      valuePreview: Object.fromEntries(savedKeys.map((key) => [key, isSensitiveKey(key) ? '<configured>' : '<saved>'])),
    },
    impact: {
      summary: `${group.title} 本地测试配置保存${savedKeys.length ? '完成' : '未写入'}；未调用外部接口。`,
      affectedRecords: savedKeys.map((key) => ({ type: 'config', id: key })),
      externalEffects: [],
    },
  })

  const configMap = await readConfigMap()
  return {
    ok: !rejectedKeys.length,
    message: rejectedKeys.length ? `存在不允许保存的配置项：${rejectedKeys.join(', ')}` : '配置已保存；未调用外部接口。',
    savedKeys,
    skippedSensitiveEmptyKeys,
    rejectedKeys,
    group: buildGroupStatus(groupId, configMap),
    warning: LOCAL_TEST_WARNING,
    sensitiveValuesReturned: false,
  }
}

function validateGroupConfig(groupId, configMap) {
  const group = getGroup(groupId)
  const fields = group.fields.map((field) => buildFieldView(field, configMap))
  const missing = fields.filter((field) => field.required && !field.configured)
  return {
    ok: missing.length === 0,
    provider: group.provider,
    title: group.title,
    missing: missing.map((field) => ({ key: field.key, label: field.label })),
    configuredRequired: fields.filter((field) => field.required && field.configured).length,
    required: fields.filter((field) => field.required).length,
  }
}

async function validateExternalConfig({ groupId, actor } = {}) {
  const configMap = await readConfigMap()
  const validation = validateGroupConfig(groupId, configMap)
  await auditExternalConfig({
    operationType: `external_config.${validation.provider}.validate`,
    actor,
    status: validation.ok ? 'previewed' : 'blocked',
    payload: { groupId, missing: validation.missing },
    impact: {
      summary: validation.ok ? `${validation.title} 配置必填项已满足。` : `${validation.title} 配置缺少必填项。`,
      affectedRecords: [],
      externalEffects: [],
    },
  })
  return {
    ok: validation.ok,
    message: validation.ok ? '配置校验通过；未调用外部接口。' : '配置不完整；未调用外部接口。',
    validation,
    warning: LOCAL_TEST_WARNING,
    sensitiveValuesReturned: false,
  }
}

async function previewSfTransit({ province, city, district, address, rentStartDate, shippingMode = 'land', actor } = {}) {
  const configMap = await readConfigMap()
  const validation = validateGroupConfig('sf', configMap)
  const sfReadEnabled = boolFromConfig(configMap.get('SF_OPEN_ENABLED')?.value)
  if (!validation.ok || !sfReadEnabled) {
    const message = !validation.ok ? '顺丰配置不完整，已阻断真实时效查询。' : '顺丰真实时效查询开关未开启，已阻断。'
    await auditExternalConfig({
      operationType: 'external_config.sf_express.transit_test',
      actor,
      status: 'blocked',
      payload: { province, city, district, rentStartDate, shippingMode, missing: validation.missing },
      impact: { summary: message, affectedRecords: [], externalEffects: [] },
    })
    return {
      ok: false,
      message,
      validation,
      externalRequestSent: false,
      sensitiveValuesReturned: false,
    }
  }

  let result
  try {
    result = await estimateShippingWithSf({
      province,
      city,
      district,
      address,
      rentStartDate,
      shippingMode,
      customerName: '',
      customerPhone: '',
      orderId: `sf-transit-test-${Date.now()}`,
    })
  } catch (error) {
    result = { ok: false, fallbackReason: safeErrorMessage(error) }
  }
  const ok = Boolean(result?.ok)
  const message = ok ? '顺丰真实时效查询完成。' : (result?.fallbackReason || '顺丰真实时效查询失败。')
  await mysqlAdapter.run(`
    INSERT INTO config (\`key\`, \`value\`, updated_at)
    VALUES (?, ?, NOW()), (?, ?, NOW())
    ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updated_at = NOW()
  `, ['SF_EXPRESS_LAST_TEST_AT', nowIso(), 'SF_EXPRESS_LAST_ERROR', ok ? '' : message])
  await auditExternalConfig({
    operationType: 'external_config.sf_express.transit_test',
    actor,
    status: ok ? 'previewed' : 'blocked',
    payload: { province, city, district, rentStartDate, shippingMode },
    impact: {
      summary: message,
      affectedRecords: [],
      externalEffects: [{ provider: 'sf_express', action: 'deliver_time_query', sent: true, ok }],
    },
  })
  return {
    ok,
    message,
    plan: ok ? {
      plannedShipAt: result.plannedShipAt || null,
      expectedArriveAt: result.expectedArriveAt || null,
      transitDays: result.transitDays || null,
      source: result.source || 'sf_deliver_time',
    } : null,
    error: ok ? '' : message,
    externalRequestSent: true,
    sensitiveValuesReturned: false,
  }
}

async function testDepositConnection({ actor } = {}) {
  const configMap = await readConfigMap()
  const validation = validateGroupConfig('deposit', configMap)
  const message = validation.ok
    ? '免押配置校验通过；当前未配置可用只读测试接口，未调用真实创建/完结。'
    : '免押配置不完整；未调用外部接口。'
  await auditExternalConfig({
    operationType: 'external_config.deposit_service.connection_test',
    actor,
    status: validation.ok ? 'previewed' : 'blocked',
    payload: { missing: validation.missing },
    impact: { summary: message, affectedRecords: [], externalEffects: [] },
  })
  return {
    ok: validation.ok,
    message,
    validation,
    externalRequestSent: false,
    sensitiveValuesReturned: false,
  }
}

async function getXianyuConfigStatus({ actor } = {}) {
  const configMap = await readConfigMap()
  const validation = validateGroupConfig('xianyu', configMap)
  const cookiePresent = Boolean(configMap.get('COOKIES_STR')?.value)
  const partialPresent = ['xgj_appid', 'xgj_app_secret', 'xgj_base_url', 'xgj_seller_id']
    .some((key) => Boolean(configMap.get(key)?.value))
  const status = cookiePresent
    ? (validation.ok ? '已配置' : '部分已配置')
    : (partialPresent ? '部分已配置' : '未配置')
  await auditExternalConfig({
    operationType: 'external_config.xianyu_platform.status_check',
    actor,
    status: validation.ok ? 'previewed' : 'blocked',
    payload: { status, cookiePresent },
    impact: { summary: `闲鱼/闲管家配置状态：${status}；未执行 Python，未调用外部接口。`, affectedRecords: [], externalEffects: [] },
  })
  return {
    ok: true,
    status,
    validation,
    cookieSessionStatus: cookiePresent ? '已配置' : '未配置',
    message: `闲鱼/闲管家配置状态：${status}；未执行 Python，未调用外部接口。`,
    externalRequestSent: false,
    sensitiveValuesReturned: false,
  }
}

module.exports = {
  FIELD_GROUPS,
  LOCAL_TEST_WARNING,
  getExternalConfigStatus,
  saveExternalConfig,
  testDepositConnection,
  getXianyuConfigStatus,
  previewSfTransit,
  validateExternalConfig,
}
