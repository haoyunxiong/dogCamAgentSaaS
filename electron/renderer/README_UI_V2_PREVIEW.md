# UI-V2 Renderer-Only Preview

This preview mode is only for reviewing UI-V2 mock pages in a browser.

## Start

```bash
cd electron
npm run renderer:preview
```

The command starts only the Vite renderer dev server on:

```text
http://127.0.0.1:5188/
```

It does not start Electron main, preload, Python, backend services, or any database connection.

## Routes

Open these hash routes in the browser:

```text
http://127.0.0.1:5188/#/ui-v2
http://127.0.0.1:5188/#/ui-v2/orders
http://127.0.0.1:5188/#/ui-v2/schedule
http://127.0.0.1:5188/#/ui-v2/devices
http://127.0.0.1:5188/#/ui-v2/reports
http://127.0.0.1:5188/#/ui-v2/mobile
http://127.0.0.1:5188/#/ui-v2/mobile/orders
http://127.0.0.1:5188/#/ui-v2/mobile/orders/ORD-10023
```

## Boundaries

- UI-V2 preview pages use `src/mock/uiV2` and `src/adapters/uiV2` only.
- Do not use this mode to validate legacy production pages.
- This mode does not create or fake `window.electronAPI`.
- Real business routes remain protected in a normal browser because preload is not available.
- Real API, IPC, Python, MySQL, SQLite, and local business data are not used.
