# 02 系统总架构

## 三层发展结构

### 第一层：商户内部运营系统

解决一个商户内部的效率问题：订单、档期、设备、物流、免押、客户、员工、报表。

### 第二层：多商户 SaaS 系统

解决多个商户同时使用的问题：登录、商户、门店、员工、权限、数据隔离、套餐、初始化。

### 第三层：商户协作网络

解决商户之间的供需撮合问题：调货、代发、可供设备、二手交易、信用、结算、纠纷。

## 手机端导航建议

```text
工作台
订单
档期
设备
我的
```

手机端定位是移动工作台，重点处理高频轻操作。

## PC 端导航建议

```text
工作台
询单中心
订单中心
档期中心
设备中心
客户中心
免押管理
物流发货
财务结算
报表中心
设置中心
```

未来再加：

```text
商户协作
调货大厅
代发中心
二手设备市场
```

## 核心数据对象

```text
User 用户
Merchant 商户
Store 门店
Warehouse 仓库
Staff 员工
Role 角色
Permission 权限
Channel 渠道
Customer 客户
Inquiry 询单
Quote 报价/档期回复
DeviceModel 设备型号
DeviceUnit 单台设备
Accessory 配件
Schedule 档期
Order 订单
OrderItem 订单明细
Deposit 免押/押金
Shipment 物流
ReturnInspection 归还验机
Settlement 结算
FinanceRecord 财务流水
Report 报表
OperationLog 操作日志
SystemConfig 系统配置
```

## 关键字段预留

每个核心业务表都应逐步预留：

```text
merchant_id
store_id
created_by
updated_by
created_at
updated_at
```
