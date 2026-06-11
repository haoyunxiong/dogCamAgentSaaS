# Prompt Template：配置来源审计

```text
现在执行“配置来源审计”，不要开发，不要迁移数据库，不要修改业务逻辑。

请读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
3. docs/xiaogou-saas-roadmap/14_CONFIG_GOVERNANCE_配置治理总纲.md
4. docs/xiaogou-saas-roadmap/backlog/change-requests/CR-0001_配置中心与敏感配置治理.md
5. docs/xiaogou-saas-roadmap/reference-docs/current-codebase/CONFIG_SOURCE_AUDIT.md
6. docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/09_CONFIG_GOVERNANCE_ADDENDUM_配置治理补充.md

请只做只读审计。

扫描范围：
- electron/main/
- electron/renderer/
- python/
- config/
- scripts/
- docs/
- DATABASE.md
- scripts/mysql_schema.sql
- electron/main/dbManager.js
- electron/main/mysqlConfig.js
- electron/main/mysqlAdapter.js
- python/mysql_config.py
- python/mysql_helper.py
- python/config_manager.py

搜索关键词：
- config
- settings
- env
- process.env
- mysql
- password
- token
- cookie
- api_key
- secret
- dbManager
- app_config
- localStorage
- SQLite
- MySQL
- credential
- merchant
- store

输出 CONFIG_SOURCE_AUDIT.md 审计表，字段包括：
- 配置名称
- 当前来源
- 当前文件 / 表 / 模块
- 配置分类
- 是否敏感
- 是否会进入 Git
- 当前风险等级
- 未来推荐存储位置
- 是否需要迁移
- 所属阶段
- 备注

配置分类：
1. 系统默认配置
2. 本地运行配置
3. 商户业务配置
4. 敏感凭证

不要输出真实密码、token、cookie、连接串原文。
如果发现真实硬编码敏感值，只标记路径、行号、风险等级，不输出原文。

完成后输出：
1. 当前配置主要分布在哪里；
2. 哪些已经在 MySQL / DB 中；
3. 哪些仍在文件中；
4. 哪些是代码变量名误报；
5. 哪些是高风险；
6. 建议后续新增哪些 ConfigService / CredentialService；
7. 是否建议进入配置治理开发。
```
