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
