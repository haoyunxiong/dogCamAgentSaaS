# AGENTS.md

This file provides repository-level instructions for Codex when working in this project.

## 1. Current Product Direction

This project is no longer primarily a Xianyu auto-reply bot.

The current product direction is:

**小狗相机助手商户版**  
A rental merchant operations system for standardizing and scaling rental workflows.

The product focuses on:

- Orders
- Rental schedules
- Device inventory
- Shipping and returns
- Deposit / deposit-free workflows
- Merchant operations
- Employee SOP
- Data reporting
- Future multi-merchant SaaS expansion

Xianyu is no longer the product core.

Xianyu-related logic should be treated as a **legacy channel / legacy module**, not the main product direction.

Do not introduce new Xianyu-centered product architecture unless explicitly requested.

---

## 2. Highest-Priority Source of Truth

For product direction, phases, and execution rules, Codex must read:

```text
docs/xiaogou-saas-roadmap/00_README_总控入口.md
docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
docs/xiaogou-saas-roadmap/04_CODEX_EXECUTION_RULES_Codex执行纪律.md
```

For current-stage work, only read the current phase folder under:

```text
docs/xiaogou-saas-roadmap/phases/
```

Do not read all historical documents unless explicitly asked.

Legacy documents are references only. They must not override the current SaaS roadmap.

Recommended legacy reference location:

```text
docs/xiaogou-saas-roadmap/reference-docs/legacy/
```

If old Xianyu-centered documents conflict with the new SaaS roadmap, follow the new SaaS roadmap.

---

## 3. Phase-Based Execution Rule

Every task must belong to a project phase.

The current phase is defined in:

```text
docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
```

Do not cross phases.

Before executing any task:

1. Read this `AGENTS.md`.
2. Read the phase status file.
3. Read the current phase folder.
4. Output a plan.
5. Wait for user confirmation before modifying code, Figma, or database.

Do not implement future-stage features early, even if they are mentioned in planning documents.

---

## 4. New Feature / Change / Bug Handling

When the user proposes a new feature, modification, bug, or product idea:

Do not develop immediately.

First output a dispatch analysis:

1. Requirement type: feature / change / bug / product decision / phase transition.
2. Belonging phase.
3. Whether current phase allows it.
4. Documents to create or update.
5. Target Codex session.
6. Risks.
7. Acceptance criteria.
8. Prompt for the target session.

Only update documents after the user confirms.

Only modify code after the user explicitly confirms execution.

Suggested backlog locations:

```text
docs/xiaogou-saas-roadmap/backlog/feature-requests/
docs/xiaogou-saas-roadmap/backlog/change-requests/
docs/xiaogou-saas-roadmap/backlog/bugs/
docs/xiaogou-saas-roadmap/backlog/research/
```

---

## 5. Existing Codebase Reality

The current codebase is an existing working Electron desktop application with a Vue renderer and Python backend bridge.

Important existing architecture:

- Electron main process: `electron/main/`
- Vue renderer: `electron/renderer/`
- Python bridge: `python/bridge.py`
- Python backend logic: `python/`
- SQLite / local data: existing project storage
- Build and launch scripts: existing project scripts

Treat the current system as an existing working product.

Do not break existing usable workflows during phased migration.

---

## 6. Legacy Xianyu Logic

Existing Xianyu logic may remain during migration if it supports current workflows.

However:

- Do not treat Xianyu auto-reply as the future product center.
- Do not add new Xianyu-specific product concepts unless explicitly requested.
- Xianyu should be modeled as a `channel` or legacy integration.
- New product architecture should support multiple order sources.

Recommended order source model:

```text
Manual
Xianyu
Xiaohongshu
Douyin
Private domain
Merchant collaboration
Other
```

The future product should not be structurally dependent on Xianyu.

---

## 7. Hard Restrictions

Unless the current phase explicitly requires it, do not modify:

- Electron main process lifecycle logic
- Python bridge startup logic
- Electron ↔ Python IPC protocol
- SQLite database schema
- Existing API response contracts
- WebSocket connection logic
- Token refresh logic
- Message sync logic
- Existing shipping / logistics business logic
- Launcher behavior or packaging behavior

