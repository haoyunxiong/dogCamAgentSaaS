<template>
  <UiV2Page title="订单中心" description="按状态、押金、物流和风险推进履约，数据由 UI-V2 adapter 统一提供。">
    <template #actions>
      <BaseButton variant="secondary" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? '收起筛选' : '高级筛选' }}</BaseButton>
      <BaseButton variant="secondary" data-testid="order-create-preview-button" @click="openCreateOrderPreview">新建订单预览</BaseButton>
      <BaseButton @click="openBulkEditPreview">批量分配预览</BaseButton>
    </template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section v-if="orderPreview.view && !drawerOpen" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-page-safeops-preview">
      <div><span>操作预览</span><strong>{{ orderPreview.view.title }}</strong></div>
      <div><span>开放状态</span><strong>暂未开放</strong></div>
      <div><span>持久化</span><strong>{{ orderPreview.view.persistenceLabel }}</strong></div>
      <div><span>执行门禁</span><strong>{{ orderPreview.view.executeLabel }}</strong></div>
      <div><span>数据写入</span><strong>{{ orderPreview.view.writeWillExecute }}</strong></div>
      <div><span>外部调用</span><strong>{{ orderPreview.view.externalCallWillExecute }}</strong></div>
      <div><span>审计记录</span><strong>{{ orderPreview.view.auditLabel }}</strong></div>
      <div><span>确认令牌</span><strong>{{ orderPreview.view.confirmLabel }}</strong></div>
      <div><span>幂等保护</span><strong>{{ orderPreview.view.idempotencyLabel }}</strong></div>
    </section>

    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in orderMetrics" :key="metric.key" :metric="metric" />
    </section>

    <FilterBar title="订单筛选" hint="按订单号、客户、设备、门店和下单时间筛选" :show-advanced="showAdvanced">
      <StatusTabs v-model="status" :items="statusTabs" />
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索订单、客户、设备" />
        <BaseSelect v-model="channel" label="渠道" :options="['全部渠道', ...options.channels]" />
        <BaseSelect v-model="deposit" label="押金/免押" :options="['全部押金状态', ...options.depositStatuses]" />
      </div>
      <template #advanced>
        <div class="filter-row">
          <BaseSelect v-model="shipping" label="物流" :options="['全部物流状态', ...options.shippingStatuses]" />
          <BaseSelect v-model="risk" label="风险" :options="['全部风险', '正常', '低', '中', '高']" />
          <BaseSelect v-model="assignee" label="负责人" :options="['全部负责人', '阿宁', '小夏', '小顾', '小周']" />
        </div>
      </template>
    </FilterBar>

    <div v-if="loading" class="adapter-state">订单数据读取中...</div>

    <div v-if="selectedRows.length" class="bulk-bar">
      <span>已选择 {{ selectedRows.length }} 单</span>
      <BaseButton variant="secondary" size="sm" @click="openBulkEditPreview">分配预览</BaseButton>
      <BaseButton variant="secondary" size="sm">导出</BaseButton>
      <BaseButton variant="secondary" size="sm" @click="openBulkEditPreview">联系预览</BaseButton>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedOrders"
      row-key="orderNo"
      :selected-key="selectedOrder?.orderNo || ''"
      compact
      :empty-title="loading ? '订单数据读取中' : '暂无匹配订单'"
      @row-click="openOrder"
    >
      <template #select="{ row }">
        <input type="checkbox" :checked="selectedRows.includes(row.orderNo)" @click.stop="toggleRow(row.orderNo)" />
      </template>
      <template #orderNo="{ row }"><strong :title="row.fullOrderNo">{{ row.orderNoDisplay }}</strong></template>
      <template #customerName="{ row }">
        <div class="ui-v2-cell-stack">
          <strong>{{ row.customerName }}</strong>
          <small>{{ row.channel }} · {{ row.phoneMasked }}</small>
        </div>
      </template>
      <template #stage="{ row }"><StatusBadge :label="row.stage" size="sm" /></template>
      <template #riskDisplay="{ row }"><StatusBadge :label="row.riskDisplay" size="sm" /></template>
      <template #rentPeriod="{ row }"><span>{{ row.rentPeriod }}</span></template>
      <template #rentAmount="{ row }">{{ row.amountLabel }}</template>
      <template #channel="{ row }"><span>{{ row.channel }}</span></template>
      <template #ownerStore="{ row }">{{ row.ownerStore }}</template>
      <template #nextAction="{ row }"><span class="next-action">{{ row.nextAction }}</span></template>
    </DataTable>

    <Pagination v-model:page="page" :total="filteredOrders.length" :page-size="pageSize" />

    <BaseDrawer v-model="drawerOpen" :title="selectedOrder?.orderNo || '订单详情'" :subtitle="drawerSubtitle" width="720" test-id="order-detail-drawer">
      <div v-if="selectedOrder" class="ui-v2-stack">
        <div v-if="detailLoading" class="adapter-state is-compact">订单详情读取中...</div>
        <DrawerSummary
          :status="selectedOrder.status"
          :title="selectedOrder.customerName"
          :description="`${selectedOrder.channel} · ${selectedOrder.model}`"
          :meta="selectedOrder.rentPeriod || '未填写租期'"
          primary-label="顺丰网关预览"
          secondary-label="状态预览"
          danger-label="编辑预览"
          @primary="openShippingPreview"
          @secondary="openStatusPreview"
          @danger="openEditPreview"
        />
        <section v-if="orderPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-action-safeops-preview">
          <div><span>操作预览</span><strong>{{ orderPreview.view.title }}</strong></div>
          <div><span>开放状态</span><strong>暂未开放</strong></div>
          <div><span>持久化</span><strong>{{ orderPreview.view.persistenceLabel }}</strong></div>
          <div><span>执行门禁</span><strong>{{ orderPreview.view.executeLabel }}</strong></div>
          <div><span>数据写入</span><strong>{{ orderPreview.view.writeWillExecute }}</strong></div>
          <div><span>外部调用</span><strong>{{ orderPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>审计记录</span><strong>{{ orderPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ orderPreview.view.riskLevel }}</strong></div>
          <div><span>确认令牌</span><strong>{{ orderPreview.view.confirmLabel }}</strong></div>
          <div><span>幂等保护</span><strong>{{ orderPreview.view.idempotencyLabel }}</strong></div>
        </section>
        <p v-if="orderPreview.error" class="adapter-source__error">{{ orderPreview.error }}</p>
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>客户电话</span><strong>{{ selectedOrder.phoneMasked }}</strong></div>
          <div><span>订单金额</span><strong>¥{{ selectedOrder.rentAmount.toLocaleString() }}</strong></div>
          <div><span>押金/免押</span><strong>{{ selectedOrder.depositStatus }} · ¥{{ selectedOrder.depositAmount }}</strong></div>
          <div><span>物流状态</span><strong>{{ selectedOrder.shippingStatus }}</strong></div>
          <div><span>负责人</span><strong>{{ selectedOrder.assignee }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedOrder.nextAction }}</strong></div>
        </section>
        <UiV2Section title="履约步骤" hint="履约时间线">
          <TrackingTimeline :steps="orderSteps" />
        </UiV2Section>
        <UiV2Section title="内部备注/标记" hint="本地安全操作">
          <div class="internal-note-editor">
            <textarea
              v-model="internalNoteDraft"
              class="internal-note-editor__input"
              rows="4"
              maxlength="5000"
              placeholder="填写仅本地可见的商家内部备注"
            />
            <div class="internal-note-editor__actions">
              <BaseButton variant="secondary" :disabled="internalNoteLoading" data-testid="order-internal-note-preview-button" @click="previewInternalNoteUpdate">
                预览
              </BaseButton>
              <BaseButton :disabled="!canExecuteInternalNote || internalNoteLoading" data-testid="order-internal-note-execute-button" @click="executeInternalNoteUpdate">
                确认写入
              </BaseButton>
            </div>
            <p class="drawer-note">本地安全操作；不调用外部接口；需要确认；可审计；自动回滚暂不可执行。</p>
          </div>
          <section v-if="internalNotePreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-internal-note-preview">
            <div><span>操作预览</span><strong>{{ internalNotePreview.view.title }}</strong></div>
            <div><span>开放状态</span><strong>{{ internalNotePreview.view.status }}</strong></div>
            <div><span>持久化</span><strong>{{ internalNotePreview.view.persistenceLabel }}</strong></div>
            <div><span>执行门禁</span><strong>{{ internalNotePreview.view.executeLabel }}</strong></div>
            <div><span>数据写入</span><strong>{{ internalNotePreview.view.writeWillExecute }}</strong></div>
            <div><span>外部调用</span><strong>{{ internalNotePreview.view.externalCallWillExecute }}</strong></div>
            <div><span>审计记录</span><strong>{{ internalNotePreview.view.auditLabel }}</strong></div>
            <div><span>确认令牌</span><strong>{{ internalNotePreview.view.confirmLabel }}</strong></div>
            <div><span>幂等保护</span><strong>{{ internalNotePreview.view.idempotencyLabel }}</strong></div>
            <div><span>自动回滚</span><strong>{{ internalNotePreview.view.rollbackLabel }}</strong></div>
          </section>
          <section v-if="internalNoteExecute.view" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-internal-note-execute">
            <div><span>执行结果</span><strong>{{ internalNoteExecute.view.title }}</strong></div>
            <div><span>状态</span><strong>{{ internalNoteExecute.view.status }}</strong></div>
            <div><span>数据写入</span><strong>{{ internalNoteExecute.view.writeWillExecute }}</strong></div>
            <div><span>外部调用</span><strong>{{ internalNoteExecute.view.externalCallWillExecute }}</strong></div>
            <div><span>审计记录</span><strong>{{ internalNoteExecute.view.auditLabel }}</strong></div>
            <div><span>幂等保护</span><strong>{{ internalNoteExecute.view.idempotencyLabel }}</strong></div>
            <div><span>自动回滚</span><strong>{{ internalNoteExecute.view.rollbackLabel }}</strong></div>
          </section>
          <p v-if="internalNoteError" class="adapter-source__error">{{ internalNoteError }}</p>
        </UiV2Section>
        <UiV2Section title="闲鱼同步预览" hint="模拟/沙盒预览">
          <div class="internal-note-editor">
            <div class="filter-row">
              <BaseSelect v-model="xianyuSyncMode" label="预览模式" :options="xianyuSyncModeOptions" />
              <BaseSelect v-model="xianyuSyncDirection" label="同步方向" :options="xianyuSyncDirectionOptions" />
            </div>
            <div class="internal-note-editor__actions">
              <BaseButton variant="secondary" :disabled="xianyuSyncLoading" data-testid="order-xianyu-sync-inline-preview-button" @click="openXianyuSyncPreview">
                闲鱼同步预览
              </BaseButton>
              <BaseButton disabled data-testid="order-xianyu-sync-real-disabled-button">
                真实同步未开放
              </BaseButton>
            </div>
            <p class="drawer-note">不真实同步；外部真实调用未开放；当前仅生成模拟/沙盒预览；不会写入订单、不会调用闲鱼。</p>
          </div>
        </UiV2Section>
        <UiV2Section title="风险提醒">
          <p class="drawer-note">{{ selectedOrderInternalNote || selectedOrder.note || '暂无特殊备注，按标准履约流程推进。' }}</p>
        </UiV2Section>
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="drawerOpen = false">关闭</BaseButton>
        <BaseButton variant="secondary" data-testid="order-status-preview-button" @click="openStatusPreview">状态预览</BaseButton>
        <BaseButton variant="secondary" data-testid="order-edit-preview-button" @click="openEditPreview">编辑预览</BaseButton>
        <BaseButton variant="secondary" data-testid="order-xianyu-sync-preview-button" @click="openXianyuSyncPreview">闲鱼同步预览</BaseButton>
        <BaseButton data-testid="order-create-shipping-button" @click="openShippingPreview">操作预览</BaseButton>
      </template>
    </BaseDrawer>

    <BaseDrawer v-model="shippingOpen" title="顺丰网关预览" :subtitle="selectedOrder?.orderNo || ''" width="520" test-id="shipping-drawer">
      <div v-if="selectedOrder" class="ui-v2-stack">
        <DrawerSummary
          status="仅预览，不写入"
          :title="selectedOrder.customerName"
          :description="selectedOrder.address"
          :meta="`${selectedOrder.model} · 真实外部已关闭 · 不会写入`"
          primary-label="重新预览"
          @primary="openShippingPreview"
        />
        <section v-if="shippingPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-safeops-preview">
          <div><span>操作预览</span><strong>{{ shippingPreview.view.title }}</strong></div>
          <div><span>开放状态</span><strong>外部真实调用未开放 / 真实外部已关闭</strong></div>
          <div><span>持久化</span><strong>{{ shippingPreview.view.persistenceLabel }}</strong></div>
          <div><span>执行门禁</span><strong>{{ shippingPreview.view.executeLabel }}</strong></div>
          <div><span>数据写入</span><strong>{{ shippingPreview.view.writeWillExecute }}</strong></div>
          <div><span>外部调用</span><strong>{{ shippingPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>审计记录</span><strong>{{ shippingPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ shippingPreview.view.riskLevel }}</strong></div>
          <div><span>确认令牌</span><strong>{{ shippingPreview.view.confirmLabel }}</strong></div>
          <div><span>幂等保护</span><strong>{{ shippingPreview.view.idempotencyLabel }}</strong></div>
          <div><span>外部网关</span><strong>{{ shippingPreview.view.externalGatewayLabel }}</strong></div>
        </section>
        <p v-if="shippingPreview.error" class="adapter-source__error">{{ shippingPreview.error }}</p>
        <UiV2Section title="寄件信息">
          <div class="ui-v2-detail-grid">
            <div><span>承运商</span><strong>顺丰速运</strong></div>
            <div><span>揽收时间</span><strong>今天 18:00-20:00</strong></div>
            <div><span>收件人</span><strong>{{ selectedOrder.customerName }}</strong></div>
            <div><span>运单号</span><strong>不会生成</strong></div>
          </div>
        </UiV2Section>
        <UiV2Section title="安全说明">
          <p class="drawer-note">外部真实调用未开放；真实外部已关闭；不会调用顺丰；不会生成真实运单或费用。</p>
          <p v-if="shippingPreview.view" class="drawer-note">{{ shippingPreview.view.summary }}</p>
        </UiV2Section>
      </div>
    </BaseDrawer>

    <BaseDrawer v-model="xianyuOpen" title="闲鱼同步预览" :subtitle="selectedOrder?.orderNo || ''" width="560" test-id="xianyu-sync-drawer">
      <div v-if="selectedOrder" class="ui-v2-stack">
        <DrawerSummary
          status="模拟/沙盒预览"
          :title="selectedOrder.orderNo"
          description="不真实同步 · 外部真实调用未开放"
          :meta="`${xianyuDirectionLabel} · ${xianyuModeLabel}`"
          primary-label="重新预览"
          @primary="openXianyuSyncPreview"
        />
        <section v-if="xianyuPreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="orders-xianyu-safeops-preview">
          <div><span>操作预览</span><strong>{{ xianyuPreview.view.title }}</strong></div>
          <div><span>开放状态</span><strong>外部真实调用未开放 / 真实外部已关闭</strong></div>
          <div><span>持久化</span><strong>{{ xianyuPreview.view.persistenceLabel }}</strong></div>
          <div><span>执行门禁</span><strong>{{ xianyuPreview.view.executeLabel }}</strong></div>
          <div><span>数据写入</span><strong>{{ xianyuPreview.view.writeWillExecute }}</strong></div>
          <div><span>外部调用</span><strong>{{ xianyuPreview.view.externalCallWillExecute }}</strong></div>
          <div><span>审计记录</span><strong>{{ xianyuPreview.view.auditLabel }}</strong></div>
          <div><span>风险等级</span><strong>{{ xianyuPreview.view.riskLevel }}</strong></div>
          <div><span>外部网关</span><strong>{{ xianyuPreview.view.externalGatewayLabel }}</strong></div>
          <div><span>外部动作</span><strong>{{ xianyuPreview.view.expectedExternalActionLabel }}</strong></div>
          <div><span>请求预览</span><strong>{{ xianyuPreview.view.requestPayloadPreviewLabel }}</strong></div>
          <div><span>同步模拟</span><strong>{{ xianyuPreview.view.mockXianyuSyncLabel }}</strong></div>
          <div><span>沙盒报文</span><strong>{{ xianyuPreview.view.sandboxPayloadLabel }}</strong></div>
        </section>
        <p v-if="xianyuPreview.error" class="adapter-source__error">{{ xianyuPreview.error }}</p>
        <UiV2Section title="安全边界">
          <p class="drawer-note">当前仅生成闲鱼同步预览 payload，不发送 HTTP，不执行 Python，不调用闲鱼，不更新本地订单状态。</p>
          <p class="drawer-note">手机号、地址、姓名、商品标题、cookie、session、token、API key 不在此预览中明文展示。</p>
          <p v-if="xianyuPreview.view" class="drawer-note">{{ xianyuPreview.view.summary }}</p>
        </UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard, Pagination, StatusTabs, TrackingTimeline } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import {
  createSafeOpsPreviewState,
  runSafeOpsPreview,
  toSafeOpsPreviewView,
} from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import {
  executeOrderInternalNoteUpdate,
  previewXianyuOrderSync,
  previewOrderInternalNoteUpdate,
} from '../../../adapters/uiV2/safeOpsAdapter.js'
import { buildSafeOpsActor } from '../../../adapters/uiV2/actorContextAdapter.js'
import {
  buildOrderOperationalMetrics,
  buildOrderOperationalTabs,
  decorateOperationalOrder,
  filterOperationalOrders,
  paginateOperationalOrders,
} from '../../../adapters/uiV2/orderOperationalMapper.js'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const route = useRoute()
const orders = ref([])
const options = ref({ channels: [], depositStatuses: [], shippingStatuses: [] })
const statusTabs = ref([{ label: '进行中', value: '进行中', count: 0 }])
const status = ref('进行中')
const keyword = ref('')
const channel = ref('全部渠道')
const deposit = ref('全部押金状态')
const shipping = ref('全部物流状态')
const risk = ref('全部风险')
const assignee = ref('全部负责人')
const page = ref(1)
const pageSize = 20
const selectedOrder = ref(null)
const drawerOpen = ref(false)
const shippingOpen = ref(false)
const xianyuOpen = ref(false)
const showAdvanced = ref(false)
const selectedRows = ref([])
const loading = ref(false)
const detailLoading = ref(false)
const loadError = ref('')
const orderPreview = ref(createSafeOpsPreviewState())
const shippingPreview = ref(createSafeOpsPreviewState())
const xianyuPreview = ref(createSafeOpsPreviewState())
const internalNotePreview = ref(createSafeOpsPreviewState())
const internalNoteExecute = ref(createSafeOpsPreviewState())
const internalNoteDraft = ref('')
const internalNoteLoading = ref(false)
const internalNoteError = ref('')
const xianyuSyncLoading = ref(false)
const xianyuSyncMode = ref('disabled')
const xianyuSyncDirection = ref('pull_remote_order')
const sourceMeta = ref(uiV2Adapter.getMeta())

const columns = [
  { key: 'select', label: '', width: '42px' },
  { key: 'orderNo', label: '订单号' },
  { key: 'customerName', label: '客户' },
  { key: 'deviceSummary', label: '设备摘要' },
  { key: 'rentPeriod', label: '租期' },
  { key: 'stage', label: '当前阶段' },
  { key: 'riskDisplay', label: '风险/异常' },
  { key: 'rentAmount', label: '金额' },
  { key: 'channel', label: '渠道' },
  { key: 'ownerStore', label: '负责人/门店' },
  { key: 'nextAction', label: '操作' },
]
const xianyuSyncModeOptions = [
  { label: '默认关闭', value: 'disabled' },
  { label: '模拟预览', value: 'mock' },
  { label: '沙盒预览', value: 'sandbox' },
  { label: '真实模式（已关闭）', value: 'real' },
]
const xianyuSyncDirectionOptions = [
  { label: '拉取远端订单', value: 'pull_remote_order' },
  { label: '推送本地状态', value: 'push_local_state' },
  { label: '对账状态', value: 'reconcile_status' },
]

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})

