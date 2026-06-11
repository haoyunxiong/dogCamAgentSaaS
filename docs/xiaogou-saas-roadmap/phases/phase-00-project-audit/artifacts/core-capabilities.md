# Phase 00 当前核心能力清单

执行时间：2026-06-12

正式项目目录：`/Users/lishuangshuang/Documents/租赁SAAS系统`

本清单只记录当前项目已有能力和后续迁移判断，不代表已修改实现。

## 分类说明

- `必须保留`：符合“小狗相机助手商户版”的核心租赁运营能力。
- `优先保留`：直接支持经营分析、内部提效或 SaaS 底座，但后续需要梳理边界。
- `legacy 包装后保留`：来源于闲鱼/客服自动化，但可抽象为多渠道、话术、员工 SOP 或运营辅助能力。
- `待确认`：当前价值不确定，需要用户决策。
- `legacy`：只服务旧闲鱼自动回复主链路，短期不删除，但不作为新产品核心。

## 能力总表

| 能力 | 分类 | 页面位置 | 主要代码位置 | 数据位置 | 后续建议 |
|---|---|---|---|---|---|
| 查档期 | 必须保留 | `ScheduleCalendar.vue`, `OrderFulfillment.vue` | `electron/main/dbManager.js`, `python/services/schedule_service.py` | `schedule_units`, `schedule_blocks`, `rental_orders`, `inquiry_events` | 做成独立租赁工作流，不依赖聊天触发 |
| 发档期 / 报档期 / 报价 | 必须保留 | `OrderFulfillment.vue`, `Pricing.vue` | `python/services/quote_service.py`, `python/services/rental_agent_service.py`, `electron/main/rentalOpsRules.js` | `rental_pricing`, `deposit_exemption_rules`, `inquiry_events` | 保留业务能力，去除闲鱼中心化入口 |
| 订单履约 | 必须保留 | `OrderFulfillment.vue` | `electron/main/dbManager.js`, `python/services/order_service.py`, `python/services/booking_service.py` | `rental_orders`, `schedule_blocks`, `shipping_records`, `deposit_orders` | 作为 SaaS 主流程 |
| 免押 / 押金 | 必须保留 | `DepositManagement.vue`, `OrderFulfillment.vue`, `Pricing.vue` | `electron/main/depositClient.js`, `electron/main/depositNotifyServer.js`, `electron/renderer/src/services/depositApiService.js` | `deposit_orders`, `deposit_order_events`, `deposit_exemption_rules` | 与订单、客户、门店归属绑定 |
| 顺丰物流 / 发货 | 必须保留 | `SfShippingWorkbench.vue`, `OrderFulfillment.vue` | `electron/main/sfShippingService.js`, `electron/main/dbManager.js` | `sf_shipments`, `sf_shipment_events`, `shipping_records` | 保留为履约能力 |
| 归还 / 验机 / 完结 | 必须保留 | `OrderFulfillment.vue`, `ScheduleCalendar.vue` | `electron/main/dbManager.js`, `python/services/order_service.py` | `rental_orders`, `schedule_blocks`, `shipping_records`, `deposit_orders` | 已有归还/逾期/完结，验机 SOP 需后续补齐 |
| 设备管理 | 必须保留 | `DeviceManagement.vue` | `electron/main/dbManager.js`, `python/services/rental_repository.py` | `schedule_units` | 扩展 SN、配件、清洁、缺件、维修等状态 |
| 租赁定价 | 必须保留 | `Pricing.vue` | `electron/main/rentalOpsRules.js`, `python/services/pricing_repository.py` | `rental_pricing`, `deposit_exemption_rules` | 作为报价、免押、渠道报价基础 |
| 数据汇总和报表 | 优先保留 | `Reports.vue`, `InquiryAnalytics.vue`, `Dashboard.vue` | `electron/main/dbManager.js`, `python/services/ops_metrics_service.py` | `rental_orders`, `schedule_units`, `expense_records`, `inquiry_events`, `sf_shipments` | 后续按商户/门店/渠道拆维度 |
| 配置能力 | 必须保留 | `Settings.vue` | `electron/main/dbManager.js`, `electron/main/mysqlConfig.js`, `python/config_manager.py` | `config`, `prompts`, 本地 env / connection 文件 | 拆分系统配置、商户配置、渠道配置、敏感配置 |
| 日志与运行状态 | 必须保留 | `Dashboard.vue`, `LogViewer.vue` | `electron/main/index.js`, `python/bridge.py`, 启动脚本 | 日志文件、IPC status、system check | 保留为产品级运行监控 |
| 当前启动流程 | 必须保留 | Electron main / scripts | `electron/scripts/dev-launch.js`, `scripts/start_xianyu_desktop.sh`, `electron/main/index.js`, `electron/main/pythonManager.js` | MySQL、runtime data dir、Python bridge | Phase 00 冻结，不改启动链路 |
| 当前已有有效数据 | 必须保留 | 不适用 | `scripts/mysql_schema.sql`, `data/`, `config/`, MySQL 配置 | MySQL、SQLite 历史库、备份、导入数据 | 后续迁移前必须有备份、迁移、回滚方案 |
| 店铺维度 | 优先保留 | `Reports.vue`, `OrderFulfillment.vue`, `InquiryAnalytics.vue` | `electron/main/dbManager.js` | `stores`, `rental_orders.store_id`, `inquiry_events.store_id` | 是多门店基础，但不是完整多商户隔离 |
| 商品/型号映射 | legacy 包装后保留 | `ItemModelMapping.vue`, `KnowledgeBase.vue` | `electron/main/dbManager.js`, `python/runtime/conversation_processor.py` | `item_model_mapping`, `xianyu_item_listings`, `item_cache` | 抽象为渠道商品到业务型号映射 |
| 知识库 | legacy 包装后保留 | `KnowledgeBase.vue` | `python/knowledge_base/`, `electron/main/dbManager.js` | `knowledge`, `knowledge_index_state` | 从自动回复核心转为运营知识库/话术资料 |
| 人工接管 | legacy 包装后保留 | `TakeoverBoard.vue` | `python/services/takeover_service.py`, `python/services/session_state_service.py` | `takeover_tasks`, `session_reply_state` | 可转员工待办/SOP，先保留不删除 |
| 消息审批 | 待确认 | `FeishuPending.vue` | `python/services/feishu_callback_service.py`, `electron/main/dbManager.js` | `feishu_pending_replies` | 若未来多渠道客服需要，可保留 |
| 学习审核 | legacy 包装后保留 | `LearningReview.vue` | `python/services/learning_service.py`, `python/runtime/conversation_processor.py` | `learning_candidates`, `structured_learning_suggestions` | 可转知识沉淀或话术优化 |
| 市场监控 | 待确认 | `MarketMonitor.vue` | `python/services/market_monitor.py`, `electron/main/dbManager.js` | `market_snapshots`, `market_listings` | 当前闲鱼强绑定，是否保留需确认 |
| 闲管家开放平台 | 待确认 | `Settings.vue`, preload, IPC | `electron/main/xianguanjiaClient.js`, `electron/main/ipcHandlers.js` | `config` 中 XGJ 相关 key | 可作为渠道集成，不应作为主架构 |
| 自动回复 Agent | legacy | `Prompts.vue`, bot start/stop | `python/XianyuAgent.py`, `python/main.py`, `python/runtime/conversation_processor.py` | `prompts`, `messages`, `session_reply_state` | 不删除；未来最多转客户沟通辅助 |

