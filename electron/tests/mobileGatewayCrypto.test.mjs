import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { decryptFeishuPayload, inspectFeishuEventPayload } = require('../main/mobileGateway.js')

function encryptFeishuPayload(payload, encryptKey) {
  const key = crypto.createHash('sha256').update(encryptKey, 'utf8').digest()
  const iv = Buffer.from('1234567890abcdef')
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return Buffer.concat([iv, encrypted]).toString('base64')
}

test('decrypts Feishu encrypted event payloads', () => {
  const config = { FEISHU_ENCRYPT_KEY: 'test-encrypt-key' }
  const original = {
    type: 'url_verification',
    token: 'verify-token',
    challenge: 'challenge-value',
  }

  const encrypted = { encrypt: encryptFeishuPayload(original, config.FEISHU_ENCRYPT_KEY) }

  assert.deepEqual(decryptFeishuPayload(encrypted, config), original)
})

test('passes through plain Feishu payloads', () => {
  const payload = { type: 'url_verification', challenge: 'plain' }
  assert.equal(decryptFeishuPayload(payload, { FEISHU_ENCRYPT_KEY: '' }), payload)
})

test('inspects encrypted Feishu card action payloads', () => {
  const config = {
    FEISHU_ENCRYPT_KEY: 'test-encrypt-key',
    FEISHU_VERIFICATION_TOKEN: 'verify-token',
  }
  const original = {
    schema: '2.0',
    header: { event_type: 'card.action.trigger' },
    event: {
      token: 'verify-token',
      action: {
        value: {
          action_type: 'confirm_booking',
        },
      },
    },
  }

  const inspected = inspectFeishuEventPayload(
    { encrypt: encryptFeishuPayload(original, config.FEISHU_ENCRYPT_KEY) },
    config,
  )

  assert.equal(inspected.eventType, 'card.action.trigger')
  assert.equal(inspected.action?.action_type, 'confirm_booking')
  assert.equal(inspected.isCardActionTrigger, true)
  assert.deepEqual(inspected.payload, original)
})
