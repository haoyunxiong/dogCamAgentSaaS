/**
 * 免押配置服务
 * 负责从 localStorage 读写用户自定义的免押接口和展示配置，
 * 并与 depositConfig.js 默认值合并。
 *
 * localStorage key: xianyu.depositSettings.v1
 * 注意：不要把真实 secret 写死到代码。
 * 本地保存仅用于测试；正式签名密钥不应保存在前端。
 */

import { depositApiConfig, depositDisplayConfig } from '../config/depositConfig.js'

const STORAGE_KEY = 'xianyu.depositSettings.v1'

// ═══════════════════════════════════════
//  localStorage 读写
// ═══════════════════════════════════════

function isStorageAvailable() {
  try {
    const key = '__deposit_settings_test__'
    localStorage.setItem(key, '1')
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

const STORAGE_OK = isStorageAvailable()

function loadFromStorage() {
  if (!STORAGE_OK) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.warn('[depositSettings] 读取配置失败:', e)
    return null
  }
}

function saveToStorage(settings) {
  if (!STORAGE_OK) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch (e) {
    console.warn('[depositSettings] 保存配置失败:', e)
    return false
  }
}

// ═══════════════════════════════════════
//  深度合并（用户配置覆盖默认值）
// ═══════════════════════════════════════

/**
 * 将用户保存的配置深度合并到默认配置上。
 * - 用户配置中非空（非 undefined/null/''）的值覆盖默认值。
 * - 嵌套对象递归合并。
 * - 数组直接替换。
 */
function deepMerge(defaults, overrides) {
  if (!overrides || typeof overrides !== 'object') {
    return JSON.parse(JSON.stringify(defaults))
  }

  const result = JSON.parse(JSON.stringify(defaults))

  for (const key of Object.keys(overrides)) {
    const overrideVal = overrides[key]

    // 跳过空值（保留默认）
    if (overrideVal === undefined || overrideVal === null || overrideVal === '') {
      continue
    }

    if (
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key]) &&
      typeof overrideVal === 'object' &&
      overrideVal !== null &&
      !Array.isArray(overrideVal)
    ) {
      // 嵌套对象：递归合并
      result[key] = deepMerge(result[key], overrideVal)
    } else {
      // 基础类型或数组：直接覆盖
      result[key] = overrideVal
    }
  }

  return result
}

// ═══════════════════════════════════════
//  对外 API
// ═══════════════════════════════════════

/**
 * 获取合并后的免押接口配置。
 * 默认值来自 depositConfig.js，用户保存的值会覆盖对应字段。
 */
export function getDepositApiSettings() {
  const saved = loadFromStorage()
  const savedApi = saved?.api || {}
  return deepMerge(depositApiConfig, savedApi)
}

/**
 * 获取合并后的免押展示配置（海报文案、联系方式等）。
 */
export function getDepositDisplaySettings() {
  const saved = loadFromStorage()
  const savedDisplay = saved?.display || {}
  return { ...depositDisplayConfig, ...savedDisplay }
}

/**
 * 获取完整免押配置（接口 + 展示）。
 */
export function getDepositSettings() {
  return {
    api: getDepositApiSettings(),
    display: getDepositDisplaySettings(),
  }
}

/**
 * 保存用户自定义配置到 localStorage。
 * @param {Object} settings — { api?: object, display?: object }
 * @returns {boolean} 是否保存成功
 */
export function saveDepositSettings(settings) {
  const existing = loadFromStorage() || {}
  const merged = {
    ...existing,
    version: 1,
    updatedAt: new Date().toISOString(),
  }

  if (settings.api) {
    merged.api = { ...(existing.api || {}), ...settings.api }
  }
  if (settings.display) {
    merged.display = { ...(existing.display || {}), ...settings.display }
  }

  return saveToStorage(merged)
}

/**
 * 恢复默认配置（清除 localStorage 中的免押配置）。
 * @returns {boolean}
 */
export function resetDepositSettings() {
  if (!STORAGE_OK) return false
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
