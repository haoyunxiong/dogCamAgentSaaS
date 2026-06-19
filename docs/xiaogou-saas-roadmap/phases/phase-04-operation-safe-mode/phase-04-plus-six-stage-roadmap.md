# Phase 04+ 六阶段快速推进路线图

本文档是 Phase 04 Operation Safe Mode 之后的连续开发总路线图，用于后续 Codex 多轮开发时统一方向、边界和验收节奏。

## 一、当前完成状态

阶段 2 收口 checkpoint：

```text
24476ec feat: enable safeops logistics local record create
```

已完成：

- Readonly MVP：完成；
- safeOps migration：完成；
- safeOps persistence DB wiring：完成；
- 本地 MySQL `xianyu_agent` 已恢复；
- safeOps migration 已本地 apply；
- safeOps preview / confirm token / idempotency / audit / rollback placeholder 已可真实入库。
- 阶段 1B `order.internal_note.update` 已开放为首个真实内部写 operation；
- 阶段 2A `device.basic.update` 已开放为第二个真实内部写 operation。
- 阶段 2B `schedule.block.create` / `schedule.block.cancel` 已开放为档期 block 创建 / 取消内部写 operation。
- 阶段 2C `logistics.local_record.create` 已开放为物流本地发货记录创建内部写 operation。
- 阶段 2 内部写操作统一收口已完成，当前共有 5 个 gated internal write operationTypes。
- 阶段 3A external gateway skeleton 已完成，真实外部调用仍默认 disabled。
- 阶段 3B `logistics.sf.create_order` 顺丰 mock/sandbox preview-only 网关已完成，真实顺丰调用仍 disabled。
- 阶段 3C `deposit.create` / `deposit.finish` 免押 mock/sandbox preview-only 网关已完成，真实免押调用仍 disabled。
- 阶段 3D `xianyu.order.sync` 闲鱼 mock/sandbox preview-only 网关已完成，真实闲鱼同步仍 disabled。

当前 safeOps 能力：

- `preview` 可写入 `operation_audit_logs`；
- `preview` 可生成并写入 confirm token hash；
- `preview` 可生成并写入 idempotency key；
- `preview` 可生成并写入 rollback placeholder；
- `execute` 仅对 `order.internal_note.update`、`device.basic.update`、`schedule.block.create`、`schedule.block.cancel`、`logistics.local_record.create` gated enabled；
- `rollback` 仍 unavailable；
- 外部 API real mode 禁用；
- external gateway 当前提供 disabled policy / preview / blocked execute；`logistics.sf.create_order`、`deposit.create`、`deposit.finish`、`xianyu.order.sync` 额外支持 mock / sandbox payload preview；
- 业务表真实写仅限 `rental_orders.internal_note`、`schedule_units` 低风险基础字段、单条 `schedule_blocks` 创建 / 软取消、单条本地 `shipping_records` 创建。

阶段 2 收口结论：

- 5 个 gated internal write operationTypes 已统一验收：`order.internal_note.update`、`device.basic.update`、`schedule.block.create`、`schedule.block.cancel`、`logistics.local_record.create`；
- 其它 operationType execute 仍必须返回 `SAFE_OP_EXECUTE_DISABLED`；
- rollback executor 仍 unavailable，仅保留 `not_executable` placeholder；
- 外部 API 仍全部 disabled，顺丰、免押、闲鱼、Python 和其它外部写服务未开放；
- 顺丰 `logistics.sf.create_order` 仅完成 mock / sandbox 结构化预览，不发送外部请求，不写业务表；
- 免押 `deposit.create` / `deposit.finish` 仅完成 mock / sandbox 结构化预览，不发送外部请求，不要求 `deposit_orders`，不写业务表；
- 闲鱼 `xianyu.order.sync` 仅完成 mock / sandbox 结构化预览，不发送外部请求，不写 `rental_orders`，不更新订单状态；
- 页面服务验证后保持运行，方便继续从 UI 查看效果。

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

阶段 1A：受控 additive schema

- 为 `rental_orders` 新增 `internal_note TEXT NULL`；
- 字段仅用于商家内部备注 / 内部标记；
- 不同步外部平台；
- 不触发顺丰、免押、闲鱼或其它外部 API；
- 不改变订单状态、金额、客户、地址、租期、设备、档期或物流字段；
- 不开放 `safeOps.execute`。

阶段 1B：单一低风险写操作（已完成）

- 只开放 `order.internal_note.update`；
- 写入目标仅限 `rental_orders.internal_note`；
- 必须经过 `preview -> confirm token -> idempotency -> audit -> execute -> after snapshot`；
- 只允许本地 DB；
- rollback 暂不执行，只保留 placeholder / before snapshot。
- 其它 operationType execute 继续返回 `SAFE_OP_EXECUTE_DISABLED`。
- 顺丰、免押、闲鱼、Python、外部 API 仍禁用。

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

- 设备基础字段更新；（阶段 2A 已完成：`device.basic.update`）
- 档期 block 创建 / 取消；（阶段 2B 已完成：`schedule.block.create` / `schedule.block.cancel`）
- 物流发货记录本地创建；（阶段 2C 已完成：`logistics.local_record.create`）
- 订单低风险状态流转。

规则：