const orderMetrics = computed(() => buildOrderOperationalMetrics(orders.value))

const filteredOrders = computed(() => filterOperationalOrders(orders.value, {
  status: status.value,
  keyword: keyword.value,
  channel: channel.value,
  deposit: deposit.value,
  shipping: shipping.value,
  risk: risk.value,
  assignee: assignee.value,
}))
const pagedOrders = computed(() => paginateOperationalOrders(filteredOrders.value, page.value, pageSize))

const drawerSubtitle = computed(() => selectedOrder.value ? `${selectedOrder.value.customerName} · ${selectedOrder.value.model}` : '')
const xianyuModeLabel = computed(() => xianyuSyncModeOptions.find((item) => item.value === xianyuSyncMode.value)?.label || '默认关闭')
const xianyuDirectionLabel = computed(() => xianyuSyncDirectionOptions.find((item) => item.value === xianyuSyncDirection.value)?.label || '拉取远端订单')
const selectedOrderInternalNote = computed(() => String(
  selectedOrder.value?.raw?.internal_note
  || selectedOrder.value?.internalNote
  || ''
))
const selectedOrderSafeId = computed(() => String(
  selectedOrder.value?.rawId
  || selectedOrder.value?.raw?.id
  || selectedOrder.value?.id
  || ''
))
const canExecuteInternalNote = computed(() => Boolean(
  internalNotePreview.value?.result?.ok
  && internalNotePreview.value?.result?.executeEnabled
  && internalNotePreview.value?.result?.confirmRequirement?.tokenId
  && selectedOrderSafeId.value
))
const orderSteps = computed(() => selectedOrder.value ? [
  { label: '订单创建', desc: selectedOrder.value.createdAt, done: true },
  { label: '押金/免押确认', desc: selectedOrder.value.depositStatus, done: !['待收', '免押审核中'].includes(selectedOrder.value.depositStatus), current: ['待押金'].includes(selectedOrder.value.status) },
  { label: '设备分配', desc: (selectedOrder.value.deviceIds || []).join(', ') || '未分配', done: !['待分配设备', '待确认'].includes(selectedOrder.value.status), current: selectedOrder.value.status === '待分配设备' },
  { label: '物流发货', desc: selectedOrder.value.shippingStatus, done: ['运输中', '已签收'].includes(selectedOrder.value.shippingStatus), current: selectedOrder.value.status === '待发货' },
  { label: '归还验机', desc: selectedOrder.value.status, done: ['已完成'].includes(selectedOrder.value.status), current: ['待归还', '待验机'].includes(selectedOrder.value.status) },
] : [])

