import { createUiV2AdapterMeta, createUiV2MockAdapter, UI_V2_ADAPTER_METHODS } from './mockAdapter.js'
import { createUiV2RealAdapter } from './realAdapter.js'
import {
  getUiV2AdapterMode,
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
  normalizeUiV2AdapterMode,
} from './mode.js'

function getForcedMockReason() {
  if (isUiV2PreviewMode()) return 'renderer-preview-forced-mock'
  if (!hasUiV2RuntimeBridge()) return 'runtime-bridge-unavailable'
  return ''
}

function getFallbackReason(error) {
  if (error?.code === 'UI_V2_REAL_ADAPTER_NOT_IMPLEMENTED') {
    return 'real-adapter-not-implemented'
  }

  return error?.message || 'real-adapter-error'
}

function isPromiseLike(value) {
  return value && typeof value.then === 'function'
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

  UI_V2_ADAPTER_METHODS.forEach((methodName) => {
    adapter[methodName] = (...args) => {
      const forcedMockReason = getForcedMockReason()
      const activeMode = forcedMockReason
        ? 'mock'
        : normalizeUiV2AdapterMode(mode || getUiV2AdapterMode())

      if (activeMode === 'mock') {
        return readMock(methodName, args, 'mock', activeMode, forcedMockReason)
      }

      try {
        const data = realAdapter[methodName](...args)
        if (isPromiseLike(data)) {
          return data
            .then((result) => {
              setMeta(methodName, 'real', activeMode)
              return result
            })
            .catch((error) => readMock(methodName, args, 'mock-fallback', activeMode, getFallbackReason(error)))
        }
        setMeta(methodName, 'real', activeMode)
        return data
      } catch (error) {
        return readMock(methodName, args, 'mock-fallback', activeMode, getFallbackReason(error))
      }
    }
  })

  return adapter
}
