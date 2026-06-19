# Phase 04 Operation Safe Mode

本目录记录 Phase 04 真实写操作进入实现前的安全模式计划。

当前结论：

- Phase 03 / UI-V2 Full MVP Readonly + Aggregation + Visualization 已完成；
- 关键 checkpoint：`caa056c`；
- Phase 04 已完成 safeOps policy / preview / 8 类 dry-run preview；
- UI-V2 已接入 disabled preview entry，页面仍不直接调用底层 bridge；
- safeOps migration SQL / rollback SQL / protected runner 已准备，本地测试库已 apply；
- safeOps persistence / crypto / repository 已接入本地 safeOps 表，DB 不可用时安全降级 noop；
- safeOps execute disabled skeleton 已完成，未新增 execute IPC / preload；
- Phase 04+ 后续六阶段快速推进路线图已落档；
- 阶段 1A 已完成：为首个低风险内部写操作新增 `rental_orders.internal_note` additive schema；
- Phase 04 尚未进入真实写操作实现。

当前 checkpoint：

```text
5c32e03 feat: wire safeops persistence to local db
```

核心原则：

- UI-V2 页面不得直接调用底层写 IPC；
- 后续真实写操作必须通过统一 `safeOps`；
- 所有高风险操作必须先 `dry-run`，再二次确认，再审计执行；
- 当前 execute 一律返回 `SAFE_OP_EXECUTE_DISABLED`；
- 顺丰真实下单、免押真实审核、DB migration 都需要用户单独确认。

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

- `safeOps.execute` IPC / preload；
- `safeOps.rollback`；
- `safeOps.audit:list`；
- 真实业务表 write；
- 顺丰 / 免押真实外部写入。

当前 DB persistence 范围：

- `operation_audit_logs`：记录 preview / blocked / disabled / failed；
- `operation_confirm_tokens`：只保存 token hash，不保存完整 token；
- `operation_idempotency_keys`：按 actor + operationType + payloadHash 生成稳定幂等记录；
- `operation_rollback_plans`：仅创建 `not_executable` placeholder，不开放 rollback executor。

当前仍然禁止：

- 新增 `safeOps:execute` / `safeOps:rollback` / `safeOps:audit:list` IPC；
- 修改订单状态、设备、档期、物流、免押等业务表；
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
- 不开放 `safeOps.execute`；
- 后续阶段 1B 才允许开放单一 operationType：`order.internal_note.update`。

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
