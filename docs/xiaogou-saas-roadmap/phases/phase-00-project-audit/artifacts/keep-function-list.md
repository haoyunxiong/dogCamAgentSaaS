# Phase 00 必须保留功能清单

执行时间：2026-06-11

说明：保留的是业务能力，不代表必须保留旧实现方式、旧命名或旧页面结构。

| 功能 | 保留级别 | 原因 | 当前代码位置 | 当前数据位置 | 后续迁移建议 |
|---|---|---|---|---|---|
| 查档期 | 必须保留 | 租赁业务接单前核心判断 | `ScheduleCalendar.vue`, `OrderFulfillment.vue`, `dbManager.js`, `ScheduleService` | `schedule_units`, `schedule_blocks`, `rental_orders` | 做成独立业务服务和员工常用入口 |
| 发档期 / 报档期 / 报价 | 必须保留 | 客户沟通和接单转化关键能力 | `RentalAgentService`, `QuoteService`, `Pricing.vue`, `rentalOpsRules.js` | `rental_pricing`, `deposit_exemption_rules`, `inquiry_events` | 去闲鱼化，变成报价/客户沟通辅助 |
| 创建/查看/流转订单 | 必须保留 | 履约主流程 | `OrderFulfillment.vue`, `dbManager.js`, `OrderService` | `rental_orders` | Phase 04 标准化状态机 |
| 待发货/进行中/待归还/逾期/完结 | 必须保留 | 日常运营待办核心 | `OrderFulfillment.vue`, `orderFulfillmentUtils.js`, `dbManager.js` | `rental_orders`, `schedule_blocks` | 后续并入任务中心/SOP |
| 免押创建/查询/状态跟进 | 必须保留 | 租赁风控和客户转化核心 | `DepositManagement.vue`, `CreateDepositDrawer.vue`, `depositClient.js`, `depositApiService.js` | `deposit_orders`, `deposit_order_events` | 与订单统一关联 |
| 押金/免押规则 | 必须保留 | 报价和风控依据 | `Pricing.vue`, `rentalOpsRules.js` | `deposit_exemption_rules`, `rental_pricing` | 商户级配置化 |
| 顺丰发货 | 必须保留 | 履约效率关键 | `SfShippingWorkbench.vue`, `sfShippingService.js`, `dbManager.js` | `sf_shipments`, `shipping_records` | 标准发货工作流 |
| 运单信息/物流追踪 | 必须保留 | 发货状态和售后依据 | `SfShippingWorkbench.vue`, `OrderFulfillment.vue`, `sfShippingService.js` | `sf_shipments`, `sf_shipment_events`, `shipping_records` | 与订单详情统一展示 |
| 归还/完结 | 必须保留 | 设备回收和订单闭环 | `OrderFulfillment.vue`, `dbManager.js` | `rental_orders`, `schedule_blocks`, `deposit_orders` | 后续补验机记录 |
| 设备型号/单台设备 | 必须保留 | 档期和资产管理基础 | `DeviceManagement.vue`, `dbManager.js` | `schedule_units` | 后续增加配件、SN、清洁、缺件状态 |
| 设备状态 | 必须保留 | 可租/在租/维修/停用等运营状态 | `DeviceManagement.vue`, `ScheduleCalendar.vue` | `schedule_units.status` | 标准化状态枚举 |
| 订单/档期/设备报表 | 必须保留 | 经营分析基础 | `Reports.vue`, `InquiryAnalytics.vue`, `Dashboard.vue`, `OpsMetricsService` | `rental_orders`, `schedule_units`, `inquiry_events`, `expense_records` | Phase 06 深化 |
| 费用/顺丰运费统计 | 优先保留 | ROI 和成本分析基础 | `Reports.vue`, `dbManager.js`, `SfShippingWorkbench.vue` | `expense_records`, `sf_shipments` | 统一财务口径 |
| 系统配置 | 必须保留 | 应用可运行基础 | `Settings.vue`, `configStore.js`, `dbManager.js`, `config_manager.py` | `config` | 拆系统/商户/渠道配置 |
| API / 物流 / 免押配置 | 必须保留 | 外部依赖运行基础 | `Settings.vue`, `sfShippingService.js`, `depositClient.js`, `mysqlConfig.js` | `config`, env files | 配置项分域管理 |
| 日志与运行状态 | 必须保留 | 运维和排障基础 | `Dashboard.vue`, `LogViewer.vue`, `python/bridge.py`, startup scripts | `data/logs`, IPC events | 后续形成系统健康检查页 |
| 当前启动流程 | 必须保留 | 当前工作产品可运行基础 | `electron/scripts/dev-launch.js`, `scripts/start_xianyu_desktop.sh`, `electron/main/index.js`, `pythonManager.js` | runtime data dir, MySQL, Python bridge | 不破坏，后续改名需同步 launcher |
| 当前已有有效数据 | 必须保留 | 业务连续性底线 | `data/db-backups`, `data/local/db-backups`, `scripts/mysql_schema.sql` | MySQL、备份、导入文件、SQLite chat history | 迁移前做备份/回滚/验证 |
| 店铺经营拆分 | 优先保留 | 未来门店/多商户基础 | `Reports.vue`, `OrderFulfillment.vue`, `dbManager.js` | `stores`, `rental_orders.store_id` | Phase 03 再扩成商户隔离 |
| 商品/型号绑定 | legacy 包装后保留 | 闲鱼商品到业务型号的映射有迁移价值 | `ItemModelMapping.vue`, `item_model_mapping` 相关 DAO | `item_model_mapping`, `xianyu_item_listings`, `item_cache` | 抽象为渠道商品映射 |
| 知识库 | legacy 包装后保留 | 可沉淀员工话术和产品知识 | `KnowledgeBase.vue`, `python/knowledge_base/` | `knowledge`, `knowledge_index_state` | 改为运营知识库，不以自动回复为核心 |

