# 闲鱼Agent UI Redesign Template

文件路径：`docs/design/ui-redesign-template.md`

> 本文档是闲鱼助手 Pro / 闲鱼Agent 的长期 UI 设计系统规范。具体页面改造任务以 `docs/design/ui-current-screens-redesign.md` 为准；如两者冲突，当前截图改造文档优先。

适用项目：Electron + Vue 桌面端应用  
产品名：闲鱼Agent / 闲鱼助手 Pro  
设计目标：专业、可信、清爽、高效率，适合个人卖家、小团队运营、租赁业务运营人员长期使用。

---

## 1. 整体视觉风格

### 1.1 设计定位

闲鱼Agent 是一个面向闲鱼租赁运营场景的桌面工作台，不是官网 Landing Page，也不是娱乐化 App。UI 应该优先服务于：

- 快速处理租赁询价
- 管理订单履约与顺丰寄件
- 管理自动回复、人工接管、消息审批、学习审核
- 维护知识库和自动化规则
- 监控任务、日志和系统状态

### 1.2 关键词

- 专业
- 克制
- 清爽
- 高信息密度
- 可解释
- 可控
- 桌面工具感
- 后台系统感

### 1.3 风格参考

可参考 Linear、Raycast、Notion、Vercel Dashboard、飞书后台的气质。参考重点不是复制视觉，而是学习：

- 清晰的左侧导航
- 稳定的顶部栏
- 克制的色彩层级
- 高信息密度的列表和表格
- 清晰的当前状态
- 明确的操作反馈

### 1.4 禁止方向

不要做成：

- 学生作业风
- 大面积渐变背景
- 赛博朋克风
- 玻璃拟态泛滥
- 强烈霓虹色
- 过多 Emoji
- 卡片阴影过重
- 边框和分割线过多
- 页面首屏过度营销化
- 按钮颜色五颜六色

---

## 2. 色彩系统

使用 CSS Variables 统一维护颜色。

```css
:root {
  --bg-app: #f7f8fa;
  --bg-surface: #ffffff;
  --bg-subtle: #f3f4f6;
  --bg-muted: #eef0f3;

  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-tertiary: #6b7280;
  --text-disabled: #9ca3af;
  --text-inverse: #ffffff;

  --border-subtle: #e5e7eb;
  --border-default: #d1d5db;
  --border-strong: #9ca3af;

  --shadow-card: 0 1px 2px rgba(16, 24, 40, 0.04);
  --shadow-popover: 0 12px 32px rgba(16, 24, 40, 0.12);
}
```

### 2.1 品牌主色

建议使用低饱和青绿色作为主操作色。闲鱼黄色只作为轻量品牌点缀，不做大面积背景。

```css
:root {
  --color-primary: #0f766e;
  --color-primary-hover: #0d9488;
  --color-primary-active: #115e59;
  --color-primary-soft: rgba(20, 184, 166, 0.1);
  --color-primary-border: rgba(20, 184, 166, 0.24);

  --color-brand-accent: #facc15;
  --color-brand-accent-soft: #fef9c3;
}
```

### 2.2 状态色

```css
:root {
  --color-success: #16a34a;
  --color-success-soft: #f0fdf4;
  --color-success-border: #bbf7d0;

  --color-warning: #d97706;
  --color-warning-soft: #fffbeb;
  --color-warning-border: #fed7aa;

  --color-danger: #dc2626;
  --color-danger-soft: #fef2f2;
  --color-danger-border: #fecaca;

  --color-info: #2563eb;
  --color-info-soft: #eff6ff;
  --color-info-border: #bfdbfe;

  --color-neutral: #6b7280;
  --color-neutral-soft: #f3f4f6;
  --color-neutral-border: #e5e7eb;
}
```

### 2.3 使用规则

主色只用于：

- 主按钮
- 当前导航项
- 链接
- 当前选中的筛选条件
- 关键状态高亮

状态色只用于状态，不要滥用为装饰色。

---

## 3. 字体层级

### 3.1 字体族

```css
:root {
  --font-sans: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
}
```

### 3.2 字号规范

| 用途 | 字号 | 行高 | 字重 |
|---|---:|---:|---:|
| 页面大标题 | 24px | 32px | 600 |
| 页面标题 | 20px | 28px | 600 |
| 卡片标题 | 16px | 24px | 600 |
| 正文 | 14px | 22px | 400 |
| 表格文本 | 13px | 20px | 400 |
| 辅助说明 | 12px | 18px | 400 |
| 状态标签 | 12px | 16px | 500 |
| 数字指标 | 28px | 36px | 600 |

