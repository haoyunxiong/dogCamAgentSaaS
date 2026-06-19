# 05 阶段状态表

## 当前阶段

```text
当前阶段：Phase 04 - Operation Safe Mode
当前状态：Phase 04 阶段 3C 免押 mock/sandbox 预览网关完成 / 已开放 5 个 gated internal write operationTypes / 外部 real API 与 rollback 仍关闭
是否允许写代码：是（仅限 Phase 04 safeOps 安全闭环；真实 write 必须逐项 gated enable）
是否允许操作 Figma：否
是否允许改数据库：是（仅限用户已确认的本地 additive migration；不得操作生产库）
是否允许跨阶段开发：否
```

## 当前阶段待办

- [x] Phase 03 / UI-V2 Full MVP Readonly + Aggregation + Visualization 已完成
- [x] Phase 03 readonly checkpoint commit：caa056c
- [x] Orders 真实只读完成
- [x] Devices 真实只读完成
- [x] Schedule 真实只读完成
- [x] Customers 派生只读完成
- [x] Dashboard / Workbench 基础真实聚合完成
- [x] Reports 基础真实聚合完成
- [x] Logistics 只读物流可视化完成
- [x] Deposit 本地缓存只读免押视图完成
- [x] UI-V2 readonly 全路由验收通过
- [x] Phase 03 未修改 main / preload / IPC / DB / Python
- [x] Phase 03 未实现真实写操作
- [x] Phase 04 Operation Safe Mode 计划会话已完成
- [x] Phase 04 Operation Safe Mode 文档落档
- [x] safeOps policy / preview 后端骨架完成
- [x] UI-V2 safeOps disabled preview entries 完成
- [x] 8 类 operation dry-run preview 完成
- [x] safeOps migration scaffolding 已完成
- [x] protected migration runner 已准备
- [x] safeOps persistence / crypto / repository skeleton 完成，默认 noop 不落库
- [x] safeOps execute disabled skeleton 完成，未新增 execute IPC / preload
- [x] Orders / Devices / Schedule dry-run 方案确认
- [x] audit / idempotency / confirm DB 方案确认
- [x] Logistics / Shipping safe mode 方案确认
- [x] Deposit / Approval safe mode 方案确认
- [x] DB migration 本地执行经用户确认并已 apply
- [x] audit / idempotency / confirm / rollback-plan DB persistence 接入
- [x] Phase 04+ 后续六阶段快速推进路线图已落档
- [x] 阶段 1A 已完成：`rental_orders.internal_note` 受控 additive migration 已本地 apply
- [x] 阶段 1B 已完成：`order.internal_note.update` 首个低风险内部写闭环已打通
- [x] 内部 DB write 安全模式确认（首个低风险 operation 已通过 safeOps 验证）
- [x] 阶段 2A 已完成：`device.basic.update` 设备基础字段更新闭环已打通
- [x] 阶段 2B 已完成：`schedule.block.create` / `schedule.block.cancel` 档期 block 创建与取消闭环已打通
- [x] 阶段 2C 已完成：`logistics.local_record.create` 物流本地发货记录创建闭环已打通
- [x] 阶段 2 收口已完成：5 个 gated internal write operationTypes 统一验收通过
- [x] 阶段 3A 已完成：外部 API 安全网关骨架已落地，provider policy / mode / disabled execute guard 已接入
- [x] 阶段 3B 已完成：`logistics.sf.create_order` 顺丰 mock/sandbox payload preview-only 网关已接入，真实顺丰调用仍 disabled
- [x] 阶段 3C 已完成：`deposit.create` / `deposit.finish` 免押 mock/sandbox payload preview-only 网关已接入，真实免押调用仍 disabled
- [ ] 真实外部 write 开关经用户单独确认

## 当前下一步

```text
Phase 04 Operation Safe Mode：阶段 3C 免押 mock/sandbox 预览网关完成。safeOps preview 已接入本地 DB persistence；阶段 1B `order.internal_note.update`、阶段 2A `device.basic.update`、阶段 2B `schedule.block.create` / `schedule.block.cancel`、阶段 2C `logistics.local_record.create` 已开放为受控内部写 operation；`logistics.sf.create_order`、`deposit.create`、`deposit.finish` 仅支持 disabled / mock / sandbox preview，外部 gateway real mode 仍 disabled。
```

