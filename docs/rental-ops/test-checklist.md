# 租赁运营中台测试记录

## 测试原则

- Codex 能本地验证的项目直接执行，并记录命令和结果。
- 需要真实手机、飞书群、顺丰接口、闲鱼/免押平台登录态的项目，记录为人工实测项。
- 每轮测试按优先级推进：P0 成交闭环、P1 数据沉淀、P2 履约任务、P7 手机工作台。

## 当前分支

- 开发分支：`feature/p1-inquiry-data-20260523`
- 基线分支：`checkpoint/mobile-workbench-20260523`
- 说明：当前工作区已有大量未提交改动。基线分支只记录 Git HEAD 位置，完整保存当前文件状态还需要后续做一次明确的本地 WIP 提交或 stash，避免误提交数据文件和密钥。

## P0 飞书成交工作台

### Codex 已测

- [x] 解析查档期命令。`node --test electron/tests/*.mjs`
- [x] 查档期接口返回可用设备、物流窗口、租金和免押条件。`POST /api/mobile/availability`
- [x] 飞书卡片结构符合回调快速响应要求。`node --test electron/tests/*.mjs`
- [x] 记档期上下文复用逻辑测试。`node --test electron/tests/*.mjs`
- [x] 待办查询接口返回今日/明日发货、归还、逾期待完结。`POST /api/mobile/fulfillment-tasks`
- [x] 飞书 Mac 群“租赁助手”内直接发查档期自然语言，机器人正常回复档期卡片和租客回复。
- [x] 飞书查档期后租客回复为单独纯文本消息，便于手机端直接复制。
- [x] `【测试】` / `[测试]` 前缀的查档期消息不会写入询单统计。
- [x] 定时履约提醒发送记录持久化，避免服务在提醒窗口内重启后重复推送。
- [x] 飞书卡片按钮 `确认发货`、`确认归还` 在真实群内可更新真实订单状态。
- [x] 飞书纯文字履约指令 `确认发货 订单号`、`确认归还 订单号` 在真实群内可更新真实订单状态。

### 需要人工实测

- [ ] 飞书群内查档期后，直接发“记档期”，能复用刚才的查询。
- [ ] 飞书卡片点击确认建单后，群里收到建单结果卡片。
- [x] 飞书卡片点击确认发货/确认归还后，群里会收到结果通知并刷新待办摘要。
- [ ] 每天 08:00 今日待办、20:00 明日待办能准时推送到目标群，且跨重启不重复。

## P1 询单数据沉淀

### Codex 已测

- [x] 询单事件表创建。`initDbManager()` 已创建 `inquiry_events`
- [x] 每次查档期写入询单事件。`POST /api/mobile/availability` 返回 `inquiryEventId`
- [x] 建单时把最近一次询单事件关联到订单。`linkInquiryEventToOrder` 冒烟验证通过
- [x] 基础统计接口返回型号询问次数、无档次数、建单转化率、平均报价和成交价。`GET /api/mobile/inquiry-stats`

### 需要人工实测

- [ ] 飞书查档期后，统计里能看到该型号询问次数增加。
- [ ] 飞书记档期成功后，该次询单转化为订单。
- [ ] 不同店铺、不同型号的统计不串数据。

## P2 履约任务中心

### Codex 已测

- [x] 手机端待办接口返回待补资料、待发货、待归还、逾期归还。`POST /api/mobile/fulfillment-tasks`
- [x] 确认发货接口能更新订单发货状态。
- [x] 确认归还接口能完结订单并释放档期。

### 需要人工实测

- [ ] 手机 H5 中点击确认发货后，桌面订单状态同步变化。
- [ ] 手机 H5 中点击确认归还后，档期释放且订单完结。
- [ ] 发货前待补资料单能被明显识别出来。

## P2 顺丰寄件工作台

### Codex 已测

