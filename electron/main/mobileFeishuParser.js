const DAY_MS = 24 * 60 * 60 * 1000

const cityAliases = [
  ['成都市', '成都'],
  ['杭州市', '杭州'],
  ['北京市', '北京'],
  ['上海市', '上海'],
  ['广州市', '广州'],
  ['深圳市', '深圳'],
  ['南京市', '南京'],
  ['武汉市', '武汉'],
  ['西安市', '西安'],
  ['重庆市', '重庆'],
]

const provinceAliases = [
  ['四川省', '四川'],
  ['浙江省', '浙江'],
  ['广东省', '广东'],
  ['江苏省', '江苏'],
  ['湖北省', '湖北'],
  ['陕西省', '陕西'],
  ['北京市', '北京'],
  ['上海市', '上海'],
  ['重庆市', '重庆'],
]

const districtAliases = [
  ['武侯区', '武侯'],
  ['西湖区', '西湖'],
]

const cityProvinceAliases = {
  成都: '四川省',
  成都市: '四川省',
  杭州: '浙江省',
  杭州市: '浙江省',
  北京: '北京市',
  北京市: '北京市',
  上海: '上海市',
  上海市: '上海市',
  广州: '广东省',
  广州市: '广东省',
  深圳: '广东省',
  深圳市: '广东省',
  南京: '江苏省',
  南京市: '江苏省',
  武汉: '湖北省',
  武汉市: '湖北省',
  西安: '陕西省',
  西安市: '陕西省',
  重庆: '重庆市',
  重庆市: '重庆市',
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseLocalDate(dateText) {
  return new Date(`${dateText}T00:00:00+08:00`)
}

function addDays(dateText, days) {
  const date = parseLocalDate(dateText)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function inclusiveDays(startDate, endDate) {
  if (!startDate || !endDate) return 0
  return Math.max(1, Math.round((parseLocalDate(endDate) - parseLocalDate(startDate)) / DAY_MS) + 1)
}

function normalizeModelText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '')
}

function normalizeCommandText(value) {
  return String(value || '')
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10))
    .replace(/＃/g, '#')
}

function resolveModelCode(text, modelCodes = []) {
  const normalizedText = normalizeModelText(text)
  const sorted = [...modelCodes].sort((a, b) => String(b).length - String(a).length)
  const exact = sorted.find((model) => normalizedText.includes(normalizeModelText(model)))
  if (exact) return exact

  const tokenSource = String(text || '').toLowerCase()
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, ' ')
    .replace(/\d{1,2}[./]\d{1,2}/g, ' ')
    .replace(/\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号)?/g, ' ')
    .replace(/租\s*\d{1,3}\s*天/g, ' ')
  const tokens = tokenSource.match(/[a-z]+[0-9a-z]*|[0-9]+[a-z]+[0-9a-z]*/g) || []
  return sorted.find((model) => {
    const normalizedModel = normalizeModelText(model)
    return tokens.some((token) => token.length >= 3 && normalizedModel.includes(token))
  }) || ''
}

function normalizeDateMatch(month, day, now = new Date()) {
  const year = now.getFullYear()
  return `${year}-${pad2(Number(month))}-${pad2(Number(day))}`
}

