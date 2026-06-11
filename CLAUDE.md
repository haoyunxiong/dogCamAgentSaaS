# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Current Priority

The current active task is a UI/UX redesign for the Electron + Vue desktop application.

Before making any UI changes, read these documents:

1. `docs/design/ui-redesign-template.md`
2. `docs/design/ui-current-screens-redesign.md`

Priority rules:

- `docs/design/ui-redesign-template.md` is the long-term design system specification.
- `docs/design/ui-current-screens-redesign.md` is the current screenshot-based implementation brief.
- If the two documents conflict, follow `docs/design/ui-current-screens-redesign.md`.
- This redesign is a UI/UX refactor, not a business logic refactor.

The first implementation priorities are:

1. Unify design tokens and global styles.
2. Refine AppShell, Sidebar, and Topbar.
3. Redesign the Dashboard into a task-oriented workbench.
4. Redesign the Order Fulfillment page from large cards into a desktop-grade table.
5. Replace complex order detail modals with a right-side Drawer.
6. Redesign the SF Express shipping page into a compact workflow form.
7. Preserve all existing backend, IPC, database, and business logic.

## Project Overview

**小狗相机助手桌面版** (XianyuAgentPro) is a desktop workspace for Xianyu camera rental operations. It combines AI-powered customer service automation with rental business management tools, running exclusively as an **Electron desktop application**.

The product covers:

- **Customer service automation** — AI auto-reply via specialist LLM agents, WebSocket real-time messaging
- **Manual takeover** — Human operator takeover with message approval and Feishu integration
- **Rental operations** — Order fulfillment, SF Express shipping, device management, schedule calendar, pricing
- **Deposit management** — Deposit tracking, poster generation, WeChat Pay notification
- **Learning review** — Automated conversation review and quality scoring
- **Knowledge base** — RAG-powered product knowledge retrieval
- **Market monitoring** — Competitor pricing and listing monitoring
- **Inquiry analytics** — Inquiry optimization and metrics
- **Agent control** — Start/stop/status, prompts editor, settings

## Architecture

The system has evolved from a simple bot into a full-stack rental operations platform with a service-oriented backend.

### 1. Electron Main Process (`electron/main/`)

- **`index.js`** — App lifecycle, BrowserWindow creation
- **`pythonManager.js`** — Spawns Python bridge subprocess via stdin/stdout
- **`ipcHandlers.js`** — All IPC handler registration between renderer and main
- **`dbManager.js`** — SQLite config/prompts store (305KB, very large)
- **`mobileGateway.js`** — HTTP gateway for mobile/WeChat access to the desktop app (169KB, largest file)
- **`depositClient.js`** / **`depositNotifyServer.js`** — Deposit management and WeChat Pay notification HTTP server
- **`mysqlAdapter.js`** / **`mysqlConfig.js`** — MySQL adapter for rental data (orders, devices, pricing, etc.)
- **`sfShippingService.js`** — SF Express shipping API integration
- **`rentalOpsRules.js`** — Rental pricing calculation, quote resolution, business rules
- **`rentalInquiryMetrics.js`** — Inquiry optimization metrics and aggregation
- **`inquiryOptimizationEngine.js`** / **`inquiryOptimizationConfig.js`** — Inquiry optimization engine and config
- **`mobileFeishuParser.js`** — Feishu webhook message parser for mobile gateway
- **`xianguanjiaClient.js`** — XianGuanJia (闲管家) external client integration

### 2. Python Bridge (`python/bridge.py`)

IPC bridge between Electron and Python backend using JSON lines over stdin/stdout. Commands: `start`, `stop`, `reload_config`, `generate_prompts` (with `chat_log` param). Emits log/status/error events back to Electron renderer.

### 3. Python Backend Services (`python/services/`)

Service-oriented architecture with these modules:

