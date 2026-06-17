# UI-V2 Data Access Architecture Plan

## 0. 文档定位

本文用于固定 UI-V2 mock 页面接入真实业务能力时的数据访问架构。

本方案只定义后续改造方向，不代表立即重构 Electron main、preload、IPC、Python、数据库或 legacy 页面。

最终采用：

```text
Domain API + 可插拔 Transport + 当前 Electron IPC 承载 + 未来 HTTP 可替换
```

## 一、架构目标

UI-V2 真实业务接入必须满足：

1. 稳定：真实数据读取失败时不导致页面白屏或核心导航不可用。
2. 安全：renderer 不直接连接数据库、不持有数据库密码、不直接访问 Python、本地文件、SQLite 或 MySQL。
3. 易维护：页面不散落 `window.electronAPI.*` 调用，字段映射和错误处理集中在 adapter/API 层。
4. 方便迁移：未来从 Electron 本地 IPC 切换到 HTTP API/RPC/WebSocket 时，不重写 UI-V2 页面。
5. 容错高：每个 domain method 独立 fallback，单个接口失败不拖垮整页。
6. 性能好：列表分页、短时缓存、请求去重、超时控制和慢接口降级在 API client/transport 层处理。
7. 不破坏 renderer-only preview：`npm run renderer:preview` 永远使用 mock，不尝试真实 IPC。
8. 不破坏 legacy 页面：不改 legacy 页面现有数据入口和业务流程。
9. 不一次性重构 main/preload/DB：优先复用现有安全 IPC 能力，小步接入。
10. 支持未来远程服务化：保留 `httpTransport` 演进位置。

## 二、推荐架构图

```text
UI-V2 View
  ↓
UI-V2 Domain Adapter
  ↓
Domain API Client
  ↓
Transport Adapter
  ├── mockTransport
  ├── electronIpcTransport
  └── httpTransport
  ↓
Electron main or Remote API
  ↓
Database / Python / External Services
```

当前 Electron 桌面端：

```text
UI-V2 View
  ↓
ordersApi.list()
  ↓
electronIpcTransport.call("orders:list")
  ↓
window.electronAPI.listOrders()
  ↓
preload
  ↓
IPC
  ↓
main/dbManager/service
  ↓
MySQL / SQLite / external service
```

未来 Web/SaaS 端：

```text
UI-V2 View
  ↓
ordersApi.list()
  ↓
httpTransport.get("/api/orders")
  ↓
Remote API
  ↓
Business service / database
```

## 三、为什么不让页面直接调用 IPC

不建议在 UI-V2 页面中直接写：

```js
window.electronAPI.listOrders()
```

主要问题：

1. 页面与 Electron 强绑定，无法直接迁移到 Web/SaaS。
2. 未来 HTTP 化时，每个页面都要改调用方式。
3. 字段映射会散落在多个页面。
4. mock/real/fallback 切换会散落在多个页面。
5. 错误处理、空状态和降级策略难以统一。
6. 单元测试和 renderer-only preview 更难隔离 Electron 环境。
7. 页面会逐步承担 API 协议细节，降低可维护性。
8. 远程服务化时改动面过大，风险不可控。

页面应该只依赖 domain API 或 UI-V2 adapter，例如：

```js
ordersApi.list()
ordersApi.detail(id)
devicesApi.list()
scheduleApi.list()
```

## 四、为什么现在不直接全改 HTTP API

当前不建议一次性 HTTP 化，原因是：

1. 现有 Electron main/preload/IPC/dbManager 已经承载大量可复用业务能力。
2. 全量 HTTP 化会立即引入鉴权、CORS、安全策略、部署、服务发现、监控和服务治理问题。
3. 真实业务接入目标是先让 UI-V2 安全读取现有业务数据，不是重建后端平台。
4. 一次性 HTTP 化会扩大改造面，增加 legacy 流程回归成本。
5. SaaS 化需要配合 Phase 03 的登录、商户、门店、员工、权限和数据隔离，不适合在 UI-V2 第一轮真实接入中抢跑。

因此，当前 real transport 使用 Electron IPC 承载；未来远程服务化时，再替换为 `httpTransport`。

## 五、最终建议方案

最终方案：

1. UI-V2 页面只依赖 domain API / adapter。
2. adapter 层统一处理 `mock / real / auto / fallback`。
3. 当前真实读取通过 `electronIpcTransport` 调用现有 `window.electronAPI`。
4. 未来新增 `httpTransport` 后，domain API 层不变。
5. renderer-only preview 强制 `mock`。
6. Electron 正式环境默认 `auto`。
7. 真实读取失败 fallback mock。
8. 返回结果统一带 `meta`。

