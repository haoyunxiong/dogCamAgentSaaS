const provinceAliases = [
  ['北京市', '北京'],
  ['天津市', '天津'],
  ['上海市', '上海'],
  ['重庆市', '重庆'],
  ['河北省', '河北'],
  ['山西省', '山西'],
  ['辽宁省', '辽宁'],
  ['吉林省', '吉林'],
  ['黑龙江省', '黑龙江'],
  ['江苏省', '江苏'],
  ['浙江省', '浙江'],
  ['安徽省', '安徽'],
  ['福建省', '福建'],
  ['江西省', '江西'],
  ['山东省', '山东'],
  ['河南省', '河南'],
  ['湖北省', '湖北'],
  ['湖南省', '湖南'],
  ['广东省', '广东'],
  ['海南省', '海南'],
  ['四川省', '四川'],
  ['贵州省', '贵州'],
  ['云南省', '云南'],
  ['陕西省', '陕西'],
  ['甘肃省', '甘肃'],
  ['青海省', '青海'],
  ['台湾省', '台湾'],
  ['内蒙古自治区', '内蒙古'],
  ['广西壮族自治区', '广西'],
  ['西藏自治区', '西藏'],
  ['宁夏回族自治区', '宁夏'],
  ['新疆维吾尔自治区', '新疆'],
  ['香港特别行政区', '香港'],
  ['澳门特别行政区', '澳门'],
]

const cityAliases = {
  成都: '成都市',
  绵阳: '绵阳市',
  德阳: '德阳市',
  宜宾: '宜宾市',
  乐山: '乐山市',
  南充: '南充市',
  泸州: '泸州市',
  达州: '达州市',
  自贡: '自贡市',
  北京: '北京市',
  上海: '上海市',
  天津: '天津市',
  重庆: '重庆市',
  广州: '广州市',
  深圳: '深圳市',
  杭州: '杭州市',
  南京: '南京市',
  武汉: '武汉市',
  西安: '西安市',
}

function hasValue(value) {
  return String(value ?? '').trim() !== ''
}

function hasPositiveNumber(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) && number > 0
}

export function stripContactLabels(text) {
  return String(text || '')
    .replace(/(收货人|收件人|联系人|姓名|电话|手机|手机号|收货地址|详细地址|地址)\s*[:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseChinaAddress(text) {
  let rest = String(text || '').replace(/\s+/g, '').trim()
  const source = rest
  const result = { province: '', city: '', district: '', address: '' }
  if (!rest) return result

  for (const [full, short] of provinceAliases) {
    if (rest.startsWith(full)) {
      result.province = full
      rest = rest.slice(full.length)
      break
    }
    if (rest.startsWith(short)) {
      result.province = full
      rest = rest.slice(short.length)
      break
    }
  }

  if (['北京市', '天津市', '上海市', '重庆市'].includes(result.province)) {
    result.city = result.province
  } else {
    const cityMatch = rest.match(/^([\u4e00-\u9fa5]{2,12}?(?:市|州|盟|地区))/)
    if (cityMatch) {
      result.city = cityMatch[1]
      rest = rest.slice(cityMatch[1].length)
    } else {
      const cityKey = Object.keys(cityAliases).find((key) => rest.startsWith(key))
      if (cityKey) {
        result.city = cityAliases[cityKey]
        rest = rest.slice(cityKey.length)
      }
    }
  }

  const districtMatch = rest.match(/^([\u4e00-\u9fa5]{1,12}?(?:区|县|市|旗|镇|乡))/)
  if (districtMatch) {
    result.district = districtMatch[1]
    rest = rest.slice(districtMatch[1].length)
  }
  result.address = rest
  if (!result.province && !result.city && !result.district) result.address = source
  return result
}

export function parseRecipientInfo(text) {
  const raw = String(text || '').trim()
  if (!raw) return {}
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const compact = raw.replace(/[，,]/g, ' ').replace(/\s+/g, ' ').trim()
  const phoneMatch = compact.match(/(?:\+?86[-\s]?)?(1[3-9]\d{9})/) || compact.match(/\b(\d{7,14})\b/)
  const phone = phoneMatch?.[1] || ''
  const nameFromLabel = raw.match(/(?:收货人|收件人|联系人|姓名)\s*[:：]\s*([^\s，,;；\n]{2,20})/)
  const addressFromLabel = raw.match(/(?:收货地址|详细地址|地址)\s*[:：]\s*([^\n]+)/)

  let name = nameFromLabel?.[1] || ''
  if (!name && phone) {
    const beforePhone = compact.slice(0, compact.indexOf(phone)).trim()
    const tokens = stripContactLabels(beforePhone).split(/\s+/).filter(Boolean)
    name = tokens[tokens.length - 1] || ''
  }
  if (!name) {
    const firstLine = stripContactLabels(lines[0] || '')
    name = firstLine.split(/\s+/).find((item) => !/\d/.test(item) && item.length <= 20) || ''
  }

  let addressText = addressFromLabel?.[1] || ''
  if (!addressText && phone) {
    addressText = compact.slice(compact.indexOf(phone) + phone.length).trim()
  }
  if (!addressText) {
    addressText = lines.find((line) => /(省|市|区|县|镇|街道|路|号|栋|单元)/.test(line)) || compact
  }
  addressText = stripContactLabels(addressText)
    .replace(phone, '')
    .replace(name, '')
    .trim()

  return {
    name,
    phone,
    ...parseChinaAddress(addressText),
  }
}

export function getOrderCompletionState(order = {}) {
  const missingFields = []
  const blockingFields = []

  const shipmentRequired = [
    ['客户姓名', order.customer_name],
    ['客户手机号', order.customer_phone],
    ['省份', order.province],
    ['城市', order.city],
    ['详细地址', order.address],
  ]

  for (const [label, value] of shipmentRequired) {
    if (!hasValue(value)) {
      missingFields.push(label)
      blockingFields.push(label)
    }
  }

  if (!hasValue(order.order_no)) missingFields.push('平台订单号')
  if (!hasPositiveNumber(order.fee)) missingFields.push('费用')
  if (!hasValue(order.unit_id) && !hasValue(order.unit_code)) missingFields.push('设备')
  if (!hasValue(order.rent_start_date)) missingFields.push('开始日期')
  if (!hasValue(order.rent_end_date)) missingFields.push('结束日期')

  const pendingShip = hasValue(order.planned_ship_at) && !hasValue(order.actual_ship_at)
  if (pendingShip && !hasValue(order.tracking_no)) missingFields.push('运单号')

  if (blockingFields.length) {
    return {
      primaryStatus: 'shipping_missing',
      label: '待补收货',
      variant: 'warning',
      missingFields,
      blockingFields,
      canCreateSfShipment: false,
    }
  }

  const followupFields = missingFields.filter((field) => ['平台订单号', '费用', '运单号'].includes(field))
  if (followupFields.length) {
    return {
      primaryStatus: 'followup_missing',
      label: followupFields.includes('平台订单号') ? '待补单号' : '待补资料',
      variant: 'neutral',
      missingFields,
      blockingFields: [],
      canCreateSfShipment: true,
    }
  }

  return {
    primaryStatus: 'complete',
    label: '资料完整',
    variant: 'success',
    missingFields,
    blockingFields: [],
    canCreateSfShipment: true,
  }
}
