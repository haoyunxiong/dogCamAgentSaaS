# 租赁核心业务流 V2 当前系统差异审计

本文档对照 `rental-core-workflow-v2.md`，审计当前 Electron / Vue / 本地 DB / UI-V2 safeOps 实现与目标业务流之间的差异。本文只做文档审计，不修改业务代码，不新增 migration，不调用外部 API。

## 1. 审计范围

### 1.1 当前阶段边界

- 当前阶段：Phase 04 - Operation Safe Mode。
- 已开放的真实内部写 operationType 仅包括：
  - `order.internal_note.update`
  - `device.basic.update`
  - `schedule.block.create`
  - `schedule.block.cancel`
  - `logistics.local_record.create`
- 顺丰、免押、闲鱼外部能力仅 preview-only，real mode disabled。
- 本轮差异审计不得直接推动真实创单、免押、顺丰或状态机改造。

### 1.2 当前系统参考点

本次审计基于当前代码结构中的核心模块：

| 模块 | 当前参考文件 |
|---|---|
| DB schema | `scripts/mysql_schema.sql` |
| 订单 / 档期 / 设备 / 物流本地逻辑 | `electron/main/dbManager.js` |
| 免押真实 / 缓存逻辑 | `electron/main/depositClient.js`, `electron/main/ipcHandlers.js`, `electron/renderer/src/services/depositApiService.js` |
| UI-V2 真实只读聚合 | `electron/renderer/src/adapters/uiV2/realAdapter.js` |
| UI-V2 safeOps | `electron/renderer/src/adapters/uiV2/safeOpsAdapter.js`, `electron/main/safeOpsPolicy.js`, `electron/main/safeOpsExecute.js`, `electron/main/safeOpsExternalPolicy.js` |
| 订单展示映射 | `electron/renderer/src/adapters/uiV2/mappers/ordersMapper.js` |
| 档期展示映射 | `electron/renderer/src/adapters/uiV2/mappers/scheduleMapper.js` |
| 物流展示映射 | `electron/renderer/src/adapters/uiV2/mappers/logisticsTaskMapper.js` |
| 免押展示映射 | `electron/renderer/src/adapters/uiV2/mappers/depositMapper.js` |
| 报表展示映射 | `electron/renderer/src/adapters/uiV2/mappers/reportsMapper.js` |

## 2. 标签定义

| 标签 | 含义 |
|---|---|
| 已完成 | 当前实现已基本满足 V2 要求 |
| 部分完成 | 当前已有基础能力，但口径、字段、流程或安全边界不完整 |
| 未完成 | 当前没有对应能力 |
| 冲突 | 当前实现与 V2 业务逻辑存在方向性冲突 |
| 需要 schema | 需要新增或调整数据库结构，必须另行做 schema impact / migration / rollback / verification |
| 需要外部接口 | 需要顺丰、地址解析、免押等外部或沙箱能力；真实调用必须经 external gateway |
| 只需 UI 调整 | 主要是页面信息结构、入口、状态展示或交互调整 |

## 3. 逐项审计表

