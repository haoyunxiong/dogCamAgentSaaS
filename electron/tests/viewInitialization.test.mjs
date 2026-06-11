import test from 'node:test'
import assert from 'node:assert/strict'

import { describeViewError } from '../renderer/src/utils/viewInitialization.mjs'

test('describeViewError prefers explicit string errors', () => {
  assert.equal(describeViewError('  读取配置失败  '), '读取配置失败')
})

test('describeViewError falls back to error.message', () => {
  assert.equal(describeViewError(new Error('IPC failed')), 'IPC failed')
})

test('describeViewError uses fallback for unknown values', () => {
  assert.equal(describeViewError(null, '默认失败文案'), '默认失败文案')
})