- [x] 顺丰标快产品编码为 `2`，顺丰半日达产品编码为 `263`，同城作为单独询价产品。`node --test electron/tests/*.mjs`
- [x] 预校验 payload 在未配置月结卡时可生成；正式下单在未配置月结卡时使用寄付提交。`node --test electron/tests/sfShippingService.test.mjs`
- [x] 正式下单结果的 `filterResult` 映射覆盖可收派、不可收派、待人工和结果待确认，不明结果不会被当作下单成功。`node --test electron/tests/*.mjs`
- [x] 顺丰请求/保存摘要对 token、secret、同城凭据和月结卡执行脱敏。`node --test electron/tests/*.mjs`
- [x] 同城询价按官方示例字段解析，配送费由分换算为元，并返回预计配送分钟数。`node --test electron/tests/*.mjs`
- [x] `sf_shipments` 与 `sf_shipment_events` 已在当前 MySQL 库中初始化。
- [x] 桌面 renderer 构建通过，`顺丰寄件` 导航与三个页签可渲染，`寄件记录` 空态交互可切换。
- [x] 速运新建寄件改为单一 `立即下单` 入口；取件时间 `07:59` 会立即清空并显示红色范围提示，两个快捷入口分别写入 `10:00` 和 `17:00`。`Browser` 本地预提交验证，未提交真实订单。
- [x] 一键下单主进程编排已接入发货前预计送达、自动预校验、正式下单与不确定结果自动补查；已通过语法检查和模块测试，真实运单行为保留给人工确认。
- [x] 速运寄件支持本单临时修改寄件地址，只有勾选 `保存为默认寄件地址` 才会覆盖默认寄件配置。`node --check` 与 renderer 构建通过。
- [x] 下单前 `EXP_RECE_QUERY_DELIVERTM` 预估结果已接入，页面分别展示预计送达、预计费用、清单运费和实际支付金额。
- [x] 订单取消、运输轨迹、清单运费和实际支付修正已接入主进程、IPC/preload 与寄件记录详情页。`node --test electron/tests/sfShippingService.test.mjs`
- [x] 清单运费同步后默认生成/更新 `shipping_sf` 费用记录；实际支付手工修正后同步覆盖该费用记录，报表中心显示顺丰快递费汇总。
- [x] 新建寄件页新增今日待发货订单列表、逐单勾选、全选寄件和一键批量顺丰寄件；后端逐单复用现有正式下单流程，成功后同步运单号和物流状态到租赁订单。

### 需要人工实测

- [ ] 使用一条新的真实收件资料点击 `立即下单`，核对页面自动完成预计送达试算、预校验、正式下单并展示运单号；该操作会生成真实运单，需人工指定新测试单后执行。
- [ ] 使用已有测试运单刷新 `运输轨迹`，核对轨迹节点与顺丰 App 一致，并同步到关联租赁订单的物流状态。
- [ ] 使用已有测试运单刷新 `清单运费`，核对清单运费、费用分项和报表中心顺丰快递费汇总一致。
- [ ] 将实际支付金额手工改成与清单运费不同的数值并填写备注，核对寄件记录和报表中心均以手工实际支付金额统计。
- [ ] 对一笔允许取消的测试顺丰订单点击 `取消订单`，核对二次确认、取消成功提示和状态变为 `已取消`；不可取消时应展示顺丰错误，不应伪造成功。
- [ ] 在新建寄件页刷新今日待发货订单，勾选 1-2 条真实测试订单执行 `一键寄件`，核对每条结果、运单号和订单详情物流状态同步。
- [ ] 使用 `全选寄件` 勾选全部可寄件订单，核对资料不完整、已有进行中顺丰单的订单不会被选中，也不会重复下单。
- [ ] 核对未配置月结时按寄付下单；若后续配置不可用月结，核对页面提示自动回退寄付且不重复生成订单。
- [ ] 核对 `上午 10:00-11:00`（请求起始时间 `10:00`）、`17:00` 快捷取件时间可提交，`07:59` 和 `20:01` 会立即清空并在远端请求前被红色提示阻止。
- [ ] 对关联租赁订单的测试运单执行正式下单，核对订单详情同步运单号与预计派送时间。
- [ ] 人为制造网络中断或结果不明确场景后，核对页面只允许“查询下单结果”，不会重复正式提交。
- [ ] 配齐同城独立凭据后执行同城询价，核对费用（元）和预计配送时间；本期不验证同城正式下单。

## P7 手机 H5/PWA 工作台

### Codex 已测

- [x] `/mobile` 页面能返回完整 HTML。`GET /mobile`
- [x] `/mobile/manifest.json` 返回 PWA 配置。`GET /mobile/manifest.json`
- [x] `/mobile/icon.png` 返回图标。`GET /mobile/icon.png`
- [x] 手机工作台内联脚本语法通过。`new Function(inlineScript)`
- [x] 店铺、型号、订单、待办、查档期接口可返回数据。
- [x] iPhone 宽度下查档期、建单、订单日期控件固定为 `44px` 高且不超出容器。
- [x] H5 粘贴 `四川省绵阳市涪城区未名湖畔` 可按省市区详情调用顺丰并返回时效。
- [x] 顺丰回退/晚于租期到货提醒以独立红色提示块展示。
- [x] H5 仅填 `四川省绵阳市` 可调用顺丰试算，不要求区县或详细地址。
- [x] H5 只填无法推断省份的 `绵阳市` 时，结果提示补充省+市并明确为本地估算。