---

## 4. 间距系统

使用 4px 基础栅格。

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

### 4.1 推荐间距

- 主内容区 padding：24px
- 页面标题与内容间距：20px
- 卡片之间间距：16px
- 模块之间间距：24px
- 表格行高：44px - 56px
- 输入框高度：36px
- 按钮高度：28px / 32px / 36px

---

## 5. 页面布局结构

### 5.1 桌面端主框架

```text
┌──────────────────────────────────────────────┐
│ App Window                                    │
├───────────────┬──────────────────────────────┤
│ Sidebar       │ Topbar                       │
│ 248px         ├──────────────────────────────┤
│               │ Main Content                 │
└───────────────┴──────────────────────────────┘
```

```css
.app-shell {
  display: grid;
  grid-template-columns: 248px 1fr;
  height: 100vh;
  background: var(--bg-app);
}

.app-main {
  display: grid;
  grid-template-rows: 56px 1fr;
  min-width: 0;
}

.page-content {
  padding: 24px;
  overflow: auto;
  min-width: 0;
}
```

### 5.2 页面最大宽度

| 页面 | 最大宽度 |
|---|---:|
| 控制台 | none 或 1440px |
| 订单履约 | none |
| 顺丰寄件 | 1280px - 1440px |
| 自动回复 | 1280px |
| 知识库 | 1280px |
| 设置 | 960px |
| 日志监控 | none |

---

## 6. 左侧导航设计

### 6.1 Sidebar 尺寸

- 默认宽度：248px
- 收起宽度：64px
- 背景色：深色可保留，但需要降低噪音
- 内边距：12px

### 6.2 推荐导航分组

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

### 6.3 导航项规范

- 高度：36px
- 圆角：8px
- 左右 padding：10px
- 图标尺寸：16px
- 图标与文字间距：10px
- 字号：14px
- hover 背景：轻微加亮
- active 背景：低饱和主色透明背景
- active 左侧：3px 主色竖线

```css
.nav-item.active {
  background: rgba(20, 184, 166, 0.10);
  color: #0f766e;
  border-left: 3px solid #14b8a6;
}
```

---

## 7. 顶部栏设计

### 7.1 Topbar 尺寸

- 高度：56px
- 背景：`var(--bg-surface)`
- 下边框：`1px solid var(--border-subtle)`
- 左右 padding：16px

### 7.2 结构

```text
[折叠侧栏] [模块 / 页面] [全局搜索 Ctrl K]        [刷新] [Agent 状态] [启动/暂停] [通知]
```

### 7.3 搜索框

- 宽度：320px - 360px
- 高度：32px
- 圆角：8px
- placeholder：`搜索订单、客户、设备、操作...`
- 右侧显示快捷键：`Ctrl K`

### 7.4 Agent 状态

Agent 状态使用 Badge，不使用大按钮。

| 状态 | 色调 |
|---|---|
| 运行中 | success |
| 已停止 | warning |
| 异常 | danger |
| 同步中 | info |

---

## 8. Dashboard / 控制台设计

### 8.1 页面目标

控制台只回答一个核心问题：

> 今天最需要处理什么？

### 8.2 页面结构

```text
ControlDashboardPage
├── PageHeader
├── TodayActionPanel
├── CoreMetricGrid
├── SystemHealthAndLogs
└── RecentTasks
```

### 8.3 今日行动指标

第一行放待办行动：

- 待接管会话
- 待发货订单
- 待审核学习
- 机器人异常

第二行放业务指标：

- 进行中订单
- 今日自动回复
- 建单转化
- 在用档期

### 8.4 指标卡片

每张卡片必须包含：

```text
标题
主数字
解释文案
趋势 / 状态
```

不要只显示数字。

---

## 9. 租赁询价页面设计

### 9.1 页面目标

租赁询价页应该像运营 Inbox，重点是快速判断、筛选、处理和追踪。

### 9.2 推荐布局

```text
筛选栏 / 搜索 / 批量操作
├── 询价列表 320px
├── 对话与询价详情 1fr
└── 右侧信息面板 320px
```

### 9.3 询价列表项

每项展示：

- 买家昵称
- 商品标题
- 租期 / 报价 / 最近消息时间
- 状态标签

状态包括：

