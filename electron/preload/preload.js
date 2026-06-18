const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Bot control
  botStart: () => ipcRenderer.invoke('bot:start'),
  botStop: () => ipcRenderer.invoke('bot:stop'),

  // Event listeners (push from main process)
  onBotStatus: (cb) => ipcRenderer.on('bot:status', (_event, msg) => cb(msg)),
  onBotLog: (cb) => ipcRenderer.on('bot:log', (_event, msg) => cb(msg)),
  onBotError: (cb) => ipcRenderer.on('bot:error', (_event, msg) => cb(msg)),

  // Remove all listeners for a channel
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),
  safeOps: {
    getPolicy: (payload) => ipcRenderer.invoke('safeOps:policy', payload || {}),
    preview: (payload) => ipcRenderer.invoke('safeOps:preview', payload || {}),
  },

  // Prompts
  getPrompts: () => ipcRenderer.invoke('prompts:get'),
  savePrompts: (data) => ipcRenderer.invoke('prompts:save', data),
  getDefaultPrompts: () => ipcRenderer.invoke('prompts:get_defaults'),

  // AI prompt generation
  generatePrompts: (chatLog) => ipcRenderer.invoke('prompts:generate', chatLog),
  onGeneratePromptsResult: (cb) => ipcRenderer.on('bot:generate_prompts_result', (_event, msg) => cb(msg)),

  // Knowledge base
  listKnowledge: (opts) => ipcRenderer.invoke('knowledge:list', opts),
  addKnowledge: (data) => ipcRenderer.invoke('knowledge:add', data),
  updateKnowledge: (data) => ipcRenderer.invoke('knowledge:update', data),
  deleteKnowledge: (data) => ipcRenderer.invoke('knowledge:delete', data),
  batchAddKnowledge: (data) => ipcRenderer.invoke('knowledge:batchAdd', data),
  generateFromImage: () => ipcRenderer.invoke('knowledge:generateFromImage'),
  generateFromChat: (data) => ipcRenderer.invoke('knowledge:generateFromChat', data),
  onKnowledgeGenerateResult: (cb) => ipcRenderer.on('bot:knowledge_generate_result', (_event, msg) => cb(msg)),
  onKnowledgeGenerateError: (cb) => ipcRenderer.on('bot:knowledge_generate_error', (_event, msg) => cb(msg)),
  // Clean up both knowledge event listeners (called in KnowledgeBase.vue onUnmounted)
  removeAllKnowledgeListeners: () => {
    ipcRenderer.removeAllListeners('bot:knowledge_generate_result')
    ipcRenderer.removeAllListeners('bot:knowledge_generate_error')
  },

  // 租赁运营
  listTakeovers: (filters) => ipcRenderer.invoke('takeover:list', filters),
  acceptTakeover: (data) => ipcRenderer.invoke('takeover:accept', data),
  closeTakeover: (data) => ipcRenderer.invoke('takeover:close', data),

  // 会话回复状态机（Phase 1）
  listSessionStates: (filters) => ipcRenderer.invoke('session:list', filters),
  resetSessionState: (sessionId) => ipcRenderer.invoke('session:reset', { sessionId }),
  listStores: (filters) => ipcRenderer.invoke('stores:list', filters || {}),
  listInquiryEvents: (filters) => ipcRenderer.invoke('inquiries:list', filters || {}),
  getInquiryStats: (filters) => ipcRenderer.invoke('inquiries:stats', filters || {}),
  getRentalOptimizationSuggestions: (filters) => ipcRenderer.invoke('inquiryOptimization:suggestions', filters || {}),
  getRentalOptimizationConfig: () => ipcRenderer.invoke('inquiryOptimization:getConfig'),
  saveRentalOptimizationConfig: (payload) => ipcRenderer.invoke('inquiryOptimization:saveConfig', payload || {}),

  listScheduleUnits: (filters) => ipcRenderer.invoke('schedule:units:list', filters),
  saveScheduleUnit: (data) => ipcRenderer.invoke('schedule:units:save', data),
  updateScheduleUnitsByModel: (data) => ipcRenderer.invoke('schedule:units:updateByModel', data),
  deleteScheduleUnit: (data) => ipcRenderer.invoke('schedule:units:delete', data),
  listScheduleBlocks: (filters) => ipcRenderer.invoke('schedule:blocks:list', filters),
  getScheduleMonthlyOverview: (filters) => ipcRenderer.invoke('schedule:monthlyOverview', filters),
  checkScheduleAvailability: (data) => ipcRenderer.invoke('schedule:availability', data),

  // Sprint 4: 租赁定价 & 商品型号绑定维护
  listPricing: (filters) => ipcRenderer.invoke('pricing:list', filters || {}),
  upsertPricing: (data) => ipcRenderer.invoke('pricing:upsert', data),
  deletePricing: (data) => ipcRenderer.invoke('pricing:delete', data),
  savePricingLadder: (data) => ipcRenderer.invoke('pricing:saveLadder', data),
  deletePricingByModel: (data) => ipcRenderer.invoke('pricing:deleteByModel', data),
  listDepositExemptionRules: (filters) => ipcRenderer.invoke('pricing:depositRules:list', filters || {}),
  upsertDepositExemptionRule: (data) => ipcRenderer.invoke('pricing:depositRules:upsert', data),
  deleteDepositExemptionRule: (data) => ipcRenderer.invoke('pricing:depositRules:delete', data),
  listItemMapping: (filters) => ipcRenderer.invoke('itemMap:list', filters || {}),
  upsertItemMapping: (data) => ipcRenderer.invoke('itemMap:upsert', data),
  deleteItemMapping: (data) => ipcRenderer.invoke('itemMap:delete', data),
  listItemListings: (filters) => ipcRenderer.invoke('itemListings:list', filters || {}),
  syncItemListingsFromLocalCache: (data) => ipcRenderer.invoke('itemListings:syncLocalCache', data || {}),
  reviewItemListing: (data) => ipcRenderer.invoke('itemListings:review', data || {}),
  markItemDetailDirty: (data) => ipcRenderer.invoke('itemDetail:markDirty', data),

  listOrders: (filters) => ipcRenderer.invoke('orders:list', filters),
  listOrderGroups: (filters) => ipcRenderer.invoke('orders:groups', filters),
  getOrderOverviewStats: (filters) => ipcRenderer.invoke('orders:overviewStats', filters || {}),
  getOrderActionAlerts: () => ipcRenderer.invoke('orders:actionAlerts'),
  getOrderDetail: (data) => ipcRenderer.invoke('orders:getDetail', data),
  createOrder: (data) => ipcRenderer.invoke('orders:create', data),
  updateOrder: (data) => ipcRenderer.invoke('orders:update', data),
  deleteOrder: (data) => ipcRenderer.invoke('orders:delete', data),
  updateOrderFee: (data) => ipcRenderer.invoke('orders:updateFee', data),
  previewOrderImportExcel: () => ipcRenderer.invoke('orders:importExcel:preview'),
  executeOrderImportExcel: (data) => ipcRenderer.invoke('orders:importExcel:execute', data),
  updateOrderShipping: (data) => ipcRenderer.invoke('orders:updateShipping', data),
  markOrderReturned: (data) => ipcRenderer.invoke('orders:markReturned', data),
  initiateReturnSchedule: (data) => ipcRenderer.invoke('orders:initiateReturn', data),
  autoInitiateReturns: (data) => ipcRenderer.invoke('orders:autoInitiateReturns', data),
  extendOrder: (data) => ipcRenderer.invoke('orders:extend', data),
  batchShipOrders: (data) => ipcRenderer.invoke('orders:batchShip', data),
  batchReturnOrders: (data) => ipcRenderer.invoke('orders:batchReturn', data),
  batchExtendOrders: (data) => ipcRenderer.invoke('orders:batchExtend', data),
  listShippingRecords: (data) => ipcRenderer.invoke('orders:shippingRecords', data),
  getXiaohongshuKeyword: (data) => ipcRenderer.invoke('assistant:xiaohongshuKeyword', data),
  estimateShipping: (data) => ipcRenderer.invoke('shipping:estimate', data),
  queryLogistics: (data) => ipcRenderer.invoke('shipping:query', data),
  listSfShipments: (filters) => ipcRenderer.invoke('sfShipments:list', filters || {}),
  getSfShipmentDetail: (data) => ipcRenderer.invoke('sfShipments:detail', data),
  saveSfShipmentDraft: (data) => ipcRenderer.invoke('sfShipments:saveDraft', data),
  precheckSfShipment: (data) => ipcRenderer.invoke('sfShipments:precheck', data),
  placeSfShipment: (data) => ipcRenderer.invoke('sfShipments:place', data),
  submitSfShipment: (data) => ipcRenderer.invoke('sfShipments:submit', data),
  recoverSfShipmentResult: (data) => ipcRenderer.invoke('sfShipments:recoverResult', data),
  quoteSfExpress: (data) => ipcRenderer.invoke('sfShipments:quoteExpress', data),
  cancelSfShipment: (data) => ipcRenderer.invoke('sfShipments:cancel', data),
  querySfShipmentRoutes: (data) => ipcRenderer.invoke('sfShipments:routes', data),
  querySfShipmentFee: (data) => ipcRenderer.invoke('sfShipments:fee', data),
  listSfPendingShipmentOrders: (data) => ipcRenderer.invoke('sfShipments:pendingOrders', data || {}),
  batchPlaceSfShipments: (data) => ipcRenderer.invoke('sfShipments:batchPlace', data),
  updateSfShipmentActualPaid: (data) => ipcRenderer.invoke('sfShipments:actualPaid', data),
  querySfShipmentPromiseTime: (data) => ipcRenderer.invoke('sfShipments:promiseTime', data),
  quoteSfIntraCity: (data) => ipcRenderer.invoke('sfShipments:intraCityQuote', data),

  listLearningCandidates: (filters) => ipcRenderer.invoke('learning:list', filters),
  approveLearningCandidate: (data) => ipcRenderer.invoke('learning:approve', data),
  rejectLearningCandidate: (data) => ipcRenderer.invoke('learning:reject', data),
  extractLearningFromHistory: (data) => ipcRenderer.invoke('learning:extractHistory', data),
  onHistoryLearningResult: (cb) => ipcRenderer.on('bot:history_learning_result', (_event, msg) => cb(msg)),
  syncBrowserHistory: (data) => ipcRenderer.invoke('learning:syncBrowserHistory', data),
  onBrowserHistorySyncResult: (cb) => ipcRenderer.on('bot:browser_history_sync_result', (_event, msg) => cb(msg)),
  listStructuredSuggestions: (filters) => ipcRenderer.invoke('learning:structured:list', filters || {}),
  updateStructuredSuggestion: (data) => ipcRenderer.invoke('learning:structured:update', data),
  dedupLegacyLearningCandidates: () => ipcRenderer.invoke('learning:dedup_legacy'),

  getDashboardStats: () => ipcRenderer.invoke('dashboard:stats'),
  getOpsMetrics: () => ipcRenderer.invoke('dashboard:ops_metrics'),
  getSystemCheck: () => ipcRenderer.invoke('system:check'),

  // 飞书待确认回复
  listFeishuPending: (filters) => ipcRenderer.invoke('feishu:pending:list', filters || {}),
  approveFeishuPending: (data) => ipcRenderer.invoke('feishu:pending:approve', data),
  rejectFeishuPending: (data) => ipcRenderer.invoke('feishu:pending:reject', data),

  // 市场监控
  listMarketSnapshots: (filters) => ipcRenderer.invoke('market:snapshots', filters || {}),
  getMarketTrend: (data) => ipcRenderer.invoke('market:trend', data),
  getMarketAlerts: (data) => ipcRenderer.invoke('market:alerts', data),
  startMarketScan: (data) => ipcRenderer.invoke('market:startScan', data),
  onMarketScanResult: (cb) => ipcRenderer.on('bot:market_scan_result', (_event, msg) => cb(msg)),

  // 费用报表
  addExpense: (data) => ipcRenderer.invoke('expense:add', data),
  saveExpenseRecord: (data) => ipcRenderer.invoke('expenseRecords:save', data || {}),
  uploadMonthlyShippingBill: (data) => ipcRenderer.invoke('expenseRecords:uploadMonthlyShippingBill', data || {}),
  listExpenses: (filters) => ipcRenderer.invoke('expense:list', filters || {}),
  getRevenueReport: (filters) => ipcRenderer.invoke('report:revenue', filters || {}),

  // Open URL in system browser
  openUrl: (url) => ipcRenderer.invoke('shell:open_url', url),

  // 闲管家开放平台 (open.goofish.pro)
  xgjStatus: () => ipcRenderer.invoke('xgj:status'),
  xgjListShops: () => ipcRenderer.invoke('xgj:listShops'),
  xgjListOrders: (body) => ipcRenderer.invoke('xgj:listOrders', body),
  xgjGetOrderDetail: (data) => ipcRenderer.invoke('xgj:getOrderDetail', data),
  xgjShipOrder: (data) => ipcRenderer.invoke('xgj:shipOrder', data),
  xgjUpdateOrderPrice: (data) => ipcRenderer.invoke('xgj:updateOrderPrice', data),
  xgjListProducts: (body) => ipcRenderer.invoke('xgj:listProducts', body),
  xgjGetProductDetail: (data) => ipcRenderer.invoke('xgj:getProductDetail', data),
  xgjOnlineProduct: (data) => ipcRenderer.invoke('xgj:onlineProduct', data),
  xgjOfflineProduct: (data) => ipcRenderer.invoke('xgj:offlineProduct', data),
  xgjUpdateStock: (data) => ipcRenderer.invoke('xgj:updateStock', data),
  xgjListExpress: () => ipcRenderer.invoke('xgj:listExpress'),

  // 免押开放平台（不暴露 appSecret 查询）
  depositCreateOrder: (params, settings) => ipcRenderer.invoke('deposit:createOrder', params, settings),
  depositGetOrderDetail: (data, settings) => ipcRenderer.invoke('deposit:getOrderDetail', data, settings),
  depositListOrders: (filters, settings) => ipcRenderer.invoke('deposit:listOrders', filters || {}, settings),
  depositFinishOrder: (data, settings) => ipcRenderer.invoke('deposit:finishOrder', data, settings),
  depositListStoredOrders: (filters) => ipcRenderer.invoke('deposit:listStoredOrders', filters || {}),
  depositGetStoredOrder: (data) => ipcRenderer.invoke('deposit:getStoredOrder', data || {}),
  depositBindOrderSource: (data) => ipcRenderer.invoke('deposit:bindOrderSource', data || {}),
  depositNotifyStatusChange: (data) => ipcRenderer.invoke('deposit:notifyStatusChange', data || {}),
  depositNotifyServerStatus: () => ipcRenderer.invoke('deposit:notifyServerStatus'),
  onDepositStatusChanged: (cb) => {
    const handler = (_event, msg) => cb(msg)
    ipcRenderer.on('deposit:statusChanged', handler)
    return () => ipcRenderer.removeListener('deposit:statusChanged', handler)
  },
  depositFetchImageDataUrl: (url) => ipcRenderer.invoke('deposit:fetchImageDataUrl', { url }),
})
