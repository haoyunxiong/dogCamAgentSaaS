# 15 配置审计补丁安装说明

## 1. 本补丁新增了什么

本补丁把“配置中心与敏感配置治理”纳入项目阶段化文档体系，新增：

- 配置治理总纲；
- 配置治理需求卡；
- 当前配置来源审计模板；
- Phase 03 配置审计 artifact 模板；
- Phase 03 配置治理补充文档；
- 配置审计 Prompt 模板；
- 配置审计专用会话初始化 Prompt；
- AGENTS / Prompt Index / 多会话手册 / Phase 03 文档的追加片段；
- Skill 资源文件。

## 2. 需要复制到哪里

将补丁包中的：

```text
01_COPY_TO_PROJECT_ROOT/
```

合并到项目根目录。

最终新增路径包括：

```text
docs/xiaogou-saas-roadmap/14_CONFIG_GOVERNANCE_配置治理总纲.md
docs/xiaogou-saas-roadmap/15_CONFIG_AUDIT_PATCH_INSTALL_GUIDE_配置审计补丁安装说明.md
docs/xiaogou-saas-roadmap/backlog/change-requests/CR-0001_配置中心与敏感配置治理.md
docs/xiaogou-saas-roadmap/reference-docs/current-codebase/CONFIG_SOURCE_AUDIT.md
docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/artifacts/config-source-audit.md
docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/09_CONFIG_GOVERNANCE_ADDENDUM_配置治理补充.md
docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/prompts/04_config_audit_plan_prompt.md
docs/xiaogou-saas-roadmap/prompt-templates/09_Config_创建配置治理需求卡.md
docs/xiaogou-saas-roadmap/prompt-templates/10_Config_配置来源审计.md
docs/xiaogou-saas-roadmap/prompt-templates/11_Config_敏感命中复核.md
docs/xiaogou-saas-roadmap/prompt-templates/12_Config_配置治理开发计划.md
docs/xiaogou-saas-roadmap/prompts-for-sessions/05_配置审计与配置治理会话初始化Prompt.md
docs/xiaogou-saas-roadmap/append-snippets/*.md
.agents/skills/xiaogou-saas-phase-executor/resources/config-governance.md
```

## 3. 需要追加到哪些已有文档

补丁不会直接覆盖已有文档。需要让 Codex 将 `append-snippets/` 里的内容追加到对应文档：

| snippet | 目标文档 |
|---|---|
| `AGENTS_APPEND_配置治理规则.md` | 根目录 `AGENTS.md` |
| `09_PROMPT_INDEX_APPEND_配置审计.md` | `docs/xiaogou-saas-roadmap/09_PROMPT_INDEX_提示词索引.md` |
| `11_MULTI_SESSION_GUIDE_APPEND_配置审计会话.md` | `docs/xiaogou-saas-roadmap/11_CODEX_MULTI_SESSION_GUIDE_多会话创建使用与提问手册.md` |
| `PHASE03_REQUIREMENTS_APPEND_配置治理.md` | `phase-03-saas-base/02_REQUIREMENTS_需求文档.md` |
| `PHASE03_CODEX_TASKS_APPEND_配置治理.md` | `phase-03-saas-base/04_CODEX_TASKS_Codex开发任务.md` |
| `PHASE03_ACCEPTANCE_APPEND_配置治理.md` | `phase-03-saas-base/06_ACCEPTANCE_CRITERIA_验收标准.md` |

## 4. 安装后如何使用

### 4.1 当前首次提交阶段

只用于敏感命中复核。

原则：

```text
变量名 / 字段名 / 配置读取 / 参数传递 = SAFE_FALSE_POSITIVE
已被 Git 忽略的本地配置 = IGNORED_LOCAL_FILE
真实硬编码密钥 = REAL_SECRET，停止提交
不确定 = NEED_USER_CONFIRMATION，停止提交
```

### 4.2 后续 Phase 03 阶段

使用：

```text
prompts-for-sessions/05_配置审计与配置治理会话初始化Prompt.md
prompt-templates/10_Config_配置来源审计.md
```

执行配置来源审计。

## 5. 不要做什么

- 不要在首次提交阶段重构配置中心；
- 不要直接新增数据库表；
- 不要直接迁移配置；
- 不要把真实敏感值写入文档；
- 不要在未经确认时提交真实凭证。
