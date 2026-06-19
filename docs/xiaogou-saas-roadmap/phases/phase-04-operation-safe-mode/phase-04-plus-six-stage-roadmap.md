# Phase 04+ 六阶段快速推进路线图

本文档是 Phase 04 Operation Safe Mode 之后的连续开发总路线图，用于后续 Codex 多轮开发时统一方向、边界和验收节奏。

## 一、当前完成状态

当前 checkpoint：

```text
5c32e03 feat: wire safeops persistence to local db
```

已完成：

- Readonly MVP：完成；
- safeOps migration：完成；
- safeOps persistence DB wiring：完成；
- 本地 MySQL `xianyu_agent` 已恢复；
- safeOps migration 已本地 apply；
- safeOps preview / confirm token / idempotency / audit / rollback placeholder 已可真实入库。

当前 safeOps 能力：

- `preview` 可写入 `operation_audit_logs`；
- `preview` 可生成并写入 confirm token hash；
- `preview` 可生成并写入 idempotency key；
- `preview` 可生成并写入 rollback placeholder；
- `execute` 仍 disabled；
- `rollback` 仍 unavailable；
- 外部 API 禁用；
- 业务表未开放真实写。

当前禁止：

- 不允许直接开放所有 `execute`；
- 不允许跳过 `confirmToken`；
- 不允许跳过 `idempotencyKey`；
- 不允许跳过 `audit log`；
- 不允许未备份直接迁移；
- 不允许外部 API 默认 real；
- 不允许生产 DB 在本地开发 prompt 中被误写；
- 不允许输出敏感数据明文。

## 二、后续六个大阶段

### 阶段 1：首个低风险内部写操作闭环

推荐首选：

- 订单内部备注；
- 订单内部标记更新。

目标：

- 打通 `preview -> confirm token -> idempotency -> audit -> execute -> after snapshot`；
- 只允许本地 DB；
- 不调用外部 API；
- 只开放一个 operationType；
- rollback 暂不执行，只保留 placeholder / before snapshot；
- 验证后服务不要关闭，方便用户从页面查看效果。

阶段 1 不做：

- 不开放所有订单写操作；
- 不做订单状态流转；
- 不写物流、免押、档期、设备高风险字段；
- 不调用顺丰、免押、闲鱼等外部 API。

### 阶段 2：扩展内部写操作

候选范围：

- 设备基础字段更新；
- 档期 block 创建 / 取消；
- 物流发货记录本地创建；
- 订单低风险状态流转。

规则：

- 每个操作必须单独 policy；
- 每个操作必须单独 preview；
- 每个操作必须单独 execute；
- 每个操作必须有 audit；
- 每个操作必须有 idempotency；
- 每个操作必须有 rollback placeholder；
- 仍不开放外部 API。

阶段 2 不做：

- 不做外部真实下单；
- 不做免押真实审核；
- 不做批量 destructive 操作；
- 不做生产 DB migration。

### 阶段 3：外部 API 安全网关

范围：

- 顺丰；
- 免押；
- 闲鱼；
- 其他未来外部写接口。

规则：

- 外部写操作必须默认 disabled；
- 先 mock / sandbox，再 real；
- 必须有二次确认；
- 必须有 external idempotency；
- 必须有 external audit；
- 必须有失败补偿；
- 不允许默认真实调用；
- 外部 token / API key 不得明文输出。

阶段 3 不做：

- 不在无 sandbox 的情况下直接接 real；
- 不默认打开真实下单；
- 不把外部密钥写入仓库；
- 不把外部 response 中的敏感字段原样展示。

### 阶段 4：权限、账号、商户隔离

范围：

- actor identity；
- role-based permission；
- merchant / store isolation；
- 操作权限矩阵；
- 审计按用户追踪；
- 敏感数据权限；
- 操作审批流。

目标：

- 所有 safeOps write 必须能追踪到 actor；
- 所有高风险操作必须能按 role 拦截；
- 所有未来 SaaS 数据必须预留 merchant / store 隔离；
- 审计查询必须具备权限控制。

阶段 4 不做：

- 不提前实现商户协作交易网络；
- 不开放跨商户库存共享；
- 不实现二手交易闭环。

### 阶段 5：生产环境迁移与上线准备

范围：

- staging / production 分离；
- production migration 流程；
- 备份 / 回滚演练；
- 健康检查；
- 日志脱敏；
- 打包发布；
- 错误监控；
- 版本升级策略。

规则：

- production migration 必须单独确认；
- production migration 前必须完成 backup；
- migration 必须可验证；
- 不可回滚 DDL 必须停止；
- 日志不得输出敏感数据明文。

阶段 5 不做：

- 不在本地开发 prompt 中直接操作生产 DB；
- 不无备份执行生产变更；
- 不把测试库验证当作生产验收。

### 阶段 6：产品闭环与商业化完善

范围：

- 商户 onboarding；
- 订单导入 / 同步；
- 设备库存闭环；
- 档期冲突检测；
- 价格 / 押金规则；
- 客户画像；
- 经营报表；
- 移动端操作闭环；
- 多门店 / 多员工；
- 订阅 / 套餐 / 权限。

目标：

- 从内部提效工具推进到可运营的商户 SaaS；
- 补齐订单、设备、档期、物流、免押、报表的产品闭环；
- 为多商户试用版和后续商业化打基础。

阶段 6 不做：

- 不提前进入商户协作网络闭环；
- 不把订阅计费优先级放到核心履约闭环之前；
- 不牺牲审计、安全和数据隔离来换速度。

## 三、快速推进原则

- 尽量按大阶段批量开发，不再拆成过多小任务；
- 每个阶段完成后再统一验证；
- 验证后不要关闭已启动的服务 / dev server / Electron，方便页面持续查看；
- 每个阶段完成后必须 checkpoint commit + push；
- 禁止 `git add .`。

统一推送命令：

```bash
git push ssh://git@ssh.github.com:443/haoyunxiong/dogCamAgentSaaS.git main
git fetch ssh://git@ssh.github.com:443/haoyunxiong/dogCamAgentSaaS.git main
git update-ref refs/remotes/origin/main FETCH_HEAD
```

## 四、硬性安全边界

- 不允许直接开放所有 `execute`；
- 不允许跳过 `confirmToken`；
- 不允许跳过 `idempotencyKey`；
- 不允许跳过 `audit log`；
- 不允许未备份直接迁移；
- 不允许外部 API 默认 real；
- 不允许生产 DB 在本地开发 prompt 中被误写；
- 不允许输出敏感数据明文；
- 不允许验证后 kill 服务。

## 五、阶段验收底线

每个后续阶段至少必须确认：

- 业务写操作是否仍经过 safeOps；
- `confirmToken` 是否生效；
- `idempotencyKey` 是否生效；
- `audit log` 是否完整；
- before / after snapshot 是否记录；
- rollback / compensation 是否有明确边界；
- 外部 API 是否仍默认 disabled 或 sandbox；
- 敏感数据是否脱敏；
- DB migration 是否有 backup / rollback / verification；
- UI 是否没有直接调用底层写 IPC；
- 验证后是否保留用户需要查看的服务运行状态。
