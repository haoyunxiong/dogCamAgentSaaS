# Phase UI-V2 Demo：新产品体验独立验证

## 阶段定位

本阶段用于在独立 Demo 中验证“小狗相机助手商户版”的未来 PC + Mobile 产品体验。

它不是旧系统 UI 改造，不接旧系统功能，不接数据库，不接 Electron，不接真实 API。

## 背景

Phase 02B Figma Design System 已完成并保留为设计资产。Phase 02C-01 / 02C-02 已经在真实系统中完成 Token、基础组件、App Shell、Sidebar、Topbar 的初步改造。

但当前整体视觉风格和交互结构尚未最终确认。继续在旧系统页面上改造，容易被旧页面结构、旧业务逻辑和旧布局限制。

因此新增本阶段：先独立验证新产品体验，再决定如何迁移旧系统能力。

## 阶段目标

- 重新规划 PC + Mobile 的租赁 SaaS 产品体验。
- 在 `prototypes/ui-v2-demo` 中创建独立 Demo。
- 使用 mock 数据验证视觉风格、信息架构和核心交互。
- 不接入旧系统功能、Electron、数据库或真实 API。
- Demo 评审通过后，再规划旧系统业务能力迁移。

## 当前不做

- 不继续改造真实业务页面。
- 不继续 Phase 02C-03 订单中心真实系统改造。
- 不修改 `electron/renderer/src/views`。
- 不修改 Electron main / preload / IPC。
- 不修改 Python backend。
- 不修改数据库 schema。
- 不接真实 MySQL。
- 不提交 Git，除非用户明确要求。

## 推荐执行顺序

1. UI-V2 Product Design：确认 PC + Mobile Demo 的体验结构。
2. UI-V2 Demo Plan：确认页面范围、mock 数据、技术边界。
3. 创建 `prototypes/ui-v2-demo` 独立 Vue/Vite Demo。
4. 视觉和交互评审。
5. 规划旧系统能力迁移。
