# 06 决策记录

用于记录重要产品、架构、设计、技术决策。

## 决策模板

```text
日期：YYYY-MM-DD
阶段：Phase XX
决策主题：
背景：
最终决策：
不采用的方案：
影响范围：
后续动作：
```

## 已确认决策

### D001：产品不再定位为闲鱼助手

背景：旧系统最初服务闲鱼租赁提效，但未来目标是租赁商户标准化运营系统。

最终决策：闲鱼只作为渠道来源之一，不再作为产品架构核心。

影响范围：产品定位、数据模型、导航、UI 文案、代码命名、未来功能规划。

### D002：配置中心与敏感配置治理纳入 Phase 03 Backlog

日期：2026-06-12
阶段：阶段外文档治理 / 归属 Phase 03
决策主题：配置审计、配置中心与敏感配置治理纳入阶段化路线图

背景：
项目从内部工具升级为租赁商户运营标准化系统后，Token、Cookie、Password、MySQL 连接信息、第三方凭证、商户配置等不能继续散落在 JS / Python / 本地文件 / 历史文档中，需要先形成配置治理规则与后续审计计划。

最终决策：
安装配置审计与配置治理增量补丁；新增 CR-0001，将配置来源审计、敏感凭证治理、ConfigService / CredentialService 方向纳入 Phase 03 SaaS 底座阶段处理。

不采用的方案：
不在当前阶段直接开发配置中心；不直接新增数据库表；不迁移配置数据；不执行配置审计；不修改业务代码。

影响范围：
项目治理文档、Prompt 模板、Phase 03 需求与验收标准、后续配置审计会话调度。

后续动作：
当前只登记到文档体系；配置审计必须由总控台在 Phase 03 或明确指定阶段调度后执行。

### D003：Phase 01 产品定位与系统骨架确认

日期：2026-06-12
阶段：Phase 01
决策主题：产品定位、用户角色、导航、核心流程、模块边界和 legacy channel 边界确认

背景：
Phase 00 已确认项目从旧闲鱼助手升级为租赁商户运营标准化系统，并完成现有能力、legacy 闲鱼绑定、数据模型和保留/暂缓清单盘点。Phase 01 需要固定产品骨架，为后续设计系统、SaaS 底座和核心业务重构提供边界。

最终决策：

1. 产品对外名称暂定为“小狗相机助手”，产品版本 / 后台名称为“小狗相机助手商户版”。
2. 产品定位为面向租赁商家的运营标准化系统，用于规范和提效商户内部的询单、订单、档期、设备、免押/押金、物流、归还、验机、员工协作和经营数据管理流程。
3. Phase 01 聚焦相机、运动相机、CCD、摄影器材、数码设备、演唱会/旅游拍摄设备租赁商家。
4. 手机端底部导航固定为：工作台、订单、档期、设备、我的。
5. PC 端主导航固定为：工作台、询单中心、订单中心、档期中心、设备中心、客户中心、免押管理、物流发货、财务结算、报表中心、设置中心。
6. 核心角色固定为老板 / 超级管理员、店长、运营、发货员、财务；新员工 / 客服运营作为 SOP 使用场景角色。
7. 核心业务流程固定为：询单 → 查档期 → 报价 / 发档期 → 创建订单 → 创建免押 / 押金 → 发货 → 物流跟踪 → 到期提醒 → 归还验机 → 完结订单 → 数据沉淀 / 报表分析。
8. 闲鱼只作为 legacy channel / 订单来源渠道之一，不进入新产品主架构。
9. 商户协作网络只作为长期方向预留，不进入当前主导航，不在 Phase 01 实现。

不采用的方案：

1. 不继续以“闲鱼助手”或“闲鱼自动回复工具”作为产品定位。
2. 不把闲鱼账号连接、闲鱼 IM、闲鱼 WebSocket、cookies/token 作为新产品主链路。
3. 不在 Phase 01 开发登录、配置中心、商户协作、业务状态机、Figma 设计系统或数据库迁移。

影响范围：
产品定位、信息架构、导航、页面清单、模块边界、legacy channel 处理、后续 Phase 02/03/04 的输入。