- 待回复
- 已自动回复
- 待人工确认
- 租期冲突
- 已成交
- 已关闭

### 9.4 回复输入区

底部固定回复框，支持：

- 引用知识库
- 生成回复
- 人工发送
- 保存备注
- Cmd/Ctrl + Enter 发送

---

## 10. 自动回复页面设计

### 10.1 页面目标

用户必须知道：

- 哪些规则正在运行
- 规则触发条件是什么
- 回复内容是什么
- 是否允许自动发送
- 最近表现如何

### 10.2 结构

```text
PageHeader
├── 规则概览
├── 规则列表
└── 规则编辑 Drawer
```

### 10.3 规则表格列

| 列 | 内容 |
|---|---|
| 规则名称 | 租期报价咨询自动回复 |
| 触发条件 | 关键词 / 商品分类 / 租期 |
| 动作 | 自动发送 / 草稿 / 转人工 |
| 状态 | 启用 / 暂停 / 异常 |
| 今日触发 | 数字 |
| 最后更新 | 时间 |
| 操作 | 编辑 / 测试 / 更多 |

---

## 11. 知识库页面设计

### 11.1 页面目标

知识库是 Agent 的依据来源，必须强调：

- 可维护
- 可搜索
- 可验证
- 可追踪质量

### 11.2 推荐布局

```text
PageHeader
├── 搜索与分类筛选
├── 左侧分类树
├── 中间知识条目列表
└── 右侧编辑 / 预览 Drawer
```

### 11.3 推荐分类

- 商品租赁规则
- 押金与赔付
- 发货与归还
- 价格与优惠
- 常见问题
- 风险话术
- 禁止自动回复场景

---

## 12. 设置页面设计

设置页采用左侧设置导航 + 右侧内容。

```text
账号连接
Agent 设置
自动化安全
通知设置
数据与缓存
关于
```

每个设置项统一结构：

```text
标题
说明文字
控件
```

复杂设置项需要解释影响，不允许只有开关没有说明。

---

## 13. 组件规范

### 13.1 Card

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}
```

卡片结构：

```text
Card
├── CardHeader
│   ├── Title
│   └── Description / Action
└── CardContent
```

### 13.2 Table

- 表头高度：40px
- 行高：48px - 56px
- 表头背景：`var(--bg-subtle)`
- 表头文字：12px / 500 / 灰色
- 单元格文字：13px
- 行 hover：`#f9fafb`
- 分割线：`1px solid var(--border-subtle)`

必须支持：loading、empty、pagination、sorting、filtering、row action、row selected。

### 13.3 Button

| 尺寸 | 高度 | Padding |
|---|---:|---:|
| sm | 28px | 8px 10px |
| md | 32px | 10px 12px |
| lg | 36px | 12px 16px |

类型：primary、secondary、ghost、danger、link。

### 13.4 Badge

- 高度：22px
- padding：2px 8px
- 字号：12px
- 字重：500
- 圆角：999px

状态：success、warning、danger、info、neutral。

### 13.5 Empty State

空状态必须说明：

1. 当前没有什么
2. 为什么没有
3. 下一步可以做什么

示例：

```text
暂无自动回复规则
创建第一条规则后，Agent 可以根据买家消息自动生成回复。
[新建规则]
```

### 13.6 Loading

- 页面首次加载：骨架屏
- 表格刷新：表格骨架行
- 按钮提交：按钮内 spinner
- 局部数据加载：小型 spinner + 文案

不要频繁全屏 loading。

### 13.7 Error State

错误态必须包含：

- 错误标题
- 简短说明
- 重试按钮
- 可选：查看日志

---

## 14. 交互细节

### 14.1 全局快捷键

| 快捷键 | 功能 |
|---|---|
| Cmd/Ctrl + K | 打开全局搜索 |
| Cmd/Ctrl + R | 刷新当前页 |
| Cmd/Ctrl + , | 打开设置 |
| Cmd/Ctrl + Enter | 发送回复 |
| Esc | 关闭弹窗 / 抽屉 |
| ↑ ↓ | 列表中切换选中项 |

### 14.2 自动化可解释性

自动回复相关页面必须展示：

- 为什么触发
- 命中了什么规则
- 使用了哪条知识库
- 置信度是多少
- 是否命中风险条件
- 为什么转人工

---

## 15. 动效建议

