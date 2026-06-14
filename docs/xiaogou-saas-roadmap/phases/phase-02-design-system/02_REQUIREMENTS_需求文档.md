# Phase 02 需求文档：设计系统与 Figma 基础组件

## 业务背景

本项目当前正在从内部租赁助手升级为租赁商户运营标准化系统。本阶段用于完成：建立稳定 Design System 和 Figma 组件库，避免后续 UI 反复推翻。

## 功能需求

- 通过 Figma MCP 创建设计系统
- 创建颜色变量/字体样式/组件
- 创建移动端核心页面初稿
- 创建 PC 端后台基础框架
- 输出设计验收报告

## 路线调整需求：UI-V2 Demo

由于最终产品的整体视觉风格和交互结构尚未确认，暂停继续在旧系统页面上做 UI 改造。

新增需求：

- 保留 Phase 02B Figma Design System 作为设计资产。
- Phase 02C 真实系统 UI 改造暂停在 02C-02。
- 不继续改造旧系统订单中心等真实业务页面。
- 新增独立 `Phase UI-V2 Demo`。
- 在 `prototypes/ui-v2-demo` 中验证未来 PC + Mobile 产品体验。
- Demo 只使用 mock 数据，不接 Electron、不接真实 API、不接数据库、不接旧系统业务逻辑。
- Demo 定稿后，再规划旧系统业务能力迁移。

## 用户侧需求

- 提供参考产品
- 确认主色和品牌风格
- 审核 Figma 初稿
- 确认以后不大幅换风格

## 输出要求

- Figma 设计系统
- 组件库
- 移动端核心页面初稿
- PC 端框架初稿

路线调整后的新增输出：

- UI-V2 Demo 阶段说明文档
- UI-V2 Product Design 方案
- UI-V2 Demo 页面范围
- UI-V2 Demo mock 数据范围
- Demo 评审标准

## 约束

- 必须遵循 AGENTS.md。
- 必须遵循当前阶段状态。
- 必须先计划再执行。
