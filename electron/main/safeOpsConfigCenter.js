const mysqlAdapter = require('./mysqlAdapter')

const SENSITIVE_KEY_PATTERNS = [
  'TOKEN',
  'SECRET',
  'KEY',
  'COOKIE',
  'PASSWORD',
  'WEBHOOK',
  'APP_KEY',
  'APP_SECRET',
  'ACCESS',
  'AUTH',
  'SESSION',
  'CARD',
  'PHONE',
  'SENDER',
  'IDCARD'
]

const NON_SENSITIVE_CONFIG_KEYS = Object.freeze({
  storeType: 'SAFE_SETTINGS_STORE_TYPE',
  region: 'SAFE_SETTINGS_REGION',
  contactName: 'SAFE_SETTINGS_CONTACT_NAME',
  contactMasked: 'SAFE_SETTINGS_CONTACT_MASKED',
  email: 'SAFE_SETTINGS_EMAIL',
  businessOpen: 'SAFE_SETTINGS_BUSINESS_OPEN',
  weekendOpen: 'SAFE_SETTINGS_WEEKEND_OPEN',
  openAt: 'SAFE_SETTINGS_OPEN_AT',
  closeAt: 'SAFE_SETTINGS_CLOSE_AT',
  defaultStoreId: 'SAFE_SETTINGS_DEFAULT_STORE_ID'
})

const DEFAULT_SETTINGS = Object.freeze({
  storeName: '小狗相机租赁',
  storeCode: '',
  storeType: 'camera-rental',
  region: 'local-demo',
  contactName: '运营负责人',
  contactPhone: '',
  email: '',
  businessOpen: true,
  weekendOpen: true,
  openAt: '09:30',
  closeAt: '21:30',
  defaultStoreId: ''
})

const EXTERNAL_CREDENTIAL_GROUPS = Object.freeze([
  {
    provider: 'sf_express',
    label: '顺丰',
    items: [
      { key: 'SF_APP_ID', label: 'AppId' },
      { key: 'SF_APP_KEY', label: 'AppKey' },
      { key: 'SF_TOKEN_API', label: 'Token 接口' },
      { key: 'SF_PREORDER_API', label: '预下单接口' },
      { key: 'SF_MONTHLY_CARD', label: '月结卡' }
    ]
  },
  {
    provider: 'deposit_service',
    label: '免押',
    items: [
      { key: 'DEPOSIT_BASE_URL', label: '服务地址' },
      { key: 'DEPOSIT_APP_ID', label: 'AppId' },
      { key: 'DEPOSIT_APP_SECRET', label: 'AppSecret' },
      { key: 'DEPOSIT_USER_EID', label: 'UserEid' },
      { key: 'DEPOSIT_NOTIFY_URL', label: '回调地址' }
    ]
  },
  {
    provider: 'xianyu_platform',
    label: '闲鱼/闲管家',
    items: [
      { key: 'xgj_appid', label: 'AppId' },
      { key: 'xgj_app_secret', label: 'AppSecret' },
      { key: 'xgj_base_url', label: '服务地址' },
      { key: 'xgj_seller_id', label: 'SellerId' },
      { key: 'xgj_sign_mode', label: '签名模式' },
      { key: 'COOKIES_STR', label: 'Cookie/Session' }
    ]
  },
  {
    provider: 'feishu',
    label: '飞书',
    items: [
      { key: 'FEISHU_WEBHOOK_ORDER', label: '订单 Webhook' },
      { key: 'FEISHU_WEBHOOK_SALES', label: '销售 Webhook' },
      { key: 'FEISHU_APP_ID', label: 'AppId' },
      { key: 'FEISHU_APP_SECRET', label: 'AppSecret' },
      { key: 'FEISHU_VERIFICATION_TOKEN', label: 'Verification Token' }
    ]
  }
])

function isSensitiveConfigKey(key) {
  const normalized = String(key || '').toUpperCase()
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern))
}

function safeError(error) {
  return {
    message: error?.message || String(error || 'unknown error'),
    code: error?.code || 'CONFIG_CENTER_ERROR'
  }
}

function normalizeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value).trim()
}

function normalizeBool(value, fallback = false) {
  if (value === true || value === false) return value
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'open', 'active'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'closed', 'inactive'].includes(normalized)) return false
  return fallback
}

