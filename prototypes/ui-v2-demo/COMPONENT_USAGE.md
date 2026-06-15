# UI-V2 Demo Component Usage

This document defines the component usage rules for `prototypes/ui-v2-demo`.
P1 pages must follow these rules before adding new page-level UI.

## 1. Page Composition Rule

Pages may only compose existing component layers:

- Foundation components: low-level reusable UI primitives.
- Business components: rental-operation domain blocks.
- Mobile components: mobile shell, navigation, cards and mobile-only interaction surfaces.

Pages should handle:

- data selection from mock files;
- layout composition;
- page-level interaction state;
- routing and event wiring.

Pages must not copy another set of base button, input, select, table, drawer, status tag, card, shadow, radius or color styles.

## 2. Token Rule

Do not bypass `src/styles/tokens.css`.

Forbidden in page styles:

- hardcoded brand colors;
- hardcoded status colors;
- hardcoded border radius values;
- hardcoded shadows;
- duplicated button/input/table style systems.

Allowed:

- using CSS variables from `tokens.css`;
- adding page-specific layout spacing with existing spacing tokens;
- adding narrowly scoped layout rules when no component owns that layout.

Use these token groups first:

- colors: `--color-*`, `--brand`, `--surface`, `--text`, `--border`;
- spacing: `--space-*`;
- radius: `--radius-*`;
- shadows: `--shadow-*`;
- typography: `--font-*`.

## 3. Foundation Components

### BaseButton

File: `src/components/BaseButton.vue`

Props:

- `variant`: `primary` | `secondary` | `ghost` | `danger`
- `size`: `sm` | `md` | `lg`
- `type`: normal button type, default `button`
- `block`: full-width button
- `disabled`: disabled state

Usage:

```vue
<BaseButton>保存</BaseButton>
<BaseButton variant="secondary" size="sm">筛选</BaseButton>
<BaseButton variant="ghost">取消</BaseButton>
<BaseButton variant="danger">标记异常</BaseButton>
```

Rules:

- Primary actions use `variant="primary"` or default.
- Secondary actions use `variant="secondary"`.
- Text-like low-priority actions use `variant="ghost"`.
- Destructive or exception actions use `variant="danger"`.
- Do not create page-local `.button` classes.

### StatusTag

File: `src/components/StatusTag.vue`

Supported status labels:

- Order: `待确认`, `待押金`, `待分配设备`, `待发货`, `租赁中`, `待归还`, `待验机`, `已完成`, `异常`
- Risk: `正常`, `低`, `中`, `高`
- Device / schedule: `可租`, `占用`, `冲突`, `维修`, `维修中`
- Deposit: `待收`, `已收`, `免押审核中`, `免押通过`, `免押失败`, `需人工复核`
- Shipping: `待下单`, `待揽收`, `运输中`, `已签收`

Tones:

- `neutral`
- `success`
- `warning`
- `danger`
- `info`

Usage:

```vue
<StatusTag label="待发货" />
<StatusTag label="异常" />
<StatusTag label="自定义状态" tone="info" />
```

Rules:

- Use `StatusTag` for all status-like text.
- Do not write custom status pills inside pages.
- Add new status labels to `StatusTag.vue` only when mock data introduces a stable new enum.

### BaseInput / BaseSelect / FilterBar

Files:

- `src/components/BaseInput.vue`
- `src/components/BaseSelect.vue`
- `src/components/FilterBar.vue`
- `src/components/FilterChip.vue`

Usage:

```vue
<FilterBar>
  <FilterChip label="全部" :active="status === '全部'" @click="status = '全部'" />
  <BaseInput v-model="keyword" placeholder="搜索订单、客户、设备" />
  <template #actions>
    <BaseButton variant="secondary">展开高级筛选</BaseButton>
  </template>
</FilterBar>
```

Rules:

- PC list pages use `FilterBar`.
- Status shortcuts use `FilterChip`.
- Search uses `BaseInput`.
- Select dropdowns use `BaseSelect`.
- Mobile complex filtering should open `BottomSheet`.
- Do not create one-off filter rows in page styles when `FilterBar` can compose the same result.

### BaseTable

File: `src/components/BaseTable.vue`

Props:

- `columns`: array of `{ key, label, width? }`
- `rows`: array of row objects
- `rowKey`: stable row id key, default `id`
- `selectedKey`: current selected row key

Usage:

```vue
<BaseTable
  :columns="columns"
  :rows="rows"
  row-key="orderNo"
  :selected-key="selectedOrder?.orderNo || ''"
  @row-click="openRow"
>
  <template #status="{ row }">
    <StatusTag :label="row.status" />
  </template>
</BaseTable>
```

Rules:

- Desktop list pages use `BaseTable` or a business wrapper such as `OrderTable`.
- Columns must be declared in script, not hardcoded as repeated markup.
- Status cells must render through `StatusTag`.
- Empty states are handled by `BaseTable` and `BaseEmpty`.