| Service | Purpose |
|---|---|
| **`rental_agent_service.py`** | Core rental inquiry AI agent — model detection, quote generation, booking flow |
| **`intent_router.py`** | Multi-intent classification: inquiry, booking, shipping, chitchat, etc. |
| **`quote_service.py`** | Price quote generation from pricing repository |
| **`booking_service.py`** | Multi-step booking flow state machine (collecting→quote→order→closed) |
| **`order_service.py`** | Order creation and management |
| **`sf_delivery_service.py`** | SF Express delivery estimates and shipping integration |
| **`pricing_repository.py`** | Camera rental pricing data access |
| **`rental_repository.py`** | Rental item and data access layer |
| **`schedule_service.py`** | Rental schedule and availability |
| **`takeover_service.py`** | Human takeover triggers and routing |
| **`learning_service.py`** | Automated conversation review and scoring |
| **`session_state_service.py`** | Conversation session state machine (auto/cooldown/human/manual) |
| **`feishu_callback_service.py`** | Feishu message card callbacks for human approval |
| **`feishu_card_templates.py`** | Feishu card UI templates for pending approvals |
| **`notification_service.py`** | Notifications to operators |
| **`ops_metrics_service.py`** | Operational metrics and dashboards |
| **`market_monitor.py`** | Competitor price/listing monitoring with browser automation |

### 4. Python Supporting Packages

- **`python/knowledge_base/`** — RAG knowledge base with `retriever.py` and `manager.py`
- **`python/channels/`** — Channel adapters, currently `browser_runner.py` for browser-based login
- **`python/runtime/`** — Runtime models and `conversation_processor.py`

### 5. WebSocket Connection Layer (`python/main.py`, `XianyuLive` class)

- Maintains persistent WebSocket connection to Xianyu's messaging service
- Handles token refresh and reconnection logic
- Manages message routing and manual/auto mode toggling

### 6. LLM Response Generation (`python/XianyuAgent.py`, `XianyuReplyBot` class)

- Routes user messages to appropriate specialist agents via intent classification
- Four specialist agents: `classify` (intent), `price` (negotiation), `tech` (support), `default` (general)
- Safety filtering prevents exposing contact info (WeChat, QQ, etc.)

### 7. Context Management (`python/context_manager.py`)

SQLite database stores conversation history per `(user_id, item_id, chat_id)`. Tracks negotiation attempt counts.

### 8. Frontend (`electron/renderer/`)

- **Vue 3 + Vite** with hash-based routing (`createWebHashHistory`)
- **Pinia** stores: `botStore.js` (bot state/logs), `configStore.js` (config), `uiStore.js` (UI state)
- **Router** defines 17 routes (see Route Map below)
- **28 components** in `src/components/` — base components (BaseButton, BaseCard, BaseTable, BaseDrawer, etc.) and feature components
- **5 service modules** in `src/services/` — deposit API, validation, device lookup, etc.
- Icons via **@lucide/vue**

## Route Map

| Path | View | Purpose |
|---|---|---|
| `/` | Dashboard | Task-oriented workbench |
| `/settings` | Settings | App configuration |
| `/prompts` | Prompts | LLM prompt editor |
| `/knowledge` | KnowledgeBase | RAG knowledge management |
| `/takeovers` | TakeoverBoard | Manual takeover queue |
| `/devices` | DeviceManagement | Rental device inventory |
| `/schedule` | ScheduleCalendar | Rental calendar |
| `/orders` | OrderFulfillment | Order processing |
| `/learning` | LearningReview | AI conversation review |
| `/pending` | FeishuPending | Feishu approval pending |
| `/reports` | Reports | Operational reports |
| `/inquiries` | InquiryAnalytics | Inquiry optimization data |
| `/market` | MarketMonitor | Market/competitor monitoring |
| `/pricing` | Pricing | Rental pricing management |
| `/item-mapping` | ItemModelMapping | Item-to-model mapping |
| `/sf-shipping` | SfShippingWorkbench | SF Express shipping |
| `/deposits` | DepositManagement | Deposit tracking |

## Key Configuration

### App Config (SQLite)

All primary configuration is stored in SQLite at `%APPDATA%\XianyuAutoAgent\app_config.db` and managed via the Electron UI Settings page.

