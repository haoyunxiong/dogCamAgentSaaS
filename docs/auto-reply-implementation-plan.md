# 自动回复系统改造 · 落地开发计划

> 本文档是 [auto-reply-flow-and-roadmap.md](auto-reply-flow-and-roadmap.md) 的执行版。
> 目的是把 P1/P2/P3 拆成**可独立交付的迭代**，每个迭代都有：改动文件、接口、数据结构、验收标准、回滚方式。
>
> 核心原则（贯穿始终）：
> - **不破坏现有链路**：所有新决策层都加在 `ConversationProcessor` 已有分支之前或之后，旧行为在关闭开关时完全保留。
> - **开关优先**：每个新能力都先以 `config` 表里的一个 key 控制，默认关闭，灰度打开。
> - **可观测**：每个新分支落日志 + 落 `takeover_tasks.reason`，方便复盘。
> - **人工兜底**：任何新判断失败都 fallback 到现状（转人工 / 不回复），不产生新的乱回复风险。

---

## 0. 总体里程碑

| 里程碑 | 目标 | 预计迭代 | 依赖 |
|-------|------|---------|------|
| M1 | 决策分流层（Intent Router） | Sprint 1 | 无 |
| M2 | 知识库命中升级（阈值 + 分类 + 型号绑定） | Sprint 2 | M1 |
| M3 | 报价/档期/物流结构化服务（Quote Service） | Sprint 3–4 | M1、`schedule_service` |
| M4 | 建单草稿状态机（Booking FSM） | Sprint 5 | M3 |
| M5 | 学习候选分流与自动重建 | Sprint 6 | M2 |
| M6 | 飞书审批闭环 + 订单落库 | Sprint 7 | M4 |

每个 Sprint 约 2–4 天工作量。下面按 Sprint 展开。

---

## Sprint 1 · Intent Router（决策分流层）

### 1.1 目标

把当前散落在 `RentalAgentService.handle_pre_reply()` 里的关键词判断，抽成一个**显式的意图路由器**，返回结构化枚举，让 `ConversationProcessor` 按枚举走分支，而不是在 service 内部同时做判断和回复。

### 1.2 新增模块

- 新文件：[python/services/intent_router.py](../python/services/intent_router.py)

```python
# 伪代码接口
class IntentCategory(str, Enum):
    IGNORE           = "ignore"            # 系统消息 / 无关闲聊
    RISK_TAKEOVER    = "risk_takeover"     # 砍价 / 售后 / 纠纷 / 提示词攻击
    SCHEDULE_QUOTE   = "schedule_quote"    # 档期 / 费用 / 物流 / 是否可租
    BOOKING_CONFIRM  = "booking_confirm"   # 明确要下单 / 确认租
    FAQ_KB           = "faq_kb"            # 走知识库
    FALLBACK         = "fallback"          # 默认走 LLM（保守）

@dataclass
class IntentResult:
    category: IntentCategory
    confidence: float
    reason: str
    slots: dict  # 已抽取的字段：model_code / dates / city / shipping / ...

class IntentRouter:
    def classify(self, message: str, context: ConversationContext) -> IntentResult: ...
```

实现策略（第一版全用规则 + 轻量正则，不上 LLM）：
- 规则优先级：IGNORE > RISK > BOOKING_CONFIRM > SCHEDULE_QUOTE > FAQ_KB > FALLBACK
- `slots` 复用 `RentalAgentService` 已有的 `parse_date_range` / `detect_city` / `detect_model_code`

### 1.3 改动点

- [python/runtime/conversation_processor.py](../python/runtime/conversation_processor.py)
  - `process_event()` 中，在"加载商品信息与历史上下文"之后、调用 `rental_agent_service.handle_pre_reply` 之前，先调用 `intent_router.classify(...)`
  - 根据 `IntentResult.category` 走不同分支：
    - IGNORE → 直接 return
    - RISK_TAKEOVER → 走 `takeover_service`，安抚语 + 转人工
    - SCHEDULE_QUOTE → 暂时**继续调用** `handle_pre_reply`（保持现状），M3 再替换成 `QuoteService`
    - BOOKING_CONFIRM → M4 接入，先记录日志
    - FAQ_KB / FALLBACK → 走现有 LLM 流程

