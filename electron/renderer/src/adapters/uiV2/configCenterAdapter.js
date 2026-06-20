import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'

const LOCAL_SETTINGS_KEY = 'ui-v2-config-center-settings'

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

export const configCenterAdapter = {
  getOverview,
  getStoreSettings,
  saveStoreSettings,
}
