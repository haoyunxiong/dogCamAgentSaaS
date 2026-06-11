# 小狗相机助手商户版：Codex 多会话创建、文件归档与改造启动手册

> 适用对象：你当前的 XianyuAgentPro / 闲鱼助手项目。  
> 新定位：从“闲鱼助手”升级为“租赁商户运营标准化系统”。  
> 使用目标：把项目方向、阶段文档、Codex 多会话分工、Figma 设计执行、代码改造流程一次性固定下来，后续新增功能不再靠聊天记忆，而是靠项目文档驱动。

---

## 0. 本文要解决什么问题

你现在需要做的不是继续让 Codex 随机改页面，而是先搭一套稳定的项目执行系统：

1. 把阶段化文档包放到项目正确位置；
2. 建立 `AGENTS.md`，让 Codex 每次进入项目先读固定规则；
3. 创建多个 Codex 会话，每个会话只负责一种工作；
4. 用“总控台会话”分配任务，而不是你自己每次重新想 Prompt；
5. 从 Phase 00 开始改造，先盘点项目和冻结旧闲鱼逻辑，再进入设计系统、SaaS 底座、业务重构。

核心原则：

```text
文档是项目真相；
Git 是代码真相；
Figma 是设计真相；
阶段状态表是进度真相；
Codex 会话只是执行工作台，不是长期记忆库。
```

---

## 1. 你最终要形成的项目结构

把归档解压到项目根目录后，项目应该变成类似这样：

```text
XianyuAgentPro/
  AGENTS.md
  README_如何使用这套文档.md

  .agents/
    skills/
      xiaogou-saas-phase-executor/
        SKILL.md

  docs/
    xiaogou-saas-roadmap/
      00_README_总控入口.md
      01_PRODUCT_POSITIONING_产品定位.md
      02_ARCHITECTURE_OVERVIEW_系统总架构.md
      03_DESIGN_SYSTEM_OVERVIEW_设计系统总纲.md
      04_CODEX_EXECUTION_RULES_Codex执行纪律.md
      05_PHASE_STATUS_阶段状态表.md
      06_DECISION_LOG_决策记录.md
      07_GLOSSARY_业务词典.md
      08_CODEX_DAILY_EXECUTION_GUIDE_每次执行手册.md
      09_PROMPT_INDEX_提示词索引.md

      phases/
        phase-00-project-audit/
        phase-01-product-foundation/
        phase-02-design-system/
        phase-03-saas-base/
        phase-04-core-business-refactor/
        phase-05-employee-sop/
        phase-06-data-reporting/
        phase-07-merchant-beta/
        phase-08-merchant-collaboration-reserve/

      prompt-templates/
        00_通用_启动当前阶段_计划模式.md
        01_通用_执行已确认计划.md
        02_通用_阶段验收.md
        03_通用_更新阶段状态.md
        04_Figma_创建设计系统.md
        05_Figma_迭代当前页面.md
        06_Code_分析项目不改代码.md
        07_Code_安全改造开发.md
        08_Review_复盘并沉淀规则.md

      backlog/
        feature-requests/
        change-requests/
        bugs/
```

如果当前归档里还没有 `backlog/`，建议手动补上。后续新功能、修改、Bug 都先进入 backlog，再由总控台判断是否进入当前阶段开发。

---

## 2. 这些文件分别放哪里

| 文件 / 文件夹 | 放置位置 | 作用 | 注意事项 |
|---|---|---|---|
| `AGENTS.md` | 项目根目录 | Codex 每次进入项目先读取的固定规则 | 如果项目已有 `AGENTS.md`，不要覆盖，要合并 |
| `.agents/skills/xiaogou-saas-phase-executor/SKILL.md` | 项目根目录下 `.agents/skills/` | 给 Codex 的阶段化执行 Skill | 只用于流程约束，不直接替代阶段文档 |
| `docs/xiaogou-saas-roadmap/` | 项目 `docs/` 目录 | 产品规划、阶段文档、提示词模板 | 后续所有需求都沉淀在这里 |
| `05_PHASE_STATUS_阶段状态表.md` | `docs/xiaogou-saas-roadmap/` | 当前阶段、是否允许改代码、是否允许操作 Figma | 每次开始任务前都要读 |
| `06_DECISION_LOG_决策记录.md` | `docs/xiaogou-saas-roadmap/` | 记录关键产品决策 | 比聊天记录更可靠 |
| `phases/phase-xx/` | `docs/xiaogou-saas-roadmap/phases/` | 每个阶段的目标、需求、任务、验收 | Codex 每次只读当前阶段文件夹 |
| `prompt-templates/` | `docs/xiaogou-saas-roadmap/` | 可复制的通用 Prompt | 总控台会基于它生成目标会话 Prompt |
| `backlog/feature-requests/` | `docs/xiaogou-saas-roadmap/backlog/` | 新功能需求卡 | 不确定要不要做的先放这里 |
| `backlog/change-requests/` | 同上 | 已有功能修改卡 | UI/交互/逻辑优化放这里 |
| `backlog/bugs/` | 同上 | Bug 记录 | Bug 修复也要有验收标准 |