- [python/services/__init__.py](../python/services/__init__.py)：导出 `IntentRouter`
- [python/bridge.py](../python/bridge.py) / `main.py`：实例化 `IntentRouter` 注入到 `ConversationProcessor`

### 1.4 配置开关

新增 config key：
- `INTENT_ROUTER_ENABLED`（默认 `false`）
- `INTENT_ROUTER_LOG_ONLY`（默认 `true`，开启后只打日志不改行为，用于灰度观察）

### 1.5 验收标准

- [ ] 开关关闭时，现有行为 100% 不变（回归：议价/档期/FAQ strict 未命中 四个场景）
- [ ] 开关打开 + log_only 时，所有消息产生一条分类日志，不影响回复
- [ ] 完全打开时：系统消息命中 IGNORE；"便宜点""刀"命中 RISK；"什么时候能到""能租吗"命中 SCHEDULE_QUOTE
- [ ] 新增单测 [python/tests/test_intent_router.py](../python/tests/test_intent_router.py)，覆盖上述四类 ≥ 15 条样例

### 1.6 回滚

- 一条 SQL：`UPDATE config SET value='false' WHERE key='INTENT_ROUTER_ENABLED';`

---

## Sprint 2 · 知识库命中升级

### 2.1 目标

把知识库检索从"Top-K 向量"升级为"阈值 + 分类 + 型号绑定 + 解释"，让自动回复的"敢回答"和"不回答"边界清晰。

### 2.2 数据模型变更

`knowledge` 表已有 `tags`、`confidence_threshold` 列，补充使用规范：

- 新约定 `tags` 为 JSON 数组，词表固定：
  `["faq", "usage", "feature", "accessory", "compat", "schedule", "price", "shipping", "aftersale", "booking"]`
- `confidence_threshold` 取值 0.60–0.95，默认 0.75
- 新增 config key：
  - `KNOWLEDGE_MIN_SCORE_DEFAULT`（默认 `0.75`）
  - `KNOWLEDGE_CATEGORY_BLACKLIST`（默认 `"price,schedule,shipping,aftersale,booking"`，这些类目**不走自动回复**，由结构化服务或人工处理）

> 不需要改 schema，只在 `scripts/mysql_schema.sql` 顶部注释中补充词表约定即可。

### 2.3 改动点

- [python/knowledge_base/retriever.py](../python/knowledge_base/retriever.py)
  - `search()` 返回值新增 `score`、`tags`、`matched_scope` 字段
  - 新增 `search_with_policy(query, item_id, model_code)` 方法：
    1. 调底层 `search`
    2. 过滤 `score < threshold`
    3. 过滤 `tags ∩ blacklist ≠ ∅`
    4. 返回 `(best_hit | None, debug_info)`

- [python/runtime/conversation_processor.py](../python/runtime/conversation_processor.py)
  - 调用处切换到 `search_with_policy`
  - `debug_info` 落日志（命中 / 未命中 / 被 tag 拦截 / 分数不够），便于复盘

- 前端（可选，放到 Sprint 6 附带）：知识库编辑页暴露 `tags` 多选 + `confidence_threshold` 滑块

### 2.4 型号绑定增强

- 新增表（写入 `scripts/mysql_schema.sql`）：

```sql
CREATE TABLE IF NOT EXISTS item_model_mapping (
  item_id VARCHAR(255) PRIMARY KEY,
  model_code VARCHAR(100) NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'manual', -- manual | inferred
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

- 新增仓储方法 `rental_repository.get_model_by_item_id(item_id)`
- `LearningService.infer_model_code()` 调用顺序改为：**先查 `item_model_mapping`，查不到再走关键词**
- 识别失败时，SCHEDULE_QUOTE / price 类问题**直接转人工**，不再进 LLM

### 2.5 验收标准

- [ ] 一条 `price` 标签的知识条目，即使命中也不会被自动发送
- [ ] 分数 0.6 的命中在阈值 0.75 下视为未命中
- [ ] 未命中日志包含 `reason=below_threshold | blacklist_tag | no_hit`
- [ ] `item_model_mapping` 有手工记录时，优先使用；无记录时 fallback 到关键词
- [ ] 单测 [python/tests/test_retriever_policy.py](../python/tests/test_retriever_policy.py)

---

## Sprint 3 · Quote Service 原型（只读版）

### 3.1 目标

把"多少钱 / 能不能租 / 什么时候到 / 发什么快递"这类问题，从 LLM/FAQ 里**彻底剥离**，走结构化服务。本 Sprint 只交付**只读查询**，不涉及建单。

### 3.2 新增模块

- 新文件：[python/services/quote_service.py](../python/services/quote_service.py)

```python
@dataclass
class QuoteRequest:
    model_code: Optional[str]
    rent_start: Optional[date]
    rent_end: Optional[date]
    city: Optional[str]
    shipping_mode: Optional[str]  # sf_express | sf_cold | self_pickup

