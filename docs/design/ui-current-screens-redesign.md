# 闲鱼助手 Pro 当前截图 UI 改造说明

文件路径：`docs/design/ui-current-screens-redesign.md`

> 本文档基于当前系统截图制定，是第一阶段 UI 重构的具体执行说明。所有组件、颜色、间距和交互原则应遵循 `docs/design/ui-redesign-template.md`。如果本文档与总纲冲突，以本文档为准。

适用页面：

- 控制台
- 订单履约
- 订单详情
- 顺丰寄件
- 全局 Sidebar / Topbar

---

## 1. 当前问题总结

当前系统已经具备基础后台形态，但存在以下问题：

1. 页面过度使用浅色渐变和柔和阴影，专业桌面工具感不足。
2. Dashboard 指标较多，但缺少“今天该处理什么”的行动优先级。
3. 订单页使用大卡片列表，信息密度不足，桌面端效率不高。
4. 订单详情使用大 Modal，打断上下文，应该改为右侧 Drawer。
5. 顺丰寄件页面流程清楚，但 Hero、Stepper、表单卡片占用空间过大。
6. 顶部 Agent 状态按钮视觉权重偏高。
7. 删除等危险操作在列表中过于暴露。
8. 页面间组件样式相似但不完全统一。

本次改造目标不是重做业务逻辑，而是统一视觉系统、压缩视觉噪音、提升桌面端操作效率。

---

## 2. 全局视觉调整

### 2.1 背景

将主内容背景统一为：

```css
--bg-app: #f7f8fa;
--bg-surface: #ffffff;
--bg-subtle: #f3f4f6;
--border-subtle: #e5e7eb;
```

禁止在普通页面大面积使用淡绿、淡蓝、彩色渐变背景。

允许在少数页面头部使用极轻微 tint，但不应超过页面高度的 120px。

### 2.2 卡片

统一卡片样式：

```css
.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}
```

不要使用厚重阴影。  
不要使用彩色边框作为默认卡片样式。  
选中态可以使用浅青绿色背景和 1px 主色边框。

### 2.3 页面 Header

当前每个页面的 Hero 区偏大，需要收敛。

统一为：

```text
PageHeader
├── Breadcrumb
├── Title + Icon
├── Description
└── Actions
```

高度控制在 104px - 132px。  
不要让 PageHeader 占据过多首屏空间。

---

## 3. 顶部栏调整

### 3.1 Topbar 高度

保持 56px。

### 3.2 左侧

显示：

```text
当前一级模块 / 当前页面
```

例如：

```text
经营管理 / 订单履约
```

### 3.3 搜索框

保持当前 Ctrl K 设计，但宽度控制为 320px - 360px。

placeholder：

```text
搜索订单、客户、设备、操作...
```

### 3.4 右侧状态区

当前：

```text
[刷新] [机器人已停止] [启动] [通知]
```

调整为：

```text
[刷新] [Agent 已停止] [启动] [通知]
```

规范：

- Agent 状态使用 Badge 样式，不使用大按钮样式。
- 启动按钮使用 32px 高度。
- 状态 Badge 颜色：
  - 运行中：绿色
  - 已停止：橙色
  - 异常：红色
  - 同步中：蓝色

---

## 4. Sidebar 调整

### 4.1 宽度

当前 Sidebar 可保留 260px 左右，但建议统一为 248px。

### 4.2 Logo 区

保留当前品牌卡片，但降低阴影和渐变。

建议：

```text
[头像] 闲鱼助手 Pro
       租赁履约与会话工作台
```

Logo 卡片高度控制在 72px。

### 4.3 导航重组

导航应按用户工作流重组：

```text
工作台
- 控制台
- 待办总览

订单与履约
- 订单履约
- 顺丰寄件
- 设备管理
- 租赁档期
- 租赁定价

Agent 自动化
- 人工接管
- 消息审批
- 学习审核
- 自动回复规则
- 知识库

数据与运营
- 询单分析
- 商品型号绑定
- 报表中心
- 市场监控

系统
- 设置
- 日志监控
```

如果暂时没有对应页面，可以保留但置灰，或先隐藏未完成模块。

### 4.4 Active 状态

当前 active 背景偏重。调整为：

```css
.nav-item.active {
  background: rgba(20, 184, 166, 0.10);
  color: #0f766e;
  border-left: 3px solid #14b8a6;
}
```

不要给所有 nav item 使用强边框。

---

## 5. 控制台页面改造

### 5.1 页面目标

控制台只回答一个问题：

```text
今天最需要处理什么？
```

### 5.2 推荐结构

```text
ControlDashboardPage
├── PageHeader
├── TodayActionPanel
├── CoreMetricGrid
├── SystemHealthAndLogs
└── RecentTasks
```

