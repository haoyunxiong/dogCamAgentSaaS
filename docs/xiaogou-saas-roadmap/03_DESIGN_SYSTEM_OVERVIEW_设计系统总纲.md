# 03 设计系统总纲

## 设计目标

从“内部工具感”升级为“可售卖的 B 端 SaaS 产品感”。

关键词：

```text
专业、可信、克制、清爽、高效、数据化、SaaS 感
```

## 小狗 IP 使用原则

- 可以用于 logo、登录页、空状态、引导提示。
- 不要让核心业务页面过度卡通化。
- 后台页面要专业、克制，不做消费级萌系 App。

## 色彩建议

| 类型 | 建议 |
|---|---|
| Primary | 深青绿色，用于主按钮、当前状态、品牌强调 |
| Success | 绿色，用于已完成、已通过、正常 |
| Info | 蓝色，用于发货、物流、信息提示 |
| Warning | 橙色，用于待归还、即将逾期、余量不足 |
| Danger | 红色，用于逾期、拒绝、异常 |
| Background | 浅灰，用于页面背景 |
| Surface | 白色，用于卡片和容器 |
| Border | 浅灰边框，减少重阴影 |

## 组件必须统一

```text
Button
StatusBadge
MetricCard
OrderCard
DeviceCard
ScheduleBlock
FilterChip
Tabs
BottomNav
SideNav
Drawer
BottomSheet
Modal
FormInput
EmptyState
AlertRow
```

## 手机端与 PC 端分工

手机端：快速处理任务，不做复杂大表格。

PC 端：完整管理后台，承载批量操作、复杂筛选、报表和设置。
