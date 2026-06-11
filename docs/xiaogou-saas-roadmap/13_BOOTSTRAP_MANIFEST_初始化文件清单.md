# 初始化文件清单

本包用于把“小狗相机助手商户版”的阶段化改造文档、Codex 执行规则、会话初始化提示词、Backlog 目录一次性放入项目。

## 应放到项目根目录的内容

- `AGENTS.md`：Codex 项目级固定规则。
- `.agents/skills/xiaogou-saas-phase-executor/SKILL.md`：阶段化执行 Skill。
- `docs/xiaogou-saas-roadmap/`：产品规划、阶段路线图、阶段文件夹、提示词、Backlog。

## 放入后项目应类似

```text
XianyuAgentPro/
  AGENTS.md
  .agents/
    skills/
      xiaogou-saas-phase-executor/
        SKILL.md
  docs/
    xiaogou-saas-roadmap/
      00_README_总控入口.md
      05_PHASE_STATUS_阶段状态表.md
      10_CODEX_SESSION_SETUP_AND_START_GUIDE_多会话创建与改造启动手册.md
      11_CODEX_MULTI_SESSION_GUIDE_多会话创建使用与提问手册.md
      12_INITIALIZATION_EXECUTION_GUIDE_交给Codex执行.md
      backlog/
      phases/
      prompt-templates/
      prompts-for-sessions/
```
