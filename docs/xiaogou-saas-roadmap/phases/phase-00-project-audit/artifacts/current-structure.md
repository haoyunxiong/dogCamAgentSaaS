# Phase 00 当前项目结构盘点

执行时间：2026-06-11

## 结论摘要

当前项目是一个已有可运行的 Electron 桌面应用，前端为 Vue 3 + Vite，主进程负责启动、IPC、MySQL 数据访问、顺丰/免押/闲管家集成和移动网关，Python 侧仍保留闲鱼自动回复、浏览器/接口渠道、聊天上下文、知识库和租赁业务服务。

项目已经具备较多租赁商户运营能力，但命名、启动路径、配置、数据库名和部分页面仍带有强闲鱼历史痕迹。Phase 00 只记录，不修改。

## 顶层目录

| 目录/文件 | 当前作用 | Phase 00 判断 |
|---|---|---|
| `AGENTS.md` | 仓库级执行纪律和产品方向 | 必须遵循 |
| `electron/` | Electron 桌面端，包括主进程、preload、Vue renderer、构建配置 | 当前主应用 |
| `python/` | Python bridge、闲鱼渠道、自动回复、知识库、租赁业务服务 | 业务与 legacy 混合 |
| `scripts/` | 启动、构建、MySQL schema、迁移、备份脚本 | 启动与运维关键路径 |
| `config/environments/` | local/production env 配置 | 启动配置入口 |
| `data/` | 日志、导入文件、会话缓存、备份快照 | 现有数据和运行痕迹，不能丢 |
| `build/` | Electron/Python 构建产物 | 不作为源码主判断 |
| `installer/` | 安装包配置 | 打包相关 |
| `docs/xiaogou-saas-roadmap/` | 当前 SaaS 路线图和阶段真源 | 当前产品方向最高优先级 |
| `skills/` / `.agents/skills/` | 本地 agent 技能说明 | 辅助执行，不属于业务代码 |

## Electron 结构

| 路径 | 当前作用 | 备注 |
|---|---|---|
| `electron/package.json` | npm scripts 与依赖 | 包名仍是 `xianyu-auto-agent`，描述已变为“小狗相机助手桌面版 - 相机租赁运营与 AI 客服工作台” |
| `electron/main/index.js` | Electron 生命周期、运行目录、窗口、DB 初始化、Python bridge、移动网关、定时归还/备份 | 启动关键路径，Phase 00 不改 |
| `electron/main/ipcHandlers.js` | Renderer 到主进程 IPC 聚合 | 覆盖配置、知识库、档期、订单、顺丰、免押、闲管家、学习、报表等 |
| `electron/main/dbManager.js` | 主要数据访问层 | 使用 `mysqlAdapter`，并带有启动时 ensureColumn / ensure table 逻辑 |
| `electron/main/mysqlAdapter.js` | MySQL promise pool，模拟 better-sqlite3 API | 当前 Node 数据访问现实是 MySQL |
| `electron/main/mysqlConfig.js` | MySQL 配置加载 | 默认库名仍为 `xianyu_agent`，环境变量仍是 `XIANYU_MYSQL_*` |
| `electron/main/pythonManager.js` | Python bridge 子进程启动和 JSON line 通信 | 启动关键路径，Phase 00 不改 |
| `electron/main/sfShippingService.js` | 顺丰寄件 payload、费用、轨迹、脱敏等 | 履约核心能力 |
| `electron/main/depositClient.js` | 免押开放平台客户端 | 免押核心能力 |
| `electron/main/depositNotifyServer.js` | 免押回调服务 | 免押状态更新路径 |
| `electron/main/xianguanjiaClient.js` | 闲管家开放平台客户端 | 渠道/legacy 候选 |
| `electron/main/mobileGateway.js` | 移动工作台网关 | 当前启动流程一部分 |
| `electron/preload/preload.js` | 暴露 `window.electronAPI` | 前端能力总出口 |
| `electron/renderer/src/` | Vue renderer 源码 | 页面、组件、服务、状态管理 |
| `electron/electron-builder.yml` | 打包配置 | appId/productName 仍是 `com.xianyu.autoagent` / `XianyuAgentPro` |

## Vue Renderer 结构

