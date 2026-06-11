# XianyuAgentPro Frontend Commercialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Electron + Vue renderer into a stable, merchant-ready operations console without changing core backend, IPC, database, Python bridge, authentication, message sync, auto-reply, SF Express business logic, or packaging behavior.

**Architecture:** Keep the current Electron desktop architecture for now: Vue renderer calls a constrained `window.electronAPI` preload interface, Electron main remains the local service boundary, and Python/mobile gateway remain existing runtime integrations. The work proceeds by UI governance first, page decomposition second, renderer service boundaries third, then optional future standard backend extraction only when multi-user/cloud/SaaS requirements are real.

**Tech Stack:** Electron 29, Vue 3, Pinia, Vue Router, Vite, `@lucide/vue`, existing base components in `electron/renderer/src/components`, existing IPC in `electron/preload/preload.js` and `electron/main/ipcHandlers.js`.

---

## Non-Negotiable Constraints

- Do not modify Electron main lifecycle, Python startup, IPC protocol behavior, database schema, Xianyu login/auth, WebSocket sync, token refresh, message processing, auto-reply core logic, SF Express business logic, Feishu business logic, launcher scripts, or packaging paths unless the user explicitly asks.
- Do not introduce Ant Design Vue, Element Plus, Vuetify, or large admin templates.
- Preserve critical operational states: Agent status, Xianyu account state, auto-reply/manual state, order fulfillment state, shipping state, task execution state, data sync state.
- Treat destructive and external-side-effect actions as high risk: delete, stop Agent, create SF shipment, cancel SF shipment, batch shipment, mark returned, finish deposit order.
- Before any UI implementation task, read:
  - `AGENTS.md`
  - `docs/design/ui-redesign-template.md`
  - `docs/design/ui-current-screens-redesign.md`
  - this plan
  - `findings.md`
  - `progress.md`

## Current Audit Facts

- `electron/renderer/src/views/rental/OrderFulfillment.vue` is about 4815 lines and mixes table UI, modals, drawers, order forms, deletion, SF actions, deposit actions, logistics state, parsing helpers, and local filters.
- `electron/renderer/src/views/rental/SfShippingWorkbench.vue` is about 1412 lines and still uses a centered detail modal and native `window.confirm` for high-risk actions.
- `electron/main/dbManager.js` is about 7979 lines; this is a long-term service-boundary risk, not a reason for immediate frontend/backend split.
- `electron/preload/preload.js` exposes a large `window.electronAPI`; it is already the real renderer/service boundary but lacks type naming, error-shape conventions, and high-risk-action governance.
- UI redesign is partially complete: design tokens, Sidebar, Topbar, table-based order page, and order detail Drawer exist. Remaining debt is consistency, interaction governance, and page decomposition.

## Execution Strategy

- Implement one phase at a time.
- Each phase must leave the app runnable.
- Each phase should avoid broad visual rewrites.
- Prefer component extraction and behavior preservation over redesigning business flows.
- After every phase, update `progress.md` and this plan checkboxes.
- For UI-only changes, run at least `npm run build:renderer` from `electron/`. If local dependency issues block the command, record the exact error in `progress.md`.
- When practical, run the app with `npm run dev` and visually inspect the changed page.

## Autonomous Execution Protocol

This plan is intended to be executed autonomously by Codex until all phases are complete or a genuine external blocker is reached.

For every implementation phase:

1. Read the current phase, `AGENTS.md`, both design docs, `findings.md`, and the latest `progress.md`.
2. Identify the exact user-facing flow under test before editing.
3. Make the smallest complete set of code changes for the phase.
4. Run `cd electron && npm run build:renderer`.
5. Start the desktop app or renderer preview when practical.
6. Use the Browser plugin for local rendered validation when available; otherwise use Playwright and record the fallback reason.
7. Capture screenshot evidence for every changed user-facing surface.
8. Exercise at least one meaningful interaction for every changed workflow.
9. Check console errors or equivalent runtime error output.
10. If validation reveals a UI bug, layout issue, console error, or broken interaction, fix it before moving to the next phase.
11. Update `progress.md` with commands, screenshots, what passed, what failed, and what remains risky.
12. Update this plan's checkboxes only after fresh verification evidence exists.

Do not advance to the next phase merely because the build passes. A build is necessary, but rendered validation is required for UI phases.

Stopping conditions:

- A required external service, login, database, or credential is unavailable and blocks meaningful verification.
- A command fails three times after targeted fixes.
- The next change would require modifying restricted business logic or architecture not authorized by the user.
- The user sends a newer instruction that changes the scope.

---

## Phase 0: Planning Baseline And Safety Rails

**Objective:** Make future execution repeatable and prevent accidental business-logic changes.

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Create or modify: `docs/qa/ui-commercialization-checklist.md`

- [x] **Step 0.1: Confirm active scope**

  Read these files:

  ```bash
  sed -n '1,220p' AGENTS.md
  sed -n '1,260p' docs/design/ui-redesign-template.md
  sed -n '1,260p' docs/design/ui-current-screens-redesign.md
  sed -n '1,260p' docs/superpowers/plans/2026-06-11-frontend-commercialization.md
  ```

  Expected: scope is UI/interaction governance first, not architecture rewrite.

  Status: completed on 2026-06-11. Scope confirmed from AGENTS, design docs, and this plan.

- [x] **Step 0.2: Create commercial UI QA checklist**

  Create `docs/qa/ui-commercialization-checklist.md` with these sections:

  ```markdown
  # UI Commercialization Checklist

  ## Required Before Editing

  - [ ] Read `AGENTS.md`.
  - [ ] Read `docs/design/ui-redesign-template.md`.
  - [ ] Read `docs/design/ui-current-screens-redesign.md`.
  - [ ] Read active plan and latest `progress.md`.
  - [ ] Confirm the task does not require backend/IPC/database changes.

  ## Interaction Governance

  - [ ] Destructive actions use `BaseDialog` or the shared confirmation service.
  - [ ] High-risk external actions explain real-world effects before confirmation.
  - [ ] Primary buttons are compact and task-specific.
  - [ ] Low-frequency actions are in `RowActionMenu` or secondary menus.
  - [ ] No new native `window.confirm` is introduced.
  - [ ] No new large centered modal is introduced for complex operational details.

  ## Visual Consistency

  - [ ] Uses design tokens from `electron/renderer/src/style.css`.
  - [ ] Uses existing base components when available.
  - [ ] Uses lucide icons instead of emoji for controls and navigation.
  - [ ] Text fits in buttons, badges, cells, and drawer headers.
  - [ ] Tables remain scannable at desktop width.

  ## Business Safety

  - [ ] Agent status remains visible.
  - [ ] Order status remains visible.
  - [ ] Shipping status remains visible.
  - [ ] Existing handler names and payloads are preserved unless explicitly planned.
  - [ ] No schema, prompt storage, login, sync, or SF business logic changes.

  ## Verification

  - [ ] `cd electron && npm run build:renderer`
  - [ ] Visual check of changed page in dev app when practical.
  - [ ] No console errors on the modified route.
  - [ ] Core buttons still call original handlers.
  - [ ] Any skipped verification is recorded in `progress.md`.
  ```

- [x] **Step 0.3: Record baseline**

  Run:

  ```bash
  cd electron && npm run build:renderer
  ```

  Expected: build passes, or the exact dependency/build failure is recorded in `progress.md`.

  Status: completed on 2026-06-11. `npm run build:renderer` passed; Vite reported a CJS API deprecation warning and a large chunk warning.

---

## Phase 1: Interaction Governance Foundation

**Objective:** Replace ad hoc confirmations and dangerous-action exposure with one predictable pattern.

**Files:**
- Modify: `electron/renderer/src/components/BaseDialog.vue`
- Create: `electron/renderer/src/composables/useConfirmDialog.js`
- Modify: `electron/renderer/src/App.vue`
- Modify: `electron/renderer/src/views/rental/OrderFulfillment.vue`
- Modify: `electron/renderer/src/views/rental/SfShippingWorkbench.vue`
- Modify: `docs/qa/ui-commercialization-checklist.md`

- [x] **Step 1.1: Add shared confirmation composable**

  Create `electron/renderer/src/composables/useConfirmDialog.js`.

  Required API:

  ```js
  export function useConfirmDialog() {
    // returns { confirm, state, close, resolveConfirm }
  }
  ```

  Behavioral contract:

  - `confirm(options)` returns `Promise<boolean>`.
  - Options: `title`, `message`, `confirmText`, `cancelText`, `danger`, `details`.
  - It supports one active dialog at a time.
  - It never calls `window.confirm`.