后续动作：
Phase 01 文档产物写入 `docs/xiaogou-saas-roadmap/phases/phase-01-product-foundation/artifacts/`；阶段验收通过后，才允许更新阶段状态并准备 Phase 02。

### D004：Phase 02 拆分为 Product Design → Figma Design System → 核心页面原型 → Frontend Design Spec

日期：2026-06-13
阶段：Phase 02
决策主题：Phase 02 设计系统阶段拆分与工具边界确认

背景：
Phase 02 的目标不是直接从 Figma 画完整 UI 开始，而是把 Phase 01 已确认的产品定位、信息架构、页面清单和模块边界转化为可复用的设计系统、核心页面原型和后续前端落地规范。若跳过产品设计输入，直接画 UI，容易导致设计系统不稳定、页面返工和前端落地边界不清。

最终决策：

1. Phase 02 拆分为四个子阶段：Phase 02A Product Design / 产品设计输入整理、Phase 02B Figma Design System / UI Design、Phase 02C 核心页面高保真原型、Phase 02D Frontend Design Spec / 前端设计落地规范。
2. Phase 02 不直接从 Figma 画完整 UI 开始，必须先完成产品设计输入。
3. Phase 02A Product Design 已完成并提交 checkpoint，commit 为 `04f65c9`。
4. Phase 02B 才进入 Figma Design System，目标是创建 Figma 原生可编辑设计系统和基础组件。
5. Figma 是设计源文件中心。
6. Figma MCP 是 Codex 操作 Figma 的主工具。
7. Figma Make 仅可作为探索工具，不能替代 Figma Design System。
8. Mobbin / 真实产品截图可作为参考输入，只用于借鉴信息密度、组件组织和后台体验。
9. v0 只作为 Phase 04 前端代码 / 布局参考，不作为 Phase 02 设计源头。
10. Relume 更适合官网，不进入当前后台产品设计主线。
11. Frontend Design Spec 留到 Phase 02D。
12. 前端开发留到 Phase 04。

不采用的方案：

1. 不在 Phase 02A 后直接进入前端开发。
2. 不用 PNG、普通图片或 Figma Make 替代 Figma 原生 Design System。
3. 不在 Phase 02B 设计商户协作、调货、代发、二手设备市场、平台结算、商户信用等未来模块。
4. 不在 Phase 02 执行 ConfigService / CredentialService 或配置审计。

影响范围：
Phase 02 执行顺序、Figma 会话边界、设计系统产物、核心页面原型范围、Phase 04 前端开发输入。

后续动作：
启动 Phase 02B 前，必须先确认 Figma MCP 连接，并由用户明确授权后才允许操作 Figma。Phase 02B 会话应先读取 Phase 02A 文档，输出 Figma Design System 创建计划，等待用户确认后再创建或修改 Figma 文件。

### D005：暂停旧系统页面 UI 改造，新增 UI-V2 Demo 阶段验证新产品体验

日期：2026-06-14
阶段：Phase 02 路线调整 / Phase UI-V2 Demo
决策主题：暂停真实系统页面 UI 改造，先用独立 Demo 确认未来产品体验

背景：
Phase 02B Figma 设计系统已经通过，Phase 02C-01 / 02C-02 已经在真实系统中完成 Token、基础组件、App Shell、Sidebar、Topbar 的初步改造。但当前新产品的整体视觉风格和交互结构尚未最终确认。如果继续在旧系统页面上边改边看，容易被旧页面结构、旧业务逻辑和旧布局限制，最终变成旧 UI 美化版，而不是真正的新产品体验。

最终决策：

