# SF Shipping Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop `顺丰寄件` workbench that supports domestic standalone and rental-order-linked SF Standard/SF Half-Day shipping, plus SF intra-city fee/time quoting.

**Architecture:** Put SF shipment payload construction, product/status mapping, response normalization, and sensitive-data redaction in a focused CommonJS module. Keep MySQL persistence and existing rental-order synchronization in `dbManager.js`, reusing its OAuth `/std/service` transport; expose explicit IPC methods to a new Vue operational page. Intra-city quoting uses separately configured credentials and never creates a shipment order in this release.

**Tech Stack:** Electron main/preload IPC, Vue 3 renderer, MySQL via `mysqlAdapter`, Node `fetch`, Node built-in test runner.

---

## 2026-05-27 Confirmed Enhancement: One-Action Express Shipping

**Goal:** Remove the required manual precheck step for express shipments, show an estimated arrival after placing an order, and constrain pickup booking to usable time slots.

**Architecture:** Add pure pickup-time validation helpers in `electron/main/sfShippingService.js`; add a `dbManager.js` orchestration action that saves a draft, runs pre-order validation, submits the order, and automatically recovers an uncertain create response. The Vue workbench invokes that action behind one `立即下单` command while retaining a final real-order confirmation and displaying the pre-shipment delivery estimate separately from post-pickup promised-time refresh.

**Files:**
- Modify: `electron/main/sfShippingService.js`
- Modify: `electron/tests/sfShippingService.test.mjs`
- Modify: `electron/main/dbManager.js`
- Modify: `electron/main/ipcHandlers.js`
- Modify: `electron/preload/preload.js`
- Modify: `electron/renderer/src/views/rental/SfShippingWorkbench.vue`
- Modify: `docs/rental-ops/test-checklist.md`
- Modify: `progress.md`

### Task 7: Pickup-Time Validation

- [x] Write failing tests requiring planned express pickup times to be between `08:00` and `20:00` inclusive and requiring quick values for `10:00-11:00` (submitted as `10:00`) and `17:00`.
- [x] Implement pure validation/formatting helpers and run `node --test electron/tests/sfShippingService.test.mjs`.

### Task 8: One-Action Submit Orchestration

- [x] Add one backend action that receives current form data, saves the draft, rejects invalid pickup time before any remote request, automatically calls precheck, then submits only when precheck is valid.
- [x] When formal creation enters `result_pending`, automatically call order-result recovery once; never create a second order for an existing submitted record.
- [x] Run the existing pre-shipment delivery estimate with the selected pickup time and destination, persist/return available estimated arrival, and return a visible warning when it fails.
- [x] Expose the new action through IPC and preload.

### Task 9: Workbench Interaction And Verification

- [x] Replace the required `预校验` / `确认并正式下单` sequence for express products with one `立即下单` action plus the real-order confirmation dialog. Keep same-city quotation query-only.
- [x] Add `上午 10:00-11:00` and `傍晚 17:00` shortcuts; block manually entered times outside `08:00-20:00` using a red alert.
- [x] Show formal order status, tracking number, estimated arrival result/source, and payment fallback notice.
- [x] Run focused tests, syntax checks and renderer build; restart Electron and test the form without submitting another real order.

## 2026-05-28 Confirmed Enhancement: Complete Production Fulfillment Loop

**Goal:** Extend the existing shipping workbench with per-shipment sender editing, live express estimates, order cancellation, route tracking, billed fees, corrected actual payment, and monthly expense reporting.

**Confirmed constraints:** `EXP_RECE_UPDATE_ORDER`, `EXP_RECE_SEARCH_ROUTES` and `EXP_RECE_QUERY_SFWAYBILL` are production-enabled for the user's SF application. A temporary sender address does not update defaults unless `保存为默认寄件地址` is checked. Monthly expense reporting uses final actual payment; it initially follows billed fee and can be manually corrected with a note.

### Task 10: Pure SF Request And Response Rules

**Files:**
- Modify: `electron/main/sfShippingService.js`
- Modify: `electron/tests/sfShippingService.test.mjs`

- [x] Write failing tests for `buildCancelOrderPayload({ shipmentNo })`, `buildRouteQueryPayload({ waybillNo })`, `buildWaybillFeePayload({ waybillNo })`, `normalizeCancelOrderResult()`, `normalizeRouteResult()` and `normalizeWaybillFeeResult()`.
- [x] Use the enabled SF app contracts: cancellation payload includes `{ language: 'zh-CN', orderId, dealType: 2, waybillNoInfoList: [] }`; route lookup uses `{ language: '0', trackingType: '1', trackingNumber: [waybillNo], methodType: '1' }`; fee lookup uses the清单运费接口 payload required by the current app.
- [x] Normalize route nodes as `{ acceptTime, acceptAddress, remark, opCode }`, and normalize fee rows as `{ type, name, value, paymentTypeCode, settlementTypeCode }` plus a computed total.
- [x] Run `node --test electron/tests/sfShippingService.test.mjs` after the failing and passing stages.

### Task 11: Shipment Persistence And Electron Actions

**Files:**
- Modify: `scripts/mysql_schema.sql`
- Modify: `electron/main/dbManager.js`
- Modify: `electron/main/ipcHandlers.js`
- Modify: `electron/preload/preload.js`

- [x] Extend `sf_shipments` with estimated/billed/actual fee, actual-payment provenance and note, cancellation and query result JSON fields; add an `expense_record_id` link used to upsert one `shipping_sf` expense per shipment.
- [x] Make runtime migration idempotently add the new columns for existing MySQL installations.
- [x] Accept sender snapshot fields from draft input and, when `saveSenderAsDefault` is true, persist only sender default configuration through the existing config store.
- [x] Return estimate fee from `EXP_RECE_QUERY_DELIVERTM`; expose an explicit preview action used by the renderer before formal submit.
- [x] Implement cancellation, route refresh, fee refresh and actual-payment update actions. Fee refresh initializes actual payment and expense record only when the user has not overridden it; actual-payment update upserts the linked expense record.
- [x] Add IPC/preload methods for `quoteSfExpress`, `cancelSfShipment`, `querySfShipmentRoutes`, `querySfShipmentFee` and `updateSfShipmentActualPaid`.