---

## 3. 放入项目的推荐操作步骤

### 3.1 先进入项目根目录

根据你之前的目录，Mac 上大概率是：

```bash
cd "$HOME/Desktop/闲鱼Agent/XianyuAgentPro"
```

先确认在项目根目录：

```bash
pwd
ls
```

你应该能看到类似：

```text
electron
package.json
README.md
.git
```

### 3.2 先看 Git 状态

```bash
git status
```

如果有未提交改动，先不要直接覆盖文档。建议先建一个分支：

```bash
git checkout -b chore/xiaogou-saas-roadmap
```

如果你已经在一个功能分支，也可以先只复制文档，然后单独 commit。

### 3.3 解压归档

假设你把归档下载到了 `Downloads`：

```bash
mkdir -p /tmp/xiaogou-roadmap
unzip "$HOME/Downloads/小狗相机助手商户版_Codex阶段化执行文档包.zip" -d /tmp/xiaogou-roadmap
```

看一下解压结果：

```bash
find /tmp/xiaogou-roadmap -maxdepth 3 -type f | head -50
```

通常会看到：

```text
/tmp/xiaogou-roadmap/xiaogou-saas-roadmap-package/AGENTS.md
/tmp/xiaogou-roadmap/xiaogou-saas-roadmap-package/docs/...
/tmp/xiaogou-roadmap/xiaogou-saas-roadmap-package/.agents/...
```

### 3.4 复制到项目根目录

如果项目里没有 `AGENTS.md`，可以：

```bash
rsync -av /tmp/xiaogou-roadmap/xiaogou-saas-roadmap-package/ ./
```

如果项目里已经有 `AGENTS.md`，不要直接覆盖。用下面命令先备份：

```bash
cp AGENTS.md AGENTS.md.backup.$(date +%Y%m%d-%H%M%S)
rsync -av --exclude='AGENTS.md' /tmp/xiaogou-roadmap/xiaogou-saas-roadmap-package/ ./
```

然后把归档里的 `AGENTS.md` 内容合并到现有 `AGENTS.md`。你可以让 Codex 做“只合并文档，不改代码”的任务。

### 3.5 补充 backlog 目录

如果归档里没有 backlog，执行：

```bash
mkdir -p docs/xiaogou-saas-roadmap/backlog/feature-requests
mkdir -p docs/xiaogou-saas-roadmap/backlog/change-requests
mkdir -p docs/xiaogou-saas-roadmap/backlog/bugs
cat > docs/xiaogou-saas-roadmap/backlog/README.md <<'EOF'
# Backlog 总入口

这里用于沉淀后续新功能、功能修改和 Bug。

- feature-requests/：新功能需求
- change-requests/：已有功能修改
- bugs/：Bug 记录

所有新想法先由总控台判断归属，再决定是否写入 Backlog 或进入当前阶段。
EOF
```

### 3.6 验证文件是否放对

```bash
test -f AGENTS.md && echo "AGENTS.md OK"
test -f docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md && echo "阶段状态表 OK"
test -d docs/xiaogou-saas-roadmap/phases/phase-00-project-audit && echo "Phase 00 OK"
test -f .agents/skills/xiaogou-saas-phase-executor/SKILL.md && echo "Skill OK"
```

### 3.7 提交文档基线

```bash
git add AGENTS.md .agents docs/xiaogou-saas-roadmap README_如何使用这套文档.md
git commit -m "docs: add xiaogou saas roadmap and codex execution guides"
```