@dataclass
class QuoteSlotStatus:
    missing: list[str]          # ["model_code", "rent_end", ...]
    asked_before: set[str]      # 从 session_state 读，避免重复追问

@dataclass
class QuoteResult:
    status: Literal["need_more_info", "available", "unavailable", "needs_human"]
    reply_text: str             # 给买家看的标准话术
    followup_question: Optional[str]
    quote: Optional[dict]       # {"total": 680, "daily": 170, "days": 4, "deposit": 2000}
    schedule: Optional[dict]    # {"available": True, "unit_code": "DJI-POCKET3-01"}
    shipping: Optional[dict]    # {"carrier": "sf", "eta_hours": 36, "eta_text": "明天下午"}
    reason: str                 # 调试用

class QuoteService:
    def build_request(self, message, context, slots) -> QuoteRequest: ...
    def resolve(self, req: QuoteRequest, slot_status: QuoteSlotStatus) -> QuoteResult: ...
```

### 3.3 子能力依赖

| 子能力 | 来源 | 本 Sprint 做法 |
|-------|------|-------------|
| 档期可用性 | 已有 `ScheduleService` | 直接调用 |
| 价格规则 | 无 | **本 Sprint 新建 `rental_pricing` 表 + `PricingRepository.get_price(model_code, days)`**，规则：按租期分档（1–3 天 / 4–7 天 / 8+ 天）单价 |
| 顺丰时效 | 无 | **本 Sprint 先做 mock**：同城 24h、跨省 48h、偏远 72h；真实接口留 TODO，接口定义定好 |
| 追问策略 | `session_state_service` | 在 session `volatile` 字段记 `asked_slots`，避免重复问 |

#### 新增表

```sql
CREATE TABLE IF NOT EXISTS rental_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_code VARCHAR(100) NOT NULL,
  min_days INT NOT NULL,
  max_days INT NOT NULL,      -- 包含
  daily_price DECIMAL(10,2) NOT NULL,
  deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
  remark VARCHAR(255),
  active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pricing_model (model_code, active)
) ENGINE=InnoDB;
```

初始数据通过"设备管理 → 价格规则"UI 维护（UI 放 Sprint 4 顺带做，或先用 SQL 灌）。

### 3.4 改动点

- [python/runtime/conversation_processor.py](../python/runtime/conversation_processor.py)
  - `IntentCategory.SCHEDULE_QUOTE` 分支调用 `QuoteService.resolve(...)`
  - 返回 `need_more_info` → 发 `followup_question`
  - 返回 `available` → 发 `reply_text`（已含价格 + 档期 + 时效）
  - 返回 `unavailable` / `needs_human` → 走 takeover
- [python/services/rental_agent_service.py](../python/services/rental_agent_service.py)
  - 原 `schedule_keywords` 分支代码**保留但由 IntentRouter 分流后再也不会进入**，作为 fallback 保底
- `bridge.py`：实例化 `QuoteService` 注入

### 3.5 验收标准

样例场景（全部走 QuoteService，**不再触达 LLM**）：

| 输入 | 已知商品型号 | 预期输出 |
|------|-----------|---------|
| "这个多少钱啊" | 是 | followup：请问您打算租几天呢？ |
| "15号到18号多少钱" | 是 | available：4 天 680 元，押金 2000，顺丰当日到 |
| "上海能今天发吗" + 之前给了日期型号 | 是 | available：今天 17:00 前下单，明天上午到 |
| "DJI pocket3 下周能租吗" | 否（需先匹配） | 走型号推断；推断失败 → needs_human |
| "能再便宜点吗" | 任意 | IntentRouter 先判定 RISK → takeover（不会进 QuoteService）|

- [ ] 全部样例按预期
- [ ] 单测 [python/tests/test_quote_service.py](../python/tests/test_quote_service.py)
- [ ] 开关：`QUOTE_SERVICE_ENABLED`（默认 false）

---

## Sprint 4 · Quote Service 增强 + 前端维护页

### 4.1 目标

- 给 `rental_pricing` 和 `item_model_mapping` 做前端管理页（不是必须，但能省大量灌数据时间）
- 把"顺丰时效"真实接口接入（留了 interface，换个实现）
- 报价话术可配置（从 `prompts` 表读模板）

### 4.2 改动点

- [electron/renderer/src/views/rental/Pricing.vue](../electron/renderer/src/views/rental/Pricing.vue)（新）
- [electron/renderer/src/views/rental/ItemModelMapping.vue](../electron/renderer/src/views/rental/ItemModelMapping.vue)（新）
- 路由在 [electron/renderer/src/router/index.js](../electron/renderer/src/router/index.js) 注册
- IPC：
  - [electron/main/ipcHandlers.js](../electron/main/ipcHandlers.js) 加 `rental:listPricing` / `rental:upsertPricing` / `rental:deletePricing` / `rental:listItemMapping` / `rental:upsertItemMapping`
  - [electron/preload/preload.js](../electron/preload/preload.js) 同步暴露
- 顺丰时效：新 `python/services/sf_delivery_service.py`，`QuoteService` 注入之

### 4.3 验收标准

- [ ] 不写 SQL 就能在 UI 里维护型号绑定和价格
- [ ] 改价格/改时效立即在下一条聊天里生效（无需重启）

---

## Sprint 5 · Booking FSM（建单草稿状态机）

### 5.1 目标

当买家聊天中**明确表示要下单**时，机器人推进一个**草稿订单**走完信息收集，最终推给人工一键确认。

### 5.2 状态定义

```
collecting_model
  → collecting_rent_dates
  → collecting_city
  → collecting_address
  → quote_ready
  → awaiting_customer_confirm
  → order_drafted        ← 草稿入库，推飞书
  → order_confirmed      ← 人工在 UI 或飞书点确认
  → schedule_locked      ← 真正占用档期
  → awaiting_payment
  → closed               ← 成交 / 取消
