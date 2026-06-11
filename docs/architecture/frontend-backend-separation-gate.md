# Frontend / Backend Separation Gate

## Current Architecture

XianyuAgentPro is currently an Electron desktop application with a local renderer, Electron main process services, and a Python bridge.

- The Vue renderer calls `window.electronAPI` through preload-exposed IPC methods.
- Electron main owns local service orchestration, SQLite/MySQL access, SF Express calls, Feishu calls, launcher behavior, and the Python subprocess lifecycle.
- Python owns Xianyu WebSocket connection, token refresh, message routing, and LLM reply generation.
- Configuration is local-first and user-machine bound.

This is not a standard browser frontend plus deployed backend architecture yet. It is closer to a local operations workstation.

## Why Not Split Immediately

Do not split only because the renderer code is growing.

The current product still benefits from Electron-local architecture because:

- It depends on a local desktop runtime, local launcher scripts, local cookies, and a Python bridge.
- Many operations are single-merchant, local-operator workflows.
- Splitting too early would force auth, tenant, deployment, audit, and cloud database decisions before the commercial operating model is stable.
- Current risk is mostly UI maintainability and IPC boundary clarity, which can be improved with renderer API wrappers and domain services without deploying a backend.

The near-term standard should be: clean local boundaries first, hosted backend later.

## Trigger Conditions For Backend Separation

Move toward a standard frontend/backend split when at least one of these becomes true:

- Multiple merchants use one deployed system.
- Employee accounts, roles, and permissions are required.
- Data must be shared through a cloud-hosted database across devices or stores.
- Users need browser access outside the local machine or local network.
- The product becomes paid SaaS operation rather than a local tool installation.
- Audit logs, admin controls, or tenant-level operation records become compliance requirements.
- Customer support, order fulfillment, and shipping operations need centralized monitoring by a team.

If none of these are true, prioritize a stronger Electron-local architecture instead of introducing a deployed backend.

## Migration Path

Use an incremental path that keeps existing behavior stable.

1. Split `dbManager.js` into domain services inside Electron main.
2. Normalize service method input and output shapes.
3. Wrap renderer IPC calls in `electronApiClient`.
4. Reuse the same service layer for mobile gateway endpoints.
5. Later replace selected IPC services with HTTP endpoints.
6. Add auth, tenant, permission, and audit logs only when the business requires shared operation.

## Boundary Rules Before Separation

Before any hosted backend migration, the current codebase should follow these local boundary rules:

- Renderer views should call a thin client wrapper instead of scattering direct `window.electronAPI` calls.
- Page components should compose state and layout; business actions should live in composables or service wrappers.
- Electron main process service methods should return predictable objects with explicit `ok`, `message`, and data fields where practical.
- IPC names and payloads should remain stable until a planned migration changes them.
- UI refactors must not modify Python bridge startup, token refresh, Xianyu auth, message sync, SF Express business logic, Feishu business logic, or database schema.

## Risks

Splitting too early creates these risks:

- More deployment and auth work before product-market workflow is stable.
- More failure modes for a tool that currently needs reliable daily operation.
- Harder local debugging for Xianyu login, cookies, WebSocket, and Python bridge issues.
- Duplicate service logic if Electron main services are not cleaned first.

Splitting too late creates these risks:

- Difficult multi-merchant data isolation.
- Weak employee permission controls.
- Incomplete audit trails for paid operations.
- Harder migration if renderer pages keep direct IPC calls everywhere.

The current recommendation is to continue local Electron architecture while preparing the code with clean renderer wrappers and Electron main domain services.
