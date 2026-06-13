# Phase 02A Artifact：Product Design Input

执行日期：2026-06-12

## 1. Artifact 用途

本文件是 Phase 02A 的可交付摘要，用于交给 Phase 02B Figma Design System 会话读取。

本文件不是 UI 稿，不是前端实现方案，不代表已经操作 Figma、修改代码或迁移数据库。

## 2. Phase 02A 结论

小狗相机助手商户版的设计系统应服务于“租赁商户运营标准化系统”，而不是旧的闲鱼助手。

核心体验分工：

| 端 | 定位 | 重点 |
|---|---|---|
| 手机端 | 移动运营工作台 | 今日待办、快速查档期、订单处理、发货确认、归还提醒、设备快查 |
| PC 端 | 完整管理后台 | 批量订单、档期矩阵、设备资产、询单转订单、财务报表、设置 |

设计风格关键词：

```text
专业、可信、克制、清爽、高效、数据化、SaaS 感
```

## 3. 手机端核心页面输入

### 3.1 页面范围

1. 登录页
2. 工作台
3. 订单中心
4. 订单详情 / 订单处理页
5. 档期中心 / 档期查询
6. 设备中心 / 设备快查
7. 我的 / 商家中心

### 3.2 手机端页面任务摘要

| 页面 | 用户 | 第一眼要解决的问题 | 核心操作 |
|---|---|---|---|
| 登录页 | 全部角色 | 是否进入正确的商户版系统，能否登录 | 输入账号、登录、查看错误 |
| 工作台 | 店长、运营、发货员、老板 | 今天最该处理什么，有无异常 / 逾期 | 进入待办、查档期、发货确认、归还提醒、免押审核 |
| 订单中心 | 运营、店长、发货员 | 哪些订单需要处理，分别是什么状态 | 搜索、筛选、进入详情、快速处理 |
| 订单详情 / 订单处理页 | 运营、店长、发货员、财务 | 当前订单下一步动作和风险是什么 | 发货、物流、归还、验机、完结、异常标记 |
| 档期中心 / 档期查询 | 运营、店长 | 目标设备和日期是否可租 | 选日期、选型号、查可租、查看冲突 |
| 设备中心 / 设备快查 | 发货员、店长、运营 | 设备现在在哪里，能不能租 | 搜索 / 扫码预留、看状态、进设备详情 |
| 我的 / 商家中心 | 全部角色 | 当前身份和个人入口在哪里 | 查看账号、帮助、退出、基础设置入口 |

### 3.3 手机端首屏优先级

| 页面 | 首屏优先级 |
|---|---|
| 登录页 | 产品标识、登录表单、主登录按钮、错误提示位置 |
| 工作台 | 今日待办、异常提醒、快捷入口、关键数量 |
| 订单中心 | 状态筛选、搜索、待处理订单卡片 |
| 订单详情 / 订单处理页 | 订单状态、风险提示、客户设备租期、下一步动作 |
| 档期中心 / 档期查询 | 日期选择、型号选择、可租结果、冲突提醒 |
| 设备中心 / 设备快查 | 搜索 / 扫码入口、设备状态、当前位置、当前 / 下一订单 |
| 我的 / 商家中心 | 用户、角色、商户 / 门店、常用个人入口 |

## 4. PC 端核心页面输入

### 4.1 页面范围

1. 工作台
2. 询单中心
3. 订单中心
4. 订单详情
5. 档期中心
6. 设备中心
7. 客户中心
8. 免押管理
9. 物流发货
10. 财务结算
11. 报表中心
12. 设置中心

Phase 02C 高保真原型优先做：

```text
工作台、订单中心、档期中心、设备中心、设置中心
```

### 4.2 PC 端页面任务摘要