function countByStatuses(nextStatuses) {
  return orders.value.filter((order) => nextStatuses.includes(order.status)).length
}

async function loadOrders() {
  loading.value = true
  loadError.value = ''
  try {
    const nextOrders = await uiV2Adapter.getOrders()
    orders.value = Array.isArray(nextOrders) ? nextOrders : []
    options.value = { channels: [], depositStatuses: [], shippingStatuses: [], ...(await uiV2Adapter.getOptions()) }
    statusTabs.value = buildOrderOperationalTabs(orders.value)
    sourceMeta.value = uiV2Adapter.getLastMeta('getOrders')
  } catch (error) {
    orders.value = []
    statusTabs.value = buildOrderOperationalTabs([])
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '订单只读数据读取失败'
  } finally {
    loading.value = false
  }
}

async function openOrder(order) {
  selectedOrder.value = decorateOperationalOrder(order)
  drawerOpen.value = true
  internalNotePreview.value = createSafeOpsPreviewState()
  internalNoteExecute.value = createSafeOpsPreviewState()
  xianyuPreview.value = createSafeOpsPreviewState()
  internalNoteDraft.value = String(order?.raw?.internal_note || order?.internalNote || '')
  internalNoteError.value = ''
  detailLoading.value = true
  try {
    const detail = await uiV2Adapter.getOrder(order.orderNo)
    if (detail) {
      selectedOrder.value = decorateOperationalOrder({ ...order, ...detail })
      internalNoteDraft.value = String(detail?.raw?.internal_note || detail?.internalNote || '')
    } else if (uiV2Adapter.getLastMeta('getOrder')?.source === 'mock-fallback') {
      loadError.value = '真实详情读取失败，当前显示列表只读摘要。'
    }
    sourceMeta.value = uiV2Adapter.getLastMeta('getOrder') || sourceMeta.value
  } catch (error) {
    loadError.value = error?.message || '订单详情读取失败'
  } finally {
    detailLoading.value = false
  }
}

