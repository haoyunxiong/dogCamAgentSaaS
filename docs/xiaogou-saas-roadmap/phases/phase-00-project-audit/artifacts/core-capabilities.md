# Phase 00 当前核心能力清单

执行时间：2026-06-11

## 分类说明

- `必须保留`：符合新产品“小狗相机助手商户版”的核心业务能力。
- `优先保留`：直接支持租赁运营或经营分析，但后续可能需要重命名/重构。
- `legacy 包装后保留`：来源于闲鱼/客服自动化，但可转成多渠道、话术、SOP、运营辅助能力。
- `待确认`：价值存在但产品归属不清，需要用户决策。

## 能力总表

| 能力 | 分类 | 页面位置 | 主要代码位置 | 数据位置 | 后续建议 |
|---|---|---|---|---|---|
| 查档期 | 必须保留 | `ScheduleCalendar.vue`, `OrderFulfillment.vue` | `electron/main/dbManager.js`, `python/services/schedule_service.py` | `schedule_units`, `schedule_blocks`, `rental_orders`, `inquiry_events` | 保留并做成独立租赁工作流 |
| 发档期 / 报档期 / 报价 | 必须保留 | `OrderFulfillment.vue`, `Pricing.vue` | `python/services/quote_service.py`, `python/services/rental_agent_service.py`, `electron/main/rentalOpsRules.js` | `rental_pricing`, `deposit_exemption_rules`, `inquiry_events` | 去闲鱼化，变成客户沟通辅助 |
| 订单履约 | 必须保留 | `OrderFulfillment.vue` | `electron/main/dbManager.js`, `python/services/order_service.py`, `python/services/booking_service.py` | `rental_orders`, `schedule_blocks`, `shipping_records`, `deposit_orders` | 作为 SaaS 核心主流程 |
| 免押 / 押金 | 必须保留 | `DepositManagement.vue`, `OrderFulfillment.vue`, `Pricing.vue` | `electron/main/depositClient.js`, `electron/main/depositNotifyServer.js`, `electron/main/dbManager.js`, `electron/renderer/src/services/depositApiService.js` | `deposit_orders`, `deposit_order_events`, `deposit_exemption_rules`, `rental_orders.deposit` | 保留并与订单强关联 |
| 顺丰物流 / 发货 | 必须保留 | `SfShippingWorkbench.vue`, `OrderFulfillment.vue` | `electron/main/sfShippingService.js`, `electron/main/dbManager.js` | `sf_shipments`, `sf_shipment_events`, `shipping_records`, `rental_orders` | 保留为履约能力 |
| 归还 / 验机 / 完结 | 必须保留 | `OrderFulfillment.vue`, `ScheduleCalendar.vue` | `electron/main/dbManager.js`, `python/services/order_service.py` | `rental_orders`, `schedule_blocks`, `shipping_records`, `deposit_orders` | 后续补足验机记录和 SOP |
| 设备管理 | 必须保留 | `DeviceManagement.vue` | `electron/main/dbManager.js`, `python/services/rental_repository.py` | `schedule_units` | 保留，并扩展配件/清洁/缺件状态 |
| 租赁定价 | 必须保留 | `Pricing.vue` | `electron/main/rentalOpsRules.js`, `python/services/pricing_repository.py` | `rental_pricing`, `deposit_exemption_rules` | 保留，作为报价和免押规则基础 |
| 报表中心 | 优先保留 | `Reports.vue`, `InquiryAnalytics.vue` | `electron/main/dbManager.js`, `python/services/ops_metrics_service.py` | `rental_orders`, `schedule_units`, `expense_records`, `inquiry_events`, `sf_shipments` | 保留，后续按商户/门店拆分 |
| 配置能力 | 必须保留 | `Settings.vue` | `electron/main/dbManager.js`, `python/config_manager.py`, `electron/main/mysqlConfig.js` | `config`, `prompts` | 保留，但拆分系统/商户/渠道配置 |
| 日志与运行状态 | 必须保留 | `Dashboard.vue`, `LogViewer.vue`, 启动脚本日志 | `electron/main/index.js`, `python/bridge.py`, `scripts/start_xianyu_desktop.sh` | `data/logs`, `data/local/logs`, IPC status | 保留并改成产品级运行监控 |
| 当前启动流程 | 必须保留 | 启动脚本 / Electron main | `electron/scripts/dev-launch.js`, `scripts/start_xianyu_desktop.sh`, `electron/main/index.js`, `electron/main/pythonManager.js` | MySQL、runtime data dir、Python bridge | 任何后续改动必须同步 launcher |
| 现有有效数据 | 必须保留 | 不适用 | `scripts/mysql_schema.sql`, `data/db-backups`, `data/local/db-backups` | MySQL、备份快照、导入文件、聊天历史 | 后续迁移必须有备份/回滚 |
| 店铺维度 | 优先保留 | `Reports.vue`, `OrderFulfillment.vue`, `InquiryAnalytics.vue` | `electron/main/dbManager.js` | `stores`, `rental_orders.store_id`, `inquiry_events.store_id` | 是未来 SaaS 多门店/多商户基础，但目前不是完整商户隔离 |
| 商品/型号映射 | legacy 包装后保留 | `ItemModelMapping.vue`, `KnowledgeBase.vue` | `electron/main/dbManager.js`, `python/runtime/conversation_processor.py`, `python/services/rental_repository.py` | `item_model_mapping`, `xianyu_item_listings`, `item_cache`, `knowledge` | 抽象为 channel item 映射 |
| 知识库 | legacy 包装后保留 | `KnowledgeBase.vue` | `python/knowledge_base/`, `electron/main/dbManager.js` | `knowledge`, `knowledge_index_state` | 从自动回复核心降级为运营知识库/话术资料 |
| 人工接管 | legacy 包装后保留 | `TakeoverBoard.vue` | `python/services/takeover_service.py`, `python/services/session_state_service.py` | `takeover_tasks`, `session_reply_state` | 可转为员工待办/SOP，但别作为闲鱼核心 |
| 消息审批 | 待确认 | `FeishuPending.vue` | `python/services/feishu_callback_service.py`, `electron/main/dbManager.js` | `feishu_pending_replies` | 如果未来多渠道客服保留，否则降级 legacy |
| 学习审核 | legacy 包装后保留 | `LearningReview.vue` | `python/services/learning_service.py`, `python/runtime/conversation_processor.py` | `learning_candidates`, `structured_learning_suggestions`, `knowledge` | 转成知识沉淀或话术优化 |
| 市场监控 | 待确认 | `MarketMonitor.vue` | `python/services/market_monitor.py`, `electron/main/dbManager.js` | `market_snapshots`, `market_listings` | 当前闲鱼强绑定，可作为外部行情工具 |
| 闲管家开放平台 | 待确认 | Settings / preload / IPC | `electron/main/xianguanjiaClient.js`, `electron/main/ipcHandlers.js` | `config` 中 XGJ 相关 key | 可作为渠道集成，不应作为产品主架构 |
| 自动回复 Agent | legacy | `Prompts.vue`, bot start/stop | `python/XianyuAgent.py`, `python/main.py`, `python/runtime/conversation_processor.py` | `prompts`, `messages`, `session_reply_state` | 不删除；未来可转客户沟通辅助/话术助手 |

