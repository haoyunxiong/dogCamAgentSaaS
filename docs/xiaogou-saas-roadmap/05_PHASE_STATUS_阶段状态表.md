# 05 阶段状态表

## 当前阶段

```text
当前阶段：Phase UI-V2 Demo - 新产品体验独立验证
当前状态：规划中
是否允许写代码：否
是否允许操作 Figma：否
是否允许改数据库：否
是否允许跨阶段开发：否
```

## 当前阶段待办

- [x] Phase 02A Product Design / 产品设计输入整理完成
- [x] Phase 02A checkpoint commit：04f65c9
- [x] Phase 02B Figma Design System 已完成并保留为设计资产
- [x] 最终 UI 风格归档已完成
- [x] 最终 UI 风格归档 docs checkpoint commit：582bda7
- [x] 网页端和手机端 UI 方向已冻结
- [x] Phase 02C-01 / 02C-02 已完成 Token、基础组件、App Shell、Sidebar、Topbar 初步改造
- [x] Phase 02C 真实系统 UI 改造暂停
- [ ] UI-V2 Demo 产品设计方案确认
- [ ] `prototypes/ui-v2-demo` 独立 Demo 范围确认
- [ ] PC 端 Demo 体验结构确认
- [ ] Mobile 端 Demo 体验结构确认
- [ ] Demo mock 数据范围确认
- [ ] Demo 视觉和交互评审通过

## 当前下一步

```text
Figma 组件审计与校准 + Frontend Design Spec / UI 改造计划
```

当前暂停继续修改真实业务页面。

未获得用户明确授权前，不允许创建 Demo、不允许操作 Figma、不允许提交 Git。

后续 UI/UX、Figma 校准、前端 UI 改造必须以最终 UI 归档为准，核心文档包括：

- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/final-ui-style-lock.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/frontend-implementation-brief.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/page-component-mapping.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/mobile-ui-guidelines.md`
- `docs/xiaogou-saas-roadmap/phases/phase-02-design-system/artifacts/final-ui-assets-index.md`

当前工作区存在执行前遗留的 `electron/` 和 `prototypes/` 变更，需要单独审查处理，不属于最终 UI 风格归档。

## Phase 02 路线调整记录

- [x] Phase 02B Figma Design System 已完成并保留。
- [x] Phase 02C 真实系统 UI 改造暂停在 02C-02。
- [x] 暂停 Phase 02C-03 订单中心真实系统改造。
- [x] 不继续在 `electron/renderer/src/views` 上做页面重构。
- [x] 后续先通过独立 UI-V2 Demo 验证最终产品体验。

## Phase 00 验收结果

- [x] 当前项目结构说明完成
- [x] 保留功能清单完成
- [x] 废弃/legacy 功能清单完成
- [x] 新产品定位确认
- [x] Codex 没有修改业务代码
- [x] 用户确认可以进入 Phase 01

## Phase 01 验收结果

- [x] 产品定位确认
- [x] 导航确认
- [x] 核心业务流程确认
- [x] 模块边界确认
- [x] 用户同意先做内部提效系统
- [x] 用户确认可以进入 Phase 02

## 进入后续迁移阶段条件

- [ ] UI-V2 Demo 的 PC 端体验通过评审
- [ ] UI-V2 Demo 的 Mobile 端体验通过评审
- [ ] 新产品整体视觉风格确认
- [ ] 新产品交互结构确认
- [ ] 明确旧系统业务能力迁移范围和顺序
- [ ] 用户确认可以进入后续迁移阶段

## 阶段状态更新规则

只有用户明确确认“本阶段通过验收，可以进入下一阶段”后，Codex 才允许更新当前阶段。
