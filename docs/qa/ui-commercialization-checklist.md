# UI Commercialization Checklist

Use this checklist before and after every frontend commercialization phase.

## Required Before Editing

- [ ] Read `AGENTS.md`.
- [ ] Read `docs/design/ui-redesign-template.md`.
- [ ] Read `docs/design/ui-current-screens-redesign.md`.
- [ ] Read active plan and latest `progress.md`.
- [ ] Confirm the task does not require backend/IPC/database changes.

## Interaction Governance

- [ ] Destructive actions use `BaseDialog` or the shared confirmation service.
- [ ] High-risk external actions explain real-world effects before confirmation.
- [ ] Primary buttons are compact and task-specific.
- [ ] Low-frequency actions are in `RowActionMenu` or secondary menus.
- [ ] No new native `window.confirm` is introduced.
- [ ] No new large centered modal is introduced for complex operational details.

## Visual Consistency

- [ ] Uses design tokens from `electron/renderer/src/style.css`.
- [ ] Uses existing base components when available.
- [ ] Uses lucide icons instead of emoji for controls and navigation.
- [ ] Text fits in buttons, badges, cells, and drawer headers.
- [ ] Tables remain scannable at desktop width.

## Business Safety

- [ ] Agent status remains visible.
- [ ] Order status remains visible.
- [ ] Shipping status remains visible.
- [ ] Existing handler names and payloads are preserved unless explicitly planned.
- [ ] No schema, prompt storage, login, sync, or SF business logic changes.

## Rendered Verification

- [ ] Define the flow under test in one sentence.
- [ ] Start the renderer or Electron app when practical.
- [ ] Use Browser plugin for local rendered validation when available.
- [ ] If Browser plugin cannot be used, record the reason and use Playwright.
- [ ] Capture screenshot evidence for changed screens.
- [ ] Exercise at least one meaningful interaction for each changed workflow.
- [ ] Check for console/runtime errors.
- [ ] Fix validation issues before advancing to the next phase.

## Commands

- [ ] `cd electron && npm run build:renderer`
- [ ] Visual check of changed page in dev app when practical.
- [ ] No console errors on the modified route.
- [ ] Core buttons still call original handlers.
- [ ] Any skipped verification is recorded in `progress.md`.
