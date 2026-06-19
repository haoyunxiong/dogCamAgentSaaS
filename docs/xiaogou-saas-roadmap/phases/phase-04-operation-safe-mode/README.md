# Phase 04 Operation Safe Mode

本目录记录 Phase 04 真实写操作进入实现前的安全模式计划。

当前结论：

- Phase 03 / UI-V2 Full MVP Readonly + Aggregation + Visualization 已完成；
- 关键 checkpoint：`caa056c`；
- Phase 04 已完成 safeOps policy / preview / 8 类 dry-run preview；
- UI-V2 已接入 disabled preview entry，页面仍不直接调用底层 bridge；
- safeOps migration SQL / rollback SQL / protected runner 已准备，本地测试库已 apply；
- safeOps persistence / crypto / repository 已接入本地 safeOps 表，DB 不可用时安全降级 noop；
- safeOps execute gated skeleton 已完成，`safeOps:execute` / preload 仅允许逐项 gated operation；
- Phase 04+ 后续六阶段快速推进路线图已落档；
- 阶段 1A 已完成：为首个低风险内部写操作新增 `rental_orders.internal_note` additive schema；
- 阶段 1B 已完成：首个真实内部写 `order.internal_note.update` 已通过 safeOps 闭环开放；
- 阶段 2 已完成：设备基础字段、档期 block 创建 / 取消、物流本地发货记录创建已统一收口；
- 阶段 3A 已完成：外部 API 安全网关骨架已落地，real mode 默认 disabled；
- 阶段 3B 已完成：`logistics.sf.create_order` 顺丰 mock/sandbox preview-only 网关已接入，真实顺丰调用仍 disabled；
- 阶段 3C 已完成：`deposit.create` / `deposit.finish` 免押 mock/sandbox preview-only 网关已接入，真实免押调用仍 disabled；
- Phase 04 当前仅开放五个真实内部写 operation，另有顺丰与免押外部 preview-only operation，其它 execute 仍 disabled。

阶段 2 收口 checkpoint：

```text
24476ec feat: enable safeops logistics local record create
```

核心原则：

- UI-V2 页面不得直接调用底层写 IPC；
- 后续真实写操作必须通过统一 `safeOps`；
- 所有高风险操作必须先 `dry-run`，再二次确认，再审计执行；
- 当前 execute 仅允许 `order.internal_note.update`、`device.basic.update`、`schedule.block.create`、`schedule.block.cancel`、`logistics.local_record.create`；
- 其它 operationType execute 一律返回 `SAFE_OP_EXECUTE_DISABLED`；
- `logistics.sf.create_order` 仅允许 disabled / mock / sandbox preview，execute 一律返回 `SAFE_OP_EXTERNAL_DISABLED`；
- `deposit.create` / `deposit.finish` 仅允许 disabled / mock / sandbox preview，execute 一律返回 `SAFE_OP_EXTERNAL_DISABLED`；
- 顺丰真实下单、免押真实审核、新增 DB migration 都需要用户单独确认。

当前已支持的 dry-run preview operation：

- `order.status.transition.preview`
- `order.edit.preview`
- `device.update.preview`
- `device.delete.preview`
- `schedule.block.preview`
- `logistics.shipment.preview`
- `deposit.create.preview`
- `deposit.finish.preview`

当前未开放：

- 除 `order.internal_note.update` / `device.basic.update` / `schedule.block.create` / `schedule.block.cancel` / `logistics.local_record.create` 之外的其它 `safeOps.execute` operation；
- `safeOps.rollback`；
- `safeOps.audit:list`；
- 除 `rental_orders.internal_note`、`schedule_units` 低风险基础字段、单条 `schedule_blocks` 创建 / 软取消、单条本地 `shipping_records` 创建之外的真实业务表 write；
- 顺丰 / 免押真实外部写入；
- 顺丰真实下单、预下单、取消、查询、费用写入或外部 tracking 写入。
- 免押真实创建、完结、取消、查询、资金或信用状态写入；
- 新增 `deposit_orders` 表或写入免押业务表。

当前 DB persistence 范围：

- `operation_audit_logs`：记录 preview / blocked / disabled / failed；
- `operation_confirm_tokens`：只保存 token hash，不保存完整 token；
- `operation_idempotency_keys`：按 actor + operationType + payloadHash 生成稳定幂等记录；
- `operation_rollback_plans`：仅创建 `not_executable` placeholder，不开放 rollback executor。

