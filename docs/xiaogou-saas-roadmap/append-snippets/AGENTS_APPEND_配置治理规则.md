# AGENTS.md 追加片段：配置治理与敏感配置规则

建议追加到根目录 `AGENTS.md` 的 Hard Restrictions / New Feature Handling / Security 附近。

```md
## Configuration Governance and Secret Handling

Configuration must not be scattered as hardcoded values across JS / Python files.

Classify configuration into four groups:

1. System default configuration
   - Safe to commit.
   - Examples: default status enums, default page size, default UI behavior.

2. Local runtime configuration
   - Must not be committed.
   - Examples: local database host, local port, local debug flags.
   - Store in local env files or local JSON files that are ignored by Git.

3. Merchant business configuration
   - Should eventually live in DB / MySQL.
   - Must support merchant_id / store_id isolation.
   - Examples: merchant settings, store settings, shipping settings, deposit rules, pricing rules, notification templates, staff permissions.

4. Sensitive credentials
   - Must never be hardcoded in JS / Python.
   - Must not be committed.
   - Examples: API keys, cookies, tokens, database passwords, third-party credentials.
   - Future direction: CredentialService with encrypted storage.

When sensitive scan matches token/password/cookie terms, do not assume all matches are real secrets.
Classify each hit as:

- SAFE_FALSE_POSITIVE: variable name, field name, config reading, parameter passing.
- IGNORED_LOCAL_FILE: file is ignored by Git and will not be committed.
- REAL_SECRET: real hardcoded secret value.
- NEED_USER_CONFIRMATION: uncertain.

If REAL_SECRET or NEED_USER_CONFIRMATION exists, stop before commit / push.
Do not print raw secret values in reports.

Configuration governance is tracked as:

```text
docs/xiaogou-saas-roadmap/backlog/change-requests/CR-0001_配置中心与敏感配置治理.md
docs/xiaogou-saas-roadmap/14_CONFIG_GOVERNANCE_配置治理总纲.md
docs/xiaogou-saas-roadmap/reference-docs/current-codebase/CONFIG_SOURCE_AUDIT.md
```

Do not perform full configuration refactor during initial Git baseline.
Record it as a Phase 03 SaaS base task unless explicitly approved.
```
