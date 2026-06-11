# Inquiry Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configurable inquiry-analysis recommendation system that turns existing inquiry, order, pricing, and cost data into explainable pricing and inventory suggestions.

**Architecture:** Keep business logic in `electron/main/` and expose it through existing Electron IPC patterns. Add a small recommendation engine module plus DB/config helpers, then extend `Settings.vue` for configurable parameters and `InquiryAnalytics.vue` for recommendation display and cost-entry workflows.

**Tech Stack:** Electron main process, Vue 3 renderer, existing MySQL-backed `dbManager.js`, preload IPC bridge, Node `node:test`.

---

### Task 1: Extend persistence for optimization config and cost inputs

**Files:**
- Create: `electron/tests/inquiryOptimizationConfig.test.mjs`
- Modify: `electron/main/dbManager.js`
- Modify: `electron/main/ipcHandlers.js`
- Modify: `electron/preload/preload.js`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  getDefaultInquiryOptimizationConfig,
  normalizeInquiryOptimizationConfig,
  buildDepositFreeCharge,
} = require('../main/inquiryOptimizationConfig.js')

test('normalizes inquiry optimization config with configurable defaults', () => {
  const cfg = normalizeInquiryOptimizationConfig({
    ANALYSIS_WINDOW_DAYS: '14',
    TARGET_MONTHLY_ROI_MIN: '0.10',
    TARGET_MONTHLY_ROI_MAX: '0.15',
    PLATFORM_FEE_RATE: '0.016',
    DEPOSIT_FREE_PER_100_FEE: '1.5',
    DEPOSIT_FREE_ORDER_COST: '3.5',
    SHIPPING_ALLOCATION_MODE: 'order_count',
  })

  assert.equal(cfg.analysisWindowDays, 14)
  assert.equal(cfg.targetMonthlyRoiMin, 0.1)
  assert.equal(cfg.targetMonthlyRoiMax, 0.15)
  assert.equal(cfg.platformFeeRate, 0.016)
  assert.equal(cfg.depositFreePer100Fee, 1.5)
  assert.equal(cfg.depositFreeOrderCost, 3.5)
  assert.equal(cfg.shippingAllocationMode, 'order_count')
})