1. Phase 02B Figma Design System 已完成并保留为设计资产和参考标准。
2. Phase 02C 真实系统 UI 改造暂停在 02C-02。
3. 暂停 Phase 02C-03 订单中心真实系统改造。
4. 不继续在旧系统页面上推进 UI 重构，尤其不继续重构 `electron/renderer/src/views`。
5. 新增 Phase UI-V2 Demo，用于独立验证未来租赁 SaaS 的 PC + Mobile 产品体验。
6. UI-V2 Demo 规划放在 `prototypes/ui-v2-demo`。
7. UI-V2 Demo 只使用 mock 数据，不接旧系统功能、不接数据库、不接 Electron、不接真实 API。
8. Demo 风格、页面结构和交互体验确认后，再规划旧系统业务逻辑、接口、electronAPI、数据库能力的迁移。
9. 后续 Phase 03 不再默认直接进入旧系统业务迁移，必须以 UI-V2 Demo 定稿结果作为输入重新调度。

不采用的方案：

1. 不继续在旧系统页面上边改边看。
2. 不把旧系统 UI 美化作为新产品体验的最终方案。
3. 不在当前阶段迁移旧系统业务能力到新 Demo。
4. 不接真实 MySQL。
5. 不改 Electron main / preload / IPC。
6. 不改 Python backend。
7. 不改数据库 schema。
8. 不提交 Git，除非后续用户明确要求。

影响范围：
Phase 02C 执行范围、Phase 03 进入条件、后续前端迁移策略、UI-V2 Demo 阶段文档、旧系统 UI 改造节奏。

后续动作：
先更新路线文档并创建 UI-V2 Demo 阶段说明。随后启动 UI-V2 Product Design 会话，基于已有产品定位、Phase 02A 产品设计输入和 Phase 02B Figma 设计系统，重新规划独立 PC + Mobile Demo。产品设计方案确认后，再创建 `prototypes/ui-v2-demo`。

### D006：最终 UI 风格冻结与 Figma 组件校准策略

日期：2026-06-14
阶段：Phase UI-V2 Demo / Phase 02 设计系统延续
决策主题：最终 UI 风格冻结、Figma 组件校准和前端改造前置规范

背景：
最终 UI 风格归档包已经安装并完成 docs checkpoint，commit 为 `582bda7`。归档内容包括网页端和手机端最终 UI 风格参考图、Phase 02 artifacts、前端实现说明、组件映射、移动端规范、Figma 校准计划和资源索引。当前工作区仍存在安装前遗留的 `electron/` 与 `prototypes/` 未提交变更，这些变更不属于最终 UI 风格归档。

最终决策：

1. 网页端和手机端最终 UI 风格参考图已归档。
2. 后续 UI/UX 改造以最终 UI 风格图和 Phase 02 artifacts 为准。
3. PC 端采用深色左侧导航 + 浅色主内容 + 右侧 Drawer 的 B 端 SaaS 风格。
4. 手机端采用移动工作台逻辑，只保留高频功能入口，低频功能收纳到“我的 / 更多工具”。
5. Figma 已有组件不推倒重做，进入审计与校准模式。
6. Figma 后续工作应审计已有组件、对照最终 UI 风格图、保留可保留项、校准不一致项、补齐缺失项，必要时创建 v2 组件变体。
7. 禁止直接删除已有 Figma 组件。
8. 禁止重新做一套完全无关的组件库。
9. 前端开发前必须先做 Frontend Design Spec / UI 改造计划。
10. 不允许直接“照图片改代码”，必须先完成组件映射和实现计划。
11. 当前 `electron/` 与 `prototypes/` 未提交变更属于执行前遗留变更，需要单独审查处理。

不采用的方案：

1. 不把最终 UI 参考图当成可直接照搬代码的截图规格。
2. 不绕过 Figma 组件审计与校准。
3. 不绕过 Frontend Design Spec 直接改真实业务页面。
4. 不在未审查当前工作区遗留变更前混合提交业务代码和文档。

影响范围：
后续 UI/UX 评审、Figma 组件维护、Frontend Design Spec、前端 UI 改造计划、旧系统能力迁移节奏。

后续动作：
先启动 Figma 组件审计与校准会话，明确已有组件可保留、需校准、需补齐和 v2 变体范围；并并行或随后启动前端 UI 改造计划会话，基于最终 UI artifacts 输出组件映射和实现计划。当前遗留的 `electron/` 与 `prototypes/` 变更应单独审查，不与 UI 风格归档混合处理。
