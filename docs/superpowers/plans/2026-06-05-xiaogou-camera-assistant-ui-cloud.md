# 小狗相机助手品牌与云部署说明 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the visible desktop product surface to 小狗相机助手 and add a practical cloud deployment/domain guide without changing business logic.

**Architecture:** Keep Electron, Vue, Python, IPC, and database contracts unchanged. Make only renderer shell/package metadata text changes and add a documentation page for deployment choices.

**Tech Stack:** Electron, Vue 3, Vite, Node `node:test`, Markdown.

---

## File Structure

- Modify `electron/renderer/src/components/AppSidebar.vue`: visible brand title, image alt, and subtitle.
- Modify `electron/renderer/src/components/AppTopBar.vue`: search placeholder and order page label.
- Modify `electron/renderer/index.html`: document title.
- Modify `electron/package.json`: package description only, not package name.
- Create `electron/tests/brandIdentity.test.mjs`: regression test for visible brand identity files.
- Create `docs/deployment/xiaogou-camera-assistant-cloud.md`: cloud service and fixed domain guide.

### Task 1: Brand Identity Test

**Files:**
- Create: `electron/tests/brandIdentity.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('desktop shell uses 小狗相机助手 as the visible product brand', () => {
  assert.match(read('renderer/src/components/AppSidebar.vue'), /小狗相机助手/)
  assert.match(read('renderer/src/components/AppSidebar.vue'), /相机租赁运营工作台/)
  assert.match(read('renderer/index.html'), /<title>小狗相机助手<\/title>/)
  assert.match(read('package.json'), /小狗相机助手/)
})

test('cloud deployment guide explains fixed-domain deployment', () => {
  const guide = read('../docs/deployment/xiaogou-camera-assistant-cloud.md')
  assert.match(guide, /固定域名/)
  assert.match(guide, /HTTPS/)
  assert.match(guide, /Nginx/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd electron && node --test tests/brandIdentity.test.mjs`

Expected: FAIL because the old brand and missing deployment guide are still present.

### Task 2: Apply Brand Copy

**Files:**
- Modify: `electron/renderer/src/components/AppSidebar.vue`
- Modify: `electron/renderer/src/components/AppTopBar.vue`
- Modify: `electron/renderer/index.html`
- Modify: `electron/package.json`

- [ ] **Step 1: Replace visible brand strings**

Use these exact replacements:

- `闲鱼助手 Pro` -> `小狗相机助手`
- `租赁履约与会话工作台` -> `相机租赁运营工作台`
- `闲鱼助手图标` -> `小狗相机助手图标`
- `<title>XianyuAutoAgent</title>` -> `<title>小狗相机助手</title>`
- package description -> `小狗相机助手桌面版 - 相机租赁运营与 AI 客服工作台`
- Topbar search text -> `搜索订单、客户、设备、操作...`
- `/orders` page label -> `订单履约`

- [ ] **Step 2: Do not change packaging identity**

Keep `electron/electron-builder.yml` unchanged in this phase, because changing `productName` can affect executable names and requires launcher script synchronization.

### Task 3: Add Cloud Deployment Guide

**Files:**
- Create: `docs/deployment/xiaogou-camera-assistant-cloud.md`

- [ ] **Step 1: Document the current deployable path**

Explain that the current app is an Electron desktop app. The practical cloud path is: cloud MySQL or managed database, backup, monitoring, HTTPS download/status page, and optional API gateway.

- [ ] **Step 2: Document fixed domain binding**

Include DNS A/CNAME records, Nginx reverse proxy, HTTPS via Certbot, firewall rules, and renewal checks.

- [ ] **Step 3: Document future SaaS path**

Explain that a true domain-hosted web app needs a later architecture phase: web build, backend API, authentication, tenant isolation, secrets management, and deployment pipeline.

### Task 4: Verify

**Files:**
- Test: `electron/tests/brandIdentity.test.mjs`

- [ ] **Step 1: Run focused brand test**

Run: `cd electron && node --test tests/brandIdentity.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run renderer build**

Run: `cd electron && npm run build:renderer`

Expected: Vite build exits 0.