标准返回结构：

```js
{
  data,
  meta: {
    source: "mock" | "real" | "mock-fallback",
    fallbackReason,
    loadedAt
  }
}
```

`mock-fallback` 不应伪装成真实数据。UI 可以在调试模式或内部预览中展示当前数据来源。

## 六、建议目录结构

建议方向如下，不要求立即一次性重构到位：

```text
electron/renderer/src/adapters/uiV2/
  index.js
  mode.js
  fallback.js
  mockAdapter.js
  realAdapter.js

electron/renderer/src/api/
  domains/
    ordersApi.js
    devicesApi.js
    scheduleApi.js
    logisticsApi.js
    depositApi.js
    customersApi.js
    reportsApi.js
  transports/
    mockTransport.js
    electronIpcTransport.js
    httpTransport.js
```

如果当前项目结构不同，后续实施时以“小步可回退”为原则：

1. 先保留现有 `electron/renderer/src/adapters/uiV2/index.js` 的 mock 能力。
2. 再拆出 mode/fallback/real adapter。
3. 最后根据真实接入规模决定是否新增完整 `api/domains` 与 `api/transports`。

## 七、Adapter Mode 规则

### mock

- 永远使用 mock。
- `npm run renderer:preview` 强制使用。
- 无 `window.electronAPI` 时使用。
- 用于视觉预览、截图、设计验收和无 Electron 环境调试。

### real

- 强制使用真实数据。
- 用于 Electron 真实环境调试。
- 失败时是否 fallback 由 method 配置决定。
- 不适合 renderer-only preview。

### auto

- 优先真实数据。
- 失败 fallback mock。
- Electron 正式环境默认推荐。
- 适合逐页打开真实接入。

默认规则：

1. `npm run renderer:preview` -> `mock`。
2. 无 `window.electronAPI` -> `mock`。
3. Electron 正式环境 -> `auto`。
4. 调试真实接入 -> `real`。
5. 未来 Web/SaaS -> `httpTransport + auto` 或 `httpTransport + real`。

## 八、迁移路线

### Phase 1：UI-V2 Adapter Mode Foundation

- 建立 mode/fallback/统一导出。
- 保留 mock adapter。
- 新增 real adapter 壳。
- 不调用真实 `electronAPI`。
- 不改 main/preload/IPC。

### Phase 2：Orders Real Readonly Adapter

- 只读订单列表。
- 只读订单详情。
- Desktop/Mobile 订单页共用。
- 允许在 real adapter 内调用现有 `listOrders/getOrderDetail`。
- 不做状态流转、物流、免押、编辑。

### Phase 3：Devices Real Readonly Adapter

- 设备列表。
- 设备详情。
- 状态映射。
- 不做编辑。
- 不做库存调整。

### Phase 4：Schedule Real Readonly Adapter

- 档期占用。
- 设备可用性。
- 订单租期映射。
- 不做排期编辑。

### Phase 5：Customers Derived Readonly Adapter

- 从订单、询单、免押订单派生客户视图。
- 不建客户主表。
- 不提前引入 CRM 模型。

### Phase 6：Logistics / Deposit

- 属于操作型能力。
- 单独计划。
- 单独验收。
- 必须保留 fallback。
- 不与 Orders Readonly 混在同一切片。

### Phase 7：Dashboard / Reports

- 最后做聚合。
- 等订单、设备、档期稳定后再接统计。
- 避免早期统计口径反复变更。

## 九、安全策略

1. renderer 不直接连接 DB。
2. renderer 不直接持有 DB 凭据。
3. renderer 不直接调用 Python。
4. Electron main 作为本地安全代理。
5. preload 暴露最小 API，不把底层数据库能力原样暴露给页面。
6. 未来 token 和敏感凭据应放在 main、安全存储或后端服务，不进入 renderer。
7. `httpTransport` 必须支持 timeout、重试、鉴权、错误归一化。
8. 所有真实调用必须可观测、可回退。
9. 不在 UI-V2 adapter 中硬编码数据库地址、密码、token、cookie。

## 十、容错策略

