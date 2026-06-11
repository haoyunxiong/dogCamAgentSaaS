# XianyuAgentPro Project Map

## Runtime Entry Points

- `python/bridge.py` - Electron-managed Python bridge. Reads JSON lines from stdin and emits JSON events on stdout.
- `python/main.py` / `python/XianyuAgent.py` - upstream-style bot entry and agent logic still present for compatibility.
- `python/runtime/conversation_processor.py` - main reply decision pipeline for received buyer messages.
- `python/channels/browser_runner.py` - browser-mode automation runner.
- `electron/main/index.js` - Electron app bootstrap, window creation, app data path, DB/Python/IPC initialization.
- `electron/main/pythonManager.js` - Python process resolution, spawn, stdout dispatch, bridge command writing.

## Data And Configuration

- `electron/main/mysqlAdapter.js` - Node-side MySQL adapter used by Electron IPC handlers.
- `python/mysql_helper.py` - Python-side MySQL helper.
- `scripts/mysql_schema.sql` - MySQL schema source.
- `python/config_manager.py` - Python configuration access. Current local development uses MySQL-backed configuration.
- `electron/main/dbManager.js` - DB manager facade retained by Electron main. Check implementation before assuming SQLite behavior.

Current local dev defaults:

- Host: `127.0.0.1`
- Port: `3306`
- Database: `xianyu_agent`

Avoid committing real credentials, cookies, or API keys into docs, logs, screenshots, or test fixtures.

## Reply And Handoff Logic

- `python/runtime/conversation_processor.py` - message normalization, knowledge lookup, default fallback, notification, and reply decision.
- `python/knowledge_base/retriever.py` - scoped knowledge retrieval and scoring policy.
- `python/knowledge_base/manager.py` - knowledge entry management.
- `python/services/rental_agent_service.py` - rental/business-aware reply orchestration.
- `python/services/session_state_service.py` - session states such as automatic, cooldown, and human-active.
- `python/services/takeover_service.py` - takeover task creation, notification, acceptance, and closure.

Do not break the "single fallback then human review" policy when changing retrieval or fallback code.

## Operations Features

- `python/services/booking_service.py` - booking/order-related service logic.
- `python/services/ops_metrics_service.py` - dashboard metrics.
- `python/services/quote_service.py` - quotation logic.
- `python/services/learning_service.py` and related tests - learning review and candidate extraction.
- `electron/renderer/src/views/rental/` - rental operations pages:
  - `OrderFulfillment.vue`
  - `ScheduleCalendar.vue`
  - `DeviceManagement.vue`
  - `ItemModelMapping.vue`
  - `TakeoverBoard.vue`
  - `LearningReview.vue`
  - `FeishuPending.vue`
  - `MarketMonitor.vue`
  - `Pricing.vue`
  - `Reports.vue`

## Vue/Electron UI

- `electron/renderer/src/App.vue` - shell layout.
- `electron/renderer/src/style.css` - global design tokens and shared UI primitives.
- `electron/renderer/src/components/AppSidebar.vue` - main navigation.
- `electron/renderer/src/components/AppTopBar.vue` - top bar, status, command entry.
- `electron/renderer/src/components/PageHeader.vue` - page title/header pattern.
- `electron/renderer/src/components/CommandPalette.vue` - quick navigation/action surface.
- `electron/renderer/src/router/index.js` - route ownership map.
- `electron/renderer/src/stores/` - Pinia stores.

## IPC Contract

For new UI features, update all needed layers:

1. Main process handler: `electron/main/ipcHandlers.js`
2. Preload exposure: `electron/preload/preload.js`
3. Renderer caller: Vue component/store
4. Python bridge/service if the action crosses into Python
5. Test or manual verification path

## High-Value Tests

- `python/tests/test_retriever_policy.py`
- `python/tests/test_ops_metrics.py`
- `python/tests/test_booking_service.py`
- `python/tests/test_intent_router.py`
- `python/tests/test_learning_classify.py`
- `python/tests/test_quote_service.py`
- `python/tests/test_feishu_card_templates.py`
