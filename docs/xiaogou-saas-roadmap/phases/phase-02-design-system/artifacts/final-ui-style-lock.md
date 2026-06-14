# Final UI Style Lock / 最终 UI 风格冻结

## 1. 产品定位

产品统一定位为：

> 面向租赁商家的运营提效与经营管理系统。

当前不再以“小狗相机”或“闲鱼助手”为产品核心。可暂用中性命名：

- 租赁商家运营系统
- 租赁商家运营平台
- 商户运营后台

## 2. 网页端风格冻结

网页端采用以下风格：

- 深色左侧导航；
- 白色/浅灰主内容区；
- 青绿色作为主品牌色；
- 表格、筛选、KPI、右侧 Drawer 作为核心布局语言；
- 高信息密度但可读；
- 重点信息通过深浅、状态色、卡片权重和选中态突出；
- 低优先级信息使用浅色文字、弱边框、弱背景处理；
- 右侧 Drawer 是详情与处理面板，不用大弹窗承载复杂业务。

### 网页端固定结构

```text
Sidebar
Topbar
KPI Cards
Status Tabs
Filter Bar
Main Table / Main Grid
Right Drawer
Bottom Bulk Actions / Pagination
```

## 3. 手机端风格冻结

手机端不是 PC 缩小版。

手机端定位：

> 移动运营工作台，用于高频、紧急、轻量处理。

底部导航固定为：

```text
工作台 / 订单 / 档期 / 设备 / 我的
```

手机端原则：

- 首屏只放最关键和最常用内容；
- 低频功能放到“我的 / 更多工具 / 快捷操作”；
- 列表使用卡片，不使用 PC 表格；
- 详情页使用分组卡片 + 底部固定操作；
- 重要操作必须单一突出，危险操作收进更多操作。

## 4. 颜色方向

建议前端 token：

```css
--color-primary-900: #06211f;
--color-primary-800: #07312d;
--color-primary-700: #06443d;
--color-primary-600: #007f6d;
--color-primary-500: #00a889;
--color-primary-100: #e8f7f3;

--color-bg-page: #f6f8fa;
--color-bg-surface: #ffffff;
--color-border-subtle: #e7edf2;
--color-text-primary: #101828;
--color-text-secondary: #667085;
--color-text-tertiary: #98a2b3;

--color-warning: #f59e0b;
--color-danger: #ef4444;
--color-info: #3b82f6;
--color-success: #10b981;
```

## 5. 组件风格

核心组件必须统一：

- BaseButton
- BaseCard
- BaseBadge / StatusTag
- BaseInput
- BaseSelect
- BaseFilterBar
- BaseTable
- BaseDrawer
- BaseBottomSheet
- BaseMetricCard
- BaseEmpty / Loading / Error

## 6. 不允许事项

- 不再回到蓝色普通后台模板风；
- 不使用大面积玻璃拟态；
- 不使用重阴影；
- 不把闲鱼作为主产品架构；
- 不把手机端做成 PC 缩小版；
- 不在 UI 阶段修改业务逻辑、数据库、IPC、Python。
