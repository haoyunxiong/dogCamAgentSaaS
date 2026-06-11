# Phase 00 项目盘点总报告

执行日期：2026-06-12

执行目录：`/Users/lishuangshuang/Documents/租赁SAAS系统`

正式 Git remote：`git@github.com:haoyunxiong/dogCamAgentSaaS.git`

基线 commit：`492ef0a`

## 本次结论

当前项目是一个已经可运行的 Electron 桌面应用，前端为 Vue 3 + Vite，主进程承担启动、IPC、MySQL 数据访问、移动网关、顺丰、免押、报表等能力，Python 侧承担旧闲鱼会话通道、自动回复、知识库、学习、报价、档期、订单草稿等逻辑。

项目已经具备明显的租赁商户运营系统雏形：

- 订单履约：创建、查看、分组、编辑、批量发货、批量归还、续租、删除、导入。
- 档期能力：型号/单台设备占用、月视图、可用性查询、发货/租期/缓冲占用。
- 设备管理：型号、单台设备、编号、状态、成本、残值。
- 免押能力：免押订单创建、状态查询、通知、来源绑定、本地存储。
- 顺丰物流：寄件草稿、预校验、下单、查询路由、费用、时效、批量寄件。
- 数据报表：经营概览、收入报表、询单统计、设备效率。
- 配置能力：模型、提示词、顺丰、免押、闲管家、询单优化、市场监控等配置。
- 日志和运行状态：系统检查、机器人状态、运行日志、启动快照备份。

同时，项目仍然存在强闲鱼 legacy 绑定：

- 包名、窗口标题、数据库名、环境变量、启动脚本仍以 Xianyu/XIANYU/xianyu 命名。
- Python 主链路仍以 `XianyuLive`、闲鱼 WebSocket、cookies、token、闲鱼 IM 浏览器模式为核心。
- 多个字段和表仍以 `item_id`、`chat_id`、`session_id`、`xianyu_item_listings` 组织。
- 自动回复、提示词、消息审批、学习审核、市场监控、闲管家开放平台仍带有闲鱼客服/渠道属性。

Phase 00 的判断是：这些 legacy 模块不能直接删除。凡是能服务租赁业务主线的能力，应保留并在后续阶段去闲鱼化；只服务闲鱼消息流或闲鱼账号连接的逻辑，应降级为 legacy channel。

## artifacts 清单

- [current-structure.md](./current-structure.md)：当前目录结构与 Electron / Vue / Python / scripts / config / docs 说明。
- [routes-pages-components.md](./routes-pages-components.md)：前端路由、页面、组件和迁移判断。
- [core-capabilities.md](./core-capabilities.md)：当前可保留的核心业务能力。
- [legacy-xianyu-bindings.md](./legacy-xianyu-bindings.md)：旧闲鱼强绑定模块、字段、文案和处理建议。
- [data-model-audit.md](./data-model-audit.md)：数据库、配置、表、DAO/storage 位置与多商户预留判断。
- [risk-list.md](./risk-list.md)：改造风险清单。
- [keep-function-list.md](./keep-function-list.md)：必须保留/优先保留功能清单。
- [discard-or-legacy-list.md](./discard-or-legacy-list.md)：可舍弃、可降级、legacy 功能清单。
- [questions-to-user.md](./questions-to-user.md)：需要用户判断的问题。
- [phase-00-verification.md](./phase-00-verification.md)：本次执行前后 Git 状态和只改 artifacts 验证。

## Phase 00 验收状态

| 验收项 | 当前状态 | 说明 |
|---|---|---|
| 项目结构说明完成 | 已完成 | 见 `current-structure.md` |
| 保留功能清单完成 | 已完成 | 见 `keep-function-list.md` |
| 废弃/legacy 功能清单完成 | 已完成 | 见 `discard-or-legacy-list.md` 与 `legacy-xianyu-bindings.md` |
| AGENTS.md 生效 | 已完成 | 本次先读真源，再计划，确认后只写 artifacts |
| 无业务代码改动 | 已完成 | `git diff --name-only` 全部位于 Phase 00 artifacts 目录 |
| 没有跨阶段开发 | 已完成 | 未开发 Phase 01+ 功能 |
| 必要结果写入 artifacts | 已完成 | 本目录多文件清单已更新 |
| 用户确认验收结果 | 待用户确认 | Codex 不自动进入 Phase 01 |

## 关键判断

1. 新产品主线应围绕订单、档期、设备、物流、免押、员工 SOP、经营数据展开。
2. 闲鱼不应继续作为产品核心架构，只能作为 legacy channel 或渠道集成候选。
3. 当前数据模型已有 `stores`、`store_id`、`source_channel`、`source_name` 等 SaaS/多渠道线索，但还不是完整多商户隔离。
4. 当前配置和敏感配置分散在 MySQL config、env、`mysql-connection.json`、前端设置页、第三方平台配置里，后续需要统一治理。
5. `CR-0001_配置中心与敏感配置治理` 建议进入 Phase 03 SaaS 底座阶段，不在 Phase 00 开发。

## 是否建议进入 Phase 01

暂不自动进入 Phase 01。

建议流程：

1. 用户先阅读本次 artifacts。
2. 用户确认 `questions-to-user.md` 中的问题。
3. 用户执行 Phase 00 验收确认。
4. 只有用户明确确认“本阶段通过验收，可以进入下一阶段”后，才更新阶段状态并准备 Phase 01。
