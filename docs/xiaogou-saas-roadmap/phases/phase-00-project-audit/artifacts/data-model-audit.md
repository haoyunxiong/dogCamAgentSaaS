# Phase 00 数据模型与存储位置初步盘点

执行时间：2026-06-12

本文件只做只读盘点，不修改 schema，不执行数据库连接、迁移或备份。

## 结论摘要

当前项目数据层存在“旧文档描述 SQLite、代码现实 MySQL + 少量 SQLite 历史数据”的不一致。

- Electron 主业务数据：主要通过 `electron/main/mysqlAdapter.js` 访问 MySQL。
- Python 主业务数据：通过 `python/mysql_helper.py` 访问 MySQL，并提供 sqlite-like wrapper。
- Python 聊天历史/上下文：仍有 `chat_history.db` / `context_manager.py` 相关 SQLite 逻辑。
- `DATABASE.md` 仍描述 `app_config.db` SQLite 为主库，已经落后于当前代码现实。
- 当前 schema 和补列逻辑分散在 `scripts/mysql_schema.sql`、`electron/main/dbManager.js`、Python repository 中。

## 数据访问入口

| 位置 | 当前作用 | 风险 |
|---|---|---|
| `electron/main/dbManager.js` | Electron 主进程 DAO / service 聚合 | 文件很大，业务、schema 补列、默认数据混合 |
| `electron/main/mysqlAdapter.js` | MySQL 连接池和 `get/all/run/exec/transaction` | 采用 async，但注释仍沿用 sqlite-like 语义 |
| `electron/main/mysqlConfig.js` | MySQL 配置加载 | 默认库名 `xianyu_agent`，变量 `XIANYU_MYSQL_*` |
| `scripts/mysql_schema.sql` | MySQL schema 定义 | 当前 schema 真源之一 |
| `python/mysql_helper.py` | Python MySQL 连接和 sqlite-like wrapper | 支撑 Python 服务访问 MySQL |
| `python/config_manager.py` | Python 配置管理 | 命名和库名 legacy |
| `python/context_manager.py` | 聊天历史、商品缓存、上下文 | 混用 MySQL item cache 和 SQLite chat history |
| `python/services/rental_repository.py` | Python 租赁服务 repository | MySQL 业务表 + 历史聊天上下文 |
| `DATABASE.md` | 旧数据库说明 | 与当前代码现实不一致 |

## 当前主要表

来源：`scripts/mysql_schema.sql`、`electron/main/dbManager.js`。

| 表 | 当前用途 | SaaS 迁移判断 |
|---|---|---|
| `config` | 系统键值配置 | 未来需拆系统配置 / 商户配置 / 渠道配置 |
| `prompts` | 自动回复提示词 | legacy，可转话术模板 |
| `knowledge` | 知识库问答 | 可保留，需从闲鱼 item 绑定中解耦 |
| `item_model_mapping` | `item_id` 到业务商品/型号映射 | 渠道化候选 |
| `xianyu_item_listings` | 闲鱼帖子缓存审核 | legacy |
| `deposit_orders` | 免押订单本地缓存/关联 | 必须保留，未来需商户/门店维度 |
| `deposit_order_events` | 免押状态事件 | 必须保留，未来需商户/门店维度 |
| `item_cache` | 商品详情缓存 | 渠道化候选 |
| `rental_pricing` | 租赁阶梯报价 | 必须保留，未来需商户/门店维度 |
| `deposit_exemption_rules` | 免押规则 | 必须保留，未来需商户/门店维度 |
| `booking_drafts` | 建单草稿状态机 | 可保留，需去消息流强绑定 |
| `takeover_tasks` | 人工接管任务 | legacy 包装后可转员工待办 |
| `schedule_units` | 设备单元 | 必须保留，未来需商户/门店维度 |
| `rental_orders` | 租赁订单主表 | 必须保留，未来需商户/门店维度 |
| `inquiry_events` | 询单/档期/报价/转化事件 | 优先保留，需渠道化和商户维度 |
| `schedule_blocks` | 档期占用块 | 必须保留，未来需商户/门店维度 |
| `shipping_records` | 物流记录 | 必须保留，未来需商户/门店维度 |
| `sf_shipments` | 顺丰寄件单 | 必须保留，未来需商户/门店维度 |
| `sf_shipment_events` | 顺丰事件 | 必须保留，未来需商户/门店维度 |
| `learning_candidates` | 学习候选 | legacy 包装后可保留 |
| `structured_learning_suggestions` | 结构化学习建议 | 可转话术/运营建议 |
| `feishu_pending_replies` | 飞书待确认回复 | 待确认 |
| `market_snapshots` | 市场监控快照 | 闲鱼渠道化候选 |
| `market_listings` | 市场帖子明细 | 闲鱼渠道化候选 |
| `expense_records` | 费用记录 | 必须保留，未来需商户/门店维度 |
| `session_reply_state` | 会话自动回复状态机 | legacy |
| `stores` | 店铺列表 | SaaS 底座候选，但不是完整商户隔离 |
| `knowledge_index_state` | 知识库索引状态 | 可保留 |

