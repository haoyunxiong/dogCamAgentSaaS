# Electron Map

## Main Process

- `electron/main/index.js` - app bootstrap, window lifecycle, app data directory, DB/Python/IPC initialization.
- `electron/main/pythonManager.js` - resolves Python interpreter, starts/stops bridge, parses stdout JSON lines, forwards events.
- `electron/main/ipcHandlers.js` - renderer request handlers.
- `electron/main/dbManager.js` - DB manager facade.
- `electron/main/mysqlAdapter.js` - MySQL adapter used by the desktop app.
- `electron/main/xianguanjiaClient.js` - integration client for related external platform functions.

## Preload

- `electron/preload/preload.js` - exposes `window.electronAPI`.

Every renderer-facing API should be explicitly exposed here. Avoid direct Node access from Vue.

## Renderer

- `electron/renderer/src/App.vue` - layout shell.
- `electron/renderer/src/style.css` - global tokens and common UI classes.
- `electron/renderer/src/components/AppSidebar.vue` - primary navigation.
- `electron/renderer/src/components/AppTopBar.vue` - top bar, bot status, command entry.
- `electron/renderer/src/components/PageHeader.vue` - page header pattern.
- `electron/renderer/src/components/CommandPalette.vue` - quick navigation/actions.
- `electron/renderer/src/router/index.js` - route registry.
- `electron/renderer/src/stores/` - Pinia stores.
- `electron/renderer/src/views/` - page views.
- `electron/renderer/src/views/rental/` - rental/order/schedule/takeover/market modules.

## IPC Change Checklist

For renderer to main:

1. Add `ipcMain.handle(...)` in `ipcHandlers.js`.
2. Add a function in `preload.js`.
3. Call `window.electronAPI.*` from Vue/store.
4. Return serializable values only.

For Python to renderer event:

1. Emit JSON line in Python.
2. Ensure `pythonManager.js` forwards the event type.
3. Expose listener in `preload.js`.
4. Register and clean up listener in Vue.

## Renderer Design Notes

This is an operations console. Favor compact tables, sticky filters, status chips, right-side detail panels, and consistent iconography over decorative page sections.