### 5.3 第一屏优先级

把当前 8 个指标卡片调整为：

第一行：今日待办行动

```text
待接管会话
待发货订单
待审核学习
机器人异常
```

第二行：业务指标

```text
进行中订单
今日自动回复
建单转化
在用档期
```

### 5.4 指标卡片规范

每个指标卡：

```text
标题
主数字
解释文案
趋势 / 状态
```

示例：

```text
待发货订单
93
需要今天处理的寄件任务
```

不要只显示数字，要解释这个数字代表什么。

### 5.5 系统自检

当前系统自检区域可以保留，但压缩高度。

空状态文案改为：

```text
尚未运行系统自检
检查 API Key、Cookies、飞书、顺丰与 Agent 配置。
```

按钮：

```text
运行自检
```

### 5.6 实时日志

实时日志目前深色区域可以保留，但外层白色卡片和内部深色日志面板之间留白过多，应压缩。

建议日志列表高度 280px，并支持：

- 全部
- 信息
- 警告
- 错误
- 搜索
- 复制
- 清空

---

## 6. 订单履约页面改造

### 6.1 页面目标

订单履约页是高频操作页，必须优先效率。

当前卡片式订单列表需要改为更接近表格的结构。

### 6.2 推荐结构

```text
OrderFulfillmentPage
├── PageHeader
├── OrderStatusSummary
├── OrderFilterBar
├── OrderBulkActionBar
└── OrderTable
```

### 6.3 顶部指标

保留当前 5 个指标：

- 全部订单
- 待发货
- 进行中
- 待归还
- 已结束

但卡片高度从当前约 132px 降低到 96px。

### 6.4 筛选区

当前筛选区可保留，但减少高度。

布局：

```text
[全部] [待发货] [进行中] [待归还] [已结束]                [任务中心]

型号编码       订单状态       店铺          开始日期       结束日期       关键词
[Select]       [Select]       [Select]      [Date]         [Date]         [Input]

[筛选] [重置]
```

### 6.5 订单列表改为表格

替换当前大卡片列表，改为表格：

列：

```text
选择
订单号
客户
设备
店铺
租期
履约状态
金额
物流状态
操作
```

行高：56px。  
不要每条订单占用 120px 以上。

### 6.6 操作列

每行只显示两个主操作：

```text
[详情] [寄件] [...]
```

更多菜单中放：

- 延期
- 完结
- 删除
- 复制订单号

删除必须放入更多菜单，并二次确认。

### 6.7 选中行

点击行打开右侧 Drawer，不要默认打开大 Modal。

---

## 7. 订单详情改造

### 7.1 禁用大 Modal

当前订单详情 Modal 需要改为右侧 Drawer。

Modal 只用于：

- 删除确认
- 简短确认
- 小型表单

复杂详情页必须使用 Drawer。

### 7.2 Drawer 规格

```css
.order-detail-drawer {
  width: 640px;
  max-width: calc(100vw - 280px);
}
```

小窗口下宽度为 100%。

### 7.3 Drawer 结构

```text
DrawerHeader
├── 订单号
├── 状态 Badge
└── 操作按钮

DrawerBody
├── 订单摘要
├── 客户与收货信息
├── 设备与租期
├── 物流处理
├── 金额信息
└── 物流时间线

DrawerFooter
├── 关闭
├── 保存
└── 主要动作
```

### 7.4 操作按钮

Header 中只放高频操作：

```text
[顺丰寄件] [延期] [...]
```

删除放入更多菜单。

### 7.5 信息展示

订单摘要采用紧凑 Description Grid：

```text
店铺      小狗相机
型号      acepro2
设备      acepro2-07
租期      2026-05-15 ~ 2026-05-19
金额      88.46
押金      0
```

---

## 8. 顺丰寄件页面改造

### 8.1 页面目标

让用户快速完成：

```text
识别地址 → 确认信息 → 选择服务 → 下单
```

### 8.2 推荐布局

```text
SFShippingPage
├── PageHeader
├── Stepper
└── TwoColumnFormLayout
    ├── MainForm
    └── SummaryPanel
```

### 8.3 PageHeader

当前顺丰寄件的 Header 高度过大，压缩到 112px。

按钮只保留：

```text
刷新
```

### 8.4 Stepper

当前 Stepper 视觉太宽。改为紧凑样式：

```text
1 填地址 ─ 2 选服务 ─ 3 确认下单
```

高度：48px。

### 8.5 地址识别区域

当前 textarea 太高。调整为：

- 默认高度：96px
- 支持展开
- 识别按钮放在 textarea 下方左侧

文案：

```text
粘贴完整收货信息，系统会自动识别姓名、手机号、省市区和详细地址。
```

