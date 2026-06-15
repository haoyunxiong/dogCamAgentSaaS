# Frontend Design Spec v1.1 / 前端设计落地规范

## 版本说明

- v1.1 只修正 Figma 来源、页面 ID、页面 Frame 清单和落地依据。
- v1.1 不代表进入代码改造阶段。
- 后续前端 UI、组件、样式和交互改造应以 v1.1 为准。
- 本规范不修改数据库、不修改后端接口协议、不修改权限逻辑、不操作 Git。
- 本规范只用于指导 `prototypes/ui-v2-demo` 与后续真实系统 UI 迁移计划。

## 1. Figma 来源复核结论

正式 Figma 文件：

- 文件名：`租赁商家运营系统 - Design System v1`
- fileKey：`3n56ihspTk9sqWOnNW9y3K`

上一版 Frontend Design Spec v1 中“当前 Figma 文件只有 1 个页面”的结论不准确。

复核结论：

- 顶层 `get_metadata` 曾只返回 `00 System / 设计系统`。
- 但通过 Figma Plugin API 读取 `figma.root.children`，并通过 `nodeId=1:2`、`nodeId=1:3` 下钻复核，确认当前正式 fileKey 内实际存在 3 个 Page。

当前正式文件包含：

| Page ID | Page 名称 | 用途 |
|---|---|---|
| `0:1` | `00 System / 设计系统` | Design Tokens、Foundation Components、Business Components、Mobile Components |
| `1:2` | `01 Mobile / 手机端核心页面` | 移动端 6 个核心页面 |
| `1:3` | `02 Desktop / PC 端核心页面` | PC 端 9 个核心页面 |

## 2. 落地依据

前端落地必须按以下来源拆解：

| 来源 | 前端落地内容 |
|---|---|
| `00 System / 设计系统` | Design Tokens、Foundation Components、Business Components、Mobile Components |
| `01 Mobile / 手机端核心页面` | 移动端 6 个核心页面结构、信息层级、交互优先级 |
| `02 Desktop / PC 端核心页面` | PC 端 9 个核心页面结构、布局密度、表格 / Drawer / KPI / 筛选范式 |

不能再声称“只基于 System 页面”。当前前端规范可同时基于组件系统、Token、6 个移动页面和 9 个 PC 页面。

## 3. Figma 页面 Frame 清单

### 3.1 Mobile 页面 Frame

来源：`1:2 / 01 Mobile / 手机端核心页面`

- `Mobile / 工作台`
- `Mobile / 订单中心`
- `Mobile / 订单详情`
- `Mobile / 档期中心`
- `Mobile / 设备中心`
- `Mobile / 我的 / 商家中心`

### 3.2 Desktop 页面 Frame

来源：`1:3 / 02 Desktop / PC 端核心页面`

- `Desktop / 工作台`
- `Desktop / 订单中心`
- `Desktop / 档期中心`
- `Desktop / 设备中心`
- `Desktop / 客户中心`
- `Desktop / 免押管理`
- `Desktop / 物流发货`
- `Desktop / 报表中心`
- `Desktop / 系统设置`

## 4. Vue 组件映射

### 4.1 Foundation Components -> 基础组件

| Figma 组件 | Vue 组件建议 | 说明 |
|---|---|---|
| `Foundation/Button/Primary` | `BaseButton.vue` | `variant="primary"` |
| `Foundation/Button/Secondary` | `BaseButton.vue` | `variant="secondary"` |
| `Foundation/Button/Ghost` | `BaseButton.vue` | `variant="ghost"` |
| `Foundation/Button/Danger` | `BaseButton.vue` | `variant="danger"` |
| `Foundation/StatusTag/*` | `StatusTag.vue` / `BaseBadge.vue` | 订单、设备、免押、物流状态统一入口 |
| `Foundation/Input/Search` | `BaseInput.vue` | 搜索输入 |
| `Foundation/Select/Default` | `BaseSelect.vue` | 默认态 |
| `Foundation/Select/Open` | `BaseSelect.vue` | 展开态 |
| `Foundation/FilterBar` | `FilterBar.vue` + `FilterChip.vue` | PC 筛选栏 |
| `Foundation/Table` | `BaseTable.vue` / `DataTable.vue` | PC 表格 |
| `Foundation/Drawer/Right` | `BaseDrawer.vue` / `Drawer.vue` | 右侧详情与处理面板 |
| `Foundation/BottomSheet/Default` | `BottomSheet.vue` | 移动筛选 / 更多操作 |
| `Foundation/BottomNav` | `MobileBottomNav.vue` | 移动端 5 Tab |
| `Foundation/AppShell/Desktop` | `AppShell.vue` + `Sidebar.vue` + `Topbar.vue` | PC 主框架 |
| `Foundation/State/Empty` | `BaseEmpty.vue` | 空状态 |
| `Foundation/State/Loading` | `BaseSkeleton.vue` | 加载态 |
| `Foundation/State/Error` | `BaseError.vue` | 错误态 |
| `Foundation/Pagination` | `Pagination.vue` | PC 分页 |

