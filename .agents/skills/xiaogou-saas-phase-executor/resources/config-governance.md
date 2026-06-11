# Resource：配置治理规则

本资源用于 xiaogou-saas-phase-executor Skill 在处理配置、敏感扫描、提交前安全检查、Phase 03 SaaS 底座时参考。

## 配置分类

1. 系统默认配置：可提交，保留在代码默认配置。
2. 本地运行配置：不可提交，local.env / mysql-connection.json / 本地配置文件。
3. 商户业务配置：未来进入 DB / MySQL，按 merchant_id / store_id 隔离。
4. 敏感凭证：不可写死，不可提交，未来加密存储，通过 CredentialService 读取。

## 敏感命中分类

- SAFE_FALSE_POSITIVE：变量名、字段名、配置读取、参数传递。
- IGNORED_LOCAL_FILE：被 .gitignore 排除，不会提交。
- REAL_SECRET：真实硬编码密钥、cookie、token、密码、连接串、私钥。
- NEED_USER_CONFIRMATION：无法判断。

## 处理原则

- 首次 Git baseline 阶段不做完整配置中心重构；
- 如果只命中变量名，不应阻止提交；
- 如果发现真实敏感值，必须停止；
- 不输出真实值；
- 配置治理作为 CR-0001 进入 Backlog，建议 Phase 03 执行。

## 关联文档

```text
docs/xiaogou-saas-roadmap/14_CONFIG_GOVERNANCE_配置治理总纲.md
docs/xiaogou-saas-roadmap/backlog/change-requests/CR-0001_配置中心与敏感配置治理.md
docs/xiaogou-saas-roadmap/reference-docs/current-codebase/CONFIG_SOURCE_AUDIT.md
```
