# Phase 00 旧闲鱼强绑定逻辑清单

执行时间：2026-06-12

本清单只做记录和分类，不删除、不重构、不迁移旧逻辑。

## 分类规则

- `可保留为渠道能力`：功能本质可服务多渠道，只是当前命名、字段、入口闲鱼化。
- `可降级为 legacy`：只服务旧闲鱼自动回复/客服流，短期保留，后续不作为主产品。
- `未来可删除`：只有确认无业务价值、完成迁移与备份后才可能删除。
- `待确认`：业务价值不明确，需要用户判断。

## 代码命名强绑定

| 绑定点 | 位置 | 类型 | 建议 |
|---|---|---|---|
| `xianyu-auto-agent` npm 包名 | `electron/package.json` | 命名强绑定 | 待 Phase 01/打包规划时处理 |
| `XianyuAgentPro` 窗口标题 | `electron/main/index.js` | 命名强绑定 | 后续产品命名统一时替换 |
| `com.xianyu.autoagent` / `XianyuAgentPro` | `electron/electron-builder.yml` | 打包身份强绑定 | 不能在 Phase 00 改，涉及 launcher/打包 |
| `xianyu_agent` MySQL 库名 | `scripts/mysql_schema.sql`, `electron/main/mysqlConfig.js`, `python/config_manager.py` | 数据库命名强绑定 | 改库名属于高风险迁移，Phase 00 只记录 |
| `XIANYU_*` 环境变量 | `electron/main/index.js`, `electron/main/mysqlConfig.js`, `python/bridge.py`, `scripts/start_xianyu_desktop.sh` | 环境变量强绑定 | 后续可引入兼容别名，不能直接删除 |
| `start_xianyu_desktop*` 脚本 | `scripts/` | 启动脚本强绑定 | 启动关键路径，暂不动 |
| `XianyuAgent.py`, `XianyuApis.py` | `python/` | 模块命名强绑定 | legacy 渠道模块 |
| `utils/xianyu_utils.py` | `python/utils/` | 协议工具强绑定 | legacy 渠道模块 |

## 平台协议强绑定

| 绑定点 | 位置 | 类型 | 建议 |
|---|---|---|---|
| 闲鱼 WebSocket `wss://wss-goofish.dingtalk.com/` | `python/main.py` | 可降级为 legacy | 只作为闲鱼渠道集成 |
| Cookies 解析与 `COOKIES_STR` | `python/main.py`, `python/bridge.py`, `Settings.vue` | 可降级为 legacy | 不作为新产品核心登录状态 |
| Token 刷新循环 | `python/main.py` | 可降级为 legacy | 只服务闲鱼 API channel |
| `XianyuApis.get_token/get_item_info` | `python/XianyuApis.py`, `python/main.py` | 可降级为 legacy | 只服务渠道商品信息 |
| Playwright 闲鱼 IM 浏览器模式 | `python/channels/browser_runner.py` | 可降级为 legacy | 只作为旧渠道采集/回复 |
| `browser_login` CDP 刷新 Cookie | `python/login_browser.py`, `python/bridge.py` | 可降级为 legacy | 不进入 SaaS 主登录 |

## 页面与文案强绑定

| 页面/文案 | 位置 | 类型 | 建议 |
|---|---|---|---|
| “打开闲鱼 IM” | `Dashboard.vue` | 可降级为 legacy | 改为渠道入口候选 |
| “闲鱼 Cookies” | `Settings.vue` | 可降级为 legacy | 后续放入“渠道配置” |
| “接口模式（Cookie + 接口）/ 浏览器模式” | `Settings.vue` | 可降级为 legacy | 不作为全局主状态 |
| “商品业务绑定”中 `闲鱼商品 item_id` | `ItemModelMapping.vue` | 可保留为渠道能力 | 抽象为渠道商品 ID |
| “当前账号帖子审核 / 同步本地帖子” | `ItemModelMapping.vue` | 可降级为 legacy | 作为闲鱼渠道商品审核 |
| “市场监控：追踪闲鱼同类机型帖子” | `MarketMonitor.vue` | 待确认 | 可作为外部行情工具 |
| “机器人”“AI 草稿发送给买家” | `Prompts.vue`, `KnowledgeBase.vue`, `FeishuPending.vue`, `TakeoverBoard.vue` | 可降级为 legacy | 未来转为话术/员工辅助 |

