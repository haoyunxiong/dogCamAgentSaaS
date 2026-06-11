# Phase 03 需求文档追加片段：配置中心与敏感配置治理

建议追加到 `docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/02_REQUIREMENTS_需求文档.md`。

```md
## 配置中心与敏感配置治理

Phase 03 需要纳入配置治理，因为多商户 SaaS 需要明确配置归属和隔离方式。

需求：

1. 审计当前配置来源；
2. 区分系统默认配置、本地运行配置、商户业务配置、敏感凭证；
3. 判断哪些配置未来进入 MySQL；
4. 判断哪些配置必须本地存储并 Git 忽略；
5. 判断哪些敏感凭证需要加密存储；
6. 输出 CONFIG_SOURCE_AUDIT；
7. 规划 ConfigService / CredentialService；
8. 不破坏现有功能。
```