## 用户指定必须保留能力落点

### 1. 查档期能力

- 页面：`ScheduleCalendar.vue`、`OrderFulfillment.vue`
- IPC：`schedule:availability`、`schedule:blocks:list`、`schedule:monthlyOverview`、`schedule:units:list`
- 数据：`schedule_units`、`schedule_blocks`、`rental_orders`
- 判断：必须保留，未来应支持员工主动查档期、客户报价、接单判断。

### 2. 发档期 / 报档期能力

- 现有落点：`RentalAgentService.handle_pre_reply()`、`QuoteService`、`Pricing.vue`
- 判断：业务能力必须保留，但不能继续强绑定闲鱼消息流。

### 3. 订单履约能力

- 页面：`OrderFulfillment.vue`
- 能力：建单、查看、更新、删除、批量发货、批量归还、延期、物流查询、免押联动。
- 数据：`rental_orders`、`schedule_blocks`、`shipping_records`、`deposit_orders`
- 判断：必须保留，是后续 SaaS 主干。

### 4. 免押 / 押金能力

- 页面：`DepositManagement.vue`、`OrderFulfillment.vue`、`Pricing.vue`
- 数据：`deposit_orders`、`deposit_order_events`、`deposit_exemption_rules`
- 判断：必须保留，需要与订单、客户、门店、渠道解耦建模。

### 5. 物流 / 发货能力

- 页面：`SfShippingWorkbench.vue`、`OrderFulfillment.vue`
- 数据：`sf_shipments`、`sf_shipment_events`、`shipping_records`
- 判断：必须保留，后续作为履约工作台的一部分。

### 6. 归还 / 验机 / 完结能力

- 页面：`OrderFulfillment.vue`
- 现状：已有待归还、逾期、完结、批量归还、联动完结免押等能力；验机记录未形成独立模型。
- 判断：必须保留，验机/清洁/缺件/维修 SOP 后续补齐。

### 7. 设备管理能力

- 页面：`DeviceManagement.vue`
- 数据：`schedule_units`
- 判断：必须保留；设备编号、SN、配件、状态扩展是后续核心。

### 8. 数据汇总和报表能力

- 页面：`Reports.vue`、`InquiryAnalytics.vue`、`Dashboard.vue`
- 数据：订单、设备、费用、询单、顺丰费用。
- 判断：优先保留，后续按商户经营分析重组。

### 9. 配置能力

- 页面：`Settings.vue`
- 数据：`config`、`prompts`、本地连接配置。
- 判断：必须保留；后续拆分系统配置、商户配置、API 配置、物流配置。

### 10. 日志与运行状态

- 页面：`Dashboard.vue`、`LogViewer.vue`
- 数据：日志文件、bot status、system check。
- 判断：必须保留，尤其用于 Electron + Python 桥接诊断。

### 11. 当前可用启动流程

- 路径：`electron/scripts/dev-launch.js`、`scripts/start_xianyu_desktop.sh`、`electron/main/index.js`、`electron/main/pythonManager.js`
- 判断：必须保留，Phase 00 只冻结盘点，不调整启动。

### 12. 当前已有有效数据

- 路径：`data/`、`config/`、MySQL 连接配置、历史 SQLite 路径。
- 判断：必须保护；任何迁移前必须先做备份、迁移、回滚、验证方案。
