const {
  addRecord,
  firstText,
} = require('./safeOpsValidationUtils')

function readPartyField(payload = {}, partyName, fieldName, ...fallbacks) {
  const party = payload[partyName] || {}
  return firstText(party[fieldName], ...fallbacks)
}

function addLogisticsRecords(records, request = {}) {
  const target = request.target || {}
  const payload = request.payload || {}

  addRecord(records, 'shipment', firstText(target.id, payload.shipmentId, payload.waybillId))
  addRecord(records, 'order', firstText(payload.orderId, payload.orderNo))
  addRecord(records, 'unit', firstText(payload.unitId, payload.deviceId))
  addRecord(records, 'model', payload.modelCode)
}

function buildLogisticsShipmentPreview(request = {}) {
  const payload = request.payload || {}
  const warnings = []
  const blockers = []
  const records = []
  const orderRef = firstText(request.target?.orderId, request.target?.id, payload.orderId, payload.orderNo)
  const receiverName = readPartyField(payload, 'receiver', 'name', payload.receiverName, payload.customerName)
  const receiverPhone = readPartyField(payload, 'receiver', 'phone', payload.receiverPhone, payload.phone)
  const receiverAddress = readPartyField(payload, 'receiver', 'address', payload.receiverAddress, payload.address)
  const senderName = readPartyField(payload, 'sender', 'name', payload.senderName)
  const senderPhone = readPartyField(payload, 'sender', 'phone', payload.senderPhone)
  const senderAddress = readPartyField(payload, 'sender', 'address', payload.senderAddress)

  addLogisticsRecords(records, request)

  if (!orderRef) warnings.push('Missing orderId/orderNo; shipment impact can only be summarized at payload level.')
  if (!receiverName) warnings.push('Missing receiver name; shipment preview cannot verify receiver identity.')
  if (!receiverPhone) warnings.push('Missing receiver phone; shipment preview cannot verify contact data.')
  if (!receiverAddress) warnings.push('Missing receiver address; shipment preview cannot verify delivery address.')
  if (!senderName) warnings.push('Missing sender name; later carrier form review cannot be precise.')
  if (!senderPhone) warnings.push('Missing sender phone; later carrier form review cannot be precise.')
  if (!senderAddress) warnings.push('Missing sender address; later carrier form review cannot be precise.')

  warnings.push('This is a static shipment review only; real carrier rules, fees, waybill creation, and order state changes require a later confirmed flow.')

  return {
    warnings,
    blockers,
    impact: {
      summary: `Static dry-run preview for shipment ${orderRef || 'without order id'}. This will not save a draft, create a waybill, call carrier services, charge fees, or change order state.`,
      affectedRecords: records,
      externalEffects: [
        'Future confirmed shipment flow may create a carrier waybill.',
        'Future confirmed shipment flow may create carrier fees.',
      ],
    },
  }
}

module.exports = {
  buildLogisticsShipmentPreview,
}