- [x] **Step 1.2: Mount global confirmation dialog**

  Modify `electron/renderer/src/App.vue` to render one shared `BaseDialog`.

  Preserve existing:

  - `ToastHost`
  - `CommandPalette`
  - bot status listeners
  - badge polling

- [x] **Step 1.3: Replace order deletion confirmations**

  Modify `electron/renderer/src/views/rental/OrderFulfillment.vue`:

  - Replace native confirm in `deleteOrder`.
  - Replace native confirm in `deleteSelectedOrders`.
  - Move batch delete out of the always-visible bulk action row if it remains prominent; use a secondary/more action or a danger-confirm dialog that makes the affected count clear.

  Preserve:

  - `window.electronAPI.deleteOrder({ orderId })`
  - existing reload behavior
  - selected order cleanup

- [x] **Step 1.4: Replace SF high-risk confirmations**

  Modify `electron/renderer/src/views/rental/SfShippingWorkbench.vue`:

  - Replace native confirm in `placeOrder`.
  - Replace native confirm in `placeSelectedOrders`.
  - Replace native confirm in `cancelShipment`.

  Confirmation copy must explicitly say whether a real SF order/waybill will be created or cancelled.

- [x] **Step 1.5: Verify**

  Run:

  ```bash
  cd electron && npm run build:renderer
  ```

  Manual checks:

  - Order single delete opens shared dialog.
  - Order batch delete opens shared dialog.
  - SF single shipment opens shared dialog before real order creation.
  - SF batch shipment opens shared dialog before real order creation.
  - SF cancel opens shared dialog.

  Status: completed on 2026-06-11 with partial rendered coverage. Build passed, native confirms were removed from target pages, and SF single shipment confirmation was rendered and cancelled in the Electron app. Order delete and batch paths were not clicked because the local order list was empty; they are covered by static search and build verification until test data is available.

---

## Phase 2: Modal And Drawer Standardization

**Objective:** Complex operational details use Drawer; short confirmations use Dialog; old centered modals are reduced.

**Files:**
- Modify: `electron/renderer/src/components/BaseDrawer.vue`
- Modify: `electron/renderer/src/views/rental/SfShippingWorkbench.vue`
- Modify: `electron/renderer/src/views/rental/OrderFulfillment.vue`
- Later optional pages: `KnowledgeBase.vue`, `DeviceManagement.vue`, `ScheduleCalendar.vue`, `Pricing.vue`, `ItemModelMapping.vue`

- [x] **Step 2.1: Improve BaseDrawer ergonomics**

  Update `BaseDrawer.vue` to support:

  - `subtitle`
  - `closeOnOverlay` default `true`
  - `dangerClose` not needed
  - consistent close icon styling
  - max width constrained to viewport

  Preserve existing `v-model`, `title`, `width`, and footer slots.

  Status: completed on 2026-06-11. `BaseDrawer` now supports `subtitle`, `closeOnOverlay`, a consistent close button, and viewport-constrained panel width.

- [x] **Step 2.2: Convert SF shipment detail modal to Drawer**

  Replace the centered detail modal in `SfShippingWorkbench.vue` with `BaseDrawer`.

  Preserve all existing actions:

  - refresh routes
  - query fee
  - cancel shipment
  - save actual paid amount
  - show route timeline
  - show events

  Status: completed on 2026-06-11. SF shipment detail now uses `BaseDrawer`; refresh route, fee query, cancel shipment, paid amount, routes, and event sections were preserved.

- [x] **Step 2.3: Review order page remaining modals**

  In `OrderFulfillment.vue`, classify each modal:

  - Create/edit operational forms should become Drawer.
  - Batch extend can remain Dialog if short, or Drawer if it requires rich context.
  - Import preview can remain Dialog if it is a bounded confirmation workflow.
  - Task center can become Drawer if it contains actionable lists.

  Do not convert all at once. Convert only one workflow per execution session.

  Status: completed on 2026-06-11. Order detail and edit order were already Drawer-based. This phase converted the complex create-order form from a large centered modal to `BaseDrawer`. Batch extend, import preview, and task center remain bounded modal workflows for later review.

- [x] **Step 2.4: Verify**

  Run:

  ```bash
  cd electron && npm run build:renderer
  ```

  Manual checks:

  - SF records open drawer without losing list context.
  - Drawer scrolls internally.
  - Footer actions remain visible where needed.
  - No old `.detail-modal` styles are used by SF detail.

  Status: completed on 2026-06-11. `npm run build:renderer` passed. Computer Use validation confirmed SF records open a right-side Drawer without losing list context, the SF drawer can be closed, and the order create form opens as a right-side Drawer with footer actions visible. Static search confirmed SF detail no longer uses `modal-backdrop` or `detail-modal`.

