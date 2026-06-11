---
name: xiaogou-saas-phase-executor
description: Use this skill when working on the 小狗相机助手商户版 project roadmap, phase execution, Figma design system, or Codex staged implementation. It enforces phase-based execution, no cross-stage changes, and reads only current phase docs.
---

# 小狗相机助手商户版阶段执行 Skill

When this skill is invoked, follow these steps:

1. Read `AGENTS.md`.
2. Read `docs/xiaogou-saas-roadmap/00_README_总控入口.md`.
3. Read `docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md`.
4. Read only the current phase folder.
5. Start in plan mode. Do not edit code or Figma before user confirmation.
6. State explicitly:
   - current phase goal;
   - what this phase does not do;
   - files to read;
   - files to modify;
   - risks;
   - validation plan;
   - questions for user.
7. Never implement merchant collaboration, transfer,代发, or second-hand marketplace features before the current phase permits it.
8. After execution, write results into the current phase `artifacts/` folder and summarize validation.
9. Recommend updates to `AGENTS.md` only after repeated mistakes, and ask before editing it.

Default operating principle:

```text
架构按未来 SaaS 设计；
功能按当前内部提效落地；
UI 按设计系统统一；
数据按多商户预留；
商户协作先规划，不提前开发；
每个阶段独立验收，验收通过再进入下一阶段。
```
