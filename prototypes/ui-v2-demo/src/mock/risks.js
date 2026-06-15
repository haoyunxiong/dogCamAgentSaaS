export const risks = [
  { id: 'RISK-01', type: '逾期未还', level: 'high', title: '3 单超过约定归还时间', relatedOrderId: 'ORD-10031', relatedDeviceId: 'DEV-004', description: '其中 1 单已逾期 24 小时，建议优先联系客户并记录跟进。', suggestedAction: '联系客户' },
  { id: 'RISK-02', type: '押金不足', level: 'high', title: '免押失败订单仍处于待发货', relatedOrderId: 'ORD-10024', relatedDeviceId: 'DEV-002', description: '订单押金状态为免押失败，发货前需改为已收或人工复核通过。', suggestedAction: '复核押金' },
  { id: 'RISK-03', type: '设备异常', level: 'medium', title: 'Sony A7M3 外观复检未完成', relatedOrderId: 'ORD-10027', relatedDeviceId: 'DEV-005', description: '设备状态影响后续预约，建议先完成验机或更换设备。', suggestedAction: '查看设备' },
  { id: 'RISK-04', type: '档期冲突', level: 'medium', title: '富士 X100V 两单间隔不足 6 小时', relatedOrderId: 'ORD-10029', relatedDeviceId: 'DEV-003', description: '建议调整发货时间或分配同型号其他设备。', suggestedAction: '查看档期' },
  { id: 'RISK-05', type: '物流异常', level: 'medium', title: '顺丰运单揽收超时', relatedOrderId: 'ORD-10035', relatedDeviceId: 'DEV-011', description: '运单创建后 4 小时未揽收，需要联系快递员或重下单。', suggestedAction: '查看物流' }
]
