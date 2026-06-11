<template>
  <div class="page sf-page">
    <PageHeader
      title="顺丰寄件"
      subtitle="发货、查件一站式处理，三步完成寄件下单"
      icon="📮"
      :breadcrumb="['履约管理', '顺丰寄件']"
      compact
    >
      <template #actions>
        <button class="btn btn-secondary" @click="batchDrawerOpen = true">批量寄件</button>
        <button class="btn btn-secondary" @click="refreshAll">刷新</button>
      </template>
    </PageHeader>

    <KpiStrip :items="shippingKpiItems" />

    <!-- Tabs -->
    <nav class="sf-tabs">
      <button v-for="t in tabs" :key="t.key" :class="{ active: tab === t.key }" @click="switchTab(t.key)">
        <span class="tab-icon">{{ t.icon }}</span>
        <span>{{ t.label }}</span>
      </button>
    </nav>

    <!-- Notification -->
    <div v-if="notification" :class="['banner', `banner-${notification.type}`]">
      {{ notification.text }}
    </div>

    <!-- ═══════════════════════════════════════════ -->
    <!-- TAB 1：寄快递（三步向导）                   -->
    <!-- ═══════════════════════════════════════════ -->
    <div v-if="tab === 'create'">

      <!-- 双栏工作区 -->
      <div class="sf-workbench">

        <SfCreateForm
          v-model:recipient-paste="recipientPaste"
          v-model:sender-editing="senderEditing"
          :steps="steps"
          :step="step"
          :form="form"
          :service-options="serviceOptions"
          :quote-checked="quoteChecked"
          :service-unavailable-hint="serviceUnavailableHint"
          :quote-loading="quoteLoading"
          :quote-result="quoteResult"
          :monthly-card-configured="monthlyCardConfigured"
          :intra-city-configured="intraCityConfigured"
          :sender-config-missing-fields="senderConfigMissingFields"
          :sender-addr-text="senderAddrText"
          :receiver-addr-text="receiverAddrText"
          :is-intra-city="isIntraCity"
          :address-step-hint="addressStepHint"
          :service-step-hint="serviceStepHint"
          :current-shipment="currentShipment"
          :delivery-estimate="deliveryEstimate"
          :busy="busy"
          :svc-available="svcAvailable"
          :pickup-preset-active="pickupPresetActive"
          :product-label="productLabel"
          :fee-label="feeLabel"
          :status-label="statusLabel"
          :shipment-status-variant="shipmentStatusVariant"
          @go-step="goStep"
          @parse-recipient-paste="parseRecipientPaste"
          @clear-receiver="clearReceiver"
          @validate-planned-send-at="validatePlannedSendAt"
          @apply-pickup-preset="applyPickupPreset"
          @select-service="selectService"
          @save-draft="saveDraft"
        />

        <!-- 右侧：摘要栏 -->
        <SfSummaryPanel
          :form="form"
          :sender-addr-text="senderAddrText"
          :receiver-addr-text="receiverAddrText"
          :step="step"
          :is-intra-city="isIntraCity"
          :quote-result="quoteResult"
          :current-step-state="currentStepState"
          :address-step-disabled-reason="addressStepDisabledReason"
          :service-step-disabled-reason="serviceStepDisabledReason"
          :confirm-step-disabled-reason="confirmStepDisabledReason"
          :busy="busy"
          :product-label="productLabel"
          :fee-label="feeLabel"
          @go-step="goStep"
          @place-order="placeOrder"
          @precheck="precheck"
        />

      </div>
      <!-- /sf-workbench -->
    </div>

    <!-- ═══════════════════════════════════════════ -->
    <!-- TAB 2：寄件记录                            -->
    <!-- ═══════════════════════════════════════════ -->
    <div v-if="tab === 'records'">
      <SfShipmentRecords
        :shipments="shipments"
        :filters="filters"
        :shipment-stats="shipmentStats"
        :latest-route="latestRoute"
        :shipment-display-status="shipmentDisplayStatus"
        :shipment-status-variant="shipmentStatusVariant"
        :city-label="cityLabel"
        :fee-label="feeLabel"
        :time-label="timeLabel"
        @load-shipments="loadShipments"
        @open-shipment="openShipment"
        @recover-result="recoverResult"
        @refresh-routes="refreshRoutes"
      />
    </div>

    <!-- ═══════════════════════════════════════════ -->
    <!-- TAB 3：运单追踪                            -->
    <!-- ═══════════════════════════════════════════ -->
    <div v-if="tab === 'query'">
      <section class="panel">
        <div class="section-head">
          <h3>运单追踪</h3>
          <p>输入运单号和手机号查询物流轨迹、预计派送、清单运费</p>
        </div>
        <div class="track-form">
          <select v-model="query.shipmentId" @change="fillQueryTrackingNo" class="ff-select">
            <option value="">选择已有寄件单</option>
            <option v-for="s in shipments" :key="s.id" :value="String(s.id)">
              {{ s.shipment_no }}{{ s.tracking_no ? ' · ' + s.tracking_no : '' }}
            </option>
          </select>
          <input v-model="query.trackingNo" placeholder="顺丰运单号" />
          <input v-model="query.verifyMobile" placeholder="收/寄件人手机号" />
          <div class="track-btns">
            <button class="btn btn-primary btn-sm" :disabled="busy" @click="queryPromise">预计派送</button>
            <button class="btn btn-secondary btn-sm" :disabled="busy" @click="queryRoutes">物流轨迹</button>
            <button class="btn btn-secondary btn-sm" :disabled="busy" @click="queryFee">清单运费</button>
          </div>
        </div>
      </section>

      <section v-if="promiseResult" class="panel">
        <div class="section-head">
          <code class="text-lg">{{ promiseResult.waybillNo || query.trackingNo }}</code>
          <span v-if="promiseResult.expectedArriveAt" class="pill pill-on">预计 {{ promiseResult.expectedArriveAt }} 派送</span>
        </div>
        <div class="kpi-strip kpi-2">
          <div class="kpi">
            <div class="kpi-body">
              <div class="kpi-val">{{ feeLabel(promiseResult.billedFee) }}</div>
              <div class="kpi-lbl">清单运费</div>
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-body">
              <div class="kpi-val">{{ promiseResult.routes?.length || 0 }}</div>
              <div class="kpi-lbl">轨迹节点</div>
            </div>
          </div>
        </div>
        <div v-if="promiseResult.routes?.length" class="route-timeline">
          <div v-for="r in promiseResult.routes" :key="`${r.acceptTime}-${r.remark}`">
            <b>{{ r.acceptTime }}</b>
            <span>{{ r.acceptAddress }} {{ r.remark }}</span>
          </div>
        </div>
      </section>
    </div>

    <SfShipmentDetailDrawer
      v-model="detailDialogOpen"
      :selected-detail="selectedDetail"
      :actual-paid-form="actualPaidForm"
      :busy="busy"
      :shipment-display-status="shipmentDisplayStatus"
      :shipment-status-variant="shipmentStatusVariant"
      :latest-route="latestRoute"
      :full-address="fullAddress"
      :time-label="timeLabel"
      :pickup-time-label="pickupTimeLabel"
      :fee-label="feeLabel"
      :status-label="statusLabel"
      @close="closeShipmentDetail"
      @refresh-routes="refreshRoutes"
      @refresh-fee="refreshFee"
      @cancel-shipment="cancelShipment"
      @save-actual-paid="saveActualPaid"
    />

    <SfBatchShipmentDrawer
      v-model="batchDrawerOpen"
      v-model:batch-selected-ids="batchSelectedIds"
      :pending-orders="pendingOrders"
      :batch-result-map="batchResultMap"
      :batch-results="batchResults"
      :all-pending-selected="allPendingSelected"
      :batch-loading="batchLoading"
      :busy="busy"
      @load-pending-shipment-orders="loadPendingShipmentOrders"
      @toggle-select-all-pending="toggleSelectAllPending"
      @place-selected-orders="placeSelectedOrders"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import KpiStrip from '../../components/KpiStrip.vue'
