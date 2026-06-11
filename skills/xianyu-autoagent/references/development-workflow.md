# XianyuAgentPro Development Workflow

## Local Startup Shape

The project currently needs four pieces for full local development:

1. MySQL running on `127.0.0.1:3306` with database `xianyu_agent`.
2. Python dependencies installed in a local venv.
3. Vite renderer dev server on port `5177`.
4. Electron main process pointed at the Vite URL.

This repository may have machine-specific setup under the parent directory, such as `.tools/` and `.venv-mac/`. Prefer inspecting the current machine before inventing new paths.

## Common Commands

From the repository root:

```bash
git status --short
```

Python tests:

```bash
../.venv-mac/bin/python -m pytest python/tests/test_retriever_policy.py
../.venv-mac/bin/python -m pytest python/tests/test_ops_metrics.py
```

Renderer build:

```bash
cd electron
npm run build:renderer
```

Renderer dev server:

```bash
cd electron
npm run dev
```

If system `node`/`npm` is missing, inspect the parent `.tools/node-*` directory and prepend its `bin` to `PATH`.

## Debugging Startup

Check in this order:

1. MySQL responds and schema exists.
2. Electron main connects through `mysqlAdapter.js`.
3. `pythonManager.js` starts the expected Python interpreter.
4. Python bridge can import `pymysql`, Playwright, and project modules.
5. Renderer loads Vite URL and IPC calls return.

Useful symptoms:

- `Path must be absolute` near Electron startup can mean a Windows-only app data path leaked onto macOS.
- Missing `pymysql` means the bridge is using an environment without Python MySQL deps.
- Browser automation issues often require Playwright Chromium to be installed in the same Python environment.

## Safe Change Process

- For reply logic, inspect the session state and takeover services before changing fallback behavior.
- For knowledge-base changes, include item/business/model/global scope in tests.
- For UI changes, run `npm run build:renderer` and visually inspect core pages when possible.
- For security-sensitive changes, use the `security-best-practices` skill and avoid printing cookies, tokens, or API keys.
