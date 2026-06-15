const modelGroups = [
  { model: '大疆 Pocket 3', category: '运动相机', prefix: 'DJI-P3' },
  { model: 'Canon G7X Mark II', category: '卡片机', prefix: 'CAN-G7X' },
  { model: '富士 X100V', category: '复古相机', prefix: 'FUJI-X100V' },
  { model: 'CCD', category: '复古数码', prefix: 'CCD-MIX' },
  { model: 'Sony A7M3', category: '全画幅相机', prefix: 'SONY-A7M3' }
]

const statuses = ['可租', '已预订', '在租', '待清洁', '维修中', '异常', '停用']
const locations = ['深圳仓 A 区', '深圳仓 B 区', '广州门店', '杭州合作仓', '上海临时仓']
const maintenance = ['正常', '待清洁', '镜头检查', '按键维修', '传感器清洁', '外观复检']

function dateOffset(days) {
  const base = new Date('2026-06-14T00:00:00')
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export const devices = Array.from({ length: 36 }, (_, index) => {
  const group = modelGroups[index % modelGroups.length]
  const status = statuses[index % statuses.length]
  const orderId = status === '在租' || status === '已预订' ? `ORD-${10023 + (index % 24)}` : null

  return {
    id: `DEV-${String(index + 1).padStart(3, '0')}`,
    assetNo: `${group.prefix}-${String(index + 1).padStart(3, '0')}`,
    category: group.category,
    model: group.model,
    serialNo: `SN${String(860000 + index * 137)}`,
    status,
    location: locations[index % locations.length],
    currentOrderId: orderId,
    nextBookingDate: dateOffset((index % 10) + 1),
    maintenanceStatus: maintenance[index % maintenance.length],
    utilization: 48 + (index * 7) % 45,
    lastCheckedAt: dateOffset(-(index % 8)),
    conditionNote: status === '异常' ? '归还验机发现外壳磕碰，待客服确认赔付。' : status === '维修中' ? '维修工单处理中，暂不可分配。' : ''
  }
})

export const deviceModels = modelGroups.map((item) => item.model)
export const deviceStatuses = statuses