## 自动化测试记录

| 时间 | 项目 | 结果 | 备注 |
|------|------|------|------|
| 2026-05-23 | `node --check electron/main/mobileGateway.js && node --check electron/main/dbManager.js && node --check electron/main/ipcHandlers.js` | 通过 | 主进程关键文件语法检查 |
| 2026-05-23 | `node --test electron/tests/*.mjs` | 通过 | 42 项通过 |
| 2026-05-23 | `POST /api/mobile/availability` | 通过 | 大疆POCKET3 2026-06-01 至 2026-06-03，返回有档期、1 台可用、含租客回复 |
| 2026-05-23 | `POST /api/mobile/fulfillment-tasks` | 通过 | 今日待补资料 80、待发货 8、待归还 7、逾期归还 23 |
| 2026-05-23 | `vite build --config vite.config.js` | 通过 | 使用 bundled Node 直接执行 Vite |
| 2026-05-23 | `python3 -m pytest python/tests -q` | 未执行 | 当前系统 Python 未安装 `pytest` |
| 2026-05-24 | `node --test electron/tests/*.mjs` | 通过 | 44 项通过，新增 P1 询单统计测试 |
| 2026-05-24 | `POST /api/mobile/availability` | 通过 | 返回 `inquiryEventId`，写入询单事件 |
| 2026-05-24 | `GET /api/mobile/inquiries` | 通过 | 可查询询单事件列表 |
| 2026-05-24 | `GET /api/mobile/inquiry-stats` | 通过 | 返回询问次数、可用/无档、转化率、平均报价/成交价 |
| 2026-05-24 | `linkInquiryEventToOrder` | 通过 | 测试事件可关联订单；测试数据已清理 |
| 2026-05-24 | `vite build --config vite.config.js` | 通过 | 使用 bundled Node 直接执行 Vite |
| 2026-05-24 | 桌面端 `询单分析` 页面 | 通过 | Electron 重启后导航可见，页面空态和筛选控件正常 |
| 2026-05-24 | 飞书 Mac 群“租赁助手”查档期 | 通过 | 直接发送 `【测试】查档期 pocket3 6.16到6.18 发成都武侯`，收到档期卡片和纯文本租客回复 |
| 2026-05-24 | `GET /api/mobile/inquiries?limit=3` | 通过 | `【测试】` 查档期不进入询单事件，返回空测试结果 |
| 2026-05-24 | `node --test electron/tests/*.mjs` | 通过 | 47 项通过，新增飞书纯文本回复、测试询单跳过、履约提醒持久去重测试 |
| 2026-05-24 | `node --check electron/main/mobileGateway.js && node --check electron/main/dbManager.js && node --check electron/main/rentalInquiryMetrics.js` | 通过 | 主进程关键文件语法检查 |
| 2026-05-24 | bundled Node 执行 `vite build --config vite.config.js` | 通过 | 系统 Node 触发 Rollup 原生依赖签名错误，bundled Node 构建通过 |
| 2026-05-25 | 飞书卡片按钮 `确认发货 #13357` | 通过 | 真实群内点击后，订单状态更新为 `shipping` |
| 2026-05-25 | 飞书卡片按钮 `确认归还 #13356` | 通过 | 真实群内点击后，订单状态更新为 `completed` |
| 2026-05-25 | 飞书纯文字 `确认发货 13358` | 通过 | 真实群内发送后，订单状态更新为 `shipping` |
| 2026-05-25 | 飞书纯文字 `确认归还 13359` | 通过 | 真实群内发送后，订单状态更新为 `completed` |
| 2026-05-25 | `node --test electron/tests/*.mjs` | 通过 | 48 项通过，新增飞书纯文字履约指令解析测试 |
| 2026-05-25 | `node --check electron/main/mobileFeishuParser.js && node --check electron/main/mobileGateway.js && node --check electron/main/dbManager.js && node --check electron/main/rentalInquiryMetrics.js` | 通过 | 主进程关键文件语法检查 |
| 2026-05-25 | 手机 H5 日期控件移动视口验证 | 通过 | 查档期 `380 x 44px`，建单/订单 `365 x 44px` |
| 2026-05-25 | 手机 H5 顺丰档期查询 | 通过 | `acepro2` / 绵阳市涪城区地址正确调用顺丰，到货为 `2026-05-26`，晚于租期提示红框展示 |
| 2026-05-25 | `node --test electron/tests/*.mjs` | 通过 | 54 项通过，新增 H5 控件/脚本、完整地址解析与市级地址去重回归测试 |
| 2026-05-25 | 手机 H5 市级地址顺丰试算 | 通过 | `四川省绵阳市` 无详细地址可查时效；`绵阳市` 单独输入会提示补省份 |
| 2026-05-26 | `node --check electron/main/sfShippingService.js && node --check electron/main/dbManager.js && node --check electron/main/ipcHandlers.js && node --test electron/tests/*.mjs` | 通过 | 70 项通过，含顺丰寄件 payload、状态、脱敏、时效校验及同城返回解析测试 |
| 2026-05-26 | 寄件草稿数据库冒烟验证 | 通过 | 新建、读取并清理测试草稿，全程未调用远端顺丰接口 |
| 2026-05-26 | bundled Node 执行 `vite build --config vite.config.js` | 通过 | 新增 `顺丰寄件` 独立页面、设置项与导航构建通过 |
| 2026-05-26 | MySQL 表结构检查 | 通过 | `sf_shipments` 与 `sf_shipment_events` 已创建 |
| 2026-05-26 | 本地页面交互检查 | 部分通过 | 导航及三个页签可渲染，寄件记录页签可切换；桌面窗口画面读取和浏览器截图通道超时 |
| 2026-05-27 | `node --check main/sfShippingService.js && node --check main/dbManager.js && node --check main/ipcHandlers.js && node --check preload/preload.js && node --test tests/*.mjs` | 通过 | 79 项通过，覆盖取件时段与寄付回退基础规则 |
| 2026-05-27 | bundled Node 执行 `vite build --config vite.config.js` | 通过 | 一键顺丰寄件、预计送达提示与取件时间控件构建通过 |
| 2026-05-27 | 本地顺丰寄件预提交交互 | 通过 | 非法取件时间红框且清空，快捷时段写入正确，未执行真实下单；截图通道超时未保留截图 |
| 2026-05-28 | `node --check electron/main/sfShippingService.js && node --check electron/main/dbManager.js && node --check electron/main/ipcHandlers.js && node --check electron/preload/preload.js && node --test electron/tests/sfShippingService.test.mjs` | 通过 | 25 项通过，覆盖取消、路由、清单运费、预计价格和实际支付规则 |
| 2026-05-28 | `node --test electron/tests/*.mjs` | 通过 | 83 项通过，全量 Electron Node 测试通过；仅有既有 ES module 类型提示 |
| 2026-05-28 | bundled Node 执行 `node node_modules/vite/bin/vite.js build --config vite.config.js` | 通过 | 顺丰寄件页和报表中心费用汇总构建通过；当前 shell 无 `npm` 命令 |
| 2026-05-28 | `node --check electron/main/sfShippingService.js && node --check electron/main/dbManager.js && node --check electron/main/ipcHandlers.js && node --check electron/preload/preload.js && node --test electron/tests/sfShippingService.test.mjs` | 通过 | 26 项通过，新增批量待发货订单生成顺丰寄件 payload 规则 |
| 2026-05-28 | `node --test electron/tests/*.mjs` | 通过 | 84 项通过，批量寄件扩展未破坏既有运营/顺丰规则 |
| 2026-05-28 | bundled Node 执行 `node node_modules/vite/bin/vite.js build --config vite.config.js` | 通过 | 新建寄件页待发货订单列表、全选寄件和一键寄件 UI 构建通过 |

### 需要人工实测

- [ ] iPhone Safari 打开公网地址后，日期控件高度与普通输入框一致，页面无溢出。
- [ ] iPhone Safari 添加到主屏幕后，可以像 App 一样打开。
- [ ] 手机端查档期、复制租客回复、使用查询结果建单流程可用。
- [ ] 外网 ngrok 地址在 4G/5G 下可访问。
- [ ] 同 Wi-Fi 下局域网地址可访问。

## 已知风险

- ngrok 免费域名可能变化或断开，飞书回调和手机公网访问依赖该进程。
- 当前免押单仍需人工创建/完结，接口打通前只能做提醒。
- 当前 Git 工作区未提交内容较多，后续提交前需要分批筛选，避免数据和密钥进入版本历史。
- 飞书 Mac 发送区右侧小箭头是“定时发送”，不是即时发送；自动化和人工测试都应优先用 `Return` 或主发送按钮。