| # | 审计项 | V2 要求 | 当前实现 | 差异标签 | 后续任务 |
|---:|---|---|---|---|---|
| 1 | 模糊地址查档期 | 查询阶段只需型号、租期、模糊区县、发货门店 | 当前可按 modelCode、租期、目的地等做档期查询，但地址不是独立区县解析模型 | 部分完成 / 需要 schema / 需要外部接口 | 建立 `address_parse_result` 或等价结构，查询阶段只保存区县级信息 |
| 2 | 区县解析 | 只到城市不够；镇乡村需解析到所属区县 | 当前没有稳定的省市区县候选、置信度和候选项机制 | 未完成 / 需要外部接口 / 需要 schema | 增加地址解析服务适配层和本地缓存策略 |
| 3 | 顺丰时效 | 查询档期必须计算顺丰时效、置信度和产品建议 | 当前有本地估算和 SF 相关逻辑，但 UI-V2 外部顺丰仅 preview-only | 部分完成 / 需要外部接口 | 保持 real disabled，先补 mock/sandbox 时效预览口径 |
| 4 | 10:00 / 18:00 双时点 | 同时计算上午 10 点和下午 18 点发货可行性 | 当前发货计划有 plannedShipAt / expectedArriveAt，但未形成双时点结果 | 未完成 / 只需 UI 调整 / 需要 schema | 在档期查询结果里展示两个发货时点的时效判断 |
| 5 | 周转缓冲 | 计算回仓、验机、清洁、充电、打包缓冲 | 当前订单创建会生成 shipping / rent / buffer block，buffer 偏粗粒度 | 部分完成 / 需要 schema | 拆分缓冲类型和耗时规则，避免只用固定 buffer 表示全部周转 |
| 6 | 临时锁定 | 有档期后自动锁推荐单机 3-5 分钟，默认 5 分钟 | 当前没有独立临时锁定表和倒计时状态 | 未完成 / 需要 schema | 设计 `schedule_locks` 或等价锁表，接入并发校验和过期释放 |
| 7 | 临时锁定转订单 | 订单从有效 lock 创建并转为正式占用 | 当前 legacy 创单可自动选设备并生成 schedule_blocks，但不经过 lock | 未完成 / 冲突 / 需要 schema | 新增 `order.create` safeOps 时必须校验 lockId |
| 8 | 创建订单四步流程 | 档期设备、客户地址、价格押金、确认创建 | legacy 页面可创单；UI-V2 还没有完整四步向导 | 部分完成 / 只需 UI 调整 / 需要 schema | 先实现 UI 向导和 draft，再接 safeOps 创单 |
| 9 | 客户自动关联 | 手机号强匹配；姓名+区县弱匹配并标记资料不完整 | 当前客户多从订单、询单、免押派生展示，缺少标准客户主数据闭环 | 部分完成 / 需要 schema | 建立 customer 主数据和匹配审计，不在查档期阶段创建客户 |
| 10 | 渠道字段 | 支持闲鱼、小红书、微信私域、抖音、线下、手工录入、其他 | `rental_orders.source_channel/source_name` 已存在，当前仍有 legacy Xianyu 语义 | 部分完成 | 统一渠道枚举和展示文案，把闲鱼降级为 channel |
| 11 | 型号价格规则 | 型号层维护租金、续租、默认押金、免押门槛 | 有 `rental_pricing` 和设备残值字段，但型号管理不完整 | 部分完成 / 需要 schema / 只需 UI 调整 | 建立型号价格规则 Drawer 和规则版本 |
| 12 | 型号残值 | 默认押金 / 免押金额来自型号残值，可审批调整 | 当前单机有 purchase_cost / residual_value，CreateDepositDrawer 会读设备价值 | 部分完成 / 需要 schema | 从单机残值过渡为型号残值 + 单机覆盖策略 |
| 13 | 免押创建 | 可从订单创建或免押管理手动创建，带入订单核心信息 | legacy 免押可创建并本地缓存；UI-V2 safeOps 仅 preview-only | 部分完成 / 需要外部接口 | UI-V2 保持 preview-only，先补订单带入和脱敏 payload 口径 |
| 14 | 免押关联订单 | 未关联免押单可按手机号、型号、租期、金额、时间推荐订单 | 当前 deposit_orders 通过 source_order_id/source_order_no 弱关联，缺少候选匹配 UI | 部分完成 / 需要 schema / 只需 UI 调整 | 建立关联 Drawer、候选评分和人工确认记录 |
| 15 | 发出物流 | 从订单或物流管理创建，带入客户、设备、门店、默认寄件人 | legacy updateShipping 能反写订单；UI-V2 local_record 只写 shipping_records | 部分完成 / 冲突 | 统一“本地记录”和“订单发货”的语义，设计发出物流状态反写规则 |
| 16 | 归还物流 | 独立于发出物流，支持单号、无单号、线下、手动归还 | 当前有 returning / return_shipping block 等能力片段，但没有完整归还物流模型 | 部分完成 / 需要 schema / 只需 UI 调整 | 拆分 outboundShipment / returnShipment，并补归还 Drawer |
| 17 | 验机 | 归还后进入验机，结果影响设备、订单、客户风险、免押、档期 | 当前没有标准验机记录和状态机 | 未完成 / 需要 schema | 新增 inspection 领域设计，先做 UI 和状态口径 |
| 18 | 状态机 | 拆主业务、免押、发出物流、归还物流、验机、支付状态 | 当前 `order_status` 承担过多语义，UI mapper 用字段推导 deposit/shipping | 冲突 / 需要 schema | 设计多维状态字段或状态视图，不能只扩展单一 order_status |
| 19 | 下一步动作引擎 | 每一步完成后给出下一步动作提示 | 当前 dashboard / mapper 有部分任务和风险提示，但不是标准规则引擎 | 部分完成 / 只需 UI 调整 | 建立 action recommendation mapper，先前端派生，后续入库审计 |
| 20 | 多账号权限预埋 | actorId、role、merchantId、storeId、approvedBy | Phase 04 safeOps 已携带本地 actor / role / merchant / store context | 部分完成 | 扩展到订单、锁定、审批和外部 gateway |
| 21 | 价格快照 | 订单保存价格规则版本和人工调整原因 | 当前订单存 fee/deposit，缺少完整 price snapshot | 未完成 / 需要 schema | 新增 order_price_snapshots 或 JSON snapshot 字段，需 migration 方案 |
| 22 | 人工覆盖原因 | 改价、改押金、忽略冲突、手动归还等必须记录原因 | safeOps 有 audit 基础，但 legacy direct write 不统一 | 部分完成 / 冲突 | 所有高风险写入收敛到 safeOps，并强制 reason |
| 23 | 自取 / 自还 | 不走快递也必须记录出库、归还、验机 | 当前 shipping_mode 支持表达部分场景，但流程不完整 | 部分完成 / 只需 UI 调整 / 需要 schema | 在物流 Drawer 增加自取自还路径和必填确认项 |
| 24 | 跨门店调拨 | 影响库存、时效、成本和审批 | 当前 store 关系存在，但没有调拨流程 | 未完成 / 需要 schema | 仅规划，不在当前 Phase 04 直接实现 |
| 25 | 节假日 / 时效不确定性 | 时效低置信度进入风险可用或人工确认 | 当前缺少节假日和时效置信度对象 | 未完成 / 需要外部接口 | 先做 mock/sandbox 风险字段，真实接口后置 |
| 26 | 报表口径 | 从对齐后的订单、设备、档期、免押、物流聚合 | 当前 Reports 混用订单字段和 deposit cache fallback | 部分完成 / 冲突 | 等状态口径统一后重算报表指标 |

