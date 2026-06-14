# Phase 02：设计系统与 Figma 基础组件

## 阶段目标

建立稳定 Design System 和 Figma 组件库，避免后续 UI 反复推翻。

## 2026-06-14 路线调整

Phase 02B Figma Design System 已完成并保留为设计资产和参考标准。

Phase 02C 真实系统 UI 改造暂停在 02C-02。已经完成的 Token、基础组件、App Shell、Sidebar、Topbar 初步改造保留为阶段产物，但不继续推进旧系统业务页面改造。

后续新增 `Phase UI-V2 Demo`：先在独立 Demo 中验证未来 PC + Mobile 产品体验，再决定如何迁移旧系统能力。

当前不继续：

- 不继续 Phase 02C-03 订单中心真实系统改造。
- 不继续在 `electron/renderer/src/views` 上做页面重构。
- 不改 Electron main / preload / IPC。
- 不改 Python backend。
- 不改数据库 schema。
- 不接真实 MySQL。
- 不提交 Git，除非用户明确要求。

## 本阶段 Codex 做什么

- 通过 Figma MCP 创建设计系统
- 创建颜色变量/字体样式/组件
- 创建移动端核心页面初稿
- 创建 PC 端后台基础框架
- 输出设计验收报告

## 本阶段你做什么

- 提供参考产品
- 确认主色和品牌风格
- 审核 Figma 初稿
- 确认以后不大幅换风格

## 本阶段交付物

- Figma 设计系统
- 组件库
- 移动端核心页面初稿
- PC 端框架初稿

## 阶段产物状态

- Phase 02A Product Design：已完成，checkpoint `04f65c9`。
- Phase 02B Figma Design System：已完成并保留。
- Phase 02C 真实系统 UI 改造：暂停在 02C-02。
- Phase UI-V2 Demo：新增为下一步路线。

## 进入下一阶段条件

- 颜色/字体/组件确认
- 订单卡和档期块确认
- 移动端工作台初稿确认
- Figma 文件可编辑
- 设计系统可复用

## 执行原则

- 先计划，后执行。
- 不跨阶段。
- 不破坏现有可用流程。
- 结果写入本阶段 `artifacts/`。
