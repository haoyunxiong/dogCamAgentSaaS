# 免押模块证据矩阵

本文把 13 条最终目标，映射到：

1. 当前代码证据
2. 还需要的真实环境证据
3. 对应截图编号

截图编号以 [deposit-screenshot-list.md](/Users/lishuangshuang/Desktop/闲鱼Agent/XianyuAgentPro/docs/deposit-screenshot-list.md:1) 为准。

## 1. 订单页可以基于订单创建免押单

- 代码证据：
  - `electron/renderer/src/views/rental/OrderFulfillment.vue`
  - `electron/renderer/src/components/CreateDepositDrawer.vue`
- 当前状态：代码已覆盖
- 还缺证据：
  - 订单页创建入口与成功页截图
- 对应截图：
  - `3`
  - `4`
  - `5`

## 2. 创建免押单时，押金默认来自设备价值 purchase_cost，不使用订单押金

- 代码证据：
  - `electron/renderer/src/components/CreateDepositDrawer.vue`
  - `electron/renderer/src/services/deviceLookupService.js`
- 当前状态：代码已覆盖
- 还缺证据：
  - 创建前表单中押金来源截图
- 对应截图：
  - `3`

## 3. 创建成功后生成规范的支付宝免押审核图片

- 代码证据：
  - `electron/renderer/src/utils/depositPosterCanvas.js`
  - `electron/renderer/src/components/CreateDepositDrawer.vue`
  - `electron/renderer/src/views/rental/OrderFulfillment.vue`
  - `electron/renderer/src/views/rental/DepositManagement.vue`
- 当前状态：代码已覆盖
- 还缺证据：
  - 创建成功海报预览
  - 导出的 PNG
  - 二维码失败兜底图
- 对应截图：
  - `31`
  - `32`
  - `35`

## 4. 设置页可以配置免押接口参数、userEid、notify_url、海报文案、联系电话、工作时间

- 代码证据：
  - `electron/renderer/src/views/Settings.vue`
  - `electron/renderer/src/services/depositSettingsService.js`
- 当前状态：代码已覆盖
- 还缺证据：
  - 设置页保存截图
  - 恢复默认截图
- 对应截图：
  - `1`
  - `2`
  - `3`

## 5. mock 模式保持可用，用于本地测试和演示

- 代码证据：
  - `electron/renderer/src/services/depositMockService.js`
  - `electron/renderer/src/services/depositApiService.js`
  - `electron/renderer/src/views/rental/DepositManagement.vue`
- 当前状态：代码已覆盖
- 还缺证据：
  - mock 创建
  - mock 管理页操作
  - mock 批量操作
- 对应截图：
  - `3` 到 `9`

## 6. real 模式必须通过 Electron main process 代理请求真实接口，renderer 不允许直接 fetch

- 代码证据：
  - `electron/main/depositClient.js`
  - `electron/main/ipcHandlers.js`
  - `electron/preload/preload.js`
  - `electron/renderer/src/services/depositApiService.js`
- 当前状态：代码已覆盖
- 已有静态证据：
  - renderer 免押相关文件无 `fetch(`
- 还缺证据：
  - real 创建与详情链路截图
- 对应截图：
  - `10`
  - `12`
  - `15`

## 7. 真实创建接口能拿到真实 orderNo 和 qr_code_url

- 代码证据：
  - `electron/main/depositClient.js`
  - `electron/renderer/src/services/depositApiService.js`
- 当前状态：待真实环境验证
- 还缺证据：
  - real 创建成功截图
  - real 创建失败截图
- 对应截图：
  - `10`
  - `11`

## 8. 详情接口能补充 scheme_url 和 deposit_status

- 代码证据：
  - `electron/main/depositClient.js`
  - `electron/renderer/src/services/depositApiService.js`
  - `electron/renderer/src/views/rental/DepositManagement.vue`
  - `electron/renderer/src/views/rental/OrderFulfillment.vue`
- 当前状态：待真实环境验证
- 还缺证据：
  - real 列表直接复制邀约
  - real 详情 Drawer
  - `deposit_farther` 恢复关联字段
- 对应截图：
  - `13`
  - `14`
  - `15`
  - `16`

## 9. 免押管理页可以查看免押单、查看详情、复制链接、保存海报、取消、完结

- 代码证据：
  - `electron/renderer/src/views/rental/DepositManagement.vue`
- 当前状态：代码已覆盖
- 说明：
  - mock 下支持取消/完结
  - real 下支持查看/详情/复制/海报/完结
  - real 取消无接口，已按能力边界禁用
- 还缺证据：
  - mock 操作截图
  - real 列表与详情截图
- 对应截图：
  - `6` 到 `9`
  - `12` 到 `17`

## 10. 后续免押管理页支持新建免押单、删除、批量取消、批量完结、批量删除

- 代码证据：
  - `electron/renderer/src/views/rental/DepositManagement.vue`
  - `electron/renderer/src/services/depositMockService.js`
- 当前状态：代码已覆盖
- 说明：
  - real 删除/取消/批量删除/批量取消无接口，已禁用
- 还缺证据：
  - mock 手动新建和批量操作截图
  - real 模式无对应按钮截图
- 对应截图：
  - `6`
  - `8`
  - `17`

## 11. 订单完结时，可以联动完结该订单对应的最新有效免押单

- 代码证据：
  - `electron/renderer/src/views/rental/OrderFulfillment.vue`
  - `electron/renderer/src/services/depositApiService.js`
- 当前状态：代码已覆盖，待真实环境验证
- 说明：
  - 只联动成功归还的订单
  - 同订单多单时优先 `isLatest`，再按创建时间
  - 关联查找兼容 `order.id` / `order.order_no`
- 还缺证据：
  - 单条联动截图
  - 批量联动截图
  - 部分失败时不误联动截图
- 对应截图：
  - `18` 到 `25`

## 12. 飞书通知可以在免押审核状态变化时提醒我

- 代码证据：
  - `electron/main/depositNotifyServer.js`
  - `electron/main/ipcHandlers.js`
  - `python/services/notification_service.py`
- 当前状态：待真实环境验证
- 说明：
  - 有本地回调接收器
  - 有详情同步
  - 有飞书去重
- 还缺证据：
  - 回调状态更新截图
  - 飞书提醒截图
  - 同状态不重复提醒截图
- 对应截图：
  - `26` 到 `31`

## 13. 整个流程不能破坏订单履约、顺丰寄件、设备管理、档期、报表、设置页已有功能

- 代码证据：
  - 当前改动集中于免押相关文件
  - 已多次执行 `npm run build:renderer`
- 当前状态：代码侧已尽量隔离，待人工回归验证
- 还缺证据：
  - 订单履约
  - 顺丰寄件
  - 设备管理
  - 档期 / 报表
  - 设置页其他区域
- 对应截图：
  - `37`
  - `38`
  - `39`
  - `40`
  - `41`

## 当前结论

- 代码侧已经接近收口。
- 剩余未闭环的部分，主要不是“继续开发”，而是“补齐真实环境证据”。
- 你联调时最关键的截图段落：
  - `10` 到 `17`
  - `18` 到 `25`
  - `26` 到 `31`
  - `37` 到 `41`
