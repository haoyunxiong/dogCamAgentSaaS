# Phase 04 Operation Safe Mode

本目录记录 Phase 04 真实写操作进入实现前的安全模式计划。

当前结论：

- Phase 03 / UI-V2 Full MVP Readonly + Aggregation + Visualization 已完成；
- 关键 checkpoint：`caa056c`；
- Phase 04 尚未进入真实写操作实现；
- 本阶段先建立 Operation Safe Mode，再决定哪些写操作可以进入实现。

核心原则：

- UI-V2 页面不得直接调用底层写 IPC；
- 后续真实写操作必须通过统一 `safeOps`；
- 所有高风险操作必须先 `dry-run`，再二次确认，再审计执行；
- 顺丰真实下单、免押真实审核、DB migration 都需要用户单独确认。

主计划文档：

- `operation-safe-mode-plan.md`
