# Phase 03 UI-V2 Real Data Integration Orchestration Plan

## 0. 文档定位

本文是 UI-V2 接入真实业务数据阶段的后续自动推进手册。

它用于约束后续 Codex 会话如何按切片推进、如何自检、如何验收、如何 checkpoint，以及遇到哪些条件必须停止。

本文只定义执行纪律和调度顺序，不代表本次立即修改业务代码、Electron main/preload/IPC、Python、数据库 schema 或配置文件。

已完成的前置 checkpoint：

| checkpoint | commit | 说明 |
|---|---|---|
| UI-V2 Data Access Architecture Plan | `4cf389e` | 定义 UI-V2 数据访问架构 |
| UI-V2 Adapter Mode Foundation | `c158810` | 建立 mock/real/auto/fallback 基础 |
| Orders Real Readonly Adapter | `f55b0c6` | 订单只读真实 adapter 接入 |

当前推荐推进方向：

```text
Devices Real Readonly Adapter
```

## 1. 总原则

1. 每个切片必须小步提交。
2. 每个切片必须按以下顺序执行：

```text
plan -> implement -> self-check -> validation -> checkpoint
```

3. 不允许跨切片开发。
4. readonly 切片只允许读取数据，不允许写入、删除、状态流转、库存调整、物流提交、免押审核或订单编辑。
5. UI-V2 页面不得绕过 `uiV2Adapter`。
6. UI-V2 页面不得直接调用 `window.electronAPI`。
7. 真实调用只能集中在 real adapter 或 mapper/helper 层。
8. preview 环境必须强制 mock，不得访问真实 IPC、真实数据库或真实网络接口。
9. legacy 页面和现有业务流程不能被破坏。
10. 如果现有 main/preload/IPC/dbManager 只读能力不足，必须停止并输出缺口，不允许顺手改 main/preload/IPC/database。
11. 如果需要新增数据库 schema、Python 后端能力、写接口或真实业务状态流转，必须停止并交回总控台。
12. checkpoint 前必须执行 `git diff --check`。
13. 禁止使用 `git add .`。
14. 每个切片独立 commit。
15. push 使用 443 SSH URL。
16. checkpoint 完成后刷新 `origin/main`，确认本地与远端一致。

## 2. 推荐后续切片顺序

### 2.1 Devices Real Readonly Adapter

目标：

1. 接入 UI-V2 设备列表真实只读数据。
2. 接入 UI-V2 设备详情真实只读数据。
3. 复用现有 `listScheduleUnits` 等只读能力。
4. 做设备字段 mapper，保证 UI-V2 字段稳定。
5. 保留 mock fallback。

禁止：

1. 不做设备编辑。
2. 不做设备删除。
3. 不做库存调整。
4. 不做设备状态写入。
5. 不新增 main/preload/IPC。
6. 不新增数据库字段。

建议 commit：

```text
feat: connect ui v2 devices to readonly real adapter
```

### 2.2 Schedule Real Readonly Adapter

目标：

1. 接入档期占用真实只读数据。
2. 接入设备可用性真实只读数据。
3. 建立订单租期到 UI-V2 schedule block 的映射。
4. 保留 mock fallback。

禁止：

1. 不做档期写入。
2. 不做排期编辑。
3. 不做设备锁定。
4. 不做库存占用写回。

建议 commit：

```text
feat: connect ui v2 schedule to readonly real adapter
```

### 2.3 Orders / Devices / Schedule Combined Readonly Regression

目标：

1. 回归订单、设备、档期三个只读 adapter 的组合展示。
2. 验证 mock/real/auto/fallback 一致性。
3. 验证 mobile 与 desktop 页面不白屏。
4. 验证 preview 仍强制 mock。

禁止：

1. 不新增业务能力。
2. 不做 UI 大改。
3. 不改 main/preload/IPC。

建议 commit：

```text
test: verify ui v2 readonly real adapters
```

