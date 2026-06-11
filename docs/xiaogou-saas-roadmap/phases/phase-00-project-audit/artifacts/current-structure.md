# Phase 00 当前项目结构

执行日期：2026-06-12

## 根目录

当前正式仓库目录：

```text
/Users/lishuangshuang/Documents/租赁SAAS系统
```

当前仓库是正式 Git baseline，remote 为：

```text
git@github.com:haoyunxiong/dogCamAgentSaaS.git
```

根目录主要结构：

| 路径 | 说明 | Phase 00 判断 |
|---|---|---|
| `AGENTS.md` | 仓库级 Codex 指令 | 当前执行真源之一 |
| `.agents/skills/xiaogou-saas-phase-executor/` | 项目阶段执行 skill | 保留 |
| `.gitignore` | 首次提交安全忽略规则 | 保留 |
| `docs/` | 当前路线图、历史规划、QA、设计、部署文档 | 保留，但历史闲鱼文档不能覆盖新路线图 |
| `docs/xiaogou-saas-roadmap/` | 小狗相机助手商户版阶段路线图 | 当前产品真源 |
| `electron/` | Electron 桌面端：main、preload、renderer、tests、scripts | 当前应用主体 |
| `python/` | Python bridge、旧闲鱼通道、自动回复、租赁服务 | 当前后端/通道逻辑 |
| `scripts/` | 启动、构建、MySQL 迁移、备份脚本 | 保留，启动脚本名称 legacy |
| `config/` | 环境配置模板和本地 env | 模板可提交，本地 env 已忽略 |
| `images/` | README/demo 图片 | 保留 |
| `installer/` | 安装包脚本 | 保留 |
| `prototypes/` | 移动工作台原型 | 参考材料 |
| `skills/` | 旧项目开发 skill | 保留，部分 Xianyu 命名为 legacy |
| `data/` | 运行数据、日志、备份、session/cookies | 已忽略，不纳入代码仓库 |
| `build/`, `electron/node_modules/`, `electron/renderer/dist/`, `python/build/` | 构建产物/依赖 | 已忽略 |

## Electron 结构

| 路径 | 说明 |
|---|---|
| `electron/package.json` | Electron/Vue 项目脚本和依赖，包名仍是 `xianyu-auto-agent` |
| `electron/main/index.js` | 主进程启动、窗口创建、运行数据目录、DB 初始化、Python 启动、移动网关启动 |
| `electron/main/ipcHandlers.js` | IPC handler 注册，连接前端页面与业务能力 |
| `electron/main/dbManager.js` | 当前最大业务数据访问/业务服务聚合文件 |
| `electron/main/mysqlConfig.js` | MySQL 配置读取，默认库名 `xianyu_agent` |
| `electron/main/mysqlAdapter.js` | MySQL adapter，模拟 SQLite 风格 API |
| `electron/main/pythonManager.js` | Python bridge 进程管理 |
| `electron/main/mobileGateway.js` | 移动公开访问/网关能力 |
| `electron/main/sfShippingService.js` | 顺丰寄件、费用、路由、时效相关封装 |
| `electron/main/depositClient.js` / `depositNotifyServer.js` | 免押接口和通知 |
| `electron/main/xianguanjiaClient.js` | 闲管家开放平台 |
| `electron/preload/preload.js` | 暴露 `window.electronAPI` 给 Vue |
| `electron/renderer/` | Vue 前端 |
| `electron/tests/` | Node 测试，覆盖运行模式、物流、网关、订单工具等 |

Electron 启动流程概览：

1. `electron/main/index.js` 配置运行数据目录。
2. 初始化 MySQL 数据管理器。
3. 创建启动快照。
4. 注册 IPC handlers。
5. 启动移动网关。
6. 创建 BrowserWindow。
7. 初始化并启动 Python bridge。
8. 定时执行归还档期和备份快照。

## Vue Renderer 结构

