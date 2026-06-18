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
import {
  mapRealSchedule,
} from './scheduleMapper.js'
import {
  mapRealCustomers,
} from './customersMapper.js'
import {
  mapDashboardMetrics,
  mapDashboardRisks,
  mapDashboardTasks,
} from './dashboardMapper.js'
import {
  mapRealReport,
} from './reportsMapper.js'
import {
  mapRealWaybills,
} from './logisticsMapper.js'
import {
  mapStoredDepositReviews,
} from './depositMapper.js'

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

function getMonthRange(month) {
  const [year, monthIndex] = String(month || '').split('-').map((part) => Number(part))
  if (!year || !monthIndex) return {}
  const prefix = `${year}-${String(monthIndex).padStart(2, '0')}`
  const lastDay = new Date(year, monthIndex, 0).getDate()
  return {
    from: `${prefix}-01`,
    to: `${prefix}-${String(lastDay).padStart(2, '0')}`,
  }
}

async function readOptionalBridge(bridge, methodName, filters = {}) {
  if (typeof bridge?.[methodName] !== 'function') return []
  try {
    return await bridge[methodName](filters)
  } catch {
    return []
  }
}

async function readDashboardSources(bridge, filters = {}) {
  const month = filters.month || new Date().toISOString().slice(0, 7)
  const monthRange = getMonthRange(month)
  const orders = await bridge.listOrders(filters.orders || {})
  const [
    devices,
    scheduleOverview,
    scheduleBlocks,
    inquiries,
    deposits,
  ] = await Promise.all([
    readOptionalBridge(bridge, 'listScheduleUnits', { activeInventoryOnly: true, ...(filters.devices || {}) }),
    readOptionalBridge(bridge, 'getScheduleMonthlyOverview', { month, ...(filters.scheduleOverview || {}) }),
    readOptionalBridge(bridge, 'listScheduleBlocks', { ...monthRange, ...(filters.scheduleBlocks || {}) }),
    readOptionalBridge(bridge, 'listInquiryEvents', filters.inquiries || { limit: 500 }),
    readOptionalBridge(bridge, 'depositListStoredOrders', filters.deposits || {}),
  ])

  return {
    orders,
    devices,
    scheduleOverview,
    scheduleBlocks,
    inquiries,
    deposits,
  }
}

async function readShippingRecordsByOrder(bridge, orders = []) {
  if (typeof bridge?.listShippingRecords !== 'function') return {}
  const rows = extractRealOrders(orders).slice(0, 80)
  const entries = await Promise.all(rows.map(async (order) => {
    const id = order?.id
    const no = order?.order_no || order?.orderNo || id
    if (id === undefined || id === null || id === '') return [no, []]
    try {
      const records = await bridge.listShippingRecords({ orderId: id })
      return [id, records]
    } catch {
      return [id, []]
    }
  }))
  return Object.fromEntries(entries)
}

export function createUiV2RealAdapter() {
  const meta = createUiV2AdapterMeta({ source: 'real', mode: 'real' })
  let rawOrdersCache = []
  let mappedOrdersCache = []
  let rawDevicesCache = []
  let mappedDevicesCache = []
  let mappedScheduleCache = []
  let mappedScheduleDatesCache = []
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
    async getMetrics(filters = {}) {
      const bridge = getRuntimeBridge()
      return mapDashboardMetrics(await readDashboardSources(bridge, filters))
    },
    async getTasks(filters = {}) {
      const bridge = getRuntimeBridge()
      return mapDashboardTasks(await readDashboardSources(bridge, filters))
    },
    async getRisks(filters = {}) {
      const bridge = getRuntimeBridge()
      return mapDashboardRisks(await readDashboardSources(bridge, filters))
    },
    async getReport(filters = {}) {
      const bridge = getRuntimeBridge()
      return mapRealReport(await readDashboardSources(bridge, filters))
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
    async getSchedule(filters = {}) {
      const bridge = getRuntimeBridge()
      const month = filters.month || new Date().toISOString().slice(0, 7)
      const overviewFilters = {
        month,
        ...(filters.modelCode ? { modelCode: filters.modelCode } : {}),
      }
      const monthRange = getMonthRange(month)
      const blockFilters = {
        ...monthRange,
        ...(filters.modelCode ? { modelCode: filters.modelCode } : {}),
      }
      const [overview, blocks, units] = await Promise.all([
        bridge.getScheduleMonthlyOverview(overviewFilters),
        bridge.listScheduleBlocks(blockFilters),
        bridge.listScheduleUnits({ activeInventoryOnly: true, ...(filters.modelCode ? { modelCode: filters.modelCode } : {}) }),
      ])
      const mapped = mapRealSchedule({ overview, blocks, units, daysLimit: filters.daysLimit || 14 })
      mappedScheduleCache = mapped.schedule
      mappedScheduleDatesCache = mapped.dates
      return mappedScheduleCache
    },
    async getScheduleDates(filters = {}) {
      if (!mappedScheduleDatesCache.length) await adapter.getSchedule(filters)
      return mappedScheduleDatesCache
    },
    async getCustomers(filters = {}) {
      const bridge = getRuntimeBridge()
      const orders = await bridge.listOrders(filters.orders || {})
      const [inquiries, deposits] = await Promise.all([
        readOptionalBridge(bridge, 'listInquiryEvents', filters.inquiries || { limit: 500 }),
        readOptionalBridge(bridge, 'depositListStoredOrders', filters.deposits || {}),
      ])
      return mapRealCustomers({ orders, inquiries, deposits })
    },
    async getWaybills(filters = {}) {
      const bridge = getRuntimeBridge()
      const orders = await bridge.listOrders(filters.orders || {})
      const recordsByOrder = await readShippingRecordsByOrder(bridge, orders)
      return mapRealWaybills({ orders, recordsByOrder })
    },
    async getDepositReviews(filters = {}) {
      const bridge = getRuntimeBridge()
      const deposits = await bridge.depositListStoredOrders(filters.deposits || {})
      return mapStoredDepositReviews(deposits)
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
