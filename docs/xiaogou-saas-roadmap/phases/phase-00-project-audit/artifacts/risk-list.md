# Phase 00 风险清单

执行时间：2026-06-11

## 高优先级风险

| 风险 | 说明 | 影响 | 控制建议 |
|---|---|---|---|
| 数据库现实与文档不一致 | `DATABASE.md` 描述 SQLite 主库，但代码现实是 MySQL + Python SQLite 聊天历史 | 后续误操作风险高 | Phase 01/03 前先更新数据库说明，任何 schema 变更必须迁移计划 |
| 启动链路强耦合 | `electron/main/index.js` 同时做运行目录、DB 初始化、Python bridge、移动网关、定时任务、备份 | 任意启动改动易破坏可用应用 | 未到对应阶段不得重构；启动改动必须同步 launcher |
| `dbManager.js` 过大且职责混合 | DAO、schema ensure、业务规则、顺丰、免押、报表都集中 | 改造时容易产生回归 | 后续按阶段拆，不在 Phase 00 动 |
| 闲鱼协议仍驱动 Python 主链路 | WebSocket、cookies、token、BrowserRunner、XianyuApis 仍是自动回复核心 | 新 SaaS 方向容易被旧架构牵引 | 标为 legacy channel，不让它驱动新主架构 |
| 缺少完整多商户隔离 | 只有 `stores` / `store_id` 局部存在，没有全局 `merchant_id` | 不能直接外部 SaaS 化 | Phase 03 再设计，不提前改 schema |
| 现有数据不能丢 | 有 MySQL、备份、导入 Excel、日志、session cache、chat history | 迁移/重命名风险高 | 任何数据改动前先备份、迁移、回滚、验证 |

## 业务耦合风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 订单与闲鱼会话字段混杂 | `rental_orders.session_id`, `source_channel`, `source_name` 同时承载业务和渠道信息 | 后续定义订单来源模型 |
| 商品型号绑定基于 `item_id` | `item_model_mapping`, `xianyu_item_listings`, `item_cache` 强依赖闲鱼商品 ID | 抽象为渠道商品映射 |
| 查档期能力在页面和自动回复中都有 | `ScheduleCalendar.vue`、`OrderFulfillment.vue`、`RentalAgentService` 都可触发 | 后续统一为业务服务 |
| 人工接管/消息审批/学习审核依赖聊天场景 | 对新 SaaS 员工 SOP 有价值，但当前强客服化 | 先 legacy 包装，后续再转 SOP |

## 数据库风险

| 风险 | 说明 | 建议 |
|---|---|---|
| schema 定义分散 | `scripts/mysql_schema.sql` 与 `dbManager.js` 都有 DDL/ALTER | 后续建立唯一迁移真源 |
| MySQL 库名 `xianyu_agent` | 数据库命名与新产品不一致 | 不直接改；需要迁移方案 |
| Python SQLite 聊天历史仍存在 | `chat_history.db` / `context_manager.py` | 迁移前盘点实际数据 |
| 备份策略已经存在但未验收 | 启动/定时快照写入 `db-backups` | 后续验证备份可恢复 |
| 敏感配置在 `config`/env 中 | API key、cookies、顺丰、免押、闲管家 | 文档不要泄露值，配置要分类 |

## 启动风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 启动依赖 MySQL 可用 | `scripts/start_xianyu_desktop.sh` 会先检查 MySQL | 需要明确用户启动前置条件 |
| 脚本命名仍是 xianyu | 用户和后续 agent 容易误判产品方向 | 后续阶段统一命名时同步 launcher |
| Python bridge 打包路径固定 | `electron-builder.yml` 引用 `../build/python-dist/bridge/` | 打包改动需同步构建脚本 |
| 移动网关随启动链路启动 | `startMobileGateway()` 在主进程和脚本中都有相关逻辑 | 不在 Phase 00 改 |

## UI 重构风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 页面已部分 SaaS 化但仍混 legacy | 订单/档期/设备已成型，会话中心仍强旧客服 | 分阶段重构导航，不一次性替换 |
| 通用组件已有基础 | `Base*`, `DataTable`, `StatusBadge`, `KpiStrip` 等 | 后续优先复用 |
| 页面代码过大 | `OrderFulfillment.vue` 很大，职责多 | Phase 04 再拆，不在 Phase 00 动 |
| 文案含闲鱼/机器人 | 影响新定位 | Phase 01/02 统一产品文案 |

## 命名混乱风险

| 风险 | 例子 | 建议 |
|---|---|---|
| 产品名混用 | 小狗相机助手、XianyuAgentPro、XianyuAutoAgent | Phase 01 固定产品命名规则 |
| 数据库/环境变量 legacy | `xianyu_agent`, `XIANYU_*` | 后续兼容式重命名，不直接破坏 |
| 业务字段与渠道字段混用 | `item_id`, `chat_id`, `session_id` | 后续建立 channel abstraction |
| 页面定位混用 | 询单分析 vs 订单分析，提示词 vs 话术 | Phase 01 导航和模块命名统一 |