| 页面 | 用户 | 第一眼要解决的问题 | 核心操作 |
|---|---|---|---|
| 工作台 | 老板、店长 | 今日经营是否正常，哪里有风险 | 进入待办、查看异常、跳转核心模块 |
| 询单中心 | 运营、店长 | 哪些询单需要回复，能否转订单 | 查档期、报价、转订单、标记无效 |
| 订单中心 | 运营、店长、发货员、财务 | 哪些订单紧急，如何批量处理 | 创建、筛选、批量处理、进详情 |
| 订单详情 | 运营、店长、发货员、财务 | 订单状态、风险、资金、履约是否清楚 | 免押、发货、物流、归还、验机、完结 |
| 档期中心 | 运营、店长 | 设备日期是否可租，有无冲突 | 查可租、看占用、进订单、复制档期 |
| 设备中心 | 店长、发货员、老板 | 设备资产状态是否清楚 | 筛选、查设备、进详情、维护状态预留 |
| 客户中心 | 运营、店长 | 客户历史和风险是否清楚 | 搜索客户、看订单历史、看备注 |
| 免押管理 | 运营、财务、店长 | 哪些免押 / 押金影响发货 | 审核 / 标记、进订单、看记录 |
| 物流发货 | 发货员、运营、店长 | 哪些要发货，哪些物流异常 | 确认发货、查运单、标记异常 |
| 财务结算 | 财务、老板 | 租金、押金、退款是否清楚 | 核对金额、筛选、查看明细、导出预留 |
| 报表中心 | 老板、店长、财务 | 经营趋势和设备效率是否清楚 | 切换时间、筛选指标、查看明细 |
| 设置中心 | 老板、店长 | 设置入口在哪里，哪些可配置 | 进入基础设置、渠道配置、商户 / 员工预留 |

## 5. 默认展示与隐藏规则

### 5.1 默认展示

默认展示应优先包含：

1. 状态。
2. 下一步动作。
3. 截止时间 / 租期。
4. 客户与设备摘要。
5. 异常、逾期、待处理标签。
6. 负责人。
7. 渠道来源。
8. 金额摘要。

### 5.2 不默认展示

不进入列表首屏的信息：

1. 完整操作日志。
2. 完整沟通记录。
3. 完整财务流水。
4. 底层渠道技术字段。
5. cookies、token、CredentialService、ConfigService。
6. 完整权限配置。
7. 商户协作、调货、代发、二手市场、平台结算、担保交易、分润规则。

## 6. 详情页 / Drawer / Bottom Sheet 规则

| 内容 | 手机端 | PC 端 |
|---|---|---|
| 高频筛选 | Bottom Sheet | 筛选栏 / Drawer |
| 轻量确认 | Bottom Sheet | Modal |
| 订单完整信息 | 详情页 | 详情页 / Drawer |
| 订单子记录 | 折叠区 | Drawer / Tabs |
| 设备详情 | 详情页 | Drawer |
| 发货 / 归还 / 验机 | Bottom Sheet | Drawer / Modal |
| 设置编辑 | 仅入口或详情页 | 设置页 / Drawer |
| 批量操作 | 不作为重点 | 表格批量操作栏 |

## 7. 页面状态矩阵

所有核心页面都必须考虑以下状态：

1. 默认
2. 空状态
3. 加载
4. 错误
5. 权限不足
6. 异常
7. 逾期
8. 待处理

其中：

1. 登录页不需要空状态、逾期、待处理。
2. 我的 / 商家中心不需要逾期、待处理。
3. 报表中心通常不需要逾期、待处理，但需要异常和空状态。
4. 订单、档期、设备、免押、物流、财务必须重点处理异常、逾期、待处理。

## 8. Phase 02B 必须设计的组件

### 8.1 基础组件

1. Button
2. IconButton
3. FormInput
4. SearchBar
5. Select
6. DatePicker / DateRangePicker
7. Tabs
8. SegmentedControl
9. FilterChip
10. Checkbox
11. Drawer
12. BottomSheet
13. Modal
14. Toast
15. AlertRow
16. EmptyState
17. Skeleton

### 8.2 导航与布局组件

1. Mobile BottomNav
2. PC SideNav
3. PageHeader
4. MobilePageHeader
5. QuickActionGrid

### 8.3 业务组件

1. StatusBadge
2. MetricCard
3. TaskCard
4. OrderCard
5. OrderTable
6. OrderTimeline
7. ScheduleBlock
8. ScheduleGrid
9. DeviceCard
10. DeviceTable
11. CustomerSummary
12. DepositStatusPanel
13. ShipmentStatusPanel
14. FinanceSummary

