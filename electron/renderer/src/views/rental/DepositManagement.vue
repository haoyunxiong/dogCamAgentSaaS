<template>
  <div class="page deposit-page">
    <PageHeader
      title="免押管理"
      subtitle="管理支付宝免押审核单，跟进用户审核进度、复制邀约文本、保存图片"
      :breadcrumb="['经营管理', '免押管理']"
    >
      <template #actions>
        <button class="btn btn-secondary" @click="loadOrders">↻ 刷新</button>
        <button class="btn btn-primary" @click="openManualCreate">新建免押单</button>
      </template>
    </PageHeader>

    <KpiStrip :items="kpiItems" :active-key="activeKpiKey" @select="setStatusFilter" />

    <FilterBar>
      <div class="filter-row">
        <div class="filter-group filter-kw">
          <label>关键词</label>
          <input
            v-model="filters.keyword"
            placeholder="免押单号 / 来源订单 / 客户 / 手机号 / 设备编号"
            @keyup.enter="onFilterChange"
          />
        </div>
        <div class="filter-group">
          <label>状态</label>
          <select v-model="filters.status" @change="onStatusFilterChange">
            <option value="">全部状态</option>
            <option v-for="s in statusOptions.filter(x => x.key)" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>是否最新</label>
          <select v-model="filters.isLatest" @change="onFilterChange">
            <option value="">全部</option>
            <option value="true">最新</option>
            <option value="false">历史</option>
          </select>
        </div>
        <div class="filter-group">
          <label>型号</label>
          <select v-model="filters.modelCode" @change="onFilterChange">
            <option value="">全部型号</option>
            <option v-for="model in filterModelOptions" :key="model" :value="model">{{ model }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>租期开始</label>
          <input v-model="filters.rentFrom" type="date" @change="onFilterChange" />
        </div>
        <div class="filter-group">
          <label>租期结束</label>
          <input v-model="filters.rentTo" type="date" @change="onFilterChange" />
        </div>
        <button class="btn btn-primary" @click="onFilterChange">筛选</button>
        <button v-if="hasFilter" class="btn btn-secondary" @click="resetFilters">重置</button>
      </div>
    </FilterBar>

    <BatchActionBar :visible="selectedDepositNos.length > 0" :label="`已选择 ${selectedDepositNos.length} 个免押单`">
        <button v-if="!isRealMode" class="btn btn-secondary btn-sm" :disabled="!batchCancelableNos.length" @click="batchCancelSelected">批量取消</button>
        <button class="btn btn-secondary btn-sm" :disabled="!batchCompletableNos.length" @click="batchCompleteSelected">批量完结</button>
        <button v-if="!isRealMode" class="btn btn-secondary btn-sm" :disabled="!batchDeletableNos.length" @click="batchDeleteSelected">批量删除</button>
        <button class="btn btn-secondary btn-sm" @click="clearSelection">取消选择</button>
    </BatchActionBar>

    <div v-if="message" class="banner banner-info">{{ message }}</div>

    <section class="panel table-panel">
      <DataTable compact>
          <thead>
            <tr>
              <th style="width:36px">
                <input type="checkbox" :checked="allVisibleSelected" @change="toggleVisibleSelection" />
              </th>
              <th>免押单信息</th>
              <th>客户</th>
              <th>商品/设备</th>
              <th>金额信息</th>
              <th>租期</th>
              <th>状态</th>
              <th style="width:148px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="depositOrders.length === 0">
              <td colspan="8" class="empty-cell">
                <div class="empty-hint">暂无免押单数据</div>
              </td>
            </tr>
            <template v-for="order in depositOrders" :key="order.depositOrderNo">
              <tr>
                <td>
                  <input type="checkbox" :checked="selectedDepositNos.includes(order.depositOrderNo)" @change="toggleSelection(order.depositOrderNo)" />
                </td>
                <td>
                  <div class="cell-stack">
                    <span class="mono-text">{{ order.depositOrderNo }}</span>
                    <span class="minor-text">{{ formatSourceOrder(order) }}</span>
                    <span class="minor-text">{{ formatDateTime(order.createdAt) }}</span>
                  </div>
                </td>
                <td>
                  <div class="cell-stack">
                    <span class="cell-strong">{{ order.customerName || '-' }}</span>
                    <span class="minor-text">{{ order.customerPhone || '-' }}</span>
                  </div>
                </td>
                <td>
                  <div class="cell-stack">
                    <span>{{ order.productName || '-' }}</span>
                    <span class="minor-text">{{ order.unitCode || order.modelCode || '-' }}</span>
                    <span v-if="order.isLatest" class="tag tag-latest">最新</span>
                    <span v-else class="tag tag-history">历史</span>
                  </div>
                </td>
                <td>
                  <div class="cell-stack">
                    <b class="price-text">押金 ¥{{ formatFee(order.depositAmount) }}</b>
                    <span>租金 ¥{{ formatFee(order.rentAmount) }}</span>
                  </div>
                </td>
                <td>
                  <div class="cell-stack">
                    <span>{{ formatDate(order.rentStartDate) }} ~ {{ formatDate(order.rentEndDate) }}</span>
                    <span class="minor-text">{{ order.rentDays || 0 }}天</span>
                  </div>
                </td>
                <td>
                  <div class="status-stack">
                    <StatusBadge :label="statusLabel(order.status)" :variant="statusVariant(order.status)" />
                  </div>
                </td>
                <td>
                  <div class="action-btns">
                    <button class="btn btn-primary btn-sm" @click="runPrimaryAction(order)">{{ primaryActionLabel(order) }}</button>
                    <RowActionMenu :items="actionMenuItems(order)" @select="handleActionMenu(order, $event)" />
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
      </DataTable>
    </section>

    <!-- 分页 -->
    <div v-if="totalCount > 0" class="pagination-bar">
      <span class="pagination-info">共 {{ totalCount }} 条</span>
      <div class="pagination-btns">
        <button
          class="btn btn-secondary btn-sm"
          :disabled="currentPage <= 1"
          @click="goToPage(1)"
        >首页</button>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >上一页</button>
        <span class="pagination-current">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >下一页</button>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="currentPage >= totalPages"
          @click="goToPage(totalPages)"
        >末页</button>
      </div>
    </div>

    <!-- 详情 Drawer -->
    <BaseDrawer
      v-model="showDetailDrawer"
      :title="'免押单详情'"
      :width="560"
      @close="showDetailDrawer = false"
    >
      <div v-if="detailOrder" class="detail-body">
        <!-- 状态头 -->
        <div class="detail-head">
          <div class="detail-head-left">
            <StatusBadge :label="statusLabel(detailOrder.status)" :variant="statusVariant(detailOrder.status)" />
            <span v-if="detailOrder.isLatest" class="tag tag-latest">最新</span>
            <span v-else class="tag tag-history">历史</span>
          </div>
          <div class="mono-text detail-no">{{ detailOrder.depositOrderNo }}</div>
        </div>

        <!-- 信息列表 -->
        <div class="detail-section">
          <div class="detail-title">基本信息</div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="d-label">商品名称</span>
              <span class="d-value">{{ detailOrder.productName || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="d-label">型号 / 设备编号</span>
              <div class="device-edit-row">
                <select v-model="selectedDetailModelCode" class="mini-select" @change="saveSelectedModelForDeposit">
                  <option value="">选择型号</option>
                  <option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option>
                </select>
                <select v-model="selectedDetailUnitCode" class="mini-select" @change="saveSelectedUnitForDeposit">
                  <option value="">不指定设备编号</option>
                  <option v-for="unit in unitOptionsForSelectedModel" :key="unit.id || unit.unit_code" :value="unit.unit_code">
                    {{ unit.unit_code }}
                  </option>
                </select>
              </div>
            </div>
            <div class="detail-item full-width">
              <span class="d-label">来源订单</span>
              <div class="source-bind-box">
                <div class="link-row">
                  <span class="d-value mono-text">{{ formatSourceOrder(detailOrder) }}</span>
                  <button class="btn btn-secondary btn-sm" @click="toggleBindOrderPanel">
                    {{ bindOrderPanelOpen ? '收起' : '绑定订单' }}
                  </button>
                </div>
                <div v-if="bindOrderPanelOpen" class="bind-inline">
                  <div class="bind-row">
                    <select v-model="selectedBindOrderId" class="bind-select">
                      <option value="">请选择匹配订单</option>
                      <option v-for="order in bindOrderCandidates" :key="order.id" :value="String(order.id)">
                        #{{ order.id }} {{ order.order_no || '-' }} · {{ order.unit_code || order.model_code || '-' }} · {{ order.rent_start_date }} ~ {{ order.rent_end_date }} · ¥{{ formatFee(order.fee) }}
                      </option>
                    </select>
                    <button class="btn btn-secondary btn-sm" @click="loadBindOrderCandidates">重新匹配</button>
                  </div>
                  <div class="minor-text">按当前型号、设备编号和租期匹配；不回写云上印鉴平台。</div>
                  <div class="bind-actions">
                    <button class="btn btn-secondary btn-sm" @click="bindOrderPanelOpen = false">取消</button>
                    <button class="btn btn-primary btn-sm" :disabled="!selectedBindOrderId || bindingOrder" @click="bindSelectedOrder">
                      {{ bindingOrder ? '绑定中…' : '确认绑定' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="detail-item">
              <span class="d-label">客户姓名</span>
              <span class="d-value">{{ detailOrder.customerName || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="d-label">客户手机号</span>
              <span class="d-value">{{ detailOrder.customerPhone || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="d-label">押金金额</span>
              <span class="d-value price-text">¥{{ formatFee(detailOrder.depositAmount) }}</span>
            </div>
            <div class="detail-item">
              <span class="d-label">租金展示</span>
              <span class="d-value">¥{{ formatFee(detailOrder.rentAmount) }}</span>
            </div>
            <div class="detail-item">
              <span class="d-label">租期</span>
              <span class="d-value">{{ formatDate(detailOrder.rentStartDate) }} ~ {{ formatDate(detailOrder.rentEndDate) }}（{{ detailOrder.rentDays || 0 }}天）</span>
            </div>
          </div>
        </div>

        <!-- 邀约信息 -->
        <div class="detail-section">
          <div class="detail-title">邀约信息</div>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="d-label">邀约文本</span>
              <div class="link-row">
                <span class="d-value mono-text link-text">{{ detailOrder.reviewUrl }}</span>
                <button class="btn btn-secondary btn-sm" @click="copyLink(detailOrder)">复制邀约</button>
              </div>
            </div>
          </div>
          <!-- 二维码 -->
          <div class="detail-qr">
            <img
              v-if="detailOrder.qrImageUrl"
              :src="detailOrder.qrImageUrl"
              class="qr-preview-img"
              alt="免押二维码"
            />
            <div v-else class="qr-preview-placeholder">二维码加载中</div>
          </div>
        </div>

        <!-- 联系方式 -->
        <div class="detail-section">
          <div class="detail-title">联系方式</div>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="d-label">微电同号</span>
              <span class="d-value">{{ detailOrder.contactPhones || displaySettings.contactPhones }}</span>
            </div>
            <div class="detail-item full-width">
              <span class="d-label">工作时间</span>
              <span class="d-value">{{ detailOrder.workTime || displaySettings.workTime }}</span>
            </div>
          </div>
        </div>

        <!-- 时间 -->
        <div class="detail-section">
          <div class="detail-title">时间信息</div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="d-label">创建时间</span>
              <span class="d-value mono-text">{{ formatDateTime(detailOrder.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="d-label">更新时间</span>
              <span class="d-value mono-text">{{ formatDateTime(detailOrder.updatedAt) }}</span>
            </div>
            <div class="detail-item full-width">
              <span class="d-label">二维码有效期</span>
              <span class="d-value">{{ detailOrder.expiresInText || displaySettings.expiresInText }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary" @click="showDetailDrawer = false">关闭</button>
        <button class="btn btn-secondary" @click="copyLink(detailOrder)">复制邀约</button>
        <button class="btn btn-secondary" @click="savePosterAction(detailOrder)">保存图片</button>
        <button
          v-if="detailOrder && canCloseLifecycle(detailOrder)"
          class="btn btn-primary"
          @click="runLifecycleAction(detailOrder)"
        >{{ lifecycleActionLabel(detailOrder) }}</button>
      </template>
    </BaseDrawer>

    <CreateDepositDrawer
      v-model="showCreateDrawer"
      :order="null"
      @close="showCreateDrawer = false"
      @created="onManualCreated"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

import PageHeader from '../../components/PageHeader.vue'
import BaseDrawer from '../../components/BaseDrawer.vue'
import CreateDepositDrawer from '../../components/CreateDepositDrawer.vue'
import BatchActionBar from '../../components/BatchActionBar.vue'
import DataTable from '../../components/DataTable.vue'
import FilterBar from '../../components/FilterBar.vue'
import KpiStrip from '../../components/KpiStrip.vue'
import RowActionMenu from '../../components/RowActionMenu.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import {
  listDepositOrders,
  getDepositOrder,
  cancelDepositOrder,
  completeDepositOrder,
  deleteDepositOrder,
  batchCancelDepositOrders,
  batchCompleteDepositOrders,
  batchDeleteDepositOrders,
  getDepositStatusLabel,
  applyDepositStatusPush,
  bindDepositOrderSource,
  getDepositApiMode,
  initDepositMode,
} from '../../services/depositApiService.js'
import { getDepositDisplaySettings, saveDepositSettings } from '../../services/depositSettingsService.js'
import { downloadDepositPoster } from '../../utils/depositPosterCanvas.js'

const displaySettings = ref(getDepositDisplaySettings())

const depositOrders = ref([])
const statsOrders = ref([])
const message = ref('')
const showDetailDrawer = ref(false)
const detailOrder = ref(null)
const loading = ref(false)
const showCreateDrawer = ref(false)
const selectedDepositNos = ref([])
const quickScope = ref('')
const bindOrderPanelOpen = ref(false)
const bindOrderCandidates = ref([])
const selectedBindOrderId = ref('')
const bindingOrder = ref(false)
const scheduleUnits = ref([])
const selectedDetailModelCode = ref('')
const selectedDetailUnitCode = ref('')
let disposeDepositStatusListener = null
let detailSyncRunId = 0

const currentPage = ref(1)
const pageSize = ref(50)
const totalCount = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

const filters = reactive({
  status: '',
  isLatest: '',
  modelCode: '',
  rentFrom: '',
  rentTo: '',
  keyword: '',
})

const statusOptions = [
  { key: '', label: '全部' },
  { key: 'pending_review', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'cancelled', label: '已取消' },
  { key: 'completed', label: '已完结' },
]

const hasFilter = computed(() => !!(filters.status || filters.isLatest || filters.modelCode || filters.rentFrom || filters.rentTo || filters.keyword))
const isRealMode = computed(() => getDepositApiMode() === 'real')
const visibleDepositNos = computed(() => depositOrders.value.map((order) => order.depositOrderNo).filter(Boolean))
const selectedOrders = computed(() => depositOrders.value.filter((order) => selectedDepositNos.value.includes(order.depositOrderNo)))
const batchCancelableNos = computed(() => selectedOrders.value.filter((order) => canCancel(order)).map((order) => order.depositOrderNo))
const batchCompletableNos = computed(() => selectedOrders.value.filter((order) => canComplete(order)).map((order) => order.depositOrderNo))
const batchDeletableNos = computed(() => selectedOrders.value.filter((order) => canDelete(order)).map((order) => order.depositOrderNo))
const allVisibleSelected = computed(() => (
  visibleDepositNos.value.length > 0 &&
  visibleDepositNos.value.every((no) => selectedDepositNos.value.includes(no))
))
const modelOptions = computed(() => {
  const set = new Set()
  for (const unit of scheduleUnits.value) {
    const model = String(unit.model_code || '').trim()
    if (model) set.add(model)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
})
const unitOptionsForSelectedModel = computed(() => {
  const model = String(selectedDetailModelCode.value || '').trim()
  return scheduleUnits.value
    .filter((unit) => !model || unit.model_code === model)
    .sort((a, b) => String(a.unit_code).localeCompare(String(b.unit_code), 'zh-Hans-CN'))
})
const filterModelOptions = computed(() => {
  const set = new Set(modelOptions.value)
  for (const order of statsOrders.value) {
    const model = String(order.modelCode || '').trim()
    if (model) set.add(model)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
})

const countsByStatus = computed(() => {
  const all = Array.from(statsOrders.value)
  const acc = { '': all.length }
  for (const s of statusOptions) {
    if (!s.key) continue
    acc[s.key] = all.filter((o) => o.status === s.key).length
  }
  return acc
})
const todayDate = computed(() => new Date().toISOString().slice(0, 10))
const todayAddedCount = computed(() => statsOrders.value.filter((order) => String(order.createdAt || '').slice(0, 10) === todayDate.value).length)
const rejectedCount = computed(() => statsOrders.value.filter((order) => order.status === 'rejected').length)
const cancelledCount = computed(() => statsOrders.value.filter((order) => order.status === 'cancelled').length)
const exceptionCount = computed(() => rejectedCount.value + cancelledCount.value)
const totalDepositAmount = computed(() => statsOrders.value.reduce((sum, order) => sum + Number(order.depositAmount || 0), 0))
const activeKpiKey = computed(() => {
  if (quickScope.value === 'today_added') return 'today_added'
  if (quickScope.value === 'exception') return 'exception'
  if (filters.status === 'pending_review') return 'pending_review'
  if (filters.status === 'approved') return 'approved'
  if (!filters.status && !quickScope.value) return 'total_amount'
  return ''
})
const kpiItems = computed(() => [
  {
    key: 'pending_review',
    label: '待审核',
    value: countsByStatus.value.pending_review || 0,
    hint: '优先处理',
    tone: 'warning',
    emphasis: true,
  },
  {
    key: 'today_added',
    label: '今日新增',
    value: todayAddedCount.value,
    hint: todayDate.value,
    tone: 'info',
  },
  {
    key: 'approved',
    label: '已通过',
    value: countsByStatus.value.approved || 0,
    hint: '可继续履约',
    tone: 'success',
  },
  {
    key: 'exception',
    label: '拒绝 / 取消',
    value: exceptionCount.value,
    hint: `拒绝 ${rejectedCount.value} · 取消 ${cancelledCount.value}`,
    tone: 'danger',
    emphasis: true,
  },
  {
    key: 'total_amount',
    label: '总免押金额',
    value: `¥${formatCompactMoney(totalDepositAmount.value)}`,
    hint: `${statsOrders.value.length} 条记录`,
  },
])

function statusLabel(s) {
  return getDepositStatusLabel(s)
}

function statusVariant(status) {
  const map = {
    pending_review: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'neutral',
    completed: 'info',
  }
  return map[status] || 'neutral'
}

function refreshDisplaySettings() {
  displaySettings.value = getDepositDisplaySettings()
}

function formatDate(v) {
  if (!v) return '-'
  return String(v).slice(0, 10)
}

function formatFee(v) {
  if (v == null) return '0'
  return Number(v).toFixed(2)
}

function formatCompactMoney(v) {
  const amount = Number(v || 0)
  if (amount >= 10000) return `${(amount / 10000).toFixed(amount >= 100000 ? 0 : 1)}万`
  return amount.toFixed(0)
}

function formatDateTime(v) {
  if (!v) return '-'
  return String(v).replace('T', ' ').slice(0, 16)
}

function formatSourceOrder(order) {
  if (!order) return '-'
  if (order.sourceOrderNo) return order.sourceOrderNo
  if (order.sourceOrderId !== undefined && order.sourceOrderId !== null && order.sourceOrderId !== '') {
    return `#${order.sourceOrderId}`
  }
  return '-'
}

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/租赁/g, '')
    .replace(/\s+/g, '')
    .replace(/[·\-_/]/g, '')
}

async function loadOrders() {
  loading.value = true
  message.value = ''
  try {
    refreshDisplaySettings()
    const scopeFilters = {
      isLatest: filters.isLatest || undefined,
      keyword: filters.keyword || undefined,
    }
    const apiParams = {
      page: currentPage.value,
      limit: pageSize.value,
    }
    if (filters.status) {
      const [visibleResult, scopedResult] = await Promise.all([
        listDepositOrders({ ...scopeFilters, ...apiParams, status: filters.status }),
        listDepositOrders({ ...scopeFilters, ...apiParams }),
      ])
      depositOrders.value = applyLocalFilters(visibleResult.orders)
      statsOrders.value = applyLocalFilters(scopedResult.orders)
      totalCount.value = visibleResult.total || visibleResult.orders.length
    } else {
      const scopedResult = await listDepositOrders({ ...scopeFilters, ...apiParams })
      depositOrders.value = applyLocalFilters(scopedResult.orders)
      statsOrders.value = applyLocalFilters(scopedResult.orders)
      totalCount.value = scopedResult.total || scopedResult.orders.length
    }
    const visible = new Set(visibleDepositNos.value)
    selectedDepositNos.value = selectedDepositNos.value.filter((no) => visible.has(no))
    syncRealOrderDetailsInBackground()
  } catch (e) {
    message.value = '加载失败：' + (e.message || '未知错误')
  } finally {
    loading.value = false
  }
}

function goToPage(page) {
  const target = Math.max(1, Math.min(page, totalPages.value))
  if (target === currentPage.value) return
  currentPage.value = target
  loadOrders()
}

function onFilterChange() {
  currentPage.value = 1
  loadOrders()
}

async function syncDepositSettingsFromMainConfig() {
  const getConfig = window.electronAPI?.getConfig
  if (typeof getConfig !== 'function') return
  try {
    const cfg = await getConfig()
    saveDepositSettings({
      api: {
        mode: cfg.DEPOSIT_API_MODE || undefined,
        baseUrl: cfg.DEPOSIT_BASE_URL || undefined,
        timeoutMs: cfg.DEPOSIT_TIMEOUT_MS ? Number(cfg.DEPOSIT_TIMEOUT_MS) : undefined,
        userEid: cfg.DEPOSIT_USER_EID || undefined,
        notifyUrl: cfg.DEPOSIT_NOTIFY_URL || undefined,
        contractSupplementaryContent: cfg.DEPOSIT_CONTRACT_SUPPLEMENTARY_CONTENT || undefined,
        receivingInfoFallback: cfg.DEPOSIT_RECEIVING_INFO_FALLBACK || undefined,
      },
    })
  } catch (e) {
    console.warn('同步免押主进程配置失败:', e)
  }
}

function orderNeedsRealDetailSync(order) {
  if (!order?.depositOrderNo) return false
  return !String(order.reviewUrl || '').trim()
    || !order.rentStartDate
    || !order.rentEndDate
    || Number(order.rentAmount || 0) <= 0
}

function depositRentOverlapsFilter(order) {
  if (!filters.rentFrom && !filters.rentTo) return true
  const start = String(order.rentStartDate || '').slice(0, 10)
  const end = String(order.rentEndDate || '').slice(0, 10)
  if (!start || !end) return false
  if (filters.rentFrom && end < filters.rentFrom) return false
  if (filters.rentTo && start > filters.rentTo) return false
  return true
}

function matchesQuickScope(order) {
  if (quickScope.value === 'today_added') {
    return String(order.createdAt || '').slice(0, 10) === todayDate.value
  }
  if (quickScope.value === 'exception') {
    return ['rejected', 'cancelled'].includes(order.status)
  }
  return true
}

function applyLocalFilters(orders = []) {
  return Array.from(orders).filter((order) => {
    if (filters.modelCode && order.modelCode !== filters.modelCode) return false
    if (!matchesQuickScope(order)) return false
    return depositRentOverlapsFilter(order)
  })
}

async function syncRealOrderDetailsInBackground() {
  if (!isRealMode.value) return
  const runId = ++detailSyncRunId
  const pending = depositOrders.value.filter(orderNeedsRealDetailSync)
  if (!pending.length) return

  const concurrency = 3
  let cursor = 0
  const worker = async () => {
    while (cursor < pending.length && runId === detailSyncRunId) {
      const order = pending[cursor]
      cursor += 1
      try {
        const freshOrder = await getDepositOrder(order.depositOrderNo)
        if (runId !== detailSyncRunId) return
        if (freshOrder) replaceOrderInList(freshOrder)
      } catch {
        // 单个真实详情失败不阻断列表，用户点详情时仍会看到明确错误。
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker))
}

function setStatusFilter(key) {
  if (key === 'today_added') {
    quickScope.value = 'today_added'
    filters.status = ''
  } else if (key === 'exception') {
    quickScope.value = 'exception'
    filters.status = ''
  } else if (key === 'total_amount') {
    quickScope.value = ''
    filters.status = ''
  } else {
    quickScope.value = key
    filters.status = key
  }
  onFilterChange()
}

function resetFilters() {
  filters.status = ''
  filters.isLatest = ''
  filters.modelCode = ''
  filters.rentFrom = ''
  filters.rentTo = ''
  filters.keyword = ''
  quickScope.value = ''
  onFilterChange()
}

function onStatusFilterChange() {
  if (filters.status === 'pending_review' || filters.status === 'approved') {
    quickScope.value = filters.status
  } else if (filters.status === 'rejected' || filters.status === 'cancelled') {
    quickScope.value = 'exception'
  } else {
    quickScope.value = ''
  }
  onFilterChange()
}

function orderMatchesFilters(order, options = {}) {
  if (!order) return false
  const includeStatus = options.includeStatus !== false
  if (includeStatus && filters.status && order.status !== filters.status) return false
  if (filters.isLatest !== '' && String(Boolean(order.isLatest)) !== filters.isLatest) return false
  if (filters.modelCode && order.modelCode !== filters.modelCode) return false
  if (!matchesQuickScope(order)) return false
  if (!depositRentOverlapsFilter(order)) return false
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  if (!keyword) return true
  return [
    order.depositOrderNo,
    order.sourceOrderNo,
    order.customerName,
    order.customerPhone,
    order.unitCode,
    order.modelCode,
    order.productName,
  ].some((value) => String(value || '').toLowerCase().includes(keyword))
}

function sortDepositOrdersInPlace() {
  depositOrders.value = [...depositOrders.value].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )
}

function sortStatsOrdersInPlace() {
  statsOrders.value = [...statsOrders.value].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )
}

function upsertDepositOrder(order) {
  if (!order?.depositOrderNo) return
  const index = depositOrders.value.findIndex((item) => item.depositOrderNo === order.depositOrderNo)
  const shouldShow = orderMatchesFilters(order)

  if (index >= 0) {
    if (shouldShow) {
      depositOrders.value[index] = { ...depositOrders.value[index], ...order }
      sortDepositOrdersInPlace()
    } else {
      depositOrders.value.splice(index, 1)
      selectedDepositNos.value = selectedDepositNos.value.filter((no) => no !== order.depositOrderNo)
    }
  } else if (shouldShow) {
    depositOrders.value = [order, ...depositOrders.value]
    sortDepositOrdersInPlace()
  }

  if (detailOrder.value?.depositOrderNo === order.depositOrderNo) {
    detailOrder.value = { ...detailOrder.value, ...order }
  }
}

function upsertStatsOrder(order) {
  if (!order?.depositOrderNo) return
  const index = statsOrders.value.findIndex((item) => item.depositOrderNo === order.depositOrderNo)
  const shouldShow = orderMatchesFilters(order, { includeStatus: false })

  if (index >= 0) {
    if (shouldShow) {
      statsOrders.value[index] = { ...statsOrders.value[index], ...order }
      sortStatsOrdersInPlace()
    } else {
      statsOrders.value.splice(index, 1)
    }
  } else if (shouldShow) {
    statsOrders.value = [order, ...statsOrders.value]
    sortStatsOrdersInPlace()
  }
}

function onDepositStatusChanged(payload = {}) {
  const order = applyDepositStatusPush(payload)
  if (!order) return
  upsertStatsOrder(order)
  upsertDepositOrder(order)
  message.value = `免押单 ${order.depositOrderNo} 状态已更新为 ${statusLabel(order.status)}`
}

function openManualCreate() {
  showCreateDrawer.value = true
}

async function onManualCreated(depositOrder) {
  window.$toast?.('免押单 ' + depositOrder.depositOrderNo + ' 已创建', 'success')
  await loadOrders()
}

function toggleSelection(depositNo) {
  if (selectedDepositNos.value.includes(depositNo)) {
    selectedDepositNos.value = selectedDepositNos.value.filter((no) => no !== depositNo)
  } else {
    selectedDepositNos.value = [...selectedDepositNos.value, depositNo]
  }
}

function toggleVisibleSelection() {
  selectedDepositNos.value = allVisibleSelected.value ? [] : [...visibleDepositNos.value]
}

function clearSelection() {
  selectedDepositNos.value = []
}

function canDelete(order) {
  return ['cancelled', 'completed', 'rejected'].includes(order?.status)
}

function canCancel(order) {
  return order?.status === 'pending_review'
}

function canComplete(order) {
  return order?.status === 'approved'
}

function canCloseLifecycle(order) {
  return canCancel(order) || canComplete(order)
}

async function openDetail(order) {
  bindOrderPanelOpen.value = false
  try {
    refreshDisplaySettings()
    await loadScheduleUnits()
    detailOrder.value = await getDepositOrder(order.depositOrderNo)
    if (!detailOrder.value) {
      window.$toast?.('未查询到免押单详情', 'error')
      return
    }
    await hydrateDetailDeviceSelection()
    replaceOrderInList(detailOrder.value)
    showDetailDrawer.value = true
  } catch (e) {
    window.$toast?.(e.message || '查询详情失败', 'error')
  }
}

function primaryActionLabel(order) {
  return order?.status === 'pending_review' ? '复制邀约' : '查看'
}

async function runPrimaryAction(order) {
  if (order?.status === 'pending_review') {
    await copyLink(order)
    return
  }
  await openDetail(order)
}

function lifecycleActionLabel(order) {
  if (canComplete(order)) return '完结免押单'
  if (canCancel(order)) return '取消免押单'
  return ''
}

function actionMenuItems(order) {
  const items = [
    { key: 'detail', label: '详情' },
    {
      key: 'copy',
      label: '复制邀约',
      disabled: !(order?.status === 'pending_review' || order?.status === 'approved'),
    },
    { key: 'poster', label: '保存图片' },
    { key: 'delete', label: '删除', danger: true, disabled: !canDelete(order) },
  ]
  if (canCloseLifecycle(order)) {
    items.splice(3, 0, {
      key: 'lifecycle',
      label: lifecycleActionLabel(order),
    })
  }
  return items
}

async function runLifecycleAction(order) {
  if (!order?.depositOrderNo) return
  if (canComplete(order)) {
    await completeOrder(order.depositOrderNo)
    return
  }
  if (canCancel(order)) {
    await cancelOrder(order.depositOrderNo)
  }
}

async function handleActionMenu(order, item) {
  if (!item?.key) return
  if (item.key === 'detail') {
    await openDetail(order)
    return
  }
  if (item.key === 'copy') {
    await copyLink(order)
    return
  }
  if (item.key === 'poster') {
    await savePosterAction(order)
    return
  }
  if (item.key === 'lifecycle') {
    await runLifecycleAction(order)
    return
  }
  if (item.key === 'delete') {
    await deleteOrderAction(order.depositOrderNo)
  }
}

async function loadScheduleUnits() {
  try {
    const rows = await window.electronAPI?.listScheduleUnits?.({ activeInventoryOnly: true })
    scheduleUnits.value = Array.isArray(rows)
      ? rows.filter((unit) => unit?.unit_code).sort((a, b) => String(a.unit_code).localeCompare(String(b.unit_code), 'zh-Hans-CN'))
      : []
  } catch {
    scheduleUnits.value = []
  }
}

function productNameFromModel(modelCode) {
  const model = String(modelCode || '').trim()
  return model ? `${model}租赁` : '租赁设备'
}

function inferModelFromProductName(productName) {
  const normalizedProduct = normalizeMatchText(productName)
  if (!normalizedProduct) return ''
  return modelOptions.value.find((model) => {
    const normalizedModel = normalizeMatchText(model)
    return normalizedModel && normalizedProduct.includes(normalizedModel)
  }) || ''
}

async function hydrateDetailDeviceSelection() {
  if (!detailOrder.value) return
  const inferredModel = detailOrder.value.modelCode || inferModelFromProductName(detailOrder.value.productName)
  selectedDetailModelCode.value = inferredModel || ''
  selectedDetailUnitCode.value = detailOrder.value.unitCode || ''
  if (!detailOrder.value.modelCode && inferredModel) {
    await saveDetailDeviceFields({ modelCode: inferredModel, unitCode: detailOrder.value.unitCode || '' })
  }
}

async function saveDetailDeviceFields({ modelCode, unitCode }) {
  if (!detailOrder.value) return
  try {
    const result = await bindDepositOrderSource(detailOrder.value.depositOrderNo, {
      sourceOrderId: detailOrder.value.sourceOrderId,
      sourceOrderNo: detailOrder.value.sourceOrderNo,
      productName: detailOrder.value.productName || productNameFromModel(modelCode),
      modelCode: modelCode || '',
      unitCode: unitCode || '',
      customerName: detailOrder.value.customerName,
      customerPhone: detailOrder.value.customerPhone,
    })
    if (!result.success) {
      window.$toast?.(result.message || '设备信息保存失败', 'error')
      return
    }
    detailOrder.value = { ...detailOrder.value, ...result.depositOrder }
    replaceOrderInList(result.depositOrder)
    if (bindOrderPanelOpen.value) await loadBindOrderCandidates()
  } catch (e) {
    window.$toast?.(e.message || '设备信息保存失败', 'error')
  }
}

async function saveSelectedModelForDeposit() {
  selectedDetailUnitCode.value = ''
  await saveDetailDeviceFields({ modelCode: selectedDetailModelCode.value, unitCode: '' })
}

async function saveSelectedUnitForDeposit() {
  const unit = scheduleUnits.value.find((item) => item.unit_code === selectedDetailUnitCode.value)
  const modelCode = unit?.model_code || selectedDetailModelCode.value
  selectedDetailModelCode.value = modelCode || ''
  await saveDetailDeviceFields({ modelCode, unitCode: selectedDetailUnitCode.value })
}

function depositOrderOverlapsRent(order) {
  if (!detailOrder.value?.rentStartDate || !detailOrder.value?.rentEndDate) return true
  const orderStart = String(order.rent_start_date || '').slice(0, 10)
  const orderEnd = String(order.rent_end_date || '').slice(0, 10)
  if (!orderStart || !orderEnd) return false
  return orderEnd >= detailOrder.value.rentStartDate && orderStart <= detailOrder.value.rentEndDate
}

async function loadBindOrderCandidates() {
  if (!detailOrder.value) return
  const modelCode = String(detailOrder.value.modelCode || '').trim()
  const unitCode = String(detailOrder.value.unitCode || '').trim()
  if (!modelCode && !unitCode) {
    window.$toast?.('缺少设备型号或编号，无法匹配订单', 'error')
    return
  }
  try {
    const rows = await window.electronAPI?.listOrders?.({
      modelCode: modelCode || undefined,
      from: detailOrder.value.rentStartDate || undefined,
      to: detailOrder.value.rentEndDate || undefined,
    })
    bindOrderCandidates.value = (Array.isArray(rows) ? rows : [])
      .filter((order) => depositOrderOverlapsRent(order))
      .filter((order) => !unitCode || order.unit_code === unitCode)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    selectedBindOrderId.value = bindOrderCandidates.value[0]?.id ? String(bindOrderCandidates.value[0].id) : ''
  } catch (e) {
    window.$toast?.(e.message || '匹配订单失败', 'error')
    bindOrderCandidates.value = []
  }
}

async function openBindOrderPanel() {
  bindOrderPanelOpen.value = true
  await loadBindOrderCandidates()
}

async function toggleBindOrderPanel() {
  bindOrderPanelOpen.value = !bindOrderPanelOpen.value
  if (bindOrderPanelOpen.value) await loadBindOrderCandidates()
}

async function bindSelectedOrder() {
  if (!detailOrder.value || !selectedBindOrderId.value) return
  const order = bindOrderCandidates.value.find((item) => String(item.id) === String(selectedBindOrderId.value))
  if (!order) return
  bindingOrder.value = true
  try {
    const result = await bindDepositOrderSource(detailOrder.value.depositOrderNo, {
      sourceOrderId: order.id,
      sourceOrderNo: order.order_no || `#${order.id}`,
      productName: detailOrder.value.productName,
      modelCode: order.model_code || detailOrder.value.modelCode,
      unitCode: order.unit_code || detailOrder.value.unitCode,
      customerName: order.customer_name || detailOrder.value.customerName,
      customerPhone: order.customer_phone || detailOrder.value.customerPhone,
    })
    if (!result.success) {
      window.$toast?.(result.message || '绑定失败', 'error')
      return
    }
    const shouldOverwriteFee = Number(detailOrder.value.rentAmount || 0) > 0
      && window.confirm(`是否用免押单租金 ¥${formatFee(detailOrder.value.rentAmount)} 覆盖订单 #${order.id} 的租金？`)
    if (shouldOverwriteFee) {
      const feeResult = await window.electronAPI?.updateOrderFee?.({
        orderId: order.id,
        fee: Number(detailOrder.value.rentAmount || 0),
      })
      if (!feeResult?.ok) {
        window.$toast?.(feeResult?.message || '订单租金覆盖失败', 'error')
      }
    }
    detailOrder.value = { ...detailOrder.value, ...result.depositOrder }
    replaceOrderInList(result.depositOrder)
    bindOrderPanelOpen.value = false
    window.$toast?.('免押单已绑定本地订单', 'success')
    await loadOrders()
  } catch (e) {
    window.$toast?.(e.message || '绑定失败', 'error')
  } finally {
    bindingOrder.value = false
  }
}

function replaceOrderInList(nextOrder) {
  if (!nextOrder?.depositOrderNo) return
  const mergeOrKeep = (item) => item.depositOrderNo === nextOrder.depositOrderNo ? { ...item, ...nextOrder } : item
  depositOrders.value = depositOrders.value.map(mergeOrKeep).filter((item) => orderMatchesFilters(item))
  statsOrders.value = statsOrders.value.map(mergeOrKeep).filter((item) => orderMatchesFilters(item, { includeStatus: false }))
  if (detailOrder.value?.depositOrderNo === nextOrder.depositOrderNo) {
    detailOrder.value = { ...detailOrder.value, ...nextOrder }
  }
}

function needsOrderDetail(order, options = {}) {
  if (!order?.depositOrderNo) return false
  if (options.requireReviewUrl && !String(order.reviewUrl || '').trim()) return true
  if (options.requireRentRange && (!order.rentStartDate || !order.rentEndDate)) return true
  return false
}

async function resolveOrderForAction(order, options = {}) {
  if (!order?.depositOrderNo) return order || null
  if (!needsOrderDetail(order, options)) return order
  const freshOrder = await getDepositOrder(order.depositOrderNo)
  if (freshOrder) replaceOrderInList(freshOrder)
  return freshOrder || order
}

function buildInviteCopyText(order) {
  const inviteText = String(order?.reviewUrl || '').trim()
  const qrImageUrl = String(order?.qrImageUrl || '').trim()
  if (!inviteText) {
    return qrImageUrl
      ? `押金服务订单号：${order?.depositOrderNo || '-'}\n授信二维码：${qrImageUrl}`
      : ''
  }
  if (/https?:\/\//i.test(inviteText) || !qrImageUrl) return inviteText
  return `${inviteText}\n\n授信二维码：${qrImageUrl}`
}

async function copyLink(order) {
  try {
    const resolvedOrder = await resolveOrderForAction(order, { requireReviewUrl: true })
    const copyText = buildInviteCopyText(resolvedOrder)
    if (!copyText) {
      window.$toast?.('未获取到邀约文本', 'error')
      return
    }
    await navigator.clipboard.writeText(copyText)
    window.$toast?.('邀约文本已复制', 'success')
  } catch (e) {
    window.$toast?.(e.message || '复制失败', 'error')
  }
}

async function savePosterAction(order) {
  if (!order) return
  try {
    const resolvedOrder = await resolveOrderForAction(order, { requireReviewUrl: true, requireRentRange: true })
    const ok = await downloadDepositPoster(resolvedOrder || order, `免押单_${order.depositOrderNo}.png`)
    if (ok) {
      window.$toast?.('海报已保存', 'success')
    } else {
      window.$toast?.('保存失败，请重试', 'error')
    }
  } catch {
    window.$toast?.('保存失败', 'error')
  }
}

async function cancelOrder(depositNo) {
  try {
    const result = await cancelDepositOrder(depositNo)
    if (result.success) {
      window.$toast?.('免押单已作废', 'success')
      // 刷新详情
      if (detailOrder.value?.depositOrderNo === depositNo) {
        detailOrder.value = await getDepositOrder(depositNo)
      }
      await loadOrders()
    } else {
      window.$toast?.(result.message || '操作失败', 'error')
    }
  } catch (e) {
    window.$toast?.('操作失败', 'error')
  }
}

async function completeOrder(depositNo) {
  if (!confirm('确认完结该免押单？完结后该免押单将不能再发起扣款，请确认订单已经归还或无需继续免押。')) return
  try {
    const result = await completeDepositOrder(depositNo)
    if (result.success) {
      window.$toast?.('免押单已完结', 'success')
      if (detailOrder.value?.depositOrderNo === depositNo) {
        detailOrder.value = await getDepositOrder(depositNo)
      }
      await loadOrders()
    } else {
      window.$toast?.(result.message || '操作失败', 'error')
    }
  } catch (e) {
    window.$toast?.('操作失败', 'error')
  }
}

async function deleteOrderAction(depositNo) {
  if (!confirm('确认删除该免押单？删除仅移除本地记录，不影响真实平台订单。')) return
  try {
    const result = await deleteDepositOrder(depositNo)
    if (result.success) {
      window.$toast?.('免押单已删除', 'success')
      if (detailOrder.value?.depositOrderNo === depositNo) {
        detailOrder.value = null
        showDetailDrawer.value = false
      }
      selectedDepositNos.value = selectedDepositNos.value.filter((no) => no !== depositNo)
      await loadOrders()
    } else {
      window.$toast?.(result.message || '删除失败', 'error')
    }
  } catch (e) {
    window.$toast?.(e.message || '删除失败', 'error')
  }
}

async function runBatchAction(action, depositNos, confirmText, successText) {
  if (!depositNos.length) return
  if (!confirm(confirmText)) return
  try {
    const result = await action([...depositNos])
    if (result.success) {
      window.$toast?.(`${successText}，成功 ${result.successCount || 0} 个，失败 ${result.failedCount || 0} 个`, result.failedCount ? 'warning' : 'success')
      selectedDepositNos.value = []
      await loadOrders()
    } else {
      window.$toast?.(result.message || '批量操作失败', 'error')
    }
  } catch (e) {
    window.$toast?.(e.message || '批量操作失败', 'error')
  }
}

function batchCancelSelected() {
  return runBatchAction(batchCancelDepositOrders, batchCancelableNos.value, `确认取消 ${batchCancelableNos.value.length} 个免押单？`, '批量取消完成')
}

function batchCompleteSelected() {
  return runBatchAction(batchCompleteDepositOrders, batchCompletableNos.value, `确认批量完结 ${batchCompletableNos.value.length} 个免押单？完结后这些免押单将不能再发起扣款，请确认都已归还或无需继续免押。`, '批量完结完成')
}

function batchDeleteSelected() {
  return runBatchAction(batchDeleteDepositOrders, batchDeletableNos.value, `确认删除 ${batchDeletableNos.value.length} 个免押单？`, '批量删除完成')
}

onMounted(async () => {
  // 直接从主进程获取配置（避免依赖 configStore 的异步加载时序）
  try {
    const cfg = await window.electronAPI?.getConfig()
    initDepositMode(cfg?.DEPOSIT_API_MODE)
  } catch {}
  refreshDisplaySettings()
  await syncDepositSettingsFromMainConfig()
  loadScheduleUnits()
  loadOrders()
  disposeDepositStatusListener = window.electronAPI?.onDepositStatusChanged?.(onDepositStatusChanged) || null
})

onUnmounted(() => {
  // legacy cleanup anchor: removeAllListeners('deposit:statusChanged')
  disposeDepositStatusListener?.()
  disposeDepositStatusListener = null
})
</script>

<style scoped>
.deposit-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--bg-surface, #fff);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.pagination-info {
  font-size: 13px;
  color: var(--text-muted, #6b7280);
}

.pagination-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-current {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #111827);
  min-width: 100px;
  text-align: center;
}

/* ── 统计条 ── */
.stat-strip {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.stat-card {
  flex: 1;
  min-width: 100px;
  padding: 12px 14px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: border-color 0.15s;
  text-align: center;
  font-family: inherit;
}
.stat-card:hover {
  border-color: var(--brand-primary, #0f766e);
}
.stat-card.active {
  border-color: var(--brand-primary, #0f766e);
  background: var(--brand-primary-soft, #e6f4f2);
}
.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-strong, #17211d);
}
.stat-label {
  font-size: 12px;
  color: var(--text-muted, #8ea098);
  margin-top: 2px;
}

/* ── 筛选 ── */
.filter-panel {
  padding: 12px 16px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
}
.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.filter-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #8ea098);
}
.filter-group select,
.filter-group input {
  min-height: 34px;
  padding: 6px 10px;
  font-size: 13px;
}
.filter-kw {
  flex: 1;
  min-width: 220px;
}
.filter-kw input {
  width: 100%;
}

.batch-panel {
  padding: 10px 14px;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.batch-left {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong, #17211d);
}
.batch-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.table-panel {
  padding: 0;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
}
.empty-cell {
  text-align: center !important;
  padding: 32px !important;
}
.empty-hint {
  color: var(--text-muted, #8ea098);
  font-size: 14px;
}

.mono-text {
  font-family: var(--font-mono, 'SF Mono', 'Menlo', monospace);
  font-size: 12px;
}
.minor-text {
  font-size: 12px;
  color: var(--text-muted, #8ea098);
}
.cell-stack,
.status-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}
.cell-strong {
  font-weight: 700;
  color: var(--text-strong, #17211d);
}
.price-text {
  color: var(--brand-primary, #0f766e);
  font-weight: 800;
}

/* 最新/历史标签 */
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
}
.tag-latest {
  background: rgba(20, 184, 166, 0.1);
  color: var(--brand-primary, #0f766e);
}
.tag-history {
  background: #f3f4f6;
  color: #9ca3af;
}

/* 操作按钮 */
.action-btns {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  justify-content: flex-start;
  min-width: 0;
}

.table-panel :deep(.status-stack .status-badge) {
  min-width: 60px;
  justify-content: center;
}

.table-panel :deep(td:last-child) {
  padding-left: 8px;
  padding-right: 8px;
}
.btn-more.expanded {
  background: var(--brand-primary-soft, #e6f4f2);
  color: var(--brand-primary, #0f766e);
  border-color: var(--brand-primary, #0f766e);
}

/* 展开操作行 */
.expand-row td {
  padding: 0 12px 10px;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}
.expand-row:hover td {
  background: #f9fafb;
}
.expand-actions {
  display: flex;
  gap: 6px;
  padding: 4px 0;
}

/* ── 详情 Drawer ── */
.detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
}
.detail-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-no {
  font-size: 13px;
  color: var(--text-secondary, #52615b);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong, #17211d);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: var(--radius-sm, 6px);
}
.detail-item.full-width {
  grid-column: 1 / -1;
}
.d-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #8ea098);
  text-transform: uppercase;
}
.d-value {
  font-size: 13px;
  color: var(--text-strong, #17211d);
  font-weight: 600;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.link-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.device-edit-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.mini-select {
  min-height: 32px;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  background: #fff;
  font-size: 12px;
}
.source-bind-box,
.bind-inline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-qr {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
.qr-preview-img {
  width: 140px;
  height: 140px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  object-fit: contain;
  background: #f0f9f6;
}
.qr-preview-placeholder {
  width: 140px;
  height: 140px;
  border-radius: 10px;
  border: 1px dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-muted, #8ea098);
  background: #f9fafb;
}

.bind-order-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
}
.bind-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bind-field label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted, #8ea098);
}
.bind-row {
  display: flex;
  gap: 8px;
}
.bind-select {
  flex: 1;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid var(--border-subtle, #e5e7eb);
  border-radius: var(--radius-sm, 6px);
  background: #fff;
  font-size: 13px;
}
.bind-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-strong, #17211d);
}
.bind-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ── banner ── */
.banner-info {
  padding: 10px 14px;
  border-radius: var(--radius-sm, 8px);
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  font-size: 13px;
}
</style>
