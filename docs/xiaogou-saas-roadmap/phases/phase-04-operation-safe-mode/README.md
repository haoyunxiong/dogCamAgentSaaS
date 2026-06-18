# Phase 04 Operation Safe Mode

本目录记录 Phase 04 真实写操作进入实现前的安全模式计划。

当前结论：

- Phase 03 / UI-V2 Full MVP Readonly + Aggregation + Visualization 已完成；
- 关键 checkpoint：`caa056c`；
- Phase 04 已完成 safeOps policy / preview / 8 类 dry-run preview；
- UI-V2 已接入 disabled preview entry，页面仍不直接调用底层 bridge；
- safeOps migration SQL / rollback SQL / protected runner 已准备，但尚未执行、尚未连接 DB；
- safeOps persistence / crypto / repository skeleton 已完成，默认 noop 不落库；
- safeOps execute disabled skeleton 已完成，未新增 execute IPC / preload；
- Phase 04 尚未进入真实写操作实现。

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
- DB-backed audit / confirm / idempotency persistence；
- 顺丰 / 免押真实外部写入。

主计划文档：

- `operation-safe-mode-plan.md`