### 8.6 寄件人 / 收件人

改为两列卡片，但压缩高度。

输入框高度 36px。

收件人卡片中：

```text
姓名
手机号
省 / 市 / 区
详细地址
```

如果地址不完整，卡片顶部显示警告：

```text
收件人信息不完整，无法进入下一步。
```

### 8.7 右侧摘要栏

新增右侧固定摘要栏，宽度 320px。

内容：

```text
寄件摘要
- 当前步骤
- 地址完整度
- 取件时间
- 服务类型
- 预计费用

[下一步]
```

这样“下一步”按钮始终在用户视线内。

### 8.8 底部操作

取消当前卡片底部很远的下一步按钮。  
主操作放到右侧摘要栏底部。

---

## 9. 组件统一要求

### 9.1 Button

统一高度：

- sm：28px
- md：32px
- lg：36px

页面内常用 md，不要大量使用高按钮。

### 9.2 Badge

所有状态都使用统一 Badge。

状态映射：

```ts
const statusToneMap = {
  running: 'success',
  stopped: 'warning',
  error: 'danger',
  pending: 'warning',
  completed: 'success',
  draft: 'neutral',
  processing: 'info'
}
```

### 9.3 Card

卡片标题区统一：

```text
标题
说明文字
右侧操作
```

不要每个页面重新写一套卡片头。

### 9.4 Table

建立统一 `BaseTable`，支持：

- loading
- empty
- row hover
- row selected
- pagination
- column action
- bulk selection

### 9.5 Drawer

建立统一 `BaseDrawer`，用于：

- 订单详情
- 物流处理
- 自动回复规则编辑
- 知识库编辑
- 询价详情

---

## 10. Claude Code 实施顺序

### 第一阶段

1. 新增或整理 `src/styles/tokens.css`
2. 收敛全局背景、卡片、按钮、Badge 样式
3. 调整 Topbar 状态区
4. 调整 Sidebar active 和导航分组

### 第二阶段

1. 重构控制台页面
2. 将 8 个指标改为“今日行动 + 业务指标”
3. 压缩系统自检与实时日志区域
4. 保持现有数据来源不变

### 第三阶段

1. 重构订单履约页面
2. 将订单卡片列表改为表格
3. 建立批量操作栏
4. 每行只保留 2 个主操作，其余进更多菜单

### 第四阶段

1. 将订单详情 Modal 改为 Drawer
2. 重组订单详情信息层级
3. 删除操作移入更多菜单并二次确认

### 第五阶段

1. 重构顺丰寄件页面
2. 压缩 Header 和 Stepper
3. 新增右侧摘要栏
4. 让下一步按钮固定在摘要栏底部

---

## 11. 禁止事项

Claude Code 不允许：

1. 修改现有业务逻辑。
2. 修改数据库结构。
3. 修改 Electron 主进程。
4. 修改 IPC 协议。
5. 引入大型 UI 框架。
6. 使用大面积渐变。
7. 使用过强阴影。
8. 把桌面端表格继续做成低密度大卡片流。
9. 在列表中直接暴露红色删除按钮。
10. 使用 Modal 承载复杂详情页面。
11. 隐藏 Agent 状态、订单状态、物流状态等关键状态。
12. 删除现有功能入口，除非只是重组导航。

---

## 12. 给 Claude Code 的执行提示词

```text
请先阅读以下两个文档：

1. docs/design/ui-redesign-template.md
2. docs/design/ui-current-screens-redesign.md

其中：
- ui-redesign-template.md 是长期设计系统总纲。
- ui-current-screens-redesign.md 是当前截图版本的具体改造任务书。
- 如果两个文档存在冲突，以 ui-current-screens-redesign.md 为准。

请基于当前 Electron + Vue 项目实现第一阶段 UI 重构：

1. 统一 tokens.css、卡片、按钮、Badge、表格、Drawer 基础样式。
2. 调整 Sidebar 分组、active 状态和视觉权重。
3. 调整 Topbar 中 Agent 状态和启动按钮。
4. 重构控制台，使其从指标墙变成“今日待办工作台”。
5. 重构订单履约页，将卡片列表改为桌面端表格。
6. 将订单详情大 Modal 改为右侧 Drawer。
7. 重构顺丰寄件页，压缩 Header / Stepper，并增加右侧摘要栏。

注意：
- 不要修改业务逻辑、数据库结构、Electron 主进程或 IPC 协议。
- 不要引入 Ant Design Vue、Element Plus、Vuetify 或大型 Admin 模板。
- 不要大面积使用渐变、强阴影或花哨动效。
- 每次修改后说明改了哪些文件、为什么这样改、是否影响业务逻辑。
```
