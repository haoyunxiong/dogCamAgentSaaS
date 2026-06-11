---
name: electron-dev
description: Use for XianyuAgentPro Electron desktop development, including main process startup, Python bridge process management, IPC/preload contracts, Vue renderer work, MySQL-backed desktop data access, Vite dev server issues, and packaging.
---

# Electron Desktop Development

Use this skill for the `electron/` app. The current desktop app is an Electron main process plus a Vue 3 renderer and a Python bridge process.

## Current Shape

- Main process: `electron/main/`
- Preload: `electron/preload/preload.js`
- Renderer: `electron/renderer/src/`
- Vite dev port: `5177`
- Python bridge manager: `electron/main/pythonManager.js`
- DB facade/adapters: `electron/main/dbManager.js`, `electron/main/mysqlAdapter.js`

Read `references/electron-map.md` before changing unfamiliar IPC or process code. Read `references/electron-workflow.md` for local startup and verification.

## Common Rules

- IPC additions normally touch `ipcHandlers.js`, `preload.js`, and the Vue caller.
- Python bridge protocol additions normally touch Python emit/command handling, `pythonManager.js`, preload listeners, and Vue callers.
- Renderer UI uses global primitives in `electron/renderer/src/style.css`; keep changes consistent with the operations-console design.
- Do not assume Windows-only paths. macOS local dev must use absolute POSIX paths.
- Do not assume SQLite-only storage; current local dev uses MySQL.

## Verification

- Renderer-only change: run `npm run build:renderer` from `electron/`.
- Main/preload change: restart Electron and verify IPC call paths.
- Python bridge change: verify Python imports in the same interpreter Electron will spawn.