## 数据字段强绑定

| 字段/表 | 位置 | 类型 | 建议 |
|---|---|---|---|
| `item_id` | `knowledge`, `item_model_mapping`, `xianyu_item_listings`, `item_cache`, `learning_candidates`, `feishu_pending_replies`, `session_reply_state` | 渠道化改造候选 | 后续抽象为 `channel_item_id` 或保留兼容字段 |
| `chat_id` | `inquiry_events`, `chat_history.db/messages`, Python repository | 渠道化改造候选 | 后续抽象为 `channel_conversation_id` |
| `session_id` | `rental_orders`, `takeover_tasks`, `booking_drafts`, `session_reply_state` | 渠道化改造候选 | 需要区分订单会话、客服会话、内部任务 |
| `account_id` | `xianyu_item_listings`, `session_reply_state` | 渠道化改造候选 | 后续可能变成 channel account |
| `xianyu_item_listings` | MySQL schema / `dbManager.js` | 可降级为 legacy | 仅闲鱼帖子缓存审核 |
| `market_snapshots.source DEFAULT 'xianyu'` | `scripts/mysql_schema.sql`, `dbManager.js` | 渠道化改造候选 | 可扩展外部渠道 |
| `source_channel` 默认值 `xianyu` | `OrderFulfillment.vue` | 可保留为渠道能力 | 默认不应长期是闲鱼 |
| localStorage key `xianyu.deposit*` | deposit renderer services | 命名 legacy | 免押能力保留，key 后续兼容迁移 |

## 自动回复 Agent 强绑定

| 模块 | 位置 | 类型 | 建议 |
|---|---|---|---|
| classify/price/tech/default agent | `python/XianyuAgent.py`, `Prompts.vue`, 默认 prompt | 可降级为 legacy | 不作为新产品核心，可转话术助手 |
| 人工接管模式/切换关键词 | `python/main.py`, `TakeoverBoard.vue`, `session_reply_state` | 可降级为 legacy | 可转员工待办，但先保留 |
| 消息审批 / 飞书确认回复 | `FeishuPending.vue`, `feishu_pending_replies`, `python/services/feishu_callback_service.py` | 待确认 | 若多渠道客服需要可保留 |
| 学习审核 / 历史聊天抽取 | `LearningReview.vue`, `python/services/learning_service.py` | legacy 包装后保留 | 可转知识沉淀 |

## 第三方闲鱼生态绑定

| 模块 | 位置 | 类型 | 建议 |
|---|---|---|---|
| 闲管家开放平台 | `electron/main/xianguanjiaClient.js`, `ipcHandlers.js`, `preload.js` | 可保留为渠道能力 | 作为渠道集成，不作为主业务 |
| `xgj:*` IPC | `ipcHandlers.js`, `preload.js` | 可保留为渠道能力 | 后续放入渠道配置/渠道订单 |

## 不应删除的 legacy

以下能力虽然 legacy，但短期不可删除：

- 闲鱼 WebSocket / cookies / token / 浏览器模式，因为可能仍支撑现有客服和商品缓存。
- 自动回复 Agent，因为知识库、学习审核、人工接管仍依赖它。
- `item_id`、`chat_id`、`session_id` 字段，因为它们与历史数据关联。
- 启动脚本和打包名称，因为它们属于可用启动流程的一部分。
- `xianyu_agent` 数据库名，因为改库名涉及迁移、备份、回滚和 env 同步。

## Phase 00 处理结论

- 保留：租赁业务能力、数据、启动流程。
- 冻结：旧闲鱼主链路，不新增闲鱼中心化架构。
- 标记：所有闲鱼强绑定命名、字段、页面、协议。
- 不执行：删除、重命名、schema 迁移、协议抽象、功能重构。
