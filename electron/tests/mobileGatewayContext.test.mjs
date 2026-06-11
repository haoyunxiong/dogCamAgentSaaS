import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const {
  parseFeishuRentalCommand,
} = require('../main/mobileFeishuParser.js')

const {
  buildAvailabilityCard,
  buildAvailabilityQueryCard,
  buildAvailabilityContextRecord,
  buildBookingLatestLogisticsStatus,
  buildFeishuCardCallbackResponse,
  buildCustomerAvailabilityReply,
  buildCustomerReplyMessage,
  buildCustomerReplyCard,
  buildBookingResultMessage,
  buildBookingResultCard,
  buildFulfillmentCard,
  buildFulfillmentDigest,
  buildFeishuBookingSnapshot,
  appendFulfillmentReminderSentKey,
  getBookingMissingFields,
  parseFulfillmentReminderSentKeys,
  mergeBookingParsedWithAvailabilityContext,
  rememberAvailabilityContext,
  resetMobileGatewayContextForTests,
  resolveBookingAvailabilityContext,
  shouldRecordInquiryEvent,
  shouldProcessFeishuMessage,
  buildMobileWorkbenchHtml,
  normalizeMobileAvailabilityAddress,
} = require('../main/mobileGateway.js')

test('parses direct fulfillment action commands', () => {
  const ship = parseFeishuRentalCommand('确认发货 #13357')
  assert.equal(ship.intent, 'fulfillment_action')
  assert.equal(ship.actionType, 'mark_shipped')
  assert.equal(ship.orderId, 13357)
  assert.equal(ship.taskType, 'ship')

  const returned = parseFeishuRentalCommand('确认归还 13356')
  assert.equal(returned.intent, 'fulfillment_action')
  assert.equal(returned.actionType, 'mark_returned')
  assert.equal(returned.orderId, 13356)
  assert.equal(returned.taskType, 'return')

  const fullWidth = parseFeishuRentalCommand('确认发货 １３３５８')
  assert.equal(fullWidth.intent, 'fulfillment_action')
  assert.equal(fullWidth.actionType, 'mark_shipped')
  assert.equal(fullWidth.orderId, 13358)
})

test('mobile workbench isolates native date inputs and logistics warnings in the UI', () => {
  const html = buildMobileWorkbenchHtml()
  const inlineScript = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || ''

  assert.match(html, /class="date-control"/)
  assert.match(html, /class="date-display[^"]*"/)
  assert.match(html, /\.alert-error/)
  assert.match(html, /fallbackReason/)
  assert.match(html, /顺丰试算至少填省\+市/)
  assert.match(html, /顺丰无法根据当前区域查询时效/)
  assert.doesNotThrow(() => new vm.Script(inlineScript))
})

test('mobile create form keeps address before phone and auto-fills phone from pasted address', () => {
  const html = buildMobileWorkbenchHtml()
  const inlineScript = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || ''

  assert.ok(html.indexOf('id="createAddress"') < html.indexOf('id="customerPhone"'))
  assert.match(inlineScript, /function extractPhone\(value\)/)
  assert.match(inlineScript, /\$\('createAddress'\)\.addEventListener\('input', syncCreatePhoneFromAddress\)/)
  assert.match(inlineScript, /\$\('createAddress'\)\.addEventListener\('paste', function\(\)\{ setTimeout\(syncCreatePhoneFromAddress, 0\) \}\)/)
})

test('mobile availability bootstraps with the default fuzzy address', () => {
  const html = buildMobileWorkbenchHtml()
  const inlineScript = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || ''

  assert.match(html, /id="clearAvailabilityAddress"/)
  assert.ok(html.indexOf('收货信息 \/ 城市区域') < html.indexOf('id="clearAvailabilityAddress"'))
  assert.match(inlineScript, /\$\('address'\)\.value = "四川省成都市金牛区"/)
  assert.match(inlineScript, /function clearAvailabilityAddressDefaults\(\) \{ \$\('address'\)\.value = '' \}/)
})

test('mobile availability keeps recognized city-level regions out of detail address', () => {
  assert.deepEqual(normalizeMobileAvailabilityAddress('四川省绵阳市'), {
    province: '四川省',
    city: '绵阳市',
    district: '',
    address: '',
  })
  assert.deepEqual(normalizeMobileAvailabilityAddress('四川省绵阳市涪城区未名湖畔'), {
    province: '四川省',
    city: '绵阳市',
    district: '涪城区',
    address: '未名湖畔',
  })
})