### Task 12: Task-First Shipping UI

**Files:**
- Modify: `electron/renderer/src/views/rental/SfShippingWorkbench.vue`

- [x] Render the default sender as an editable card with `更换寄件地址`, `恢复默认地址` and an unchecked `保存为默认寄件地址`.
- [x] Debounce express estimation after all required fields are valid; show estimated arrival and estimated fee separately from billed and actual values.
- [x] In records/detail views add cancellation, route refresh, fee refresh and actual-payment editing with required note when it differs from billed total.
- [x] Render route nodes as an ordered transport timeline and render billed fee component rows.

### Task 13: Verification

**Files:**
- Modify: `docs/rental-ops/test-checklist.md`
- Modify: `progress.md`

- [x] Document safe real-interface checks: quote without order creation; create/cancel only after explicit confirmation; route and billed-fee queries use an existing test waybill when available.
- [x] Run `node --test electron/tests/sfShippingService.test.mjs`.
- [x] Run `node --check electron/main/sfShippingService.js && node --check electron/main/dbManager.js && node --check electron/main/ipcHandlers.js && node --check electron/preload/preload.js`.
- [x] Run renderer build from `electron/` using bundled Node because this shell has no `npm`.
- [ ] Render-check `/sf-shipping` in the local app without placing a real order.

## Scope And File Map

Files to create:

- `electron/main/sfShippingService.js`: pure SF product definitions, domestic request builders, response/state parsers, redaction helpers, and intra-city quote payload parser.
- `electron/tests/sfShippingService.test.mjs`: unit tests for every high-risk SF request and state rule.
- `electron/renderer/src/views/rental/SfShippingWorkbench.vue`: task-first desktop page for new shipment, history/detail, and waybill query.

Files to modify:

- `scripts/mysql_schema.sql`: `sf_shipments` and `sf_shipment_events` source schema.
- `electron/main/dbManager.js`: runtime table creation, generic SF service transport reuse, shipment CRUD/actions, event persistence, and optional rental-order synchronization.
- `electron/main/ipcHandlers.js`: main process action endpoints.
- `electron/preload/preload.js`: renderer-safe SF workbench API exposure.
- `python/config_manager.py`: default SF product and intra-city config keys.
- `electron/renderer/src/views/Settings.vue`: sender contact, product ID, and intra-city credential fields.
- `electron/renderer/src/router/index.js`: new route.
- `electron/renderer/src/components/AppSidebar.vue`: navigation entry.
- `docs/rental-ops/test-checklist.md`: manual/real-interface verification entries.
- `progress.md`: delivered feature and executed validation notes.

Important workspace rule: the worktree already contains unrelated uncommitted changes, including some files above. Every commit in this plan must stage only explicitly listed paths and preserve all pre-existing work.

### Task 1: SF Shipment Rules And Parsers

**Files:**
- Create: `electron/main/sfShippingService.js`
- Create: `electron/tests/sfShippingService.test.mjs`

- [ ] **Step 1: Write failing unit tests for product IDs, payment restriction, requests, response parsing, and redaction**

Create the test file with tests shaped as follows:

```js
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  SF_PRODUCTS,
  buildExpressOrderPayload,
  buildPromiseTimePayload,
  buildIntraCityQuotePayload,
  mapFilterResult,
  normalizeCreateOrderResult,
  redactShipmentSecrets,
  validateExpressShipmentData,
  validateCreateOrderPrerequisites,
} = require('../main/sfShippingService.js')

test('uses confirmed domestic express product identifiers', () => {
  assert.equal(SF_PRODUCTS.sf_standard.expressTypeId, 2)
  assert.equal(SF_PRODUCTS.sf_half_day.expressTypeId, 263)
  assert.equal(SF_PRODUCTS.sf_intra_city_quote.expressTypeId, null)
})

test('requires monthly-card sender payment before real express order', () => {
  assert.deepEqual(validateCreateOrderPrerequisites({ monthlyCard: '' }), {
    ok: false,
    message: '未配置顺丰月结卡号，不能创建真实运单',
  })
})

test('allows precheck without a monthly card when addresses are complete', () => {
  const input = {
    productType: 'sf_standard',
    sender: { name: '小狗相机', mobile: '13800000000', province: '四川省', city: '成都市', address: '测试地址1号' },
    receiver: { name: '客户', mobile: '13900000000', province: '四川省', city: '绵阳市', address: '测试地址2号' },
  }
  assert.deepEqual(validateExpressShipmentData(input), { ok: true })
})

test('builds mainland express payload using sender payment and selected product', () => {
  const payload = buildExpressOrderPayload({
    shipmentNo: 'SFSHIP202605260001',
    productType: 'sf_half_day',
    monthlyCard: '1234567890',
    cargoName: '租赁相机',
    weightKg: 1,
    sender: { name: '小狗相机', mobile: '13800000000', province: '四川省', city: '成都市', district: '武侯区', address: '测试地址1号' },
    receiver: { name: '测试客户', mobile: '13900000000', province: '四川省', city: '绵阳市', district: '涪城区', address: '测试地址2号' },
  })
  assert.equal(payload.orderId, 'SFSHIP202605260001')
  assert.equal(payload.expressTypeId, 263)
  assert.equal(payload.payMethod, 1)
  assert.equal(payload.monthlyCard, '1234567890')
  assert.equal(payload.contactInfoList[0].contactType, 1)
  assert.equal(payload.contactInfoList[1].contactType, 2)
  assert.deepEqual(payload.cargoDetails, [{ name: '租赁相机' }])
})

test('maps uncertain SF filter results without reporting shipment success', () => {
  assert.deepEqual(mapFilterResult(1), { status: 'manual_review', label: '待顺丰人工确认', tone: 'warning' })
  assert.deepEqual(mapFilterResult(2), { status: 'waybill_created', label: '可收派', tone: 'success' })
  assert.deepEqual(mapFilterResult(3), { status: 'rejected', label: '不可收派', tone: 'danger' })
  assert.deepEqual(mapFilterResult(4), { status: 'manual_review', label: '结果待确认', tone: 'warning' })
})

test('extracts main waybill and filter state from create-order response', () => {
  const result = normalizeCreateOrderResult({
    success: true,
    msgData: { orderId: 'S001', filterResult: 2, waybillNoInfoList: [{ waybillType: 1, waybillNo: 'SF100000000001' }] },
  })
  assert.equal(result.waybillNo, 'SF100000000001')
  assert.equal(result.orderStatus, 'waybill_created')
})

test('builds promise-time and intra-city request payloads', () => {
  assert.deepEqual(buildPromiseTimePayload({ waybillNo: 'SF100', monthlyCard: '1234567890' }), {
    searchNo: 'SF100',
    checkType: 2,
    checkNos: ['1234567890'],
  })
  const quote = buildIntraCityQuotePayload({
    config: { projectCode: 'P1', shopId: 'S1', shopType: 2 },
    cityName: '成都市', address: '四川省成都市武侯区测试路1号', weightGram: 1000,
  })
  assert.equal(quote.CityName, '成都市')
  assert.equal(quote.Weight, 1000)
})

test('does not expose monthly cards or tokens in persistent summaries', () => {
  assert.deepEqual(redactShipmentSecrets({ accessToken: 'token', monthlyCard: '1234567890', name: 'ok' }), {
    accessToken: '[hidden]', monthlyCard: '******7890', name: 'ok',
  })
})
```

