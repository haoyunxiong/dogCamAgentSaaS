const baseDate = new Date('2026-06-17T00:00:00')

function dateOffset(days) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const orderStatuses = ['待确认', '待押金', '待分配设备', '待发货', '租赁中', '待归还', '待验机', '已完成', '异常']
const channels = ['闲鱼', '小红书', '抖音', '私域']
const depositStatuses = ['待收', '已收', '免押审核中', '免押通过', '免押失败', '需人工复核']
const shippingStatuses = ['待下单', '待揽收', '运输中', '已签收', '异常']
const models = ['大疆 Pocket 3', 'Canon G7X Mark II', '富士 X100V', 'CCD', 'Sony A7M3']
const customers = [
  '林小姐', '周先生', '许同学', '陈小姐', '韩先生', '罗女士', '顾先生', '赵小姐',
  '沈先生', '李女士', '王先生', '唐小姐', '何先生', '马女士', '袁先生', '苏小姐',
  '蒋先生', '程女士', '梁先生', '刘小姐', '冯先生', '钟女士', '叶先生', '黄小姐',
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
  异常: '处理异常',
}

export const uiV2Orders = Array.from({ length: 28 }, (_, index) => {
  const status = orderStatuses[index % orderStatuses.length]
  const orderNo = index === 0 ? 'ORD-10023' : `ORD-${10023 + index}`
  const startOffset = (index % 10) - 3
  const rentDays = 2 + (index % 5)
  const model = models[index % models.length]

  return {
    id: orderNo,
    orderNo,
    customerName: customers[index % customers.length],
    phoneMasked: `1${[3, 5, 6, 7, 8][index % 5]}****${String(2300 + index * 17).slice(-4)}`,
    channel: channels[index % channels.length],
    status,
    rentStart: dateOffset(startOffset),
    rentEnd: dateOffset(startOffset + rentDays),
    model,
    deviceIds: [`DEV-${String((index % 40) + 1).padStart(3, '0')}`],
    depositStatus: depositStatuses[(index + 2) % depositStatuses.length],
    depositAmount: [800, 1200, 1800, 2500, 3200][index % 5],
    rentAmount: [98, 128, 168, 229, 299][index % 5] * rentDays,
    shippingStatus: shippingStatuses[(index + 1) % shippingStatuses.length],
    riskLevel: ['正常', '低', '中', '高'][index % 4],
    assignee: ['阿宁', '小夏', '小顾', '小周'][index % 4],
    nextAction: nextActions[status],
    address: ['深圳市南山区科技园', '广州市天河区体育西', '杭州市西湖区文三路', '上海市徐汇区漕溪北路'][index % 4],
    note: index % 4 === 0 ? '客户要求出发前一天送达，需确认顺丰揽收时间。' : '按标准履约流程处理。',
    createdAt: dateOffset(-index),
  }
})

export const uiV2Metrics = [
  { key: 'todayOrders', label: '今日订单', value: 18, unit: '单', trend: '+4', tone: 'info' },
  { key: 'todayRent', label: '今日租金', value: '12,860', unit: '元', trend: '+18%', tone: 'success' },
  { key: 'shipToday', label: '待发货', value: 9, unit: '单', trend: '18:00 前', tone: 'warning' },
  { key: 'returnToday', label: '待归还', value: 7, unit: '单', trend: '含 2 单逾期', tone: 'warning' },
  { key: 'overdue', label: '逾期订单', value: 3, unit: '单', trend: '需跟进', tone: 'danger' },
  { key: 'utilization', label: '设备利用率', value: 76, unit: '%', trend: '+6%', tone: 'success' },
]

const deviceGroups = [
  { model: '大疆 Pocket 3', category: '运动相机', prefix: 'DJI-P3' },
  { model: 'Canon G7X Mark II', category: '卡片机', prefix: 'CAN-G7X' },
  { model: '富士 X100V', category: '复古相机', prefix: 'FUJI-X100V' },
  { model: 'CCD', category: '复古数码', prefix: 'CCD-MIX' },
  { model: 'Sony A7M3', category: '全画幅相机', prefix: 'SONY-A7M3' },
]
const deviceStatuses = ['可租', '已预订', '在租', '待清洁', '维修中', '异常', '停用']