Phase 04 已进入逐项 gated 内部写模式。当前仅以下 operationType 可通过 safeOps execute 写入本地 DB：

- `order.internal_note.update`：仅写入 `rental_orders.internal_note`；
- `device.basic.update`：仅写入 `schedule_units.city` / `schedule_units.note` / 受限 `schedule_units.status`，并更新 `updated_at`；
- `schedule.block.create`：仅插入一条本地 `schedule_blocks` 记录，必须通过同设备同日期区间冲突检查；
- `schedule.block.cancel`：仅软取消一条本地 `schedule_blocks` 记录，禁止物理删除；
- `logistics.local_record.create`：仅插入一条本地 `shipping_records` 记录，订单只读校验，不更新订单状态，不调用外部物流服务。

其它 operationType execute 仍返回 `SAFE_OP_EXECUTE_DISABLED`，不开放 rollback IPC / audit:list IPC。

当前 checkpoint：

```text
47fc820 feat: add sf express preview gateway
```

阶段 2 收口结论：

- 当前共有 5 个 gated internal write operationTypes；
- 外部 API 仍全部 disabled，不调用顺丰、免押、闲鱼、Python 或其它外部写服务；
- rollback executor 仍 unavailable，仅保留 `not_executable` placeholder；
- 其它 operationType execute 仍必须返回 `SAFE_OP_EXECUTE_DISABLED`；
- UI-V2 页面仍必须通过 domain adapter / safeOps adapter，不得直接调用底层写 IPC；
- 页面服务验证后保持运行，便于继续从 UI 查看效果。

阶段 3 下一步：

- 阶段 3A 已完成 external gateway skeleton；
- 阶段 3B 已完成 `logistics.sf.create_order` 顺丰 mock/sandbox preview-only；
- 阶段 3C 已完成 `deposit.create` / `deposit.finish` 免押 mock/sandbox preview-only；
- 当前 provider：`sf_express`、`deposit_service`、`xianyu_platform`；
- 当前 mode 枚举：`disabled`、`mock`、`sandbox`、`real`；
- 当前默认 mode：`disabled`；
- 当前 external operationType：`logistics.sf.create_order`、`logistics.sf.cancel_order`、`deposit.create`、`deposit.finish`、`xianyu.order.sync`；
- 当前 `logistics.sf.create_order`：mock / sandbox 只生成脱敏 payload preview 与 mock waybill / sandbox payload shape，不发送 HTTP，不写 `shipping_records`；
- 当前 `deposit.create` / `deposit.finish`：mock / sandbox 只生成脱敏 payload preview 与 mock deposit / sandbox payload shape，不发送 HTTP，不要求 `deposit_orders`，不写 `rental_orders`；
- 阶段 3 不是直接开放真实外部调用；
- 后续必须先 mock / sandbox，再经二次确认、external idempotency、external audit 和失败补偿后，才允许单独评估 real 接入。

真实写操作必须先具备：

- `safeOps` 统一入口；
- `dry-run` 影响预览；
- `confirmToken` 二次确认；
- `idempotencyKey` 幂等保护；
- `audit log` 操作审计；
- before / after snapshot；
- rollback / compensation 方案；
- permission / actor 记录。

未获得用户单独确认前，不允许：

- 顺丰真实下单；
- 免押真实审核、创建、完结、取消；
- 新增 DB migration；
- 真实外部账号 / 密钥 / 授权接入；
- 无 `confirmToken` / `idempotencyKey` 的真实执行；
- UI-V2 页面直接调用底层写 IPC。

阶段 1A 边界：

- 新增字段：`rental_orders.internal_note`；
- 字段用途：商家内部备注 / 内部标记，仅供本地内部操作使用；
- 不同步顺丰、免押、闲鱼或其它外部平台；
- 不改变订单状态、金额、客户、地址、租期、设备、档期或物流字段；
- 不开放外部 API；
- 阶段 1B 已在 safeOps 下开放单一 operationType：`order.internal_note.update`。

阶段 1B 边界：