- [ ] **Step 2: Run the tests to confirm the service does not exist**

Run:

```bash
node --test electron/tests/sfShippingService.test.mjs
```

Expected: failure with `Cannot find module '../main/sfShippingService.js'`.

- [ ] **Step 3: Implement the focused SF rules/service module**

Create a CommonJS module exporting the tested API. Use the following contracts:

```js
const SF_PRODUCTS = Object.freeze({
  sf_standard: { label: '顺丰标快', expressTypeId: 2, serviceKind: 'express' },
  sf_half_day: { label: '顺丰半日达', expressTypeId: 263, serviceKind: 'express' },
  sf_intra_city_quote: { label: '顺丰同城询价', expressTypeId: null, serviceKind: 'intra_city_quote' },
})

function validateExpressShipmentData({ sender, receiver, productType }) {
  if (!SF_PRODUCTS[productType] || SF_PRODUCTS[productType].serviceKind !== 'express') {
    return { ok: false, message: '当前产品不支持创建真实运单' }
  }
  for (const [label, contact] of [['寄件人', sender], ['收件人', receiver]]) {
    if (!contact?.name || !contact?.mobile || !contact?.province || !contact?.city || !contact?.address) {
      return { ok: false, message: `${label}信息不完整` }
    }
  }
  return { ok: true }
}

function validateCreateOrderPrerequisites(input) {
  if (!String(input.monthlyCard || '').trim()) return { ok: false, message: '未配置顺丰月结卡号，不能创建真实运单' }
  return validateExpressShipmentData(input)
}

function toContactInfo(contactType, contact) {
  return {
    contactType,
    contact: String(contact.name).trim(),
    mobile: String(contact.mobile).trim(),
    country: 'CN',
    province: String(contact.province).trim(),
    city: String(contact.city).trim(),
    county: String(contact.district || '').trim() || undefined,
    address: String(contact.address).trim(),
  }
}

function buildExpressOrderPayload(input) {
  const product = SF_PRODUCTS[input.productType]
  return {
    language: 'zh-CN',
    orderId: input.shipmentNo,
    monthlyCard: String(input.monthlyCard).trim(),
    payMethod: 1,
    expressTypeId: Number(input.expressTypeId || product.expressTypeId),
    parcelQty: 1,
    totalWeight: Number(input.weightKg || 1),
    cargoDetails: [{ name: String(input.cargoName || '租赁设备').trim() }],
    contactInfoList: [toContactInfo(1, input.sender), toContactInfo(2, input.receiver)],
    ...(input.sendStartTime ? { sendStartTm: input.sendStartTime, isDocall: 1 } : {}),
    isGenWaybillNo: 1,
    isUnifiedWaybillNo: 1,
  }
}
```

