# Phase UI-V2 Demo 需求

## 功能范围

Demo 需要覆盖：

- PC 端工作台
- PC 端订单中心
- PC 端档期中心
- PC 端设备中心
- PC 端设置中心
- Mobile 工作台
- Mobile 订单
- Mobile 档期
- Mobile 设备
- Mobile 我的 / 商家中心

## 数据要求

- 只使用 mock 数据。
- mock 数据应覆盖订单、档期、设备、物流、免押/押金、异常、逾期、待处理状态。
- 不读取旧系统数据库。
- 不请求真实 API。
- 不接 MySQL。

## 技术边界

- Demo 位于 `prototypes/ui-v2-demo`。
- 可使用 Vue / Vite 创建独立前端 Demo。
- 不接 Electron。
- 不接 Python backend。
- 不复用旧系统路由或业务页面。
- 不修改旧系统业务代码。

## 体验要求

- PC 端应体现完整管理后台的信息密度和批量处理能力。
- Mobile 端应体现移动运营工作台的快速判断和快速处理能力。
- 核心状态要清晰：待处理、待发货、进行中、待归还、逾期、异常、已完成。
- 视觉风格应专业、可信、克制、清爽、高效、数据化、SaaS 感。