function buildUiActor() {
  return buildSafeOpsActor('orders-page')
}

async function refreshSelectedOrderAfterInternalNote() {
  const currentOrderNo = selectedOrder.value?.orderNo
  if (!currentOrderNo) return
  await loadOrders()
  const refreshedListOrder = orders.value.find((order) => order.orderNo === currentOrderNo) || selectedOrder.value
  const detail = await uiV2Adapter.getOrder(refreshedListOrder.rawId || refreshedListOrder.orderNo)
  selectedOrder.value = decorateOperationalOrder({
    ...refreshedListOrder,
    ...detail,
  })
  internalNoteDraft.value = String(selectedOrder.value?.raw?.internal_note || selectedOrder.value?.internalNote || internalNoteDraft.value || '')
}

async function previewInternalNoteUpdate() {
  internalNoteLoading.value = true
  internalNoteError.value = ''
  internalNoteExecute.value = createSafeOpsPreviewState()
  try {
    const result = await previewOrderInternalNoteUpdate({
      orderId: selectedOrderSafeId.value,
      internalNote: internalNoteDraft.value,
      actor: buildUiActor(),
    })
    internalNotePreview.value = {
      loading: false,
      result,
      view: toSafeOpsPreviewView(result),
      error: result?.ok ? '' : (result?.message || '内部备注预览失败'),
    }
    internalNoteError.value = internalNotePreview.value.error
  } catch (error) {
    internalNoteError.value = error?.message || '内部备注预览失败'
    internalNotePreview.value = {
      loading: false,
      result: null,
      view: null,
      error: internalNoteError.value,
    }
  } finally {
    internalNoteLoading.value = false
  }
}

