import test from 'node:test'
import assert from 'node:assert/strict'

import { hasElectronApi, isBrowserPreview } from '../renderer/src/utils/runtimeMode.mjs'

test('hasElectronApi detects an injected preload bridge', () => {
  assert.equal(hasElectronApi({ electronAPI: {} }), true)
  assert.equal(hasElectronApi({}), false)
  assert.equal(hasElectronApi(null), false)
})

test('isBrowserPreview is true only when Electron preload is absent', () => {
  assert.equal(isBrowserPreview({}), true)
  assert.equal(isBrowserPreview({ electronAPI: { getConfig() {} } }), false)
})