## 4. 当前主要错位点

### 4.1 免押状态和订单状态口径错位

当前订单列表里的免押状态主要由订单字段推导，例如 `is_deposit_free` 和 `deposit`。但 V2 要求免押状态以免押单维度为准，并与订单主状态分离。

影响：

- 订单页可能显示“免押通过”，但免押缓存或外部状态并未一致；
- 免押管理中有单，订单页可能仍显示押金待处理；
- 报表可能把押金和免押混算。

建议：

1. 先在 UI 层区分“订单押金字段状态”和“免押单状态”。
2. 再设计强关联字段和 latest 免押单规则。
3. 最后由 safeOps 接管免押创建、关联和完结。

### 4.2 发出物流有两套写入语义

legacy `updateShipping` 能更新订单寄件字段、shipping_records 和档期；UI-V2 `logistics.local_record.create` 只插入 `shipping_records`，不会反写订单状态和档期。

影响：

- 物流管理里有寄件记录，但查单页可能不同步；
- 报表可能无法判断订单真实发货状态；
- 员工会误以为“创建物流记录”就是“订单已发货”。

建议：

1. 明确 `logistics.local_record.create` 只是本地记录，不代表发货状态完成。
2. 后续新增 `shipment.outbound.confirm` 或 `order.shipment.create` safeOps。
3. 该操作再统一更新订单发出物流状态、物流记录和必要档期。

### 4.3 档期占用缺少临时锁定层

当前正式订单可以生成 `schedule_blocks`，但查档期后的 3-5 分钟承诺窗口没有独立锁定。

影响：

- 多客服可能同时把同一台设备承诺给不同客户；
- 查档期结果和创单之间存在竞争；
- 复用最近查询结果创建订单时缺少有效期和并发保护。

建议：

1. 先设计锁定表和过期策略。
2. 再做锁定 UI 倒计时。
3. 最后把创单入口改为优先从 lock 转订单。

### 4.4 设备状态展示与业务占用混杂

当前设备原始状态和档期推导状态共同影响展示。维修、下架是原始状态；忙闲是从 block 和订单推导。

影响：

- 设备管理、档期中心和订单详情可能使用不同口径；
- 未来预约、临时锁定、归还运输中、待验机等状态无法清晰表达；
- 型号余量可能和单机排期不一致。

建议：

1. 区分 `rawStatus`、`effectiveStatus`、`availabilityStatus`。
2. 型号余量只来自统一 availability service。
3. 单机详情显示当前订单、当前锁定、下一预约和维修记录。

### 4.5 单一 `order_status` 承担过多语义

当前订单状态字段承载订单生命周期、物流、归还、完成等多个含义。V2 要求主业务状态、免押、发出物流、归还物流、验机、支付状态拆分。

影响：

- 下一步动作难以准确生成；
- 报表无法区分“已发货但免押未完结”与“已完成”；
- 订单取消、续租、归还异常会挤压同一个状态字段。

建议：

1. 先在 UI mapper 里建立多维派生状态，不立刻改 schema。
2. 后续以 additive migration 拆分状态字段或状态事件表。
3. 所有状态转换必须进入 safeOps。

## 5. 后续可实现任务拆解

### 任务 0：文档真源接入

目标：让后续会话先读 V2 业务流。

交付：

- 在阶段会话 Prompt 或 README 中引用 `product-logic/rental-core-workflow-v2.md`。
- 后续涉及订单、档期、设备、免押、物流、报表的任务必须先对照该文档。

