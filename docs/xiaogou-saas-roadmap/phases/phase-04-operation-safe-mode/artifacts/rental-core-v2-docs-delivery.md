# Rental Core V2 Docs Delivery

本文件记录 Phase 04 Operation Safe Mode 下的租赁核心业务流 V2 文档交付索引。

## 交付日期

2026-06-20

## 本轮边界

- 只新增文档、差异审计和 Markdown wireframe。
- 不修改业务代码。
- 不新增 DB migration。
- 不调用 Python。
- 不调用顺丰、免押、闲鱼或其它外部 API。
- 不修改 mobile。
- 不处理既有未提交改动。

## 项目级真源文档

| 文档 | 用途 |
|---|---|
| `docs/xiaogou-saas-roadmap/product-logic/rental-core-workflow-v2.md` | 租赁核心业务流 V2 真源，定义查档期、锁定、创单、免押、物流、归还验机、状态和权限 |
| `docs/xiaogou-saas-roadmap/product-logic/rental-core-gap-analysis-v2.md` | 当前系统与 V2 目标的差异审计，包含状态标签和后续任务拆解 |
| `docs/xiaogou-saas-roadmap/product-logic/rental-core-ui-flow-spec-v2.md` | 桌面端页面、抽屉、弹窗和交互设计规格 |
| `docs/xiaogou-saas-roadmap/product-logic/ui-flow-wireframes-v2/README.md` | Markdown wireframe，替代本轮未生成的静态截图 |

## 后续会话读取要求

后续凡涉及以下模块的功能设计、代码实现、数据库设计或 UI 调整，必须先读取上述项目级真源文档：

- 档期中心；
- 临时锁定；
- 创建订单；
- 订单详情；
- 设备管理；
- 免押；
- 发出物流；
- 归还物流；
- 归还验收；
- 报表；
- 工作台下一步动作。

## 当前阶段影响

- 业务逻辑：仅文档定义，无运行时影响。
- 数据库 schema：无影响。
- 外部 API：无影响。
- safeOps：无运行时变更。
- 既有 UI：无运行时变更。
