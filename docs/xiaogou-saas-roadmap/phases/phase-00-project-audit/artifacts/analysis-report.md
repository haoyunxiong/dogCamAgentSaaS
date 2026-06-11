# Phase 00 项目盘点总报告

执行时间：2026-06-11

## 阶段目标

Phase 00：当前项目盘点与旧逻辑冻结。

本阶段只盘点当前项目，不修改业务代码；识别现有功能、路由页面、组件结构、核心能力、legacy 闲鱼强绑定逻辑和风险点，并准备 Phase 00 artifacts。

## 本次产物

- [current-structure.md](./current-structure.md)：当前目录、Electron、Vue、Python、scripts、data、docs 结构说明。
- [routes-pages-components.md](./routes-pages-components.md)：当前路由、页面、导航分组、关键组件和页面迁移判断。
- [core-capabilities.md](./core-capabilities.md)：现有可保留业务能力及对应代码/数据位置。
- [legacy-xianyu-bindings.md](./legacy-xianyu-bindings.md)：闲鱼强绑定模块、字段、页面、文案、配置和接口。
- [data-model-audit.md](./data-model-audit.md)：数据库、配置、表、DAO、storage、数据访问位置和多商户字段判断。
- [risk-list.md](./risk-list.md)：业务耦合、数据库、启动、历史功能、UI、命名风险。
- [keep-function-list.md](./keep-function-list.md)：必须保留功能清单。
- [discard-or-legacy-list.md](./discard-or-legacy-list.md)：可舍弃/可降级/legacy 功能清单。
- [questions-to-user.md](./questions-to-user.md)：需要用户确认的问题。
- [phase-00-verification.md](./phase-00-verification.md)：执行前后状态与验收核对。

## 当前项目总体判断

当前项目已经不是单一闲鱼自动回复 bot。它是一个已有可运行的 Electron 桌面应用，已经包含租赁商户运营系统的多项核心能力：

- 订单履约
- 租赁档期
- 设备管理
- 顺丰寄件
- 免押管理
- 租赁定价
- 报表中心
- 询单分析
- 配置、日志、启动、备份

同时，系统仍保留大量闲鱼自动回复时代的核心结构：

- 闲鱼 WebSocket / cookies / token
- Python `XianyuLive` / `XianyuApis` / `XianyuAgent`
- classify/price/tech/default 自动回复 agent
- 浏览器模式闲鱼 IM 扫描
- `item_id`, `chat_id`, `session_id` 等渠道字段
- `xianyu_agent` 数据库名和 `XIANYU_*` 配置命名
- 人工接管、消息审批、学习审核等客服消息流页面

## 当前核心能力

### 必须保留

- 查档期：`ScheduleCalendar.vue`, `OrderFulfillment.vue`, `schedule_units`, `schedule_blocks`
- 发档期/报价：`Pricing.vue`, `QuoteService`, `RentalAgentService`, `rental_pricing`
- 订单履约：`OrderFulfillment.vue`, `rental_orders`
- 免押/押金：`DepositManagement.vue`, `deposit_orders`, `deposit_exemption_rules`
- 顺丰物流：`SfShippingWorkbench.vue`, `sf_shipments`, `shipping_records`
- 归还/完结：`OrderFulfillment.vue`, `rental_orders`, `schedule_blocks`
- 设备管理：`DeviceManagement.vue`, `schedule_units`
- 报表统计：`Reports.vue`, `InquiryAnalytics.vue`
- 配置、日志、启动流程、现有数据

### Legacy 包装后可保留

- 知识库：转为运营知识库/话术资料。
- 商品业务绑定：从闲鱼 `item_id` 映射改造成渠道商品映射。
- 人工接管：从闲鱼客服任务改造成员工待办/SOP 候选。
- 学习审核：从历史聊天抽取改造成知识沉淀候选。
- 自动回复 agent：不作为主产品核心，可作为客户沟通辅助。

### 待确认

- 市场监控是否继续保留为行情工具。
- 闲管家开放平台是否仍是实际业务渠道。
- 消息审批是否发展为多渠道客服审批。
- 浏览器只读采集是否仍保留。

## 数据模型结论

当前代码现实：

- Electron 主业务数据主要通过 MySQL。
- Python 业务服务也通过 MySQL wrapper。
- Python 聊天历史仍保留 SQLite `chat_history.db` 逻辑。
- `DATABASE.md` 仍描述 SQLite `app_config.db` 为主库，已经落后。

当前已有 `stores`、`rental_orders.store_id`、`inquiry_events.store_id`、`source_channel` 等多门店/多来源雏形，但没有完整 `merchant_id` 和 SaaS 级数据隔离。

## Legacy 冻结原则

本阶段不删除任何 legacy 功能。

处理原则：

- 来自闲鱼但本质是租赁业务能力：保留，但需要去闲鱼化。
- 只服务闲鱼平台：标记 legacy。
- 未来可多渠道复用：标记渠道化改造候选。
- 无法判断：写入 `questions-to-user.md`。

## Phase 00 验收条件

| 验收项 | 当前状态 |
|---|---|
| 项目结构说明完成 | 已完成，见 `current-structure.md` |
| 保留功能清单完成 | 已完成，见 `keep-function-list.md` |
| 废弃/legacy 功能清单完成 | 已完成，见 `discard-or-legacy-list.md` 和 `legacy-xianyu-bindings.md` |
| AGENTS.md 生效 | 已生效，本次先读取真源并仅写 artifacts |
| 无业务代码改动 | 已按执行记录确认；当前目录非 Git 仓库，无法用 Git diff 证明，见 `phase-00-verification.md` |
| 必要结果写入 artifacts | 已写入 |
| 用户确认验收结果 | 待用户确认 |

## 是否建议进入 Phase 01

建议：可以准备 Phase 00 验收，但不自动进入 Phase 01。

进入 Phase 01 前建议用户先确认：

1. `questions-to-user.md` 中的关键业务问题。
2. 哪些 legacy 页面在 Phase 01 导航中隐藏、降级或保留入口。
3. 当前数据库现实是否以 MySQL 为准。
4. 是否接受“先固定产品定位/导航/模块，不改底层业务逻辑”的 Phase 01 执行方式。
