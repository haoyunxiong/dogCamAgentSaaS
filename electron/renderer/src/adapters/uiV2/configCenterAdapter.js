import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'
import { getDepositSettings } from '../../services/depositSettingsService.js'

const LOCAL_SETTINGS_KEY = 'ui-v2-config-center-settings'
const LOCAL_RUNTIME_CONFIG_KEY = 'ui-v2-runtime-config-draft'

const DEFAULT_LOCAL_SETTINGS = Object.freeze({
  storeName: '小狗相机租赁',
  storeCode: 'LOCAL-DEMO',
  storeType: 'camera-rental',
  region: 'local-demo',
  contactName: '运营负责人',
  contactPhone: '',
  email: '',
  businessOpen: true,
  weekendOpen: true,
  openAt: '09:30',
  closeAt: '21:30',
  defaultStoreId: 'local-demo-store',
})

const LOCAL_STORES = Object.freeze([
  {
    id: 'local-demo-store',
    code: 'LOCAL-DEMO',
    name: '小狗相机租赁',
    status: 'active',
    isDefault: true,
  },
])

const EXTERNAL_CREDENTIAL_STATUS = Object.freeze([
  { provider: 'sf_express', label: '顺丰', configuredCount: 0, totalCount: 5, mode: 'status-only', valueReturned: false, items: [] },
  { provider: 'deposit_service', label: '免押', configuredCount: 0, totalCount: 5, mode: 'status-only', valueReturned: false, items: [] },
  { provider: 'xianyu_platform', label: '闲鱼/闲管家', configuredCount: 0, totalCount: 6, mode: 'status-only', valueReturned: false, items: [] },
  { provider: 'feishu', label: '飞书', configuredCount: 0, totalCount: 5, mode: 'status-only', valueReturned: false, items: [] },
])

const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  LOGISTICS_QUERY_ENABLED: 'False',
  LOGISTICS_QUERY_API: '',
  LOGISTICS_QUERY_TOKEN: '',
  SF_OPEN_ENABLED: 'False',
  SF_APP_ID: '',
  SF_APP_KEY: '',
  SF_TOKEN_API: 'https://bspgw.sf-express.com/oauth2/accessToken',
  SF_PREORDER_API: 'https://bspgw.sf-express.com/std/service',
  SF_SENDER_PROVINCE: '四川省',
  SF_SENDER_CITY: '成都市',
  SF_SENDER_DISTRICT: '',
  SF_SENDER_ADDRESS: '',
  SF_SENDER_MOBILE: '',
  SF_SENDER_CONTACT: '',
  SF_MONTHLY_CARD: '',
  SF_CARGO_NAME: '租赁设备',
  SF_STANDARD_EXPRESS_TYPE_ID: '2',
  SF_HALF_DAY_EXPRESS_TYPE_ID: '263',
  SF_INTRACITY_API: '',
  SF_INTRACITY_COMPANY_CODE: '',
  SF_INTRACITY_ACCESS_CODE: '',
  SF_INTRACITY_CHECKWORD: '',
  SF_INTRACITY_PROJECT_CODE: '',
  SF_INTRACITY_SHOP_ID: '',
  SF_INTRACITY_SHOP_TYPE: '2',
  SF_SICHUAN_SPECIAL_REGIONS: '甘孜,阿坝',
  SF_DEFAULT_SEND_HOUR: '12',
  SF_SPECIAL_SEND_HOUR: '18',
  DEPOSIT_API_MODE: 'mock',
  DEPOSIT_BASE_URL: '',
  DEPOSIT_APP_ID: '',
  DEPOSIT_APP_SECRET: '',
  DEPOSIT_USER_EID: '',
  DEPOSIT_NOTIFY_URL: '',
  DEPOSIT_TIMEOUT_MS: '10000',
  DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT: '',
  DEPOSIT_RECEIVING_INFO_FALLBACK: '待补充',
})
const SENSITIVE_RUNTIME_KEY_PATTERN = /(TOKEN|SECRET|KEY|CARD|MOBILE|PHONE|CONTACT|ADDRESS|EID|APP_ID|CHECKWORD)/i

function getBridge() {
  if (isUiV2PreviewMode()) return null
  if (!hasUiV2RuntimeBridge()) return null
  return window.electronAPI?.configCenter || null
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function readLocalSettings() {
  try {
    const raw = window.localStorage.getItem(LOCAL_SETTINGS_KEY)
    if (!raw) return cloneJson(DEFAULT_LOCAL_SETTINGS)
    return {
      ...cloneJson(DEFAULT_LOCAL_SETTINGS),
      ...JSON.parse(raw),
    }
  } catch {
    return cloneJson(DEFAULT_LOCAL_SETTINGS)
  }
}

function normalizeRuntimeConfig(config = {}) {
  return {
    ...cloneJson(DEFAULT_RUNTIME_CONFIG),
    ...Object.fromEntries(Object.entries(config || {}).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)])),
  }
}

