const STATUS_LABELS = {
  idle: '可租',
  busy: '在租',
  repair: '维修中',
  offline: '停用',
}

function pick(row, keys, fallback = '') {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function toNumber(value) {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function toDate(value) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 10)
}

function truncateText(value, maxLength = 42) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

function mapDeviceStatus(row) {
  const status = String(pick(row, ['status', 'effective_status', 'raw_status', 'rawStatus'], 'idle')).trim()
  return STATUS_LABELS[status] || status || '可租'
}

function mapMaintenanceStatus(row) {
  const rawStatus = String(pick(row, ['raw_status', 'rawStatus', 'status'], '')).trim()
  if (rawStatus === 'repair') return '维修中'
  if (rawStatus === 'offline') return '停用'
  return pick(row, ['maintenance_status', 'maintenanceStatus'], '正常')
}

function resolveLocation(row) {
  return pick(row, ['store_name', 'storeName', 'city', 'location'], '未分配门店')
}

export function extractRealDevices(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.devices)) return payload.devices
  if (Array.isArray(payload?.units)) return payload.units
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.list)) return payload.list
  return []
}

export function mapRealDevice(row = {}) {
  const id = pick(row, ['id'], '')
  const model = truncateText(pick(row, ['model_code', 'modelCode', 'model', 'name'], '未填写型号'))
  const unitCode = truncateText(pick(row, ['unit_code', 'unitCode', 'asset_no', 'assetNo'], id ? `UNIT-${id}` : '未编号'))
  const serialNo = truncateText(pick(row, ['serial_no', 'serialNo', 'sn'], unitCode), 36)
  const purchaseCost = toNumber(pick(row, ['purchase_cost', 'purchaseCost']))
  const residualValue = toNumber(pick(row, ['residual_value', 'residualValue']))
  const status = mapDeviceStatus(row)

  return {
    id: String(id || unitCode),
    rawId: id,
    assetNo: unitCode,
    category: pick(row, ['category'], '租赁设备'),
    model,
    serialNo,
    status,
    location: truncateText(resolveLocation(row), 28),
    currentOrderId: pick(row, ['current_order_id', 'currentOrderId'], status === '在租' ? '只读占用' : ''),
    nextBookingDate: toDate(pick(row, ['next_booking_date', 'nextBookingDate'])) || '暂无预约',
    maintenanceStatus: mapMaintenanceStatus(row),
    utilization: toNumber(pick(row, ['utilization'], status === '在租' ? 100 : 0)),
    revenue30d: toNumber(pick(row, ['revenue_30d', 'revenue30d'])),
    lastCheckedAt: toDate(pick(row, ['updated_at', 'updatedAt', 'created_at', 'createdAt'])) || '未记录',
    conditionNote: pick(row, ['note', 'condition_note', 'conditionNote'], ''),
    purchaseCost,
    residualValue,
    imageUrl: pick(row, ['image_url', 'imageUrl'], ''),
    rawStatus: pick(row, ['raw_status', 'rawStatus'], ''),
    raw: row,
  }
}

export function mapRealDevices(payload) {
  return extractRealDevices(payload).map((row) => mapRealDevice(row))
}

export function buildDeviceStatusTabs(devices = [], allLabel = '全部') {
  const values = Array.from(new Set(devices.map((device) => device.status).filter(Boolean)))
  return [
    { label: allLabel, value: allLabel, count: devices.length },
    ...values.map((value) => ({
      label: value,
      value,
      count: devices.filter((device) => device.status === value).length,
    })),
  ]
}

export function resolveDeviceKey(deviceKey, rawDevices = []) {
  const key = String(deviceKey || '').trim()
  if (!key) return null
  return rawDevices.find((device) => {
    const id = String(pick(device, ['id'], ''))
    const unitCode = String(pick(device, ['unit_code', 'unitCode', 'asset_no', 'assetNo'], ''))
    const serialNo = String(pick(device, ['serial_no', 'serialNo', 'sn'], ''))
    return key === id || key === unitCode || key === serialNo
  }) || null
}
