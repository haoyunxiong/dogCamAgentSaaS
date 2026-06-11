# Phase 00 路由、页面与组件清单

执行日期：2026-06-12

## 前端路由

路由定义：`electron/renderer/src/router/index.js`

| 路由 | 页面 | 当前能力 | 分类 |
|---|---|---|---|
| `/` | `views/Dashboard.vue` | 控制台、今日待办、运营概览、系统状态、历史学习入口 | 保留，需去闲鱼核心入口化 |
| `/settings` | `views/Settings.vue` | 模型、智能体、通知、顺丰、闲管家、市场监控、询单优化、免押配置 | 保留配置能力，拆分 legacy 渠道配置 |
| `/prompts` | `views/Prompts.vue` | classify/price/tech/default 提示词编辑与生成 | legacy 包装后可转话术助手 |
| `/knowledge` | `views/KnowledgeBase.vue` | FAQ/知识库管理、图片/聊天生成知识 | 保留，需去闲鱼化 |
| `/takeovers` | `views/rental/TakeoverBoard.vue` | 人工接管、会话状态重置 | legacy 包装后可保留为客服/协同 |
| `/devices` | `views/rental/DeviceManagement.vue` | 设备型号、单台设备、状态、成本、残值 | 必须保留 |
| `/schedule` | `views/rental/ScheduleCalendar.vue` | 档期甘特图、可用性查询、订单详情、热力图 | 必须保留 |
| `/orders` | `views/rental/OrderFulfillment.vue` | 订单履约、建单、导入、物流、归还、续租、批量操作 | 必须保留 |
| `/learning` | `views/rental/LearningReview.vue` | 聊天历史学习审核、结构化建议、浏览器历史同步 | 待确认 / legacy 包装 |
| `/pending` | `views/rental/FeishuPending.vue` | AI 草稿消息审批 | 待确认，若多渠道客服可保留 |
| `/reports` | `views/rental/Reports.vue` | 经营报表、库存、订单、收入、设备使用 | 必须保留 |
| `/inquiries` | `views/rental/InquiryAnalytics.vue` | 询单统计、转化、优化建议、成本配置入口 | 保留 |
| `/market` | `views/rental/MarketMonitor.vue` | 闲鱼同类帖子价格和趋势监控 | legacy / 外部行情候选 |
| `/pricing` | `views/rental/Pricing.vue` | 租赁定价、免押规则 | 必须保留 |
| `/item-mapping` | `views/rental/ItemModelMapping.vue` | 闲鱼 item_id 到业务商品/型号绑定、帖子审核 | 渠道化改造候选 |
| `/sf-shipping` | `views/rental/SfShippingWorkbench.vue` | 顺丰寄件、查件、费用、时效、批量发货 | 必须保留 |
| `/deposits` | `views/rental/DepositManagement.vue` | 免押订单管理、审核状态、邀约文本、详情 | 必须保留 |

## 侧边栏分组

来源：`electron/renderer/src/components/AppSidebar.vue`

| 分组 | 页面 |
|---|---|
| 工作台 | 控制台 |
| 订单与履约 | 订单履约、顺丰寄件、免押管理、设备管理、租赁档期、租赁定价 |
| 会话协同 | 人工接管、消息审批、学习审核 |
| 数据与运营 | 询单分析、商品型号绑定、报表中心、市场监控 |
| 系统设置 | 设置、提示词、知识库 |

判断：当前导航已经接近租赁运营后台，但会话协同和数据运营里仍有明显闲鱼客服/渠道模块，需要后续在 Phase 01 固定导航主线时重新分层。

## 关键基础组件