async function executeInternalNoteUpdate() {
  if (!canExecuteInternalNote.value) {
    internalNoteError.value = '请先完成内部备注预览。'
    return
  }
  internalNoteLoading.value = true
  internalNoteError.value = ''
  try {
    const result = await executeOrderInternalNoteUpdate({
      previewResult: internalNotePreview.value.result,
      orderId: selectedOrderSafeId.value,
      internalNote: internalNoteDraft.value,
      actor: buildUiActor(),
    })
    internalNoteExecute.value = {
      loading: false,
      result,
      view: toSafeOpsPreviewView(result),
      error: result?.ok ? '' : (result?.message || '内部备注写入失败'),
    }
    internalNoteError.value = internalNoteExecute.value.error
    if (result?.ok) {
      selectedOrder.value = decorateOperationalOrder({
        ...selectedOrder.value,
        note: internalNoteDraft.value,
        raw: {
          ...(selectedOrder.value?.raw || {}),
          internal_note: internalNoteDraft.value,
        },
      })
      await refreshSelectedOrderAfterInternalNote()
    }
  } catch (error) {
    internalNoteError.value = error?.message || '内部备注写入失败'
    internalNoteExecute.value = {
      loading: false,
      result: null,
      view: null,
      error: internalNoteError.value,
    }
  } finally {
    internalNoteLoading.value = false
  }
}