export const uiV2Devices = Array.from({ length: 40 }, (_, index) => {
  const group = deviceGroups[index % deviceGroups.length]
  const status = deviceStatuses[index % deviceStatuses.length]
  return {
    id: `DEV-${String(index + 1).padStart(3, '0')}`,
    assetNo: `${group.prefix}-${String(index + 1).padStart(3, '0')}`,
    category: group.category,
    model: group.model,
    serialNo: `SN${String(860000 + index * 137)}`,
    status,
    location: ['深圳仓 A 区', '深圳仓 B 区', '广州门店', '杭州合作仓', '上海临时仓'][index % 5],
    currentOrderId: ['在租', '已预订'].includes(status) ? `ORD-${10023 + (index % 24)}` : '',
    nextBookingDate: dateOffset((index % 10) + 1),
    maintenanceStatus: ['正常', '待清洁', '镜头检查', '按键维修', '传感器清洁', '外观复检'][index % 6],
    utilization: 48 + (index * 7) % 45,
    revenue30d: 980 + ((index * 347) % 5200),
    lastCheckedAt: dateOffset(-(index % 8)),
    conditionNote: status === '异常' ? '归还验机发现外壳磕碰，待客服确认赔付。' : status === '维修中' ? '维修工单处理中，暂不可分配。' : '',
  }
})

export const uiV2DeviceModels = deviceGroups.map((item) => item.model)
export const uiV2DeviceStatuses = deviceStatuses
export const uiV2ScheduleDates = Array.from({ length: 14 }, (_, index) => dateOffset(index))

const scheduleStatus = ['可租', '占用', '可租', '占用', '冲突', '维修', '可租']
export const uiV2Schedule = uiV2Devices.flatMap((device, deviceIndex) =>
  uiV2ScheduleDates.map((date, dateIndex) => {
    const status = ['维修中', '异常'].includes(device.status)
      ? '维修'
      : scheduleStatus[(deviceIndex + dateIndex) % scheduleStatus.length]
    return {
      id: `${device.id}-${date}`,
      deviceId: device.id,
      assetNo: device.assetNo,
      model: device.model,
      date,
      status,
      orderId: ['占用', '冲突'].includes(status) ? `ORD-${10023 + ((deviceIndex + dateIndex) % 24)}` : '',
      label: status === '可租' ? '可租' : status === '占用' ? '已占用' : status,
      conflictType: status === '冲突' ? '归还与新订单发货间隔不足 6 小时' : '',
    }
  })
)

export const uiV2Tasks = [
  { id: 'TASK-01', type: '今日发货', title: '大疆 Pocket 3 套装需 18:00 前发货', orderId: 'ORD-10023', deviceId: 'DEV-001', priority: 'high', dueAt: '今日 18:00', status: '待处理', actionLabel: '去发货' },
  { id: 'TASK-02', type: '今日归还', title: 'Sony A7M3 订单今日归还', orderId: 'ORD-10027', deviceId: 'DEV-005', priority: 'medium', dueAt: '今日 20:00', status: '待跟进', actionLabel: '提醒归还' },
  { id: 'TASK-03', type: '待押金', title: 'Canon G7X Mark II 押金需人工复核', orderId: 'ORD-10024', deviceId: 'DEV-002', priority: 'high', dueAt: '今日 14:30', status: '待处理', actionLabel: '核对押金' },
  { id: 'TASK-04', type: '待验机', title: '富士 X100V 已归还待验机', orderId: 'ORD-10029', deviceId: 'DEV-003', priority: 'medium', dueAt: '今日 17:00', status: '待处理', actionLabel: '开始验机' },
  { id: 'TASK-05', type: '异常处理', title: 'CCD 归还逾期 1 天，需联系客户', orderId: 'ORD-10031', deviceId: 'DEV-004', priority: 'high', dueAt: '立即处理', status: '异常', actionLabel: '处理异常' },
  { id: 'TASK-06', type: '今日发货', title: '小红书订单待创建顺丰寄件', orderId: 'ORD-10032', deviceId: 'DEV-006', priority: 'medium', dueAt: '今日 19:00', status: '待处理', actionLabel: '创建寄件' },
]

export const uiV2Risks = [
  { id: 'RISK-01', type: '逾期未还', level: '高', title: '3 单超过约定归还时间', relatedOrderId: 'ORD-10031', relatedDeviceId: 'DEV-004', description: '其中 1 单已逾期 24 小时，建议优先联系客户并记录跟进。', suggestedAction: '联系客户' },
  { id: 'RISK-02', type: '押金不足', level: '高', title: '免押失败订单仍处于待发货', relatedOrderId: 'ORD-10024', relatedDeviceId: 'DEV-002', description: '订单押金状态为免押失败，发货前需改为已收或人工复核通过。', suggestedAction: '复核押金' },
  { id: 'RISK-03', type: '设备异常', level: '中', title: 'Sony A7M3 外观复检未完成', relatedOrderId: 'ORD-10027', relatedDeviceId: 'DEV-005', description: '设备状态影响后续预约，建议先完成验机或更换设备。', suggestedAction: '查看设备' },
  { id: 'RISK-04', type: '档期冲突', level: '中', title: '富士 X100V 两单间隔不足 6 小时', relatedOrderId: 'ORD-10029', relatedDeviceId: 'DEV-003', description: '建议调整发货时间或分配同型号其他设备。', suggestedAction: '查看档期' },
  { id: 'RISK-05', type: '物流异常', level: '中', title: '顺丰运单揽收超时', relatedOrderId: 'ORD-10035', relatedDeviceId: 'DEV-011', description: '运单创建后 4 小时未揽收，需要联系快递员或重下单。', suggestedAction: '查看物流' },
]

