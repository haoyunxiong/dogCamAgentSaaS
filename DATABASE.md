# 数据库说明

## 基本信息

| 项目 | 说明 |
|------|------|
| **数据库引擎** | SQLite 3 |
| **Node 端驱动** | better-sqlite3 |
| **Python 端驱动** | sqlite3 (标准库) |
| **数据库文件名** | `app_config.db` |
| **默认存储路径** | `E:\XianyuAgentData\app_config.db` |
| **备选路径** | `%APPDATA%\XianyuAutoAgent\app_config.db`（E 盘不可用时自动回退） |
| **路径控制** | 环境变量 `XIANYU_DATA_DIR` 可覆盖 |

> 另有独立的聊天记录库 `chat_history.db`，位于同一目录下，由 Python 端管理。

---

## 数据表一览（共 13 张）

| # | 表名 | 用途 | 所属模块 |
|---|------|------|----------|
| 1 | `config` | 系统键值配置 | 基础 |
| 2 | `prompts` | AI 提示词模板 | 基础 |
| 3 | `knowledge` | 知识库问答对 | 智能回复 |
| 4 | `takeover_tasks` | 人工接管任务队列 | 智能回复 |
| 5 | `schedule_units` | 可调度设备单元 | 租赁档期 |
| 6 | `rental_orders` | 租赁订单主表 | 订单管理 |
| 7 | `schedule_blocks` | 档期日历色块 | 租赁档期 |
| 8 | `shipping_records` | 物流发货记录 | 订单履约 |
| 9 | `learning_candidates` | AI 学习候选问答 | 知识进化 |
| 10 | `feishu_pending_replies` | 飞书待确认回复队列 | 消息审批 |
| 11 | `market_snapshots` | 市场监控聚合快照 | 市场监控 |
| 12 | `market_listings` | 市场监控单条帖子 | 市场监控 |
| 13 | `expense_records` | 费用支出记录 | 报表统计 |

---

## 各表详细说明

### 1. `config` — 系统键值配置

存储所有系统配置项（API 密钥、模型地址、通知 Webhook、物流参数等）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | TEXT PK | 配置项名称，如 `API_KEY`、`COOKIES_STR` |
| `value` | TEXT | 配置项值 |
| `updated_at` | DATETIME | 最后更新时间 |

---

### 2. `prompts` — AI 提示词模板

管理不同场景的系统提示词（System Prompt）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | TEXT PK | 提示词名称，如 `system_prompt`、`classify_prompt` |
| `content` | TEXT | 提示词正文 |
| `updated_at` | DATETIME | 最后更新时间 |

---

### 3. `knowledge` — 知识库问答对

FAQ 知识库，支持全局/型号级/商品级三种作用域，配合 FAISS 向量索引实现语义检索。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `item_id` | TEXT | 关联的闲鱼商品 ID（商品级作用域） |
| `scope_type` | TEXT | 作用域：`global` / `model` / `item` |
| `model_code` | TEXT | 型号编码（型号级作用域） |
| `question` | TEXT | 问题 |
| `answer` | TEXT | 标准答案 |
| `tags` | TEXT | 标签（逗号分隔） |
| `source_type` | TEXT | 来源：`manual` / `learned` / `imported` |
| `status` | TEXT | 状态：`approved` / `pending` / `rejected` |
| `confidence_threshold` | REAL | 匹配置信度阈值（默认 0.75） |
| `embedding` | BLOB | 预计算的向量嵌入 |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

**索引**: `idx_knowledge_item_id`, `idx_knowledge_scope`

---

### 4. `takeover_tasks` — 人工接管任务队列

当 AI 无法处理（议价、敏感问题、置信度不足）时，生成人工接管任务并通过飞书通知。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `session_id` | TEXT | 会话 ID |
| `item_id` | TEXT | 商品 ID |
| `model_code` | TEXT | 型号 |
| `latest_question` | TEXT | 最新客户提问 |
| `reason` | TEXT | 接管原因（如 `bargain`、`sensitive`、`faq_miss`） |
| `priority` | TEXT | 优先级：`normal` / `high` / `urgent` |
| `status` | TEXT | 状态：`new` → `accepted` → `closed` / `expired` |
| `notified_at` | DATETIME | 飞书通知发送时间 |
| `accepted_at` | DATETIME | 人工接手时间 |
| `expired_at` | DATETIME | 超时时间 |
| `escalated_at` | DATETIME | 电话升级时间 |
| `assigned_to` | TEXT | 指派给谁 |
| `resolution` | TEXT | 处理结果备注 |
| `created_at` / `updated_at` | DATETIME | 时间戳 |