When database changes are required, first output:

1. Schema impact.
2. Migration plan.
3. Backup plan.
4. Rollback plan.
5. Verification plan.

Do not run destructive database operations without explicit confirmation.

Do not delete legacy functionality unless the current phase and user explicitly confirm it.

---

## 8. Current Product Migration Principle

The migration principle is:

```text
架构按未来 SaaS 设计；
功能按当前内部提效落地；
UI 按设计系统统一；
数据按多商户预留；
商户协作先规划，不提前开发；
每个阶段独立验收，验收通过再进入下一阶段。
```

In English:

- Design architecture for the future SaaS system.
- Implement features based on current internal efficiency needs.
- Keep UI consistent through a design system.
- Prepare data structures for multi-merchant usage.
- Plan merchant collaboration, but do not implement it early.
- Complete and verify each phase before moving to the next.

---

## 9. UI / Design Rules

The new UI direction is:

**Professional rental merchant SaaS system.**

Design style:

- Clean
- Professional
- Trustworthy
- High-density but readable
- Suitable for daily operations
- SaaS-grade
- Not overly cute
- Not marketing-page style

Preferred references:

- Shopify Admin
- Stripe Dashboard
- Linear
- Notion
- Feishu / Lark admin tools

Avoid:

- Heavy gradients
- Decorative animations
- Glassmorphism
- Neon colors
- Student-project appearance
- One-off page styling
- Overly cute mascot-driven business pages

The dog mascot may be used as a light brand element, especially in:

- Logo / header
- Login page
- Empty states
- Onboarding
- Help tips

But core business pages should remain professional and efficient.

---

## 10. UI Component Rules

Prefer reusable base components:

- BaseButton
- BaseCard
- BaseBadge
- BaseInput
- BaseSelect
- BaseTable
- BaseDrawer
- BaseDialog
- BaseEmpty
- BaseSkeleton
- BaseToast
- FilterChip
- StatusBadge
- MetricCard
- OrderCard
- DeviceCard
- ScheduleBlock

Do not duplicate one-off styling across pages.

Page components should mainly handle:

- Data loading
- Layout composition
- Page-level event wiring

They should not contain excessive low-level styling or duplicated UI primitives.

---

## 11. Mobile / Desktop Product Split

Mobile should be treated as a **mobile operations workbench**.

Mobile focuses on:

- Today’s tasks
- Quick order handling
- Shipping confirmation
- Return reminders
- Deposit approval
- Schedule lookup
- Device scan / quick actions

Desktop / PC should be treated as the **full management backend**.

Desktop focuses on:

- Batch order processing
- Schedule tables
- Device management
- Reports
- Staff permissions
- Merchant settings
- Data import / export
- Complex workflows

Do not simply shrink desktop pages into mobile pages.

---

## 12. Future Merchant Collaboration Scope

Future merchant collaboration may include:

- Transfer / stock-sharing requests
- Available device publishing
- Proxy fulfillment /代发
- Merchant quotation
- Second-hand device trading
- Merchant reputation
- Settlement / commission
- Dispute handling

These are future modules.

Do not implement these modules unless the current phase explicitly allows it.

For now, record related ideas into backlog or planning documents.

---

## 13. Development Commands

Common commands:

```bash
cd electron
npm install
npm run dev
```

Before reporting completion, inspect available scripts in:

```text
electron/package.json
```

Only run commands that actually exist.

If a command does not exist, report that clearly instead of inventing a successful result.

For UI-only changes, verify:

1. App starts.
2. Modified page loads.
3. No console errors.
4. Navigation still works.
5. Existing handlers still work.
6. Key statuses still display.

---

## 14. Verification Rules

Before reporting completion:

1. State exactly which files changed.
2. State whether business logic was affected.
3. State whether database schema was affected.
4. State whether existing workflows were affected.
5. Run available checks when appropriate.
6. If checks cannot be run, explain why.
7. Provide manual verification steps.

For UI-only changes, at minimum:

1. Start the app in development mode if possible.
2. Check the modified page visually.
3. Verify no console errors.
4. Verify no broken navigation.
5. Verify core buttons still call the original handlers.
6. Verify key statuses still display correctly.

