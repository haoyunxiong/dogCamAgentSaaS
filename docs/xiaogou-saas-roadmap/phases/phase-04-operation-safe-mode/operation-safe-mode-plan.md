# Phase 04 Operation Safe Mode Plan

## 一、当前阶段状态

Phase 03 / UI-V2 Full MVP Readonly + Aggregation + Visualization 已完成。

关键 commit：

```text
caa056c feat: complete ui v2 readonly mvp aggregation
```

已完成内容：

- Orders 真实只读；
- Devices 真实只读；
- Schedule 真实只读；
- Customers 派生只读；
- Dashboard / Workbench 基础真实聚合；
- Reports 基础真实聚合；
- Logistics 只读物流可视化；
- Deposit 本地缓存只读免押视图；
- UI-V2 全路由验收通过；
- 未修改 `main` / `preload` / `IPC` / `DB` / `Python`；
- 未实现真实写操作。

Phase 04 当前已进入安全骨架实现，但仍不进入真实写操作实现。

当前代码状态：

- `safeOps.getPolicy` / `safeOps.preview` 已完成；
- 8 类 operation 已支持 dry-run preview；
- UI-V2 危险入口仅展示 dry-run / 暂未开放 / 不会写入 / 不会调用外部服务；
- migration SQL / rollback SQL / protected runner 已准备，尚未执行 SQL，尚未连接 DB；
- persistence / crypto / repository skeleton 已完成，默认 noop，不 import DB，不落库；
- execute disabled skeleton 已完成，未新增 execute IPC / preload；
- 任意 execute 调用只应返回 `SAFE_OP_EXECUTE_DISABLED`，不得写 DB 或调用外部服务。

## 二、Phase 04 总体目标

Phase 04 的目标是建立 Operation Safe Mode，让后续真实写操作先做到：

- 可预览；
- 可确认；
- 可审计；
- 可回滚或补偿；
- 可按风险等级逐步打开。

不允许 UI-V2 页面直接调用底层写 IPC。所有后续写操作必须通过统一安全层进入。

## 三、统一安全模型

Phase 04 统一使用四级安全模型：

| 模式 | 含义 | 是否允许产生真实业务影响 |
|---|---|---|
| `readonly` | 只读查看 | 否 |
| `dry-run` | 生成影响预览，不执行写入 | 否 |
| `confirm-required` | 已生成预览，等待二次确认 | 否 |
| `write` | 经确认后的真实执行 | 是，必须审计并可回滚或补偿 |

默认模式必须是 `readonly` 或 `dry-run`。任何真实执行都不得作为默认行为。

## 四、必须安全能力

真实写操作进入实现前，必须具备以下能力：

- `confirmToken`：二次确认令牌；
- `idempotencyKey`：幂等保护，防止重复提交；
- `audit log`：操作审计日志；
- before / after snapshot：执行前后快照；
- rollback / compensation：回滚或补偿方案；
- permission / actor：操作者、权限和来源记录；
- dry-run impact preview：执行影响预览。

无 `confirmToken` / `idempotencyKey` 的真实写操作不得执行。

## 五、Domain 风险等级

| Domain | 风险等级 | 原因 |
|---|---|---|
| Orders | 高 | 状态流转会影响履约、收入、客户通知和后续排期 |
| Devices | 高 | 设备状态和库存会影响可租能力和资产准确性 |
| Schedule | 高 | 排期写入会影响订单履约和设备占用 |
| Logistics / Shipping | 极高 | 顺丰真实下单、取消、运费入账会产生外部动作和费用 |
| Deposit / Approval | 极高 | 免押审核、创建、完结会影响外部信用与资金相关流程 |

极高风险 domain 默认关闭真实外部写能力。

## 六、DB / Migration 原则

`dry-run` 阶段可以暂不改 DB。

真实 write 前必须使用 additive schema，不做不可回滚 DDL。

建议新增或规划以下表：

- `operation_audit_logs`；
- `operation_confirm_tokens`；
- `operation_idempotency_keys`；
- `operation_rollback_plans`。

DB migration 前必须具备：

- schema impact；
- migration plan；
- backup plan；
- rollback plan；
- verification plan。

未获得用户明确确认前，不执行生产 DB migration。

当前 migration 状态：

- migration scaffolding 已落地；
- protected runner 已落地；
- `scripts/mysql_schema.sql` 已与 scaffolding 同步；
- 本地 / 测试库 SQL 尚未执行；
- 生产库 migration 禁止执行。

## 七、IPC / Preload / Main 原则

不继续扩散零散的 `create` / `update` / `delete` wrapper。

新增能力应收敛为统一 `safeOps`：

- `safeOps.getPolicy`；
- `safeOps.preview`；
- `safeOps.execute`（当前未暴露）；
- `safeOps.getAuditLog`（当前未暴露）；
- `safeOps.rollback`（当前未暴露）。

UI-V2 页面不得直接调用 `window.electronAPI`。

`main` 层必须强制策略校验，不能只依赖前端禁用按钮。

## 八、外部写默认关闭

默认关闭：

- 顺丰真实下单；
- 免押真实审核；
- 真实外部账号 / 密钥 / 授权接入；
- 无 `confirmToken` 的真实执行；
- 无 `idempotencyKey` 的真实执行。

如需要真实顺丰账号、真实免押授权、真实商户授权或真实外部密钥，必须停止并由用户单独确认。

## 九、推荐实施顺序

1. 阶段状态与文档落档；
2. `safeOps` policy / preview 骨架；（已完成）
3. Orders / Devices / Schedule / Logistics / Deposit dry-run；（已完成）
4. migration scaffolding + protected runner；（已完成，尚未执行）
5. persistence / crypto / repository skeleton；（已完成，默认 noop）
6. execute disabled skeleton；（已完成，未暴露 IPC）
7. 用户确认后执行本地 DB migration；
8. audit / idempotency / confirm DB persistence；
9. 内部 DB write gated enablement；
10. Logistics / Shipping external gated skeleton；
11. Deposit / Approval external gated skeleton；
12. 真实外部 write 用户确认后开启。

## 十、暂不建议做

暂不建议在 Phase 04 初始阶段执行：

- 自动真实顺丰批量下单；
- 自动免押审核 / 完结；
- 手工直接编辑 `schedule_blocks`；
- 批量物理删除历史订单或设备；
- Xianyu 库存 / 价格真实写入；
- 不可回滚 schema 重构。

## 十一、用户确认项

以下事项必须由用户单独确认：

- 真实顺丰账号 / 密钥；
- 真实免押授权；
- 生产 DB migration；
- 外部真实下单 / 完结能力；
- 不可回滚 DDL；
- 真实写操作开关。

## 十二、当前禁止项

在 Phase 04 Operation Safe Mode 进入代码实现前，禁止：

- 直接实现顺丰真实下单；
- 直接实现免押真实审核；
- 直接实现订单状态流转；
- 直接实现设备库存调整；
- 直接实现排期编辑；
- UI-V2 页面直接调用底层写 IPC；
- 无备份和回滚方案的 DB migration；
- 无 dry-run 和审计的真实写入。
