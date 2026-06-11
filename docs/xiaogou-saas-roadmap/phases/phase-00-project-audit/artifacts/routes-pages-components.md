# Phase 00 路由、页面与组件清单

执行时间：2026-06-11

## 当前路由

来源：`electron/renderer/src/router/index.js`

| 路由 | 页面组件 | 当前定位 | Phase 00 分类 |
|---|---|---|---|
| `/` | `views/Dashboard.vue` | 控制台、今日待办、系统状态 | 保留，需去闲鱼入口化 |
| `/settings` | `views/Settings.vue` | 系统设置、模型、通知、顺丰、闲鱼接入 | 保留配置能力，拆分 legacy 配置 |
| `/prompts` | `views/Prompts.vue` | classify/price/tech/default 提示词编辑 | legacy，未来可转话术助手 |
| `/knowledge` | `views/KnowledgeBase.vue` | 知识库管理 | legacy 包装后保留 |
| `/takeovers` | `views/rental/TakeoverBoard.vue` | 人工接管任务 | legacy 客服流，部分可转 SOP/待办 |
| `/devices` | `views/rental/DeviceManagement.vue` | 设备管理 | 必须保留 |
| `/schedule` | `views/rental/ScheduleCalendar.vue` | 租赁档期与可用性查询 | 必须保留 |
| `/orders` | `views/rental/OrderFulfillment.vue` | 订单履约工作台 | 必须保留 |
| `/learning` | `views/rental/LearningReview.vue` | 历史聊天学习审核 | legacy，部分可转话术/知识沉淀 |
| `/pending` | `views/rental/FeishuPending.vue` | 消息审批 | legacy 客服流，待确认 |
| `/reports` | `views/rental/Reports.vue` | 报表中心 | 必须保留 |
| `/inquiries` | `views/rental/InquiryAnalytics.vue` | 询单/订单分析与优化建议 | 优先保留，需渠道化 |
| `/market` | `views/rental/MarketMonitor.vue` | 闲鱼同类帖子价格监控 | legacy / 渠道化候选 |
| `/pricing` | `views/rental/Pricing.vue` | 租赁定价与免押规则 | 必须保留 |
| `/item-mapping` | `views/rental/ItemModelMapping.vue` | 闲鱼 item_id 到业务商品/型号绑定 | legacy 包装后保留为渠道映射候选 |
| `/sf-shipping` | `views/rental/SfShippingWorkbench.vue` | 顺丰寄件 | 必须保留 |
| `/deposits` | `views/rental/DepositManagement.vue` | 免押管理 | 必须保留 |

## 导航分组

来源：`electron/renderer/src/components/AppSidebar.vue`

| 分组 | 页面 | 判断 |
|---|---|---|
| 工作台 | 控制台 | 保留 |
| 订单与履约 | 订单履约、顺丰寄件、免押管理、设备管理、租赁档期、租赁定价 | 新 SaaS 核心 |
| 会话协同 | 人工接管、消息审批、学习审核 | legacy 客服流，部分可转员工 SOP |
| 数据与运营 | 询单分析、商品型号绑定、报表中心、市场监控 | 报表/询单可保留，商品绑定/市场监控需渠道化 |
| 系统设置 | 设置、提示词、知识库 | 配置能力保留，提示词和知识库需弱化自动回复中心 |

## 关键页面判断

### 必须保留 / 优先保留页面

| 页面 | 代码位置 | 保留原因 |
|---|---|---|
| 订单履约 | `electron/renderer/src/views/rental/OrderFulfillment.vue` | 覆盖建单、查档期、订单状态、待发货、待归还、逾期、物流、免押联动 |
| 租赁档期 | `electron/renderer/src/views/rental/ScheduleCalendar.vue` | 覆盖设备甘特图、月度热力、可用性查询、型号档期 |
| 设备管理 | `electron/renderer/src/views/rental/DeviceManagement.vue` | 覆盖型号、单台设备、状态、成本、残值、城市 |
| 顺丰寄件 | `electron/renderer/src/views/rental/SfShippingWorkbench.vue` | 覆盖寄件、寄件记录、运单追踪、批量寄件 |
| 免押管理 | `electron/renderer/src/views/rental/DepositManagement.vue` | 覆盖免押单列表、详情、创建、状态、订单绑定 |
| 租赁定价 | `electron/renderer/src/views/rental/Pricing.vue` | 覆盖阶梯报价、续租日价、免押规则 |
| 报表中心 | `electron/renderer/src/views/rental/Reports.vue` | 覆盖店铺经营、库存、订单趋势、设备资产、费用 |
| 询单分析 | `electron/renderer/src/views/rental/InquiryAnalytics.vue` | 覆盖询单趋势、转化、型号收入、优化建议 |
| 系统设置 | `electron/renderer/src/views/Settings.vue` | 覆盖模型、通知、顺丰、免押、外部依赖等配置 |

### Legacy / 待渠道化页面