function toggleRow(orderNo) {
  selectedRows.value = selectedRows.value.includes(orderNo)
    ? selectedRows.value.filter((item) => item !== orderNo)
    : [...selectedRows.value, orderNo]
}

function nextPreviewStatus(currentStatus) {
  const transitions = {
    待确认: '待押金',
    待押金: '待分配设备',
    待分配设备: '待发货',
    待发货: '运输中',
    运输中: '租用中',
    租用中: '待归还',
    待归还: '待验机',
    待验机: '已完成',
  }
  return transitions[currentStatus] || currentStatus || '待确认'
}

async function openStatusPreview() {
  orderPreview.value = { ...orderPreview.value, loading: true, error: '' }
  orderPreview.value = await runSafeOpsPreview('order.status.transition.preview', {
    target: {
      type: 'order',
      id: selectedOrder.value?.orderNo || '',
    },
    payload: {
      orderId: selectedOrder.value?.orderNo || '',
      fromStatus: selectedOrder.value?.status || '',
      toStatus: nextPreviewStatus(selectedOrder.value?.status),
      source: 'orders-drawer',
    },
  })
}

async function openEditPreview() {
  orderPreview.value = { ...orderPreview.value, loading: true, error: '' }
  orderPreview.value = await runSafeOpsPreview('order.edit.preview', {
    target: {
      type: 'order',
      id: selectedOrder.value?.orderNo || '',
    },
    payload: {
      orderId: selectedOrder.value?.orderNo || '',
      rentStartDate: selectedOrder.value?.rentStart || '',
      rentEndDate: selectedOrder.value?.rentEnd || '',
      deviceId: Array.isArray(selectedOrder.value?.deviceIds) ? selectedOrder.value.deviceIds[0] : '',
      modelCode: selectedOrder.value?.model || '',
      rentAmount: selectedOrder.value?.rentAmount || '',
      source: 'orders-drawer',
    },
  })
}

