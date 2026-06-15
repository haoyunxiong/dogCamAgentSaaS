const statuses = ['待确认', '待押金', '待分配设备', '待发货', '租赁中', '待归还', '待验机', '已完成', '异常']
const channels = ['闲鱼', '小红书', '抖音', '私域']
const depositStatuses = ['待收', '已收', '免押审核中', '免押通过', '免押失败', '需人工复核']
const shippingStatuses = ['待下单', '待揽收', '运输中', '已签收', '异常']
const models = ['大疆 Pocket 3', 'Canon G7X Mark II', '富士 X100V', 'CCD', 'Sony A7M3']
const customers = [
  '林小姐', '周先生', '许同学', '陈小姐', '韩先生', '罗女士', '顾先生', '赵小姐',
  '沈先生', '李女士', '王先生', '唐小姐', '何先生', '马女士', '袁先生', '苏小姐',
  '蒋先生', '程女士', '梁先生', '刘小姐', '冯先生', '钟女士', '叶先生', '黄小姐'
]

const nextActions = {
  待确认: '确认租期',
  待押金: '核对押金',
  待分配设备: '分配设备',
  待发货: '创建顺丰寄件',
  租赁中: '跟进租期',
  待归还: '提醒归还',
  待验机: '验机入库',
  已完成: '查看归档',
  异常: '处理异常'
}

const riskLevels = ['none', 'low', 'medium', 'high']

function dateOffset(days) {
  const base = new Date('2026-06-14T00:00:00')
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export const orders = Array.from({ length: 24 }, (_, index) => {
  const status = statuses[index % statuses.length]
  const orderNo = index === 0 ? 'ORD-10023' : `ORD-${10023 + index}`
  const startOffset = (index % 9) - 2
  const rentDays = 2 + (index % 5)
  const model = models[index % models.length]

  return {
    id: orderNo,
    orderNo,
    customerName: customers[index],
    phoneMasked: `1${[3, 5, 6, 7, 8][index % 5]}****${String(2300 + index * 17).slice(-4)}`,
    channel: channels[index % channels.length],
    status,
    rentStart: dateOffset(startOffset),
    rentEnd: dateOffset(startOffset + rentDays),
    model,
    deviceIds: [`DEV-${String((index % 36) + 1).padStart(3, '0')}`],
    depositStatus: depositStatuses[(index + 2) % depositStatuses.length],
    depositAmount: [800, 1200, 1800, 2500, 3200][index % 5],
    rentAmount: [98, 128, 168, 229, 299][index % 5] * rentDays,
    shippingStatus: shippingStatuses[(index + 1) % shippingStatuses.length],
    riskLevel: riskLevels[index % riskLevels.length],
    assignee: ['阿宁', '小夏', '小顾', '小周'][index % 4],
    nextAction: nextActions[status],
    address: ['深圳市南山区科技园', '广州市天河区体育西', '杭州市西湖区文三路', '上海市徐汇区漕溪北路'][index % 4],
    note: index % 4 === 0 ? '客户要求出发前一天送达，需确认顺丰揽收时间。' : '',
    createdAt: dateOffset(-index)
  }
})

export const orderStatuses = statuses
export const depositStatusList = depositStatuses
export const shippingStatusList = shippingStatuses