## 已有多门店/多来源迹象

| 字段/表 | 现状 | 判断 |
|---|---|---|
| `stores` | `dbManager.js` 会确保默认店铺 | 有门店雏形 |
| `rental_orders.store_id` | 启动时 ensureColumn，空值回填默认店铺 | 有门店归属，但非完整商户隔离 |
| `inquiry_events.store_id` | 询单分析支持店铺过滤 | 有门店维度 |
| `rental_orders.source_channel` | 订单来源字段 | 渠道化基础 |
| `rental_orders.source_name` | 来源名称/账号备注 | 渠道化基础 |
| `deposit_orders.source_type/source_order_id/source_order_no` | 免押和来源订单关联 | 可保留 |

## 未来需要 `merchant_id` / `store_id` 的数据

### 优先需要 `merchant_id`

以下表未来外部商户 SaaS 化时应具备商户隔离：

- `config`
- `prompts`
- `knowledge`
- `stores`
- `schedule_units`
- `rental_orders`
- `schedule_blocks`
- `shipping_records`
- `sf_shipments`
- `sf_shipment_events`
- `deposit_orders`
- `deposit_order_events`
- `rental_pricing`
- `deposit_exemption_rules`
- `expense_records`
- `inquiry_events`
- `item_model_mapping`
- `item_cache`

### 优先需要 `store_id`

以下表和门店经营强相关：

- `rental_orders`
- `schedule_units`
- `schedule_blocks`
- `shipping_records`
- `sf_shipments`
- `deposit_orders`
- `expense_records`
- `inquiry_events`
- `rental_pricing`
- `deposit_exemption_rules`

### 渠道维度候选字段

以下字段未来不应只表达闲鱼语义：

- `item_id` -> `channel_item_id` 或 `source_item_id`
- `chat_id` -> `channel_conversation_id`
- `session_id` -> 区分 `channel_session_id` / `internal_session_id`
- `account_id` -> `channel_account_id`
- `source_channel` -> 保留并标准化枚举：Manual / Xianyu / Xiaohongshu / Douyin / Private domain / Merchant collaboration / Other

## 当前 schema 风险

- `dbManager.js` 启动时仍执行 `ensureColumn`、`CREATE TABLE IF NOT EXISTS` 和部分 `ALTER TABLE`，schema 变化分散在运行代码里。
- `scripts/mysql_schema.sql` 和 `dbManager.js` 中的建表/补列逻辑可能不是完全同步。
- `DATABASE.md` 仍写 SQLite 主库，可能误导后续执行者。
- 库名、环境变量、备份文件名仍带 `xianyu`，未来重命名不能直接改，必须迁移。
- Python 侧仍存在 SQLite 聊天历史，不能简单认为全部数据都在 MySQL。
- 当前没有完整 `merchant_id`，不能直接对外多商户使用。

## Phase 00 禁止事项确认

本次未执行：

- 数据库连接
- SQL 查询
- schema 修改
- 迁移脚本
- 备份脚本
- 数据删除
