# 多会话手册追加片段：配置审计与配置治理会话

建议追加到 `docs/xiaogou-saas-roadmap/11_CODEX_MULTI_SESSION_GUIDE_多会话创建使用与提问手册.md`。

```md
## 新增可选会话：配置审计与配置治理

会话名称：

```text
小狗相机助手 - 配置审计与配置治理
```

职责：

- 审计配置来源；
- 区分系统默认配置、本地运行配置、商户业务配置、敏感凭证；
- 复核敏感扫描命中；
- 判断配置未来应存储在代码、本地文件、MySQL 还是加密凭证库；
- 输出 CONFIG_SOURCE_AUDIT；
- 生成 ConfigService / CredentialService 改造计划。

不做：

- 不做 UI 美化；
- 不操作 Figma；
- 不直接改业务代码；
- 不执行数据库迁移；
- 不决定是否进入下一阶段。

初始化 Prompt：

```text
docs/xiaogou-saas-roadmap/prompts-for-sessions/05_配置审计与配置治理会话初始化Prompt.md
```

适合执行阶段：

```text
Phase 03 - SaaS 底座
```

在首次 Git baseline 阶段，只用于敏感命中复核，不做配置中心重构。
```
