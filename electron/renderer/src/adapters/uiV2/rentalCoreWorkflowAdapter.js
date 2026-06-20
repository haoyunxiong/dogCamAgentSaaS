import {
  hasUiV2RuntimeBridge,
  isUiV2PreviewMode,
} from './mode.js'

function getBridge() {
  if (isUiV2PreviewMode()) return null
  if (!hasUiV2RuntimeBridge()) return null
  return window.electronAPI?.rentalCore || null
}

function fallback(message) {
  return {
    ok: false,
    source: 'renderer-fallback',
    message,
    fallbackReason: '当前浏览器无 Electron bridge，无法访问本地 MySQL。',
    sensitiveValuesReturned: false,
  }
}

async function callRentalCore(methodName, payload = {}, fallbackMessage = '租赁核心流程不可用。') {
  try {
    const bridge = getBridge()
    if (!bridge || typeof bridge[methodName] !== 'function') return fallback(fallbackMessage)
    return await bridge[methodName](payload || {})
  } catch (error) {
    return {
      ok: false,
      message: error?.message || fallbackMessage,
      sensitiveValuesReturned: false,
    }
  }
}

export const rentalCoreWorkflowAdapter = {
  parseAddress(payload) {
    return callRentalCore('parseAddress', payload, '地址区县解析不可用。')
  },
  queryAvailability(payload) {
    return callRentalCore('queryAvailability', payload, '查档期不可用。')
  },
  createHold(payload) {
    return callRentalCore('createHold', payload, '临时锁定不可用。')
  },
  listHolds(payload) {
    return callRentalCore('listHolds', payload, '临时锁定列表不可用。')
  },
  extendHold(payload) {
    return callRentalCore('extendHold', payload, '延长锁定不可用。')
  },
  releaseHold(payload) {
    return callRentalCore('releaseHold', payload, '释放锁定不可用。')
  },
  createOrderFromHold(payload) {
    return callRentalCore('createOrderFromHold', payload, '从锁定创建订单不可用。')
  },
}