| 组件 | 作用 | 判断 |
|---|---|---|
| `BaseButton.vue` | 通用按钮 | 保留 |
| `BaseCard.vue` | 通用卡片 | 保留 |
| `BaseBadge.vue` | 通用 badge | 保留 |
| `BaseDialog.vue` | 弹窗 | 保留 |
| `BaseDrawer.vue` | 抽屉 | 保留 |
| `DataTable.vue` | 表格 | 保留 |
| `EmptyState.vue` | 空状态 | 保留 |
| `FilterBar.vue` | 筛选条 | 保留 |
| `StatusBadge.vue` | 状态标签 | 保留 |
| `ToastHost.vue` | 全局 toast | 保留 |
| `PageHeader.vue` | 页面头部 | 保留 |
| `KpiStrip.vue`, `StatsCard.vue`, `InsightCard.vue` | 指标展示 | 保留 |
| `AdvancedFilterDrawer.vue`, `BatchActionBar.vue`, `RowActionMenu.vue` | 高密度后台操作组件 | 保留 |
| `CreateDepositDrawer.vue`, `AddressCard.vue` | 免押/地址业务组件 | 保留 |
| `RentDateRangePicker.vue`, `RentDaysInput.vue`, `ClickOpenDateInput.vue` | 租期/日期输入 | 保留 |

## 关键业务子组件

| 路径 | 作用 |
|---|---|
| `views/rental/order-fulfillment/OrderDetailDrawer.vue` | 订单详情 |
| `views/rental/order-fulfillment/OrderFilters.vue` | 订单筛选 |
| `views/rental/order-fulfillment/OrderTable.vue` | 订单表格 |
| `views/rental/order-fulfillment/useOrderActions.js` | 订单操作逻辑 |
| `views/rental/order-fulfillment/useOrderFilters.js` | 订单筛选逻辑 |
| `views/rental/sf-shipping/SfCreateForm.vue` | 顺丰下单表单 |
| `views/rental/sf-shipping/SfShipmentRecords.vue` | 顺丰记录 |
| `views/rental/sf-shipping/SfSummaryPanel.vue` | 顺丰摘要 |
| `views/rental/sf-shipping/useSfShipmentActions.js` | 顺丰操作逻辑 |

## 页面迁移判断

### 必须保留并作为新 SaaS 主线

- `OrderFulfillment.vue`
- `ScheduleCalendar.vue`
- `DeviceManagement.vue`
- `SfShippingWorkbench.vue`
- `DepositManagement.vue`
- `Pricing.vue`
- `Reports.vue`
- `InquiryAnalytics.vue`
- `Settings.vue` 中的业务配置能力

### 保留但需要去闲鱼化

- `Dashboard.vue`：控制台保留，但“打开闲鱼 IM”等入口降级为渠道入口。
- `KnowledgeBase.vue`：知识库保留，但文案和数据范围应从闲鱼客服转为租赁 SOP/FAQ。
- `Prompts.vue`：提示词能力可转为话术助手，不作为产品主线。
- `TakeoverBoard.vue`：人工接管可转为多渠道客服/员工协作。
- `FeishuPending.vue`：消息审批可转为多渠道客户沟通审批。
- `LearningReview.vue`：学习审核可转为 SOP/知识沉淀，但浏览器历史同步属于 legacy。
- `ItemModelMapping.vue`：商品型号绑定有价值，但 `item_id` 应抽象为渠道商品 ID。

### legacy / 待确认

- `MarketMonitor.vue`：当前文案明确追踪闲鱼帖子；可作为外部行情工具，不应进入新产品核心。
- `Settings.vue` 中闲管家、闲鱼 cookies/token、Xianyu channel 配置：应移入 legacy channel 配置。

## 当前路由风险

1. 新产品主线页面和 legacy 客服页面混在同一侧边栏层级。
2. `询单分析` 页面 title 为“订单分析”，命名存在不一致。
3. `商品业务绑定` 文案直接写“闲鱼商品 item_id”，后续需要渠道抽象。
4. `市场监控` 当前强绑定闲鱼行情，需要用户确认是否保留。
5. `提示词` 和 `知识库` 仍服务自动回复，后续应收敛为员工 SOP/客户沟通辅助。