import PageHeader from '../../components/PageHeader.vue'
import { useConfirmDialog } from '../../composables/useConfirmDialog'
import { configApi, getErrorMessage, sfApi } from '../../services/electronApiClient'
import SfBatchShipmentDrawer from './sf-shipping/SfBatchShipmentDrawer.vue'
import SfCreateForm from './sf-shipping/SfCreateForm.vue'
import SfShipmentDetailDrawer from './sf-shipping/SfShipmentDetailDrawer.vue'
import SfShipmentRecords from './sf-shipping/SfShipmentRecords.vue'
import SfSummaryPanel from './sf-shipping/SfSummaryPanel.vue'
import { useSfShipmentActions } from './sf-shipping/useSfShipmentActions'

// ── Navigation ──
const { confirm: confirmDialog } = useConfirmDialog()
const tab = ref('create')
const step = ref('address')
const steps = [
  { key: 'address', label: '填地址与取件时间' },
  { key: 'service', label: '选服务' },
  { key: 'confirm', label: '确认下单' },
]
const tabs = [
  { key: 'create', label: '寄快递', icon: '📮' },
  { key: 'records', label: '寄件记录', icon: '📋' },
  { key: 'query', label: '运单追踪', icon: '🔍' },
]
function stepIdx(k) { return steps.findIndex(s => s.key === k) }
function switchTab(t) { tab.value = t; notification.value = null; quoteChecked.value = false; quoteResult.value = null; confirmedAvailable.value = new Set(['sf_standard']); confirmedUnavailable.value = new Set(); if (t === 'create') step.value = 'address'; if (t === 'records') loadShipments() }
function goStep(s) { step.value = s; notification.value = null; if (s === 'address') { quoteChecked.value = false; quoteResult.value = null; confirmedAvailable.value = new Set(['sf_standard']); confirmedUnavailable.value = new Set() } else if (s === 'service') quoteExpressNow() }

