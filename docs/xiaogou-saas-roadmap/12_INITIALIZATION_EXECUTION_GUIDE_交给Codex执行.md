# Codex 初始化执行说明：把阶段化文档放入项目并启动 Phase 00

> 这份文档可以直接发给 Codex。目标是让 Codex 先完成“文档与执行规则初始化”，不要改业务代码。

## 0. 本次任务边界

本次只做初始化：

1. 解压或读取本包；
2. 将 `setup/AGENTS.md`、`setup/.agents/`、`setup/docs/` 放到项目根目录；
3. 如项目已有 `AGENTS.md`，先备份，再合并规则，不要直接覆盖；
4. 创建 Backlog 目录；
5. 检查文件是否放对；
6. 输出下一步 Phase 00 的启动 Prompt。

本次禁止：

- 不修改业务代码；
- 不修改数据库；
- 不启动服务；
- 不操作 Figma；
- 不执行 Phase 01 以后任务；
- 不删除现有可用文件。

---

## 1. 给 Codex 的执行 Prompt

复制下面这段给 Codex：

```text
你现在是“小狗相机助手商户版”的项目初始化执行代理。

本项目已经从“闲鱼助手”升级为“租赁商户运营标准化系统”。闲鱼不再是产品核心，只能作为订单来源渠道之一。

本次任务：
只把我提供的阶段化文档包放入当前项目，并完成初始化检查。不要修改任何业务代码。

请先执行以下动作：
1. 确认当前项目根目录；
2. 定位我提供的初始化包，包内应包含 setup/AGENTS.md、setup/.agents、setup/docs；
3. 输出你准备复制/合并哪些文件；
4. 如项目已有 AGENTS.md、docs/xiaogou-saas-roadmap、.agents，请先创建备份目录：.xiaogou_init_backup/<timestamp>/；
5. 将 setup/docs 合并到项目根目录 docs；
6. 将 setup/.agents 合并到项目根目录 .agents；
7. 如项目不存在 AGENTS.md，复制 setup/AGENTS.md；如已存在 AGENTS.md，请先备份，再在文件末尾追加“小狗相机助手商户版项目规则”区块，不要删除原内容；
8. 确保这些目录存在：
   - docs/xiaogou-saas-roadmap/backlog/feature-requests
   - docs/xiaogou-saas-roadmap/backlog/change-requests
   - docs/xiaogou-saas-roadmap/backlog/bugs
   - docs/xiaogou-saas-roadmap/backlog/research
9. 检查并列出最终文件结构；
10. 不要改业务代码，不要运行数据库迁移，不要操作 Figma。

请先进入计划模式，只输出：
- 当前项目根目录；
- 初始化包位置；
- 准备复制/合并的文件；
- 备份策略；
- 风险点；
- 需要我确认的问题。

我确认后你再执行文件复制。
```

---

## 2. Codex 执行完成后应返回

Codex 完成后必须输出：

```text
1. 实际复制/合并了哪些文件；
2. 备份目录在哪里；
3. AGENTS.md 是新建还是合并；
4. docs/xiaogou-saas-roadmap 是否完整；
5. backlog 目录是否创建；
6. 是否改动业务代码；
7. 下一步 Phase 00 启动 Prompt。
```

---

## 3. 初始化完成后的 Phase 00 启动 Prompt

初始化完成后，复制下面这段给“总控台会话”：

```text
你现在是“小狗相机助手商户版”项目总控台。

请读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/00_README_总控入口.md
3. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
4. docs/xiaogou-saas-roadmap/08_CODEX_DAILY_EXECUTION_GUIDE_每次执行手册.md
5. docs/xiaogou-saas-roadmap/phases/phase-00-project-audit/

请生成 Phase 00 的【总控台调度单】，告诉我：
1. 应该创建/使用哪个执行会话；
2. 目标会话需要读取哪些文件；
3. 本次允许做什么；
4. 本次禁止做什么；
5. 给目标会话的完整 Prompt。

不要修改代码。
```

---

## 4. 注意

Codex 可以帮你把文件放进项目、创建目录、合并 `AGENTS.md`、生成阶段启动 Prompt。

但“创建多个 Codex 会话”通常还是你在 Codex App 里手动创建。Codex 可以生成每个会话的初始化 Prompt，但不能保证能自动替你在 Codex UI 里创建新会话。
