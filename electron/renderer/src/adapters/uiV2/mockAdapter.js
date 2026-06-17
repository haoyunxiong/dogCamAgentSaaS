import {
  uiV2Customers,
  uiV2DepositReviews,
  uiV2Devices,
  uiV2Metrics,
  uiV2Options,
  uiV2Orders,
  uiV2Report,
  uiV2Risks,
  uiV2Schedule,
  uiV2ScheduleDates,
  uiV2Settings,
  uiV2Tasks,
  uiV2Waybills,
} from '../../mock/uiV2/index.js'

export const UI_V2_ADAPTER_METHODS = [
  'getMetrics',
  'getOrders',
  'getOrder',
  'getOrderStatusTabs',
  'getDevices',
  'getDevice',
  'getDeviceStatusTabs',
  'getSchedule',
  'getScheduleDates',
  'getTasks',
  'getRisks',
  'getCustomers',
  'getDepositReviews',
  'getWaybills',
  'getReport',
  'getSettings',
  'getOptions',
]

export function createUiV2AdapterMeta({
  source = 'mock',
  fallbackReason = '',
  mode = 'mock',
  method = '',
} = {}) {
  return {
    source,
    fallbackReason,
    loadedAt: new Date().toISOString(),
    mode,
    method,
  }
}

function countBy(rows, field, value) {
  return rows.filter((row) => row[field] === value).length
}

function statusTabs(rows, field, allLabel = '全部') {
  const values = Array.from(new Set(rows.map((row) => row[field]).filter(Boolean)))
  return [
    { label: allLabel, value: allLabel, count: rows.length },
    ...values.map((value) => ({ label: value, value, count: countBy(rows, field, value) })),
  ]
}

export function createUiV2MockAdapter({
  source = 'mock',
  fallbackReason = '',
  mode = 'mock',
} = {}) {
  const meta = createUiV2AdapterMeta({ source, fallbackReason, mode })

  const adapter = {
    meta,
    getMeta() {
      return meta
    },
    getLastMeta() {
      return meta
    },
    withMeta(methodName, ...args) {
      if (typeof adapter[methodName] !== 'function') {
        throw new Error(`Unknown UI-V2 adapter method: ${methodName}`)
      }

      return {
        data: adapter[methodName](...args),
        meta,
      }
    },
    getMetrics() {
      return uiV2Metrics
    },
    getOrders() {
      return uiV2Orders
    },
    getOrder(orderNo) {
      return uiV2Orders.find((order) => order.orderNo === orderNo)
    },
    getOrderStatusTabs() {
      return statusTabs(uiV2Orders, 'status')
    },
    getDevices() {
      return uiV2Devices
    },
    getDevice(deviceId) {
      return uiV2Devices.find((device) => device.id === deviceId || device.assetNo === deviceId)
    },
    getDeviceStatusTabs() {
      return statusTabs(uiV2Devices, 'status')
    },
    getSchedule() {
      return uiV2Schedule
    },
    getScheduleDates() {
      return uiV2ScheduleDates
    },
    getTasks() {
      return uiV2Tasks
    },
    getRisks() {
      return uiV2Risks
    },
    getCustomers() {
      return uiV2Customers
    },
    getDepositReviews() {
      return uiV2DepositReviews
    },
    getWaybills() {
      return uiV2Waybills
    },
    getReport() {
      return uiV2Report
    },
    getSettings() {
      return uiV2Settings
    },
    getOptions() {
      return uiV2Options
    },
  }

  return adapter
}

export const uiV2MockAdapter = createUiV2MockAdapter()
