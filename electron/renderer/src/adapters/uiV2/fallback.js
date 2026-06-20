import { createUiV2AdapterMeta, createUiV2MockAdapter, UI_V2_ADAPTER_METHODS } from './mockAdapter.js'
import { createUiV2RealAdapter } from './realAdapter.js'
import {
  getUiV2AdapterMode,
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
  normalizeUiV2AdapterMode,
} from './mode.js'

function getFallbackReason(error) {
  if (error?.code === 'UI_V2_REAL_ADAPTER_NOT_IMPLEMENTED') {
    return '真实接口暂未覆盖，已使用本地演示数据'
  }

  const message = error?.message || ''
  if (message.includes('electronAPI bridge')) {
    return '当前浏览器没有桌面接口，已使用本地演示数据'
  }

  return message || '本地数据库读取失败，已使用本地演示数据'
}

function isPromiseLike(value) {
  return value && typeof value.then === 'function'
}

function shouldFailClosed(activeMode) {
  return activeMode === 'real' || (!isUiV2PreviewMode() && hasUiV2RuntimeBridge())
}

export function createUiV2Adapter({ mode } = {}) {
  const mockAdapter = createUiV2MockAdapter()
  const realAdapter = createUiV2RealAdapter()
  const methodMeta = new Map()

  const adapter = {
    meta: createUiV2AdapterMeta({ source: 'mock', mode: 'mock' }),
    getMeta() {
      return adapter.meta
    },
    getLastMeta(methodName) {
      return methodMeta.get(methodName) || adapter.meta
    },
    async withMeta(methodName, ...args) {
      if (typeof adapter[methodName] !== 'function') {
        throw new Error(`Unknown UI-V2 adapter method: ${methodName}`)
      }

      const data = await adapter[methodName](...args)
      return {
        data,
        meta: adapter.getLastMeta(methodName),
      }
    },
  }

  function setMeta(methodName, source, activeMode, fallbackReason = '') {
    const meta = createUiV2AdapterMeta({
      source,
      fallbackReason,
      mode: activeMode,
      method: methodName,
    })
    adapter.meta = meta
    methodMeta.set(methodName, meta)
    return meta
  }

  function readMock(methodName, args, source, activeMode, fallbackReason = '') {
    const data = mockAdapter[methodName](...args)
    setMeta(methodName, source, activeMode, fallbackReason)
    return data
  }

  function readRealError(methodName, activeMode, error) {
    setMeta(methodName, 'real-error', activeMode, getFallbackReason(error))
    throw error
  }

  function recoverFromRealError(methodName, args, activeMode, error) {
    if (shouldFailClosed(activeMode)) {
      return readRealError(methodName, activeMode, error)
    }

    return readMock(methodName, args, 'mock-fallback', activeMode, getFallbackReason(error))
  }

  UI_V2_ADAPTER_METHODS.forEach((methodName) => {
    adapter[methodName] = (...args) => {
      const activeMode = normalizeUiV2AdapterMode(mode || getUiV2AdapterMode())

      if (activeMode === 'mock') {
        return readMock(methodName, args, 'mock', activeMode)
      }

      try {
        const data = realAdapter[methodName](...args)
        if (isPromiseLike(data)) {
          return data
            .then((result) => {
              setMeta(methodName, 'real', activeMode)
              return result
            })
            .catch((error) => recoverFromRealError(methodName, args, activeMode, error))
        }
        setMeta(methodName, 'real', activeMode)
        return data
      } catch (error) {
        return recoverFromRealError(methodName, args, activeMode, error)
      }
    }
  })

  return adapter
}