当前仍然禁止：

- 新增 `safeOps:rollback` / `safeOps:audit:list` IPC；
- 通过 `safeOps:execute` 执行五个 gated internal write operationTypes 以外的 operationType；
- 修改订单状态、设备高风险字段、档期批量锁库、外部物流状态、免押等未开放业务表能力；
- 调用顺丰、免押或其他外部写接口；
- 展示完整 confirm token。

## 阶段 1A：订单内部备注 additive schema

阶段 1A 只为阶段 1 的首个低风险内部写闭环准备写入目标字段。

新增字段：

- 表：`rental_orders`
- 字段：`internal_note`
- 类型：`TEXT NULL`
- 用途：商家内部备注 / 内部标记，仅本地内部操作使用

安全边界：

- 不同步外部平台；
- 不调用顺丰、免押、闲鱼或其它外部 API；
- 不改变订单状态、金额、客户、地址、租期、设备、档期或物流字段；
- 不写业务数据；
- 不开放外部 API；
- 后续阶段 1B 只允许开放单一 operationType：`order.internal_note.update`。

## 阶段 1B：订单内部备注真实写闭环

阶段 1B 已开放首个低风险内部写 operation：

- operationType：`order.internal_note.update`
- 写入目标：`rental_orders.internal_note`
- 风险等级：`low`
- scope：`internal-db-only`
- 外部调用：禁用
- rollback：仅保留 `not_executable` placeholder

闭环要求：

- `preview` 读取目标订单 before snapshot；
- `preview` 写入 audit log、confirm token hash、idempotency key、rollback placeholder；
- `execute` 校验本地 DB target、actor、confirm token、payload hash、impact hash、idempotency；
- `execute` 只执行 `UPDATE rental_orders SET internal_note = ? WHERE id = ?`；
- 成功后 audit status 更新为 `executed`；
- idempotency 记录保存 same-result response；
- 重复 execute 返回 duplicate / same-result，不重复 UPDATE；
- 页面通过 UI-V2 safeOps adapter 触发，不直接访问底层 bridge。

## 阶段 2 收口：内部写操作统一验收

阶段 2 已统一收口完成。当前共有 5 个 gated internal write operationTypes：

- `order.internal_note.update`；
- `device.basic.update`；
- `schedule.block.create`；
- `schedule.block.cancel`；
- `logistics.local_record.create`。

统一验收边界：

- 5 个 operation 均必须经过 `preview -> confirm token -> idempotency -> audit -> execute -> after snapshot`；
- 其它 operationType execute 仍返回 `SAFE_OP_EXECUTE_DISABLED`；
- rollback executor 仍 unavailable，只保留 `not_executable` placeholder；
- 顺丰、免押、闲鱼、Python 和其它外部 API 仍全部 disabled；
- UI-V2 页面仍不得直接调用底层写 IPC、`fetch` 或 `axios`；
- 页面服务验证后保持运行，便于继续从页面查看效果。

阶段 3 下一步是外部 API 安全网关，不是直接开放真实外部调用。顺丰、免押、闲鱼等外部写能力必须默认 disabled，并先经过 mock / sandbox、二次确认、external idempotency、external audit 和失败补偿设计。

## 阶段 3A：外部 API 安全网关骨架

阶段 3A 已完成 external gateway skeleton。该阶段只建立外部写安全边界，不接入任何真实外部 API。

Provider：

- `sf_express`；
- `deposit_service`；
- `xianyu_platform`。

Mode：

- `disabled`；
- `mock`；
- `sandbox`；
- `real`。

当前默认：

- `currentMode=disabled`；
- `realEnabled=false`；
- `sandboxEnabled=false`；
- `mockEnabled=false`；
- `externalWritesEnabled=false`；
- `executeExternalOperation` 始终返回 disabled / blocked；
- 不读取或输出真实 token、cookie、key；
- 不调用 Python；
- 不发送外部请求；
- 不修改业务表；
- 不新增 DB migration。

当前 external operationType：

- `logistics.sf.create_order`；
- `logistics.sf.cancel_order`；
- `deposit.create`；
- `deposit.finish`；
- `xianyu.order.sync`。

阶段 3A UI 边界：

