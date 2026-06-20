const crypto = require('crypto')
const mysqlAdapter = require('./mysqlAdapter')
const { checkScheduleAvailability } = require('./dbManager')
const { loadMysqlConfig } = require('./mysqlConfig')
const { persistSafeOperationContext } = require('./safeOpsPersistence')
const { hashIdempotencyKey } = require('./safeOpsCrypto')

const HOLD_ACTIVE = 'active'
const HOLD_CONVERTED = 'converted'
const HOLD_EXPIRED = 'expired'
const HOLD_RELEASED = 'released'
const HOLD_TTL_MINUTES = 5
const HOLD_MAX_EXTENSION_COUNT = 1

const CHENGDU_DISTRICTS = Object.freeze([
  '锦江区',
  '青羊区',
  '金牛区',
  '武侯区',
  '成华区',
  '龙泉驿区',
  '青白江区',
  '新都区',
  '温江区',
  '双流区',
  '郫都区',
  '新津区',
  '简阳市',
  '都江堰市',
  '彭州市',
  '邛崃市',
  '崇州市',
  '金堂县',
  '大邑县',
  '蒲江县',
])

const TOWN_DISTRICT_HINTS = Object.freeze({
  春熙路: '锦江区',
  太古里: '锦江区',
  三圣乡: '锦江区',
  宽窄巷子: '青羊区',
  金沙: '青羊区',
  茶店子: '金牛区',
  犀浦: '郫都区',
  红光: '郫都区',
  华阳: '双流区',
  中和: '双流区',
  航空港: '双流区',
  成都东站: '成华区',
  万年场: '成华区',
  大面: '龙泉驿区',
  洛带: '龙泉驿区',
  大丰: '新都区',
  斑竹园: '新都区',
  柳城: '温江区',
  花源: '新津区',
})

function nowIso() {
  return new Date().toISOString()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeDateOnly(value) {
  const text = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const date = new Date(`${text}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function normalizeDateTime(value) {
  const text = normalizeText(value).replace('T', ' ')
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00:00`
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)) return `${text}:00`
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function dateOnlyFromDateTime(value) {
  return normalizeDateTime(value).slice(0, 10) || normalizeDateOnly(value)
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes || 0) * 60 * 1000)
}

