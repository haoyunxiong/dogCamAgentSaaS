# Phase 00 可舍弃 / 可降级 / Legacy 功能清单

执行时间：2026-06-11

说明：本文件只做标记，不代表删除。任何删除、迁移、重构都必须在后续阶段另行确认。

| 功能/模块 | 当前位置 | 分类 | 原因 | 后续建议 |
|---|---|---|---|---|
| 闲鱼自动回复作为产品核心 | `python/main.py`, `python/XianyuAgent.py`, `Prompts.vue` | legacy | 新产品核心是租赁商户运营，不是自动回复 bot | 保留为渠道/话术助手候选 |
| 闲鱼账号连接作为核心入口 | `Settings.vue`, `Dashboard.vue`, `python/bridge.py` | legacy | 新主状态应是商户、门店、员工、订单、设备、档期 | 降为渠道配置 |
| 闲鱼 WebSocket | `python/main.py` | legacy | 只服务闲鱼 IM | 保留为 Xianyu channel |
| 闲鱼 token/cookies | `python/main.py`, `login_browser.py`, `Settings.vue` | legacy | 不应驱动 SaaS 登录和业务架构 | 保留兼容，不作为核心 |
| 浏览器模式闲鱼 IM 扫描 | `python/channels/browser_runner.py` | legacy | 只围绕闲鱼会话 | 保留采集/历史导入能力待确认 |
| classify/price/tech/default Agent | `python/XianyuAgent.py`, `Prompts.vue`, `DEFAULT_PROMPTS` | legacy | 当前围绕电商自动回复 | 转为客户沟通辅助/话术模板候选 |
| 手动接管/人工接管客服流 | `TakeoverBoard.vue`, `takeover_tasks`, `session_reply_state` | legacy 包装后保留 | 员工待办有价值，但当前强消息流 | 后续判断是否并入 SOP |
| 消息审批 | `FeishuPending.vue`, `feishu_pending_replies` | 待确认 | 若只服务闲鱼聊天则 legacy；若多渠道客服可保留 | 用户确认 |
| 学习审核中的浏览器历史同步 | `LearningReview.vue`, `browser:sync_history`, `learning:extract_history` | legacy | 强依赖闲鱼聊天历史 | 转知识沉淀候选 |
| 商品业务绑定中的闲鱼 `item_id` | `ItemModelMapping.vue`, `item_model_mapping` | 渠道化改造候选 | 业务映射有价值，但字段和页面强闲鱼 | 抽象为 channel item mapping |
| 当前账号帖子审核 | `xianyu_item_listings`, `ItemModelMapping.vue` | legacy | 只服务闲鱼帖子缓存 | 保留为闲鱼渠道工具 |
| 市场监控闲鱼帖子 | `MarketMonitor.vue`, `market_monitor.py` | 待确认 | 只围绕闲鱼行情 | 可作为外部行情工具，非主线 |
| 闲管家开放平台 | `xianguanjiaClient.js`, `xgj:*` IPC | 渠道能力候选 | 与闲鱼生态相关 | 放入渠道集成，不作为核心 |
| `xianyu_agent` 数据库名 | `scripts/mysql_schema.sql`, `mysqlConfig.js` | legacy 命名 | 与新产品不一致 | 不直接改，未来迁移 |
| `XianyuAgentPro` 产品/打包名 | `index.js`, `electron-builder.yml` | legacy 命名 | 与小狗相机助手商户版不一致 | 后续统一命名，需同步 launcher |
| `start_xianyu_desktop*` 脚本 | `scripts/` | legacy 命名 | 启动脚本名历史遗留 | 不动，未来启动阶段统一 |
| localStorage `xianyu.deposit*` key | `depositApiService.js`, `depositMockService.js`, `depositSettingsService.js` | legacy 命名 | 免押能力不应叫 xianyu | 保留兼容，后续迁移 key |

## 未来可删除候选

以下仅是候选，不能在 Phase 00 删除：

- 已确认不再使用的闲鱼自动回复默认 prompt。
- 只服务闲鱼聊天、且无法转为多渠道客服/SOP 的消息审批或学习历史同步功能。
- 已迁移到 channel abstraction 后的旧 `xianyu_item_listings` 临时审核缓存。
- 确认无用、且已有备份的旧构建产物或旧 SQL dump。

## 待确认

- 市场监控是否仍有采购/定价价值。
- 消息审批是否会发展为多渠道客服审批。
- 学习审核是否转为员工话术/知识沉淀。
- 闲管家是否仍是实际订单/商品渠道。
- 是否保留浏览器只读采集模式用于知识库沉淀。