## 9. Phase 02B 组件验收重点

Phase 02B Figma Design System 至少要验证：

1. `OrderCard` 是否能在手机端清楚表达客户、设备、租期、状态、下一步动作。
2. `OrderTable` 是否能在 PC 端承载状态、免押、物流、金额、负责人、渠道。
3. `ScheduleBlock` 是否能表达可租、已占用、冲突、缓冲、逾期影响。
4. `DeviceCard / DeviceTable` 是否能表达设备编号、型号、状态、位置、当前 / 下一订单。
5. `StatusBadge` 是否覆盖订单、设备、免押、物流、财务状态。
6. `AlertRow` 是否能清楚表达异常、逾期、待处理。
7. `BottomSheet` 是否适合手机端筛选、确认、发货、归还、验机。
8. `Drawer` 是否适合 PC 端详情、筛选、编辑。

## 10. 参考产品方向

可参考：

1. Shopify Admin：订单、客户、商品、设置的信息架构。
2. Stripe Dashboard：资金、状态、风险和高可信后台体验。
3. Linear：高密度列表、状态筛选、快捷操作。
4. Notion：克制、清爽、低干扰的视觉系统。
5. 飞书 / Lark 管理后台：国内 B 端后台的信息组织。

避免：

1. 重渐变。
2. 玻璃拟态。
3. 霓虹色。
4. 过度卡通化。
5. 营销页式 Hero。
6. 一次性设计未来协作网络。

## 11. 不进入 Phase 02B 的内容

1. 不设计商户协作。
2. 不设计调货大厅。
3. 不设计代发中心。
4. 不设计二手设备市场。
5. 不设计商户信用。
6. 不设计平台结算。
7. 不设计担保交易。
8. 不设计分润规则。
9. 不设计 ConfigService / CredentialService。
10. 不设计真实权限系统和数据库结构。

## 12. 可交给 Phase 02B 的执行提示词

```text
你现在执行“小狗相机助手商户版 Phase 02B：Figma Design System / 设计系统基础组件”。

请先读取：
1. AGENTS.md
2. docs/xiaogou-saas-roadmap/00_README_总控入口.md
3. docs/xiaogou-saas-roadmap/03_DESIGN_SYSTEM_OVERVIEW_设计系统总纲.md
4. docs/xiaogou-saas-roadmap/05_PHASE_STATUS_阶段状态表.md
5. docs/xiaogou-saas-roadmap/phases/phase-02-design-system/09_PRODUCT_DESIGN_INPUT_产品设计输入.md
6. docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/product-design-input.md

本次目标：
基于 Phase 02A 产品设计输入，创建 Figma Design System 的颜色、字体、基础组件、导航组件和关键业务组件。

优先组件：
Button、Input、Select、Tabs、FilterChip、DateRangePicker、Drawer、BottomSheet、Modal、Toast、EmptyState、Skeleton、StatusBadge、MetricCard、TaskCard、OrderCard、OrderTable、ScheduleBlock、ScheduleGrid、DeviceCard、DeviceTable、BottomNav、SideNav。

重点验证：
OrderCard、OrderTable、ScheduleBlock、DeviceCard / DeviceTable、StatusBadge 是否能支撑租赁商户的订单、档期、设备、物流、免押、异常和逾期场景。

本次不做：
不写代码，不改数据库，不进入 Phase 03，不做配置审计，不设计商户协作、调货、代发、二手市场、平台结算、担保交易、分润规则。

请先输出计划，等用户确认后再操作 Figma。
```

## 13. Phase 02A 完成判断

本 Artifact 与主文档 `09_PRODUCT_DESIGN_INPUT_产品设计输入.md` 已覆盖：

1. 手机端每个核心页面的用户任务。
2. PC 端 12 个页面的用户任务。
3. 页面首屏优先级。
4. 页面核心操作。
5. 默认展示字段。
6. 不默认展示字段。
7. 详情页 / Drawer / Bottom Sheet 承载规则。
8. 页面状态。
9. 手机端和 PC 端任务分工。
10. Design System 组件需求。
11. Phase 02B Figma Design System 输入。