function normalizeRuntimePayload(config = {}) {
  return Object.fromEntries(Object.entries(config || {}).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]))
}

function redactRuntimeConfig(config = {}) {
  const normalized = normalizeRuntimeConfig(config)
  return Object.fromEntries(Object.entries(normalized).map(([key, value]) => {
    if (!SENSITIVE_RUNTIME_KEY_PATTERN.test(key)) return [key, value]
    return [key, value ? '<configured>' : '']
  }))
}

function fillIfEmpty(target, key, value) {
  if (target[key]) return
  if (value === null || value === undefined || value === '') return
  target[key] = String(value)
}

function mergeLegacyDepositSettings(config = {}) {
  const nextConfig = normalizeRuntimeConfig(config)
  try {
    const legacyDeposit = getDepositSettings()
    const api = legacyDeposit?.api || {}
    fillIfEmpty(nextConfig, 'DEPOSIT_API_MODE', api.mode)
    fillIfEmpty(nextConfig, 'DEPOSIT_BASE_URL', api.baseUrl)
    fillIfEmpty(nextConfig, 'DEPOSIT_USER_EID', api.userEid)
    fillIfEmpty(nextConfig, 'DEPOSIT_NOTIFY_URL', api.notifyUrl)
    fillIfEmpty(nextConfig, 'DEPOSIT_TIMEOUT_MS', api.timeoutMs)
    fillIfEmpty(nextConfig, 'DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT', api.contractSupplementaryContent)
    fillIfEmpty(nextConfig, 'DEPOSIT_RECEIVING_INFO_FALLBACK', api.receivingInfoFallback)
  } catch {
    // Legacy localStorage deposit settings are optional.
  }
  return nextConfig
}

function readLocalRuntimeConfig() {
  try {
    const raw = window.localStorage.getItem(LOCAL_RUNTIME_CONFIG_KEY)
    if (!raw) return cloneJson(DEFAULT_RUNTIME_CONFIG)
    return normalizeRuntimeConfig(JSON.parse(raw))
  } catch {
    return cloneJson(DEFAULT_RUNTIME_CONFIG)
  }
}

function saveLocalRuntimeConfig(config = {}) {
  const nextConfig = normalizeRuntimeConfig({
    ...readLocalRuntimeConfig(),
    ...config,
  })
  try {
    window.localStorage.setItem(LOCAL_RUNTIME_CONFIG_KEY, JSON.stringify(nextConfig))
  } catch {
    // localStorage is optional in renderer preview.
  }
  return nextConfig
}

function saveLocalSettings(settings = {}) {
  const nextSettings = {
    ...cloneJson(DEFAULT_LOCAL_SETTINGS),
    ...settings,
    contactPhone: settings.contactPhone || '',
  }
  try {
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(nextSettings))
  } catch {
    // localStorage is optional in renderer preview.
  }
  return nextSettings
}

function buildLocalOverview(settings = readLocalSettings()) {
  return {
    ok: true,
    source: 'localStorage',
    mode: 'renderer-fallback',
    redaction: {
      sensitiveValuesReturned: false,
      rule: 'status-only',
    },
    stores: {
      count: 1,
      items: [
        {
          ...cloneJson(LOCAL_STORES[0]),
          name: settings.storeName || DEFAULT_LOCAL_SETTINGS.storeName,
          status: settings.businessOpen ? 'active' : 'inactive',
        },
      ],
    },
    config: {
      totalCount: 0,
      nonSensitiveCount: 0,
      sensitiveCount: 0,
      sensitiveConfiguredCount: 0,
    },
    externalCredentials: cloneJson(EXTERNAL_CREDENTIAL_STATUS),
    externalGateway: {
      realEnabled: false,
      externalWritesEnabled: false,
      mode: 'preview-only',
    },
    relatedData: {
      depositExemptionRules: { ok: false, count: 0, reason: 'renderer-fallback' },
      sfShipments: { ok: false, count: 0, reason: 'renderer-fallback' },
      sfShipmentEvents: { ok: false, count: 0, reason: 'renderer-fallback' },
    },
    warnings: [
      '当前为浏览器预览 fallback，未访问 Electron IPC 或本地 MySQL。',
      '敏感凭证只展示状态，不返回明文。',
    ],
  }
}

