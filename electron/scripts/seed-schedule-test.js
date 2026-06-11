/**
 * 清空 rental_orders + schedule_blocks 并写入若干测试数据,
 * 让 ScheduleCalendar(可视化排期)能看到各种状态的订单。
 */
const m = require('../main/mysqlAdapter')

function pad(n) { return String(n).padStart(2, '0') }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function fmtDT(d) { return `${fmt(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }
function addDays(baseIso, delta) {
  const d = new Date(`${baseIso}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return fmt(d)
}

async function main() {
  await m.initPool()

  console.log('>>> 清空 schedule_blocks 和 rental_orders ...')
  await m.run('DELETE FROM schedule_blocks')
  await m.run('DELETE FROM rental_orders')
  console.log('    已清空')

  // 查当前月第一天
  const today = new Date()
  const monthStart = fmt(new Date(today.getFullYear(), today.getMonth(), 1))
  const todayIso = fmt(today)
  console.log(`>>> 当前月: ${monthStart.slice(0, 7)}, 今天: ${todayIso}`)

  // 抓一些可用设备
  const units = await m.all(`
    SELECT id, model_code, unit_code FROM schedule_units
    WHERE model_code IN ('acepro2','g12','g7x2','gr3x','iuxs-210')
    ORDER BY model_code, unit_code
  `)
  console.log(`>>> 找到 ${units.length} 台可用设备`)
  const byModel = {}
  for (const u of units) (byModel[u.model_code] ||= []).push(u)

  // 构造若干订单(涵盖多种状态: 已确认 / 进行中 / 已完成 / 已逾期)
  // 日期相对 today 的偏移
  const testOrders = [
    // === 已确认 (未来开始) ===
    { model: 'acepro2', unitIdx: 0, customer: '张三', phone: '13800000001', city: '上海', rentStart: addDays(todayIso, 5), rentEnd: addDays(todayIso, 12), fee: 1200, status: 'paid' },
    { model: 'acepro2', unitIdx: 1, customer: '李四', phone: '13800000002', city: '杭州', rentStart: addDays(todayIso, 3), rentEnd: addDays(todayIso, 9), fee: 980, status: 'paid' },
    // === 进行中 (已开始未结束) ===
    { model: 'g12', unitIdx: 0, customer: '王五', phone: '13900000003', city: '北京', rentStart: addDays(todayIso, -2), rentEnd: addDays(todayIso, 6), fee: 1500, status: 'active' },
    { model: 'g12', unitIdx: 1, customer: '赵六', phone: '13900000004', city: '深圳', rentStart: addDays(todayIso, -5), rentEnd: addDays(todayIso, 4), fee: 1800, status: 'active' },
    { model: 'g7x2', unitIdx: 0, customer: '孙七', phone: '13900000005', city: '成都', rentStart: addDays(todayIso, -1), rentEnd: addDays(todayIso, 8), fee: 1350, status: 'active' },
    // === 已完成 (本月早期已结束) ===
    { model: 'gr3x', unitIdx: 0, customer: '周八', phone: '13900000006', city: '广州', rentStart: addDays(todayIso, -15), rentEnd: addDays(todayIso, -8), fee: 900, status: 'completed' },
    { model: 'gr3x', unitIdx: 1, customer: '吴九', phone: '13900000007', city: '南京', rentStart: addDays(todayIso, -12), rentEnd: addDays(todayIso, -6), fee: 800, status: 'completed' },
    // === 已逾期 (到期但未完成) ===
    { model: 'iuxs-210', unitIdx: 0, customer: '郑十', phone: '13900000008', city: '武汉', rentStart: addDays(todayIso, -10), rentEnd: addDays(todayIso, -3), fee: 1100, status: 'shipping' },
    // === 同一型号多台同时 (测试占用汇总) ===
    { model: 'acepro2', unitIdx: 2, customer: '小陈', phone: '13700000009', city: '苏州', rentStart: addDays(todayIso, 1), rentEnd: addDays(todayIso, 7), fee: 880, status: 'paid' },
    { model: 'acepro2', unitIdx: 3, customer: '小林', phone: '13700000010', city: '宁波', rentStart: addDays(todayIso, 2), rentEnd: addDays(todayIso, 10), fee: 950, status: 'paid' },
  ]

  const insertOrderSQL = `
    INSERT INTO rental_orders (
      order_no, model_code, unit_id, customer_name, customer_phone, city,
      rent_start_date, rent_end_date, fee, deposit, order_status,
      planned_ship_at, expected_arrive_at, shipping_mode, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `
  const insertBlockSQL = `
    INSERT INTO schedule_blocks (
      unit_id, order_id, model_code, block_type, start_date, end_date,
      planned_ship_at, expected_arrive_at, status, note, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())
  `

  let orderSeq = 1
  for (const t of testOrders) {
    const pool = byModel[t.model] || []
    const unit = pool[t.unitIdx]
    if (!unit) {
      console.log(`  [跳过] ${t.model} 第 ${t.unitIdx} 台设备不存在`)
      continue
    }
    const orderNo = `TEST-${monthStart.slice(0, 7).replace('-', '')}-${pad(orderSeq++)}`
    const shipDay = addDays(t.rentStart, -2)
    const arriveDay = addDays(t.rentStart, -1)
    const returnStart = addDays(t.rentEnd, 1)
    const returnEnd = addDays(t.rentEnd, 2)
    const plannedShipAt = `${shipDay}T09:00:00`
    const expectedArriveAt = `${arriveDay}T18:00:00`

    const orderRes = await m.run(insertOrderSQL, [
      orderNo, t.model, unit.id, t.customer, t.phone, t.city,
      t.rentStart, t.rentEnd, t.fee, Math.round(t.fee * 0.3), t.status,
      plannedShipAt, expectedArriveAt, 'land',
    ])
    const orderId = orderRes.lastInsertRowid

    // 物流发送段
    await m.run(insertBlockSQL, [unit.id, orderId, t.model, 'shipping', shipDay, arriveDay, plannedShipAt, expectedArriveAt, '租赁发货占用'])
    // 租期段
    await m.run(insertBlockSQL, [unit.id, orderId, t.model, 'rent', t.rentStart, t.rentEnd, plannedShipAt, expectedArriveAt, '租期占用'])
    // 物流返回段
    await m.run(insertBlockSQL, [unit.id, orderId, t.model, 'return_shipping', returnStart, returnEnd, null, null, '归还物流'])

    console.log(`  ✓ ${orderNo} ${t.model}/${unit.unit_code} ${t.customer} ${t.rentStart}→${t.rentEnd} ¥${t.fee} [${t.status}]`)
  }

  const oc = await m.get('SELECT COUNT(*) AS c FROM rental_orders')
  const bc = await m.get('SELECT COUNT(*) AS c FROM schedule_blocks')
  console.log(`\n>>> 完成: 订单 ${oc.c} 条, 档期块 ${bc.c} 条`)

  await m.closePool()
}

main().catch((e) => { console.error(e); process.exit(1) })
