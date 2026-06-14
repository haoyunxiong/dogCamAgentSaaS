# Page Component Mapping / 页面与组件映射

## 1. PC 页面映射

| 页面 | 图片 | 主要组件 |
|---|---|---|
| 工作台 | `02_desktop_workbench.png` | AppShell, Sidebar, Topbar, MetricCard, TaskList, QuickActionGrid, ReminderPanel, ActivityTimeline |
| 订单中心 | `01_desktop_order_center.png` | MetricCard, StatusTabs, FilterBar, BaseTable, StatusTag, OrderDrawer, BulkActions, Pagination |
| 档期中心 | `03_desktop_schedule_center.png` | MetricCard, FilterBar, ScheduleHeatmap, ScheduleLegend, ScheduleDetailDrawer |
| 设备管理 | `04_desktop_device_management.png` | DeviceTable, DeviceStatusTag, DeviceDrawer, UtilizationRing, MaintenanceTimeline |
| 客户管理 | `05_desktop_customer_management.png` | CustomerTable, CustomerTags, CustomerDrawer, RiskBadge, CustomerActionBar |
| 物流发货 | `06_desktop_logistics_shipping.png` | ShippingTable, TrackingTimeline, ShippingDrawer, LogisticsStatusTag |
| 报表中心 | `07_desktop_report_center.png` | ChartCard, InsightPanel, KPIGrid, DonutChart, LineChart, RankingTable |
| 系统设置 | `08_desktop_system_settings.png` | SettingsCards, SettingsForm, Toggle, UploadCard, SaveBar |

## 2. Mobile 页面映射

| 页面 | 图片 | 主要组件 |
|---|---|---|
| 工作台 | `01_mobile_workbench.png` | MobileHeader, HeroMetricCard, QuickActionGrid, TodoList, AlertList, BottomNav |
| 订单 | `02_mobile_order_center.png` | MobileStatusSummary, StatusChips, MobileFilterBar, OrderCardList |
| 订单详情 | `03_mobile_order_detail.png` | DetailHero, InfoCard, DeviceCard, TimelineCard, StickyActionBar |
| 档期 | `04_mobile_schedule_center.png` | ScheduleSummaryCard, WeekSelector, AvailabilityBars, BottomNav |
| 设备 | `05_mobile_device_center.png` | DeviceSummaryCard, DeviceTabs, DeviceCardList, BottomNav |
| 我的 | `06_mobile_my_center.png` | MerchantProfileCard, SettingListGroup, MoreToolsGrid, BottomNav |

## 3. 公共组件优先级

### P0

- AppShell
- Sidebar
- Topbar
- BaseButton
- BaseCard
- StatusTag
- MetricCard
- BaseTable
- Drawer
- BottomNav

### P1

- FilterBar
- SearchInput
- Pagination
- BulkActions
- Timeline
- QuickActionGrid
- MobileCardList

### P2

- ChartCard
- ScheduleHeatmap
- UploadCard
- SettingsForm
- RiskPanel
