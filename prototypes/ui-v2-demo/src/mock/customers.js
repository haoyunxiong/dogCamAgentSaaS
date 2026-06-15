import { orders } from './orders.js'

const levels = ['正常', '低风险', '中风险', '高风险']
const tags = ['稳定复租', '学生用户', '企业拍摄', '需确认地址', '高价值设备', '逾期关注']

export const customers = orders.slice(0, 18).map((order, index) => {
  const orderCount = 1 + (index % 7)
  const totalRent = order.rentAmount * orderCount + index * 128
  const riskLevel = levels[index % levels.length]

  return {
    id: `CUS-${String(3001 + index)}`,
    name: order.customerName,
    phoneMasked: order.phoneMasked,
    channel: order.channel,
    city: ['深圳', '广州', '杭州', '上海'][index % 4],
    riskLevel,
    tags: [tags[index % tags.length], tags[(index + 2) % tags.length]],
    orderCount,
    totalRent,
    depositPreference: order.depositStatus.includes('免押') ? '偏好免押' : '押金正常',
    lastOrderNo: order.orderNo,
    lastRentAt: order.createdAt,
    nextAction: riskLevel === '高风险' ? '复核后再接单' : index % 3 === 0 ? '推荐复租套餐' : '保持跟进',
    note: riskLevel === '高风险'
      ? '近 30 天存在逾期或验机争议，需要人工确认后再接高价值设备。'
      : '租赁记录完整，可按常规流程处理。'
  }
})

export const customerKpis = [
  { key: 'customers', label: '客户数', value: customers.length, unit: '人', trend: 'mock 档案', tone: 'info' },
  { key: 'repeat', label: '复租客户', value: customers.filter((item) => item.orderCount >= 4).length, unit: '人', trend: '近 90 天', tone: 'success' },
  { key: 'risk', label: '风险客户', value: customers.filter((item) => item.riskLevel === '高风险').length, unit: '人', trend: '需人工复核', tone: 'danger' },
  { key: 'depositFree', label: '偏好免押', value: customers.filter((item) => item.depositPreference === '偏好免押').length, unit: '人', trend: '用于审核队列', tone: 'warning' }
]