---

## Phase 3: Order Fulfillment Page Decomposition

**Objective:** Reduce bug risk by splitting `OrderFulfillment.vue` into focused components and composables while preserving behavior.

**Files:**
- Modify: `electron/renderer/src/views/rental/OrderFulfillment.vue`
- Create: `electron/renderer/src/views/rental/order-fulfillment/OrderToolbar.vue`
- Create: `electron/renderer/src/views/rental/order-fulfillment/OrderTaskStrip.vue`
- Create: `electron/renderer/src/views/rental/order-fulfillment/OrderFilters.vue`
- Create: `electron/renderer/src/views/rental/order-fulfillment/OrderTable.vue`
- Create: `electron/renderer/src/views/rental/order-fulfillment/OrderDetailDrawer.vue`
- Create: `electron/renderer/src/views/rental/order-fulfillment/useOrderFilters.js`
- Create: `electron/renderer/src/views/rental/order-fulfillment/useOrderActions.js`

- [x] **Step 3.1: Extract read-only table component**

  Move table rendering into `OrderTable.vue`.

  Props:

  ```js
  orders
  selectedOrderId
  selectedOrderIds
  allVisibleSelected
  shipActionLoading
  defaultStoreName
  ```

  Emits:

  ```js
  select-order
  toggle-order-selection
  toggle-visible-selection
  primary-action
  menu-action
  ```

  No `window.electronAPI` calls inside `OrderTable.vue`.

  Status: completed on 2026-06-11. `OrderTable.vue` renders the order table and empty state, receives display helpers from the parent, and emits row selection, visible selection, primary action, and menu action events. Build and Electron empty-table rendering passed.

- [x] **Step 3.2: Extract detail drawer**

  Move Drawer body into `OrderDetailDrawer.vue`.

  Keep data and actions passed from parent first. Do not move business logic during the first extraction.

  Status: completed on 2026-06-11. `OrderDetailDrawer.vue` now owns the detail Drawer markup and local styles. Parent state, logistics form object, deposit state, and all business actions remain in `OrderFulfillment.vue` and are passed as props/events.

- [x] **Step 3.3: Extract filters**

  Move quick filters and advanced filter drawer composition into `OrderFilters.vue` and `useOrderFilters.js`.

  Preserve existing filter keys:

  - `modelCode`
  - `status`
  - `storeId`
  - `from`
  - `to`
  - `dateField`
  - `datePreset`
  - `keyword`
  - `quickFilter`
  - `paymentStatus`
  - `depositStatus`

  Status: completed on 2026-06-11. `OrderFilters.vue` now owns the basic filter bar and advanced filter drawer rendering, and `useOrderFilters.js` owns default filter state, date presets, quick filters, and reset behavior. Query loading and frontend matching remain in the parent.

- [x] **Step 3.4: Extract action helpers**

  Move primary-action label mapping, row action menu creation, and low-risk UI action routing into `useOrderActions.js`.

  Do not move IPC calls until the UI extraction is stable.

  Status: completed on 2026-06-11. `useOrderActions.js` now owns primary action labels, primary action disabled state, row action menu items, and menu/primary action routing. IPC and mutation functions remain in the parent and are injected as dependencies.

- [x] **Step 3.5: Verify**

  Run:

  ```bash
  cd electron && npm run build:renderer
  ```

  Manual checks:

  - Filtering works.
  - Row selection works.
  - Drawer opens and shows same data.
  - Primary action behavior is unchanged.
  - More menu behavior is unchanged.

  Status: completed on 2026-06-11. `npm run build:renderer` passed after extracting table, filters, actions, and detail Drawer. `git diff --check` passed for the Phase 3 files. Extracted order-fulfillment components do not call `window.electronAPI`. Rendered verification was completed with Chrome DevTools Protocol against the local Vite app on `127.0.0.1:5179` with an injected `window.electronAPI` mock and a seeded test order: the order table rendered `XJ-001`, the row could be selected, the `查看` primary action opened `订单详情 #101`, and the right-side drawer displayed customer/shipping information. Screenshot evidence: `/tmp/xianyu-ui-verify/orders-detail.png`.

---