### 2.4 Customers Derived Readonly Adapter

目标：

1. 从订单、询单、免押订单等现有数据中派生客户视图。
2. 建立客户展示字段 mapper。
3. 保留 mock fallback。

禁止：

1. 不新增客户主表。
2. 不提前引入 CRM 模型。
3. 不做客户编辑。
4. 不做客户标签写入。

建议 commit：

```text
feat: connect ui v2 customers to derived readonly adapter
```

### 2.5 Logistics Readonly Plan + Minimal Readonly Adapter

目标：

1. 先输出物流只读接入计划。
2. 只在现有只读能力足够时接入最小展示。
3. 建立物流状态展示 mapper。
4. 保留 mock fallback。

禁止：

1. 不提交发货。
2. 不提交归还。
3. 不创建运单。
4. 不调用写接口。

建议 commit：

```text
feat: connect ui v2 logistics to readonly real adapter
```

### 2.6 Deposit Readonly Plan + Minimal Readonly Adapter

目标：

1. 先输出免押/押金只读接入计划。
2. 只在现有只读能力足够时接入最小展示。
3. 建立免押状态、押金状态、风险状态 mapper。
4. 保留 mock fallback。

禁止：

1. 不做免押审核。
2. 不做押金收退。
3. 不做风控状态写入。
4. 不调用写接口。

建议 commit：

```text
feat: connect ui v2 deposit to readonly real adapter
```

### 2.7 Dashboard / Reports Real Aggregation

目标：

1. 基于已经接入的只读 adapter 做聚合展示。
2. 优先使用前端派生聚合或现有只读汇总能力。
3. 保留 mock fallback。

禁止：

1. 不新增报表数据库表。
2. 不做复杂实时数仓。
3. 不改 Python。
4. 不改数据库 schema。

建议 commit：

```text
feat: connect ui v2 reports to real aggregation adapter
```

### 2.8 Operation Capabilities Planning

目标：

1. 最后单独规划操作型能力。
2. 覆盖发货、归还、免押审核、押金处理、订单编辑、订单状态流转。
3. 输出写接口、权限、回滚、审计、legacy 兼容和验收计划。

禁止：

1. 不在 readonly 阶段提前实现写操作。
2. 不与设备/档期/订单只读切片混做。
3. 不跳过总控台审批。

## 3. 每个切片固定执行流

### Step A：Preflight

执行前必须完成：

1. 运行：

```bash
git status --branch --short
```

2. 工作区必须干净。若不干净，停止并输出已有变更，不得继续。
3. 读取以下文件：
   - `AGENTS.md`
   - `docs/xiaogou-saas-roadmap/00_README_总控入口.md`
   - `docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md`
   - `docs/xiaogou-saas-roadmap/04_CODEX_EXECUTION_RULES_Codex执行纪律.md`
   - `docs/xiaogou-saas-roadmap/phases/phase-03-real-data-integration/ui-v2-data-access-architecture.md`
   - `docs/xiaogou-saas-roadmap/phases/phase-03-real-data-integration/phase-03-orchestration-plan.md`
4. 读取当前切片目标 UI-V2 页面。
5. 读取对应 legacy 页面或 legacy 数据入口。
6. 读取 preload/main/IPC/dbManager 中已存在的只读能力，只允许审查，不允许修改。
7. 输出执行计划，必须包含：
   - 本切片目标
   - 允许修改文件
   - 禁止修改文件
   - 真实数据来源
   - mapper 方案
   - fallback 方案
   - preview mock 验证方案
   - legacy 不破坏验证方案
8. 如果计划需要修改禁改路径，必须停止并交回总控台。

### Step B：Implementation

执行时必须遵守：

