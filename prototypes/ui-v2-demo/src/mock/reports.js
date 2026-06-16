export const reportKpis = [
  { key: 'revenue', label: '租金收入', value: '86,420', unit: '元', trend: '+12.4%', tone: 'success' },
  { key: 'orders', label: '订单量', value: 214, unit: '单', trend: '+18 单', tone: 'info' },
  { key: 'utilization', label: '设备利用率', value: 76, unit: '%', trend: '+6%', tone: 'success' },
  { key: 'exception', label: '异常率', value: 3.8, unit: '%', trend: '-1.2%', tone: 'warning' }
]

export const revenueTrend = [
  { label: '06/08', value: 42, valueLabel: '4.2k' },
  { label: '06/09', value: 56, valueLabel: '5.6k' },
  { label: '06/10', value: 48, valueLabel: '4.8k' },
  { label: '06/11', value: 63, valueLabel: '6.3k' },
  { label: '06/12', value: 78, valueLabel: '7.8k' },
  { label: '06/13', value: 66, valueLabel: '6.6k' },
  { label: '06/14', value: 84, valueLabel: '8.4k' }
]

export const channelTrend = [
  { label: '闲鱼', value: 72, valueLabel: '72单' },
  { label: '小红书', value: 54, valueLabel: '54单' },
  { label: '抖音', value: 38, valueLabel: '38单' },
  { label: '私域', value: 46, valueLabel: '46单' }
]

export const utilizationTrend = [
  { label: 'Pocket 3', value: 86, valueLabel: '86%' },
  { label: 'G7X', value: 79, valueLabel: '79%' },
  { label: 'X100V', value: 74, valueLabel: '74%' },
  { label: 'CCD', value: 68, valueLabel: '68%' },
  { label: 'A7M3', value: 71, valueLabel: '71%' }
]

export const reportPulse = [
  { label: '订单增长', value: '+12.4%', note: '周末短租拉动' },
  { label: '免押卡点', value: '17 单', note: '高价值设备需复核' },
  { label: '设备缺口', value: '6 台', note: 'Pocket 3 最紧张' },
  { label: '物流异常', value: '3 单', note: '需人工跟进' }
]

export const modelRanking = [
  { rank: 1, model: '大疆 Pocket 3', orders: 46, revenue: '18,960', utilization: '86%', signal: '短租需求稳定' },
  { rank: 2, model: 'Canon G7X Mark II', orders: 39, revenue: '16,880', utilization: '79%', signal: '周末需求高' },
  { rank: 3, model: '富士 X100V', orders: 31, revenue: '15,640', utilization: '74%', signal: '高押金需复核' },
  { rank: 4, model: 'CCD', orders: 28, revenue: '8,260', utilization: '68%', signal: '适合私域套餐' },
  { rank: 5, model: 'Sony A7M3', orders: 22, revenue: '14,980', utilization: '71%', signal: '企业客户占比高' }
]

export const reportInsights = [
  { title: 'Pocket 3 今天仍是最高优先级', desc: '待分配订单集中在短租场景，建议优先保障深圳仓可租池。' },
  { title: '免押审核影响高价值设备周转', desc: '富士和全画幅订单的人工复核占比偏高，需要预留审核时间。' },
  { title: '物流异常不应进入统计闭环', desc: '当前报表只展示 mock 指标，不接真实物流或财务统计接口。' }
]