| 页面 | 代码位置 | 闲鱼绑定点 | 建议 |
|---|---|---|---|
| 控制台 | `electron/renderer/src/views/Dashboard.vue` | 有“打开闲鱼 IM”、抽取历史学习等入口 | 保留运营控制台，移除闲鱼核心入口感 |
| 人工接管 | `electron/renderer/src/views/rental/TakeoverBoard.vue` | 会话、机器人、自动回复、人工接管 | 可降级为 legacy 客服任务，未来可并入员工待办 |
| 消息审批 | `electron/renderer/src/views/rental/FeishuPending.vue` | AI 草稿审核后发送给买家 | 如果只服务闲鱼聊天，标 legacy；若扩展多渠道可保留 |
| 学习审核 | `electron/renderer/src/views/rental/LearningReview.vue` | 同步浏览器历史、抽取历史聊天、知识候选 | legacy，未来可转知识沉淀/话术优化 |
| 商品业务绑定 | `electron/renderer/src/views/rental/ItemModelMapping.vue` | `item_id`、当前账号帖子审核、同步本地帖子 | 改造成渠道商品映射候选 |
| 市场监控 | `electron/renderer/src/views/rental/MarketMonitor.vue` | 文案明确“追踪闲鱼同类机型帖子” | 可作为渠道市场情报，不应是核心 |
| 提示词编辑 | `electron/renderer/src/views/Prompts.vue` | classify/price/tech/default 自动回复 agent | legacy，未来可转为话术模板 |
| 知识库管理 | `electron/renderer/src/views/KnowledgeBase.vue` | 文案为“机器人命中相似问题优先回复” | 保留知识能力，改变核心定位 |

## 关键组件

### 通用 UI 组件

| 组件 | 代码位置 | 用途 |
|---|---|---|
| `BaseButton.vue` | `electron/renderer/src/components/BaseButton.vue` | 基础按钮 |
| `BaseCard.vue` | `electron/renderer/src/components/BaseCard.vue` | 基础卡片 |
| `BaseBadge.vue` | `electron/renderer/src/components/BaseBadge.vue` | 基础徽标 |
| `StatusBadge.vue` | `electron/renderer/src/components/StatusBadge.vue` | 状态标签 |
| `BaseDrawer.vue` | `electron/renderer/src/components/BaseDrawer.vue` | 抽屉 |
| `BaseDialog.vue` | `electron/renderer/src/components/BaseDialog.vue` | 对话框 |
| `DataTable.vue` | `electron/renderer/src/components/DataTable.vue` | 表格容器 |
| `FilterBar.vue` | `electron/renderer/src/components/FilterBar.vue` | 筛选区 |
| `BatchActionBar.vue` | `electron/renderer/src/components/BatchActionBar.vue` | 批量操作条 |
| `EmptyState.vue` | `electron/renderer/src/components/EmptyState.vue` | 空状态 |
| `Skeleton.vue` | `electron/renderer/src/components/Skeleton.vue` | 骨架屏 |
| `ToastHost.vue` | `electron/renderer/src/components/ToastHost.vue` | Toast |
| `PageHeader.vue` | `electron/renderer/src/components/PageHeader.vue` | 页面标题/操作区 |
| `AppSidebar.vue` | `electron/renderer/src/components/AppSidebar.vue` | 主导航 |
| `AppTopBar.vue` | `electron/renderer/src/components/AppTopBar.vue` | 顶栏 |

### 业务组件

| 组件 | 代码位置 | 用途 |
|---|---|---|
| `RentDateRangePicker.vue` | `electron/renderer/src/components/RentDateRangePicker.vue` | 租期选择 |
| `RentDaysInput.vue` | `electron/renderer/src/components/RentDaysInput.vue` | 租赁天数输入 |
| `CreateDepositDrawer.vue` | `electron/renderer/src/components/CreateDepositDrawer.vue` | 创建免押单抽屉 |
| `PriceConfigCard.vue` | `electron/renderer/src/components/PriceConfigCard.vue` | 定价配置卡 |
| `AddressCard.vue` | `electron/renderer/src/components/AddressCard.vue` | 地址卡 |
| `KpiStrip.vue` | `electron/renderer/src/components/KpiStrip.vue` | KPI 横条 |
| `StatsCard.vue` | `electron/renderer/src/components/StatsCard.vue` | 数据统计卡 |
| `InsightCard.vue` | `electron/renderer/src/components/InsightCard.vue` | 分析建议卡 |
| `LogViewer.vue` | `electron/renderer/src/components/LogViewer.vue` | 日志展示 |
| `BrowserPreviewNotice.vue` | `electron/renderer/src/components/BrowserPreviewNotice.vue` | 普通浏览器无 preload 提示 |
| `SfCreateForm.vue` | `electron/renderer/src/views/rental/sf-shipping/SfCreateForm.vue` | 顺丰寄件创建表单 |
| `SfSummaryPanel.vue` | `electron/renderer/src/views/rental/sf-shipping/SfSummaryPanel.vue` | 顺丰寄件摘要 |
| `SfShipmentRecords.vue` | `electron/renderer/src/views/rental/sf-shipping/SfShipmentRecords.vue` | 顺丰寄件记录 |
| `SfShipmentDetailDrawer.vue` | `electron/renderer/src/views/rental/sf-shipping/SfShipmentDetailDrawer.vue` | 顺丰详情抽屉 |
| `SfBatchShipmentDrawer.vue` | `electron/renderer/src/views/rental/sf-shipping/SfBatchShipmentDrawer.vue` | 批量寄件抽屉 |
| `OrderTable.vue` | `electron/renderer/src/views/rental/order-fulfillment/OrderTable.vue` | 订单表格 |
| `OrderDetailDrawer.vue` | `electron/renderer/src/views/rental/order-fulfillment/OrderDetailDrawer.vue` | 订单详情 |
| `OrderFilters.vue` | `electron/renderer/src/views/rental/order-fulfillment/OrderFilters.vue` | 订单筛选 |

## 页面迁移建议

- 新 SaaS 第一优先级页面：订单履约、租赁档期、设备管理、顺丰寄件、免押管理、租赁定价、报表中心。
- 可渠道化页面：询单分析、商品业务绑定、市场监控、知识库。
- legacy 包装页面：人工接管、消息审批、学习审核、提示词编辑。
- 控制台应保留为运营总览，但后续需把“打开闲鱼 IM”降级为渠道入口，而不是主操作。