- 唯一真实写 operationType：`order.internal_note.update`；
- 写入目标仅限：`rental_orders.internal_note`；
- 必须经过：`preview -> confirm token -> idempotency -> audit -> execute -> after snapshot`；
- preview 会写入 audit / confirm token hash / idempotency key / rollback placeholder；
- execute 会校验本地 DB target、actor、confirm token、payload hash、impact hash、idempotency；
- 重复 execute 返回 idempotent duplicate / same-result，不重复 UPDATE；
- rollback 仍为 `not_executable` placeholder；
- 顺丰、免押、闲鱼、Python、外部 API 仍禁用。

阶段 2A 边界：

- 真实写 operationType：`device.basic.update`；
- 写入目标仅限：`schedule_units.city`、`schedule_units.note`、受限 `schedule_units.status`、`updated_at`；
- 禁止更新：`model_code`、`unit_code`、`serial_no`、`purchase_cost`、`residual_value`；
- 必须经过：`preview -> confirm token -> idempotency -> audit -> execute -> after snapshot`；
- status 只允许受限低风险值，且状态变更前必须重新检查 active/current-future schedule block 与未完成订单；
- rollback 仍为 `not_executable` placeholder；
- 删除设备、批量更新、库存重算、档期/订单/物流联动、外部 API 仍禁用。

阶段 2B 边界：

- 真实写 operationType：`schedule.block.create` / `schedule.block.cancel`；
- `schedule.block.create` 只允许单条本地 `schedule_blocks` insert；
- `schedule.block.cancel` 只允许把单条 `schedule_blocks.status` 软更新为 `cancelled`；
- create 必须重新读取 `schedule_units`，校验 `model_code`，并重新检查同 `unit_id` 日期区间 active/current block 冲突；
- cancel 必须重新读取目标 block，已取消 / 已停用 / 不存在时阻断；
- 必须经过：`preview -> confirm token -> idempotency -> audit -> execute -> after snapshot`；
- 禁止批量锁库、物理删除、订单/设备/物流/免押联动、Python 或外部 API；
- rollback 仍为 `not_executable` placeholder。

阶段 2C 边界：

- 真实写 operationType：`logistics.local_record.create`；
- 写入目标仅限：单条本地 `shipping_records` insert；
- 必须只读校验 `rental_orders` 中 `order_id` 存在；
- 必须检查相同 `order_id + carrier + tracking_no` 是否已有记录；
- 必须经过：`preview -> confirm token -> idempotency -> audit -> execute -> after snapshot`；
- 禁止顺丰真实下单、预下单、查询、取消、费用写入；
- 禁止修改订单状态、档期、设备、免押或外部平台；
- rollback 仍为 `not_executable` placeholder。

阶段 3B 边界：

- preview-only operationType：`logistics.sf.create_order`；
- provider：`sf_express`；
- 默认 mode：`disabled`；
- `mode=mock`：只生成 mock waybill preview，不真实下单；
- `mode=sandbox`：只生成 sandbox payload preview，不发送请求；
- `mode=real`：必须返回 disabled / blocked；
- `execute`：必须返回 `SAFE_OP_EXTERNAL_DISABLED`；
- `externalCallWillExecute=false`、`writeWillExecute=false` 必须始终成立；
- preview 可写 audit / confirm token hash / idempotency / rollback placeholder；
- 禁止 HTTP / fetch / axios / request / Python / 顺丰 SDK；
- 禁止写 `shipping_records`、订单状态、设备、档期、免押或任何外部平台；
- 敏感字段必须脱敏，不输出手机号、地址、姓名、token、cookie、API key 明文；
- rollback executor 仍为 unavailable。

阶段 3C 边界：

- preview-only operationType：`deposit.create` / `deposit.finish`；
- provider：`deposit_service`；
- 默认 mode：`disabled`；
- `mode=mock`：只生成 mock deposit preview，不真实创建或完结免押；
- `mode=sandbox`：只生成 sandbox payload preview，不发送请求；
- `mode=real`：必须返回 disabled / blocked；
- `execute`：必须返回 `SAFE_OP_EXTERNAL_DISABLED`；
- `externalCallWillExecute=false`、`writeWillExecute=false` 必须始终成立；
- preview 可写 audit / confirm token hash / idempotency / rollback placeholder；
- 不要求 `deposit_orders` 存在；
- 禁止 HTTP / fetch / axios / request / Python / 免押 SDK；
- 禁止写 `rental_orders`、订单状态、设备、档期、物流、免押或任何外部平台；
- 敏感字段必须脱敏，不输出手机号、地址、姓名、证件、paymentAccount、token、cookie、API key 明文；
- rollback executor 仍为 unavailable。