**索引**: `idx_takeover_status`

---

### 5. `schedule_units` — 可调度设备单元

每台实体设备对应一条记录，是档期日历的行维度。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `model_code` | TEXT | 型号编码（如 `A7M4`） |
| `unit_code` | TEXT UNIQUE | 设备编号（如 `A7M4-01`） |
| `serial_no` | TEXT | 序列号 |
| `city` | TEXT | 设备所在城市 |
| `status` | TEXT | 状态：`idle` / `rented` / `maintenance` |
| `note` | TEXT | 备注 |
| `purchase_cost` | REAL | 采购成本 |
| `created_at` / `updated_at` | DATETIME | 时间戳 |

**索引**: `idx_schedule_units_model`

---

### 6. `rental_orders` — 租赁订单主表

核心业务表，记录每笔租赁订单的完整生命周期。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `session_id` | TEXT | 对应聊天会话 |
| `order_no` | TEXT UNIQUE | 订单号 |
| `model_code` | TEXT | 型号 |
| `unit_id` | INTEGER | 分配的设备 ID → `schedule_units.id` |
| `customer_name` | TEXT | 客户姓名 |
| `customer_phone` | TEXT | 手机号 |
| `province` / `city` / `district` / `address` | TEXT | 收货地址四级 |
| `rent_start_date` | TEXT | 租期开始日 `YYYY-MM-DD` |
| `rent_end_date` | TEXT | 租期结束日 `YYYY-MM-DD` |
| `fee` | REAL | 租金 |
| `deposit` | REAL | 押金 |
| `order_status` | TEXT | 状态流转：`waiting_payment` → `paid` → `shipping` → `active` → `returning` → `completed` / `cancelled` |
| `planned_ship_at` | TEXT | 计划发货时间 |
| `actual_ship_at` | TEXT | 实际发货时间 |
| `expected_arrive_at` | TEXT | 预计送达时间 |
| `tracking_no` | TEXT | 快递单号 |
| `shipping_mode` | TEXT | 物流方式：`land` / `express` / `next_morning` |
| `latest_logistics_status` | TEXT | 最新物流状态文本 |
| `created_at` / `updated_at` | DATETIME | 时间戳 |

**索引**: `idx_orders_status`

---

### 7. `schedule_blocks` — 档期日历色块

在日历视图上为每台设备划定时间占用块，支持四种类型。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `unit_id` | INTEGER | 设备 ID → `schedule_units.id` |
| `order_id` | INTEGER | 订单 ID → `rental_orders.id` |
| `model_code` | TEXT | 型号 |
| `block_type` | TEXT | 类型：`shipping`（发货）/ `rent`（租期）/ `buffer`（归还缓冲）/ `return_shipping`（归还物流） |
| `start_date` | TEXT | 开始日 `YYYY-MM-DD` |
| `end_date` | TEXT | 结束日 `YYYY-MM-DD` |
| `planned_ship_at` | TEXT | 计划发货时间 |
| `expected_arrive_at` | TEXT | 预计到达时间 |
| `status` | TEXT | `active` / `cancelled` |
| `note` | TEXT | 备注 |
| `created_at` / `updated_at` | DATETIME | 时间戳 |

**索引**: `idx_schedule_blocks_model`, `idx_schedule_blocks_unit`

---

### 8. `shipping_records` — 物流发货记录

每次发货/归还对应一条记录，支持物流轨迹追踪。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `order_id` | INTEGER | 订单 ID → `rental_orders.id` |
| `carrier` | TEXT | 承运商，默认 `sf`（顺丰） |
| `tracking_no` | TEXT | 运单号 |
| `shipping_mode` | TEXT | 物流方式 |
| `latest_status` | TEXT | 最新物流状态 |
| `ship_from_city` / `ship_to_city` | TEXT | 始发/目的城市 |
| `planned_ship_at` / `actual_ship_at` | TEXT | 计划/实际发货时间 |
| `expected_arrive_at` / `actual_arrive_at` | TEXT | 预计/实际到达时间 |
| `created_at` / `updated_at` | DATETIME | 时间戳 |

---

### 9. `learning_candidates` — AI 学习候选问答

AI 回答后产生的候选知识条目，等待人工审核后纳入正式知识库。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `session_id` | TEXT | 来源会话 |
| `item_id` | TEXT | 商品 ID |
| `model_code` | TEXT | 型号 |
| `question` | TEXT | 客户问题 |
| `final_answer` | TEXT | AI 最终回复 |
| `source_message_ids` | TEXT | 原始消息 ID（JSON） |
| `candidate_scope` | TEXT | 建议作用域 |
| `tags` | TEXT | 标签 |
| `review_status` | TEXT | `pending` → `approved` / `rejected` |
| `reviewer` | TEXT | 审核人 |
| `created_at` / `reviewed_at` | DATETIME | 时间戳 |

