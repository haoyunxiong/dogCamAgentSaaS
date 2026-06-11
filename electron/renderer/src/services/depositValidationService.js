export function validateCreateParams(params = {}) {
  const productName = String(params.productName || '').trim()
  const depositAmount = Number(params.depositAmount)
  const rentStartDate = String(params.rentStartDate || '').trim()
  const rentEndDate = String(params.rentEndDate || '').trim()

  if (!productName) return '商品名称不能为空'
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) return '押金金额必须大于 0'
  if (!rentStartDate || !rentEndDate) return '租期开始和结束日期不能为空'

  const start = new Date(`${rentStartDate}T00:00:00`)
  const end = new Date(`${rentEndDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '租期日期格式不正确'
  if (end < start) return '租期结束日期不能早于开始日期'
  return ''
}