function maskPhoneDisplay(value) {
  const raw = normalizeString(value)
  if (!raw) return ''
  if (raw.includes('*')) return raw.replace(/[0-9]/g, 'x')
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7) return '<masked>'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function configRowsToMap(rows = []) {
  const map = new Map()
  rows.forEach((row) => {
    map.set(String(row.key || ''), {
      value: row.value === null || row.value === undefined ? '' : String(row.value),
      updatedAt: row.updatedAt || row.updated_at || null
    })
  })
  return map
}

function getConfigValue(configMap, key, fallback = '') {
  if (!configMap.has(key)) return fallback
  return configMap.get(key).value
}

function safeConfigStats(rows = []) {
  const totalCount = rows.length
  const sensitiveRows = rows.filter((row) => isSensitiveConfigKey(row.key))
  return {
    totalCount,
    nonSensitiveCount: totalCount - sensitiveRows.length,
    sensitiveCount: sensitiveRows.length,
    sensitiveConfiguredCount: sensitiveRows.filter((row) => normalizeString(row.value)).length
  }
}

async function tableCount(tableName) {
  try {
    const row = await mysqlAdapter.get(`SELECT COUNT(*) AS count FROM \`${tableName}\``)
    return {
      table: tableName,
      ok: true,
      count: Number(row?.count || 0)
    }
  } catch (error) {
    return {
      table: tableName,
      ok: false,
      count: 0,
      error: safeError(error).message
    }
  }
}

async function readStores() {
  const rows = await mysqlAdapter.all(`
    SELECT
      id,
      code,
      name,
      status,
      is_default AS isDefault,
      sort_order AS sortOrder,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM stores
    ORDER BY is_default DESC, sort_order ASC, id ASC
  `)

  return rows.map((row) => ({
    id: row.id,
    code: row.code || '',
    name: row.name || '',
    status: row.status || 'active',
    isDefault: Boolean(row.isDefault),
    sortOrder: Number(row.sortOrder || 0),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null
  }))
}

async function readConfigRows() {
  const rows = await mysqlAdapter.all(`
    SELECT \`key\`, \`value\`, updated_at AS updatedAt
    FROM config
    ORDER BY \`key\` ASC
  `)
  return rows.map((row) => ({
    key: row.key || '',
    value: row.value === null || row.value === undefined ? '' : String(row.value),
    updatedAt: row.updatedAt || null
  }))
}

function buildCredentialStatus(configMap) {
  return EXTERNAL_CREDENTIAL_GROUPS.map((group) => {
    const items = group.items.map((item) => {
      const configured = normalizeString(getConfigValue(configMap, item.key))
      return {
        key: item.key,
        label: item.label,
        configured: Boolean(configured),
        status: configured ? 'configured' : 'missing',
        sensitive: isSensitiveConfigKey(item.key),
        valueReturned: false
      }
    })

    return {
      provider: group.provider,
      label: group.label,
      configuredCount: items.filter((item) => item.configured).length,
      totalCount: items.length,
      mode: 'status-only',
      valueReturned: false,
      items
    }
  })
}

function chooseDefaultStore(stores, configMap) {
  const configuredDefaultStoreId = getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.defaultStoreId)
  if (configuredDefaultStoreId) {
    const configuredStore = stores.find((store) => String(store.id) === String(configuredDefaultStoreId))
    if (configuredStore) return configuredStore
  }
  return stores.find((store) => store.isDefault) || stores[0] || null
}

function buildSettings(stores, configMap) {
  const store = chooseDefaultStore(stores, configMap)
  const businessOpenFallback = store ? String(store.status || '').toLowerCase() === 'active' : DEFAULT_SETTINGS.businessOpen

  return {
    ...DEFAULT_SETTINGS,
    storeName: store?.name || DEFAULT_SETTINGS.storeName,
    storeCode: store?.code || DEFAULT_SETTINGS.storeCode,
    defaultStoreId: store?.id ? String(store.id) : '',
    storeType: getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.storeType, DEFAULT_SETTINGS.storeType),
    region: getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.region, DEFAULT_SETTINGS.region),
    contactName: getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.contactName, DEFAULT_SETTINGS.contactName),
    contactPhone: maskPhoneDisplay(getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.contactMasked, DEFAULT_SETTINGS.contactPhone)),
    email: getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.email, DEFAULT_SETTINGS.email),
    businessOpen: normalizeBool(
      getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.businessOpen, businessOpenFallback ? 'true' : 'false'),
      businessOpenFallback
    ),
    weekendOpen: normalizeBool(
      getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.weekendOpen, DEFAULT_SETTINGS.weekendOpen ? 'true' : 'false'),
      DEFAULT_SETTINGS.weekendOpen
    ),
    openAt: getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.openAt, DEFAULT_SETTINGS.openAt),
    closeAt: getConfigValue(configMap, NON_SENSITIVE_CONFIG_KEYS.closeAt, DEFAULT_SETTINGS.closeAt)
  }
}

