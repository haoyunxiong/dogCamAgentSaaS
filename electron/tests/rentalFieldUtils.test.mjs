import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addLocalDateDays,
  buildRentDaySuggestions,
  diffInclusiveLocalDates,
  normalizeRentDayInput,
} from '../renderer/src/components/rentalFieldUtils.js'

test('buildRentDaySuggestions returns 1 to 30 day options by default', () => {
  const suggestions = buildRentDaySuggestions()
  assert.equal(suggestions.length, 30)
  assert.deepEqual(suggestions[0], { value: 1, label: '1天' })
  assert.deepEqual(suggestions[29], { value: 30, label: '30天' })
})

test('normalizeRentDayInput keeps positive integers and accepts larger manual values', () => {
  assert.equal(normalizeRentDayInput('5'), 5)
  assert.equal(normalizeRentDayInput('45天'), 45)
  assert.equal(normalizeRentDayInput(120), 120)
})

test('normalizeRentDayInput rejects empty and non-positive values', () => {
  assert.equal(normalizeRentDayInput(''), null)
  assert.equal(normalizeRentDayInput('abc'), null)
  assert.equal(normalizeRentDayInput('0'), null)
})

test('addLocalDateDays keeps calendar dates stable across local timezone math', () => {
  assert.equal(addLocalDateDays('2026-05-25', 3), '2026-05-28')
  assert.equal(addLocalDateDays('2026-05-25', 0), '2026-05-25')
})

test('diffInclusiveLocalDates returns inclusive rent day count', () => {
  assert.equal(diffInclusiveLocalDates('2026-05-25', '2026-05-28'), 4)
  assert.equal(diffInclusiveLocalDates('2026-05-25', '2026-05-25'), 1)
})
