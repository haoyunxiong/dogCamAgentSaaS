import { devices, deviceModels } from './devices.js'

function dateOffset(days) {
  const base = new Date('2026-06-14T00:00:00')
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export const scheduleDates = Array.from({ length: 14 }, (_, index) => dateOffset(index))

const statusByIndex = ['可租', '占用', '可租', '占用', '冲突', '维修', '可租']

export const schedule = devices.flatMap((device, deviceIndex) =>
  scheduleDates.map((date, dateIndex) => {
    const status = device.status === '维修中' || device.status === '异常'
      ? '维修'
      : statusByIndex[(deviceIndex + dateIndex) % statusByIndex.length]
    const relatedIndex = (deviceIndex + dateIndex) % 24

    return {
      id: `${device.id}-${date}`,
      deviceId: device.id,
      assetNo: device.assetNo,
      model: device.model,
      date,
      status,
      orderId: status === '占用' || status === '冲突' ? `ORD-${10023 + relatedIndex}` : null,
      label: status === '可租' ? '可租' : status === '占用' ? '已占用' : status,
      conflictType: status === '冲突' ? '归还与新订单发货间隔不足 6 小时' : ''
    }
  })
)

export const scheduleModelGroups = deviceModels.map((model) => ({
  model,
  devices: devices.filter((device) => device.model === model).slice(0, 6)
}))