```

### 5.3 数据模型

新增表：

```sql
CREATE TABLE IF NOT EXISTS booking_drafts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  item_id VARCHAR(255),
  model_code VARCHAR(100),
  buyer_id VARCHAR(255),
  state VARCHAR(50) NOT NULL,
  slots_json JSON NOT NULL,          -- model/dates/city/address/shipping
  quote_json JSON,                   -- 最近一次报价结果
  last_user_message TEXT,
  last_bot_message TEXT,
  feishu_task_id VARCHAR(255),
  order_id INT,                      -- 确认后关联 orders.id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

### 5.4 新增模块

- [python/services/booking_service.py](../python/services/booking_service.py)：FSM，入口 `handle(event, intent_result)`
- 入口条件：`IntentRouter` 返回 `BOOKING_CONFIRM` 或 `QuoteService` 返回 `available` 且买家回复"好的/可以/下单"

### 5.5 改动点

- `ConversationProcessor.process_event()`：BOOKING_CONFIRM 分支调 `BookingService`
- 每次状态变更都写 `booking_drafts`
- 抵达 `order_drafted` 时：
  - 调现有 `rental_repository` 创建 `orders` 草稿行（status=`draft`）
  - 通过 `FeishuCallbackServer` 推送待确认卡片
- 飞书 callback 或 UI 按钮点"确认" → `order_confirmed` → `schedule_locked`（调 `ScheduleService.reserve`）

### 5.6 验收标准

- [ ] 完整聊天流程（6–8 轮）可从 `collecting_model` 推到 `order_drafted` 且生成 draft 订单
- [ ] 任一环节买家改变主意、说"不租了" → 状态变 `closed`，释放占位
- [ ] 飞书确认后，`schedule_units` 出现正确占用
- [ ] 开关 `BOOKING_FSM_ENABLED`（默认 false）

---

## Sprint 6 · 学习候选分流 + 自动化审核

### 6.1 目标

让学习系统产出**带类目的候选**，并形成"候选 → 审核 → 入库 → 向量重建"闭环。

### 6.2 改动点

