---
name: xianyu-ui-review
description: Use when designing, reviewing, or implementing UI for XianyuAgentPro's Vue/Electron operations console, including dashboards, order fulfillment, rental schedules, knowledge base, takeover queues, settings, navigation, and visual design consistency.
---

# Xianyu UI Review

Use this skill for UI work in `electron/renderer/src`. The product is an operations console for a rental and AI customer-service workflow, so prefer dense, scannable, task-first interfaces over decorative SaaS landing-page styling.

## Product Priorities

The UI should help an operator quickly answer:

- Which buyer conversations need human action now?
- Which sessions are in cooldown or human-active state?
- Which questions missed the knowledge base and why?
- Which orders need shipping, return, extension, or exception handling?
- Which devices or model schedules are blocked or available?
- Which configuration issue prevents the bot from replying correctly?

## Design Rules

- Use restrained neutral surfaces, clear status colors, and limited accents. Avoid blue-only pages and decorative gradients.
- Keep cards for repeated items, compact stats, modals, or framed tools. Avoid stacking page sections as large decorative cards.
- Keep operational controls dense: sticky filters, segmented controls, status chips, batch action bars, and right-side detail panels.
- Prefer lucide icons or a single consistent icon system. Avoid emoji and miscellaneous text symbols in navigation, headers, and tool buttons.
- Use 6-10px radii for ordinary controls and cards. Reserve pills for status chips and badges.
- Buttons should carry icons for common commands such as refresh, add, search, upload, save, start, stop, and close.
- Tables should support scanning: sticky headers, compact row height, stable columns, clear empty states, and no unnecessary shadows.
- Chinese UI copy should be short and action-oriented. Avoid explaining the feature on screen when the control label is enough.

## Page-Specific Heuristics

- Dashboard: prioritize pending takeover, KB misses, default fallback count, cooldown/human-active sessions, auto-reply hit rate, pending shipping, pending return, and system health.
- Knowledge base: make scope visible (`item`, `biz_item`, `model`, `global`), expose confidence threshold, and provide a test panel that explains candidate matches and misses.
- Takeover board: make SLA, priority, latest question, session state, and recovery action visible without horizontal hunting.
- Orders: use a master/detail workspace, sticky filters, grouped status chips, and batch actions for shipping/return/extension.
- Schedule: keep the Gantt/heatmap primary, with fixed date/model axes and clear status legend.
- Settings: group by operational dependency: credentials, AI model, reply policy, browser mode, notification/logistics, market tools, runtime.

## Verification

For UI changes:

1. Run `npm run build:renderer` in `electron/`.
2. Inspect desktop and narrow widths when practical.
3. Check text fit in buttons, table cells, sidebars, and status chips.
4. Confirm no important control relies only on color or emoji.
