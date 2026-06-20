export const ORDER_CREATE_STEPS = Object.freeze([
  { key: 'schedule', label: '档期与设备' },
  { key: 'customer', label: '客户与地址' },
  { key: 'price', label: '价格与押金' },
  { key: 'confirm', label: '确认创建' },
])

export function canSubmitOrderWizard({ hold, customer, price } = {}) {
  return Boolean(
    hold?.holdNo
    && customer?.customerName
    && customer?.customerPhone
    && customer?.province
    && customer?.city
    && customer?.district
    && customer?.address
    && price?.sourceChannel
  )
}

export function buildOrderWizardSummary({ hold, customer, price } = {}) {
  return [
    { label: '临时锁定', value: hold?.holdNo || '未选择' },
    { label: '设备', value: hold?.unitCode || '-' },
    { label: '租期', value: hold ? `${hold.rentStartDate} 至 ${hold.rentEndDate}` : '-' },
    { label: '客户', value: customer?.customerName || '待填写' },
    { label: '渠道', value: price?.sourceChannel || '待选择' },
    { label: '租金', value: `¥${Number(price?.fee || 0).toFixed(2)}` },
    { label: '押金/免押', value: `¥${Number(price?.deposit || 0).toFixed(2)}` },
  ]
}
