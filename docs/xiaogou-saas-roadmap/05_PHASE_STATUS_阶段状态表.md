# 05 阶段状态表

## 当前阶段

```text
当前阶段：Phase 04 - Operation Safe Mode
当前状态：safeOps dry-run persistence DB wiring 已完成 / execute 仍禁用 / 真实写操作未开始
是否允许写代码：是（仅限 Phase 04 safeOps 安全闭环；真实 write 必须逐项 gated enable）
是否允许操作 Figma：否
是否允许改数据库：否
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
- [ ] 内部 DB write 安全模式确认
- [ ] 真实外部 write 开关经用户单独确认

## 当前下一步

```text
Phase 04 Operation Safe Mode：safeOps preview 已接入本地 DB persistence；下一步按 Phase 04+ 六阶段路线图推进首个低风险内部写操作闭环。
```

Phase 04 尚未进入真实写操作实现；当前 execute 仍仅返回 `SAFE_OP_EXECUTE_DISABLED`，不开放 execute IPC / rollback IPC / audit:list IPC。

当前 checkpoint：

```text
5c32e03 feat: wire safeops persistence to local db
```

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
- DB migration；
- 真实外部账号 / 密钥 / 授权接入；
- 无 `confirmToken` / `idempotencyKey` 的真实执行；
- UI-V2 页面直接调用底层写 IPC。

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