风险：低，不改代码。

### 任务 1：地址解析与查询档期口径

目标：查询阶段只采集型号、租期、区县、发货门店。

交付：

- 地址解析 adapter 设计；
- 区县候选和置信度 UI；
- 查档期请求结构；
- 不保存完整 PII 的日志规则。

依赖：可能需要 schema 和外部接口；真实外部解析默认关闭。

### 任务 2：顺丰时效与周转计算服务

目标：统一计算 10:00 / 18:00 发货、最晚发货、返程物流、验机清洁充电打包缓冲。

交付：

- 本地 mock/sandbox 计算器；
- 完整物流占用窗口；
- 安全可用 / 风险可用 / 需人工确认 / 无档期分类；
- 节假日和时效不确定性风险字段。

依赖：可先纯本地规则，后续接 external gateway。

### 任务 3：临时锁定模型

目标：防止查档期到创单之间的并发冲突。

交付：

- schema impact；
- migration plan；
- backup plan；
- rollback plan；
- verification plan；
- 锁定创建、延长、释放、过期、转订单 safeOps 设计。

依赖：需要 additive schema，必须单独确认。

### 任务 4：创建订单四步向导

目标：把创单从 legacy 表单升级为标准四步流程。

交付：

- 档期与设备；
- 客户与地址；
- 价格与押金；
- 确认创建；
- 价格快照；
- 手动调整原因；
- 重复提交幂等。

依赖：需要 order.create safeOps，不直接调用旧 IPC。

### 任务 5：客户自动关联

目标：手机号强匹配，姓名 + 区县弱匹配。

交付：

- customer 主数据设计；
- 资料不完整标记；
- 匹配候选 UI；
- 合并风险提示。

依赖：需要 schema。

### 任务 6：价格规则与残值管理

目标：型号层承载价格、续租、残值、默认押金和免押门槛。

交付：

- 型号价格 / 残值 Drawer；
- 规则版本；
- 审批动作；
- 订单价格快照。

依赖：需要 schema；残值修改必须审批。

### 任务 7：免押订单关联

目标：免押单与订单强关联，并支持候选匹配。

交付：

- 免押创建 Drawer；
- 免押关联订单 Drawer；
- 候选评分；
- 完结免押确认；
- 订单详情免押卡片。

依赖：外部 real disabled，先做 preview-only 和本地缓存口径。

### 任务 8：发出物流和归还物流拆分

目标：解决寄件记录和订单状态不同步的问题。

交付：

- 发出物流 Drawer；
- 归还物流 Drawer；
- 物流关联订单 Drawer；
- 顺丰预览 Drawer；
- 自取 / 自还路径；
- 订单详情双物流卡片。

依赖：真实顺丰下单必须单独确认。

### 任务 9：归还验机

目标：归还后通过验机决定订单、设备、免押和档期。

交付：

- 归还验收 Modal；
- 验机结果；
- 设备状态联动；
- 免押可完结判断；
- 后续档期释放或阻断。

依赖：需要 schema 和状态机设计。

### 任务 10：多维状态和下一步动作引擎

目标：拆分订单状态并给员工明确下一步动作。

交付：

- 主业务状态；
- 押金 / 免押状态；
- 发出物流状态；
- 归还物流状态；
- 验机状态；
- 支付状态；
- action recommendation mapper。

依赖：可先 UI 派生，后续 schema 事件化。

### 任务 11：报表口径重算

目标：报表只从统一业务口径汇总。

交付：

- 设备利用率按完整占用窗口；
- 押金 / 免押分开；
- 发出物流和归还物流分开；
- 异常和赔付单独统计；
- 渠道只作为来源维度。

依赖：需等状态口径和主对象关联稳定后再做。

## 6. 建议实现顺序

推荐顺序：

1. 文档真源接入；
2. UI 层多维状态和下一步动作派生；
3. 查档期输入和结果 UI 调整；
4. 临时锁定 schema 方案和 safeOps 方案；
5. 创建订单四步向导设计和只读 / mock 流程；
6. 价格快照和型号残值方案；
7. 免押关联订单 UI；
8. 发出物流 / 归还物流 UI 拆分；
9. 归还验机方案；
10. 真实写操作逐项 gated 开放；
11. 报表口径重算。

## 7. 本轮结论

- 当前系统已经有订单、设备、档期、物流、免押缓存、报表聚合的基础对象。
- 当前最大问题不是完全缺对象，而是关联口径不统一。
- 创单、免押、寄件、验机、报表必须围绕订单聚合根和多维状态重排。
- 临时锁定、价格快照、验机、多维状态、强关联免押都需要后续 schema 方案。
- 真实顺丰和真实免押必须继续受 external gateway 控制，不能默认开启。
