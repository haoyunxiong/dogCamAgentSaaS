import { createUiV2AdapterMeta, UI_V2_ADAPTER_METHODS } from './mockAdapter.js'
import {
  buildDeviceStatusTabs,
  extractRealDevices,
  mapRealDevice,
  mapRealDevices,
  resolveDeviceKey,
} from './devicesMapper.js'
import {
  buildOrderStatusTabs,
  extractRealOrder,
  extractRealOrders,
  mapRealOrder,
  mapRealOrders,
  resolveOrderDetailId,
} from './ordersMapper.js'

export class UiV2RealAdapterNotImplementedError extends Error {
  constructor(methodName) {
    super(`UI-V2 real adapter method is not implemented in this foundation slice: ${methodName}`)
    this.name = 'UiV2RealAdapterNotImplementedError'
    this.code = 'UI_V2_REAL_ADAPTER_NOT_IMPLEMENTED'
    this.methodName = methodName
  }
}

function getRuntimeBridge() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('UI-V2 real adapter requires electronAPI bridge')
  }
  return window.electronAPI
}

export function createUiV2RealAdapter() {
  const meta = createUiV2AdapterMeta({ source: 'real', mode: 'real' })
  let rawOrdersCache = []
  let mappedOrdersCache = []
  let rawDevicesCache = []
  let mappedDevicesCache = []
  const adapter = {
    meta,
    getMeta() {
      return meta
    },
    getLastMeta() {
      return meta
    },
    async withMeta(methodName, ...args) {
      if (typeof adapter[methodName] !== 'function') {
        throw new Error(`Unknown UI-V2 adapter method: ${methodName}`)
      }

      return {
        data: await adapter[methodName](...args),
        meta,
      }
    },
    async getOrders(filters = {}) {
      const bridge = getRuntimeBridge()
      const payload = await bridge.listOrders(filters)
      rawOrdersCache = extractRealOrders(payload)
      mappedOrdersCache = mapRealOrders(rawOrdersCache)
      return mappedOrdersCache
    },
    async getOrder(orderKey) {
      const bridge = getRuntimeBridge()
      let detailId = resolveOrderDetailId(orderKey, rawOrdersCache)

      if (!detailId) {
        const payload = await bridge.listOrders({})
        rawOrdersCache = extractRealOrders(payload)
        mappedOrdersCache = mapRealOrders(rawOrdersCache)
        detailId = resolveOrderDetailId(orderKey, rawOrdersCache)
      }

      if (!detailId) {
        throw new Error(`Cannot resolve readonly order detail id for ${orderKey}`)
      }

      const payload = await bridge.getOrderDetail({ orderId: detailId })
      const rawOrder = extractRealOrder(payload)
      if (!rawOrder) throw new Error(`Readonly order detail not found for ${orderKey}`)
      return mapRealOrder(rawOrder)
    },
    async getOrderStatusTabs(filters = {}) {
      const orders = mappedOrdersCache.length ? mappedOrdersCache : await adapter.getOrders(filters)
      return buildOrderStatusTabs(orders)
    },
    async getDevices(filters = {}) {
      const bridge = getRuntimeBridge()
      const payload = await bridge.listScheduleUnits({ activeInventoryOnly: true, ...filters })
      rawDevicesCache = extractRealDevices(payload)
      mappedDevicesCache = mapRealDevices(rawDevicesCache)
      return mappedDevicesCache
    },
    async getDevice(deviceKey) {
      let rawDevice = resolveDeviceKey(deviceKey, rawDevicesCache)
      if (!rawDevice) {
        const bridge = getRuntimeBridge()
        const payload = await bridge.listScheduleUnits({ activeInventoryOnly: true })
        rawDevicesCache = extractRealDevices(payload)
        mappedDevicesCache = mapRealDevices(rawDevicesCache)
        rawDevice = resolveDeviceKey(deviceKey, rawDevicesCache)
      }
      if (!rawDevice) throw new Error(`Readonly device not found for ${deviceKey}`)
      return mapRealDevice(rawDevice)
    },
    async getDeviceStatusTabs(filters = {}) {
      const devices = mappedDevicesCache.length ? mappedDevicesCache : await adapter.getDevices(filters)
      return buildDeviceStatusTabs(devices)
    },
  }

  UI_V2_ADAPTER_METHODS
    .filter((methodName) => typeof adapter[methodName] !== 'function')
    .forEach((methodName) => {
      adapter[methodName] = () => {
        throw new UiV2RealAdapterNotImplementedError(methodName)
      }
    })

  return adapter
}