// ── State ──
const busy = ref(false)
const notification = ref(null)
const batchDrawerOpen = ref(false)
const senderEditing = ref(false)
const configLoaded = ref(false)
const quoteResult = ref(null)
const quoteLoading = ref(false)
const deliveryEstimate = ref(null)
const currentShipment = ref(null)
const shipments = ref([])
const pendingOrders = ref([])
const batchSelectedIds = ref([])
const batchResults = ref([])
const batchLoading = ref(false)
const promiseResult = ref(null)
const selectedDetail = ref(null)
const detailDialogOpen = ref(false)

const filters = reactive({ status: '' })
const query = reactive({ shipmentId: '', trackingNo: '', verifyMobile: '' })
const defaultSender = reactive({ name: '', mobile: '', province: '', city: '', district: '', address: '' })
const actualPaidForm = reactive({ amount: '', note: '' })
const intracityConfig = ref({})

const DP = '四川省'; const DC = '成都市'; const DD = '金牛区'
const provinceAliases = [
  ['北京市', '北京'],
  ['天津市', '天津'],
  ['上海市', '上海'],
  ['重庆市', '重庆'],
  ['河北省', '河北'],
  ['山西省', '山西'],
  ['辽宁省', '辽宁'],
  ['吉林省', '吉林'],
  ['黑龙江省', '黑龙江'],
  ['江苏省', '江苏'],
  ['浙江省', '浙江'],
  ['安徽省', '安徽'],
  ['福建省', '福建'],
  ['江西省', '江西'],
  ['山东省', '山东'],
  ['河南省', '河南'],
  ['湖北省', '湖北'],
  ['湖南省', '湖南'],
  ['广东省', '广东'],
  ['海南省', '海南'],
  ['四川省', '四川'],
  ['贵州省', '贵州'],
  ['云南省', '云南'],
  ['陕西省', '陕西'],
  ['甘肃省', '甘肃'],
  ['青海省', '青海'],
  ['台湾省', '台湾'],
  ['内蒙古自治区', '内蒙古'],
  ['广西壮族自治区', '广西'],
  ['西藏自治区', '西藏'],
  ['宁夏回族自治区', '宁夏'],
  ['新疆维吾尔自治区', '新疆'],
  ['香港特别行政区', '香港'],
  ['澳门特别行政区', '澳门'],
]
const cityAliases = {
  成都: '成都市',
  绵阳: '绵阳市',
  德阳: '德阳市',
  宜宾: '宜宾市',
  乐山: '乐山市',
  南充: '南充市',
  泸州: '泸州市',
  达州: '达州市',
  自贡: '自贡市',
  北京: '北京市',
  上海: '上海市',
  天津: '天津市',
  重庆: '重庆市',
  广州: '广州市',
  深圳: '深圳市',
  杭州: '杭州市',
  南京: '南京市',
  武汉: '武汉市',
  西安: '西安市',
}

const form = reactive({
  id: null, productCode: 'sf_standard',
  senderName: '', senderMobile: '', senderProvince: '', senderCity: '', senderDistrict: '', senderAddress: '',
  saveSenderAsDefault: false,
  receiverName: '', receiverMobile: '',
  receiverProvince: DP, receiverCity: DC, receiverDistrict: DD, receiverAddress: '',
  cargoName: '租赁设备', weightKg: 1, plannedSendAt: '',
})
const recipientPaste = ref(`${DP}${DC}${DD}`)

const serviceOptions = [
  { code: 'sf_standard', name: '顺丰标快', desc: '全国寄递，时效稳定，性价比高', tag: '1-3天' },
  { code: 'sf_half_day', name: '顺丰半日达', desc: '同城半日即达，上午寄下午到', tag: '当日达' },
  { code: 'sf_land_package', name: '陆运包裹', desc: '适合普通陆运寄递，成本更稳', tag: '陆运' },
  { code: 'sf_intra_city_quote', name: '顺丰同城询价', desc: '同城即时配送费用/时效查询', tag: '仅询价' },
]
const quoteChecked = ref(false)
// 记录已确认可用/不可用的产品 code
const confirmedAvailable = ref(new Set(['sf_standard'])) // 标快默认可用
const confirmedUnavailable = ref(new Set())

