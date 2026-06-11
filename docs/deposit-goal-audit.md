# 免押模块目标审计

本文用于审计当前代码对免押模块最终目标的覆盖情况。

状态说明：

- `代码已覆盖`：当前仓库代码已实现对应行为，并有本地回归或构建验证。
- `待真实环境验证`：代码已接通，但需要真实接口、真实回调或真实飞书环境截图确认。
- `受外部条件限制`：是否最终成立依赖外部平台能力、白名单、公网回调地址或真实账号权限。

## 1. 订单页可以基于订单创建免押单

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/views/rental/OrderFulfillment.vue`
  - `electron/renderer/src/components/CreateDepositDrawer.vue`
- 说明：
  - 订单页已接入创建入口
  - 创建抽屉会从订单自动带入信息
  - 手动调整租期开始/结束时，租期天数会自动重算

## 2. 创建免押单时，押金默认来自设备价值 purchase_cost，不使用订单押金

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/components/CreateDepositDrawer.vue`
  - `electron/renderer/src/services/deviceLookupService.js`
- 说明：
  - 默认通过设备价值查询 `purchase_cost`
  - 未直接读取订单押金字段作为免押押金

## 3. 创建成功后生成规范的支付宝免押审核图片，图片样式以文档中的最终海报为准

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/utils/depositPosterCanvas.js`
  - `electron/renderer/src/components/CreateDepositDrawer.vue`
- 说明：
  - 已输出蓝色海报版式
  - 支持二维码、商品图、流程、提示、联系电话、工作时间
- 待确认：
  - 真实二维码在真实环境下的最终显示效果

## 4. 设置页可以配置免押接口参数、userEid、notify_url、海报文案、联系电话、工作时间

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/views/Settings.vue`
  - `electron/renderer/src/services/depositSettingsService.js`
- 说明：
  - 本地展示配置保存到 localStorage
  - `appId / appSecret / userEid / notify_url` 同步写入主进程配置

## 5. mock 模式保持可用，用于本地测试和演示

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/services/depositMockService.js`
  - `electron/renderer/src/services/depositApiService.js`
- 说明：
  - mock 创建、列表、详情、取消、完结、删除、批量操作可用
  - 删除最新单后，旧单会重新提升为最新

## 6. real 模式必须通过 Electron main process 代理请求真实接口，renderer 不允许直接 fetch

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/main/depositClient.js`
  - `electron/main/ipcHandlers.js`
  - `electron/preload/preload.js`
  - `electron/renderer/src/services/depositApiService.js`
- 说明：
  - real 创建、列表、详情、完结均走 `renderer -> preload -> ipc -> main`
  - renderer 免押相关文件不直连真实接口

## 7. 真实创建接口能拿到真实 orderNo 和 qr_code_url

- 状态：`待真实环境验证`
- 代码位置：
  - `electron/main/depositClient.js`
  - `electron/renderer/src/services/depositApiService.js`
- 说明：
  - 代码已按文档解析 `orderNo` 和 `qr_code_url`
- 外部条件：
  - 需要真实 `appId / appSecret / userEid`
  - 需要平台 IP 白名单

## 8. 详情接口能补充 scheme_url 和 deposit_status

- 状态：`待真实环境验证`
- 代码位置：
  - `electron/main/depositClient.js`
  - `electron/renderer/src/services/depositApiService.js`
  - `electron/renderer/src/views/rental/DepositManagement.vue`
- 说明：
  - 详情已解析 `scheme_url`、`deposit_status`
  - 文本型邀约内容优先作为复制内容
  - real 列表直接复制邀约/保存海报时，若列表字段不全，会自动补一次详情
  - 若本地缓存缺少关联字段，前端会尝试从详情的 `deposit_farther` 中恢复来源订单、型号、设备编号
- 待确认：
  - 真实详情接口返回值与商户当前账号数据一致

## 9. 免押管理页可以查看免押单、查看详情、复制链接、保存海报、取消、完结

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/views/rental/DepositManagement.vue`
- 说明：
  - 查看列表、详情 Drawer、复制邀约、保存海报已接通
  - 顶部状态卡统计已独立于当前状态筛选，避免切换状态后统计失真
  - mock 下支持取消、完结
  - real 下完结已接通
- 受限项：
  - real 取消接口文档未提供，当前继续禁用

## 10. 后续免押管理页支持新建免押单、删除、批量取消、批量完结、批量删除

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/views/rental/DepositManagement.vue`
  - `electron/renderer/src/services/depositMockService.js`
- 说明：
  - 管理页支持手动新建
  - mock 支持删除、批量取消、批量完结、批量删除
- 受限项：
  - real 删除/取消接口文档未提供，当前保持禁用

## 11. 订单完结时，可以联动完结该订单对应的最新有效免押单

- 状态：`代码已覆盖`
- 代码位置：
  - `electron/renderer/src/views/rental/OrderFulfillment.vue`
  - `electron/renderer/src/services/depositApiService.js`
- 说明：
  - 单条完结、批量完结后，都会尝试联动完结最新有效免押单
  - 批量归还/批量完结只会对真实归还成功的订单执行免押联动，避免误完结失败订单的免押单
  - 关联查找同时兼容 `order.id` 和 `order.order_no`
  - 同一订单存在多张免押单时，订单履约页会优先按 `isLatest`、再按创建时间降序选择最新单
  - 订单详情 Drawer 已监听免押状态推送，关联免押单状态变化后会自动刷新右侧免押状态卡
  - 订单履约页会先将推送状态写回本地免押缓存，再刷新右侧免押卡片，不依赖免押管理页先打开
  - 订单履约页右侧免押卡片的 `复制邀约 / 保存海报` 已接通，并支持缺字段时先补详情
  - 免押失败只提示，不回滚订单完结

## 12. 飞书通知可以在免押审核状态变化时提醒我

- 状态：`待真实环境验证`
- 代码位置：
  - `electron/main/depositNotifyServer.js`
  - `electron/main/ipcHandlers.js`
  - `python/services/notification_service.py`
- 说明：
  - 本地回调接收器、详情同步、状态广播、飞书通知链路已写通
  - 对不可靠回调状态做了事件优先级修正
  - 主进程对同一免押单同一状态做了通知去重，避免回调后列表/详情再次同步时重复提醒
- 外部条件：
  - 需要真实回调到达
  - 需要当前飞书通知通道可用

## 13. 整个流程不能破坏订单履约、顺丰寄件、设备管理、档期、报表、设置页已有功能

- 状态：`代码侧已尽量隔离，待页面回归验证`
- 说明：
  - 当前改动集中在免押相关文件
  - 已多次执行 `npm run build:renderer`
  - 设置页修改海报配置后，无需重启应用即可在创建抽屉、管理页详情和海报生成中生效
- 待确认：
  - 仍建议按页面进行人工回归截图：
    - 订单履约
    - 顺丰寄件
    - 设备管理
    - 设置页其他区域
    - 报表与档期相关页面

## 当前结论

- 当前代码已经基本覆盖免押模块目标中的业务实现部分。
- 仍不能宣称“最终闭环已完成”的原因，不在代码本身，而在以下外部证据尚缺：
  - 真实创建成功截图
  - 真实详情同步截图
  - 真实完结截图
  - 真实回调到达与状态变更截图
  - 飞书通知截图
  - 不回归页面截图