- Orders / Logistics 的顺丰入口只显示“外部真实调用未开放 / gateway disabled”；
- Deposit 的免押创建 / 完结入口只显示“外部真实调用未开放 / gateway disabled”；
- 不启用真实外部按钮；
- 页面服务验证后保持运行。

## 阶段 3B：顺丰 mock/sandbox 预览网关

阶段 3B 已为顺丰创建运单建立 preview-only 外部网关能力。

- operationType：`logistics.sf.create_order`
- provider：`sf_express`
- 默认 mode：`disabled`
- `mode=mock`：生成 mock waybill preview，不真实下单；
- `mode=sandbox`：生成 sandbox payload preview，不发送 HTTP；
- `mode=real`：返回 disabled / blocked；
- execute：始终返回 `SAFE_OP_EXTERNAL_DISABLED`；
- `writeWillExecute=false`；
- `externalCallWillExecute=false`。

阶段 3B persistence：

- mock / sandbox preview 可写入 `operation_audit_logs`；
- mock / sandbox preview 可写入 confirm token hash；
- mock / sandbox preview 可写入 idempotency key；
- mock / sandbox preview 可写入 rollback placeholder；
- rollback executor 仍为 unavailable。

阶段 3B UI 边界：

- Logistics 页面将顺丰预览与本地 `shipping_records` 创建分开；
- 页面显示“顺丰预览 / 不真实下单 / 外部真实调用未开放 / 当前仅 mock/sandbox payload 预览”；
- 真实下单按钮保持 disabled；
- 不显示手机号、地址、姓名、token、cookie、API key 明文。

阶段 3B 禁止：

- 调用顺丰真实 API、sandbox API 或任何 HTTP 请求；
- 引入顺丰 SDK、axios、request、node-fetch；
- 调用 Python；
- 写 `shipping_records`；
- 修改订单状态、设备、档期、免押或外部平台；
- 新增 DB migration；
- 开放 rollback executor。

## 阶段 3C：免押 mock/sandbox 预览网关

阶段 3C 已为免押创建 / 完结建立 preview-only 外部网关能力。

- operationType：`deposit.create` / `deposit.finish`
- provider：`deposit_service`
- 默认 mode：`disabled`
- `mode=mock`：生成 mock deposit preview，不真实创建或完结免押；
- `mode=sandbox`：生成 sandbox payload preview，不发送 HTTP；
- `mode=real`：返回 disabled / blocked；
- execute：始终返回 `SAFE_OP_EXTERNAL_DISABLED`；
- `writeWillExecute=false`；
- `externalCallWillExecute=false`；
- 不要求 `deposit_orders` 表存在。

阶段 3C persistence：

- mock / sandbox preview 可写入 `operation_audit_logs`；
- mock / sandbox preview 可写入 confirm token hash；
- mock / sandbox preview 可写入 idempotency key；
- mock / sandbox preview 可写入 rollback placeholder；
- rollback executor 仍为 unavailable。

阶段 3C UI 边界：

- Deposit 页面显示“免押预览 / 不真实创建免押 / 不真实完结免押 / 外部真实调用未开放 / 当前仅 mock/sandbox payload 预览”；
- 真实免押创建 / 完结按钮保持 disabled；
- 不显示手机号、地址、姓名、证件、paymentAccount、token、cookie、API key 明文；
- 保持本地缓存 / 只读数据兼容。

阶段 3C 禁止：

- 调用免押真实 API、sandbox API 或任何 HTTP 请求；
- 引入免押 SDK、axios、request、node-fetch；
- 调用 Python；
- 新增 `deposit_orders` 表；
- 写 `rental_orders`；
- 修改订单状态、设备、档期、物流或外部平台；
- 新增 DB migration；
- 开放 rollback executor。

## 阶段 2B：档期 block 创建 / 取消真实写闭环

阶段 2B 已开放两个受控内部写 operation：

- operationType：`schedule.block.create`
- 写入目标：单条 `schedule_blocks` insert
- 风险等级：`medium-high`
- scope：`internal-db-only`
- 外部调用：禁用
- rollback：仅保留 `not_executable` placeholder

- operationType：`schedule.block.cancel`
- 写入目标：单条 `schedule_blocks.status = cancelled` soft cancel
- 风险等级：`medium`
- scope：`internal-db-only`
- 外部调用：禁用
- rollback：仅保留 `not_executable` placeholder

闭环要求：

