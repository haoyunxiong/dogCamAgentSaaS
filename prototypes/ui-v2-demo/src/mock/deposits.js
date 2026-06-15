import { orders } from './orders.js'

const reviewStatuses = ['待审核', '待复核', '已通过', '已拒绝']
const riskLevels = ['低风险', '中风险', '高风险']

export const depositReviews = orders.slice(0, 16).map((order, index) => {
  const riskLevel = riskLevels[index % riskLevels.length]
  const reviewStatus = reviewStatuses[index % reviewStatuses.length]

  return {
    id: `DEP-${String(5001 + index)}`,
    orderNo: order.orderNo,
    customerName: order.customerName,
    phoneMasked: order.phoneMasked,
    model: order.model,
    rentPeriod: `${order.rentStart} - ${order.rentEnd}`,
    depositAmount: order.depositAmount,
    requestedFreeAmount: order.depositAmount,
    depositStatus: order.depositStatus,
    reviewStatus,
    riskLevel,
    channel: order.channel,
    assignee: order.assignee,
    submittedAt: order.createdAt,
    riskReason: riskLevel === '高风险'
      ? '历史订单存在逾期或地址一致性待确认。'
      : riskLevel === '中风险'
        ? '设备价值较高，建议二次确认身份证与收货地址。'
        : '历史履约记录稳定，可按常规规则审核。',
    nextAction: reviewStatus === '待审核'
      ? '初审资料'
      : reviewStatus === '待复核'
        ? '人工复核'
        : '查看记录'
  }
})

export const depositKpis = [
  { key: 'queue', label: '审核队列', value: depositReviews.filter((item) => ['待审核', '待复核'].includes(item.reviewStatus)).length, unit: '单', trend: '今日需处理', tone: 'warning' },
  { key: 'approved', label: '已通过', value: depositReviews.filter((item) => item.reviewStatus === '已通过').length, unit: '单', trend: 'mock 规则', tone: 'success' },
  { key: 'risk', label: '高风险', value: depositReviews.filter((item) => item.riskLevel === '高风险').length, unit: '单', trend: '需人工判断', tone: 'danger' },
  { key: 'amount', label: '免押金额', value: depositReviews.reduce((sum, item) => sum + item.requestedFreeAmount, 0).toLocaleString(), unit: '元', trend: '仅前端展示', tone: 'info' }
]