- 每个操作必须单独 policy；
- 每个操作必须单独 preview；
- 每个操作必须单独 execute；
- 每个操作必须有 audit；
- 每个操作必须有 idempotency；
- 每个操作必须有 rollback placeholder；
- 仍不开放外部 API。

阶段 2A 已完成边界：

- `device.basic.update` 只允许更新 `schedule_units.city`、`schedule_units.note`、受限 `schedule_units.status`；
- 禁止 `model_code`、`unit_code`、`serial_no`、`purchase_cost`、`residual_value`；
- status 变更必须检查 active/current-future schedule block 与未完成订单；
- 删除设备、批量更新、库存重算仍禁用；
- rollback 仍只写 placeholder，不开放 executor。

阶段 2B 已完成边界：

- `schedule.block.create` 只允许插入一条本地 `schedule_blocks` 记录；
- `schedule.block.cancel` 只允许将一条本地 `schedule_blocks` 软取消为 `cancelled`；
- create 必须校验 `unit_id`、`model_code`、日期区间、block type、初始 status；
- create 必须重新检查同 `unit_id` 日期区间 active/current block 冲突；
- cancel 必须校验目标 block 存在且未取消 / 未停用；
- 禁止批量锁库、物理删除、订单 / 设备 / 物流 / 免押联动；
- Python、顺丰、免押、闲鱼、外部 API 仍禁用；
- rollback 仍只写 placeholder，不开放 executor。

阶段 2C 已完成边界：

- `logistics.local_record.create` 只允许插入一条本地 `shipping_records` 记录；
- 必须只读校验目标订单存在；
- 必须检查相同 `order_id + carrier + tracking_no` 重复记录；
- 禁止顺丰真实下单、预下单、取消、查询；
- 禁止修改订单状态、档期、设备、免押表；
- Python、顺丰、免押、闲鱼、外部 API 仍禁用；
- rollback 仍只写 placeholder，不开放 executor。

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

阶段 3A 已完成边界：

- 新增 external gateway skeleton；
- provider：`sf_express`、`deposit_service`、`xianyu_platform`；
- mode：`disabled`、`mock`、`sandbox`、`real`；
- 默认 mode：`disabled`；
- external operationType：`logistics.sf.create_order`、`logistics.sf.cancel_order`、`deposit.create`、`deposit.finish`、`xianyu.order.sync`；
- `realEnabled=false`；
- `externalWritesEnabled=false`；
- external execute 返回 disabled / blocked；
- UI 只显示“外部真实调用未开放 / gateway disabled”。

阶段 3B 已完成边界：

- `logistics.sf.create_order` 支持 `mode=disabled|mock|sandbox|real` preview；
- 默认 `mode=disabled`；
- `mode=mock` 只生成 mock waybill preview；
- `mode=sandbox` 只生成 sandbox payload preview；
- `mode=real` 仍返回 disabled / blocked；
- `execute` 仍返回 `SAFE_OP_EXTERNAL_DISABLED`；
- preview 可写 audit / confirm token hash / idempotency / rollback placeholder；
- `externalCallWillExecute=false`、`writeWillExecute=false` 始终成立；
- 不调用 HTTP、顺丰 SDK、Python 或外部服务；
- 不写 `shipping_records`，不改订单状态、设备、档期或免押；
- Logistics 页面明确展示“不真实下单 / mock-sandbox only / 外部真实调用未开放”。

阶段 3C 已完成边界：

- `deposit.create` / `deposit.finish` 支持 `mode=disabled|mock|sandbox|real` preview；
- 默认 `mode=disabled`；
- `mode=mock` 只生成 mock deposit preview；
- `mode=sandbox` 只生成 sandbox payload preview；
- `mode=real` 仍返回 disabled / blocked；
- `execute` 仍返回 `SAFE_OP_EXTERNAL_DISABLED`；
- preview 可写 audit / confirm token hash / idempotency / rollback placeholder；
- `externalCallWillExecute=false`、`writeWillExecute=false` 始终成立；
- 不调用 HTTP、免押 SDK、Python 或外部服务；
- 不新增 `deposit_orders`，不写 `rental_orders`，不改订单状态、设备、档期、物流或免押状态；
- Deposit 页面明确展示“不真实创建免押 / 不真实完结免押 / mock-sandbox only / 外部真实调用未开放”。

阶段 3D 已完成边界：

- `xianyu.order.sync` 支持 `mode=disabled|mock|sandbox|real` preview；
- 默认 `mode=disabled`；
- `mode=mock` 只生成 mock sync preview；
- `mode=sandbox` 只生成 sandbox payload preview；
- `mode=real` 仍返回 disabled / blocked；
- `execute` 仍返回 `SAFE_OP_EXTERNAL_DISABLED`；
- preview 可写 audit / confirm token hash / idempotency / rollback placeholder；
- `externalCallWillExecute=false`、`writeWillExecute=false` 始终成立；
- 不调用 HTTP、闲鱼 SDK、Python 或外部服务；
- 不写 `rental_orders`，不改订单状态、设备、档期、物流或免押状态；
- Orders 页面明确展示“闲鱼同步预览 / 不真实同步 / mock-sandbox only / 外部真实调用未开放”；
- 不显示手机号、地址、姓名、商品标题、cookie、session、token、API key 明文。

规则：

- 外部写操作必须默认 disabled；
- 阶段 3 是外部 API 安全网关，不是直接开放真实外部调用；
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
