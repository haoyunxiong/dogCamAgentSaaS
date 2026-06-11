/**
 * 免押模块统一配置
 * 所有固定展示信息和 API 配置集中管理。
 */

// ═══════════════════════════════════════
//  展示配置
// ═══════════════════════════════════════

export const depositDisplayConfig = {
  // 品牌
  merchantName: '小狗相机租赁',
  posterTitle: '小狗相机租赁 · 支付宝免押确认',
  posterSubtitle: '请使用支付宝扫码完成免押授权',
  posterQRHint: '打开支付宝扫一扫',
  posterQRFallback: '二维码加载失败\n请复制邀约文本',

  // 有效期
  expiresInText: '24小时',
  expiresInLabel: '二维码有效期：24小时',

  // 联系方式
  contactPhones: '19822964925，13060186655',
  workTime: '09:30-00:30',

  // 温馨提示
  tipsTitle: '温馨提示',
  tips: [
    '1. 请确认支付宝账号为本人实名账号',
    '2. 如扫码后无反应，请使用最新版支付宝重试',
    '3. 本二维码有效期为 24 小时，过期请联系商家重新生成',
    '4. 免押结果将同步给商家',
  ],

  // 流程步骤
  processSteps: ['支付宝扫码', '核对信息', '信用评估', '开启免押'],
}

// ═══════════════════════════════════════
//  API 配置
// ═══════════════════════════════════════

export const depositApiConfig = {
  // ── 模式 ──
  mode: 'mock',               // 'mock' | 'real'

  // ── 接口地址 ──
  baseUrl: '',                 // real 模式时填写，例如 'https://api.example.com'
  timeoutMs: 10000,            // 请求超时毫秒

  // ── 免押开放平台必需字段 ──
  // appId / appSecret 为敏感凭据，建议通过主进程配置（Settings 顶部保存按钮）写入 SQLite，
  // 不在 renderer localStorage 中长期存储。
  // 联调阶段可临时在设置页填写，但正式环境必须迁移。
  userEid: '',                 // 服务商 EID，创建/详情接口 Header 必填

  // ── 可选字段 ──
  notifyUrl: '',               // 异步通知地址
  contractSupplementaryContent: '', // 合同补充内容模板（空则自动拼接）
  receivingInfoFallback: '待补充',  // 收货信息兜底文案

  // ── 鉴权（保留兼容，real 模式走主进程 appId/appSecret） ──
  auth: {
    type: 'none',
    token: '',
    apiKey: '',
    headerName: 'Authorization',
  },

  // ── 商户/租户标识（保留兼容） ──
  merchant: {
    merchantId: '',
    appId: '',
    tenantId: '',
  },

  // ── 基础 Headers ──
  headers: {
    'Content-Type': 'application/json',
  },

  // ── 接口路径（真实接口路径固定，此处为参考） ──
  endpoints: {
    create: '/openapi/order/createMerchantDepositOrder',   // POST
    list: '/openapi/order/getMerchantDepositOrders',       // GET
    detail: '/openapi/order/getMerchantDepositOrderDetail',// GET ?orderNo=xxx
    complete: '/openapi/order/finishMerchantDepositOrder', // POST
  },

  // ── 请求体字段映射：前端 camelCase → 后端字段名 ──
  requestFieldMap: {
    sourceOrderId: 'sourceOrderId',
    sourceOrderNo: 'sourceOrderNo',
    productName: 'productName',
    modelCode: 'modelCode',
    unitCode: 'unitCode',
    customerName: 'customerName',
    customerPhone: 'customerPhone',
    depositAmount: 'depositAmount',
    rentAmount: 'rentAmount',
    rentStartDate: 'rentStartDate',
    rentEndDate: 'rentEndDate',
    rentDays: 'rentDays',
    sourceType: 'sourceType',
  },

  // ── 响应字段候选：前端字段 → 后端可能的字段名数组 ──
  responseFieldMap: {
    depositOrderNo: ['orderNo', 'out_order_no', 'depositOrderNo', 'depositNo', 'id'],
    reviewUrl: ['scheme_url', 'reviewUrl', 'qr_code_url'],
    qrImageUrl: ['qr_code_url', 'qrImageUrl', 'qrCodeUrl', 'qrCode'],
    status: ['deposit_status', 'status'],
    sourceOrderId: ['sourceOrderId', 'source_order_id'],
    sourceOrderNo: ['sourceOrderNo', 'source_order_no'],
    productName: ['product_name', 'productName'],
    modelCode: ['modelCode', 'model_code'],
    unitCode: ['unitCode', 'unit_code'],
    customerName: ['customer_nickname', 'customerName', 'customer_name'],
    customerPhone: ['customer_mobile', 'customerPhone', 'customer_phone'],
    depositAmount: ['product_deposit', 'depositAmount', 'deposit_amount'],
    rentAmount: ['count_deposit_price', 'daily_deposit_price', 'rentAmount', 'rent_amount'],
    rentStartDate: ['rent_start_time', 'rentStartDate', 'rent_start_date'],
    rentEndDate: ['rent_end_time', 'rentEndDate', 'rent_end_date'],
    rentDays: ['rentDays', 'rent_days', 'deposit_period'],
    expiresInText: ['expiresInText', 'expires_in_text'],
    contactPhones: ['contactPhones', 'contact_phones'],
    workTime: ['workTime', 'work_time'],
    createdAt: ['create_time', 'createdAt', 'created_at'],
    updatedAt: ['updatedAt', 'updated_at', 'create_time'],
  },

  // ── deposit_status 映射（文档枚举） ──
  statuses: {
    pending_review: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    cancelled: '已取消',
    completed: '已完结',
  },

  // deposit_status 数值 → 前端状态
  depositStatusMap: {
    0: 'pending_review',  // 待授权
    1: 'approved',        // 免押中
    2: 'completed',       // 已完结
    3: 'cancelled',       // 已取消
  },
}