| Variable | Purpose | Default |
|---|---|---|
| `API_KEY` | LLM API key, Qwen-compatible | Required |
| `COOKIES_STR` | Xianyu session cookies | Required |
| `MODEL_BASE_URL` | LLM API endpoint | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `MODEL_NAME` | LLM model name | `qwen-max` |
| `TOGGLE_KEYWORDS` | Toggle manual/auto mode | `。` |
| `SIMULATE_HUMAN_TYPING` | Add reply delays | `False` |
| `HEARTBEAT_INTERVAL` | WebSocket heartbeat in seconds | `15` |
| `HEARTBEAT_TIMEOUT` | Heartbeat timeout in seconds | `5` |
| `TOKEN_REFRESH_INTERVAL` | Token refresh interval in seconds | `3600` |
| `MANUAL_MODE_TIMEOUT` | Manual mode duration in seconds | `3600` |
| `MESSAGE_EXPIRE_TIME` | Message expiration in ms | `300000` |

### MySQL Config

MySQL is used for rental operations data (orders, devices, pricing, schedules, deposits). Configured via:

1. Environment variable `XIANYU_MYSQL_CONFIG` pointing to a JSON file, or
2. `mysql-connection.json` file (searched in cwd, parent dir, or project root)
3. Individual env vars: `XIANYU_MYSQL_HOST`, `XIANYU_MYSQL_PORT`, `XIANYU_MYSQL_USER`, `XIANYU_MYSQL_PASSWORD`, `XIANYU_MYSQL_DATABASE`

Default: `root@127.0.0.1:3306/xianyu_agent`. Schema defined in `scripts/mysql_schema.sql`.

## Custom Prompts

LLM prompts are stored in the SQLite database `prompts` table and editable via the Electron UI:

- `classify_prompt` — Intent classification logic
- `price_prompt` — Price negotiation strategy
- `tech_prompt` — Technical support responses
- `default_prompt` — General customer service replies

## Development Commands

```bash
# Install Python dependencies (use project venv, see below)
pip install -r python/requirements.txt

# Install Electron dependencies
cd electron
npm install

# Run in development mode (Vite port 5177 + Electron)
cd electron
npm run dev

# Build renderer only
cd electron
npm run build:renderer

# Build Python bridge (PyInstaller → build/python-dist/bridge/)
# Required BEFORE npm run build (electron-builder includes it as extraResources)
# Windows:
..\scripts\build-python.bat
# Mac/Linux (equivalent):
cd python && python -m PyInstaller bridge.spec --distpath ../build/python-dist --workpath ../build/python-work --clean --noconfirm

# Build for production (Vite build + electron-builder packaging)
cd electron
npm run build
```

### Development Environment Notes

- **Python venv (Mac)**: `/Users/lishuangshuang/Desktop/闲鱼Agent/.venv-mac/bin/python3` — use this for pip install and running Python scripts.
- **`predev` 脚本是 Windows 专用的** — 它调用 PowerShell 来杀死端口。Mac 上会静默失败（被 try/catch 包裹），不影响开发。
- **`postinstall` / `better-sqlite3`**: `npm install` 后会自动运行 `electron-rebuild -f -w better-sqlite3` 来编译原生模块。如果失败，检查是否安装了 Xcode Command Line Tools 等构建工具。
- **vite.config.js 硬编码路径**: `alternateWorkspaceRoots` 数组包含 `/Users/lishuangshuang/Downloads/闲鱼Agent/XianyuAgentPro`。如果你在其他路径克隆项目，可能需要修改或删除这个路径。

## Running Tests

```bash
# Run all Python tests (from project root or python/ directory)
cd python && python -m pytest tests/ -v

# Run a single Python test (from project root)
python -m pytest python/tests/test_intent_router.py -v

# Run all Electron (Node.js) tests
cd electron && node --test tests/**/*.test.mjs

# Run a single Electron test
cd electron && node --test tests/sfShippingService.test.mjs
```

Python tests use `pytest` (or the built-in `unittest` runner for some). Electron tests use Node.js native test runner (`node:test` and `node:assert/strict`).

## Key Design Patterns

### Electron ↔ Python IPC