如果你暂时不想提交，也至少保留一份压缩包和 `git status` 截图，防止后面乱改不好回退。

---

## 4. 需要创建哪些 Codex 会话

建议创建 5 个长期会话。每个会话只负责一种工作，不要混用。

| 会话名称 | 角色 | 是否改代码 | 是否操作 Figma | 主要用途 |
|---|---|---:|---:|---|
| 小狗相机助手 - 总控与阶段推进 | 项目经理 / 产品总控 | 否 | 否 | 判断阶段、生成调度单、更新文档建议 |
| 小狗相机助手 - Figma 设计系统 | 设计代理 | 否 | 是 | Design System、组件库、页面原型 |
| 小狗相机助手 - 前端 UI 与交互改造 | 前端执行代理 | 是 | 否 | 组件重构、页面改造、交互实现 |
| 小狗相机助手 - 登录商户权限数据隔离 | SaaS 底座代理 | 是 | 否 | 登录、商户、门店、员工、权限、数据库迁移 |
| 小狗相机助手 - 阶段验收与代码审查 | 验收代理 | 原则上否 | 原则上否 | 对照验收标准检查结果，防止跑偏 |

可选第 6 个：

```text
小狗相机助手 - 需求 Backlog 与产品文档
```

如果后面需求很多，可以单独让这个会话只负责整理 FR / CR / BUG 文档。但前期总控台也可以承担。

---

## 5. 创建会话前要准备什么

### 5.1 Codex App / Codex 环境

你需要保证 Codex 能打开这个项目仓库。推荐使用 Codex App 或你当前能访问项目文件的 Codex 工作区。

每个会话都要打开同一个项目目录，但执行范围不同。

### 5.2 Figma MCP

如果你要让 Codex 操作 Figma，需要在 Codex App 中安装 Figma 插件并授权 Figma。Figma 官方说明中，Codex App 可通过 Plugins 安装 Figma，并完成 Figma 授权。

建议先建一个 Figma 文件：

```text
小狗相机助手商户版 Design System
```

然后在 Figma 会话中只让它做：

```text
创建 Figma 原生可编辑图层、Frame、Auto Layout、Component、Variables、Text Styles。
不要生成 PNG，不要生成单张 UI 图片。
```

### 5.3 Git 分支规则

不要让多个会话同时改同一批文件。推荐：

```text
总控台：不改代码
Figma 会话：只操作 Figma 或设计文档
前端会话：只改前端 UI / 组件
SaaS 底座会话：只改登录 / 数据库 / 权限
验收会话：只检查，不开发
```

如果必须并行，建议使用不同 Git 分支或 worktree。

---

## 6. 总控台会话如何创建和初始化

### 6.1 会话名称

```text
小狗相机助手 - 总控与阶段推进
```

### 6.2 第一次初始化 Prompt

复制下面这段给总控台会话：

```text
你现在是“小狗相机助手商户版”项目的总控台代理。

重要背景：
本项目已经从“闲鱼助手”重新定位为“租赁商户运营标准化系统”。
闲鱼不再是产品核心，只能作为订单来源渠道之一。
当前阶段目标以 docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md 为准。

你的职责：
1. 判断当前应该执行哪个阶段；
2. 判断新需求属于哪个阶段；
3. 输出总控台调度单；
4. 告诉我应该去哪个 Codex 会话；
5. 生成给目标会话的完整 Prompt；
6. 判断是否需要更新 FR / CR / BUG / 决策记录 / 阶段状态表；
7. 防止跨阶段开发；
8. 不直接修改代码；
9. 不直接操作 Figma；
10. 不执行数据库迁移。

每次你必须先读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/00_README_总控入口.md
3. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
4. docs/xiaogou-saas-roadmap/04_CODEX_EXECUTION_RULES_Codex执行纪律.md

请先只输出：
1. 你理解的新产品定位；
2. 当前阶段；
3. 当前阶段允许做什么；
4. 当前阶段禁止做什么；
5. 我接下来应该启动哪个会话；
6. 给目标会话的第一条 Prompt。

不要修改任何文件。
```

### 6.3 以后每次问总控台

每次推进项目时，先问总控台：

```text
请读取当前阶段状态表，判断我现在应该执行哪个阶段、使用哪个会话，并生成给目标会话的完整 Prompt。
只输出【总控台调度单】，不要修改代码。
```

### 6.4 总控台应该输出什么

