const {
  addRecord,
  createDateRangeReview,
  firstText,
  isValidNumberLike,
} = require('./safeOpsValidationUtils')

function addDepositRecords(records, request = {}) {
  const target = request.target || {}
  const payload = request.payload || {}

  addRecord(records, 'deposit', firstText(target.id, payload.depositOrderId, payload.depositOrderNo))
  addRecord(records, 'order', firstText(payload.orderId, payload.orderNo))
  addRecord(records, 'customer', firstText(payload.customerId, payload.customerName, payload.customer))
  addRecord(records, 'model', payload.modelCode)
}

function getRentalPeriod(payload = {}) {
  const rentalPeriod = payload.rentalPeriod || {}
  return {
    startDate: firstText(payload.rentStartDate, payload.startDate, rentalPeriod.startDate),
    endDate: firstText(payload.rentEndDate, payload.endDate, rentalPeriod.endDate),
  }
}

function buildDepositCreatePreview(request = {}) {
  const payload = request.payload || {}
  const warnings = []
  const blockers = []
  const records = []
  const orderRef = firstText(request.target?.orderId, request.target?.id, payload.orderId, payload.orderNo)
  const customerRef = firstText(payload.customerId, payload.customerName, payload.customer)
  const amount = firstText(payload.amount, payload.depositAmount, payload.requestedFreeAmount)
  const rentalPeriod = getRentalPeriod(payload)

  addDepositRecords(records, request)

  if (!orderRef) warnings.push('Missing orderId/orderNo; deposit create impact can only be summarized at payload level.')
  if (!customerRef) warnings.push('Missing customer/customerName/customerId; deposit risk review cannot be precise.')
  if (!amount) {
    warnings.push('Missing amount/depositAmount/requestedFreeAmount; deposit amount impact can only be summarized at payload level.')
  } else if (!isValidNumberLike(amount)) {
    blockers.push('Deposit amount must be numeric when supplied.')
  }

  if (!rentalPeriod.startDate || !rentalPeriod.endDate) {
    warnings.push('Missing rentalPeriod start/end date; deposit rental scope cannot be precise.')
  } else {
    blockers.push(...createDateRangeReview({
      startDate: rentalPeriod.startDate,
      endDate: rentalPeriod.endDate,
      startLabel: 'rentalPeriod.startDate',
      endLabel: 'rentalPeriod.endDate',
    }).blockers)
  }

  warnings.push('This is a static deposit create review only; real approval rules, signed payload, and stored cache changes require a later confirmed flow.')

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for deposit create ${orderRef || 'without order id'}. This will not create a deposit order, change approval status, or write local cache.`,
      affectedRecords: records,
      externalEffects: [
        'Future confirmed deposit create flow may create a deposit order.',
        'Future confirmed deposit create flow may change deposit approval state.',
      ],
    },
  }
}

function buildDepositFinishPreview(request = {}) {
  const payload = request.payload || {}
  const warnings = []
  const blockers = []
  const records = []
  const depositRef = firstText(request.target?.depositOrderId, request.target?.id, payload.depositOrderId, payload.depositOrderNo)
  const orderRef = firstText(request.target?.orderId, payload.orderId, payload.orderNo)

  addDepositRecords(records, request)

  if (!depositRef && !orderRef) {
    blockers.push('Missing depositOrderId/depositOrderNo or orderId/orderNo; deposit finish target is required.')
  }

  warnings.push('This is a static deposit finish review only; real completion rules, signed payload, and stored cache changes require a later confirmed flow.')

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for deposit finish ${depositRef || orderRef || 'without target id'}. This will not finish a deposit order, change approval status, or write local cache.`,
      affectedRecords: records,
      externalEffects: [
        'Future confirmed deposit finish flow may change deposit order state.',
        'Future confirmed deposit finish flow may affect deposit completion records.',
      ],
    },
  }
}

module.exports = {
  buildDepositCreatePreview,
  buildDepositFinishPreview,
}
