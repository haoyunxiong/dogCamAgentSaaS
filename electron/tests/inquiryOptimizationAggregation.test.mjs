import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  allocateMonthlyShippingExpense,
  allocateMonthlyShippingExpenseByOrderCount,
} = require('../main/inquiryOptimizationEngine.js')

test('allocates monthly shipping bill evenly by order count', () => {
  const rows = allocateMonthlyShippingExpenseByOrderCount({
    total: 300,
    orders: [{ id: 1 }, { id: 2 }, { id: 3 }],
  })

  assert.deepEqual(rows.map((item) => item.amount), [100, 100, 100])
  assert.equal(rows.reduce((sum, item) => sum + item.amount, 0), 300)
})

test('uses the order_count shipping allocation mode when dispatching monthly shipping expenses', () => {
  const rows = allocateMonthlyShippingExpense({
    total: 300,
    orders: [{ id: 1 }, { id: 2 }, { id: 3 }],
    mode: 'order_count',
  })

  assert.deepEqual(rows.map((item) => item.amount), [100, 100, 100])
})