- `preview` 读取目标 `schedule_units` / `schedule_blocks` before snapshot；
- `schedule.block.create` 必须校验 `unit_id`、`model_code`、日期区间、block type、初始 status；
- `schedule.block.create` 必须只读检查同 `unit_id` 日期区间 active/current block 冲突；
- `schedule.block.cancel` 必须校验目标 block 存在且未取消 / 未停用；
- `preview` 写入 audit log、confirm token hash、idempotency key、rollback placeholder；
- `execute` 重新校验本地 DB target、actor、confirm token、payload hash、impact hash、idempotency；
- `execute` 重新做 create 冲突检查或 cancel 当前状态检查；
- `execute` 仅允许单条 insert 或单条 soft cancel；
- 成功后 audit status 更新为 `executed`；
- idempotency 记录保存 same-result response；
- 重复 execute 返回 duplicate / same-result，不重复 insert / UPDATE；
- 页面通过 UI-V2 safeOps adapter 触发，不直接访问底层 bridge。

阶段 2B 禁止：

- 批量锁库；
- 物理删除 `schedule_blocks`；
- 修改订单、设备、物流、免押表；
- 调用 Python、顺丰、免押、闲鱼或任何外部 API；
- 开放 rollback executor。

## 阶段 2C：物流本地发货记录创建真实写闭环

阶段 2C 已开放一个受控内部写 operation：

- operationType：`logistics.local_record.create`
- 写入目标：单条 `shipping_records` insert
- 风险等级：`medium`
- scope：`internal-db-only`
- 外部调用：禁用
- rollback：仅保留 `not_executable` placeholder

闭环要求：

- `preview` 只读校验目标订单存在；
- `preview` 检查相同 `order_id + carrier + tracking_no` 是否已有记录；
- `preview` 写入 audit log、confirm token hash、idempotency key、rollback placeholder；
- `execute` 重新校验本地 DB target、actor、confirm token、payload hash、impact hash、idempotency；
- `execute` 重新校验订单存在和重复记录不存在；
- `execute` 只允许单条 `shipping_records` INSERT；
- 成功后 audit status 更新为 `executed`；
- idempotency 记录保存 same-result response；
- 重复 execute 返回 duplicate / same-result，不重复 INSERT；
- 页面通过 UI-V2 safeOps adapter 触发，不直接访问底层 bridge。

阶段 2C 禁止：

- 顺丰真实下单、预下单、取消、查询；
- 调用免押、闲鱼、Python 或任何外部 API；
- 修改 `rental_orders` 订单状态或物流状态；
- 修改 `schedule_blocks`、`schedule_units`；
- 物理删除物流记录；
- 开放 rollback executor。

## 阶段 2A：设备基础字段真实写闭环

阶段 2A 已开放第二个低风险内部写 operation：

- operationType：`device.basic.update`
- 写入目标：`schedule_units.city`、`schedule_units.note`、受限 `schedule_units.status`、`updated_at`
- 风险等级：`medium-low`
- scope：`internal-db-only`
- 外部调用：禁用
- rollback：仅保留 `not_executable` placeholder

首批允许字段：

- `city`
- `note`
- `status`

首批禁止字段：

- `model_code`
- `unit_code`
- `serial_no`
- `purchase_cost`
- `residual_value`

闭环要求：

- `preview` 读取目标设备 before snapshot；
- `preview` 校验 patch 仅包含允许字段；
- `preview` 若包含 status 变更，必须只读检查 active/current-future schedule block 与未完成订单；
- `preview` 写入 audit log、confirm token hash、idempotency key、rollback placeholder；
- `execute` 重新校验本地 DB target、actor、confirm token、payload hash、impact hash、idempotency；
- `execute` 重新读取目标设备并重新做 status 占用风险检查；
- `execute` 只执行单行 `schedule_units` 允许字段 UPDATE；
- 成功后 audit status 更新为 `executed`；
- idempotency 记录保存 same-result response；
- 重复 execute 返回 duplicate / same-result，不重复 UPDATE；
- 页面通过 UI-V2 safeOps adapter 触发，不直接访问底层 bridge。

主计划文档：

- `operation-safe-mode-plan.md`
- `phase-04-plus-six-stage-roadmap.md`

后续六阶段：

1. 首个低风险内部写操作闭环；
2. 扩展内部写操作；
3. 外部 API 安全网关；
4. 权限、账号、商户隔离；
5. 生产环境迁移与上线准备；
6. 产品闭环与商业化完善。