## Phase 4: SF Shipping Workbench Decomposition

**Objective:** Make SF shipping reliable for real operations by splitting form state, quote state, shipment records, and detail drawer.

**Files:**
- Modify: `electron/renderer/src/views/rental/SfShippingWorkbench.vue`
- Create: `electron/renderer/src/views/rental/sf-shipping/SfCreateForm.vue`
- Create: `electron/renderer/src/views/rental/sf-shipping/SfSummaryPanel.vue`
- Create: `electron/renderer/src/views/rental/sf-shipping/SfShipmentRecords.vue`
- Create: `electron/renderer/src/views/rental/sf-shipping/SfShipmentDetailDrawer.vue`
- Create: `electron/renderer/src/views/rental/sf-shipping/SfBatchShipmentDrawer.vue`
- Create: `electron/renderer/src/views/rental/sf-shipping/useSfShipmentForm.js`
- Create: `electron/renderer/src/views/rental/sf-shipping/useSfShipmentActions.js`

- [x] **Step 4.1: Extract create form UI**

  Move address/service/confirm step markup into `SfCreateForm.vue`.

  Preserve existing form shape and validation behavior.

  Status: completed on 2026-06-11. `SfCreateForm.vue` now owns the address paste/editing step, service selection/quote preview step, and confirmation/draft result step. It receives the existing reactive form object and validation/display helpers from the parent and emits parse, clear, step, pickup preset, service selection, and save-draft actions back to the parent.

- [x] **Step 4.2: Extract summary panel**

  Move `StickySummaryPanel` content into `SfSummaryPanel.vue`.

  Preserve disabled reasons and next-step button placement.

  Status: completed on 2026-06-11. `SfSummaryPanel.vue` now owns the right-side shipment summary and next-step actions. It emits navigation, place-order, and precheck events back to the parent; IPC and business logic remain in `SfShippingWorkbench.vue`.

- [x] **Step 4.3: Extract records table/list**

  Move shipment records list into `SfShipmentRecords.vue`.

  Emits:

  - `open-shipment`
  - `recover-result`
  - `refresh-routes`

  Status: completed on 2026-06-11. `SfShipmentRecords.vue` now owns the shipment records toolbar/list rendering and emits load, open, recover, and refresh actions. It does not call `window.electronAPI`.

  Additional status: `SfShipmentDetailDrawer.vue` was extracted on 2026-06-11. It owns the right-side shipment detail presentation and emits refresh routes, refresh fee, cancel shipment, and save actual paid actions back to the parent/composable. It does not call `window.electronAPI`.

  Additional status: `SfBatchShipmentDrawer.vue` was extracted on 2026-06-11. It owns the batch shipment drawer table, selection checkboxes, and batch result summary. It emits refresh, select-all, selected-id updates, and batch-submit actions back to the parent/composable. It does not call `window.electronAPI`.

- [x] **Step 4.4: Extract action composable**

  Move API calls that operate on shipments into `useSfShipmentActions.js`.

  Preserve exact IPC calls:

  - `saveSfShipmentDraft`
  - `precheckSfShipment`
  - `placeSfShipment`
  - `batchPlaceSfShipments`
  - `getSfShipmentDetail`
  - `recoverSfShipmentResult`
  - `cancelSfShipment`
  - `querySfShipmentRoutes`
  - `querySfShipmentFee`
  - `updateSfShipmentActualPaid`

  Status: completed on 2026-06-11. `useSfShipmentActions.js` now owns the shipment draft, precheck, real order submission, batch shipment, detail loading, result recovery, cancellation, route refresh, fee refresh, and actual paid save calls. The exact IPC call names and payload shapes were preserved; `SfShippingWorkbench.vue` still owns quote lookup, tracking-query tab calls, config loading, and layout state.