**索引**: `idx_learning_review`

---

### 10. `feishu_pending_replies` — 飞书待确认回复队列

严格知识库模式下，AI 生成的回复草稿需人工在飞书确认后才发送。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `session_id` | TEXT | 会话 ID |
| `item_id` | TEXT | 商品 ID |
| `model_code` | TEXT | 型号 |
| `user_question` | TEXT | 买家提问原文 |
| `ai_draft` | TEXT | AI 生成的草稿回复 |
| `search_result` | TEXT | 知识库检索结果 |
| `reply_type` | TEXT | 类型：`faq_miss` / `functional_search` / `schedule` |
| `status` | TEXT | `pending` → `approved` / `rejected` |
| `final_reply` | TEXT | 最终确认发送的回复 |
| `approved_by` | TEXT | 审批人（`feishu` / `manual`） |
| `feishu_message_id` | TEXT | 飞书消息 ID |
| `created_at` / `resolved_at` / `updated_at` | DATETIME | 时间戳 |

**索引**: `idx_feishu_pending_status`

---

### 11. `market_snapshots` — 市场监控聚合快照

每次市场扫描生成一条快照，包含价格统计摘要。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `model_code` | TEXT | 监控的型号 |
| `snapshot_time` | DATETIME | 快照时间 |
| `total_listings` | INTEGER | 在售帖子总数 |
| `avg_price` | REAL | 平均价格 |
| `min_price` / `max_price` / `median_price` | REAL | 最低/最高/中位数价格 |
| `sold_count` | INTEGER | 已售出数量 |
| `price_band_json` | TEXT | 价格分布 JSON |
| `source` | TEXT | 数据来源，默认 `xianyu` |
| `created_at` | DATETIME | 创建时间 |

**索引**: `idx_market_snapshots_model`

---

### 12. `market_listings` — 市场监控单条帖子

每条扫描到的竞品帖子明细，关联到快照。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `snapshot_id` | INTEGER | 快照 ID → `market_snapshots.id` |
| `model_code` | TEXT | 型号 |
| `listing_id` | TEXT | 闲鱼帖子 ID |
| `title` | TEXT | 帖子标题 |
| `price` | REAL | 标价 |
| `seller_name` | TEXT | 卖家昵称 |
| `location` | TEXT | 卖家所在地 |
| `is_rental` | INTEGER | 是否为出租帖（0/1） |
| `status` | TEXT | `active` / `sold` / `removed` |
| `first_seen_at` / `last_seen_at` | DATETIME | 首次/最后发现时间 |
| `created_at` | DATETIME | 创建时间 |

**索引**: `idx_market_listings_model`

---

### 13. `expense_records` — 费用支出记录

记录各种运营开支（物流费、维修费、包装费等），用于报表利润计算。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 自增主键 |
| `model_code` | TEXT | 型号 |
| `unit_id` | INTEGER | 设备 ID（可选） |
| `expense_type` | TEXT | 类型：`shipping` / `repair` / `packaging` / `other` |
| `amount` | REAL | 金额 |
| `description` | TEXT | 描述 |
| `expense_date` | TEXT | 支出日期 `YYYY-MM-DD` |
| `order_id` | INTEGER | 关联订单（可选） |
| `created_at` | DATETIME | 创建时间 |

**索引**: `idx_expense_model`, `idx_expense_type`

---

## 表关系图（简化）

```
config (独立)
prompts (独立)

knowledge ← learning_candidates (审核通过后导入)

schedule_units ──┬── schedule_blocks (按设备+日期占位)
                 │
rental_orders ───┤── schedule_blocks (按订单生成色块)
                 ├── shipping_records (物流记录)
                 ├── expense_records (关联费用)
                 └── feishu_pending_replies (待确认回复)

takeover_tasks (独立，按 session_id 关联会话)

market_snapshots ── market_listings (快照 → 帖子明细)
```

---

## 补充说明

- 数据库使用 **WAL 模式**（Write-Ahead Logging），支持 Node 和 Python 端并发读写。
- 所有时间字段使用 `YYYY-MM-DD HH:MM:SS` 格式，按本地时区存储。
- `schedule_blocks.block_type` 有 4 种值：`shipping`（发货途中）→ `rent`（租期占用）→ `buffer`（归还缓冲 2 天）/ `return_shipping`（归还物流）。
- 系统每小时自动扫描即将到期的 `active` 订单，将 `buffer` 块替换为 `return_shipping` 块。