---

## 15. Launcher Sync Requirement

When changing startup flow, build output paths, Electron packaging paths, or app executable names, also update the root launcher scripts in the workspace if they exist, such as:

```text
../双击启动闲鱼Agent.bat
../双击启动闲鱼Agent-调试版.bat
../启动闲鱼Agent.ps1
```

Treat these launcher files as part of the deliverable for startup or packaging related changes.

For UI-only redesign tasks, do not modify launcher scripts.

---

## 16. Reporting Format

After each execution, report:

1. Files changed.
2. What changed in each file.
3. Why the change was made.
4. Whether business logic was affected.
5. Whether database schema was affected.
6. How to run and verify the result.
7. Known risks.
8. Follow-up tasks.
9. Whether current phase status should be updated.

Do not claim completion without verification.

---

## 17. Safety Rules for Codex

Do not:

- Attempt a full rewrite in one pass.
- Cross phases without confirmation.
- Modify database schema without a migration plan.
- Delete legacy modules without explicit confirmation.
- Hide or remove critical operational states.
- Introduce large UI frameworks without approval.
- Treat historical Xianyu documents as current product truth.
- Skip verification.

Prefer staged implementation:

1. Project audit.
2. Product foundation.
3. Design system.
4. SaaS base.
5. Core business refactor.
6. Employee SOP.
7. Reporting.
8. Merchant beta.
9. Merchant collaboration reserve.

---

## 18. Recommended First Action for Codex

If unsure what to do, do not modify code.

Instead, read:

```text
AGENTS.md
docs/xiaogou-saas-roadmap/00_README_总控入口.md
docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
```

Then output:

1. Current phase.
2. Allowed scope.
3. Forbidden scope.
4. Suggested next action.
5. Files to read next.
6. Questions for the user.

Wait for confirmation before execution.


<!-- CONFIG_GOVERNANCE_PATCH_START -->

# AGENTS.md 追加片段：配置治理与敏感配置规则

建议追加到根目录 `AGENTS.md` 的 Hard Restrictions / New Feature Handling / Security 附近。

```md
## Configuration Governance and Secret Handling

Configuration must not be scattered as hardcoded values across JS / Python files.

Classify configuration into four groups:

1. System default configuration
   - Safe to commit.
   - Examples: default status enums, default page size, default UI behavior.

2. Local runtime configuration
   - Must not be committed.
   - Examples: local database host, local port, local debug flags.
   - Store in local env files or local JSON files that are ignored by Git.

3. Merchant business configuration
   - Should eventually live in DB / MySQL.
   - Must support merchant_id / store_id isolation.
   - Examples: merchant settings, store settings, shipping settings, deposit rules, pricing rules, notification templates, staff permissions.

4. Sensitive credentials
   - Must never be hardcoded in JS / Python.
   - Must not be committed.
   - Examples: API keys, cookies, tokens, database passwords, third-party credentials.
   - Future direction: CredentialService with encrypted storage.

When sensitive scan matches token/password/cookie terms, do not assume all matches are real secrets.
Classify each hit as:

- SAFE_FALSE_POSITIVE: variable name, field name, config reading, parameter passing.
- IGNORED_LOCAL_FILE: file is ignored by Git and will not be committed.
- REAL_SECRET: real hardcoded secret value.
- NEED_USER_CONFIRMATION: uncertain.

If REAL_SECRET or NEED_USER_CONFIRMATION exists, stop before commit / push.
Do not print raw secret values in reports.

Configuration governance is tracked as:

```text
docs/xiaogou-saas-roadmap/backlog/change-requests/CR-0001_配置中心与敏感配置治理.md
docs/xiaogou-saas-roadmap/14_CONFIG_GOVERNANCE_配置治理总纲.md
docs/xiaogou-saas-roadmap/reference-docs/current-codebase/CONFIG_SOURCE_AUDIT.md
```

Do not perform full configuration refactor during initial Git baseline.
Record it as a Phase 03 SaaS base task unless explicitly approved.
```

<!-- CONFIG_GOVERNANCE_PATCH_END -->
