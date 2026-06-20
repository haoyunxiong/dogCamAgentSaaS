export function buildNextActionCard(order = {}) {
  const status = order?.raw?.order_status || order?.status || ''
  const shipping = order?.shippingStatus || order?.raw?.latest_logistics_status || ''
  const deposit = order?.depositStatus || ''
  const map = {
    waiting_payment: '核对押金/免押并确认订单',
    待确认: '确认客户资料和租期',
    待押金: '处理押金或免押',
    待发货: '创建发出物流',
    运输中: '跟踪发出物流',
    租用中: '等待归还或处理续租',
    待归还: '提醒客户归还',
    待验机: '归还验机',
    已完成: '订单已完成',
  }
  return {
    title: map[status] || order?.nextAction || '按订单详情推进下一步',
    mainStatus: status || '未设置',
    depositStatus: deposit || '未设置',
    outboundShippingStatus: shipping || '未设置',
    returnShippingStatus: order?.returnShippingStatus || '未开始',
    inspectionStatus: order?.inspectionStatus || '未开始',
    paymentStatus: Number(order?.rentAmount || order?.raw?.fee || 0) > 0 ? '待核对' : '未设置',
  }
}