- Electron sends JSON commands to Python via stdin: `{"cmd": "start"}`
- Python emits JSON events to Electron via stdout: `{"type": "log", "level": "info", "message": "..."}`

### Intent-Based Routing

```
Incoming message → IntentRouter.classify() → intent category
  → routes to specialist agent (RentalAgentService, etc.)
  → LLM generates response with context
```

### Conversation Session State Machine

```
AUTO → COOLDOWN (after reply) → AUTO (cooldown expires)
  or → HUMAN (needs takeover) → MANUAL (operator engaged)
```

### Booking Flow State Machine

```
COLLECTING (gathering requirements) → QUOTE_READY (price calculated)
  → ORDER_DRAFTED (order created) → CLOSED
```

### Mobile Public Access

`mobileGateway.js` runs an HTTP server on port 8787, enabling mobile/WeChat access to the desktop app. The Vite dev server proxies `/mobile`, `/api/mobile`, and `/api/feishu` to this gateway.

### Message Processing

Messages are validated before processing:

- `is_chat_message()` — filters actual customer messages
- `is_system_message()` — ignores system notifications
- `is_typing_status()` — ignores typing indicators
- `is_sync_package()` — handles message synchronization

### Token & Connection Management

- Token auto-refreshes every `TOKEN_REFRESH_INTERVAL` seconds
- Heartbeat keepalive runs every `HEARTBEAT_INTERVAL` seconds
- Connection auto-restarts on token refresh
- Manual mode temporarily disables auto-reply for human takeover

## Project Structure