Phase 04 文档入口：

- `docs/xiaogou-saas-roadmap/phases/phase-04-operation-safe-mode/README.md`
- `docs/xiaogou-saas-roadmap/phases/phase-04-operation-safe-mode/operation-safe-mode-plan.md`
- `docs/xiaogou-saas-roadmap/phases/phase-04-operation-safe-mode/phase-04-plus-six-stage-roadmap.md`

Phase 04+ 后续六阶段：

1. 首个低风险内部写操作闭环；
2. 扩展内部写操作；
3. 外部 API 安全网关；
4. 权限、账号、商户隔离；
5. 生产环境迁移与上线准备；
6. 产品闭环与商业化完善。

## Phase 02 / UI-V2 历史待办记录

- [x] Phase 02A Product Design / 产品设计输入整理完成
- [x] Phase 02A checkpoint commit：04f65c9
- [x] Phase 02B Figma Design System 已完成并保留为设计资产
- [x] 最终 UI 风格归档已完成
- [x] 最终 UI 风格归档 docs checkpoint commit：582bda7
- [x] 网页端和手机端 UI 方向已冻结
- [x] Phase 02C-01 / 02C-02 已完成 Token、基础组件、App Shell、Sidebar、Topbar 初步改造
- [x] Phase 02C 真实系统 UI 改造暂停
- [ ] UI-V2 Demo 产品设计方案确认
- [ ] `prototypes/ui-v2-demo` 独立 Demo 范围确认
- [ ] PC 端 Demo 体验结构确认
- [ ] Mobile 端 Demo 体验结构确认
- [ ] Demo mock 数据范围确认
- [ ] Demo 视觉和交互评审通过

## UI-V2 Demo 历史下一步记录

```text
Figma 组件审计与校准 + Frontend Design Spec / UI 改造计划
```

当前暂停继续修改真实业务页面。

未获得用户明确授权前，不允许创建 Demo、不允许操作 Figma、不允许提交 Git。

后续 UI/UX、Figma 校准、前端 UI 改造必须以最终 UI 归档为准，核心文档包括：

- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/final-ui-style-lock.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/frontend-implementation-brief.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/page-component-mapping.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/mobile-ui-guidelines.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/final-ui-assets-index.md`

当前工作区存在执行前遗留的 `electron/` 和 `prototypes/` 变更，需要单独审查处理，不属于最终 UI 风格归档。

## Phase 02 路线调整记录

- [x] Phase 02B Figma Design System 已完成并保留。
- [x] Phase 02C 真实系统 UI 改造暂停在 02C-02。
- [x] 暂停 Phase 02C-03 订单中心真实系统改造。
- [x] 不继续在 `electron/renderer/src/views` 上做页面重构。
- [x] 后续先通过独立 UI-V2 Demo 验证最终产品体验。

## Phase 00 验收结果

- [x] 当前项目结构说明完成
- [x] 保留功能清单完成
- [x] 废弃/legacy 功能清单完成
- [x] 新产品定位确认
- [x] Codex 没有修改业务代码
- [x] 用户确认可以进入 Phase 01

## Phase 01 验收结果

- [x] 产品定位确认
- [x] 导航确认
- [x] 核心业务流程确认
- [x] 模块边界确认
- [x] 用户同意先做内部提效系统
- [x] 用户确认可以进入 Phase 02

## 进入后续迁移阶段条件

- [ ] UI-V2 Demo 的 PC 端体验通过评审
- [ ] UI-V2 Demo 的 Mobile 端体验通过评审
- [ ] 新产品整体视觉风格确认
- [ ] 新产品交互结构确认
- [ ] 明确旧系统业务能力迁移范围和顺序
- [ ] 用户确认可以进入后续迁移阶段

## 阶段状态更新规则

只有用户明确确认“本阶段通过验收，可以进入下一阶段”后，Codex 才允许更新当前阶段。