### 4.2 Business Components -> 业务组件

| Figma 组件 | Vue 组件建议 | 用途 |
|---|---|---|
| `Business/MetricCard` | `MetricCard.vue` | KPI 指标 |
| `Business/StatusTabs` | `StatusTabs.vue` | 状态筛选 |
| `Business/OrderTableRow` | `OrderTableRow.vue` | PC 订单表格行 |
| `Business/OrderDrawer` | `OrderDrawer.vue` | 订单详情 Drawer |
| `Business/DeviceCard` | `DeviceCard.vue` | 设备卡片 |
| `Business/CustomerRow` | `CustomerRow.vue` | 客户列表行 |
| `Business/DepositStatus` | `DepositStatus.vue` | 免押 / 押金状态 |
| `Business/DepositStatusBlock` | `DepositStatusBlock.vue` | 免押审核信息块 |
| `Business/ShippingStepBlock` | `ShippingSteps.vue` | 物流步骤 |
| `Business/BulkActionBar` | `BulkActionBar.vue` | 批量处理 |
| `Business/ScheduleHeatmap` | `ScheduleHeatmap.vue` | PC 档期热力图 |
| `Business/ScheduleLegend` | `ScheduleLegend.vue` | 档期图例 |
| `Business/TrackingTimeline` | `TrackingTimeline.vue` | 运单轨迹 |
| `Business/ChartCard` | `ChartCard.vue` | 报表卡片 |
| `Business/SettingsCard` | `SettingsCard.vue` | 设置模块入口 |

### 4.3 Mobile Components -> 移动端组件

| Figma 组件 | Vue 组件建议 | 用途 |
|---|---|---|
| `Mobile/MobileHeader` | `MobileHeader.vue` | 移动页头 |
| `Mobile/HeroMetricCard` | `HeroMetricCard.vue` | 首屏核心指标 |
| `Mobile/QuickActionGrid` | `QuickActionGrid.vue` | 快捷操作 |
| `Mobile/TaskCard` | `TaskCard.vue` | 今日任务 |
| `Mobile/StatusChips` | `StatusChips.vue` | 状态切换 |
| `Mobile/FilterBar` | `MobileFilterBar.vue` | 移动筛选入口 |
| `Mobile/OrderCard` | `OrderCard.vue` | 移动订单卡 |
| `Mobile/DetailHero` | `DetailHero.vue` | 订单详情头部 |
| `Mobile/InfoCard` | `InfoCard.vue` | 分组信息卡 |
| `Mobile/TimelineCard` | `TimelineCard.vue` | 订单 / 物流时间线 |
| `Mobile/StickyActionBar` | `StickyActionBar.vue` | 底部固定操作 |
| `Mobile/ScheduleSummaryCard` | `ScheduleSummaryCard.vue` | 档期摘要 |
| `Mobile/AvailabilityBars` | `AvailabilityBars.vue` | 可用档期条 |
| `Mobile/MerchantProfileCard` | `MerchantProfileCard.vue` | 商家资料 |
| `Mobile/SettingListGroup` | `SettingListGroup.vue` | 设置列表 |
| `Mobile/MoreToolsGrid` | `MoreToolsGrid.vue` | 更多工具 |

### 4.4 Desktop Pages -> PC 页面组件

| Figma Frame | Vue 页面建议 | 优先级 |
|---|---|---|
| `Desktop / 工作台` | `DesktopWorkbench.vue` / `Dashboard.vue` | P0 |
| `Desktop / 订单中心` | `DesktopOrders.vue` / `Orders.vue` | P0 |
| `Desktop / 档期中心` | `DesktopSchedule.vue` | P1 |
| `Desktop / 设备中心` | `DesktopDevices.vue` | P1 |
| `Desktop / 免押管理` | `DesktopDeposit.vue` | P1 |
| `Desktop / 物流发货` | `DesktopLogistics.vue` | P1 |
| `Desktop / 客户中心` | `DesktopCustomers.vue` | P2 |
| `Desktop / 报表中心` | `DesktopReports.vue` | P2 |
| `Desktop / 系统设置` | `DesktopSettings.vue` | P2 |