function svcAvailable(code) {
  if (code === 'sf_intra_city_quote') return intraCityConfigured.value ? true : false
  if (confirmedUnavailable.value.has(code)) return false
  if (confirmedAvailable.value.has(code)) return true
  return null // 尚未确认
}

const serviceUnavailableHint = computed(() => {
  if (form.productCode === 'sf_intra_city_quote' && !intraCityConfigured.value) return '同城询价未配置，请在设置中填写凭据'
  if (confirmedUnavailable.value.size) {
    const names = [...confirmedUnavailable.value].map(c => serviceOptions.find(s => s.code === c)?.name).filter(Boolean)
    if (names.length) return names.join('、') + ' 该路线不支持，已自动切换为顺丰标快'
  }
  return null
})

function selectService(code) {
  if (svcAvailable(code) === false) return // 已确认不可用，忽略点击
  form.productCode = code
  quoteResult.value = null
  quoteExpressNow()
}

// ── Computed ──
const isIntraCity = computed(() => form.productCode === 'sf_intra_city_quote')
const monthlyCardConfigured = computed(() => Boolean(String(intracityConfig.value.SF_MONTHLY_CARD || '').trim()))
const intraCityConfigured = computed(() => ['SF_INTRACITY_API','SF_INTRACITY_COMPANY_CODE','SF_INTRACITY_ACCESS_CODE','SF_INTRACITY_CHECKWORD','SF_INTRACITY_PROJECT_CODE','SF_INTRACITY_SHOP_ID'].every(k => String(intracityConfig.value[k] || '').trim()))
const senderAddrText = computed(() => [form.senderProvince, form.senderCity, form.senderDistrict, form.senderAddress].filter(Boolean).join('') || '')
const receiverAddrText = computed(() => [form.receiverProvince, form.receiverCity, form.receiverDistrict, form.receiverAddress].filter(Boolean).join('') || '')
const addrFilled = computed(() => form.senderName && form.senderMobile && form.senderProvince && form.senderCity && form.senderAddress && form.receiverName && form.receiverMobile && form.receiverProvince && form.receiverCity && form.receiverAddress)
const serviceReady = computed(() => addrFilled.value && form.cargoName && form.weightKg)
const canPlaceOrder = computed(() => serviceReady.value && form.plannedSendAt && validatePlannedSendAt())
const senderConfigMissingFields = computed(() => [[form.senderName,'寄件联系人'],[form.senderMobile,'寄件手机号'],[form.senderProvince,'寄件省'],[form.senderCity,'寄件市'],[form.senderAddress,'寄件详细地址']].filter(([v])=>!String(v||'').trim()).map(([,l])=>l))
const pendingSelectableOrders = computed(() => pendingOrders.value.filter(o => o.selectable))
const allPendingSelected = computed(() => pendingSelectableOrders.value.length > 0 && pendingSelectableOrders.value.every(o => batchSelectedIds.value.includes(o.id)))
const batchResultMap = computed(() => Object.fromEntries(batchResults.value.map(r => [r.orderId, r])))
const shipmentStats = computed(() => ({ active: shipments.value.filter(s => ['submitted','result_pending'].includes(s.status)).length }))
const todaySubmittedCount = computed(() => {
  const today = localDateText()
  return shipments.value.filter((s) => String(s.created_at || s.planned_send_at || '').slice(0, 10) === today && s.status === 'submitted').length
})
const shippingExceptionCount = computed(() => shipments.value.filter((s) => ['rejected', 'cancelled', 'manual_review'].includes(s.status)).length)
const shippingKpiItems = computed(() => [
  { key: 'pending_orders', label: '待寄件订单', value: pendingSelectableOrders.value.length, hint: '可批量创建', tone: 'warning' },
  { key: 'active_shipments', label: '运输中', value: shipmentStats.value.active, hint: '待跟踪', tone: 'info' },
  { key: 'today_submitted', label: '今日已下单', value: todaySubmittedCount.value, hint: '当日提交', tone: 'success' },
  { key: 'shipping_exception', label: '异常/待确认', value: shippingExceptionCount.value, hint: '需人工处理', tone: 'danger' },
])
const addressStepDisabledReason = computed(() => {
  if (!addrFilled.value) return '请先完善寄收件地址'
  if (!form.plannedSendAt) return '请先选择取件时间'
  return ''
})
const serviceStepDisabledReason = computed(() => {
  if (!serviceReady.value) return '请先补充货物名称和重量'
  return ''
})
const confirmStepDisabledReason = computed(() => {
  if (isIntraCity.value && !intraCityConfigured.value) return '请先在设置页配置顺丰同城凭据'
  if (!canPlaceOrder.value) return '请先完成地址、服务和取件时间'
  return ''
})
const addressStepHint = computed(() => addressStepDisabledReason.value || '✓ 信息完整，可以进入下一步')
const serviceStepHint = computed(() => serviceStepDisabledReason.value || '✓ 服务信息完整，可以继续确认')
const currentStepState = computed(() => {
  if (step.value === 'address') return { ok: !addressStepDisabledReason.value, text: addressStepDisabledReason.value ? '○ 地址信息待完善' : '✓ 可以进入下一步', reason: addressStepDisabledReason.value }
  if (step.value === 'service') return { ok: !serviceStepDisabledReason.value, text: serviceStepDisabledReason.value ? '○ 服务信息待完善' : '✓ 可以进入下一步', reason: serviceStepDisabledReason.value }
  return { ok: !confirmStepDisabledReason.value, text: confirmStepDisabledReason.value ? '○ 当前还不能下单' : '✓ 可以提交下单', reason: confirmStepDisabledReason.value }
})

