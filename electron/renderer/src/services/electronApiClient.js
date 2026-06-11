export const configApi = {
  get: () => window.electronAPI.getConfig(),
}

export const sfApi = {
  quoteExpress: (payload) => window.electronAPI.quoteSfExpress(payload),
  saveShipmentDraft: (payload) => window.electronAPI.saveSfShipmentDraft(payload),
  quoteIntraCity: (payload) => window.electronAPI.quoteSfIntraCity(payload),
  precheckShipment: (payload) => window.electronAPI.precheckSfShipment(payload),
  placeShipment: (payload) => window.electronAPI.placeSfShipment(payload),
  listShipments: (filters) => window.electronAPI.listSfShipments(filters),
  listPendingShipmentOrders: (payload) => window.electronAPI.listSfPendingShipmentOrders(payload),
  batchPlaceShipments: (payload) => window.electronAPI.batchPlaceSfShipments(payload),
  detail: (payload) => window.electronAPI.getSfShipmentDetail(payload),
  recoverResult: (payload) => window.electronAPI.recoverSfShipmentResult(payload),
  cancelShipment: (payload) => window.electronAPI.cancelSfShipment(payload),
  queryPromiseTime: (payload) => window.electronAPI.querySfShipmentPromiseTime(payload),
  queryRoutes: (payload) => window.electronAPI.querySfShipmentRoutes(payload),
  queryFee: (payload) => window.electronAPI.querySfShipmentFee(payload),
  updateActualPaid: (payload) => window.electronAPI.updateSfShipmentActualPaid(payload),
}

export function getErrorMessage(error, fallback = '操作失败') {
  return error?.message || error?.msg || String(error || fallback)
}