### Drawer / BottomSheet

Files:

- `src/components/Drawer.vue`
- `src/components/BottomSheet.vue`

Usage boundaries:

- `Drawer` is for desktop detail and processing panels.
- `Drawer` can contain order detail, device detail, schedule detail or logistics detail.
- `BottomSheet` is for mobile filter, secondary actions or compact task options.
- Do not use large modal dialogs for P1 order/device/schedule workflows unless no drawer or sheet pattern fits.
- Do not move persistent page navigation into `Drawer` or `BottomSheet`.

### MobileBottomNav

File: `src/components/MobileBottomNav.vue`

Current tabs:

- `/mobile` -> `工作台`
- `/mobile/orders` -> `订单`
- `/mobile/schedule` -> `档期`
- `/mobile/devices` -> `设备`
- `/mobile/mine` -> `我的`

Rules:

- Keep five primary tabs.
- Do not add low-frequency tools into bottom navigation.
- P1 mobile pages must keep `MobileBottomNav` visible through `MobileShell`.

### State Components

Files:

- `BaseEmpty.vue`
- `BaseSkeleton.vue`
- `BaseError.vue`
- `Pagination.vue`

Rules:

- Empty result lists use `BaseEmpty`.
- Loading placeholders use `BaseSkeleton`.
- Recoverable local errors use `BaseError`.
- Desktop paged lists use `Pagination`.

## 4. Business Components

### OrderCard

File: `src/components/OrderCard.vue`

Expected order fields:

- `id`
- `orderNo`
- `customerName`
- `channel`
- `status`
- `rentStart`
- `rentEnd`
- `model`
- `depositStatus`
- `shippingStatus`
- `nextAction`

Rules:

- Mobile order lists use `OrderCard`.
- `OrderCard` emits `click` with the full order object.
- Do not use desktop tables on mobile order pages.

### OrderTable

File: `src/components/OrderTable.vue`

Expected order fields:

- `orderNo`
- `customerName`
- `channel`
- `status`
- `rentStart`
- `rentEnd`
- `model`
- `depositStatus`
- `shippingStatus`
- `riskLevel`
- `assignee`
- `nextAction`

Rules:

- Desktop order pages use `OrderTable`.
- `OrderTable` wraps `BaseTable` and owns order-specific slots.
- Page code should not duplicate the order table column layout.

## 5. Mock Data Contract

Mock data lives under `src/mock/`.

Current core mock modules:

- `orders.js`
- `tasks.js`
- `risks.js`
- `devices.js`
- `schedule.js`
- `shipping.js`
- `metrics.js`

Rules:

- Demo pages must use mock data only.
- Do not request real APIs.
- Do not read Electron, Python, SQLite or local production data.
- Keep fields stable enough for P1 pages to reuse.
- If a field is added for P1, update this document and the smoke script when it becomes required.

Order field convention:

```js
{
  id,
  orderNo,
  customerName,
  phoneMasked,
  channel,
  status,
  rentStart,
  rentEnd,
  model,
  deviceIds,
  depositStatus,
  depositAmount,
  rentAmount,
  shippingStatus,
  riskLevel,
  assignee,
  nextAction,
  address,
  note,
  createdAt
}
```

## 6. Page Rules

When adding a page:

1. Confirm whether it is P0, P1 or P2.
2. Add the page only inside `src/views`.
3. Compose existing components before creating new components.
4. Keep page styles focused on layout only.
5. Put reusable UI into `src/components`.
6. Put reusable mock data into `src/mock`.
7. Update `scripts/smoke.mjs` when the page becomes required for acceptance.
8. Do not change Electron, Python, database, IPC, permissions or real API contracts.

## 7. P1 Component Combination Rules

P1 pages must follow these combinations:

- Desktop schedule: `AppShell` + KPI / summary blocks + `FilterBar` + schedule component + `Drawer`.
- Desktop devices: `AppShell` + KPI / summary blocks + `FilterBar` + device list/table + `Drawer`.
- Desktop logistics: `AppShell` + KPI / summary blocks + `FilterBar` + table + `Drawer` / `ShippingSteps`.
- Desktop deposit: `AppShell` + KPI / summary blocks + `FilterBar` + table + `Drawer`.
- Mobile schedule: `MobileShell` + mobile header area + summary card + status chips + schedule availability blocks.
- Mobile devices: `MobileShell` + summary card + status chips + `DeviceCard` list.

P1 must not:

- introduce a second design system;
- add page-local copies of foundation controls;
- add real API calls;
- modify production Electron code;
- implement merchant collaboration transaction flows.

## 8. Validation

Before reporting a P1 page as complete:

- run `npm run smoke`;
- run `npm run build`;
- run `npm run lint`;
- run `npm run typecheck`;
- run `npm test`;
- visually verify the page if a browser is available.