async function openBulkEditPreview() {
  orderPreview.value = { ...orderPreview.value, loading: true, error: '' }
  orderPreview.value = await runSafeOpsPreview('order.edit.preview', {
    target: {
      type: 'order-bulk',
      id: selectedRows.value.join(','),
    },
    payload: {
      orderIds: selectedRows.value,
      reason: 'bulk-assignee-or-contact-preview',
      source: 'orders-page',
    },
  })
}

async function openCreateOrderPreview() {
  orderPreview.value = { ...orderPreview.value, loading: true, error: '' }
  orderPreview.value = await runSafeOpsPreview('order.edit.preview', {
    target: {
      type: 'order-create',
      id: 'new-order-preview',
    },
    payload: {
      reason: 'create-order-preview',
      source: 'orders-page',
      amount: '',
      rentStartDate: '',
      rentEndDate: '',
      modelCode: '',
    },
  })
}

async function openShippingPreview() {
  shippingOpen.value = true
  shippingPreview.value = { ...shippingPreview.value, loading: true, error: '' }
  shippingPreview.value = await runSafeOpsPreview('logistics.sf.create_order', {
    target: {
      type: 'shipment',
      id: selectedOrder.value?.orderNo || '',
      orderNo: selectedOrder.value?.orderNo || '',
    },
    payload: {
      carrier: 'sf',
      orderId: selectedOrder.value?.orderNo || '',
      modelCode: selectedOrder.value?.model || '',
      receiverName: selectedOrder.value?.customerName || '',
      receiverAddress: selectedOrder.value?.address || '',
      senderName: 'merchant',
      providerName: 'sf_express',
      source: 'orders-drawer',
    },
  })
}