- [python/services/learning_service.py](../python/services/learning_service.py)
  - 新增 `classify_candidate(q, a) -> category`：用规则 + 轻量 LLM 分类（faq / usage / price / schedule / shipping / aftersale / booking）
  - `price / schedule / shipping / aftersale / booking` 不进知识库，改进 `structured_learning_suggestions` 表（供人工看但不自动生效）
- 学习候选列表 UI 按类目分 tab
- 审核通过 → 立即调 `KnowledgeRetriever.rebuild_index()`（已有，不用写）

### 6.3 新增表

```sql
CREATE TABLE IF NOT EXISTS structured_learning_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_session_id VARCHAR(255),
  category VARCHAR(32) NOT NULL,
  user_message TEXT,
  bot_or_human_reply TEXT,
  suggested_slot_json JSON,    -- 如 {"model_code":"DJI_POCKET3","daily_price":170}
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

### 6.4 验收标准

- [ ] 人工回复的砍价对话**不会**被写入 `knowledge`，而是进 `structured_learning_suggestions`
- [ ] 纯使用问题依然进 `knowledge`
- [ ] 审核通过后无需重启，下一条消息就能检索到

---

## Sprint 7 · 飞书闭环 + 可观测面板

### 7.1 目标

把所有"需要人工介入"的场景在飞书里形成统一收口，UI 提供观测面板。

### 7.2 改动点

- [python/services/feishu_callback_service.py](../python/services/feishu_callback_service.py)
  - 统一卡片模板：`[原因] [型号] [会话链接] [快捷动作]`
  - 原因枚举：`risk / kb_miss / quote_unavailable / booking_confirm / model_unknown`
- 新增 UI 页：[electron/renderer/src/views/ops/Dashboard.vue](../electron/renderer/src/views/ops/Dashboard.vue)
  - 今日自动回复数 / 转人工数 / 命中率 / 报价转化率 / 建单数
  - 来源于 `takeover_tasks`、`knowledge` 命中日志、`booking_drafts` 状态分布

### 7.3 验收标准

- [ ] 一个仪表盘能看到"机器人今天干了啥"
- [ ] 所有转人工场景在飞书都有对应卡片且 reason 可归因

---

## 通用工程约定

### A. 开关约定

所有新能力通过 `config` 表控制：

| key | 默认值 | 作用 |
|-----|-------|------|
| `INTENT_ROUTER_ENABLED` | false | 启用新决策层 |
| `INTENT_ROUTER_LOG_ONLY` | true | 只观察不生效 |
| `KNOWLEDGE_MIN_SCORE_DEFAULT` | 0.75 | 相似度阈值 |
| `KNOWLEDGE_CATEGORY_BLACKLIST` | price,schedule,shipping,aftersale,booking | 不走自动回复的类目 |
| `QUOTE_SERVICE_ENABLED` | false | 启用结构化报价 |
| `BOOKING_FSM_ENABLED` | false | 启用建单状态机 |
| `LEARNING_CLASSIFY_ENABLED` | false | 启用学习候选分类 |

灰度节奏建议：M1 打开 log_only 1–2 天 → 生效；M2 打开 → 观察 knowledge 命中日志 2 天 → 调阈值；M3 先对单一型号开 → 稳了再推广。

### B. 日志约定

所有新决策日志前缀：`[decision]`，结构化 key：
```
[decision] category=schedule_quote reason=slots_complete action=reply confidence=0.92 session=xxx model=DJI_POCKET3
```

### C. 测试约定

- 每个新 service 必须附 `python/tests/test_*.py`
- 回归集：把当前生产环境里已经出现过的"不该自动回"消息整理成样例集 [python/tests/fixtures/regression_messages.jsonl](../python/tests/fixtures/regression_messages.jsonl)，每次上线前跑一遍

### D. 回滚方式

- 所有改动只加开关 + 新分支，旧代码保留
- 任一 Sprint 出问题，把对应 `*_ENABLED=false` 即可回到上一版行为

---

## 下一步

建议立刻开干 **Sprint 1（Intent Router）**，产出物：
1. `python/services/intent_router.py`
2. `python/tests/test_intent_router.py`
3. `ConversationProcessor` 集成（开关 + log_only）
4. 回归跑通四类典型消息

你确认方向后我就开始写 Sprint 1 的代码。