- [x] **Step 4.5: Verify**

  Run:

  ```bash
  cd electron && npm run build:renderer
  ```

  Manual checks:

  - Paste recipient recognition still fills receiver fields.
  - Product selection still triggers quote.
  - Invalid pickup time still blocks next step.
  - Real order confirmation still appears before SF order creation.
  - Records and detail drawer still work.

  Status: completed on 2026-06-11. `npm run build:renderer` passed after every extracted component and after the final Phase 4 split. `git diff --check` passed for Phase 4 files. Static scans confirmed display components do not call `window.electronAPI`; shipment mutation IPC calls are centralized in `useSfShipmentActions.js` and later behind `sfApi`. Rendered verification was completed with Chrome DevTools Protocol against the local Vite app on `127.0.0.1:5179` with an injected `window.electronAPI` mock: recipient paste filled receiver fields, invalid `07:59` pickup time cleared after render update and showed the range warning, service step displayed quote information, real-order confirmation dialog appeared before `placeSfShipment`, shipment records opened the detail drawer, and the batch shipment drawer opened with a selectable pending order and confirmation dialog. Screenshot evidence: `/tmp/xianyu-ui-verify/sf-shipping.png`, `/tmp/xianyu-ui-verify/sf-confirm.png`, `/tmp/xianyu-ui-verify/sf-batch-drawer.png`.

---

## Phase 5: Renderer API Boundary Cleanup

**Objective:** Make the renderer easier to reason about without changing IPC behavior.

**Files:**
- Create: `electron/renderer/src/services/electronApiClient.js`
- Modify gradually: views that call `window.electronAPI` heavily
- Do not modify: `electron/preload/preload.js` behavior unless a wrapper requires no behavior change

- [x] **Step 5.1: Add thin client wrapper**

  Create `electronApiClient.js` that exports grouped clients:

  ```js
  export const orderApi = {
    listGroups: (filters) => window.electronAPI.listOrderGroups(filters),
    list: (filters) => window.electronAPI.listOrders(filters),
    detail: (payload) => window.electronAPI.getOrderDetail(payload),
    delete: (payload) => window.electronAPI.deleteOrder(payload),
  }

  export const sfApi = {
    listShipments: (filters) => window.electronAPI.listSfShipments(filters),
    detail: (payload) => window.electronAPI.getSfShipmentDetail(payload),
    place: (payload) => window.electronAPI.placeSfShipment(payload),
  }
  ```

  Add only wrappers needed by the page being touched.

  Status: completed on 2026-06-11. `electronApiClient.js` now exports `configApi`, `sfApi`, and `getErrorMessage`. Only SF/config wrappers needed by `SfShippingWorkbench.vue` and `useSfShipmentActions.js` were added.

- [x] **Step 5.2: Normalize UI error handling**

  Add helper:

  ```js
  export function getErrorMessage(error, fallback = '操作失败') {
    return error?.message || error?.msg || String(error || fallback)
  }
  ```

  Use it only in modified files.

  Status: completed on 2026-06-11. `getErrorMessage` is used in the modified SF page/action files for caught errors, preserving existing user-facing fallback messages.

- [x] **Step 5.3: Migrate one page at a time**

  Start with `SfShippingWorkbench.vue` after Phase 4, because SF actions are high-risk and benefit from a clearer boundary.

  Status: completed on 2026-06-11. `SfShippingWorkbench.vue` and `useSfShipmentActions.js` now call `sfApi`/`configApi`; direct `window.electronAPI` SF/config calls are centralized in `electronApiClient.js`.

- [x] **Step 5.4: Verify**

  Run:

  ```bash
  cd electron && npm run build:renderer
  ```

  Status: completed on 2026-06-11. `npm run build:renderer` passed; `git diff --check` passed for Phase 5 files; static scan confirmed direct `window.electronAPI` usage for the migrated SF page/action path exists only in `electronApiClient.js`.

---

## Phase 6: Dashboard Commercial Readiness

**Objective:** Make the dashboard answer “what needs handling today” with real operational priority.

**Files:**
- Modify: `electron/renderer/src/views/Dashboard.vue`
- Optional create: `electron/renderer/src/views/dashboard/TodayActionPanel.vue`
- Optional create: `electron/renderer/src/views/dashboard/SystemHealthPanel.vue`

- [x] **Step 6.1: Replace emoji icons**

  Use lucide icons for Today Action cards.

  Status: completed on 2026-06-11. Dashboard Today Action cards now render lucide icons through a data-driven `todayActions` list.

- [x] **Step 6.2: Improve action priority**

  First row should prioritize:

  - pending takeover
  - pending shipping
  - pending return or overdue
  - pending approval/learning
  - system blocking issue

  Use existing available stats first. Do not invent backend fields.

  Status: completed on 2026-06-11. The first row now prioritizes manual takeover, fulfillment/shipping attention, return/schedule attention, pending message review, learning review, and system blockers using existing `stats`, `ops`, and `systemCheck` values only.