## 5. CSS Variables 对照

### 5.1 Colors

```css
:root {
  --color-primary-900: #06211f;
  --color-primary-800: #07312d;
  --color-primary-700: #06443d;
  --color-primary-600: #007f6d;
  --color-primary-500: #00a889;
  --color-primary-100: #e8f7f3;

  --color-bg-page: #f6f8fa;
  --color-bg-surface: #ffffff;
  --color-bg-sidebar: #06211f;

  --color-border-subtle: #e7edf2;

  --color-text-primary: #101828;
  --color-text-secondary: #667085;
  --color-text-tertiary: #98a2b3;
}
```

### 5.2 Status

```css
:root {
  --color-status-success: #10b981;
  --color-status-warning: #f59e0b;
  --color-status-danger: #ef4444;
  --color-status-info: #3b82f6;

  --status-order-pending-shipping: #f59e0b;
  --status-order-in-use: #3b82f6;
  --status-order-overdue: #ef4444;
  --status-order-completed: #98a2b3;

  --status-device-available: #10b981;
  --status-device-rented: #3b82f6;

  --status-deposit-pending: #f59e0b;
  --status-deposit-approved: #10b981;

  --status-schedule-available: #10b981;
  --status-schedule-conflict: #ef4444;

  --status-shipping-exception: #ef4444;
}
```

### 5.3 Spacing

```css
:root {
  --space-4: 4px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-32: 32px;
  --space-40: 40px;
}
```

### 5.4 Radius

```css
:root {
  --radius-4: 4px;
  --radius-8: 8px;
  --radius-12: 12px;
  --radius-16: 16px;
  --radius-20: 20px;
  --radius-pill: 999px;
}
```

### 5.5 Typography

```css
:root {
  --font-family-base: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;

  --font-pc-page-title-size: 28px;
  --font-pc-page-title-line: 36px;

  --font-pc-section-title-size: 18px;
  --font-pc-section-title-line: 26px;

  --font-pc-table-size: 13px;
  --font-pc-table-line: 20px;

  --font-mobile-nav-title-size: 20px;
  --font-mobile-nav-title-line: 28px;

  --font-mobile-card-title-size: 16px;
  --font-mobile-card-title-line: 24px;

  --font-caption-size: 12px;
  --font-caption-line: 18px;
}
```

### 5.6 Shadows / Effects

```css
:root {
  --shadow-subtle: 0 1px 4px #1018280a;
  --shadow-card: 0 6px 18px #1018280f;
  --shadow-drawer: -8px 0 32px #10182824;
}
```

## 6. 页面实现优先级

### P0

- 移动端工作台
- 移动端订单中心
- 移动端订单详情
- 桌面端订单中心
- 桌面端工作台

### P1

- 档期中心
- 设备中心
- 物流发货
- 免押管理

### P2

- 客户中心
- 报表中心
- 系统设置
- 我的 / 商家中心

## 7. 移动端页面级落地说明

### 7.1 Mobile / 工作台

来源：`1:2 / Mobile / 工作台`

核心结构：

- `MobileHeader`
- `HeroMetricCard`
- `QuickActionGrid`
- `TaskCard`
- 风险提醒
- `MobileBottomNav`

落地要求：

- 首屏突出今日待处理、待发货、待归还、异常。
- 快捷操作服务高频动作：新建订单、查档期、设备中心、物流发货。
- 不展示 PC 表格。
- 不承载低频配置。

### 7.2 Mobile / 订单中心

来源：`1:2 / Mobile / 订单中心`

核心结构：

- `MobileHeader`
- `MobileStatusSummary`
- `StatusChips`
- `MobileFilterBar`
- `OrderCard` 列表
- `MobileBottomNav`

落地要求：

- 订单使用卡片，不使用表格。
- 每张订单卡必须包含订单号、客户、设备、租期、金额、状态和一个主操作。
- 复杂筛选使用 BottomSheet。

### 7.3 Mobile / 订单详情

来源：`1:2 / Mobile / 订单详情`

核心结构：

- `MobileHeader`
- `DetailHero`
- `InfoCard`
- `TimelineCard`
- `StickyActionBar`