async function getConfigOverview() {
  try {
    const [stores, configRows, depositRules, sfShipments, sfEvents] = await Promise.all([
      readStores(),
      readConfigRows(),
      tableCount('deposit_exemption_rules'),
      tableCount('sf_shipments'),
      tableCount('sf_shipment_events')
    ])
    const configMap = configRowsToMap(configRows)
    const credentials = buildCredentialStatus(configMap)

    return {
      ok: true,
      source: 'mysql',
      mode: 'local-config-center',
      redaction: {
        sensitiveValuesReturned: false,
        rule: 'status-only'
      },
      stores: {
        count: stores.length,
        items: stores
      },
      config: safeConfigStats(configRows),
      externalCredentials: credentials,
      externalGateway: {
        realEnabled: false,
        externalWritesEnabled: false,
        mode: 'preview-only'
      },
      relatedData: {
        depositExemptionRules: depositRules,
        sfShipments,
        sfShipmentEvents: sfEvents
      },
      nextSteps: [
        '敏感凭证接入前必须进入 CredentialService 或等价加密存储',
        '外部接口仍保持 mock/sandbox preview，real execute disabled',
        '商户配置后续需要 merchant/store isolation'
      ]
    }
  } catch (error) {
    return {
      ok: false,
      source: 'mysql',
      mode: 'local-config-center',
      code: safeError(error).code,
      message: safeError(error).message,
      redaction: {
        sensitiveValuesReturned: false,
        rule: 'status-only'
      },
      stores: { count: 0, items: [] },
      config: { totalCount: 0, nonSensitiveCount: 0, sensitiveCount: 0, sensitiveConfiguredCount: 0 },
      externalCredentials: [],
      externalGateway: {
        realEnabled: false,
        externalWritesEnabled: false,
        mode: 'preview-only'
      }
    }
  }
}

async function getStoreSettings() {
  try {
    const [stores, configRows] = await Promise.all([readStores(), readConfigRows()])
    const configMap = configRowsToMap(configRows)
    const store = chooseDefaultStore(stores, configMap)

    return {
      ok: true,
      source: 'mysql',
      mode: 'non-sensitive-settings',
      settings: buildSettings(stores, configMap),
      store,
      stores,
      config: safeConfigStats(configRows),
      warnings: [
        'stores 表保存门店名称、营业状态、默认门店；门店类型、区域、联系人等保存到非敏感 config key。',
        '敏感凭证不会读取明文、不会返回到 renderer、不会通过本接口写入。'
      ]
    }
  } catch (error) {
    return {
      ok: false,
      source: 'mysql',
      mode: 'non-sensitive-settings',
      code: safeError(error).code,
      message: safeError(error).message,
      settings: { ...DEFAULT_SETTINGS },
      store: null,
      stores: [],
      config: { totalCount: 0, nonSensitiveCount: 0, sensitiveCount: 0, sensitiveConfiguredCount: 0 },
      warnings: ['本地 MySQL 配置中心不可用，renderer 可回退 localStorage。']
    }
  }
}

function validateUnsafeConfigPayload(payload) {
  const config = payload?.config
  if (!config || typeof config !== 'object') return null

  const allowed = new Set(Object.values(NON_SENSITIVE_CONFIG_KEYS))
  const rejected = Object.keys(config).filter((key) => isSensitiveConfigKey(key) || !allowed.has(key))
  if (!rejected.length) return null
  return {
    ok: false,
    code: 'CONFIG_CENTER_SENSITIVE_OR_UNSUPPORTED_KEY',
    message: '配置中心拒绝写入敏感或未授权配置 key。',
    rejectedKeys: rejected.map((key) => ({
      key,
      sensitive: isSensitiveConfigKey(key)
    }))
  }
}