test('mobile workbench includes schedule tab and mobile schedule workspace', () => {
  const html = buildMobileWorkbenchHtml()
  const inlineScript = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || ''

  assert.match(html, /data-tab="schedule"/)
  assert.match(html, /id="tab-schedule"/)
  assert.match(html, /id="scheduleMonth"/)
  assert.match(html, /id="scheduleMonthDisplay"/)
  assert.match(html, /<div class="date-control"><span class="date-display placeholder" id="scheduleMonthDisplay"/)
  assert.match(html, /id="scheduleViewSeg"/)
  assert.match(html, /id="scheduleGroups"/)
  assert.match(html, /id="scheduleMatrix"/)
  assert.match(html, /id="scheduleDetailSheet"/)
  assert.match(html, /data-action="toggle-schedule-group"/)
  assert.match(inlineScript, /async function loadScheduleOverview\(\)/)
  assert.match(inlineScript, /function bindMonthControl\(id\)/)
  assert.match(inlineScript, /function renderScheduleGroupedView\(/)
  assert.match(inlineScript, /function renderScheduleMonthView\(/)
  assert.match(inlineScript, /function openScheduleDetail\(/)
  assert.match(inlineScript, /document\.addEventListener\('click', function\(event\)/)
})

test('merges booking command with recent availability context from same chat', () => {
  const parsed = {
    intent: 'booking',
    text: '记档期 李双双 13800138000 四川省成都市武侯区天府长岛50号 租金300',
    modelCode: '',
    rentStartDate: '',
    rentEndDate: '',
    rentDays: 0,
    customerName: '李双双',
    customerPhone: '13800138000',
    province: '四川省',
    city: '成都市',
    district: '武侯区',
    address: '天府长岛50号',
    fee: 300,
    deposit: 0,
    shippingMode: 'land',
    returnBufferDays: 2,
  }
  const context = {
    createdAt: 1_000,
    parsed: {
      modelCode: '大疆POCKET4',
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-08',
      rentDays: 8,
      shippingMode: 'land',
      returnBufferDays: 2,
    },
    availability: {
      plan: {
        plannedShipAt: '2026-05-30T12:00:00',
        expectedArriveAt: '2026-05-31T12:00:00',
      },
    },
  }

  const merged = mergeBookingParsedWithAvailabilityContext(parsed, context, { now: 2_000 })

  assert.equal(merged.modelCode, '大疆POCKET4')
  assert.equal(merged.rentStartDate, '2026-06-01')
  assert.equal(merged.rentEndDate, '2026-06-08')
  assert.equal(merged.rentDays, 8)
  assert.equal(merged.customerName, '李双双')
  assert.equal(merged.customerPhone, '13800138000')
  assert.equal(merged.fee, 300)
})

test('does not use expired availability context', () => {
  const parsed = {
    intent: 'booking',
    modelCode: '',
    rentStartDate: '',
    rentEndDate: '',
    rentDays: 0,
  }
  const context = {
    createdAt: 1_000,
    parsed: {
      modelCode: '大疆POCKET4',
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-08',
      rentDays: 8,
    },
  }

  const merged = mergeBookingParsedWithAvailabilityContext(parsed, context, {
    now: 1_000 + 10 * 60 * 1000 + 1,
  })

  assert.equal(merged.modelCode, '')
  assert.equal(merged.rentStartDate, '')
  assert.equal(merged.rentEndDate, '')
})

test('resolves booking context from referenced availability message', () => {
  resetMobileGatewayContextForTests()
  const contextA = rememberAvailabilityContext('chat-a', { modelCode: '大疆POCKET3', rentStartDate: '2026-06-01', rentEndDate: '2026-06-03' }, { ok: true }, 1_000, { messageId: 'msg-a' })
  const contextB = rememberAvailabilityContext('chat-a', { modelCode: '大疆POCKET4', rentStartDate: '2026-06-05', rentEndDate: '2026-06-08' }, { ok: true }, 2_000, { messageId: 'msg-b' })

  const resolved = resolveBookingAvailabilityContext(
    { intent: 'booking', modelCode: '', rentStartDate: '', rentEndDate: '' },
    'chat-a',
    { referencedMessageId: 'msg-a', now: 3_000 },
  )

  assert.equal(resolved.status, 'matched')
  assert.equal(resolved.context.parsed.modelCode, contextA.parsed.modelCode)
  assert.notEqual(resolved.context.parsed.modelCode, contextB.parsed.modelCode)
})

test('asks for referenced message when direct booking has multiple recent contexts', () => {
  resetMobileGatewayContextForTests()
  rememberAvailabilityContext('chat-a', { modelCode: '大疆POCKET3', rentStartDate: '2026-06-01', rentEndDate: '2026-06-03' }, { ok: true }, 1_000, { messageId: 'msg-a' })
  rememberAvailabilityContext('chat-a', { modelCode: '大疆POCKET4', rentStartDate: '2026-06-05', rentEndDate: '2026-06-08' }, { ok: true }, 2_000, { messageId: 'msg-b' })

  const resolved = resolveBookingAvailabilityContext(
    { intent: 'booking', modelCode: '', rentStartDate: '', rentEndDate: '' },
    'chat-a',
    { now: 3_000 },
  )

  assert.equal(resolved.status, 'ambiguous')
  assert.equal(resolved.contexts.length, 2)
})

test('direct booking uses the only recent availability context', () => {
  resetMobileGatewayContextForTests()
  const context = rememberAvailabilityContext('chat-a', { modelCode: '大疆POCKET3', rentStartDate: '2026-06-01', rentEndDate: '2026-06-03' }, { ok: true }, 1_000, { messageId: 'msg-a' })

  const resolved = resolveBookingAvailabilityContext(
    { intent: 'booking', modelCode: '', rentStartDate: '', rentEndDate: '' },
    'chat-a',
    { now: 3_000 },
  )

  assert.equal(resolved.status, 'matched')
  assert.equal(resolved.context, context)
})

test('booking context can be aliased to bot reply message id', () => {
  resetMobileGatewayContextForTests()
  rememberAvailabilityContext('chat-a', { modelCode: '大疆POCKET3', rentStartDate: '2026-06-01', rentEndDate: '2026-06-03' }, { ok: true }, 1_000, { messageId: 'user-msg', botMessageId: 'bot-msg' })

  const resolved = resolveBookingAvailabilityContext(
    { intent: 'booking', modelCode: '', rentStartDate: '', rentEndDate: '' },
    'chat-a',
    { referencedMessageId: 'bot-msg', now: 3_000 },
  )

  assert.equal(resolved.status, 'matched')
  assert.equal(resolved.context.parsed.modelCode, '大疆POCKET3')
})

test('customer info is optional when confirming booking from availability context', () => {
  const parsed = {
    intent: 'booking',
    modelCode: '大疆POCKET3',
    rentStartDate: '2026-06-01',
    rentEndDate: '2026-06-03',
    customerName: '',
    customerPhone: '',
    address: '',
  }

  assert.deepEqual(getBookingMissingFields(parsed), [])
})

test('captures latest availability context fields for reuse', () => {
  const record = buildAvailabilityContextRecord(
    {
      text: '查档期 pocket4 6.1到6.8 发成都武侯',
      modelCode: '大疆POCKET4',
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-08',
      rentDays: 8,
      shippingMode: 'land',
      returnBufferDays: 2,
      province: '四川省',
      city: '成都',
      district: '武侯',
      address: '',
    },
    {
      availableUnits: [{ id: 2, unitCode: '大疆POCKET4-02' }],
      plan: {
        plannedShipAt: '2026-05-30T12:00:00',
        expectedArriveAt: '2026-05-31T12:00:00',
      },
    },
    5_000,
    { inquiryEventId: 88 },
  )

  assert.equal(record.createdAt, 5_000)
  assert.equal(record.parsed.inquiryEventId, 88)
  assert.equal(record.parsed.modelCode, '大疆POCKET4')
  assert.equal(record.parsed.rentStartDate, '2026-06-01')
  assert.equal(record.availability.plan.plannedShipAt, '2026-05-30T12:00:00')
  assert.equal(record.availability.availableUnits[0].unitCode, '大疆POCKET4-02')
})

test('builds customer-facing availability reply with quote and exemption rule', () => {
  const reply = buildCustomerAvailabilityReply({
    ok: true,
    available: true,
    modelCode: '大疆POCKET3',
    plan: {
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-03',
      shipDate: '2026-05-30',
      arriveDate: '2026-05-31',
    },
    quote: {
      ok: true,
      totalPrice: 80,
      days: 3,
    },
    depositExemption: {
      ok: true,
      summary: '免押：芝麻分 600+，需成年，需实名审核，港澳通行证不支持；未通过需全额押金 ¥2000.00',
    },
  })

  assert.match(reply, /^宝，/)
  assert.match(reply, /大疆POCKET3/)
  assert.match(reply, /6月1号到6月3号是有档期/)
  assert.doesNotMatch(reply, /发|到货|物流/)
  assert.match(reply, /租金一共是80元/)
  assert.match(reply, /芝麻分 600\+/)
})

test('builds availability reply from configurable template', () => {
  const reply = buildCustomerAvailabilityReply({
    ok: true,
    available: true,
    modelCode: '大疆POCKET3',
    plan: {
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-03',
      shipDate: '2026-05-30',
      arriveDate: '2026-05-31',
    },
    quote: { ok: true, totalPrice: 80, days: 3 },
    depositExemption: { ok: true, summary: '免押：芝麻分 600+' },
  }, {
    availableTemplate: '宝 {型号} {开始日期}-{结束日期} 有档，租金{租金}，免押{免押条件}',
  })

  assert.equal(reply, '宝 大疆POCKET3 6月1号-6月3号 有档，租金80元，免押芝麻分 600+')
})

test('availability card does not require a callback action to copy reply text', () => {
  const message = buildAvailabilityCard(
    { intent: 'availability', text: '查档期 pocket3 6.1 租3天' },
    {
      ok: true,
      available: true,
      modelCode: '大疆POCKET3',
      plan: {
        rentStartDate: '2026-06-01',
        rentEndDate: '2026-06-03',
        requiredStartDate: '2026-05-30',
        requiredEndDate: '2026-06-05',
      },
      counts: { availableUnits: 1, totalUnits: 7 },
      availableUnits: [{ id: 1, unitCode: '大疆POCKET3-01' }],
      quote: { ok: true, totalPrice: 80, days: 3 },
      depositExemption: { ok: true, summary: '免押：芝麻分 600+' },
    },
  )
  const card = JSON.parse(message.content)
  const actionValues = card.elements
    .filter((element) => element.tag === 'action')
    .flatMap((element) => element.actions || [])
    .map((action) => action.value?.action_type)

  assert.ok(!actionValues.includes('send_customer_reply'))
  assert.match(card.elements.map((element) => element.text?.content || '').join('\n'), /租客回复/)
})

test('availability query card opens a mobile form instead of only reporting missing fields', () => {
  const message = buildAvailabilityQueryCard(['型号', '开始日期'], { publicBaseUrl: 'https://example.test' })
  const card = JSON.parse(message.content)
  const button = card.elements
    .filter((element) => element.tag === 'action')
    .flatMap((element) => element.actions || [])
    .find((action) => action.url)

  assert.equal(card.header.title.content, '填写查档期信息')
  assert.ok(button.url.startsWith('https://example.test/mobile/availability'))
})

test('customer reply card title is separate from copied reply content', () => {
  const message = buildCustomerReplyCard('宝，有档期哈。')
  const card = JSON.parse(message.content)

  assert.equal(card.header.title.content, '租客回复')
  assert.equal(card.elements[0].text.content, '宝，有档期哈。')
  assert.doesNotMatch(card.elements[0].text.content, /租客回复/)
})

test('customer reply message is plain text for direct copying', () => {
  const message = buildCustomerReplyMessage('宝，有档期哈。')

  assert.equal(message.msg_type, 'text')
  assert.equal(JSON.parse(message.content).text, '宝，有档期哈。')
  assert.doesNotMatch(JSON.parse(message.content).text, /租客回复/)
})

test('test availability commands are not recorded as inquiry events', () => {
  assert.equal(shouldRecordInquiryEvent({ text: '【测试】查档期 pocket3 6.10到6.12 发成都武侯' }), false)
  assert.equal(shouldRecordInquiryEvent({ text: '[测试] 查档期 pocket3 6.10到6.12 发成都武侯' }), false)
  assert.equal(shouldRecordInquiryEvent({ text: '查档期 pocket3 6.10到6.12 发成都武侯' }), true)
})

test('booking action value carries chat id without oversized snapshot payload', () => {
  const message = buildAvailabilityCard(
    { intent: 'booking', text: '记档期' },
    {
      ok: true,
      available: true,
      modelCode: '大疆POCKET3',
      plan: {
        rentStartDate: '2026-06-01',
        rentEndDate: '2026-06-03',
        requiredStartDate: '2026-05-30',
        requiredEndDate: '2026-06-05',
      },
      counts: { availableUnits: 1, totalUnits: 7 },
      availableUnits: [{ id: 1, unitCode: '大疆POCKET3-01' }],
      quote: { ok: true, totalPrice: 80, days: 3 },
      depositExemption: { ok: true, summary: '免押：芝麻分 600+' },
    },
    { chatId: 'chat-a' },
  )
  const card = JSON.parse(message.content)
  const button = card.elements
    .filter((element) => element.tag === 'action')
    .flatMap((element) => element.actions || [])
    .find((action) => action.value?.action_type === 'confirm_booking')

  assert.equal(button.value.chat_id, 'chat-a')
  assert.ok(!Object.prototype.hasOwnProperty.call(button.value, 'booking_snapshot'))
})

test('booking result message includes concrete order details', () => {
  const message = buildBookingResultMessage({
    ok: true,
    result: { id: 4100, unitId: 7, plannedShipAt: '2026-05-30T12:00:00', expectedArriveAt: '2026-05-31T12:00:00' },
    parsed: {
      modelCode: '大疆POCKET3',
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-03',
      fee: 80,
      customerName: '',
      customerPhone: '',
      province: '四川省',
      city: '成都市',
      district: '武侯区',
      address: '',
    },
    availability: {
      availableUnits: [{ id: 7, unitCode: '大疆POCKET3-01' }],
    },
  })

  assert.match(message, /建单成功/)
  assert.match(message, /#4100/)
  assert.match(message, /大疆POCKET3-01/)
  assert.match(message, /待补资料/)
  assert.match(message, /租金：¥80\.00/)
})

test('booking result card renders pending information as a card', () => {
  const message = buildBookingResultCard({
    ok: true,
    result: { id: 4100, unitId: 7, plannedShipAt: '2026-05-30T12:00:00', expectedArriveAt: '2026-05-31T12:00:00' },
    parsed: {
      modelCode: '大疆POCKET3',
      rentStartDate: '2026-06-01',
      rentEndDate: '2026-06-03',
      fee: 80,
      customerName: '',
      customerPhone: '',
      province: '四川省',
      city: '成都市',
      district: '武侯区',
      address: '',
    },
    availability: {
      availableUnits: [{ id: 7, unitCode: '大疆POCKET3-01' }],
    },
  })
  const card = JSON.parse(message.content)

  assert.equal(message.msg_type, 'interactive')
  assert.equal(card.header.title.content, '占用档期成功')
  assert.match(card.elements[0].text.content, /#4100/)
  assert.match(card.elements[0].text.content, /待补资料/)
})

test('booking latest status distinguishes pending occupancy from complete order', () => {
  assert.equal(buildBookingLatestLogisticsStatus({}), '占用档期（待补资料）')
  assert.equal(buildBookingLatestLogisticsStatus({
    customerName: '张三',
    customerPhone: '13800138000',
    address: '天府长岛50号',
  }), '飞书建单')
})

test('dedupes repeated Feishu message events by message id', () => {
  resetMobileGatewayContextForTests()

  assert.equal(shouldProcessFeishuMessage('msg-1', 1_000), true)
  assert.equal(shouldProcessFeishuMessage('msg-1', 2_000), false)
  assert.equal(shouldProcessFeishuMessage('msg-2', 2_000), true)
  assert.equal(shouldProcessFeishuMessage('msg-1', 1_000 + 31 * 60 * 1000), true)
})

test('feishu card callback response uses toast object format', () => {
  const body = buildFeishuCardCallbackResponse('已收到建单请求，后台处理中')

  assert.deepEqual(body, {
    toast: {
      type: 'info',
      content: '已收到建单请求，后台处理中',
    },
  })
})

test('booking snapshot defaults fee from quote when command did not include price', () => {
  const snapshot = buildFeishuBookingSnapshot(
    {
      intent: 'booking',
      modelCode: '大疆POCKET3',
      customerName: '张三',
      customerPhone: '13800138000',
      fee: 0,
    },
    {
      plan: {
        plannedShipAt: '2026-05-30T12:00:00',
        expectedArriveAt: '2026-05-31T12:00:00',
      },
      quote: {
        ok: true,
        totalPrice: 80,
        deposit: 2000,
      },
    },
  )

  assert.equal(snapshot.fee, 80)
  assert.equal(snapshot.deposit, 0)
  assert.equal(snapshot.plannedShipAt, '2026-05-30T12:00:00')
})

test('fulfillment digest prioritizes morning far shipments and overdue returns', () => {
  const digest = buildFulfillmentDigest({
    dateFrom: '2026-06-01',
    dateTo: '2026-06-01',
    pendingShip: [
      { id: 1, customer_name: '本地晚发', model_code: 'pocket3', unit_code: 'pocket3-01', province: '四川省', city: '成都市', address: '武侯区', planned_ship_at: '2026-06-01T18:00:00' },
      { id: 2, customer_name: '外地早发', model_code: 'pocket4', unit_code: 'pocket4-02', province: '浙江省', city: '杭州市', address: '西湖区', planned_ship_at: '2026-06-01T09:00:00' },
    ],
    pendingReturn: [],
    overdueReturn: [
      { id: 3, customer_name: '逾期归还', model_code: 'g12', unit_code: 'g12-01', rent_end_date: '2026-05-30' },
    ],
  }, { taskType: 'all' })

  assert.match(digest.content, /【早发\/外地】#2/)
  assert.ok(digest.content.indexOf('#2') < digest.content.indexOf('#1'))
  assert.match(digest.content, /逾期待完结/)
  assert.match(digest.content, /【逾期】#3/)
})

test('fulfillment card renders each task as a separate block with its own action', () => {
  const message = buildFulfillmentCard({
    dateFrom: '2026-06-01',
    dateTo: '2026-06-01',
    pendingInfo: [
      { id: 9, customer_name: '', customer_phone: '', model_code: 'pocket4', unit_code: 'pocket4-02', latest_logistics_status: '占用档期（待补资料）', planned_ship_at: '2026-06-01T12:00:00' },
    ],
    pendingShip: [
      { id: 1, customer_name: '客户A', model_code: 'pocket3', unit_code: 'pocket3-01', province: '四川省', city: '成都市', planned_ship_at: '2026-06-01T18:00:00' },
      { id: 2, customer_name: '客户B', model_code: 'pocket4', unit_code: 'pocket4-02', province: '浙江省', city: '杭州市', planned_ship_at: '2026-06-01T09:00:00' },
    ],
    pendingReturn: [],
    overdueReturn: [],
  }, { taskType: 'ship', taskDatePreset: 'today' })

  const card = JSON.parse(message.content)
  const text = card.elements.map((element) => element.text?.content || '').join('\n')
  const actionBlocks = card.elements.filter((element) => element.tag === 'action')
  const buttons = actionBlocks.flatMap((element) => element.actions || [])

  assert.match(text, /待补资料 1 单/)
  assert.match(text, /#9/)
  assert.equal(actionBlocks.length, 2)
  assert.equal(buttons[0].value.action_type, 'mark_shipped')
  assert.equal(buttons[0].value.task_date_preset, 'today')
})

test('fulfillment reminder sent keys can be persisted across restarts', () => {
  const existing = '2026-05-24:morning,2026-05-24:tomorrow'

  assert.deepEqual(parseFulfillmentReminderSentKeys(existing), ['2026-05-24:morning', '2026-05-24:tomorrow'])
  assert.equal(appendFulfillmentReminderSentKey(existing, '2026-05-24:morning'), existing)
  assert.equal(
    appendFulfillmentReminderSentKey(existing, '2026-05-25:morning'),
    '2026-05-24:morning,2026-05-24:tomorrow,2026-05-25:morning',
  )
})
