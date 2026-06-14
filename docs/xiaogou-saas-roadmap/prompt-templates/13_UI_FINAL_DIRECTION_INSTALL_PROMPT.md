# Prompt 13: UI 最终风格归档安装

将本包放在项目根目录后，把本文件内容复制给“项目盘点与代码分析会话”。

```text
现在执行【最终 UI 风格归档包安装】。

当前项目根目录：
/Users/lishuangshuang/Documents/租赁SAAS系统

我已经把 UI 风格归档包放在项目根目录。

本次目标：
1. 解压 UI 风格归档包；
2. 将 01_COPY_TO_PROJECT_ROOT/ 下的内容合并到项目根目录；
3. 只新增/更新 docs/xiaogou-saas-roadmap/ 下的设计图片和 Markdown 文档；
4. 不修改业务代码；
5. 不操作 Figma；
6. 不执行数据库迁移；
7. 不 git add / commit / push。

本次允许新增/更新：
- docs/xiaogou-saas-roadmap/design-references/final-ui-direction/
- docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/final-ui-style-lock.md
- docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/frontend-implementation-brief.md
- docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/page-component-mapping.md
- docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/mobile-ui-guidelines.md
- docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/figma-reconciliation-plan.md
- docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/final-ui-assets-index.md
- docs/xiaogou-saas-roadmap/prompt-templates/13_UI_FINAL_DIRECTION_INSTALL_PROMPT.md
- docs/xiaogou-saas-roadmap/prompt-templates/14_UI_FRONTEND_PLANNING_PROMPT.md

本次禁止修改：
- electron/
- python/
- scripts/
- data/
- config/environments/local.env
- mysql-connection.json
- 数据库文件
- 构建产物
- node_modules

请先检查包内容，输出准备新增/覆盖文件清单。
如果目标文件已存在，请先报告冲突，不要直接覆盖。
确认无风险后再执行复制。

完成后执行：
pwd
git status --short
git diff --name-only
git diff --check

输出：
1. 新增/更新了哪些文件；
2. 是否只影响 docs/xiaogou-saas-roadmap/；
3. 是否没有业务代码变更；
4. git status --short；
5. 是否建议交给总控台登记 UI 风格冻结。
```
