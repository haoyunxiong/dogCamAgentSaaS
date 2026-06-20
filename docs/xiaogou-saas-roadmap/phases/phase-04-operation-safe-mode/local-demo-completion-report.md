# Phase 04 Local Demo Completion Report

本文档记录 Phase 04 阶段 3D 到阶段 6 的本地完整 Demo 收口状态。

## 完成范围

- 阶段 3D：`xianyu.order.sync` 闲鱼 mock / sandbox 同步预览网关完成；
- 阶段 3 收口：顺丰、免押、闲鱼 external preview-only 能力统一收口；
- 阶段 4：本地 actor / role / merchant / store context 与 permission gating 完成；
- 阶段 5：本地 health check / readiness checklist 完成；
- 阶段 6：Dashboard / Orders / Devices / Schedule / Logistics / Deposit / Settings 本地 Demo 页面闭环完成。
- 本地配置中心：Settings / Dashboard 已接入本地 MySQL `stores` / `config` 非敏感配置读取保存，敏感凭证只显示 configured / missing 状态。
- Desktop 产品语义与信息架构加固：桌面端核心页面已从数据库记录展示调整为运营任务视图；Orders 默认进行中、Devices 默认型号视图、Schedule 双视图、Logistics 区分发货任务与物流记录、Customers 派生风险标注系统派生、Reports 展示数据覆盖周期、Settings 收敛为七个模块。

## 当前内部写 operationTypes

当前仅以下 operationTypes 可通过 safeOps gated execute 写入本地 DB：

- `order.internal_note.update`
- `device.basic.update`
- `schedule.block.create`
- `schedule.block.cancel`
- `logistics.local_record.create`

其它 operationType execute 必须继续返回 disabled / blocked。

## 当前外部 preview operationTypes

当前 external provider 与 preview-only operationTypes：

- `sf_express`：`logistics.sf.create_order`
- `deposit_service`：`deposit.create` / `deposit.finish`
- `xianyu_platform`：`xianyu.order.sync`

外部统一边界：

- `disabled`：返回 `SAFE_OP_EXTERNAL_DISABLED`；
- `mock`：生成 mock preview；
- `sandbox`：生成 sandbox payload preview；
- `real`：返回 disabled / blocked；
- external execute 全 disabled；
- 不发送 HTTP；
- 不调用 Python；
- 不引入外部 SDK；
- 不写业务表。

## 权限与商户上下文

本地 Demo 使用最小上下文，不实现真实登录：

- `owner`：可执行内部安全操作，并可查看外部 preview；
- `operator`：可执行阶段 1/2 内部安全操作；
- `viewer`：只读，不允许 execute；
- `merchantId` / `storeId`：作为本地 Demo 商户与门店隔离上下文进入 safeOps request / audit metadata。

## Health / Readiness

本地 health check 覆盖：

- 本地 DB / safeOps persistence；
- `schema_migrations` ledger；
- safeOps `operation_*` tables；
- external real disabled；
- rollback executor unavailable；
- gated internal operations；
- 本地配置中心 `stores` / `config` 可用性；
- 敏感配置脱敏状态；
- UI-V2 Demo route 配置状态。

## 本地配置中心

配置中心当前用于本地 Demo 的安全设置页，不是生产凭证中心。

当前已接入：

- `stores`：读取门店列表、默认门店、营业状态；允许保存门店名称、营业状态、默认门店；
- `config`：允许保存白名单内的非敏感配置，例如门店类型、区域、联系人、脱敏联系电话、邮箱、营业时间；
- `deposit_exemption_rules`：只读计数，用于显示免押规则数据状态；
- `sf_shipments` / `sf_shipment_events`：只读计数，用于显示顺丰本地数据状态；
- Settings / Dashboard：显示配置来源、门店数量、非敏感配置数量、敏感配置状态和外部真实调用关闭状态。

安全边界：

- 不返回敏感配置明文；
- 不保存 token / secret / cookie / password / webhook / card / auth / session 等敏感 key；
- 联系电话只保存脱敏展示值；
- 外部 API real execute 仍 disabled；
- 后续真实凭证接入必须通过 CredentialService 或等价加密存储方案。

## 页面入口

建议从 Dashboard 开始查看本地 Demo：

- `/#/ui-v2/dashboard`
- `/#/ui-v2/orders`
- `/#/ui-v2/devices`
- `/#/ui-v2/schedule`
- `/#/ui-v2/logistics`
- `/#/ui-v2/deposit`
- `/#/ui-v2/settings`

页面统一展示本地 Demo、安全预览、可审计、真实外部未开放的边界。

## Desktop IA Hardening 验收口径

- 订单中心：当前运营订单与历史归档分离，默认显示 `进行中`；
- 设备中心：默认型号分组视图，单机详情进入 Drawer；
- 档期中心：`型号余量总览` / `单机排期` 双视图，单格语义为总量、可用、占用、冲突；
- 客户中心：继续派生客户视图，风险标注为系统派生；
- 物流发货：发货任务与物流记录分离，不再把全部订单当物流记录；
- 免押管理：展示接口同步、本地缓存、订单关联和状态时间线；
- 报表中心：展示数据覆盖范围，空周期不绘制假趋势；
- Dashboard：运营指标优先，系统状态折叠；
- Settings：七模块信息架构，凭证只显示已配置 / 未配置。

## 仍未开放

- rollback executor；
- audit list IPC；
- 顺丰真实下单；
- 免押真实创建 / 完结；
- 闲鱼真实同步；
- 真实账号 / 短信 / OAuth / 支付；
- 生产 DB migration；
- staging / production 上线流程；
- 商业化计费与订阅权限。

## 生产前必须补齐

- staging / production 环境隔离；
- production migration runbook；
- 备份与回滚演练；
- 真实权限 / 员工 / 商户 / 门店模型；
- 外部 API credential service；
- external idempotency / audit / compensation；
- 日志脱敏与错误监控；
- release candidate checklist。