| 路径 | 说明 |
|---|---|
| `electron/renderer/src/router/index.js` | Hash 路由，共 17 个页面 |
| `electron/renderer/src/views/` | 控制台、设置、提示词、知识库 |
| `electron/renderer/src/views/rental/` | 租赁运营页面：订单、档期、设备、免押、顺丰、报表等 |
| `electron/renderer/src/components/` | 基础组件和业务组件 |
| `electron/renderer/src/services/` | 前端服务封装，包含免押、设备查找、Electron API client |
| `electron/renderer/src/stores/` | Pinia 状态：bot/config/ui |
| `electron/renderer/src/style.css` | 全局样式和设计 token |

当前前端已经有较完整的运营后台框架：侧边栏分组为工作台、订单与履约、会话协同、数据与运营、系统设置。

## Python 结构

| 路径 | 说明 | 判断 |
|---|---|---|
| `python/bridge.py` | Electron 与 Python JSON-lines bridge | 保留启动能力，但命名/说明 legacy |
| `python/main.py` | `XianyuLive`、闲鱼 WebSocket、token、消息处理 | legacy channel |
| `python/XianyuAgent.py` | LLM 自动回复 bot | legacy / 话术助手候选 |
| `python/XianyuApis.py` | 闲鱼 API | legacy channel |
| `python/channels/browser_runner.py` | 闲鱼 IM 浏览器模式 | legacy / 历史采集候选 |
| `python/context_manager.py` | 聊天上下文和历史数据 | 部分 legacy，历史数据需保留 |
| `python/config_manager.py` | Python 配置管理 | 保留但需配置治理 |
| `python/mysql_helper.py`, `python/mysql_config.py` | Python MySQL 连接 | 保留 |
| `python/services/` | 租赁业务、学习、报价、订单、档期、通知等服务 | 多数可保留 |
| `python/runtime/` | 会话处理模型和处理器 | legacy 包装后可保留 |
| `python/knowledge_base/` | 知识库管理与检索 | 可保留，需去闲鱼化 |

## scripts 结构

| 路径 | 说明 | 判断 |
|---|---|---|
| `scripts/start_xianyu_desktop.sh` | 桌面启动脚本，依赖 `XIANYU_ENV` | 启动能力保留，命名 legacy |
| `scripts/start_xianyu_desktop_local.sh` | local 启动 wrapper | legacy 命名 |
| `scripts/start_xianyu_desktop_production.sh` | production 启动 wrapper | legacy 命名 |
| `scripts/start_mobile_public_access.sh` | 移动公开访问启动 | 能力可保留，env 命名 legacy |
| `scripts/mysql_schema.sql` | MySQL schema | 保留，库名和部分表字段 legacy |
| `scripts/migrate_to_mysql.py` | SQLite 到 MySQL 迁移脚本 | 高风险，只记录 |
| `scripts/backup_mysql.js` | MySQL 备份脚本 | 保留，需配置治理 |
| `scripts/build-all.bat`, `build-python.bat` | Windows 构建脚本 | 保留 |

## config / data

| 路径 | 说明 |
|---|---|
| `config/environments/local.example.env` | 本地环境模板 |
| `config/environments/production.example.env` | 生产环境模板 |
| `config/environments/local.env` | 本地敏感配置，已忽略 |
| `mysql-connection.json` | 本地 MySQL 连接配置，已忽略 |
| `data/` | 日志、备份、session/cookies、导入文件，已忽略 |

## docs 结构

当前文档分为三类：

1. 当前真源：`docs/xiaogou-saas-roadmap/`
2. 历史/规划/开发参考：`docs/superpowers/`, `docs/rental-ops/`, `docs/design/`, `docs/deployment/`
3. 旧闲鱼相关说明：如 `docs/auto-reply-*`

Phase 00 判断：只以 `docs/xiaogou-saas-roadmap/` 和 `AGENTS.md` 作为当前产品方向真源，其它文档只能作为参考。