// ── Helpers ──
function notify(type, text) { notification.value = { type, text }; setTimeout(() => { if (notification.value?.text === text) notification.value = null }, 5000) }
function localDateText(d = new Date()) { return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-') }
function timeLabel(v) { return v ? String(v).replace('T',' ').slice(0,16) : '-' }
function cityLabel(c, d) { return [c, d].filter(Boolean).join(' ') || '-' }
function feeLabel(v) { return (v === null || v === undefined || v === '') ? '-' : `¥${Number(v).toFixed(2)}` }
function fullAddress(s, type) { return [s?.[`${type}_province`], s?.[`${type}_city`], s?.[`${type}_district`], s?.[`${type}_address`]].filter(Boolean).join('') || '-' }
function productLabel(c) { return ({ sf_standard:'顺丰标快', sf_half_day:'顺丰半日达', sf_land_package:'陆运包裹', sf_intra_city_quote:'同城询价' })[c] || c }
function statusLabel(s) { return ({ draft:'草稿',prechecked:'已预校验',submitted:'已下单',result_pending:'结果待查',manual_review:'待确认',rejected:'不可收派',cancelled:'已取消',quoted:'同城已询价' })[s] || s || '-' }
function shipmentStatusVariant(status, route = null) {
  if (status === 'submitted' && route) return 'info'
  if (status === 'submitted') return 'success'
  if (status === 'draft' || status === 'quoted' || status === 'prechecked') return 'neutral'
  if (status === 'result_pending' || status === 'manual_review') return 'warning'
  if (status === 'rejected') return 'danger'
  if (status === 'cancelled') return 'neutral'
  return 'neutral'
}
function latestRoute(s) { const r = s?.routesResult?.routes; return Array.isArray(r) && r.length ? r[r.length-1] : null }
function pickupTimeLabel(s) { const r = s?.routesResult?.routes; if (!Array.isArray(r)) return '-'; const p = r.find(x => /揽收|收件|已收取|已揽件/.test(`${x.remark||''}${x.opCode||''}`)); return p?.acceptTime || '-' }
function shipmentDisplayStatus(s) { const r = latestRoute(s); if (r?.remark) return r.remark; if (s?.status === 'submitted') return pickupTimeLabel(s) === '-' ? '待揽收' : '运输中'; return statusLabel(s?.status) }
function rcPill(s) { if (s?.status === 'cancelled'||s?.status==='rejected') return 'pill-off'; if (s?.status==='submitted'||latestRoute(s)) return 'pill-on'; return '' }

function pickupPresetActive(time) { return String(form.plannedSendAt||'').slice(11,16) === time }
function applyPickupPreset(time) { form.plannedSendAt = `${String(form.plannedSendAt||'').slice(0,10)||localDateText()}T${time}`; validatePlannedSendAt() }
function validatePlannedSendAt() {
  if (!form.plannedSendAt) return false
  const t = String(form.plannedSendAt).slice(11,16)
  if (t < '08:00' || t > '20:00') { form.plannedSendAt = ''; notify('error','取件时间只能选择 08:00-20:00'); return false }
  return true
}

function applyDefaultSender(c = intracityConfig.value) {
  defaultSender.name = c.SF_SENDER_CONTACT||''; defaultSender.mobile = c.SF_SENDER_MOBILE||''
  defaultSender.province = c.SF_SENDER_PROVINCE||''; defaultSender.city = c.SF_SENDER_CITY||''
  defaultSender.district = c.SF_SENDER_DISTRICT||''; defaultSender.address = c.SF_SENDER_ADDRESS||''
  restoreDefaultSender()
}
function restoreDefaultSender() {
  form.senderName = defaultSender.name; form.senderMobile = defaultSender.mobile
  form.senderProvince = defaultSender.province; form.senderCity = defaultSender.city
  form.senderDistrict = defaultSender.district; form.senderAddress = defaultSender.address
  form.saveSenderAsDefault = false
}
function stripContactLabels(text) {
  return String(text || '')
    .replace(/(收货人|收件人|联系人|姓名|电话|手机|手机号|收货地址|详细地址|地址)\s*[:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function parseChinaAddress(text) {
  let rest = String(text || '').replace(/\s+/g, '').trim()
  const source = rest
  const result = { province: '', city: '', district: '', address: '' }
  if (!rest) return result

  for (const [full, short] of provinceAliases) {
    if (rest.startsWith(full)) {
      result.province = full
      rest = rest.slice(full.length)
      break
    }
    if (rest.startsWith(short)) {
      result.province = full
      rest = rest.slice(short.length)
      break
    }
  }

  if (['北京市', '天津市', '上海市', '重庆市'].includes(result.province)) {
    result.city = result.province
  } else {
    const cityMatch = rest.match(/^([\u4e00-\u9fa5]{2,12}?(?:市|州|盟|地区))/)
    if (cityMatch) {
      result.city = cityMatch[1]
      rest = rest.slice(cityMatch[1].length)
    } else {
      const cityKey = Object.keys(cityAliases).find((key) => rest.startsWith(key))
      if (cityKey) {
        result.city = cityAliases[cityKey]
        rest = rest.slice(cityKey.length)
      }
    }
  }

  const districtMatch = rest.match(/^([\u4e00-\u9fa5]{1,12}?(?:区|县|市|旗|镇|乡))/)
  if (districtMatch) {
    result.district = districtMatch[1]
    rest = rest.slice(districtMatch[1].length)
  }
  result.address = rest
  if (!result.province && !result.city && !result.district) result.address = source
  return result
}
function parseRecipientInfo(text) {
  const raw = String(text || '').trim()
  if (!raw) return {}
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const compact = raw.replace(/[，,]/g, ' ').replace(/\s+/g, ' ').trim()
  const looksLikeAddress = (value) => /(省|市|区|县|镇|乡|街道|路|号|栋|单元)/.test(String(value || ''))
  const phoneMatch = compact.match(/(?:\+?86[-\s]?)?(1[3-9]\d{9})/) || compact.match(/\b(\d{7,14})\b/)
  const phone = phoneMatch?.[1] || ''
  const nameFromLabel = raw.match(/(?:收货人|收件人|联系人|姓名)\s*[:：]\s*([^\s，,;；\n]{2,20})/)
  const addressFromLabel = raw.match(/(?:收货地址|详细地址|地址)\s*[:：]\s*([^\n]+)/)

  let name = nameFromLabel?.[1] || ''
  if (!name && phone) {
    const beforePhone = compact.slice(0, compact.indexOf(phone)).trim()
    const tokens = stripContactLabels(beforePhone).split(/\s+/).filter(Boolean)
    name = tokens[tokens.length - 1] || ''
  }
  if (!name) {
    const firstLine = stripContactLabels(lines[0] || '')
    name = firstLine.split(/\s+/).find((item) => !/\d/.test(item) && item.length <= 20 && !looksLikeAddress(item)) || ''
  }

  let addressText = addressFromLabel?.[1] || ''
  if (!addressText && phone) {
    addressText = compact.slice(compact.indexOf(phone) + phone.length).trim()
  }
  if (!addressText) {
    addressText = lines.find((line) => /(省|市|区|县|镇|街道|路|号|栋|单元)/.test(line)) || compact
  }
  addressText = stripContactLabels(addressText)
    .replace(phone, '')
    .trim()
  if (name && !looksLikeAddress(name)) addressText = addressText.replace(name, '').trim()

  return {
    name,
    phone,
    ...parseChinaAddress(addressText),
  }
}
function parseRecipientPaste() {
  const parsed = parseRecipientInfo(recipientPaste.value)
  if (parsed.name) form.receiverName = parsed.name
  if (parsed.phone) form.receiverMobile = parsed.phone
  if (parsed.province) form.receiverProvince = parsed.province
  if (parsed.city) form.receiverCity = parsed.city
  if (parsed.district) form.receiverDistrict = parsed.district
  if (parsed.address) form.receiverAddress = parsed.address
  const fields = [
    parsed.name && '姓名',
    parsed.phone && '电话',
    parsed.province && '省份',
    parsed.city && '城市',
    parsed.district && '区县',
    parsed.address && '地址',
  ].filter(Boolean)
  notify(fields.length ? 'success' : 'warning', fields.length ? `识别成功：${fields.join('、')}` : '未识别到有效信息')
}
function clearReceiver() { recipientPaste.value = ''; form.receiverProvince=''; form.receiverCity=''; form.receiverDistrict=''; form.receiverAddress='' }
function resetCreateFormAfterSubmit() {
  restoreDefaultSender()
  form.id = null
  form.productCode = 'sf_standard'
  form.receiverName = ''
  form.receiverMobile = ''
  form.receiverProvince = DP
  form.receiverCity = DC
  form.receiverDistrict = DD
  form.receiverAddress = ''
  form.cargoName = '租赁设备'
  form.weightKg = 1
  form.plannedSendAt = ''
  recipientPaste.value = `${DP}${DC}${DD}`
  currentShipment.value = null
  deliveryEstimate.value = null
  quoteResult.value = null
  quoteChecked.value = false
  confirmedAvailable.value = new Set(['sf_standard'])
  confirmedUnavailable.value = new Set()
  senderEditing.value = false
  step.value = 'address'
}

function payload() {
  return {
    id: form.id || undefined, productCode: form.productCode,
    senderName: form.senderName.trim(), senderMobile: form.senderMobile.trim(),
    senderProvince: form.senderProvince.trim(), senderCity: form.senderCity.trim(),
    senderDistrict: form.senderDistrict.trim(), senderAddress: form.senderAddress.trim(),
    saveSenderAsDefault: form.saveSenderAsDefault,
    receiverName: form.receiverName.trim(), receiverMobile: form.receiverMobile.trim(),
    receiverProvince: form.receiverProvince.trim(), receiverCity: form.receiverCity.trim(),
    receiverDistrict: form.receiverDistrict.trim(), receiverAddress: form.receiverAddress.trim(),
    cargoName: form.cargoName.trim()||'租赁设备', weightKg: form.weightKg||1,
    plannedSendAt: form.plannedSendAt || undefined,
  }
}
function quotePayloadReady() { return !isIntraCity.value && addrFilled.value && form.plannedSendAt && validatePlannedSendAt() }

// ── API ──
let quoteRecursionGuard = false
async function quoteExpressNow() {
  if (quoteRecursionGuard) return null // 防止自动切换时的递归
  if (!quotePayloadReady()) return null
  if (svcAvailable(form.productCode) === false) return null
  quoteLoading.value = true
  try {
    const r = await sfApi.quoteExpress(payload())
    quoteChecked.value = true
    if (r.ok && r.matchedProduct) {
      confirmedAvailable.value.add(form.productCode)
      confirmedUnavailable.value.delete(form.productCode)
      quoteResult.value = r
    } else if (r.ok && !r.matchedProduct) {
      confirmedUnavailable.value.add(form.productCode)
      quoteResult.value = null
      if (form.productCode !== 'sf_standard') {
        form.productCode = 'sf_standard'
        notify('warning', serviceUnavailableHint.value || '该产品路线不支持，已自动切换为顺丰标快')
        quoteRecursionGuard = true
        await quoteExpressNow()
        quoteRecursionGuard = false
      }
    } else {
      quoteResult.value = null
      notify('error', r.message || '查询失败')
    }
    return r
  }
  catch (e) {
    quoteResult.value = null
    if (form.productCode !== 'sf_standard') {
      confirmedUnavailable.value.add(form.productCode)
      form.productCode = 'sf_standard'
      notify('warning', '查询失败，已自动切换为顺丰标快')
      quoteRecursionGuard = true
      await quoteExpressNow()
      quoteRecursionGuard = false
    }
    return null
  }
  finally { quoteLoading.value = false }
}
const {
  saveDraft,
  precheck,
  placeOrder,
  loadShipments,
  loadPendingShipmentOrders,
  toggleSelectAllPending,
  placeSelectedOrders,
  openShipment,
  recoverResult,
  cancelShipment,
  refreshRoutes,
  refreshFee,
  saveActualPaid,
} = useSfShipmentActions({
  busy,
  form,
  currentShipment,
  deliveryEstimate,
  shipments,
  pendingOrders,
  batchDrawerOpen,
  batchSelectedIds,
  batchResults,
  batchLoading,
  selectedDetail,
  detailDialogOpen,
  actualPaidForm,
  filters,
  isIntraCity,
  quoteResult,
  monthlyCardConfigured,
  pendingSelectableOrders,
  allPendingSelected,
  confirmDialog,
  payload,
  notify,
  productLabel,
  senderAddrText,
  receiverAddrText,
  feeLabel,
  statusLabel,
  canPlaceOrder,
  localDateText,
  resetCreateFormAfterSubmit,
})

function closeShipmentDetail() { detailDialogOpen.value = false }
function fillQueryTrackingNo() { const s=shipments.value.find(x=>String(x.id)===String(query.shipmentId)); if(s?.tracking_no)query.trackingNo=s.tracking_no; if(s?.receiver_mobile)query.verifyMobile=s.receiver_mobile }
async function queryPromise() { busy.value=true; try { const r=await sfApi.queryPromiseTime({shipmentId:query.shipmentId||undefined,trackingNo:query.trackingNo.trim(),verifyMobile:query.verifyMobile.trim()}); if(!r.ok){promiseResult.value=null;notify('error',r.message)}else{promiseResult.value=r;notify('success','查询完成')}; await loadShipments() } catch(e) { notify('error', getErrorMessage(e, '查询失败')) } finally { busy.value=false } }
async function queryRoutes() { busy.value=true; try { const r=await sfApi.queryRoutes({shipmentId:query.shipmentId||undefined,trackingNo:query.trackingNo.trim(),verifyMobile:query.verifyMobile.trim()}); if(!r.ok)notify('error',r.message); else{promiseResult.value={...(promiseResult.value||{}),...r};notify('success','轨迹查询完成')}; await loadShipments() } catch(e) { notify('error', getErrorMessage(e, '轨迹查询失败')) } finally { busy.value=false } }
async function queryFee() { busy.value=true; try { const r=await sfApi.queryFee({shipmentId:query.shipmentId||undefined,trackingNo:query.trackingNo.trim(),verifyMobile:query.verifyMobile.trim()}); if(!r.ok)notify('error',r.message); else{promiseResult.value={...(promiseResult.value||{}),...r};notify('success','运费查询完成')}; await loadShipments() } catch(e) { notify('error', getErrorMessage(e, '运费查询失败')) } finally { busy.value=false } }

function refreshAll() { loadShipments(); if (tab.value==='create') loadPendingShipmentOrders() }

onMounted(async () => {
  try { intracityConfig.value = await configApi.get(); applyDefaultSender(intracityConfig.value); configLoaded.value = true; await Promise.all([loadShipments(),loadPendingShipmentOrders()]) }
  catch (e) { notify('error',`加载失败：${getErrorMessage(e)}`) }
})
</script>

<style scoped>
/* ── Page shell ── */
.sf-page { max-width: 100%; }
.sf-tabs { display: flex; gap: 4px; margin-bottom: var(--space-4); padding: 4px; background: var(--bg-panel-muted); border-radius: var(--radius-md); width: fit-content; }
.sf-tabs button { display: flex; align-items: center; gap: 6px; padding: 9px 18px; border: none; background: transparent; border-radius: var(--radius-sm); font-size: 14px; color: var(--text-secondary); cursor: pointer; transition: all .15s; }
.sf-tabs button.active { background: var(--bg-panel); color: var(--text-strong); font-weight: 600; box-shadow: var(--shadow-sm); }
.tab-icon { font-size: 15px; }

/* ── Tracking ── */
.track-form { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3); }
.track-btns { display: flex; gap: var(--space-2); grid-column: 1 / -1; }
.kpi-2 { grid-template-columns: repeat(2, 1fr); }
.kpi-3 { grid-template-columns: repeat(2, 1fr); }
.kpi-4 { grid-template-columns: repeat(4, 1fr); }

/* ── Shared elements ── */
.minor-text { font-size: 13px; color: var(--text-muted); }
.empty-text { text-align: center; padding: 40px; color: var(--text-faint); font-size: 14px; }
.text-primary { color: var(--text-primary); }
.text-lg { font-size: 18px; font-weight: 700; }
.ml-2 { margin-left: var(--space-2); }

.w-10 { width: 40px; }

/* route timeline */
.route-timeline { display: grid; gap: 6px; }
.route-timeline > div { display: grid; grid-template-columns: 140px 1fr; gap: var(--space-3); padding: 10px 12px; border-left: 3px solid var(--bg-primary); background: var(--bg-panel-muted); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-size: 13px; }
.route-timeline b { color: var(--text-secondary); }
.route-timeline span { color: var(--text-main); }

/* banner system */
.banner { padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: var(--space-4); font-size: 14px; }
.banner-success { background: var(--bg-success-soft); border: 1px solid #86efac; color: var(--text-success); }
.banner-error { background: var(--bg-danger-soft); border: 1px solid #fecaca; color: var(--text-danger); }
.banner-warning { background: var(--bg-warning-soft); border: 1px solid #fde68a; color: var(--text-warning); }
.banner a { color: inherit; font-weight: 600; }

/* btn extensions */
.btn-ghost { background: transparent; border: 1px solid transparent; color: var(--text-secondary); }
.btn-ghost:hover { background: var(--bg-panel-muted); }
.btn-danger { background: #dc2626; color: #fff; border-color: #dc2626; }
.btn-danger:hover:not(:disabled) { background: #b91c1c; }
.btn-lg { min-height: 44px; padding: 0 22px; font-size: 15px; font-weight: 600; }

/* ── 双栏工作区 ── */
.sf-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) 300px;
  gap: 14px;
  align-items: start;
}
/* responsive */
@media (max-width: 820px) {
  .sf-workbench {
    grid-template-columns: 1fr;
  }
  .track-form { grid-template-columns: 1fr; }
  .sf-tabs { width: 100%; }
  .sf-tabs button { flex: 1; justify-content: center; }
  .kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
}
</style>