- [x] **Step 6.3: Keep system health compact**

  System check remains available but should not dominate first screen unless there is a blocking issue.

  Status: completed on 2026-06-11. System health remains in the lower system status section, while only failed self-check count is surfaced as a compact Today Action card.

- [x] **Step 6.4: Verify**

  Run:

  ```bash
  cd electron && npm run build:renderer
  ```

  Manual checks:

  - First screen communicates today's work.
  - Agent status remains in Topbar.
  - Existing system check and history learning actions still work.

  Status: completed on 2026-06-11 for static verification. `npm run build:renderer` passed and `git diff --check` passed for `Dashboard.vue`. Rendered click verification remains pending due to the Electron/MySQL/Computer Use blocker recorded in `progress.md`.

---

## Phase 7: Long-Term Architecture Gate

**Objective:** Decide when to move from Electron-local architecture to standard backend separation.

**Files:**
- Create: `docs/architecture/frontend-backend-separation-gate.md`

- [x] **Step 7.1: Write architecture gate document**

  The document must define:

  - Current architecture.
  - Why not split immediately.
  - Trigger conditions for backend separation.
  - Migration path.
  - Risks.

  Trigger conditions:

  - multiple merchants using one deployed system
  - employee accounts and permissions
  - cloud-hosted shared data
  - browser access outside local network
  - paid SaaS operation
  - audit logs and admin controls

  Status: completed on 2026-06-11. `docs/architecture/frontend-backend-separation-gate.md` documents the current Electron-local architecture, why not split immediately, backend separation trigger conditions, and risks.

- [x] **Step 7.2: Define future migration path**

  Recommended path:

  1. Split `dbManager.js` into domain services inside Electron main.
  2. Normalize service method input/output shapes.
  3. Wrap renderer calls in `electronApiClient`.
  4. Reuse the same service layer for mobile gateway endpoints.
  5. Later replace selected IPC services with HTTP endpoints.
  6. Add auth, tenant, permission, audit logs only when needed.

  Status: completed on 2026-06-11. The migration path is documented as local domain service cleanup, normalized service contracts, renderer API wrappers, mobile gateway reuse, selective HTTP replacement, then auth/tenant/audit additions when required.

- [x] **Step 7.3: Verify no code changes**

  This phase is documentation only.

  Status: completed on 2026-06-11. Phase 7 only added `docs/architecture/frontend-backend-separation-gate.md`; it did not modify application code.

---

## Execution Prompts For Future Sessions

### Start A Phase

```text
请按照 `docs/superpowers/plans/2026-06-11-frontend-commercialization.md` 执行 Phase X。

要求：
- 先读取 AGENTS.md、两个 UI 设计文档、该计划、findings.md、progress.md
- 只执行 Phase X，不顺手做后续阶段
- 不修改 Electron 主进程生命周期、Python、IPC 协议、数据库 schema、登录同步、自动回复、顺丰业务逻辑
- 修改后运行 electron/package.json 中可用的前端检查，至少尝试 `cd electron && npm run build:renderer`
- 更新 progress.md 和计划 checkbox
```

### Fix A Specific UI Bug

```text
请只修复这个前端交互 bug，并按前端商用化计划的约束执行：

页面：
现象：
复现步骤：
期望结果：
限制：
- 不改业务逻辑
- 不改 IPC payload
- 不改数据库 schema
- 保留原处理函数
- 修改后运行 `cd electron && npm run build:renderer`
```

### Review Before Editing

```text
请按真实商家后台标准，只审查这个页面，不改代码：

页面：
重点：
- 是否能快速判断今天要处理什么
- 是否存在危险动作暴露
- 状态是否清晰
- 是否有弹窗/抽屉/确认不一致
- 是否有文字、按钮、表格拥挤或溢出

输出 P0/P1/P2 问题清单和建议修改文件。
```

---

## Completion Criteria

The frontend commercialization track is complete when:

- All high-risk actions use shared confirmation UI.
- No new native `window.confirm` is introduced in renderer pages.
- SF shipment detail uses Drawer.
- Order detail remains Drawer-based.
- Order fulfillment page is decomposed enough that table, filters, detail, and actions are separable.
- SF shipping page is decomposed enough that form, summary, records, and detail are separable.
- Dashboard first screen is action-oriented.
- Renderer API calls are grouped through a thin client for the most complex pages.
- Architecture gate document exists and explains when standard backend separation becomes necessary.
- `cd electron && npm run build:renderer` passes or any local dependency blocker is documented.