1. 每个 method 独立 fallback。
2. 单个接口失败不导致整页空白。
3. fallback 结果必须带 `meta.source = "mock-fallback"`。
4. fallback 原因放入 `meta.fallbackReason`，但不得包含敏感信息。
5. UI 可展示“演示数据 / 真实数据 / fallback 数据”状态。
6. mock fallback 不应伪装成真实数据。
7. renderer-only preview 永远不尝试真实请求。
8. real 模式可以选择对关键接口直接暴露错误，用于调试；auto 模式默认 fallback。

## 十一、性能策略

1. API client 层支持分页。
2. 大表格默认分页，避免一次加载全部历史订单。
3. 防止重复请求，例如同一页面短时间内重复进入不重复拉取。
4. 可加短时缓存，缓存必须可失效。
5. 可加并发控制，避免 dashboard 一次触发过多 IPC 调用。
6. 真实接口应设置 timeout。
7. 慢接口可降级 fallback。
8. Dashboard/Reports 延后聚合，避免早期性能复杂化。
9. 移动端优先拉取轻量字段，详情页再拉完整字段。

## 十二、后续第一个实现切片：UI-V2 Adapter Mode Foundation

### 为什么先做

先建立 mode/fallback/统一导出，可以让后续 Orders、Devices、Schedule 每个真实接入切片都只改自己的 domain 映射，避免页面直接绑定 Electron IPC。

### 允许修改文件

建议只允许：

```text
electron/renderer/src/adapters/uiV2/
```

如必须新增 transport/API 壳，建议只允许：

```text
electron/renderer/src/api/domains/
electron/renderer/src/api/transports/
```

### 禁止修改文件

```text
electron/main/
electron/preload/
python/
data/
config/
scripts/
docs/ 之外的规划文档
数据库 schema
本地配置
```

### 验收标准

1. `npm run build:renderer` 通过。
2. `npm run renderer:preview` 可打开 UI-V2 页面，并保持 mock。
3. 无 `window.electronAPI` 时自动 mock。
4. Electron 环境下默认 mode 可识别为 `auto`，但本切片不调用真实接口。
5. legacy 页面不受影响。
6. 不修改 main/preload/IPC/Python/DB。

### Checkpoint 建议

```text
chore: add ui v2 adapter mode foundation
```

## 十三、后续第二个实现切片：Orders Real Readonly Adapter

### 为什么订单先做

订单是租赁业务主轴，现有 preload/main 已经具备 `listOrders/getOrderDetail` 能力。只读接入不需要数据库迁移，也不需要修改状态流转、物流、免押等高风险流程。

### 只读边界

只做：

1. 订单列表读取。
2. 订单详情读取。
3. Desktop `/ui-v2/orders`。
4. Mobile `/ui-v2/mobile/orders`。
5. Mobile `/ui-v2/mobile/orders/:id`。

不做：

1. 创建订单。
2. 编辑订单。
3. 删除订单。
4. 状态流转。
5. 发货。
6. 物流查询。
7. 免押审核。
8. 费用调整。
9. 数据库 schema 修改。

### 需要的真实 API

优先复用现有 Electron preload API：

```text
window.electronAPI.listOrders()
window.electronAPI.getOrderDetail()
```

真实 adapter 对外仍暴露 domain method：

```js
ordersApi.list()
ordersApi.detail(id)
```

### Fallback 规则

1. `ordersApi.list()` 失败时 fallback 到 mock orders。
2. `ordersApi.detail(id)` 失败时优先从 mock orders 按 id/orderNo 查找。
3. fallback 结果必须标记 `meta.source = "mock-fallback"`。
4. renderer-only preview 永远不调用真实订单 API。

### Desktop/Mobile 验收页面

1. `/ui-v2/orders`
2. `/ui-v2/mobile/orders`
3. `/ui-v2/mobile/orders/:id`

### Checkpoint 建议

```text
feat: connect ui v2 orders to readonly real adapter
```

## 十四、后续执行边界

后续真实接入每个切片都应单独调度、单独验收、单独 checkpoint。

禁止把以下内容混入 Orders Readonly 切片：

1. main/preload/IPC 重构。
2. Python bridge 改造。
3. 数据库 schema 修改。
4. 物流发货操作。
5. 免押审核操作。
6. legacy 页面重构。
7. 远程 HTTP 服务化。

## 十五、文档结论

UI-V2 真实业务接入应采用渐进式架构：

```text
页面稳定依赖 domain API；
当前真实读取复用 Electron IPC；
mock preview 永远保留；
fallback 可观测；
未来通过替换 transport 迁移到 HTTP/SaaS。
```

建议下一步先进入文档验收，再进入 `UI-V2 Adapter Mode Foundation` 实现计划。