function addDays(dateText, days) {
  const date = new Date(`${normalizeDateOnly(dateText)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return normalizeDateOnly(dateText)
  date.setDate(date.getDate() + Number(days || 0))
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function inclusiveDays(startDate, endDate) {
  const start = new Date(`${normalizeDateOnly(startDate)}T00:00:00`)
  const end = new Date(`${normalizeDateOnly(endDate)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function normalizeActor(actor = {}) {
  return {
    actorId: normalizeText(actor.actorId || actor.id || 'ui-v2-operator') || 'ui-v2-operator',
    role: normalizeText(actor.role || 'operator') || 'operator',
    merchantId: normalizeText(actor.merchantId || 'local-merchant') || 'local-merchant',
    storeId: normalizeText(actor.storeId || ''),
  }
}

function assertLocalWriteTarget() {
  const config = loadMysqlConfig()
  const host = normalizeText(config.host).toLowerCase()
  const database = normalizeText(config.database)
  const envLabel = normalizeText(process.env.XIANYU_ENV_LABEL).toLowerCase()
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('rental core write refused: MySQL host is not local')
  }
  if (database !== 'xianyu_agent') {
    throw new Error('rental core write refused: database is not xianyu_agent')
  }
  if (envLabel === 'production' || envLabel === 'prod') {
    throw new Error('rental core write refused: production environment label')
  }
}

function buildHoldNo() {
  return `HOLD${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

function buildOrderNo() {
  return `R${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

function safeJson(value) {
  return JSON.stringify(value || null)
}

function parseJson(value, fallback = null) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function inferProvince(text, explicitProvince) {
  if (explicitProvince) return explicitProvince
  if (text.includes('四川')) return '四川省'
  if (text.includes('成都')) return '四川省'
  return ''
}

function inferCity(text, explicitCity) {
  if (explicitCity) return explicitCity
  if (text.includes('成都')) return '成都市'
  return ''
}

function parseDistrictFromText(text, explicitDistrict) {
  if (explicitDistrict) return { district: explicitDistrict, confidence: 0.98, candidates: [explicitDistrict], matchedBy: 'explicit' }
  const candidates = []
  for (const district of CHENGDU_DISTRICTS) {
    if (text.includes(district) || text.includes(district.replace(/[区县市]$/, ''))) {
      candidates.push(district)
    }
  }
  for (const [hint, district] of Object.entries(TOWN_DISTRICT_HINTS)) {
    if (text.includes(hint) && !candidates.includes(district)) candidates.push(district)
  }
  if (candidates.length) {
    return {
      district: candidates[0],
      confidence: candidates.length === 1 ? 0.88 : 0.72,
      candidates,
      matchedBy: candidates.length === 1 ? 'district_or_town_hint' : 'multiple_candidates',
    }
  }
  const genericMatches = Array.from(text.matchAll(/([\u4e00-\u9fa5]{2,12}(?:区|县|旗))/g)).map((match) => match[1])
  if (genericMatches.length) {
    return {
      district: genericMatches[genericMatches.length - 1],
      confidence: 0.7,
      candidates: genericMatches,
      matchedBy: 'generic_district_suffix',
    }
  }
  return { district: '', confidence: 0.25, candidates: [], matchedBy: 'not_found' }
}

function parseFuzzyAddress({ province, city, district, address, fuzzyAddress } = {}) {
  const text = normalizeText(`${province || ''} ${city || ''} ${district || ''} ${fuzzyAddress || ''} ${address || ''}`)
  const inferredProvince = inferProvince(text, province)
  const inferredCity = inferCity(text, city)
  const districtResult = parseDistrictFromText(text, district)
  const hasTownOrVillage = /(镇|乡|村|街道|社区)/.test(text)
  const cityOnly = Boolean(inferredCity && !districtResult.district)
  const ok = Boolean(districtResult.district) && !cityOnly
  return {
    ok,
    province: inferredProvince,
    city: inferredCity,
    district: districtResult.district,
    town: hasTownOrVillage ? (Object.keys(TOWN_DISTRICT_HINTS).find((hint) => text.includes(hint)) || '') : '',
    confidence: districtResult.confidence,
    candidates: districtResult.candidates,
    matchedBy: districtResult.matchedBy,
    input: normalizeText(fuzzyAddress || address || text),
    message: ok ? '已识别到区县。' : '查档期需要至少识别到区/县；仅城市不够，请选择区县。',
  }
}

async function expireHolds() {
  await mysqlAdapter.run(`
    UPDATE schedule_holds
    SET status = ?, release_reason = COALESCE(release_reason, '锁定超时自动释放'), updated_at = NOW()
    WHERE status = ? AND expires_at <= NOW()
  `, [HOLD_EXPIRED, HOLD_ACTIVE])
}

function buildDualShipWindows(plan = {}, rentStartDate) {
  const arriveDate = dateOnlyFromDateTime(plan.expectedArriveAt) || rentStartDate
  const shipDate = dateOnlyFromDateTime(plan.plannedShipAt) || addDays(rentStartDate, -1)
  return [
    {
      key: 'morning_10',
      label: '上午 10 点发货',
      plannedShipAt: `${shipDate} 10:00:00`,
      expectedArriveAt: `${arriveDate} 18:00:00`,
    },
    {
      key: 'evening_18',
      label: '下午 18 点发货',
      plannedShipAt: `${shipDate} 18:00:00`,
      expectedArriveAt: `${arriveDate} 18:00:00`,
    },
  ]
}

function classifyAvailability({ availability, addressParse }) {
  if (!availability?.available) return { code: 'none', label: '无档期', tone: 'danger' }
  if (!addressParse?.ok || Number(addressParse.confidence || 0) < 0.65) {
    return { code: 'manual', label: '需人工确认', tone: 'warning' }
  }
  if (availability.plan?.fallbackReason || !['sf_deliver_time', 'transit_days'].includes(availability.plan?.source)) {
    return { code: 'risk', label: '风险可用', tone: 'warning' }
  }
  return { code: 'safe', label: '安全可用', tone: 'success' }
}

function buildOccupancyWindow(plan = {}, rentStartDate, rentEndDate) {
  const shipDate = dateOnlyFromDateTime(plan.plannedShipAt) || rentStartDate
  const arriveDate = dateOnlyFromDateTime(plan.expectedArriveAt) || rentStartDate
  const bufferEndDate = plan.bufferEndDate || addDays(rentEndDate, 2)
  const dates = [shipDate, arriveDate, rentStartDate].filter(Boolean).sort()
  return {
    occupationStartAt: normalizeDateTime(plan.plannedShipAt) || `${dates[0]} 00:00:00`,
    occupationEndAt: `${bufferEndDate} 23:59:59`,
    requiredStartDate: plan.requiredStartDate || dates[0],
    requiredEndDate: plan.requiredEndDate || bufferEndDate,
    returnLogistics: {
      expectedReturnShipDate: rentEndDate,
      expectedReturnWarehouseDate: addDays(rentEndDate, 2),
    },
    turnaroundBuffer: {
      inspection: '验机',
      cleaning: '清洁',
      charging: '充电',
      packing: '打包',
      bufferEndDate,
    },
  }
}

function mapHold(row = {}) {
  return {
    id: row.id,
    holdNo: row.hold_no,
    modelCode: row.model_code,
    unitId: row.unit_id,
    unitCode: row.unit_code,
    rentStartDate: row.rent_start_date ? String(row.rent_start_date).slice(0, 10) : '',
    rentEndDate: row.rent_end_date ? String(row.rent_end_date).slice(0, 10) : '',
    occupationStartAt: normalizeDateTime(row.occupation_start_at),
    occupationEndAt: normalizeDateTime(row.occupation_end_at),
    plannedShipAt: normalizeDateTime(row.planned_ship_at),
    expectedArriveAt: normalizeDateTime(row.expected_arrive_at),
    status: row.status,
    statusLabel: ({
      [HOLD_ACTIVE]: '锁定中',
      [HOLD_CONVERTED]: '已转订单',
      [HOLD_EXPIRED]: '已过期释放',
      [HOLD_RELEASED]: '手动释放',
    })[row.status] || row.status,
    expiresAt: normalizeDateTime(row.expires_at),
    extendedCount: Number(row.extended_count || 0),
    convertedOrderId: row.converted_order_id || null,
    releaseReason: row.release_reason || '',
    actorId: row.actor_id || '',
    actorRole: row.actor_role || '',
    storeId: row.store_id || '',
    queryAddress: parseJson(row.query_address_json, {}),
    addressParse: parseJson(row.address_parse_json, {}),
    sfEstimate: parseJson(row.sf_estimate_json, {}),
    availabilityResult: parseJson(row.availability_result_json, {}),
    createdAt: normalizeDateTime(row.created_at),
    updatedAt: normalizeDateTime(row.updated_at),
  }
}

async function auditRentalCore({ operationType, actor, payload, status, impact }) {
  return persistSafeOperationContext({
    request: {
      operationType,
      actor: actor || {},
      target: { type: 'rental_core', id: payload?.holdNo || payload?.modelCode || operationType },
      payload: payload || {},
    },
    policy: { domain: 'RentalCore', riskLevel: 'medium', allowWrite: true },
    impact: impact || {},
    mode: status === 'executed' ? 'write' : 'dry-run',
    status,
    issueConfirmToken: false,
  })
}

async function queryRentalAvailability(payload = {}) {
  await expireHolds()
  const modelCode = normalizeText(payload.modelCode)
  const rentStartDate = normalizeDateOnly(payload.rentStartDate)
  const rentEndDate = normalizeDateOnly(payload.rentEndDate)
  const addressParse = parseFuzzyAddress(payload)
  if (!modelCode) return { ok: false, message: '设备型号不能为空。' }
  if (!rentStartDate || !rentEndDate) return { ok: false, message: '租期不能为空。' }
  if (rentEndDate < rentStartDate) return { ok: false, message: '租期结束不能早于开始。' }
  if (!addressParse.ok) {
    return {
      ok: false,
      code: 'DISTRICT_REQUIRED',
      message: addressParse.message,
      addressParse,
      sensitiveValuesReturned: false,
    }
  }

  const availability = await checkScheduleAvailability({
    modelCode,
    rentStartDate,
    rentEndDate,
    province: addressParse.province,
    city: addressParse.city,
    district: addressParse.district,
    address: addressParse.input,
    shippingMode: payload.shippingMode || 'land',
    returnBufferDays: payload.returnBufferDays || 2,
  })
  if (!availability?.ok) return { ok: false, message: availability?.message || '查档期失败。', addressParse }
  const activeHolds = await mysqlAdapter.all(`
    SELECT unit_id
    FROM schedule_holds
    WHERE status = ? AND expires_at > NOW()
      AND model_code = ?
      AND NOT (occupation_end_at < ? OR occupation_start_at > ?)
  `, [
    HOLD_ACTIVE,
    modelCode,
    `${availability.plan.requiredStartDate} 00:00:00`,
    `${availability.plan.requiredEndDate} 23:59:59`,
  ])
  const heldUnitIds = new Set(activeHolds.map((row) => Number(row.unit_id)))
  const availableUnits = (availability.availableUnits || []).filter((unit) => !heldUnitIds.has(Number(unit.id)))
  const recommendedUnit = availableUnits[0] || null
  const classification = classifyAvailability({
    availability: { ...availability, available: availableUnits.length > 0 },
    addressParse,
  })
  const window = buildOccupancyWindow(availability.plan || {}, rentStartDate, rentEndDate)
  const result = {
    ok: true,
    modelCode,
    rentStartDate,
    rentEndDate,
    storeId: payload.storeId || '',
    addressParse,
    classification,
    recommendedUnit,
    availableUnits,
    conflictUnits: availability.conflictUnits || [],
    heldUnitIds: Array.from(heldUnitIds),
    plan: {
      ...(availability.plan || {}),
      ...window,
      dualShipWindows: buildDualShipWindows(availability.plan || {}, rentStartDate),
      latestShipAt: `${dateOnlyFromDateTime(availability.plan?.plannedShipAt) || addDays(rentStartDate, -1)} 18:00:00`,
      previousOrderReturnWarehouseAt: window.returnLogistics.expectedReturnWarehouseDate,
      reusableAt: window.occupationEndAt,
    },
    quote: availability.quote || null,
    depositExemption: availability.depositExemption || null,
    counts: {
      ...(availability.counts || {}),
      availableUnits: availableUnits.length,
      activeHoldUnits: heldUnitIds.size,
    },
    sensitiveValuesReturned: false,
  }
  await auditRentalCore({
    operationType: 'rental.availability.query',
    actor: payload.actor,
    status: 'previewed',
    payload: {
      modelCode,
      rentStartDate,
      rentEndDate,
      district: addressParse.district,
      storeId: payload.storeId || '',
    },
    impact: {
      summary: `查档期完成：${classification.label}，推荐单机 ${recommendedUnit?.unitCode || '无'}。`,
      affectedRecords: recommendedUnit ? [{ type: 'schedule_units', id: recommendedUnit.id }] : [],
      externalEffects: [],
    },
  })
  return result
}

async function findActiveHoldConflict(tx, { unitId, startAt, endAt, excludeHoldId }) {
  const where = [
    'unit_id = ?',
    'status = ?',
    'expires_at > NOW()',
    'NOT (occupation_end_at < ? OR occupation_start_at > ?)',
  ]
  const params = [unitId, HOLD_ACTIVE, startAt, endAt]
  if (excludeHoldId) {
    where.push('id != ?')
    params.push(excludeHoldId)
  }
  return tx.get(`
    SELECT *
    FROM schedule_holds
    WHERE ${where.join(' AND ')}
    ORDER BY expires_at DESC
    LIMIT 1
    FOR UPDATE
  `, params)
}

async function findScheduleBlockConflict(tx, { unitId, startDate, endDate }) {
  return tx.get(`
    SELECT b.*, o.order_no, u.unit_code
    FROM schedule_blocks b
    LEFT JOIN rental_orders o ON o.id = b.order_id
    LEFT JOIN schedule_units u ON u.id = b.unit_id
    WHERE b.unit_id = ?
      AND b.status = 'active'
      AND NOT (b.end_date < ? OR b.start_date > ?)
    ORDER BY b.start_date ASC, b.id ASC
    LIMIT 1
    FOR UPDATE
  `, [unitId, startDate, endDate])
}

async function createRentalHold(payload = {}) {
  assertLocalWriteTarget()
  await expireHolds()
  const availability = payload.availabilityResult?.ok
    ? payload.availabilityResult
    : await queryRentalAvailability(payload)
  if (!availability?.ok) return availability
  const unit = payload.unitId
    ? availability.availableUnits.find((item) => String(item.id) === String(payload.unitId))
    : availability.recommendedUnit
  if (!unit) return { ok: false, message: '没有可锁定单机；请重新查档期。' }
  const actor = normalizeActor(payload.actor || {})
  const holdNo = buildHoldNo()
  const ttlMinutes = Math.max(3, Math.min(5, Number(payload.ttlMinutes || HOLD_TTL_MINUTES)))
  const now = new Date()
  const expiresAt = formatDateTime(addMinutes(now, ttlMinutes))
  const startAt = normalizeDateTime(availability.plan.occupationStartAt)
  const endAt = normalizeDateTime(availability.plan.occupationEndAt)
  const idempotencyHash = hashIdempotencyKey(payload.clientRequestId || `${actor.actorId}:${holdNo}`)

  const result = await mysqlAdapter.transaction(async (tx) => {
    const blockConflict = await findScheduleBlockConflict(tx, {
      unitId: unit.id,
      startDate: availability.plan.requiredStartDate,
      endDate: availability.plan.requiredEndDate,
    })
    if (blockConflict) {
      return { ok: false, message: `设备 ${blockConflict.unit_code || unit.unitCode} 已被订单 ${blockConflict.order_no || blockConflict.order_id || blockConflict.id} 占用。` }
    }
    const holdConflict = await findActiveHoldConflict(tx, { unitId: unit.id, startAt, endAt })
    if (holdConflict) {
      return { ok: false, message: `设备 ${unit.unitCode} 已被临时锁定至 ${normalizeDateTime(holdConflict.expires_at)}。` }
    }
    const insert = await tx.run(`
      INSERT INTO schedule_holds (
        hold_no, merchant_id, store_id, actor_id, actor_role, model_code, unit_id, unit_code,
        rent_start_date, rent_end_date, occupation_start_at, occupation_end_at, planned_ship_at,
        expected_arrive_at, return_buffer_days, query_address_json, address_parse_json,
        sf_estimate_json, availability_result_json, status, expires_at, idempotency_key_hash,
        client_request_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      holdNo,
      actor.merchantId,
      payload.storeId || actor.storeId || null,
      actor.actorId,
      actor.role,
      availability.modelCode,
      unit.id,
      unit.unitCode,
      availability.rentStartDate,
      availability.rentEndDate,
      startAt,
      endAt,
      normalizeDateTime(availability.plan.plannedShipAt) || null,
      normalizeDateTime(availability.plan.expectedArriveAt) || null,
      Number(payload.returnBufferDays || 2),
      safeJson({ province: availability.addressParse.province, city: availability.addressParse.city, district: availability.addressParse.district, input: availability.addressParse.input }),
      safeJson(availability.addressParse),
      safeJson({ source: availability.plan.source, sourceLabel: availability.plan.sourceLabel, fallbackReason: availability.plan.fallbackReason, transitDays: availability.plan.transitDays }),
      safeJson({ classification: availability.classification, counts: availability.counts, quote: availability.quote, depositExemption: availability.depositExemption }),
      HOLD_ACTIVE,
      expiresAt,
      idempotencyHash,
      payload.clientRequestId || null,
    ])
    const row = await tx.get('SELECT * FROM schedule_holds WHERE id = ?', [insert.lastInsertRowid])
    return { ok: true, hold: mapHold(row), id: insert.lastInsertRowid }
  })

  await auditRentalCore({
    operationType: 'rental.hold.create',
    actor: payload.actor,
    status: result.ok ? 'executed' : 'blocked',
    payload: {
      holdNo,
      modelCode: availability.modelCode,
      unitId: unit.id,
      rentStartDate: availability.rentStartDate,
      rentEndDate: availability.rentEndDate,
    },
    impact: {
      summary: result.ok ? `已锁定 ${unit.unitCode} 至 ${expiresAt}。` : result.message,
      affectedRecords: result.ok ? [{ type: 'schedule_holds', id: result.id }, { type: 'schedule_units', id: unit.id }] : [],
      externalEffects: [],
    },
  })
  return result
}

async function listRentalHolds(filters = {}) {
  await expireHolds()
  const where = []
  const params = []
  if (filters.status) {
    where.push('h.status = ?')
    params.push(filters.status)
  }
  if (filters.modelCode) {
    where.push('h.model_code = ?')
    params.push(filters.modelCode)
  }
  const rows = await mysqlAdapter.all(`
    SELECT h.*
    FROM schedule_holds h
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT 100
  `, params)
  return { ok: true, holds: rows.map(mapHold), sensitiveValuesReturned: false }
}

async function getHoldForUpdate(tx, holdNoOrId) {
  return tx.get(`
    SELECT *
    FROM schedule_holds
    WHERE hold_no = ? OR id = ?
    LIMIT 1
    FOR UPDATE
  `, [normalizeText(holdNoOrId), Number(holdNoOrId) || 0])
}

async function extendRentalHold({ holdNo, actor } = {}) {
  assertLocalWriteTarget()
  await expireHolds()
  const result = await mysqlAdapter.transaction(async (tx) => {
    const row = await getHoldForUpdate(tx, holdNo)
    if (!row) return { ok: false, message: '临时锁定不存在。' }
    if (row.status !== HOLD_ACTIVE) return { ok: false, message: '只有锁定中的记录可以延长。' }
    if (Number(row.extended_count || 0) >= HOLD_MAX_EXTENSION_COUNT) return { ok: false, message: '临时锁定只能延长一次。' }
    const nextExpiresAt = formatDateTime(addMinutes(new Date(), HOLD_TTL_MINUTES))
    await tx.run(`
      UPDATE schedule_holds
      SET expires_at = ?, extended_count = extended_count + 1, updated_at = NOW()
      WHERE id = ?
    `, [nextExpiresAt, row.id])
    const next = await tx.get('SELECT * FROM schedule_holds WHERE id = ?', [row.id])
    return { ok: true, hold: mapHold(next), message: `已延长锁定至 ${nextExpiresAt}` }
  })
  await auditRentalCore({
    operationType: 'rental.hold.extend',
    actor,
    status: result.ok ? 'executed' : 'blocked',
    payload: { holdNo },
    impact: { summary: result.message || '延长锁定失败。', affectedRecords: result.hold ? [{ type: 'schedule_holds', id: result.hold.id }] : [], externalEffects: [] },
  })
  return result
}

async function releaseRentalHold({ holdNo, reason, actor } = {}) {
  assertLocalWriteTarget()
  await expireHolds()
  const result = await mysqlAdapter.transaction(async (tx) => {
    const row = await getHoldForUpdate(tx, holdNo)
    if (!row) return { ok: false, message: '临时锁定不存在。' }
    if (row.status !== HOLD_ACTIVE) return { ok: false, message: '只有锁定中的记录可以释放。' }
    await tx.run(`
      UPDATE schedule_holds
      SET status = ?, release_reason = ?, updated_at = NOW()
      WHERE id = ?
    `, [HOLD_RELEASED, normalizeText(reason) || '手动释放', row.id])
    const next = await tx.get('SELECT * FROM schedule_holds WHERE id = ?', [row.id])
    return { ok: true, hold: mapHold(next), message: '锁定已释放。' }
  })
  await auditRentalCore({
    operationType: 'rental.hold.release',
    actor,
    status: result.ok ? 'executed' : 'blocked',
    payload: { holdNo, reason },
    impact: { summary: result.message || '释放锁定失败。', affectedRecords: result.hold ? [{ type: 'schedule_holds', id: result.hold.id }] : [], externalEffects: [] },
  })
  return result
}

async function createOrderFromHold(payload = {}) {
  assertLocalWriteTarget()
  await expireHolds()
  const customer = payload.customer || {}
  const required = {
    customerName: normalizeText(customer.customerName || customer.name),
    customerPhone: normalizeText(customer.customerPhone || customer.phone),
    province: normalizeText(customer.province),
    city: normalizeText(customer.city),
    district: normalizeText(customer.district),
    address: normalizeText(customer.address),
  }
  if (!required.customerName || !required.customerPhone || !required.province || !required.city || !required.district || !required.address) {
    return { ok: false, message: '创建订单需要完整客户姓名、手机号、省市区县和详细地址。' }
  }
  const actor = normalizeActor(payload.actor || {})
  const orderNo = normalizeText(payload.orderNo) || buildOrderNo()
  const fee = Number(payload.price?.fee || payload.fee || 0)
  const deposit = Number(payload.price?.deposit || payload.deposit || 0)
  const sourceChannel = normalizeText(payload.channel || payload.sourceChannel || '手工录入')
  const result = await mysqlAdapter.transaction(async (tx) => {
    const hold = await getHoldForUpdate(tx, payload.holdNo || payload.holdId)
    if (!hold) return { ok: false, message: '临时锁定不存在。' }
    if (hold.status !== HOLD_ACTIVE) return { ok: false, message: '只有锁定中的记录可以转订单。' }
    if (new Date(normalizeDateTime(hold.expires_at)).getTime() <= Date.now()) {
      await tx.run('UPDATE schedule_holds SET status = ?, release_reason = ?, updated_at = NOW() WHERE id = ?', [HOLD_EXPIRED, '转订单时锁定已过期', hold.id])
      return { ok: false, message: '临时锁定已过期，请重新查档期。' }
    }
    const blockConflict = await findScheduleBlockConflict(tx, {
      unitId: hold.unit_id,
      startDate: String(hold.occupation_start_at).slice(0, 10),
      endDate: String(hold.occupation_end_at).slice(0, 10),
    })
    if (blockConflict) return { ok: false, message: `转订单失败：设备已被订单 ${blockConflict.order_no || blockConflict.order_id || blockConflict.id} 占用。` }

    const insertOrder = await tx.run(`
      INSERT INTO rental_orders (
        session_id, order_no, customer_name, customer_phone, province, city, district, address,
        model_code, unit_id, rent_start_date, rent_end_date, fee, deposit, order_status,
        planned_ship_at, expected_arrive_at, shipping_mode, latest_logistics_status,
        source_channel, source_name, remark, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      payload.sessionId || null,
      orderNo,
      required.customerName,
      required.customerPhone,
      required.province,
      required.city,
      required.district,
      required.address,
      hold.model_code,
      hold.unit_id,
      String(hold.rent_start_date).slice(0, 10),
      String(hold.rent_end_date).slice(0, 10),
      Number.isFinite(fee) ? fee : 0,
      Number.isFinite(deposit) ? deposit : 0,
      payload.orderStatus || 'waiting_payment',
      normalizeDateTime(hold.planned_ship_at) || null,
      normalizeDateTime(hold.expected_arrive_at) || null,
      payload.shippingMode || 'land',
      'pending',
      sourceChannel,
      payload.sourceName || 'rental-core-v2',
      payload.remark || `由临时锁定 ${hold.hold_no} 创建`,
    ])
    const orderId = insertOrder.lastInsertRowid
    const startDate = dateOnlyFromDateTime(hold.occupation_start_at)
    const endDate = dateOnlyFromDateTime(hold.occupation_end_at)
    const rentStartDate = dateOnlyFromDateTime(hold.rent_start_date)
    const rentEndDate = dateOnlyFromDateTime(hold.rent_end_date)
    const expectedArriveDate = dateOnlyFromDateTime(hold.expected_arrive_at) || rentStartDate
    const plannedShipAt = normalizeDateTime(hold.planned_ship_at) || null
    const expectedArriveAt = normalizeDateTime(hold.expected_arrive_at) || null
    await tx.run(`
      INSERT INTO schedule_blocks (unit_id, order_id, model_code, block_type, start_date, end_date, planned_ship_at, expected_arrive_at, status, note, updated_at)
      VALUES (?, ?, ?, 'shipping', ?, ?, ?, ?, 'active', '租赁发货占用', NOW())
    `, [hold.unit_id, orderId, hold.model_code, startDate, expectedArriveDate, plannedShipAt, expectedArriveAt])
    await tx.run(`
      INSERT INTO schedule_blocks (unit_id, order_id, model_code, block_type, start_date, end_date, planned_ship_at, expected_arrive_at, status, note, updated_at)
      VALUES (?, ?, ?, 'rent', ?, ?, ?, ?, 'active', '租期占用', NOW())
    `, [hold.unit_id, orderId, hold.model_code, rentStartDate, rentEndDate, plannedShipAt, expectedArriveAt])
    await tx.run(`
      INSERT INTO schedule_blocks (unit_id, order_id, model_code, block_type, start_date, end_date, planned_ship_at, expected_arrive_at, status, note, updated_at)
      VALUES (?, ?, ?, 'buffer', ?, ?, NULL, NULL, 'active', '归还验机清洁充电打包缓冲', NOW())
    `, [hold.unit_id, orderId, hold.model_code, rentEndDate, endDate])
    await tx.run(`
      INSERT INTO shipping_records (order_id, carrier, shipping_mode, latest_status, planned_ship_at, expected_arrive_at, updated_at)
      VALUES (?, 'sf', ?, 'pending', ?, ?, NOW())
    `, [orderId, payload.shippingMode || 'land', plannedShipAt, expectedArriveAt])
    await tx.run(`
      UPDATE schedule_holds
      SET status = ?, converted_order_id = ?, release_reason = '已转订单', updated_at = NOW()
      WHERE id = ?
    `, [HOLD_CONVERTED, orderId, hold.id])
    await tx.run(`
      UPDATE schedule_units
      SET status = CASE WHEN status IN ('repair', 'offline') THEN status ELSE 'busy' END, updated_at = NOW()
      WHERE id = ?
    `, [hold.unit_id])
    const order = await tx.get('SELECT * FROM rental_orders WHERE id = ?', [orderId])
    const nextHold = await tx.get('SELECT * FROM schedule_holds WHERE id = ?', [hold.id])
    return { ok: true, orderId, orderNo, order, hold: mapHold(nextHold), message: '订单已创建，锁定已转订单。' }
  })

  await auditRentalCore({
    operationType: 'rental.hold.convert_order',
    actor,
    status: result.ok ? 'executed' : 'blocked',
    payload: { holdNo: payload.holdNo || payload.holdId, orderNo, sourceChannel },
    impact: {
      summary: result.message || '锁定转订单失败。',
      affectedRecords: result.ok ? [{ type: 'rental_orders', id: result.orderId }, { type: 'schedule_holds', id: result.hold?.id }] : [],
      externalEffects: [],
    },
  })
  return result
}

function getNextActionForOrder(order = {}) {
  const status = normalizeText(order.order_status || order.status)
  const depositStatus = Number(order.is_deposit_free || 0) ? '待免押核验' : (Number(order.deposit || 0) > 0 ? '待押金确认' : '无需押金')
  const shippingStatus = normalizeText(order.latest_logistics_status || order.shippingStatus)
  const labels = {
    waiting_payment: '核对押金/免押并确认订单',
    pending: '确认客户信息并准备发货',
    waiting_shipping: '创建发出物流',
    shipped: '跟踪发出物流',
    renting: '等待客户归还',
    returning: '跟踪归还物流',
    returned: '归还验机',
    completed: '订单已完成',
    cancelled: '订单已取消',
  }
  return {
    mainStatus: status || 'waiting_payment',
    depositStatus,
    shippingStatus: shippingStatus || 'pending',
    returnShippingStatus: normalizeText(order.return_shipping_status) || 'not_started',
    inspectionStatus: normalizeText(order.inspection_status) || 'not_started',
    paymentStatus: Number(order.fee || 0) > 0 ? '待核对' : '未设置',
    nextAction: labels[status] || '按订单详情推进下一步',
  }
}

module.exports = {
  HOLD_ACTIVE,
  HOLD_CONVERTED,
  HOLD_EXPIRED,
  HOLD_RELEASED,
  createOrderFromHold,
  createRentalHold,
  extendRentalHold,
  getNextActionForOrder,
  listRentalHolds,
  parseFuzzyAddress,
  queryRentalAvailability,
  releaseRentalHold,
}