function getXianyuOrderSyncTargetId() {
  return String(
    selectedOrder.value?.raw?.xianyu_order_id
    || selectedOrder.value?.raw?.external_order_id
    || selectedOrder.value?.xianyuOrderId
    || selectedOrder.value?.orderNo
    || ''
  )
}

async function openXianyuSyncPreview() {
  if (!selectedOrder.value) return
  xianyuOpen.value = true
  xianyuSyncLoading.value = true
  xianyuPreview.value = { ...xianyuPreview.value, loading: true, error: '' }
  try {
    const result = await previewXianyuOrderSync({
      mode: xianyuSyncMode.value,
      syncDirection: xianyuSyncDirection.value,
      orderId: selectedOrderSafeId.value,
      orderNo: selectedOrder.value?.orderNo || '',
      localOrderId: selectedOrderSafeId.value,
      xianyuOrderId: getXianyuOrderSyncTargetId(),
      modelCode: selectedOrder.value?.raw?.model_code || selectedOrder.value?.modelCode || '',
      scenario: 'orders_page_preview_only',
      reason: 'ui-v2-xianyu-sync-preview',
      actor: buildUiActor(),
    })
    xianyuPreview.value = {
      loading: false,
      result,
      view: toSafeOpsPreviewView(result),
      error: result?.ok ? '' : (result?.message || '闲鱼同步预览失败'),
    }
  } catch (error) {
    xianyuPreview.value = {
      loading: false,
      result: null,
      view: null,
      error: error?.message || '闲鱼同步预览失败',
    }
  } finally {
    xianyuSyncLoading.value = false
  }
}

watch(
  () => route.query.order,
  async (orderNo) => {
    if (typeof orderNo !== 'string') return
    if (!orders.value.length) await loadOrders()
    const order = orders.value.find((item) => item.orderNo === orderNo) || await uiV2Adapter.getOrder(orderNo)
    if (order) openOrder(order)
  },
  { immediate: true },
)

watch(
  () => route.query.intent,
  async (intent) => {
    if (intent !== 'create-order-preview') return
    await openCreateOrderPreview()
  },
  { immediate: true },
)

watch([status, keyword, channel, deposit, shipping, risk, assignee], () => {
  page.value = 1
})

onMounted(loadOrders)
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.4fr repeat(2, minmax(180px, 0.7fr));
  gap: 10px;
  align-items: end;
}

.bulk-bar {
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--brand-primary-border);
  border-radius: var(--radius-12);
  background: linear-gradient(180deg, rgba(232, 247, 243, 0.9), rgba(232, 247, 243, 0.66));
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.bulk-bar span {
  color: var(--color-primary);
  font-weight: 740;
}

.next-action {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
  font-weight: 720;
}

.adapter-source-row {
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: var(--space-token-8);
  flex-wrap: wrap;
}

.adapter-source,
.adapter-source__reason,
.adapter-source__error {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 760;
}

.adapter-source {
  border: 1px solid var(--ui-border);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
}

.adapter-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}

.adapter-source.is-mock-fallback,
.adapter-source__reason {
  border-color: rgba(245, 158, 11, 0.26);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}

.adapter-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.92);
  color: #b91c1c;
}

.adapter-state {
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 680;
}

.adapter-state.is-compact {
  padding: 8px 10px;
}

.drawer-note {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.internal-note-editor {
  display: grid;
  gap: 10px;
}

.internal-note-editor__input {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-8);
  background: var(--ui-surface);
  color: var(--color-text-primary);
  font: inherit;
  line-height: 1.5;
}

.internal-note-editor__input:focus {
  outline: 2px solid rgba(22, 163, 128, 0.18);
  border-color: var(--color-primary);
}

.internal-note-editor__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
