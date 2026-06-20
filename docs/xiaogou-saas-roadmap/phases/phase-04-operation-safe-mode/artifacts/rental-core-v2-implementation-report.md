# Rental Core V2 Implementation Report

日期：2026-06-21

## 范围

本轮在 Phase 04 Operation Safe Mode 内实现租赁核心 V2 主链路入口：

- 查档期：型号、租期、模糊目的地区域、发货门店。
- 地址解析：最低要求区县，城市级输入阻断。
- 档期结果：安全可用、风险可用、需人工确认、无档期。
- 临时锁定：默认 5 分钟，支持延长一次、手动释放、过期释放、转订单。
- 创建订单：从临时锁定转正式订单，写入本地订单、档期 block、物流记录。
- Settings：顺丰、免押、闲鱼/闲管家真实配置入口。
- 业务页状态：查档期、物流、免押、订单页显示真实配置状态。

## Schema

新增 additive migration：

- `scripts/migrations/20260621_0003_create_schedule_holds.sql`
- `scripts/migrations/20260621_0003_create_schedule_holds.rollback.sql`

新增表：

- `schedule_holds`

用途：

- 保存型号、单机、租期、完整物流占用窗口、操作员工、门店、模糊地址解析、顺丰时效结果、到期时间。
- 状态：`active`、`converted`、`expired`、`released`。
- 通过 unit + window + status 索引支持并发冲突检查。

## 外部接口边界

- 顺丰真实下单：默认关闭，未实现自动触发。
- 免押真实创建/完结：默认关闭，未实现自动触发。
- 闲鱼/闲管家真实写同步：默认关闭，未执行 Python，未实现自动触发。
- 顺丰时效查询：允许用户手动触发；失败显示真实错误，不伪装成功。
- 配置保存：当前为本地测试配置；生产环境需迁移到加密凭证存储。

## 脱敏

敏感字段不回显旧值，保存时留空不覆盖旧值：

- token
- secret
- key
- cookie/session
- 月结卡号
- 手机号
- 寄件人
- 地址
- 证件号

顺丰日志 redactor 已覆盖：

- `partnerID`
- `accessToken`
- `rawText` 内 token
- 手机号 / checkNos
- 地址
- 联系人

## 验证

已执行：

- `node scripts/backup_mysql.js`
- `SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --dry-run`
- `SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --apply`
- `SAFEOPS_MIGRATION_APPROVED=local node scripts/run_safeops_migration.js --verify`
- `git diff --check`
- `node --check electron/main/*.js electron/main/safeOps*.js electron/main/ipcHandlers.js electron/preload/preload.js`
- `npm run build:renderer`

Smoke：

- 本地 DB 必要表存在。
- `schedule_holds` ledger applied。
- 地址仅城市输入会阻断。
- Settings 外部配置状态可读取。
- 非敏感顺丰配置可保存。
- 敏感字段空值保存会跳过，不回显明文。
- 免押连接测试当前只做本地校验，不发起真实创建/完结。
- 闲鱼/闲管家状态读取不执行 Python，不调用外部接口。

## 实际外部请求

本轮自测中发起过顺丰真实时效查询，用于验证只读时效能力。

本轮没有创建真实顺丰运单，没有创建或完结真实免押单，没有执行闲鱼/闲管家真实写同步。