```text
├── electron/
│   ├── main/
│   │   ├── index.js                      # App lifecycle, BrowserWindow
│   │   ├── pythonManager.js              # Python bridge subprocess
│   │   ├── ipcHandlers.js                # IPC handler registration
│   │   ├── dbManager.js                  # SQLite config/prompts
│   │   ├── mobileGateway.js              # Mobile/WeChat HTTP gateway (large)
│   │   ├── mobileFeishuParser.js         # Feishu webhook parser
│   │   ├── depositClient.js              # Deposit management client
│   │   ├── depositNotifyServer.js        # WeChat Pay notification server
│   │   ├── mysqlAdapter.js               # MySQL data adapter
│   │   ├── mysqlConfig.js                # MySQL connection config
│   │   ├── sfShippingService.js          # SF Express API
│   │   ├── rentalOpsRules.js             # Rental pricing business rules
│   │   ├── rentalInquiryMetrics.js       # Inquiry metrics aggregation
│   │   ├── inquiryOptimizationEngine.js  # Inquiry optimization
│   │   ├── inquiryOptimizationConfig.js  # Optimization config
│   │   └── xianguanjiaClient.js          # XianGuanJia client
│   ├── preload/
│   ├── renderer/
│   │   ├── src/
│   │   │   ├── main.js                   # Vue app entry
│   │   │   ├── App.vue                   # Root component
│   │   │   ├── style.css                 # Global styles
│   │   │   ├── router/index.js           # 17 routes (hash history)
│   │   │   ├── stores/                   # Pinia stores
│   │   │   │   ├── botStore.js           # Bot state, logs
│   │   │   │   ├── configStore.js        # App config
│   │   │   │   └── uiStore.js            # UI state
│   │   │   ├── services/                 # Frontend API services
│   │   │   │   ├── depositApiService.js
│   │   │   │   ├── depositMockService.js
│   │   │   │   ├── depositSettingsService.js
│   │   │   │   ├── depositValidationService.js
│   │   │   │   └── deviceLookupService.js
│   │   │   ├── components/               # 28 shared/page components
│   │   │   ├── views/                    # 17 page components
│   │   │   │   ├── Dashboard.vue
│   │   │   │   ├── Settings.vue
│   │   │   │   ├── Prompts.vue
│   │   │   │   ├── KnowledgeBase.vue
│   │   │   │   └── rental/               # 13 rental operation views
│   │   │   │       ├── TakeoverBoard.vue
│   │   │   │       ├── ScheduleCalendar.vue
│   │   │   │       ├── OrderFulfillment.vue
│   │   │   │       ├── DeviceManagement.vue
│   │   │   │       ├── LearningReview.vue
│   │   │   │       ├── FeishuPending.vue
│   │   │   │       ├── Reports.vue
│   │   │   │       ├── MarketMonitor.vue
│   │   │   │       ├── Pricing.vue
│   │   │   │       ├── ItemModelMapping.vue
│   │   │   │       ├── InquiryAnalytics.vue
│   │   │   │       ├── SfShippingWorkbench.vue
│   │   │   │       └── DepositManagement.vue
│   │   │   ├── config/
│   │   │   │   └── depositConfig.js
│   │   │   └── utils/
│   │   └── dist/                         # Vite build output
│   ├── tests/                            # 13 Node.js test files
│   ├── vite.config.js                    # Port 5177, mobile proxy
│   ├── electron-builder.yml              # appId: com.xianyu.autoagent
│   └── package.json
├── python/
│   ├── bridge.py                         # IPC bridge entry point
│   ├── main.py                           # XianyuLive WebSocket handler
│   ├── XianyuAgent.py                    # LLM response generation
│   ├── XianyuApis.py                     # HTTP API wrapper
│   ├── context_manager.py                # SQLite conversation storage
│   ├── config_manager.py                 # SQLite config manager
│   ├── login_browser.py                  # Browser-based login
│   ├── mysql_config.py / mysql_helper.py # MySQL config and helpers
│   ├── services/                         # 13 service modules
│   ├── knowledge_base/                   # RAG retriever + manager
│   ├── channels/                         # Channel adapters (browser runner)
│   ├── runtime/                          # Runtime models, processor
│   ├── utils/                            # xianyu_utils.py
│   ├── tests/                            # 8 pytest files
│   └── requirements.txt
├── docs/
│   ├── design/                           # UI redesign specs
│   ├── rental-ops/                       # Rental ops documentation
│   ├── deployment/                       # Deployment guide
│   ├── qa/                               # QA checklists
│   └── superpowers/
│       ├── plans/                        # Feature implementation plans
│       └── specs/                        # Feature design specs
├── scripts/                              # Build, migration, startup scripts
│   ├── mysql_schema.sql
│   ├── migrate_to_mysql.py
│   ├── backup_mysql.js
│   ├── build-all.bat / build-python.bat
│   ├── kill-port.ps1
│   ├── start_mobile_public_access.sh
│   └── start_xianyu_desktop.sh
├── installer/                            # Inno Setup installer config
└── data/                                 # Local SQLite data, chat history
```

## Dependencies

### Python (`python/requirements.txt`)

- `openai` — LLM API client, Qwen-compatible
- `websockets` — WebSocket connection handling
- `loguru` — Structured logging
- `requests` — HTTP requests
- plus test dependencies (pytest, etc.)

### Node.js (`electron/package.json`)

- **Runtime**: `electron` (v29), `vue` (v3.4), `vite` (v5)
- **State**: `pinia` (v2.1)
- **Routing**: `vue-router` (v4.3)
- **Database**: `better-sqlite3` (v9.4), `mysql2` (v3.22)
- **Icons**: `@lucide/vue` (v1.16)
- **Utils**: `xlsx` (v0.18.5) — Excel import/export
- **Build**: `electron-builder` (v24.9), `@vitejs/plugin-vue` (v5), `concurrently`, `wait-on`

## UI Redesign Instructions

### Design Documents

Claude Code must use the following documents as the source of truth for UI work:

```text
docs/design/ui-redesign-template.md
docs/design/ui-current-screens-redesign.md
```

Use `ui-redesign-template.md` for design tokens, color system, typography, spacing, layout, component standards, and long-term consistency rules.

Use `ui-current-screens-redesign.md` for current screenshot-specific tasks, implementation priorities, and page-level layouts.

### UI Style Direction

Reference style: Linear, Raycast, Notion, Vercel Dashboard, Feishu/Lark admin dashboards.

Target: Clean, professional, calm, high-density but readable, trustworthy, suitable for long daily operational use.