落地要求：

- 分组展示客户信息、租期与金额、设备清单、物流信息、订单时间轴。
- 底部固定主操作。
- 危险操作和低频操作进入“更多操作”。

### 7.4 Mobile / 档期中心

来源：`1:2 / Mobile / 档期中心`

核心结构：

- `MobileHeader`
- `ScheduleSummaryCard`
- `WeekSelector`
- `AvailabilityBars`
- `MobileBottomNav`

落地要求：

- 使用周视图和可用档期条。
- 不做 PC 月表格缩小版。
- 优先解决“能不能租、哪天冲突”的快速判断。

### 7.5 Mobile / 设备中心

来源：`1:2 / Mobile / 设备中心`

核心结构：

- `MobileHeader`
- `DeviceSummaryCard`
- `DeviceTabs`
- `DeviceCard`
- `MobileBottomNav`

落地要求：

- 突出设备状态：可租、在租、维修、异常。
- 列表以设备卡片为主。
- 状态切换必须快速可扫读。

### 7.6 Mobile / 我的 / 商家中心

来源：`1:2 / Mobile / 我的 / 商家中心`

核心结构：

- `MobileHeader`
- `MerchantProfileCard`
- `MoreToolsGrid`
- `SettingListGroup`
- `MobileBottomNav`

落地要求：

- 收纳低频功能和商家中心入口。
- 不承载高频操作。
- 不提前实现商户协作交易闭环。

## 8. PC 端页面级落地说明

### 8.1 Desktop / 工作台

来源：`1:3 / Desktop / 工作台`

核心结构：

- 深色 Sidebar
- Topbar
- KPI Cards
- TaskList
- QuickActionGrid
- ReminderPanel

落地要求：

- 面向店长和运营的经营总览。
- 今日任务、风险提醒和快捷入口优先。
- 保持高信息密度但可扫读。

### 8.2 Desktop / 订单中心

来源：`1:3 / Desktop / 订单中心`

核心结构：

- KPI Cards
- StatusTabs
- FilterBar
- BaseTable
- Right Drawer
- BulkActionBar / Pagination

落地要求：

- 表格承载批量处理。
- 订单详情和处理动作进入右侧 Drawer。
- 不用大弹窗承载复杂订单流程。

### 8.3 Desktop / 档期中心

来源：`1:3 / Desktop / 档期中心`

核心结构：

- KPI Cards
- FilterBar
- ScheduleHeatmap
- ScheduleLegend
- ScheduleDetailDrawer

落地要求：

- 按设备 / 型号展示档期。
- 清晰表达可租、冲突、占用。
- 详情和调整动作使用 Drawer。

### 8.4 Desktop / 设备中心

来源：`1:3 / Desktop / 设备中心`

核心结构：

- KPI Cards
- FilterBar
- Device Table / Device Cards
- Device Drawer

落地要求：

- 突出设备状态、利用率、维修和异常。
- 保持批量筛选和列表扫描能力。

### 8.5 Desktop / 客户中心

来源：`1:3 / Desktop / 客户中心`

核心结构：

- CustomerTable / CustomerRow
- CustomerTags
- RiskBadge
- CustomerDrawer

落地要求：

- 展示客户历史、风险和关联订单。
- 不提前扩展 CRM 复杂能力。

### 8.6 Desktop / 免押管理

来源：`1:3 / Desktop / 免押管理`

核心结构：

- DepositStatus
- DepositStatusBlock
- Review Table
- Right Drawer

落地要求：

- 只做 UI 和前端接口适配。
- 不修改押金规则、免押规则、审核权限和数据库结构。

### 8.7 Desktop / 物流发货

来源：`1:3 / Desktop / 物流发货`

核心结构：

- KPI Cards
- FilterBar
- Shipping Table
- TrackingTimeline
- Shipping Drawer

落地要求：

- 展示待发货、待揽收、运输中、异常。
- 运单详情和轨迹进入 Drawer。
- 不修改现有物流业务逻辑。

### 8.8 Desktop / 报表中心

来源：`1:3 / Desktop / 报表中心`

核心结构：

- KPI Cards
- ChartCard
- RankingTable
- InsightPanel / Drawer

落地要求：

- Demo 阶段使用 mock 数据表达结构。
- 不接真实统计接口。
- 不新增报表后端逻辑。

### 8.9 Desktop / 系统设置

来源：`1:3 / Desktop / 系统设置`