function buildSafeConfigWrites(payload) {
  const writes = [
    [NON_SENSITIVE_CONFIG_KEYS.storeType, normalizeString(payload.storeType, DEFAULT_SETTINGS.storeType)],
    [NON_SENSITIVE_CONFIG_KEYS.region, normalizeString(payload.region, DEFAULT_SETTINGS.region)],
    [NON_SENSITIVE_CONFIG_KEYS.contactName, normalizeString(payload.contactName, DEFAULT_SETTINGS.contactName)],
    [NON_SENSITIVE_CONFIG_KEYS.contactMasked, maskPhoneDisplay(payload.contactPhone)],
    [NON_SENSITIVE_CONFIG_KEYS.email, normalizeString(payload.email, DEFAULT_SETTINGS.email)],
    [NON_SENSITIVE_CONFIG_KEYS.businessOpen, normalizeBool(payload.businessOpen, DEFAULT_SETTINGS.businessOpen) ? 'true' : 'false'],
    [NON_SENSITIVE_CONFIG_KEYS.weekendOpen, normalizeBool(payload.weekendOpen, DEFAULT_SETTINGS.weekendOpen) ? 'true' : 'false'],
    [NON_SENSITIVE_CONFIG_KEYS.openAt, normalizeString(payload.openAt, DEFAULT_SETTINGS.openAt)],
    [NON_SENSITIVE_CONFIG_KEYS.closeAt, normalizeString(payload.closeAt, DEFAULT_SETTINGS.closeAt)]
  ]

  const defaultStoreId = normalizeString(payload.defaultStoreId)
  if (defaultStoreId) {
    writes.push([NON_SENSITIVE_CONFIG_KEYS.defaultStoreId, defaultStoreId])
  }

  return writes
}

async function saveNonSensitiveStoreSettings(payload = {}) {
  const rejectedConfig = validateUnsafeConfigPayload(payload)
  if (rejectedConfig) return rejectedConfig

  try {
    const defaultStoreId = normalizeString(payload.defaultStoreId)
    const storeName = normalizeString(payload.storeName)
    const businessOpen = normalizeBool(payload.businessOpen, DEFAULT_SETTINGS.businessOpen)
    const safeConfigWrites = buildSafeConfigWrites(payload)

    const result = await mysqlAdapter.transaction(async (conn) => {
      const stores = await conn.all('SELECT id FROM stores ORDER BY is_default DESC, sort_order ASC, id ASC')
      const targetStoreId = defaultStoreId || (stores[0]?.id ? String(stores[0].id) : '')
      const storeFields = []

      if (targetStoreId) {
        await conn.run('UPDATE stores SET is_default = 0')
        await conn.run(
          'UPDATE stores SET name = ?, status = ?, is_default = 1, updated_at = NOW() WHERE id = ?',
          [storeName || DEFAULT_SETTINGS.storeName, businessOpen ? 'active' : 'inactive', targetStoreId]
        )
        storeFields.push('name', 'status', 'is_default')
      }

      for (const [key, value] of safeConfigWrites) {
        if (isSensitiveConfigKey(key)) {
          throw new Error(`Refusing to write sensitive config key: ${key}`)
        }
        await conn.run(
          'INSERT INTO config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), updated_at = NOW()',
          [key, value]
        )
      }

      return {
        targetStoreId,
        savedStoreFields: storeFields,
        savedConfigKeys: safeConfigWrites.map(([key]) => key)
      }
    })

    const storeSettings = await getStoreSettings()

    return {
      ok: true,
      source: 'mysql',
      persisted: 'mysql',
      mode: 'non-sensitive-settings',
      savedStoreFields: result.savedStoreFields,
      savedConfigKeys: result.savedConfigKeys,
      settings: storeSettings.settings,
      stores: storeSettings.stores,
      redaction: {
        contactPhoneSavedAs: 'masked',
        sensitiveValuesReturned: false
      },
      warnings: [
        '仅保存非敏感设置；敏感凭证未读取、未返回、未写入。',
        '联系电话只保存脱敏展示值。'
      ]
    }
  } catch (error) {
    return {
      ok: false,
      source: 'mysql',
      persisted: false,
      code: safeError(error).code,
      message: safeError(error).message,
      redaction: {
        sensitiveValuesReturned: false
      }
    }
  }
}

module.exports = {
  SENSITIVE_KEY_PATTERNS,
  NON_SENSITIVE_CONFIG_KEYS,
  isSensitiveConfigKey,
  getConfigOverview,
  getStoreSettings,
  saveNonSensitiveStoreSettings
}
