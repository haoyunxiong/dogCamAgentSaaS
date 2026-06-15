export const metrics = [
  { key: 'todayOrders', label: '今日订单', value: 18, unit: '单', trend: '+4', tone: 'info' },
  { key: 'todayRent', label: '今日租金', value: '12,860', unit: '元', trend: '+18%', tone: 'success' },
  { key: 'shipToday', label: '待发货', value: 9, unit: '单', trend: '18:00 前', tone: 'warning' },
  { key: 'returnToday', label: '待归还', value: 7, unit: '单', trend: '含 2 单逾期', tone: 'warning' },
  { key: 'overdue', label: '逾期订单', value: 3, unit: '单', trend: '需跟进', tone: 'danger' },
  { key: 'utilization', label: '设备利用率', value: 76, unit: '%', trend: '+6%', tone: 'success' }
]