1. 只修改本切片允许的文件。
2. UI-V2 页面只能依赖 `uiV2Adapter`。
3. UI-V2 页面不得直接调用 `window.electronAPI`。
4. 真实调用只能出现在 real adapter 或 mapper/helper 层。
5. mapper 必须兼容真实字段缺失、空值、旧字段名和异常值。
6. mock fallback 必须保留。
7. preview 必须强制 mock。
8. readonly 切片不得写数据。
9. 不允许复制 `prototypes/ui-v2-demo` 覆盖 `electron/renderer`。
10. 不允许删除 legacy 功能。

### Step C：Self-check

实现后必须执行：

```bash
npm run build:renderer
npm run renderer:preview
```

并完成以下检查：

1. preview 页面可以打开。
2. preview 数据源显示或可验证为 `source=mock`。
3. preview 环境 `window.electronAPI` 为 `false` 或 `undefined`。
4. Network 中没有真实业务请求。
5. Console 没有严重错误。
6. real/auto 成功路径可模拟或在 Electron 环境验证。
7. real/auto 失败路径可 fallback 到 mock。
8. grep 禁止关键字，确认页面没有直接 IPC 调用。
9. 运行：

```bash
git status --short
git diff --check
```

如果 `build:renderer` 失败、preview 破坏、fallback 破坏或禁改路径被修改，必须停止。

### Step D：Validation Report

每个切片完成后必须输出验证报告：

1. 修改/新增文件清单。
2. 每个文件的修改原因。
3. 真实调用清单。
4. forbidden scan 结果。
5. fallback 保留情况。
6. preview 验证结果。
7. real/auto 成功模拟结果。
8. real/auto 失败 fallback 验证结果。
9. 是否影响 legacy 页面。
10. 是否影响 main/preload/IPC。
11. 是否影响 Python。
12. 是否影响数据库 schema。
13. 是否建议 checkpoint。
14. 允许 staging 清单。
15. 明确排除 staging 清单。

### Step E：Checkpoint

只有 Step D 验证通过后才能 checkpoint。

checkpoint 必须执行：

1. 精确暂存，不允许 `git add .`。
2. 示例：

```bash
git add electron/renderer/src/adapters/uiV2/realAdapter.js
git add electron/renderer/src/adapters/uiV2/index.js
git add electron/renderer/src/views/uiV2/desktop/Devices.vue
git add electron/renderer/src/views/uiV2/mobile/Devices.vue
```

3. 检查暂存文件：

```bash
git diff --cached --name-only
git diff --cached --check
```

4. staged range 必须只包含本切片允许文件。
5. 如果暂存中包含禁改路径，立即：

```bash
git reset
```

然后停止，不得 commit。

6. commit 使用本手册建议 commit message。
7. push 使用 443 SSH URL。
8. push 后执行：

```bash
git fetch origin main
git update-ref refs/remotes/origin/main origin/main
git status --branch --short
git log --oneline -8
```

9. 输出 commit hash、push 结果、最终状态。

## 4. Stop Conditions

出现以下任一情况必须停止，不得自行扩大范围：

1. 需要新增 Electron main 能力。
2. 需要修改 preload 暴露接口。
3. 需要新增或修改 IPC 协议。
4. 需要修改 dbManager 写入能力。
5. 需要数据库 schema 变更。
6. 需要 Python 后端变更。
7. 需要真实写接口。
8. 真实字段不足且无法通过 mapper/fallback 安全兼容。
9. renderer preview 破坏。
10. legacy 页面或 legacy 流程破坏。
11. `npm run build:renderer` 失败。
12. 真实数据接入需要重大 UI 结构重写。
13. 单个切片跨越超过两个业务 domain。
14. 工作区在 preflight 阶段不干净。
15. 禁改路径必须修改才可继续。

停止时必须输出：

1. 已完成审查内容。
2. 触发的停止条件。
3. 缺失能力。
4. 可选解决路径。
5. 需要总控台决策的问题。

## 5. 禁止修改路径

真实只读接入切片默认禁止修改：

