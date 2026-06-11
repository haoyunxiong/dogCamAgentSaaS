# Electron Workflow

## Install

```bash
cd electron
npm install
```

If system Node is missing on macOS local dev, use the parent `.tools/node-*/bin` path.

## Run

```bash
cd electron
npm run dev
```

The dev script starts Vite on port `5177`, waits for it, then starts Electron with `VITE_DEV_SERVER_URL=http://localhost:5177`.

## Build Renderer

```bash
cd electron
npm run build:renderer
```

Run this after renderer/component/style changes.

## Common Failures

- Electron cannot find its binary: check `electron/node_modules/electron/dist` and `path.txt`.
- `better-sqlite3` native load failure: rebuild with Electron ABI if SQLite fallback is used.
- Python bridge imports fail: check the interpreter selected by `pythonManager.js`.
- Main process DB connection fails: check MySQL service, credentials, and `xianyu_agent` schema.
- Renderer white screen: check Vite output, browser console, and preload errors.

## Main/Renderer Change Discipline

- Keep main process side effects out of renderer components.
- Keep preload API names stable and explicit.
- Restart Electron after changing `electron/main` or `electron/preload`.
- Renderer HMR is enough for most Vue/CSS changes, but build before handing off.