| 路径 | 当前作用 |
|---|---|
| `electron/renderer/src/router/index.js` | 当前全部前端路由 |
| `electron/renderer/src/App.vue` | 应用壳 |
| `electron/renderer/src/components/` | 通用 UI 组件和部分业务组件 |
| `electron/renderer/src/views/` | 基础页面：控制台、设置、提示词、知识库 |
| `electron/renderer/src/views/rental/` | 租赁运营页面：订单、档期、设备、顺丰、免押、报表等 |
| `electron/renderer/src/views/rental/sf-shipping/` | 顺丰寄件页面拆分组件 |
| `electron/renderer/src/services/` | 前端服务适配：免押、顺丰、设备查询等 |
| `electron/renderer/src/stores/` | Pinia store：bot/ui/config |
| `electron/renderer/src/utils/` | 运行模式、初始化等工具 |

## Python 结构

| 路径 | 当前作用 | Phase 00 判断 |
|---|---|---|
| `python/bridge.py` | Electron 与 Python 后端 JSON line bridge | 启动关键路径，强 legacy 命名 |
| `python/main.py` | `XianyuLive`，闲鱼 API WebSocket 主链路 | 强闲鱼 legacy |
| `python/channels/browser_runner.py` | Playwright 浏览器模式闲鱼 IM 采集/回复 | 强闲鱼 legacy |
| `python/XianyuApis.py` | 闲鱼接口封装 | 强闲鱼 legacy |
| `python/XianyuAgent.py` | classify/price/tech/default 自动回复 agent | legacy，可考虑未来转为话术助手 |
| `python/config_manager.py` | Python 配置管理，当前连接 MySQL | 基础配置能力 |
| `python/context_manager.py` | 聊天上下文、商品缓存、`chat_history.db` 相关逻辑 | 渠道数据与知识沉淀混合 |
| `python/mysql_helper.py` | Python MySQL 连接 wrapper | 当前 Python 数据访问现实 |
| `python/runtime/` | 会话事件与处理器 | legacy 消息流核心 |
| `python/services/` | 租赁业务服务、通知、学习、市场、报价、建单等 | 业务与 legacy 混合 |
| `python/knowledge_base/` | 知识库管理与检索 | 可保留，但需从自动回复核心中解耦 |
| `python/tests/` | Python 测试 | 后续阶段改造前应保留 |

## 数据与配置结构

| 路径 | 当前作用 | 注意 |
|---|---|---|
| `scripts/mysql_schema.sql` | 当前 MySQL schema 主文件 | 库名仍是 `xianyu_agent` |
| `mysql-connection.json` | MySQL 连接配置候选路径之一 | 只读识别，未打开敏感内容 |
| `config/environments/local.env` | 本地启动 env | 只读识别，未复制敏感值 |
| `data/local/db-backups/` | 本地快照备份 | 现有数据保护相关 |
| `data/db-backups/` | 历史快照与 SQL dump | 现有数据保护相关 |
| `data/imports/` | 档期表 Excel 导入文件 | 业务数据来源之一 |
| `data/logs/` / `data/local/logs/` | 系统日志 | 运行状态能力 |
| `data/*electron-session-data*` | Electron/浏览器会话缓存 | 与闲鱼登录/cookies 强相关 |

## 启动与构建结构

| 路径 | 当前作用 | 风险 |
|---|---|---|
| `electron/scripts/dev-launch.js` | `npm run dev` 启动 Vite + Electron | 开发启动关键路径 |
| `scripts/start_xianyu_desktop.sh` | macOS/zsh 桌面启动脚本，检查 MySQL、启动 gateway/vite/electron | 名称仍是 xianyu，但实际启动小狗相机助手 |
| `scripts/start_xianyu_desktop_local.sh` | local env wrapper | 名称 legacy |
| `scripts/start_xianyu_desktop_production.sh` | production env wrapper | 名称 legacy |
| `scripts/build-all.bat` | Windows 完整构建 pipeline | 名称/输出仍有 XianyuAutoAgent |
| `scripts/build-python.bat` | Python bridge 打包 | 启动/打包关键路径 |
| `electron/electron-builder.yml` | Electron 打包配置 | productName/appId legacy |

## 当前结构判断

- 当前系统不是单纯闲鱼自动回复工具，已经存在租赁商户运营系统雏形。
- 代码层迁移已部分发生：页面导航、订单、档期、设备、顺丰、免押、报表都已形成。
- 命名层和底层渠道层仍强闲鱼化：`XianyuAgentPro`、`xianyu_agent`、`XIANYU_*`、`item_id`、`chat_id`、闲鱼 IM、cookies/token/WebSocket。
- 数据库现实与旧文档存在不一致：`DATABASE.md` 仍描述 SQLite 主库，但当前 Electron/Python 主要业务数据访问已转向 MySQL，Python 仍保留 `chat_history.db` 一类 SQLite 聊天历史。