```text
electron/main/
electron/preload/
electron/package.json
electron/renderer/src/App.vue
electron/renderer/src/router/index.js
electron/renderer/src/utils/runtimeMode.mjs
electron/renderer/src/api/
electron/renderer/src/services/
electron/renderer/src/store/
electron/renderer/src/stores/
electron/renderer/src/composables/
electron/renderer/src/mock/uiV2/
electron/renderer/src/views/ 下的 legacy 页面
python/
data/
config/
database/
docs/，除非本切片是文档切片
prototypes/
scripts/
node_modules/
dist/
build/
```

如果后续切片确实需要修改上述路径，必须先停止并由总控台重新授权。

## 6. 通常允许修改路径

真实只读接入切片通常只允许修改：

```text
electron/renderer/src/adapters/uiV2/
electron/renderer/src/views/uiV2/desktop/<目标页>.vue
electron/renderer/src/views/uiV2/mobile/<目标页>.vue
electron/renderer/src/adapters/uiV2/Mapper.js
```

如果项目中 mapper 文件已有具体命名，应优先沿用现有命名，不为命名统一做额外重构。

## 7. Commit Message 建议

| 切片 | commit message |
|---|---|
| Devices Real Readonly Adapter | `feat: connect ui v2 devices to readonly real adapter` |
| Schedule Real Readonly Adapter | `feat: connect ui v2 schedule to readonly real adapter` |
| Combined readonly regression | `test: verify ui v2 readonly real adapters` |
| Customers Derived Readonly Adapter | `feat: connect ui v2 customers to derived readonly adapter` |
| Logistics readonly | `feat: connect ui v2 logistics to readonly real adapter` |
| Deposit readonly | `feat: connect ui v2 deposit to readonly real adapter` |
| Reports / Dashboard aggregation | `feat: connect ui v2 reports to real aggregation adapter` |

## 8. 下一次授权建议

本手册安装并 checkpoint 后，推荐继续：

```text
Devices Real Readonly Adapter
```

但每个切片必须先输出计划，再执行实现，再输出验证报告。若触发停止条件，必须停止并请总控台决策。

下一次实现会话建议 Prompt：

```text
你现在执行 Phase 03 UI-V2 Real Data Integration 的 Devices Real Readonly Adapter 切片。

当前目标只允许把 UI-V2 设备列表/设备详情接入现有只读真实数据能力。

必须先读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/00_README_总控入口.md
3. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
4. docs/xiaogou-saas-roadmap/04_CODEX_EXECUTION_RULES_Codex执行纪律.md
5. docs/xiaogou-saas-roadmap/phases/phase-03-real-data-integration/ui-v2-data-access-architecture.md
6. docs/xiaogou-saas-roadmap/phases/phase-03-real-data-integration/phase-03-orchestration-plan.md

本次只允许计划 Devices Real Readonly Adapter，不要直接修改文件。

请先执行 preflight：
1. git status --branch --short
2. 审查 UI-V2 desktop/mobile 设备页
3. 审查 uiV2Adapter / realAdapter / mock fallback
4. 审查现有 preload/main/IPC/dbManager 是否已有设备只读能力，例如 listScheduleUnits
5. 审查对应 legacy 设备或档期相关页面的数据入口

请输出：
1. 当前工作区是否干净
2. 本切片目标
3. 允许修改文件
4. 禁止修改文件
5. 真实数据来源
6. mapper 方案
7. fallback 方案
8. preview mock 验证方案
9. legacy 不破坏验证方案
10. 是否触发停止条件

在我确认前，不要修改代码，不要 git add，不要 commit，不要 push。
```

## 9. 总控台记录

本文属于 Phase 03 real data integration 的执行手册，不改变已完成 checkpoint 的代码内容。

本文不授权：

1. 修改 Electron main/preload/IPC。
2. 修改 Python。
3. 修改数据库。
4. 修改配置。
5. 接入真实写操作。
6. 跨切片迁移业务页面。
7. 直接提交后续实现。

后续每个切片必须由总控台明确授权。