test('calculates deposit-free completion charge per 100 yuan instead of percent', () => {
  assert.equal(buildDepositFreeCharge({ fee: 260, per100Fee: 1.5, orderCost: 3.5 }), 7.4)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd electron && node --test tests/inquiryOptimizationConfig.test.mjs`
Expected: FAIL with `Cannot find module '../main/inquiryOptimizationConfig.js'`

- [ ] **Step 3: Implement minimal persistence support**

```js
// electron/main/inquiryOptimizationConfig.js
const DEFAULTS = {
  analysisWindowDays: 14,
  targetMonthlyRoiMin: 0.10,
  targetMonthlyRoiMax: 0.15,
  priceStep: 5,
  maxPriceAdjustment: 10,
  minInquirySamples: 5,
  minOrderSamples: 2,
  platformFeeRate: 0.016,
  depositFreePer100Fee: 1.5,
  depositFreeOrderCost: 3.5,
  shippingAllocationMode: 'order_count',
  shippingBillReminderDay: 1,
}

function buildDepositFreeCharge({ fee, per100Fee, orderCost }) {
  const blocks = Math.max(0, Number(fee || 0)) / 100
  return Number((blocks * Number(per100Fee || 0) + Number(orderCost || 0)).toFixed(2))
}

module.exports = {
  DEFAULTS,
  getDefaultInquiryOptimizationConfig: () => ({ ...DEFAULTS }),
  normalizeInquiryOptimizationConfig,
  buildDepositFreeCharge,
}
```

```js
// electron/main/dbManager.js
async function getInquiryOptimizationConfig() { /* read config keys, merge defaults */ }
async function saveInquiryOptimizationConfig(payload = {}) { /* persist config keys */ }
async function uploadMonthlyShippingBill(payload = {}) { /* write expense_records row(s) for shipping_monthly */ }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd electron && node --test tests/inquiryOptimizationConfig.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/tests/inquiryOptimizationConfig.test.mjs electron/main/inquiryOptimizationConfig.js electron/main/dbManager.js electron/main/ipcHandlers.js electron/preload/preload.js
git commit -m "feat: add inquiry optimization config persistence"
```

### Task 2: Add recommendation engine and ROI/cost calculation

**Files:**
- Create: `electron/main/inquiryOptimizationEngine.js`
- Create: `electron/tests/inquiryOptimizationEngine.test.mjs`
- Modify: `electron/main/dbManager.js`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  summarizeInquiryOptimization,
} = require('../main/inquiryOptimizationEngine.js')

test('recommends restock for hot model with high unavailable rate and healthy roi', () => {
  const result = summarizeInquiryOptimization({
    config: { analysisWindowDays: 14, targetMonthlyRoiMin: 0.1, targetMonthlyRoiMax: 0.15, minInquirySamples: 5, minOrderSamples: 2 },
    models: [{
      modelCode: 'POCKET3',
      inquiries: 20,
      available: 6,
      unavailable: 14,
      converted: 5,
      availableNotConverted: 1,
      inventoryUnits: 3,
      activeAssetCost: 6000,
      netProfit: 420,
      quotedAvg: 180,
      finalAvg: 176,
      missingCostData: false,
    }],
  })

  assert.equal(result.rows[0].action, 'restock')
  assert.match(result.rows[0].reasonSummary, /无档率/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd electron && node --test tests/inquiryOptimizationEngine.test.mjs`
Expected: FAIL with `Cannot find module '../main/inquiryOptimizationEngine.js'`

- [ ] **Step 3: Implement minimal recommendation engine**

```js
// electron/main/inquiryOptimizationEngine.js
function summarizeInquiryOptimization({ config, models }) {
  return {
    rows: models.map((row) => {
      const monthlyRoi = row.activeAssetCost > 0
        ? Number((((row.netProfit / config.analysisWindowDays) * 30) / row.activeAssetCost).toFixed(4))
        : 0
      const unavailableRate = row.inquiries > 0 ? row.unavailable / row.inquiries : 0
      const conversionRate = row.inquiries > 0 ? row.converted / row.inquiries : 0
      const availableLoseRate = row.available > 0 ? row.availableNotConverted / row.available : 0

      let action = 'observe'
      if (row.inquiries >= config.minInquirySamples && unavailableRate >= 0.4 && monthlyRoi >= config.targetMonthlyRoiMin) action = 'restock'
      else if (row.inquiries >= config.minInquirySamples && availableLoseRate >= 0.5) action = 'decrease_price'
      else if (row.inquiries >= config.minInquirySamples && unavailableRate >= 0.2 && conversionRate >= 0.2) action = 'increase_price'
      else if (row.inquiries < config.minInquirySamples || row.missingCostData) action = 'observe'

      return { ...row, monthlyRoi, unavailableRate, conversionRate, action, reasonSummary: `无档率 ${(unavailableRate * 100).toFixed(1)}%` }
    }),
  }
}

module.exports = { summarizeInquiryOptimization }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd electron && node --test tests/inquiryOptimizationEngine.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/main/inquiryOptimizationEngine.js electron/tests/inquiryOptimizationEngine.test.mjs electron/main/dbManager.js
git commit -m "feat: add inquiry optimization recommendation engine"
```

### Task 3: Aggregate DB data for recommendations and monthly shipping allocation

**Files:**
- Modify: `electron/main/dbManager.js`
- Create: `electron/tests/inquiryOptimizationAggregation.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  allocateMonthlyShippingExpenseByOrderCount,
} = require('../main/inquiryOptimizationEngine.js')

test('allocates monthly shipping bill evenly by order count', () => {
  const rows = allocateMonthlyShippingExpenseByOrderCount({
    total: 300,
    orders: [{ id: 1 }, { id: 2 }, { id: 3 }],
  })

  assert.deepEqual(rows.map((item) => item.amount), [100, 100, 100])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd electron && node --test tests/inquiryOptimizationAggregation.test.mjs`
Expected: FAIL because `allocateMonthlyShippingExpenseByOrderCount` is undefined

- [ ] **Step 3: Implement DB aggregation path**

```js
// electron/main/dbManager.js
async function getRentalOptimizationSuggestions(filters = {}) {
  const config = await getInquiryOptimizationConfig()
  const inquiryRows = await listInquiryEvents({ ...filters, from: /* derived */, to: /* derived */, limit: 1000 })
  const orderRows = await listOrders({ ...filters, from: /* derived */, to: /* derived */ })
  const unitRows = await listScheduleUnits({ activeInventoryOnly: true })
  const expenseRows = await listExpenseRecords({ startDate: /* derived */, endDate: /* derived */ })

  // group by model_code, calculate platform fee, deposit-free completion fee, repairs, shipping share
  // pass normalized rows into summarizeInquiryOptimization()
}
```

```js
// electron/main/inquiryOptimizationEngine.js
function allocateMonthlyShippingExpenseByOrderCount({ total, orders }) {
  const count = orders.length || 1
  const base = Number((Number(total || 0) / count).toFixed(2))
  return orders.map((order, index) => ({
    orderId: order.id,
    amount: index === orders.length - 1
      ? Number((Number(total || 0) - base * index).toFixed(2))
      : base,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd electron && node --test tests/inquiryOptimizationAggregation.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/main/dbManager.js electron/main/inquiryOptimizationEngine.js electron/tests/inquiryOptimizationAggregation.test.mjs
git commit -m "feat: aggregate inquiry optimization data with shipping allocation"
```

### Task 4: Expose IPC and renderer APIs for optimization and expense entry

**Files:**
- Modify: `electron/main/ipcHandlers.js`
- Modify: `electron/preload/preload.js`

- [ ] **Step 1: Write the failing integration surface check**

```js
// Add to existing preload/API smoke test or create a tiny node:test that asserts function names
assert.equal(typeof electronAPI.getRentalOptimizationSuggestions, 'function')
assert.equal(typeof electronAPI.getRentalOptimizationConfig, 'function')
assert.equal(typeof electronAPI.saveRentalOptimizationConfig, 'function')
assert.equal(typeof electronAPI.saveExpenseRecord, 'function')
assert.equal(typeof electronAPI.uploadMonthlyShippingBill, 'function')
```

- [ ] **Step 2: Run the relevant test to verify it fails**

Run: `cd electron && node --test tests/inquiryOptimizationConfig.test.mjs tests/inquiryOptimizationEngine.test.mjs`
Expected: FAIL or missing API export until handlers are wired

- [ ] **Step 3: Implement IPC wiring**

```js
// electron/main/ipcHandlers.js
ipcMain.handle('inquiryOptimization:suggestions', async (_event, filters = {}) => {
  return await getRentalOptimizationSuggestions(filters)
})
ipcMain.handle('inquiryOptimization:getConfig', async () => {
  return await getInquiryOptimizationConfig()
})
ipcMain.handle('inquiryOptimization:saveConfig', async (_event, payload = {}) => {
  return await saveInquiryOptimizationConfig(payload)
})
ipcMain.handle('expenseRecords:save', async (_event, payload = {}) => {
  return await addExpenseRecord(payload)
})
ipcMain.handle('expenseRecords:uploadMonthlyShippingBill', async (_event, payload = {}) => {
  return await uploadMonthlyShippingBill(payload)
})
```

```js
// electron/preload/preload.js
getRentalOptimizationSuggestions: (filters) => ipcRenderer.invoke('inquiryOptimization:suggestions', filters || {}),
getRentalOptimizationConfig: () => ipcRenderer.invoke('inquiryOptimization:getConfig'),
saveRentalOptimizationConfig: (payload) => ipcRenderer.invoke('inquiryOptimization:saveConfig', payload || {}),
saveExpenseRecord: (payload) => ipcRenderer.invoke('expenseRecords:save', payload || {}),
uploadMonthlyShippingBill: (payload) => ipcRenderer.invoke('expenseRecords:uploadMonthlyShippingBill', payload || {}),
```

- [ ] **Step 4: Run the relevant test to verify it passes**

Run: `cd electron && node --test tests/inquiryOptimizationConfig.test.mjs tests/inquiryOptimizationEngine.test.mjs tests/inquiryOptimizationAggregation.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/main/ipcHandlers.js electron/preload/preload.js
git commit -m "feat: expose inquiry optimization IPC APIs"
```

### Task 5: Add settings UI for optimization parameters and expense workflows

**Files:**
- Modify: `electron/renderer/src/views/Settings.vue`

- [ ] **Step 1: Add a failing renderer expectation**

```js
// Prefer a lightweight smoke check if renderer tests exist; otherwise document manual failure first:
// expected missing UI before implementation:
// - no fields for targetMonthlyRoiMin / targetMonthlyRoiMax
// - no fields for deposit-free per-100 fee / single-order cost
// - no monthly shipping bill upload area
```

- [ ] **Step 2: Verify the gap manually**

Run: `cd electron && npm run dev`
Expected: `系统设置` page has no optimization or cost controls yet

- [ ] **Step 3: Implement settings module additions**

```vue
<!-- Settings.vue -->
<section v-show="activeModule === 'ops-config'" id="ops-config" class="settings-section settings-card">
  <div class="panel-header section-head">
    <div>
      <div class="section-kicker">经营建议</div>
      <h2 class="section-title">询单分析与成本配置</h2>
      <div class="panel-tip">维护建议引擎阈值、费用规则和月付账单录入。</div>
    </div>
  </div>
  <!-- fields: analysis window, ROI min/max, price step, max adjustment, sample floors -->
  <!-- fields: platform fee, deposit-free per-100 fee, deposit-free order cost -->
  <!-- mini form: add expense record -->
  <!-- mini form: upload monthly shipping bill -->
</section>
```

- [ ] **Step 4: Verify the UI locally**

Run: `cd electron && npm run build:renderer`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/renderer/src/views/Settings.vue
git commit -m "feat: add inquiry optimization settings controls"
```

### Task 6: Redesign inquiry analytics page to show recommendation output

**Files:**
- Modify: `electron/renderer/src/views/rental/InquiryAnalytics.vue`

- [ ] **Step 1: Capture the failing behavior**

```js
// expected gap before implementation:
// - page only shows KPIs, model ranking, and inquiry events
// - no recommendation table
// - no config shortcut or expense entry shortcut
```

- [ ] **Step 2: Verify the current page manually**

Run: `cd electron && npm run dev`
Expected: `/inquiries` has no recommendation section

- [ ] **Step 3: Implement renderer changes**

```vue
<!-- InquiryAnalytics.vue -->
<section class="panel">
  <div class="section-head">
    <div>
      <h3>经营建议</h3>
      <p>根据近窗询单、转化、库存、净利率生成可解释建议。</p>
    </div>
    <button class="btn btn-secondary" @click="openSettingsToOpsConfig">成本与目标配置</button>
  </div>
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>型号</th>
          <th>建议动作</th>
          <th class="num">建议调价</th>
          <th class="num">月化净利率</th>
          <th>核心原因</th>
          <th>风险提示</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in suggestions.rows" :key="row.modelCode">...</tr>
      </tbody>
    </table>
  </div>
</section>
```

```js
// InquiryAnalytics.vue script setup
const suggestions = ref({ rows: [], summary: null, config: null })
async function loadAll() {
  const [nextStats, nextEvents, nextSuggestions] = await Promise.all([
    window.electronAPI.getInquiryStats(buildFilterPayload(1000)),
    window.electronAPI.listInquiryEvents(buildFilterPayload(100)),
    window.electronAPI.getRentalOptimizationSuggestions(buildFilterPayload(1000)),
  ])
}
```

- [ ] **Step 4: Verify the UI locally**

Run: `cd electron && npm run build:renderer`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add electron/renderer/src/views/rental/InquiryAnalytics.vue
git commit -m "feat: show inquiry optimization recommendations"
```

### Task 7: Full verification and regression pass

**Files:**
- Test: `electron/tests/inquiryOptimizationConfig.test.mjs`
- Test: `electron/tests/inquiryOptimizationEngine.test.mjs`
- Test: `electron/tests/inquiryOptimizationAggregation.test.mjs`
- Test: `electron/tests/rentalInquiryMetrics.test.mjs`
- Test: `electron/tests/rentalOpsRules.test.mjs`

- [ ] **Step 1: Run targeted node tests**

Run: `cd electron && node --test tests/inquiryOptimizationConfig.test.mjs tests/inquiryOptimizationEngine.test.mjs tests/inquiryOptimizationAggregation.test.mjs tests/rentalInquiryMetrics.test.mjs tests/rentalOpsRules.test.mjs`
Expected: PASS

- [ ] **Step 2: Run renderer build**

Run: `cd electron && npm run build:renderer`
Expected: PASS

- [ ] **Step 3: Manual verification in app**

Run: `cd electron && npm run dev`
Expected:
- `/settings` shows inquiry optimization config section and saves values.
- `/inquiries` shows recommendation table with reasons and ROI.
- Existing inquiry KPIs, model ranking, event list still load.
- Order fulfillment, schedule availability, and SF shipping entry points still open without console errors.

- [ ] **Step 4: Final commit**

```bash
git add electron/main electron/preload electron/renderer/src electron/tests
git commit -m "feat: add configurable inquiry optimization recommendations"
```
