import { orders } from './orders.js'
import { shipping } from './shipping.js'

const statusAction = {
  待下单: '创建运单',
  待揽收: '确认揽收',
  运输中: '跟进轨迹',
  已签收: '等待客户确认',
  异常: '处理异常'
}

export const waybills = shipping.map((item, index) => {
  const order = orders.find((orderItem) => orderItem.orderNo === item.orderId)
  const currentIndex = item.steps.findIndex((step) => !step.done)
  const normalizedCurrent = currentIndex === -1 ? item.steps.length - 1 : currentIndex

  return {
    ...item,
    customerName: order?.customerName || item.receiver,
    model: order?.model || '大疆 Pocket 3',
    orderStatus: order?.status || '待发货',
    shippingStatus: item.status,
    nextAction: statusAction[item.status] || '查看运单',
    timeline: item.steps.map((step, stepIndex) => ({
      label: step.label,
      desc: step.done ? '已完成' : stepIndex === normalizedCurrent ? '当前节点' : '等待前置节点',
      done: step.done,
      current: stepIndex === normalizedCurrent && !step.done
    }))
  }
})

export const logisticsKpis = [
  { key: 'today', label: '今日运单', value: waybills.length, unit: '单', trend: 'mock 运单池', tone: 'info' },
  { key: 'pickup', label: '待揽收', value: waybills.filter((item) => item.shippingStatus === '待揽收').length, unit: '单', trend: '需盯揽收', tone: 'warning' },
  { key: 'moving', label: '运输中', value: waybills.filter((item) => item.shippingStatus === '运输中').length, unit: '单', trend: '跟踪轨迹', tone: 'info' },
  { key: 'exception', label: '物流异常', value: waybills.filter((item) => item.shippingStatus === '异常').length, unit: '单', trend: '优先处理', tone: 'danger' }
]
