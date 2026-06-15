const statuses = ['待下单', '待揽收', '运输中', '已签收', '异常']

export const shipping = Array.from({ length: 24 }, (_, index) => ({
  id: `SHP-${7000 + index}`,
  orderId: index === 0 ? 'ORD-10023' : `ORD-${10023 + index}`,
  carrier: '顺丰速运',
  trackingNo: index % 5 === 0 ? '' : `SF${String(132000000000 + index * 92837)}`,
  status: statuses[index % statuses.length],
  sender: '小狗相机深圳仓',
  receiver: ['林小姐', '周先生', '许同学', '陈小姐'][index % 4],
  receiverAddress: ['深圳市南山区科技园', '广州市天河区体育西', '杭州市西湖区文三路', '上海市徐汇区漕溪北路'][index % 4],
  insuredAmount: [3000, 5000, 8000, 12000][index % 4],
  pickupTime: ['今天 16:00-18:00', '今天 18:00-20:00', '明天 09:00-11:00'][index % 3],
  steps: [
    { label: '确认寄件信息', done: true },
    { label: '生成顺丰运单', done: index % 5 !== 0 },
    { label: '等待揽收', done: ['待揽收', '运输中', '已签收'].includes(statuses[index % statuses.length]) },
    { label: '客户签收', done: statuses[index % statuses.length] === '已签收' }
  ]
}))