```css
:root {
  --duration-fast: 100ms;
  --duration-normal: 160ms;
  --duration-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

推荐：按钮 hover、卡片 hover、抽屉进入、Toast 出现、Skeleton 轻微 shimmer。

禁止：复杂 3D、粒子、霓虹、强弹跳、大面积流动背景。

---

## 16. 小窗口适配

断点：

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

小于 1024px：

- Sidebar 收起为 64px
- Dashboard 指标 4 列变 2 列
- 三栏页面变两栏
- 右侧详情变 Drawer

小于 768px：

- Sidebar 可隐藏
- 顶部显示菜单按钮
- 表格横向滚动
- Dashboard 指标变 1 列

Electron 最小窗口建议：

```ts
minWidth: 960
minHeight: 640
```

---

## 17. Vue 组件拆分建议

```text
src/
├── components/
│   ├── app/
│   │   ├── AppShell.vue
│   │   ├── AppSidebar.vue
│   │   ├── AppTopbar.vue
│   │   └── CommandPalette.vue
│   ├── ui/
│   │   ├── BaseButton.vue
│   │   ├── BaseCard.vue
│   │   ├── BaseBadge.vue
│   │   ├── BaseInput.vue
│   │   ├── BaseSelect.vue
│   │   ├── BaseTable.vue
│   │   ├── BaseEmpty.vue
│   │   ├── BaseSkeleton.vue
│   │   ├── BaseDialog.vue
│   │   ├── BaseDrawer.vue
│   │   └── BaseToast.vue
│   ├── dashboard/
│   ├── inquiries/
│   ├── orders/
│   ├── shipping/
│   ├── auto-reply/
│   ├── knowledge-base/
│   └── settings/
├── pages/
├── styles/
│   ├── tokens.css
│   ├── base.css
│   └── utilities.css
└── stores/
```

页面组件只负责拉取数据、组织布局、处理页面级事件，不要把复杂表格、表单、抽屉逻辑全部写在页面组件里。

---

## 18. 实现优先级

### P0

1. 建立 `tokens.css`
2. 重构 AppShell
3. 重构 Sidebar
4. 重构 Topbar
5. 建立基础组件：BaseButton、BaseCard、BaseBadge、BaseInput、BaseTable、BaseEmpty、BaseSkeleton、BaseDrawer
6. 重做控制台页面
7. 重做订单履约基础布局

### P1

1. 自动回复规则列表
2. 自动回复规则编辑 Drawer
3. 知识库列表与编辑页
4. 设置页分组
5. 全局搜索
6. Toast 与 Dialog 统一

### P2

1. 命令面板
2. 快捷键体系
3. 图表优化
4. 日志监控页面
5. 小窗口适配完善
6. 暗色模式

---

## 19. 不允许 Claude Code 做的事情

Claude Code 不允许：

1. 修改 Electron 主进程逻辑。
2. 修改闲鱼登录逻辑。
3. 修改消息同步逻辑。
4. 修改自动回复核心逻辑。
5. 修改数据库 schema。
6. 修改 IPC 通信协议。
7. 引入 Ant Design Vue、Element Plus、Vuetify 或大型 Admin 模板。
8. 使用大面积渐变背景。
9. 使用过强阴影。
10. 牺牲桌面端信息密度。
11. 隐藏 Agent 状态、订单状态、物流状态等关键状态。
12. 无解释地执行自动化行为。
13. 只改颜色不改结构。

---

## 20. Claude Code 实施提示词

```text
请根据 docs/design/ui-redesign-template.md 和 docs/design/ui-current-screens-redesign.md 对当前 Electron + Vue 项目进行 UI/UX 重构。

其中：
- ui-redesign-template.md 是全局设计系统规范，不能违背。
- ui-current-screens-redesign.md 是当前截图版本的具体执行任务，优先级更高。
- 如果两个文档有冲突，以 ui-current-screens-redesign.md 为准。

目标：
1. 建立统一设计 token。
2. 重构 AppShell、Sidebar、Topbar。
3. 建立基础 UI 组件。
4. 优先重做控制台、订单履约、订单详情、顺丰寄件页面。
5. 保持现有业务逻辑、数据结构、IPC 和 API 不变。
6. 不引入 Ant Design Vue、Element Plus、Vuetify 或大型 Admin 模板。
7. 页面风格要专业、清爽、桌面工具化。

请先扫描项目结构，识别现有页面和组件，再分阶段改造。
每次修改后说明：
- 改了哪些文件
- 为什么这样改
- 是否影响业务逻辑
- 后续建议
```
