# Phase 03 Codex 开发任务：SaaS 底座：登录、商户、门店、员工、权限、数据隔离

## Codex 本阶段任务

- 设计登录与商户模型
- 增加 merchant_id/store_id
- 设计员工/角色/权限
- 迁移旧数据到默认商户
- 实现登录保护
- 输出备份和回滚方案

## 执行前必须输出

```text
当前阶段目标
本次任务目标
本次不做什么
准备读取哪些文件
准备修改哪些文件
风险点
验证方式
需要用户确认的问题
```

## 执行后必须输出

```text
变更清单
验证方式
验证结果
风险点
下一步建议
是否需要更新阶段状态
```


<!-- CONFIG_GOVERNANCE_PATCH_START -->

# Phase 03 Codex 任务追加片段：配置治理任务

建议追加到 `docs/xiaogou-saas-roadmap/phases/phase-03-saas-base/04_CODEX_TASKS_Codex开发任务.md`。

```md
## 配置治理任务

Codex 需要：

1. 只读扫描配置来源；
2. 填写 CONFIG_SOURCE_AUDIT；
3. 标记配置分类；
4. 标记敏感风险；
5. 判断是否进入 Git；
6. 输出未来存储建议；
7. 规划 ConfigService / CredentialService；
8. 如果涉及数据库，必须先输出迁移和回滚方案；
9. 不输出真实敏感值；
10. 不在未经确认时修改业务代码。
```

<!-- CONFIG_GOVERNANCE_PATCH_END -->