function findDateTokens(text, now) {
  const tokens = []
  const patterns = [
    /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/g,
    /(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/g,
    /(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      if (match.length === 4) {
        tokens.push({ index: match.index, value: `${match[1]}-${pad2(match[2])}-${pad2(match[3])}` })
      } else {
        tokens.push({ index: match.index, value: normalizeDateMatch(match[1], match[2], now) })
      }
    }
  }

  return tokens.sort((a, b) => a.index - b.index)
}

function extractRentDays(text) {
  const match = String(text || '').match(/(?:租|租期|租赁)?\s*(\d{1,3})\s*天/)
  return match ? Number(match[1]) : 0
}

function extractTransitDays(text) {
  const match = String(text || '').match(/(?:运输|物流|快递|在途|路上)\s*(?:需要|预计|约)?\s*(\d{1,3})\s*天/)
  return match ? Number(match[1]) : 0
}

function extractFee(text) {
  const match = String(text || '').match(/(?:租金|费用|金额|价格)\s*[:：]?\s*(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

function extractPhone(text) {
  return String(text || '').match(/1[3-9]\d{9}/)?.[0] || ''
}

function normalizeRecipientName(raw) {
  const text = String(raw || '')
    .replace(/<at[^>]*>.*?<\/at>/g, '')
    .replace(/@\S+/g, '')
    .replace(/^(记档期|建单|记订单|查档期|查询档期)\s*/u, '')
    .replace(/\b[a-zA-Z0-9_-]+\b/g, '')
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, '')
    .replace(/\d{1,2}\s*月\s*\d{1,2}\s*(日|号)?/g, '')
    .replace(/\d{1,2}[./]\d{1,2}/g, '')
    .replace(/租\s*\d{1,3}\s*天/g, '')
    .replace(/租金\s*[:：]?\s*\d+(?:\.\d+)?/g, '')
    .trim()
  return text.split(/\s+/).filter(Boolean).slice(-1)[0] || ''
}

function stripCommandAndMentions(text) {
  return String(text || '')
    .replace(/<at[^>]*>.*?<\/at>/g, '')
    .replace(/@\S+/g, '')
    .replace(/^(记档期|建单|记订单|查档期|查询档期)\s*/u, '')
    .trim()
}

function cutKnownAddressFromName(text, addressParts = {}) {
  let source = stripCommandAndMentions(text)
  const indexes = [addressParts.province, addressParts.city, addressParts.district]
    .filter(Boolean)
    .map((part) => source.indexOf(part))
    .filter((index) => index >= 0)
  if (indexes.length) source = source.slice(0, Math.min(...indexes)).trim()
  return normalizeRecipientName(source)
}

function extractAddressAfterKnownRegion(text, addressParts = {}) {
  const source = stripCommandAndMentions(text)
  const anchors = [addressParts.district, addressParts.city, addressParts.province].filter(Boolean)
  for (const anchor of anchors) {
    const index = source.indexOf(anchor)
    if (index >= 0) {
      return source.slice(index + anchor.length)
        .replace(/1[3-9]\d{9}/g, '')
        .replace(/租金\s*[:：]?\s*\d+(?:\.\d+)?/g, '')
        .trim()
    }
  }
  return ''
}

function cleanAddressDetail(value) {
  return String(value || '')
    .replace(/(?:收货地址|详细地址|地址)\s*[:：]?\s*/g, '')
    .replace(/1[3-9]\d{9}/g, '')
    .replace(/租金\s*[:：]?\s*\d+(?:\.\d+)?/g, '')
    .trim()
}

function parseRecipientAddress(text) {
  const source = String(text || '').replace(/[，,]/g, ' ').replace(/\s+/g, ' ').trim()
  const result = { province: '', city: '', district: '', address: '' }
  if (!source) return result

  const provinceMatch = source.match(/(北京市|天津市|上海市|重庆市|河北省|山西省|辽宁省|吉林省|黑龙江省|江苏省|浙江省|安徽省|福建省|江西省|山东省|河南省|湖北省|湖南省|广东省|海南省|四川省|贵州省|云南省|陕西省|甘肃省|青海省|台湾省|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区)/)
  let rest = source
  if (provinceMatch) {
    result.province = provinceMatch[1]
    rest = source.slice(source.indexOf(provinceMatch[1]) + provinceMatch[1].length).trim()
    if (['北京市', '上海市', '天津市', '重庆市'].includes(result.province)) result.city = result.province
  }

  if (!result.city) {
    const cityMatch = rest.match(/^([\u4e00-\u9fa5]{2,12}(?:市|自治州|地区|盟))/)
    if (cityMatch) {
      result.city = cityMatch[1]
      rest = rest.slice(cityMatch[1].length).trim()
    }
  }

  if (!result.city) {
    for (const [full, short] of cityAliases) {
      const cityValue = source.includes(full) ? full : source.includes(short) ? short : ''
      if (!cityValue) continue
      result.city = cityValue
      rest = source.slice(source.indexOf(cityValue) + cityValue.length).trim()
      break
    }
  }

  if (!result.province && result.city) {
    result.province = cityProvinceAliases[result.city] || ''
  }

  const districtMatch = rest.match(/^([\u4e00-\u9fa5]{1,12}(?:区|县|旗|市|镇|乡))/)
  if (districtMatch) {
    result.district = districtMatch[1]
    rest = rest.slice(districtMatch[1].length).trim()
  } else {
    for (const [full, short] of districtAliases) {
      const districtValue = rest.startsWith(full) ? full : rest.startsWith(short) ? short : ''
      if (!districtValue) continue
      result.district = districtValue
      rest = rest.slice(districtValue.length).trim()
      break
    }
  }

  result.address = cleanAddressDetail(rest)
  if (!result.province && !result.city && !result.district) result.address = cleanAddressDetail(source)
  return result
}

function extractAddressParts(text) {
  const source = String(text || '')
  const parsedAddress = parseRecipientAddress(source)
  if (parsedAddress.province || parsedAddress.city || parsedAddress.district) return parsedAddress
  const result = { province: '', city: '', district: '', address: '' }

  for (const [full, short] of provinceAliases) {
    if (source.includes(full) || source.includes(short)) {
      result.province = full
      break
    }
  }
  for (const [full, short] of cityAliases) {
    if (source.includes(full)) {
      result.city = full
      break
    }
    if (source.includes(short)) {
      result.city = short
      break
    }
  }

  for (const [full, short] of districtAliases) {
    if (source.includes(full)) {
      result.district = full
      break
    }
    if (source.includes(short)) {
      result.district = short
      break
    }
  }

  if (!result.province && result.city) {
    result.province = cityProvinceAliases[result.city] || ''
  }

  if (!result.district) {
    const withoutKnownRegion = source
      .replace(result.province, '')
      .replace(result.city, '')
    const districtMatch = withoutKnownRegion.match(/([\u4e00-\u9fa5]{1,6}(?:区|县))/)
    if (districtMatch) result.district = districtMatch[1]
  }

  const phone = extractPhone(source)
  if (phone) {
    const afterPhone = source.slice(source.indexOf(phone) + phone.length).trim()
    result.address = afterPhone
      .replace(/租金\s*[:：]?\s*\d+(?:\.\d+)?/g, '')
      .replace(result.province, '')
      .replace(result.city, '')
      .replace(result.district, '')
      .trim()
    if (!result.address) {
      const beforePhone = source.slice(0, source.indexOf(phone)).trim()
      result.address = extractAddressAfterKnownRegion(beforePhone, result)
    }
  }

  if (!result.address && /地址/.test(source)) {
    const addressMatch = source.match(/(?:发|到|地址)\s*([\u4e00-\u9fa5A-Za-z0-9#栋单元室号路街道区县市省-]+)/)
    result.address = addressMatch?.[1] || ''
  }

  return result
}

function parseFeishuRentalCommand(text, options = {}) {
  const rawText = normalizeCommandText(text).trim()
  const now = options.now || new Date()
  const modelCodes = options.modelCodes || []
  const directFulfillmentAction = rawText.match(/(?:确认|标记|已|已经)?\s*(发货|寄出|归还|寄回|完结)\s*#?\s*(\d{1,10})/)
  const directFulfillmentWord = directFulfillmentAction?.[1] || ''
  const directFulfillmentTaskType = /发货|寄出/.test(directFulfillmentWord)
    ? 'ship'
    : /归还|寄回|完结/.test(directFulfillmentWord)
      ? 'return'
      : ''
  const taskDatePreset = /明日|明天|次日/.test(rawText) ? 'tomorrow' : 'today'
  const taskType = directFulfillmentTaskType || (/归还|寄回|回收|完结/.test(rawText)
    ? 'return'
    : /发货|寄出/.test(rawText)
      ? 'ship'
      : 'all')
  const isFulfillmentTaskCommand = /待办|待发货|待归还|今日发货|明日发货|今天发货|明天发货|今日归还|明日归还|今天归还|明天归还/.test(rawText)
  const intent = directFulfillmentAction
    ? 'fulfillment_action'
    : isFulfillmentTaskCommand
    ? 'fulfillment_tasks'
    : /记档期|建单|记订单|录订单/.test(rawText)
    ? 'booking'
    : /查档期|查询档期|有没有档期|有档期/.test(rawText)
      ? 'availability'
      : 'unknown'
  const modelCode = resolveModelCode(rawText, modelCodes)
  const dateTokens = findDateTokens(rawText, now)
  const rentDays = extractRentDays(rawText)
  const rentStartDate = dateTokens[0]?.value || ''
  const rentEndDate = dateTokens[1]?.value || (rentStartDate && rentDays ? addDays(rentStartDate, rentDays - 1) : '')
  const phone = extractPhone(rawText)
  const phoneIndex = phone ? rawText.indexOf(phone) : -1
  const beforePhone = phoneIndex >= 0 ? rawText.slice(0, phoneIndex) : ''
  const addressParts = extractAddressParts(rawText)
  const transitDays = extractTransitDays(rawText)

  return {
    intent,
    text: rawText,
    orderId: directFulfillmentAction ? Number(directFulfillmentAction[2]) : 0,
    actionType: directFulfillmentTaskType === 'ship'
      ? 'mark_shipped'
      : directFulfillmentTaskType === 'return'
        ? 'mark_returned'
        : '',
    taskDatePreset,
    taskType,
    modelCode,
    rentStartDate,
    rentEndDate,
    rentDays: rentDays || inclusiveDays(rentStartDate, rentEndDate),
    customerName: phone ? cutKnownAddressFromName(beforePhone, addressParts) : '',
    customerPhone: phone,
    ...addressParts,
    fee: extractFee(rawText),
    deposit: 0,
    shippingMode: /次晨/.test(rawText) ? 'next_morning' : /普通快递|快递|顺丰|SF/i.test(rawText) ? 'express' : 'land',
    returnBufferDays: 2,
    ...(transitDays > 0 ? { transitDays } : {}),
  }
}

function buildAvailabilityPayload(parsed) {
  const payload = {
    modelCode: parsed.modelCode || '',
    rentStartDate: parsed.rentStartDate || '',
    rentEndDate: parsed.rentEndDate || '',
    returnBufferDays: Number(parsed.returnBufferDays ?? 2),
    shippingMode: parsed.shippingMode || 'land',
    province: parsed.province || '',
    city: parsed.city || '',
    district: parsed.district || '',
    address: parsed.address || '',
    customerName: parsed.customerName || '',
    customerPhone: parsed.customerPhone || '',
  }
  if (Number(parsed.transitDays) > 0) payload.transitDays = Number(parsed.transitDays)
  return payload
}

function getMissingFields(parsed) {
  const missing = []
  if (!parsed.modelCode) missing.push('型号')
  if (!parsed.rentStartDate) missing.push('开始日期')
  if (!parsed.rentEndDate) missing.push('结束日期或租赁天数')
  if (parsed.intent === 'booking') {
    if (!parsed.customerName) missing.push('客户姓名')
    if (!parsed.customerPhone) missing.push('手机号')
    if (!parsed.address && !parsed.city) missing.push('收货地址')
  }
  return missing
}

module.exports = {
  buildAvailabilityPayload,
  formatDate,
  getMissingFields,
  inclusiveDays,
  parseRecipientAddress,
  parseFeishuRentalCommand,
}
