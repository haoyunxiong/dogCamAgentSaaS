# CONFIG_SOURCE_AUDIT 当前配置来源审计

> 本文档用于记录当前项目中所有重要配置的来源、风险、未来归属和迁移建议。
> 当前阶段不要求立即开发配置中心；先做只读审计和风险分类。

## 审计状态

```text
状态：待执行
所属需求：CR-0001 配置中心与敏感配置治理
建议执行阶段：Phase 03 SaaS 底座
```

## 配置分类

| 分类 | 说明 | 推荐未来位置 |
|---|---|---|
| 系统默认配置 | 不敏感，可作为产品默认值 | 代码默认配置文件 |
| 本地运行配置 | 本地机器运行相关，不提交 Git | local.env / mysql-connection.json / 本地配置 |
| 商户业务配置 | 不同商户不同，需隔离 | MySQL / DB，带 merchant_id / store_id |
| 敏感凭证 | 密码、Token、Cookie、API Key 等 | 加密存储 / CredentialService |

## 审计表

| 配置名称 | 当前来源 | 当前文件 / 表 / 模块 | 配置分类 | 是否敏感 | 是否会进入 Git | 当前风险等级 | 未来推荐存储位置 | 是否需要迁移 | 所属阶段 | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|
| 示例：MySQL 连接密码 | mysql-connection.json / local.env / mysqlConfig.js | 待审计 | 敏感凭证 | 是 | 否 | 高 | 本地配置 / 加密凭证库 | 是 | Phase 03 | 不应写死，不应提交 Git |
| 示例：默认订单状态 | 前端/后端枚举 | 待审计 | 系统默认配置 | 否 | 是 | 低 | 代码默认配置 | 否 | Phase 04 | 可保留为枚举配置 |
| 示例：商户发货地址 | 待审计 | 待审计 | 商户业务配置 | 可能 | 否/DB | 中 | MySQL store_settings | 是 | Phase 03 | 需按 merchant_id / store_id 隔离 |

## 只读审计任务

审计时请扫描：

```text
electron/main/
electron/renderer/
python/
config/
scripts/
docs/
DATABASE.md
scripts/mysql_schema.sql
electron/main/dbManager.js
electron/main/mysqlConfig.js
electron/main/mysqlAdapter.js
python/mysql_config.py
python/mysql_helper.py
python/config_manager.py
```

搜索关键词：

```text
config settings env process.env mysql password token cookie api_key secret dbManager app_config localStorage SQLite MySQL credential merchant store
```

## 输出要求

- 不输出真实密码、Token、Cookie、连接串原文；
- 只输出路径、行号、风险等级、推荐处理方式；
- 如果发现真实敏感值，标记为高风险；
- 如果只是变量名或字段名，标记为误报；
- 如果是已被 `.gitignore` 排除的本地文件，标记为不会进入 Git。