核心结构：

- SettingsCard
- SettingsForm
- Toggle
- SaveBar

落地要求：

- 当前只表达设置中心的信息架构。
- 真实配置治理进入 Phase 03 后单独规划。
- 不修改权限、门店、员工、商户底座逻辑。

## 9. 不可改后端边界

本阶段前端只允许做：

- UI 组件
- 页面样式
- 页面交互
- mock 数据展示
- 前端接口适配层字段映射

明确不做：

- 不改数据库结构。
- 不改后端接口协议。
- 不改接口返回结构。
- 不改权限逻辑。
- 不改 Electron main / preload / IPC。
- 不改 Python backend。
- 不删除旧文件。
- 不迁移旧组件到新体系。
- 不运行 `git add` / `git commit` / `git push`。
- 不实现商户协作交易闭环。
- 不提前实现 Phase 03 之后的真实 SaaS 底座。

如果后续接真实数据，只能在前端 adapter / composable 层做兼容，不要求后端改变字段。

## 10. 实施计划

### Step 0：文档落地

建议新增文档：

```text
docs/xiaogou-saas-roadmap/phases/ui-v2-demo/artifacts/frontend-design-spec-v1.1.md
```

### Step 1：Token 对齐

目标：

- 将前端 token 对齐 Figma `00 System / 设计系统`。
- 清理早期 Demo 体验色系与正式 DS v1 不一致的问题。
- 不改业务逻辑。

重点文件候选：

```text
prototypes/ui-v2-demo/src/styles/tokens.css
prototypes/ui-v2-demo/src/styles/base.css
```

### Step 2：Foundation Components 对齐

优先补齐：

- `BaseButton`
- `StatusTag`
- `BaseInput`
- `BaseSelect`
- `FilterBar`
- `BaseTable`
- `Drawer`
- `BottomSheet`
- `MobileBottomNav`
- `BaseEmpty`
- `BaseSkeleton`
- `BaseError`
- `Pagination`

### Step 3：P0 页面实现

优先顺序：

1. `Mobile / 工作台`
2. `Mobile / 订单中心`
3. `Mobile / 订单详情`
4. `Desktop / 订单中心`
5. `Desktop / 工作台`

### Step 4：P1 页面实现

- 档期中心
- 设备中心
- 物流发货
- 免押管理

### Step 5：P2 页面实现

- 客户中心
- 报表中心
- 系统设置
- 我的 / 商家中心

### Step 6：Demo 验收后再规划真实系统迁移

Demo 视觉、结构、交互通过后，再单独输出真实 Electron 系统迁移计划。

## 11. 开发验收清单

### 11.1 组件验收

- 所有基础组件使用 CSS variables。
- 不散落硬编码颜色、间距、圆角和阴影。
- Button 覆盖 primary / secondary / ghost / danger。
- StatusTag 覆盖订单、设备、免押、物流核心状态。
- Drawer 用于复杂详情和处理。
- BottomSheet 用于移动筛选、更多操作和低频操作。
- Empty / Loading / Error 状态齐全。

### 11.2 页面验收

- 页面只组合组件和处理页面级状态。
- 不在页面内堆大量一次性样式。
- P0 页面能完整表达 mock 业务状态。
- 状态、下一步动作、风险提醒优先于装饰。
- 页面结构与 Figma Frame 对齐。

### 11.3 移动端验收

- 固定底部导航：工作台 / 订单 / 档期 / 设备 / 我的。
- 订单列表使用卡片，不使用 PC 表格。
- 订单详情使用分组卡片 + 底部固定主操作。
- 档期使用周视图 / 热力条，不使用完整月表格。
- 低频功能进入“我的 / 更多工具”。
- 首屏优先展示高频、紧急、轻量处理任务。

### 11.4 PC 端验收

- 深色 Sidebar + 浅色内容区。
- 订单、物流、免押等复杂页使用右侧 Drawer。
- 表格、筛选、KPI、批量操作、分页结构统一。
- 高信息密度但不拥挤。
- 不回到蓝色普通后台模板风。
- 不使用大面积玻璃拟态、重阴影或营销页布局。

### 11.5 后端边界验收

- 数据库 schema 无变化。
- 接口协议无变化。
- 接口返回结构无变化。
- 权限逻辑无变化。
- Electron main / preload / IPC 无变化。
- Python backend 无变化。
- Git 未执行 add / commit / push。
- 旧文件未删除。
- 旧组件未迁移。