async function getOverview() {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.getOverview === 'function') {
      const result = await bridge.getOverview()
      if (result && typeof result === 'object') return result
    }
    return buildLocalOverview()
  } catch (error) {
    return {
      ...buildLocalOverview(),
      ok: false,
      code: 'CONFIG_CENTER_OVERVIEW_ERROR',
      message: error?.message || '配置中心概览读取失败，已降级为本地预览。',
    }
  }
}

async function getStoreSettings() {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.getStoreSettings === 'function') {
      const result = await bridge.getStoreSettings()
      if (result && typeof result === 'object' && result.ok) return result
    }

    const settings = readLocalSettings()
    return {
      ok: true,
      source: 'localStorage',
      mode: 'renderer-fallback',
      settings,
      store: {
        ...cloneJson(LOCAL_STORES[0]),
        name: settings.storeName,
        status: settings.businessOpen ? 'active' : 'inactive',
      },
      stores: [
        {
          ...cloneJson(LOCAL_STORES[0]),
          name: settings.storeName,
          status: settings.businessOpen ? 'active' : 'inactive',
        },
      ],
      config: {
        totalCount: 0,
        nonSensitiveCount: 0,
        sensitiveCount: 0,
        sensitiveConfiguredCount: 0,
      },
      warnings: [
        '浏览器预览环境使用 localStorage fallback。',
        '敏感凭证未读取、未返回、未写入。',
      ],
    }
  } catch (error) {
    return {
      ok: false,
      source: 'localStorage',
      mode: 'renderer-fallback',
      code: 'CONFIG_CENTER_SETTINGS_ERROR',
      message: error?.message || '配置中心设置读取失败。',
      settings: cloneJson(DEFAULT_LOCAL_SETTINGS),
      store: null,
      stores: [],
      warnings: ['读取失败时不会执行写入。'],
    }
  }
}

async function saveStoreSettings(payload = {}) {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.saveStoreSettings === 'function') {
      const result = await bridge.saveStoreSettings(payload || {})
      if (result && typeof result === 'object') return result
    }

    const settings = saveLocalSettings(payload || {})
    return {
      ok: true,
      source: 'localStorage',
      persisted: 'localStorage',
      mode: 'renderer-fallback',
      settings,
      stores: [
        {
          ...cloneJson(LOCAL_STORES[0]),
          name: settings.storeName,
          status: settings.businessOpen ? 'active' : 'inactive',
        },
      ],
      redaction: {
        contactPhoneSavedAs: 'display-only',
        sensitiveValuesReturned: false,
      },
      warnings: [
        '浏览器预览环境保存到 localStorage。',
        '未访问 Electron IPC、未写 MySQL、未写敏感凭证。',
      ],
    }
  } catch (error) {
    return {
      ok: false,
      source: 'localStorage',
      persisted: false,
      code: 'CONFIG_CENTER_SAVE_ERROR',
      message: error?.message || '配置中心保存失败，未执行危险写入。',
      redaction: {
        sensitiveValuesReturned: false,
      },
    }
  }
}

async function getRuntimeConfig() {
  try {
    if (!isUiV2PreviewMode() && hasUiV2RuntimeBridge() && typeof window.electronAPI?.getConfig === 'function') {
      const result = await window.electronAPI.getConfig()
      return {
        ok: true,
        source: 'mysql-config',
        mode: 'legacy-runtime-config',
        config: redactRuntimeConfig(mergeLegacyDepositSettings(result || {})),
        sensitiveValuesReturned: false,
        warnings: [
          'UI-V2 正在复用历史配置中心 getConfig；免押本地旧配置会在 MySQL 字段为空时作为兼容 fallback。',
          '敏感配置已脱敏为已配置/未配置状态，不返回原文。',
        ],
      }
    }

    return {
      ok: true,
      source: 'localStorage',
      mode: 'renderer-fallback',
      config: redactRuntimeConfig(readLocalRuntimeConfig()),
      sensitiveValuesReturned: false,
      warnings: [
        '浏览器预览环境使用 localStorage draft，不访问 Electron IPC 或本地 MySQL，敏感配置已脱敏。',
      ],
    }
  } catch (error) {
    return {
      ok: false,
      source: 'mysql-config',
      mode: 'legacy-runtime-config',
      code: 'RUNTIME_CONFIG_READ_ERROR',
      message: error?.message || '运行配置读取失败。',
      config: cloneJson(DEFAULT_RUNTIME_CONFIG),
      sensitiveValuesReturned: false,
    }
  }
}