要求它输出固定格式：

```text
【总控台调度单】

当前阶段：
本次任务类型：
建议使用会话：
是否需要新建会话：
本次允许做什么：
本次禁止做什么：
需要读取的文件：
需要更新的文档：
目标会话 Prompt：
目标会话完成后需要回传：
是否需要验收会话：
```

---

## 7. Figma 设计会话如何创建和使用

### 7.1 会话名称

```text
小狗相机助手 - Figma 设计系统
```

### 7.2 第一次初始化 Prompt

```text
你现在是“小狗相机助手商户版”的 Figma 设计代理。

你的职责：
1. 使用 Figma MCP；
2. 创建 Design System；
3. 创建组件库；
4. 创建移动端和 PC 端核心页面；
5. 所有内容必须是 Figma 原生可编辑图层；
6. 使用 Frame、Auto Layout、Component、Variant、Color Variables、Text Styles；
7. 不要生成 PNG；
8. 不要修改项目代码；
9. 不要跨阶段设计未来功能。

每次执行前必须读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
3. 当前阶段文件夹里的 03_FIGMA_TASKS_Figma设计任务.md
4. 当前阶段文件夹里的 06_ACCEPTANCE_CRITERIA_验收标准.md

请先不要操作 Figma。
请先输出你理解的 Figma 工作规则、当前阶段设计目标，以及执行前需要我提供的 Figma 文件链接或节点链接。
```

### 7.3 执行 Phase 02 时的 Prompt

```text
现在执行 Phase 02 Design System。
请只读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
3. docs/xiaogou-saas-roadmap/phases/phase-02-design-system/

请使用 Figma MCP。
本次只做计划，不要操作 Figma。

请输出：
1. 准备创建的 Figma 页面；
2. 准备创建的 Variables；
3. 准备创建的 Text Styles；
4. 准备创建的组件清单；
5. 移动端页面清单；
6. PC 端页面清单；
7. 需要我确认的设计决策。
```

你确认后再发：

```text
确认执行。
请开始操作 Figma。
要求：
1. 不生成 PNG；
2. 不生成静态图片；
3. 所有元素必须是 Figma 原生可编辑图层；
4. 使用 Auto Layout；
5. 创建完成后输出 Figma 页面清单、组件清单、未完成项和验收建议。
```

---

## 8. 前端 UI 与交互改造会话如何创建和使用

### 8.1 会话名称

```text
小狗相机助手 - 前端 UI 与交互改造
```

### 8.2 第一次初始化 Prompt

```text
你现在是“小狗相机助手商户版”的前端 UI 与交互改造代理。

你的职责：
1. 基于 Design System 和 Figma 设计重构前端；
2. 新建或重构基础组件；
3. 重构 AppShell；
4. 重构工作台、订单、档期、设备、商家中心等页面；
5. 保持现有可用业务能力不被破坏；
6. 不擅自改数据库；
7. 不做登录权限，除非当前阶段明确要求；
8. 不做商户协作交易功能；
9. 每次先计划，等我确认后再改代码。

每次执行前必须读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
3. 当前阶段文件夹里的 04_CODEX_TASKS_Codex开发任务.md
4. 当前阶段文件夹里的 06_ACCEPTANCE_CRITERIA_验收标准.md

请先分析项目的前端目录、路由、组件结构，不要修改代码。
```

### 8.3 前端执行时的通用 Prompt

```text
现在执行总控台调度单中的前端任务。

请先读取：
1. AGENTS.md
2. 阶段状态表
3. 当前阶段 Codex 任务文档
4. 当前阶段验收标准
5. 总控台调度单

本次先进入计划模式，不要修改代码。
请输出：
1. 当前任务目标；
2. 准备修改的文件；
3. 不会修改的文件；
4. 风险点；
5. 验证方式；
6. 需要我确认的问题。
```

确认后：

```text
计划确认，可以执行。
请按最小改动原则修改，不要跨阶段扩展功能。
执行完成后输出：
1. 修改文件列表；
2. 核心改动说明；
3. 如何启动和验证；
4. 截图或页面检查建议；
5. 是否满足验收标准；
6. 是否需要验收会话介入。
```

---

## 9. SaaS 底座会话如何创建和使用

### 9.1 会话名称

```text
小狗相机助手 - 登录商户权限数据隔离
```