Avoid: Student-project appearance, large gradients, cyberpunk, heavy glassmorphism, neon colors, excessive shadows, decorative animations, low-density marketing-page layout.

### Required UI Changes

1. **Global visual cleanup** — stable background, white cards with subtle borders, centralized tokens
2. **Sidebar and Topbar** — workflow-oriented sidebar, clear Agent status badge, compact action button
3. **Dashboard** — task-oriented workbench, "what needs to be handled today?" first, pending actions before metrics
4. **Order Fulfillment** — table layout instead of large cards, compact row actions, More menu for destructive actions
5. **Order Detail** — right-side Drawer instead of large centered Modal
6. **SF Express Shipping** — compact workflow form, right-side summary panel, next-step action close to current task

### UI Component Rules

Prefer reusable base components: BaseButton, BaseCard, BaseBadge, BaseInput, BaseSelect, BaseTable, BaseDrawer, BaseDialog, BaseEmpty, BaseSkeleton, BaseToast.

Page components should mainly handle data loading, layout composition, and page-level event wiring — not excessive low-level styling or duplicated UI primitives.

## Hard Restrictions

This redesign must not change core business behavior.

Do not modify unless explicitly requested: Electron main process lifecycle, Python bridge startup, IPC protocol, SQLite schema, Xianyu login/auth, WebSocket connection, token refresh, message sync, auto-reply core, prompt storage, SF Express API business logic, Feishu API business logic, existing API contracts, or launcher/packaging behavior.

Do not introduce large UI frameworks (Ant Design Vue, Element Plus, Vuetify, admin templates) unless explicitly approved.

Do not hide critical operational states: Agent running/stopped/error, Xianyu account connection, auto-reply enabled/disabled, manual takeover, order fulfillment status, shipping/logistics status, task execution status, data sync status.

Do not expose destructive actions too aggressively: no prominent red delete buttons in dense lists, use More menus, require confirmation.

## Workflow Rules for Claude Code

Before making code changes:
1. Read the relevant design documents
2. Scan the current project structure
3. Identify the exact files to modify
4. Explain the implementation plan
5. Wait for confirmation if the change spans multiple pages or core layout files

For each implementation step, report: files changed, what changed, why, whether business logic was affected, how to verify, known risks or follow-up tasks.

Prefer staged implementation: tokens/global styles → base components → AppShell/Sidebar/Topbar → Dashboard → Order Fulfillment → Order Detail Drawer → SF Express → remaining pages. Do not attempt a full UI rewrite in one pass.

## Launcher Sync Requirement

When changing startup flow, build output paths, Electron packaging paths, or app executable names, also update the root launcher scripts:

- `../双击启动闲鱼Agent.bat`
- `../双击启动闲鱼Agent-调试版.bat`
- `../启动闲鱼Agent.ps1`

For UI-only redesign tasks, do not modify launcher scripts.

## Common Issues & Solutions

### Token Expiration

Update `COOKIES_STR` manually in the Settings page. Open `goofish.com` in Chrome, copy cookies from DevTools, and paste them into Settings.

### WebSocket Disconnects

Automatic reconnection triggers on token refresh. Check logs for `Token刷新成功` messages.

### Message Not Replied

Verify the message passes the `is_chat_message()` filter. Check logs for the intent classification result and selected specialist agent.

### LLM Response Issues

Edit prompts via the UI Prompts page. The safety filter blocks responses containing contact information.

## Documentation Map

Key docs beyond this file:

- `docs/design/ui-redesign-template.md` — Long-term UI design system
- `docs/design/ui-current-screens-redesign.md` — Current UI implementation brief
- `docs/rental-ops/` — Rental operations documentation (mobile access, Feishu workbench, inquiry data)
- `docs/deployment/` — Deployment guide
- `docs/superpowers/plans/` — Feature implementation plans (SF shipping, inquiry optimization, cloud UI)
- `docs/superpowers/specs/` — Feature design specs (LangGraph agent, RAG knowledge base, Feishu callbacks)
- `docs/qa/` — QA checklists