## 用户指定必须保留能力落点

### 1. 查档期能力

- 页面：`ScheduleCalendar.vue`、`OrderFulfillment.vue`
- IPC：`schedule:availability`, `schedule:blocks:list`, `schedule:monthlyOverview`, `schedule:units:list`
- 数据：`schedule_units`, `schedule_blocks`, `rental_orders`
- 判断：必须保留，未来应从“聊天触发查档期”扩展为“员工主动查档期/报价”。

### 2. 发档期 / 报档期能力

- 现有落点：`RentalAgentService.handle_pre_reply()` 中按档期关键词查可用性并生成回复；`QuoteService` 可生成结构化报价。
- 判断：业务能力必须保留，但不应强绑定闲鱼消息流。

### 3. 订单履约能力

- 页面：`OrderFulfillment.vue`
- 能力：建单、查看、更新、删除、批量发货、批量归还、延期、物流查询、免押联动。
- 数据：`rental_orders`, `schedule_blocks`, `shipping_records`, `deposit_orders`
- 判断：必须保留，Phase 04 核心重构候选。

### 4. 免押 / 押金相关能力

- 页面：`DepositManagement.vue`, `OrderFulfillment.vue`, `Pricing.vue`
- 数据：`deposit_orders`, `deposit_order_events`, `deposit_exemption_rules`
- 判断：必须保留。

### 5. 物流 / 发货能力

- 页面：`SfShippingWorkbench.vue`, `OrderFulfillment.vue`
- 数据：`sf_shipments`, `sf_shipment_events`, `shipping_records`
- 判断：必须保留。

### 6. 归还 / 验机 / 完结能力

- 页面：`OrderFulfillment.vue`
- 现状：已有待归还、逾期、完结、批量归还、联动完结免押等能力；验机记录未形成独立数据模型。
- 判断：必须保留；验机/SOP 后续补。

### 7. 设备管理能力

- 页面：`DeviceManagement.vue`
- 数据：`schedule_units`
- 判断：必须保留；配件、SN、清洁、缺件等状态需要后续扩展。

### 8. 数据汇总和报表能力

- 页面：`Reports.vue`, `InquiryAnalytics.vue`, `Dashboard.vue`
- 数据：订单、设备、费用、询单、顺丰费用。
- 判断：优先保留。

### 9. 配置能力

- 页面：`Settings.vue`
- 数据：`config`, `prompts`
- 判断：必须保留；后续拆商户配置、系统配置、渠道配置。

### 10. 日志与运行状态

- 页面：`Dashboard.vue`, `LogViewer.vue`
- 数据：日志文件、bot status、system check。
- 判断：必须保留。

### 11. 当前可用启动流程

- 路径：`electron/scripts/dev-launch.js`, `scripts/start_xianyu_desktop.sh`, `electron/main/index.js`, `electron/main/pythonManager.js`
- 判断：必须保留，Phase 00 不触碰。

### 12. 当前已有有效数据

- 路径：`data/db-backups/`, `data/local/db-backups/`, `data/imports/`, MySQL 连接配置。
- 判断：必须保护；任何迁移前必须有备份、迁移、回滚、验证方案。