async function saveRuntimeConfig(payload = {}) {
  try {
    const safePayload = normalizeRuntimePayload(payload || {})
    if (!isUiV2PreviewMode() && hasUiV2RuntimeBridge() && typeof window.electronAPI?.saveConfig === 'function') {
      await window.electronAPI.saveConfig(safePayload)
      return {
        ok: true,
        source: 'mysql-config',
        persisted: 'mysql-config',
        mode: 'legacy-runtime-config',
        savedKeys: Object.keys(safePayload),
        sensitiveValuesReturned: false,
        warnings: [
          '已复用历史配置中心保存配置；本操作只保存配置，不调用外部接口。',
        ],
      }
    }

    const config = saveLocalRuntimeConfig(safePayload)
    return {
      ok: true,
      source: 'localStorage',
      persisted: 'localStorage',
      mode: 'renderer-fallback',
      config,
      savedKeys: Object.keys(safePayload),
      sensitiveValuesReturned: false,
      warnings: [
        '浏览器预览环境保存到 localStorage draft，未写 MySQL。',
      ],
    }
  } catch (error) {
    return {
      ok: false,
      source: 'mysql-config',
      persisted: false,
      code: 'RUNTIME_CONFIG_SAVE_ERROR',
      message: error?.message || '运行配置保存失败。',
      sensitiveValuesReturned: false,
    }
  }
}

async function getExternalConfigStatus() {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.getExternalConfigStatus === 'function') {
      const result = await bridge.getExternalConfigStatus()
      if (result && typeof result === 'object') return result
    }
    return {
      ok: true,
      source: 'localStorage',
      mode: 'renderer-fallback',
      warning: '当前无 Electron bridge，仅显示浏览器预览配置草稿；未访问本地 MySQL。',
      sensitiveValuesReturned: false,
      groups: [],
    }
  } catch (error) {
    return {
      ok: false,
      message: error?.message || '外部配置状态读取失败。',
      groups: [],
      sensitiveValuesReturned: false,
    }
  }
}

async function saveExternalConfig(payload = {}) {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.saveExternalConfig === 'function') {
      return await bridge.saveExternalConfig(payload || {})
    }
    return {
      ok: false,
      source: 'localStorage',
      code: 'NO_ELECTRON_BRIDGE',
      message: '当前无 Electron bridge，未写入本地 MySQL。',
      sensitiveValuesReturned: false,
    }
  } catch (error) {
    return {
      ok: false,
      message: error?.message || '外部配置保存失败。',
      sensitiveValuesReturned: false,
    }
  }
}

async function validateExternalConfig(payload = {}) {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.validateExternalConfig === 'function') {
      return await bridge.validateExternalConfig(payload || {})
    }
    return { ok: false, message: '当前无 Electron bridge，无法校验本地 MySQL 配置。', sensitiveValuesReturned: false }
  } catch (error) {
    return { ok: false, message: error?.message || '配置校验失败。', sensitiveValuesReturned: false }
  }
}

async function previewSfTransit(payload = {}) {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.previewSfTransit === 'function') {
      return await bridge.previewSfTransit(payload || {})
    }
    return { ok: false, message: '当前无 Electron bridge，无法手动触发顺丰时效测试。', externalRequestSent: false, sensitiveValuesReturned: false }
  } catch (error) {
    return { ok: false, message: error?.message || '顺丰时效测试失败。', externalRequestSent: false, sensitiveValuesReturned: false }
  }
}

async function testDepositConnection(payload = {}) {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.testDepositConnection === 'function') {
      return await bridge.testDepositConnection(payload || {})
    }
    return { ok: false, message: '当前无 Electron bridge，无法校验免押接口配置。', externalRequestSent: false, sensitiveValuesReturned: false }
  } catch (error) {
    return { ok: false, message: error?.message || '免押连接测试失败。', externalRequestSent: false, sensitiveValuesReturned: false }
  }
}

async function getXianyuConfigStatus(payload = {}) {
  try {
    const bridge = getBridge()
    if (bridge && typeof bridge.getXianyuConfigStatus === 'function') {
      return await bridge.getXianyuConfigStatus(payload || {})
    }
    return { ok: false, status: '未配置', message: '当前无 Electron bridge，无法读取闲鱼/闲管家配置状态。', externalRequestSent: false, sensitiveValuesReturned: false }
  } catch (error) {
    return { ok: false, status: '未知', message: error?.message || '闲鱼/闲管家状态读取失败。', externalRequestSent: false, sensitiveValuesReturned: false }
  }
}

export const configCenterAdapter = {
  getOverview,
  getStoreSettings,
  saveStoreSettings,
  getRuntimeConfig,
  saveRuntimeConfig,
  getExternalConfigStatus,
  saveExternalConfig,
  validateExternalConfig,
  previewSfTransit,
  testDepositConnection,
  getXianyuConfigStatus,
}