### 9.2 第一次初始化 Prompt

```text
你现在是“小狗相机助手商户版”的 SaaS 底座改造代理。

你的职责：
1. 设计和实现登录系统；
2. 设计 Merchant 商户模型；
3. 设计 Store 门店模型；
4. 设计 Staff 员工模型；
5. 设计 Role / Permission 权限模型；
6. 给核心业务数据补 merchant_id / store_id；
7. 输出数据库迁移方案；
8. 输出旧数据迁移方案；
9. 输出回滚方案；
10. 不重构 UI；
11. 不做商户调货、代发、二手交易。

每次执行前必须先：
1. 读取 AGENTS.md；
2. 读取阶段状态表；
3. 读取 phase-03-saas-base 文件夹；
4. 分析当前数据库结构；
5. 输出计划和风险；
6. 等我确认后再改代码或迁移数据库。

请先分析当前项目是否已有登录、用户、数据库连接、订单、设备、档期相关表结构。
不要修改任何代码。
```

### 9.3 Phase 03 启动 Prompt

```text
现在执行 Phase 03 SaaS 底座。

请只读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
3. docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/
4. 当前项目数据库与后端相关文件

本次只做分析，不要修改代码，不要迁移数据库。

请输出：
1. 当前数据库结构分析；
2. 哪些表需要增加 merchant_id / store_id；
3. 需要新增哪些表；
4. 旧数据如何归属默认商户；
5. 登录与权限方案；
6. 迁移风险；
7. 回滚方案；
8. 分步骤执行计划。
```

---

## 10. 验收与代码审查会话如何创建和使用

### 10.1 会话名称

```text
小狗相机助手 - 阶段验收与代码审查
```

### 10.2 第一次初始化 Prompt

```text
你现在是“小狗相机助手商户版”的验收与审查代理。

你的职责：
1. 对照当前阶段验收标准检查结果；
2. 检查是否跨阶段；
3. 检查是否破坏旧功能；
4. 检查 UI 是否符合 Design System；
5. 检查是否需要补测试；
6. 输出验收报告；
7. 不主动新增需求；
8. 不擅自改代码。

每次验收前必须读取：
1. AGENTS.md
2. 阶段状态表
3. 当前阶段 06_ACCEPTANCE_CRITERIA_验收标准.md
4. 当前阶段 07_NEXT_PHASE_GATE_进入下一阶段条件.md
5. 目标会话输出的执行总结

请先输出你会如何做阶段验收，不要修改代码。
```

### 10.3 阶段验收 Prompt

```text
请对当前阶段成果做验收。

请读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
3. 当前阶段 06_ACCEPTANCE_CRITERIA_验收标准.md
4. 当前阶段 07_NEXT_PHASE_GATE_进入下一阶段条件.md
5. 本次执行总结

请输出：
1. 已通过项；
2. 未通过项；
3. 风险项；
4. 是否跨阶段；
5. 是否破坏旧功能；
6. 是否允许进入下一阶段；
7. 如果不允许，还缺什么；
8. 给总控台的回传摘要。

不要新增功能，不要重构代码。
```

---

## 11. 如何开始正式改造

### 11.1 第一步：只做文档和规则落地

先不要改功能。

你先完成：

```text
1. 复制归档到项目；
2. 补 backlog 目录；
3. 确认 AGENTS.md 生效；
4. Git commit 一次文档基线；
5. 创建 5 个 Codex 会话；
6. 初始化总控台会话。
```

### 11.2 第二步：从总控台启动 Phase 00

发给总控台：

```text
现在我要开始正式改造项目。
请读取阶段状态表，判断当前应该从哪个阶段开始，并生成给目标会话的完整 Prompt。
只输出总控台调度单，不要修改代码。
```

正常情况下，总控台应该让你从：

```text
Phase 00：当前项目盘点与旧逻辑冻结
```

开始。

### 11.3 第三步：把总控台生成的 Prompt 复制给执行会话

Phase 00 可以用“前端 UI 与交互改造会话”或新建一个临时会话：

```text
小狗相机助手 - Phase 00 项目盘点
```

第一轮必须只做分析，不改代码：

