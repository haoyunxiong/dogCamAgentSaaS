---
name: xianyu-autoagent
description: Use for XianyuAgentPro development, startup, debugging, and behavior changes across the Electron, Vue, Python, MySQL, browser automation, knowledge-base, rental operations, and human takeover flows.
---

# XianyuAgentPro Development

Use this skill when working on this repository. It captures the current project shape, not the original upstream-only XianyuAutoAgent assumptions.

## Current Architecture

- Desktop shell: Electron main process in `electron/main/`, Vue 3 renderer in `electron/renderer/src/`.
- Python runtime: bridge and bot runtime in `python/`, with structured services in `python/services/`, `python/runtime/`, `python/channels/`, and `python/knowledge_base/`.
- Database: MySQL is the active shared store. Do not assume the old SQLite-only config path unless the code being edited explicitly targets legacy fallback.
- Local dev database defaults currently point at `127.0.0.1:3306`, database `xianyu_agent`.
- Renderer route groups include operations, dialogue center, market tools, configuration, knowledge base, schedules, orders, devices, reports, item/model mapping, learning review, and takeover board.

Read `references/project-map.md` for file ownership when touching unfamiliar areas. Read `references/development-workflow.md` for local run and verification commands.

## Behavioral Guardrails

Preserve these rules when changing reply logic:

- Knowledge retrieval is scoped by item/business item/model/global context. Do not flatten all knowledge into one global answer pool.
- If no good answer is found, the bot may send one default fallback reply for that unresolved question/session, then notify humans.
- The default fallback must not repeat in a way that makes the buyer see repeated generic messages.
- Human takeover, cooldown, and `human_active` states must prevent the bot from fighting a human operator.
- Browser-mode automation exists to simulate normal browser behavior where direct API calls are unsuitable. Do not replace it with direct API calls without checking the channel contract.
- Changes involving AI output must consider classification, retrieval score, confidence threshold, safe wording, and handoff behavior together.

## Common Edit Paths

- Reply decision flow: `python/runtime/conversation_processor.py`
- Session state and cooldown: `python/services/session_state_service.py`
- Rental/domain reply orchestration: `python/services/rental_agent_service.py`
- Knowledge retrieval: `python/knowledge_base/retriever.py`
- Human takeover: `python/services/takeover_service.py`
- Browser channel: `python/channels/browser_runner.py`
- Electron main and DB: `electron/main/index.js`, `electron/main/pythonManager.js`, `electron/main/ipcHandlers.js`, `electron/main/mysqlAdapter.js`
- Vue shell and UI: `electron/renderer/src/App.vue`, `electron/renderer/src/components/`, `electron/renderer/src/views/`, `electron/renderer/src/style.css`

## Development Workflow

Before editing:

1. Check `git status --short`; this repo often contains user work in progress.
2. Inspect the exact files involved with `rg`, `sed`, or `find`; prefer existing local patterns.
3. For cross-process changes, update all sides of the contract: Python bridge/service, Electron IPC/preload, Vue caller, and tests where present.

After editing:

1. Run focused tests when available, especially `python/tests/test_retriever_policy.py`, `python/tests/test_ops_metrics.py`, and related service tests for reply/takeover changes.
2. For renderer changes, run `npm run build:renderer` from `electron/`.
3. For startup issues, verify MySQL, Vite, Electron, and Python bridge separately before assuming an app bug.

## References

- Project map: `references/project-map.md`
- Development workflow: `references/development-workflow.md`
- Electron-specific workflow: `../electron-dev/SKILL.md`