export const uiV2Shipping = uiV2Orders.slice(0, 24).map((order, index) => ({
  id: `SHP-${7000 + index}`,
  orderId: order.orderNo,
  carrier: '顺丰速运',
  trackingNo: index % 5 === 0 ? '' : `SF${String(132000000000 + index * 92837)}`,
  status: shippingStatuses[index % shippingStatuses.length],
  sender: '小狗相机深圳仓',
  receiver: order.customerName,
  receiverAddress: order.address,
  insuredAmount: [3000, 5000, 8000, 12000][index % 4],
  pickupTime: ['今天 16:00-18:00', '今天 18:00-20:00', '明天 09:00-11:00'][index % 3],
  steps: [
    { label: '确认寄件信息', done: true },
    { label: '生成顺丰运单', done: index % 5 !== 0 },
    { label: '等待揽收', done: ['待揽收', '运输中', '已签收'].includes(shippingStatuses[index % shippingStatuses.length]) },
    { label: '客户签收', done: shippingStatuses[index % shippingStatuses.length] === '已签收' },
  ],
}))

export const uiV2Customers = uiV2Orders.slice(0, 18).map((order, index) => {
  const riskLevel = ['正常', '低', '中', '高'][index % 4]
  const orderCount = 1 + (index % 7)
  return {
    id: `CUS-${String(3001 + index)}`,
    name: order.customerName,
    phoneMasked: order.phoneMasked,
    channel: order.channel,
    city: ['深圳', '广州', '杭州', '上海'][index % 4],
    riskLevel,
    tags: [['稳定复租', '高价值设备'], ['学生用户', '需确认地址'], ['企业拍摄', '复租潜力'], ['逾期关注', '人工复核']][index % 4],
    orderCount,
    totalRent: order.rentAmount * orderCount + index * 128,
    depositPreference: order.depositStatus.includes('免押') ? '偏好免押' : '押金正常',
    lastOrderNo: order.orderNo,
    lastRentAt: order.createdAt,
    nextAction: riskLevel === '高' ? '复核后再接单' : index % 3 === 0 ? '推荐复租套餐' : '保持跟进',
    note: riskLevel === '高' ? '近 30 天存在逾期或验机争议，需要人工确认后再接高价值设备。' : '租赁记录完整，可按常规流程处理。',
  }
})

export const uiV2DepositReviews = uiV2Orders.slice(0, 16).map((order, index) => {
  const riskLevel = ['低', '中', '高'][index % 3]
  const reviewStatus = ['待审核', '待复核', '已通过', '已拒绝'][index % 4]
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
    riskReason: riskLevel === '高' ? '历史订单存在逾期或地址一致性待确认。' : riskLevel === '中' ? '设备价值较高，建议二次确认身份证与收货地址。' : '历史履约记录稳定，可按常规规则审核。',
    nextAction: reviewStatus === '待审核' ? '初审资料' : reviewStatus === '待复核' ? '人工复核' : '查看记录',
  }
})

export const uiV2Waybills = uiV2Shipping.map((item) => {
  const order = uiV2Orders.find((orderItem) => orderItem.orderNo === item.orderId)
  return {
    ...item,
    customerName: order?.customerName || item.receiver,
    model: order?.model || '大疆 Pocket 3',
    orderStatus: order?.status || '待发货',
    shippingStatus: item.status,
    nextAction: { 待下单: '创建运单', 待揽收: '确认揽收', 运输中: '跟进轨迹', 已签收: '等待客户确认', 异常: '处理异常' }[item.status] || '查看运单',
    timeline: item.steps.map((step, stepIndex) => ({
      label: step.label,
      desc: step.done ? '已完成' : stepIndex === item.steps.findIndex((entry) => !entry.done) ? '当前节点' : '等待前置节点',
      done: step.done,
      current: !step.done && stepIndex === item.steps.findIndex((entry) => !entry.done),
    })),
  }
})