```text
现在执行 Phase 00：当前项目盘点与旧逻辑冻结。

请读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/00_README_总控入口.md
3. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
4. docs/xiaogou-saas-roadmap/phases/phase-00-project-audit/

请先不要修改代码，不要操作 Figma，不要迁移数据库。

请输出：
1. 当前项目技术栈；
2. 当前项目目录结构；
3. 当前路由和页面清单；
4. 当前核心业务能力；
5. 需要保留的功能；
6. 可以废弃或标记 legacy 的闲鱼绑定逻辑；
7. 可能影响后续 SaaS 化的数据结构；
8. 风险点；
9. 下一步建议。
```

### 11.4 第四步：Phase 00 完成后回传总控台

执行会话完成后，复制总结给总控台：

```text
Phase 00 执行会话已完成项目盘点。

执行总结：
【粘贴执行会话输出】

请你作为总控台：
1. 判断是否满足 Phase 00 验收标准；
2. 判断是否允许进入 Phase 01；
3. 如果允许，生成更新阶段状态表的文档修改建议；
4. 生成 Phase 01 目标会话 Prompt。
不要修改代码。
```

### 11.5 第五步：通过验收后再更新阶段状态表

如果总控台判断通过，你再让它更新文档：

```text
确认通过 Phase 00。
请只更新文档，不要改业务代码。

请更新：
1. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
2. docs/xiaogou-saas-roadmap/06_DECISION_LOG_决策记录.md
3. phase-00-project-audit/artifacts/ 中的阶段总结

更新后输出 Phase 01 的启动 Prompt。
```

---

## 12. 新功能或修改以后怎么处理

以后你有任何想法，先给总控台，不要直接给开发会话。

### 12.1 提出新功能

```text
我有一个新功能想法，请先不要开发，也不要直接更新文档。

需求描述：
【这里写你的想法】

请你作为总控台先判断：
1. 这是新功能、功能修改、Bug、产品决策，还是阶段推进？
2. 它属于哪个阶段？
3. 当前是否应该做？
4. 如果现在不做，应该放入哪个 Backlog？
5. 如果现在做，需要更新哪些文档？
6. 是否涉及 Figma、前端、后端、数据库、权限？
7. 应该交给哪个执行会话？
8. 请生成一张【总控台调度单】。
9. 请生成需要写入文档的草稿内容。

在我确认前，不要修改任何文件。
```

### 12.2 确认后更新文档

```text
确认这个调度方案。

请只更新文档，不要改业务代码，不要操作 Figma，不要执行数据库迁移。

请完成：
1. 创建或更新对应的 FR / CR / BUG 文档；
2. 如属于当前阶段，更新当前阶段的需求文档、任务文档和验收标准；
3. 如涉及产品决策，更新 06_DECISION_LOG_决策记录.md；
4. 如影响当前阶段状态，更新 05_PHASE_STATUS_阶段状态表.md；
5. 输出本次文档变更摘要；
6. 输出下一步应该复制给目标会话的 Prompt。
```

### 12.3 交给目标会话执行

```text
现在执行总控台调度单中的任务。

请先读取：
1. AGENTS.md
2. 阶段状态表
3. 对应 FR / CR / BUG 文档
4. 当前阶段需求文档
5. 当前阶段验收标准

请先进入计划模式，不要修改代码。
```

### 12.4 完成后回传总控台

```text
目标会话已完成本次任务。

执行结果：
【粘贴目标会话总结】

请你更新：
1. 对应 FR / CR / BUG 的处理状态；
2. 当前阶段状态表；
3. 决策记录，如果有新增决策；
4. artifacts 记录；
5. 判断是否需要验收会话介入；
6. 判断是否允许进入下一阶段。
```

---

## 13. 阶段顺序和开始条件

| 阶段 | 名称 | 目标 | 进入下一阶段条件摘要 |
|---|---|---|---|
| Phase 00 | 当前项目盘点与旧逻辑冻结 | 看懂项目，不改功能，标记 legacy | 项目结构、保留/废弃清单完成 |
| Phase 01 | 产品定位与系统骨架固定 | 固定产品定位、导航、模块边界 | 定位、手机/PC 导航、业务流程确认 |
| Phase 02 | 设计系统与 Figma 基础组件 | 固定 UI 规则和组件库 | Design System 和核心组件确认 |
| Phase 03 | SaaS 底座 | 登录、商户、门店、员工、权限、数据隔离 | 登录可用，核心数据绑定 merchant_id |
| Phase 04 | 核心业务流程重构 | 订单、档期、设备、免押、物流系统化 | 创建订单到完结订单完整跑通 |
| Phase 05 | 员工 SOP | 新员工快速上手、检查清单、话术、任务 | 新员工可独立处理一次订单 |
| Phase 06 | 经营数据与报表 | 设备、订单、渠道、员工效率分析 | 至少 5 个核心报表可用 |
| Phase 07 | 商户 Beta | 外部商户试用 | 至少 1 个外部商户完整试用 |
| Phase 08 | 商户协作预留 | 调货、代发、二手交易规划 | 收集真实需求后再开发 |