Implement `buildPreOrderPayload()` by selecting the supported pre-order fields from the express payload and omitting an empty `monthlyCard`, so precheck remains available before月结配置. Implement `buildPromiseTimePayload()`, `buildIntraCityQuotePayload()`, `normalizePreOrderResult()`, `normalizeCreateOrderResult()`, `normalizeOrderSearchResult()`, `normalizePromiseTimeResult()`, `normalizeIntraCityQuoteResult()`, `mapFilterResult()` and recursive `redactShipmentSecrets()`. Do not embed credentials or make network requests in this module.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test electron/tests/sfShippingService.test.mjs
```

Expected: all SF service tests pass.

- [ ] **Step 5: Commit the pure service**

```bash
git add electron/main/sfShippingService.js electron/tests/sfShippingService.test.mjs
git commit -m "feat: add sf shipping request and response rules"
```

### Task 2: Shipment Persistence And Runtime Schema

**Files:**
- Modify: `scripts/mysql_schema.sql`
- Modify: `electron/main/dbManager.js`

- [ ] **Step 1: Add schema source definitions**

After `shipping_records`, add two tables:

```sql
CREATE TABLE IF NOT EXISTS sf_shipments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_no VARCHAR(64) NOT NULL UNIQUE,
  rental_order_id INT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'standalone',
  product_type VARCHAR(32) NOT NULL,
  express_type_id INT NULL,
  sender_name VARCHAR(100), sender_mobile VARCHAR(30), sender_province VARCHAR(50),
  sender_city VARCHAR(100), sender_district VARCHAR(100), sender_address TEXT,
  receiver_name VARCHAR(100), receiver_mobile VARCHAR(30), receiver_province VARCHAR(50),
  receiver_city VARCHAR(100), receiver_district VARCHAR(100), receiver_address TEXT,
  cargo_name VARCHAR(128), weight_kg DECIMAL(10,3) DEFAULT 1,
  pay_method INT DEFAULT 1, monthly_card_snapshot VARCHAR(30),
  sf_order_id VARCHAR(64), waybill_no VARCHAR(30),
  preorder_status VARCHAR(32) DEFAULT 'draft',
  order_status VARCHAR(32) DEFAULT 'draft',
  filter_result INT NULL, filter_remark TEXT,
  promised_delivery_at DATETIME NULL, last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sf_shipments_created (created_at),
  INDEX idx_sf_shipments_rental_order (rental_order_id),
  INDEX idx_sf_shipments_waybill (waybill_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sf_shipment_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shipment_id INT NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  request_id VARCHAR(64),
  service_code VARCHAR(64),
  success TINYINT NOT NULL DEFAULT 0,
  error_code VARCHAR(64),
  error_message TEXT,
  response_summary_json JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sf_events_shipment_created (shipment_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Add idempotent runtime table creation**

Import service helpers at the top of `dbManager.js`:

```js
const {
  SF_PRODUCTS,
  buildExpressOrderPayload,
  buildPreOrderPayload,
  buildPromiseTimePayload,
  buildIntraCityQuotePayload,
  normalizePreOrderResult,
  normalizeCreateOrderResult,
  normalizeOrderSearchResult,
  normalizePromiseTimeResult,
  normalizeIntraCityQuoteResult,
  redactShipmentSecrets,
  validateExpressShipmentData,
  validateCreateOrderPrerequisites,
} = require('./sfShippingService')
```

Add `ensureSfShippingTables()` containing the same `CREATE TABLE IF NOT EXISTS` definitions, and call it during DB initialization immediately after `ensureInquiryEventsTable()`.

- [ ] **Step 3: Add shipment persistence methods**

Implement these functions in `dbManager.js`:

```js
function buildShipmentNumber() {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  return `XG${stamp}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
}

async function saveSfShipmentDraft(payload = {}) {
  const config = await getConfig()
  const order = payload.rentalOrderId ? await getOrderById(payload.rentalOrderId) : null
  const product = SF_PRODUCTS[payload.productType]
  const receiver = {
    name: payload.receiverName || order?.customer_name || '',
    mobile: payload.receiverMobile || order?.customer_phone || '',
    province: payload.receiverProvince || order?.province || '',
    city: payload.receiverCity || order?.city || '',
    district: payload.receiverDistrict || order?.district || '',
    address: payload.receiverAddress || order?.address || '',
  }
  const expressTypeId = payload.productType === 'sf_standard'
    ? Number(config.SF_STANDARD_EXPRESS_TYPE_ID || 2)
    : payload.productType === 'sf_half_day' ? Number(config.SF_HALF_DAY_EXPRESS_TYPE_ID || 263) : null
  if (payload.id) {
    const current = await mysqlAdapter.get('SELECT * FROM sf_shipments WHERE id = ?', [payload.id])
    if (current?.order_status && !['draft', 'precheck_failed', 'prechecked'].includes(current.order_status)) {
      return { ok: false, message: '该寄件单已发起正式下单，不能修改寄件资料' }
    }
    await mysqlAdapter.run(`UPDATE sf_shipments
      SET rental_order_id = ?, source_type = ?, product_type = ?, express_type_id = ?,
          receiver_name = ?, receiver_mobile = ?, receiver_province = ?, receiver_city = ?,
          receiver_district = ?, receiver_address = ?, cargo_name = ?, weight_kg = ?,
          preorder_status = 'draft', order_status = 'draft', last_error = NULL, updated_at = NOW()
      WHERE id = ?`, [
        order?.id || null, order ? 'rental_order' : 'standalone', payload.productType, expressTypeId,
        receiver.name, receiver.mobile, receiver.province, receiver.city, receiver.district, receiver.address,
        payload.cargoName || config.SF_CARGO_NAME || '租赁设备', Number(payload.weightKg || 1), payload.id,
      ])
    return getSfShipmentDetail(payload.id)
  }
  const shipmentNo = buildShipmentNumber()
  const result = await mysqlAdapter.run(`INSERT INTO sf_shipments (
      shipment_no, rental_order_id, source_type, product_type, express_type_id,
      sender_name, sender_mobile, sender_province, sender_city, sender_district, sender_address,
      receiver_name, receiver_mobile, receiver_province, receiver_city, receiver_district, receiver_address,
      cargo_name, weight_kg, pay_method, monthly_card_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`, [
      shipmentNo, order?.id || null, order ? 'rental_order' : 'standalone', payload.productType, expressTypeId,
      config.SF_SENDER_CONTACT || '', config.SF_SENDER_MOBILE || '', config.SF_SENDER_PROVINCE || '',
      config.SF_SENDER_CITY || '', config.SF_SENDER_DISTRICT || '', config.SF_SENDER_ADDRESS || '',
      receiver.name, receiver.mobile, receiver.province, receiver.city, receiver.district, receiver.address,
      payload.cargoName || config.SF_CARGO_NAME || '租赁设备', Number(payload.weightKg || 1),
      config.SF_MONTHLY_CARD || '',
    ])
  return getSfShipmentDetail(result.lastInsertRowid)
}

async function listSfShipments(filters = {}) {
  const where = []
  const params = []
  if (filters.productType) { where.push('product_type = ?'); params.push(filters.productType) }
  if (filters.status) { where.push('order_status = ?'); params.push(filters.status) }
  if (filters.keyword) {
    where.push('(shipment_no LIKE ? OR waybill_no LIKE ? OR receiver_name LIKE ? OR receiver_city LIKE ?)')
    params.push(...Array(4).fill(`%${filters.keyword}%`))
  }
  return mysqlAdapter.all(`SELECT * FROM sf_shipments ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC LIMIT 200`, params)
}

async function getSfShipmentDetail(shipmentId) {
  const shipment = await mysqlAdapter.get('SELECT * FROM sf_shipments WHERE id = ?', [shipmentId])
  if (!shipment) return null
  const events = await mysqlAdapter.all('SELECT * FROM sf_shipment_events WHERE shipment_id = ? ORDER BY created_at DESC, id DESC', [shipmentId])
  return { ...shipment, events }
}

async function addSfShipmentEvent(shipmentId, event) {
  const summary = JSON.stringify(redactShipmentSecrets(event.responseSummary || {}))
  return mysqlAdapter.run(`INSERT INTO sf_shipment_events
    (shipment_id, event_type, request_id, service_code, success, error_code, error_message, response_summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      shipmentId, event.eventType, event.requestId || null, event.serviceCode,
      event.success ? 1 : 0, event.errorCode || null, event.errorMessage || null, summary,
    ])
}

async function syncSfShipmentToRentalOrder(shipment) {
  if (!shipment?.rental_order_id) return
  await updateShipping({
    orderId: shipment.rental_order_id,
    trackingNo: shipment.waybill_no || undefined,
    shippingMode: shipment.product_type,
    latestLogisticsStatus: shipment.filter_remark || '顺丰已创建运单',
    expectedArriveAt: shipment.promised_delivery_at || undefined,
  })
}
```

Rules in `saveSfShipmentDraft()`:

- `source_type = 'rental_order'` only when `rentalOrderId` points to an existing order; otherwise use `standalone`.
- Fill sender snapshot from settings.
- Map configured `SF_STANDARD_EXPRESS_TYPE_ID || '2'` and `SF_HALF_DAY_EXPRESS_TYPE_ID || '263'` into the selected product.
- Never put a full access token or secret in either table.

- [ ] **Step 4: Run syntax verification**

Run:

```bash
node --check electron/main/dbManager.js
```

Expected: no output and exit code `0`.

- [ ] **Step 5: Commit persistence changes**

```bash
git add scripts/mysql_schema.sql electron/main/dbManager.js
git commit -m "feat: persist sf shipment drafts and events"
```

### Task 3: Express API Orchestration And Idempotency

**Files:**
- Modify: `electron/main/dbManager.js`
- Modify: `electron/tests/sfShippingService.test.mjs`

- [ ] **Step 1: Extend parser tests for service-code-specific operations**

Add assertions verifying parser output used by orchestration:

```js
test('normalizes order-search recovery and promise-time results', () => {
  const recovered = normalizeOrderSearchResult({
    success: true,
    msgData: { orderId: 'S001', filterResult: 2, waybillNoInfoList: [{ waybillType: 1, waybillNo: 'SF100' }] },
  })
  assert.equal(recovered.waybillNo, 'SF100')
  assert.equal(recovered.orderStatus, 'waybill_created')
  assert.deepEqual(normalizePromiseTimeResult({ success: true, msgData: { searchNo: 'SF100', promiseTm: '2026-05-27 18:00:00' } }), {
    ok: true, waybillNo: 'SF100', promisedDeliveryAt: '2026-05-27 18:00:00',
  })
})
```

- [ ] **Step 2: Generalize the existing SF `/std/service` request wrapper**

Change the existing form builder to accept a service code:

```js
function buildSfFormBody({ customerCode, timestamp, serviceCode, msgData, accessToken }) {
  const params = new URLSearchParams()
  params.set('partnerID', customerCode)
  params.set('requestID', `req_${timestamp}`)
  params.set('serviceCode', serviceCode)
  params.set('timestamp', String(timestamp))
  params.set('msgData', msgData)
  params.set('accessToken', accessToken)
  return params.toString()
}
```

Update current delivery-time callers to pass `serviceCode: 'EXP_RECE_QUERY_DELIVERTM'`, preserving existing档期行为. Add:

```js
async function invokeSfExpressService(serviceCode, msgPayload) {
  const config = await getConfig()
  const customerCode = getSfPartnerId(config)
  const secret = getSfSecret(config)
  const api = getSfServiceApi(config)
  const tokenApi = getSfTokenApi(config)
  const requestID = `req_${Date.now()}`
  const accessToken = await fetchSfAccessToken({ customerCode, secret, tokenApi })
  const timestamp = Date.now()
  const body = buildSfFormBody({ customerCode, timestamp, serviceCode, msgData: JSON.stringify(msgPayload), accessToken })
  const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const rawText = await response.text()
  const envelope = normalizeSfApiEnvelope(parseSfHttpResponseText(rawText))
  return { requestID, response, envelope, rawText }
}
```

Reuse the existing token-refresh retry behavior; log only output from `stripSfDebugSecrets()`/`redactShipmentSecrets()`.

- [ ] **Step 3: Implement the action methods**

Add and export:

```js
function shipmentAsServiceInput(row) {
  return {
    shipmentNo: row.shipment_no,
    productType: row.product_type,
    expressTypeId: row.express_type_id,
    monthlyCard: row.monthly_card_snapshot,
    cargoName: row.cargo_name,
    weightKg: row.weight_kg,
    sender: { name: row.sender_name, mobile: row.sender_mobile, province: row.sender_province, city: row.sender_city, district: row.sender_district, address: row.sender_address },
    receiver: { name: row.receiver_name, mobile: row.receiver_mobile, province: row.receiver_province, city: row.receiver_city, district: row.receiver_district, address: row.receiver_address },
  }
}

async function precheckSfShipment({ shipmentId }) {
  const shipment = await getSfShipmentDetail(shipmentId)
  const validation = validateExpressShipmentData(shipmentAsServiceInput(shipment))
  if (!validation.ok) return validation
  const result = await invokeSfExpressService('EXP_RECE_PRE_ORDER', buildPreOrderPayload(shipmentAsServiceInput(shipment)))
  const normalized = normalizePreOrderResult(resolveSfResponsePayload(result.envelope))
  await addSfShipmentEvent(shipmentId, { eventType: 'pre_order', serviceCode: 'EXP_RECE_PRE_ORDER', requestId: result.requestID, success: normalized.ok, errorCode: normalized.errorCode, errorMessage: normalized.message, responseSummary: normalized })
  await mysqlAdapter.run("UPDATE sf_shipments SET preorder_status = ?, order_status = ?, last_error = ?, updated_at = NOW() WHERE id = ?", [
    normalized.ok ? 'prechecked' : 'precheck_failed', normalized.ok ? 'prechecked' : 'precheck_failed', normalized.ok ? null : normalized.message, shipmentId,
  ])
  return { ok: normalized.ok, shipment: await getSfShipmentDetail(shipmentId), message: normalized.message }
}

async function submitSfShipment({ shipmentId }) {
  const shipment = await getSfShipmentDetail(shipmentId)
  if (shipment.preorder_status !== 'prechecked') return { ok: false, message: '请先完成预校验' }
  const validation = validateCreateOrderPrerequisites(shipmentAsServiceInput(shipment))
  if (!validation.ok) return validation
  const lock = await mysqlAdapter.run("UPDATE sf_shipments SET order_status = 'submitting', updated_at = NOW() WHERE id = ? AND order_status = 'prechecked'", [shipmentId])
  if (!lock.changes) return { ok: false, message: '该寄件单已发起正式下单，请使用结果补查' }
  try {
    const result = await invokeSfExpressService('EXP_RECE_CREATE_ORDER', buildExpressOrderPayload(shipmentAsServiceInput(shipment)))
    const normalized = normalizeCreateOrderResult(resolveSfResponsePayload(result.envelope))
    await addSfShipmentEvent(shipmentId, { eventType: 'create_order', serviceCode: 'EXP_RECE_CREATE_ORDER', requestId: result.requestID, success: normalized.ok, errorCode: normalized.errorCode, errorMessage: normalized.message, responseSummary: normalized })
    await applySfOrderResult(shipmentId, normalized)
    const current = await getSfShipmentDetail(shipmentId)
    if (current.waybill_no) await syncSfShipmentToRentalOrder(current)
    return { ok: normalized.ok, shipment: current }
  } catch (error) {
    await mysqlAdapter.run("UPDATE sf_shipments SET order_status = 'result_pending', last_error = ?, updated_at = NOW() WHERE id = ?", [error.message, shipmentId])
    return { ok: false, action: 'recover_result', shipment: await getSfShipmentDetail(shipmentId), message: '正式下单结果未确认，请补查结果' }
  }
}

async function recoverSfShipmentResult({ shipmentId }) {
  const shipment = await getSfShipmentDetail(shipmentId)
  if (!['submitting', 'result_pending', 'manual_review'].includes(shipment.order_status)) return { ok: false, message: '该状态不需要补查下单结果' }
  const result = await invokeSfExpressService('EXP_RECE_SEARCH_ORDER_RESP', { orderId: shipment.shipment_no, searchType: '1', language: 'zh-CN' })
  const normalized = normalizeOrderSearchResult(resolveSfResponsePayload(result.envelope))
  await addSfShipmentEvent(shipmentId, { eventType: 'search_order_result', serviceCode: 'EXP_RECE_SEARCH_ORDER_RESP', requestId: result.requestID, success: normalized.ok, errorCode: normalized.errorCode, errorMessage: normalized.message, responseSummary: normalized })
  await applySfOrderResult(shipmentId, normalized)
  const current = await getSfShipmentDetail(shipmentId)
  if (current.waybill_no) await syncSfShipmentToRentalOrder(current)
  return { ok: normalized.ok, shipment: current }
}

async function applySfOrderResult(shipmentId, normalized) {
  const mapped = mapFilterResult(normalized.filterResult)
  await mysqlAdapter.run(`UPDATE sf_shipments
    SET sf_order_id = COALESCE(?, sf_order_id), waybill_no = COALESCE(?, waybill_no),
        filter_result = ?, filter_remark = ?, order_status = ?, last_error = ?, updated_at = NOW()
    WHERE id = ?`, [
      normalized.orderId || null, normalized.waybillNo || null, normalized.filterResult || null,
      normalized.message || mapped.label, mapped.status, normalized.ok ? null : normalized.message, shipmentId,
    ])
}

async function querySfShipmentPromiseTime({ shipmentId, waybillNo }) {
  const config = await getConfig()
  const shipment = shipmentId ? await getSfShipmentDetail(shipmentId) : null
  const resolvedWaybill = waybillNo || shipment?.waybill_no
  const result = await invokeSfExpressService('EXP_RECE_SEARCH_PROMITM', buildPromiseTimePayload({ waybillNo: resolvedWaybill, monthlyCard: config.SF_MONTHLY_CARD }))
  const normalized = normalizePromiseTimeResult(resolveSfResponsePayload(result.envelope))
  if (shipmentId && normalized.ok) {
    await mysqlAdapter.run('UPDATE sf_shipments SET promised_delivery_at = ?, updated_at = NOW() WHERE id = ?', [normalized.promisedDeliveryAt, shipmentId])
    await addSfShipmentEvent(shipmentId, { eventType: 'search_promise_time', serviceCode: 'EXP_RECE_SEARCH_PROMITM', requestId: result.requestID, success: true, responseSummary: normalized })
    await syncSfShipmentToRentalOrder(await getSfShipmentDetail(shipmentId))
  }
  return normalized
}

async function quoteSfIntraCity(payload) {
  const config = await getConfig()
  const required = ['SF_INTRACITY_API', 'SF_INTRACITY_COMPANY_CODE', 'SF_INTRACITY_ACCESS_CODE', 'SF_INTRACITY_CHECKWORD', 'SF_INTRACITY_PROJECT_CODE', 'SF_INTRACITY_SHOP_ID']
  if (required.some((key) => !String(config[key] || '').trim())) return { ok: false, message: '请先配置顺丰同城询价接口和凭据' }
  const request = {
    CompanyCode: config.SF_INTRACITY_COMPANY_CODE,
    AccessCode: config.SF_INTRACITY_ACCESS_CODE,
    Checkword: config.SF_INTRACITY_CHECKWORD,
    ServiceCode: 'FEE_TIME_SERVICE',
    ...buildIntraCityQuotePayload({
      config: { projectCode: config.SF_INTRACITY_PROJECT_CODE, shopId: config.SF_INTRACITY_SHOP_ID, shopType: Number(config.SF_INTRACITY_SHOP_TYPE || 2) },
      cityName: payload.cityName,
      address: payload.address,
      weightGram: payload.weightGram,
    }),
  }
  const response = await fetch(config.SF_INTRACITY_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  const result = normalizeIntraCityQuoteResult(await response.json())
  return result
}
```

Submission state transition:

```js
if (shipment.order_status !== 'draft' && shipment.order_status !== 'prechecked') {
  return { ok: false, message: '该寄件单已发起正式下单，请使用结果补查' }
}
await mysqlAdapter.run(
  "UPDATE sf_shipments SET order_status = 'submitting', updated_at = NOW() WHERE id = ? AND order_status IN ('draft', 'prechecked')",
  [shipmentId],
)
```

On transport timeout or uncertain response, update `order_status = 'result_pending'` and return the action `recover_result`; do not submit again. On waybill success, call `syncSfShipmentToRentalOrder()`.

- [ ] **Step 4: Verify existing and new parsers**

Run:

```bash
node --test electron/tests/sfShippingService.test.mjs electron/tests/rentalOpsRules.test.mjs
node --check electron/main/dbManager.js
```

Expected: tests pass and syntax check exits `0`.

- [ ] **Step 5: Commit express orchestration**

```bash
git add electron/main/dbManager.js electron/tests/sfShippingService.test.mjs
git commit -m "feat: orchestrate sf express shipment actions"
```

### Task 4: Configuration And IPC Contract

**Files:**
- Modify: `python/config_manager.py`
- Modify: `electron/renderer/src/views/Settings.vue`
- Modify: `electron/main/ipcHandlers.js`
- Modify: `electron/preload/preload.js`

- [ ] **Step 1: Add persisted default configuration keys**

In `python/config_manager.py`, next to existing `SF_` values, add:

```python
"SF_SENDER_CONTACT": "",
"SF_STANDARD_EXPRESS_TYPE_ID": "2",
"SF_HALF_DAY_EXPRESS_TYPE_ID": "263",
"SF_INTRACITY_API": "",
"SF_INTRACITY_COMPANY_CODE": "",
"SF_INTRACITY_ACCESS_CODE": "",
"SF_INTRACITY_CHECKWORD": "",
"SF_INTRACITY_PROJECT_CODE": "",
"SF_INTRACITY_SHOP_ID": "",
"SF_INTRACITY_SHOP_TYPE": "2",
```

- [ ] **Step 2: Extend the settings form**

In the existing `顺丰时效查询` settings group, add fields for:

```vue
<div class="form-group"><label>寄件联系人</label><input v-model="form.SF_SENDER_CONTACT" placeholder="小狗相机" /></div>
<div class="form-group"><label>顺丰标快产品编码</label><input v-model="form.SF_STANDARD_EXPRESS_TYPE_ID" placeholder="2" /></div>
<div class="form-group"><label>顺丰半日达产品编码</label><input v-model="form.SF_HALF_DAY_EXPRESS_TYPE_ID" placeholder="263" /></div>
```

Add a compact `顺丰同城询价` subsection containing the API URL and six intra-city keys. In `onMounted()`, set defaults for the new fields exactly as in `python/config_manager.py`. Use `type="password"` for `AccessCode` and `Checkword`.

- [ ] **Step 3: Add main/preload IPC methods**

Import the new DB functions in `ipcHandlers.js`, then register:

```js
ipcMain.handle('sfShipments:list', async (_event, filters = {}) => listSfShipments(filters))
ipcMain.handle('sfShipments:detail', async (_event, { shipmentId }) => getSfShipmentDetail(shipmentId))
ipcMain.handle('sfShipments:saveDraft', async (_event, payload = {}) => saveSfShipmentDraft(payload))
ipcMain.handle('sfShipments:precheck', async (_event, payload = {}) => precheckSfShipment(payload))
ipcMain.handle('sfShipments:submit', async (_event, payload = {}) => submitSfShipment(payload))
ipcMain.handle('sfShipments:recoverResult', async (_event, payload = {}) => recoverSfShipmentResult(payload))
ipcMain.handle('sfShipments:promiseTime', async (_event, payload = {}) => querySfShipmentPromiseTime(payload))
ipcMain.handle('sfShipments:intraCityQuote', async (_event, payload = {}) => quoteSfIntraCity(payload))
```

Expose matching preload methods:

```js
listSfShipments: (filters) => ipcRenderer.invoke('sfShipments:list', filters || {}),
getSfShipmentDetail: (data) => ipcRenderer.invoke('sfShipments:detail', data),
saveSfShipmentDraft: (data) => ipcRenderer.invoke('sfShipments:saveDraft', data),
precheckSfShipment: (data) => ipcRenderer.invoke('sfShipments:precheck', data),
submitSfShipment: (data) => ipcRenderer.invoke('sfShipments:submit', data),
recoverSfShipmentResult: (data) => ipcRenderer.invoke('sfShipments:recoverResult', data),
querySfShipmentPromiseTime: (data) => ipcRenderer.invoke('sfShipments:promiseTime', data),
quoteSfIntraCity: (data) => ipcRenderer.invoke('sfShipments:intraCityQuote', data),
```

- [ ] **Step 4: Verify main/preload syntax and renderer compilation**

Run:

```bash
node --check electron/main/ipcHandlers.js
node --check electron/preload/preload.js
cd electron && npm run build:renderer
```

Expected: syntax checks pass and Vite renderer build succeeds.

- [ ] **Step 5: Commit the API contract and settings**

```bash
git add python/config_manager.py electron/renderer/src/views/Settings.vue electron/main/ipcHandlers.js electron/preload/preload.js
git commit -m "feat: expose sf shipping settings and actions"
```

### Task 5: Desktop SF Shipping Workbench

**Files:**
- Create: `electron/renderer/src/views/rental/SfShippingWorkbench.vue`
- Modify: `electron/renderer/src/router/index.js`
- Modify: `electron/renderer/src/components/AppSidebar.vue`

- [ ] **Step 1: Register the new operational page**

Add route import and route:

```js
import SfShippingWorkbench from '../views/rental/SfShippingWorkbench.vue'
// ...
{ path: '/sf-shipping', component: SfShippingWorkbench },
```

Add sidebar item in `经营管理` and import `Truck` from `@lucide/vue`:

```js
{ to: '/sf-shipping', label: '顺丰寄件', icon: Truck },
```

- [ ] **Step 2: Implement the task-first page structure**

Create a Vue SFC using existing `PageHeader`, button, panel, status chip, and table patterns. It must keep these state contracts:

```js
const activeTab = ref('create')
const form = reactive({
  sourceType: 'standalone',
  rentalOrderId: '',
  productType: 'sf_standard',
  receiverName: '',
  receiverMobile: '',
  receiverProvince: '',
  receiverCity: '',
  receiverDistrict: '',
  receiverAddress: '',
  cargoName: '租赁设备',
  weightKg: 1,
  sendStartTime: '',
})
const shipment = ref(null)
const shipments = ref([])
const detail = ref(null)
const message = ref('')
const error = ref('')
const loading = ref(false)
```

Build three tab sections:

- `create`: source segmented control, optional existing-order selector, product dropdown, pasted recipient textarea and structured fields, red error block, precheck button, confirmation summary, submit button, intra-city quote result.
- `records`: compact filter row, table with shipment/source/product/waybill/status/ETA/time, detail drawer/modal with event timeline and action buttons.
- `query`: shipment selector or waybill field and expected-delivery refresh result.

For status presentation, map `draft`, `prechecked`, `result_pending`, `manual_review`, `waybill_created`, `rejected` to label plus text/icon; no status may rely only on color.

- [ ] **Step 3: Wire actions and enforce visible confirmation**

Implement actions with these conditions:

```js
async function precheck() {
  error.value = ''
  const draft = await window.electronAPI.saveSfShipmentDraft({ id: shipment.value?.id, ...form })
  const result = await window.electronAPI.precheckSfShipment({ shipmentId: draft.id })
  shipment.value = result.shipment
}

async function submitShipment() {
  if (!shipment.value || shipment.value.preorder_status !== 'prechecked') return
  if (!window.confirm('确认使用顺丰月结创建真实运单？提交后可能产生实际取件任务。')) return
  const result = await window.electronAPI.submitSfShipment({ shipmentId: shipment.value.id })
  shipment.value = result.shipment
  if (result.action === 'recover_result') error.value = '正式下单结果未确认，请点击补查结果，勿重复下单。'
}
```

If any editable field changes after successful precheck, clear the current prechecked result and require a new precheck. For `sf_intra_city_quote`, replace precheck/submit with one `查询费用与时效` action.

- [ ] **Step 4: Verify the renderer build and visual layout**

Run:

```bash
cd electron && npm run build:renderer
```

Expected: build succeeds.

Then open the page in the running Electron/Vite renderer and check:

- At desktop width, new shipment form and confirmation summary do not overlap.
- At narrow desktop width, form fields wrap vertically and action buttons remain readable.
- No submit button appears for同城询价.
- `确认下单` is disabled before successful precheck.

- [ ] **Step 5: Commit workbench UI**

```bash
git add electron/renderer/src/views/rental/SfShippingWorkbench.vue electron/renderer/src/router/index.js electron/renderer/src/components/AppSidebar.vue
git commit -m "feat: add sf shipping workbench page"
```

### Task 6: Integration Validation And Operational Records

**Files:**
- Modify: `docs/rental-ops/test-checklist.md`
- Modify: `progress.md`

- [ ] **Step 1: Run automated regression checks**

Run with the project-supported/bundled Node if system Node cannot load Rollup native dependencies:

```bash
node --test electron/tests/*.mjs
node --check electron/main/sfShippingService.js
node --check electron/main/dbManager.js
node --check electron/main/ipcHandlers.js
node --check electron/preload/preload.js
cd electron && npm run build:renderer
```

Expected: all Node tests pass, all syntax checks return `0`, and the renderer build succeeds.

- [ ] **Step 2: Run non-destructive desktop smoke checks**

Using the desktop app:

1. Open `顺丰寄件`.
2. Create an independent `顺丰标快` draft with complete test address and confirm precheck returns a displayed result.
3. Create an order-linked `顺丰半日达` draft and confirm the receiver fields are populated from the selected rental order.
4. Verify changing a field after precheck forces recheck.
5. Select `顺丰同城询价`; confirm it displays missing-configuration guidance if intra-city credentials are absent and has no submit-order action.

Expected: no real `EXP_RECE_CREATE_ORDER` request is submitted during this smoke check.

- [ ] **Step 3: Record real-order test as explicitly gated**

Add checklist entries stating:

```markdown
- [ ] 人工确认后仅创建一笔真实顺丰测试运单，核对月结、运单号、筛单结果和取件任务。
- [ ] 对同一寄件单模拟“结果待确认”后只执行结果补查，确认不会重复下单。
```

Document actual automated/non-destructive results in `progress.md`, without storing credentials, complete phone numbers, monthly card values, or access tokens.

- [ ] **Step 4: Commit validation records**

```bash
git add docs/rental-ops/test-checklist.md progress.md
git commit -m "docs: record sf shipping workbench verification"
```