export const uiV2Report = {
  kpis: [
    { key: 'revenue', label: '租金收入', value: '86,420', unit: '元', trend: '+12.4%', tone: 'success' },
    { key: 'orders', label: '订单量', value: 214, unit: '单', trend: '+18 单', tone: 'info' },
    { key: 'utilization', label: '设备利用率', value: 76, unit: '%', trend: '+6%', tone: 'success' },
    { key: 'exception', label: '异常率', value: 3.8, unit: '%', trend: '-1.2%', tone: 'warning' },
  ],
  revenueTrend: [
    { label: '06/11', value: 42, valueLabel: '4.2k' },
    { label: '06/12', value: 56, valueLabel: '5.6k' },
    { label: '06/13', value: 48, valueLabel: '4.8k' },
    { label: '06/14', value: 63, valueLabel: '6.3k' },
    { label: '06/15', value: 78, valueLabel: '7.8k' },
    { label: '06/16', value: 66, valueLabel: '6.6k' },
    { label: '06/17', value: 84, valueLabel: '8.4k' },
  ],
  channelTrend: [
    { label: '闲鱼', value: 72, valueLabel: '72单' },
    { label: '小红书', value: 54, valueLabel: '54单' },
    { label: '抖音', value: 38, valueLabel: '38单' },
    { label: '私域', value: 46, valueLabel: '46单' },
  ],
  modelRanking: [
    { rank: 1, model: '大疆 Pocket 3', orders: 46, revenue: '18,960', utilization: '86%', signal: '短租需求稳定' },
    { rank: 2, model: 'Canon G7X Mark II', orders: 39, revenue: '16,880', utilization: '79%', signal: '周末需求高' },
    { rank: 3, model: '富士 X100V', orders: 31, revenue: '15,640', utilization: '74%', signal: '高押金需复核' },
    { rank: 4, model: 'CCD', orders: 28, revenue: '8,260', utilization: '68%', signal: '适合私域套餐' },
    { rank: 5, model: 'Sony A7M3', orders: 22, revenue: '14,980', utilization: '71%', signal: '企业客户占比高' },
  ],
  insights: [
    { title: 'Pocket 3 今天仍是最高优先级', desc: '待分配订单集中在短租场景，建议优先保障深圳仓可租池。' },
    { title: '免押审核影响高价值设备周转', desc: '富士和全画幅订单的人工复核占比偏高，需要预留审核时间。' },
    { title: '物流异常不应进入统计闭环', desc: '当前报表只展示 mock 指标，不接真实物流或财务统计接口。' },
  ],
}

export const uiV2Settings = [
  { id: 'merchant', group: '组织', title: '商家信息', status: '已配置', variant: 'success', desc: '商家名称、联系人、经营主体和默认仓库。', fields: [{ label: '商家名称', value: '小狗相机助手商户版' }, { label: '默认仓库', value: '深圳总仓' }, { label: '运营负责人', value: '阿宁' }] },
  { id: 'stores', group: '组织', title: '门店与仓库', status: '已配置', variant: 'success', desc: '门店、仓库、发货地址和归还地址。', fields: [{ label: '门店数量', value: '3' }, { label: '默认发货地', value: '深圳总仓' }, { label: '合作仓', value: '杭州合作仓' }] },
  { id: 'staff', group: '权限', title: '员工角色', status: '需处理', variant: 'warning', desc: '员工账号、角色、操作范围和交接班。', fields: [{ label: '员工数量', value: '12' }, { label: '待确认角色', value: '2' }, { label: '默认角色', value: '履约运营' }] },
  { id: 'logistics', group: '履约', title: '物流设置', status: '已配置', variant: 'success', desc: '顺丰寄件模板、保价规则、发货备注。', fields: [{ label: '默认承运商', value: '顺丰速运' }, { label: '默认保价', value: '按押金取高值' }, { label: '揽收窗口', value: '16:00-20:00' }] },
  { id: 'deposit', group: '风控', title: '押金/免押规则', status: '未配置', variant: 'neutral', desc: '押金标准、免押审核、人工复核条件。', fields: [{ label: '押金规则', value: '按型号模板' }, { label: '免押策略', value: '待确认' }, { label: '人工复核', value: '开启' }] },
  { id: 'notify', group: '触达', title: '通知模板', status: '需处理', variant: 'warning', desc: '发货、归还、逾期和验机通知模板。', fields: [{ label: '发货模板', value: '已配置' }, { label: '逾期模板', value: '需处理' }, { label: '验机模板', value: '未配置' }] },
]

export const uiV2Options = {
  orderStatuses,
  channels,
  depositStatuses,
  shippingStatuses,
  deviceModels: uiV2DeviceModels,
  deviceStatuses,
}