---

## 14. 什么时候不能继续往下做

遇到以下情况，不要进入下一阶段：

```text
1. 当前阶段验收标准没有完成；
2. Codex 改坏了现有核心功能；
3. 数据库没有备份就要迁移；
4. UI 设计系统还没确认就开始大改页面；
5. 登录和 merchant_id 没做就想给外部商户试用；
6. 订单流程没跑通就开始做商户协作；
7. 总控台没有生成调度单，执行会话直接开始开发。
```

---

## 15. 跑偏时如何叫停 Codex

如果 Codex 开始做不该做的功能，直接发：

```text
停止当前执行。

你已经偏离当前阶段范围。

请回到：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
3. 当前阶段文件夹

重新说明：
1. 当前阶段目标是什么；
2. 你刚才哪里越界了；
3. 接下来如何回到阶段范围内；
4. 是否需要回滚刚才的修改。

不要继续修改代码。
```

---

## 16. 最开始 3 天建议怎么做

### Day 1：文档落地和会话创建

```text
1. 解压归档；
2. 放入项目目录；
3. 补 backlog；
4. commit 文档基线；
5. 创建 5 个 Codex 会话；
6. 初始化总控台。
```

### Day 2：Phase 00 项目盘点

```text
1. 总控台生成 Phase 00 调度单；
2. 执行会话只做项目盘点；
3. 输出保留功能、废弃功能、legacy 闲鱼逻辑；
4. 不改代码；
5. 验收会话检查 Phase 00。
```

### Day 3：Phase 01 产品骨架确认

```text
1. 总控台启动 Phase 01；
2. 确认新产品定位；
3. 确认手机端导航；
4. 确认 PC 端导航；
5. 确认短期不做商户协作；
6. 更新阶段状态表。
```

---

## 17. 你本人需要做什么

你不是只看 Codex 做。你作为产品负责人，需要负责：

1. 确认产品方向：现在先做商户内部提效，不做调货闭环；
2. 提供真实业务流程：从询单到完结订单；
3. 判断哪些功能必须保留；
4. 判断哪些闲鱼旧逻辑可以废弃；
5. 确认导航和页面结构；
6. 测试真实订单流程；
7. 验收每个阶段；
8. 不让 Codex 跨阶段。

你以后最常说的三句话应该是：

```text
请先进入计划模式，不要修改代码。
```

```text
请先给总控台调度单，不要执行开发。
```

```text
请根据当前阶段验收标准判断是否允许进入下一阶段。
```

---

## 18. 一句话总结

这次归档的意义不是马上让 Codex 重写项目，而是把项目从“靠聊天推动”升级为“靠阶段文档和多会话协作推动”。

正确启动方式是：

```text
先放文档 → 再建会话 → 先问总控台 → 从 Phase 00 盘点开始 → 阶段验收通过后再改设计和代码。
```

不要一开始就让 Codex 做 Figma 或重构业务。先让它明白：

```text
闲鱼不再是核心；
新产品是租赁商户运营标准化系统；
当前目标是内部提效和流程标准化；
未来才是多商户 SaaS 和商户协作网络。
```

---

## 19. 官方参考说明

- OpenAI Codex 的 `AGENTS.md` 用于给 Codex 提供项目级固定指令，Codex 会在开始工作前读取这类说明。
- OpenAI Codex 最佳实践建议复杂任务先计划，再执行，并通过验证步骤控制质量。
- Figma 官方提供 Codex + Figma MCP 的设置方式，Codex App 可通过插件安装 Figma 并授权访问 Figma 文件。
- Figma MCP 的价值是让 AI 读取结构化设计上下文，而不是只看 UI 图片。

这些官方能力不替代你的项目阶段文档；它们只是帮助 Codex 更稳定地执行阶段文档。
