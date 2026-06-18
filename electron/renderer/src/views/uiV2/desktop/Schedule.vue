<template>
  <UiV2Page title="档期中心" description="未来 7 天设备 × 日期压缩档期视图，展示可租、占用、冲突和维修状态。">
    <template #actions>
      <BaseButton variant="secondary">导出档期</BaseButton>
      <BaseButton @click="previewScheduleBlock('new-block')">新建占用预览</BaseButton>
    </template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="sourceMeta.fallbackReason" class="adapter-source__reason">{{ sourceMeta.fallbackReason }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section v-if="schedulePreview.view" class="final-drawer-card ui-v2-detail-grid" data-testid="schedule-safeops-preview">
      <div><span>操作预览</span><strong>dry-run only</strong></div>
      <div><span>开放状态</span><strong>暂未开放</strong></div>
      <div><span>writeWillExecute</span><strong>{{ schedulePreview.view.writeWillExecute }}</strong></div>
      <div><span>externalCallWillExecute</span><strong>{{ schedulePreview.view.externalCallWillExecute }}</strong></div>
      <div><span>audit</span><strong>{{ schedulePreview.view.auditLabel }}</strong></div>
      <div><span>说明</span><strong>不会写入 / 不会调用外部服务</strong></div>
    </section>

    <section class="summary-grid">
      <MetricCard v-for="metric in modelMetrics" :key="metric.key" :metric="metric" />
    </section>

    <div class="final-tabs">
      <button
        v-for="item in scheduleTabs"
        :key="item"
        type="button"
        class="final-tab"
        :class="{ 'is-active': status === item }"
        @click="status = item"
      >
        {{ item }}
      </button>
    </div>

    <FilterBar title="档期筛选" hint="按最终图保留日期、型号、门店和状态筛选">
      <div class="filter-row">
        <BaseInput model-value="2025-06-14 ~ 2025-06-20" label="日期范围" readonly />
        <BaseInput v-model="keyword" search clearable placeholder="搜索资产编号 / 型号" />
        <BaseSelect v-model="model" label="型号" :options="['全部型号', ...options.deviceModels]" />
        <BaseSelect model-value="深圳南山店" label="门店" :options="['深圳南山店']" />
      </div>
    </FilterBar>

    <section class="schedule-layout">
      <div class="final-main-stack">
        <div class="legend-row">
          <span><i class="ok"></i>充足（>30%）</span>
          <span><i class="mid"></i>紧张（5%-30%）</span>
          <span><i class="low"></i>不足（<5%）</span>
          <span><i class="full"></i>满租</span>
          <span><i class="off"></i>不可用</span>
        </div>
        <section class="schedule-board">
          <div v-if="loading" class="adapter-state">档期只读数据读取中...</div>
          <div class="date-head">
            <span>型号 / 规格</span>
            <strong v-for="date in sevenDates" :key="date">{{ date.slice(5) }}</strong>
          </div>
          <div v-for="group in groupedDevices" :key="group.model" class="model-group">
            <div v-for="device in group.devices" :key="device.id" class="schedule-row">
              <div class="device-cell">
                <strong>{{ device.model }}</strong>
                <span>{{ device.assetNo }} · 库存 {{ group.devices.length }}</span>
              </div>
              <button
                v-for="date in sevenDates"
                :key="date"
                :class="['slot-cell', `slot-${slotFor(device.id, date)?.status}`]"
                type="button"
                @click="openSlot(slotFor(device.id, date))"
              >
                <strong>{{ slotFor(device.id, date)?.status === '可租' ? availabilityNumber(device.id, date) : slotFor(device.id, date)?.label }}</strong>
                <small>{{ slotPercent(device.id, date) }}</small>
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside class="final-panel schedule-side">
        <div class="final-panel__head">
          <div>
            <h2>{{ selectedSlot?.model || '大疆 Pocket 3' }}</h2>
            <p>{{ selectedSlot?.assetNo || '请选择左侧档期' }}</p>
          </div>
          <StatusBadge :label="selectedSlot?.status || '可安排'" size="sm" />
        </div>
        <div class="final-panel__body final-info-list">
          <div class="final-soft-grid">
            <div class="final-mini-card"><span>总库存</span><strong>32</strong><small>台</small></div>
            <div class="final-mini-card"><span>本周可安排</span><strong>70</strong><small>台次</small></div>
            <div class="final-mini-card"><span>本周已预订</span><strong>122</strong><small>台次</small></div>
            <div class="final-mini-card"><span>本周满租率</span><strong>78.6%</strong><small>较上周 +4.3%</small></div>
          </div>
          <div class="final-drawer-card final-info-list">
            <div class="final-info-row"><span>日期</span><strong>{{ selectedSlot?.date || '2025-06-14' }}</strong></div>
            <div class="final-info-row"><span>状态</span><strong>{{ selectedSlot?.status || '可租' }}</strong></div>
            <div class="final-info-row"><span>关联订单</span><strong>{{ selectedSlot?.orderId || '无' }}</strong></div>
            <div class="final-info-row"><span>建议动作</span><strong>{{ actionHint }}</strong></div>
          </div>
          <div class="final-action-row">
            <BaseButton variant="secondary" size="sm" @click="previewScheduleBlock('batch-lock')">批量锁库预览</BaseButton>
            <BaseButton size="sm">查看设备详情</BaseButton>
          </div>
          <p class="safeops-note">dry-run only；暂未开放；不会写入；不会调用外部服务。</p>
        </div>
      </aside>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { MetricCard } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import { createSafeOpsPreviewState, runSafeOpsPreview } from '../../../adapters/uiV2/safeOpsPreviewHelpers.js'
import UiV2Page from '../shared/UiV2Page.vue'
import '../shared/uiV2View.css'

const devices = ref([])
const schedule = ref([])
const sevenDates = ref([])
const options = ref({ deviceModels: [] })
const keyword = ref('')
const model = ref('全部型号')
const status = ref('全部型号')
const selectedSlot = ref(null)
const loading = ref(false)
const loadError = ref('')
const schedulePreview = ref(createSafeOpsPreviewState())
const sourceMeta = ref(uiV2Adapter.getMeta())
const scheduleTabs = ['全部型号', '可安排', '满租', '余量不足', '即将归还']

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})

const modelMetrics = computed(() => options.value.deviceModels.slice(0, 5).map((item) => {
  const total = devices.value.filter((device) => device.model === item).length
  const free = schedule.value.filter((slot) => slot.model === item && slot.date === sevenDates.value[0] && slot.status === '可租').length
  return { key: item, label: item, value: `${free}/${total}`, unit: '可租', trend: '今日余量', tone: free < 2 ? 'warning' : 'success' }
}))

const filteredDevices = computed(() => devices.value.filter((device) => {
  const matchModel = model.value === '全部型号' || device.model === model.value
  const matchKeyword = !keyword.value || `${device.assetNo}${device.model}`.includes(keyword.value)
  const matchStatus = status.value === '全部状态' || status.value === '全部型号' || sevenDates.value.some((date) => {
    const slotStatus = slotFor(device.id, date)?.status
    return status.value === '可安排' ? slotStatus === '可租'
      : status.value === '满租' ? slotStatus === '占用'
      : status.value === '余量不足' ? slotStatus === '冲突'
      : status.value === '即将归还' ? slotStatus === '占用'
      : slotStatus === status.value
  })
  return matchModel && matchKeyword && matchStatus
}))

const groupedDevices = computed(() => options.value.deviceModels.map((item) => ({
  model: item,
  devices: filteredDevices.value.filter((device) => device.model === item).slice(0, 6),
})).filter((group) => group.devices.length))

const actionHint = computed(() => {
  if (!selectedSlot.value) return ''
  if (selectedSlot.value.status === '可租') return '可以直接分配给待分配设备订单。'
  if (selectedSlot.value.status === '冲突') return selectedSlot.value.conflictType || '建议换同型号其他设备。'
  if (selectedSlot.value.status === '维修') return '维修或异常设备暂不可分配。'
  return '查看关联订单，确认归还和发货时间。'
})

function slotFor(deviceId, date) {
  return schedule.value.find((item) => item.deviceId === deviceId && item.date === date)
}

function openSlot(slot) {
  if (!slot) return
  selectedSlot.value = slot
}

async function previewScheduleBlock(reason) {
  schedulePreview.value = { ...schedulePreview.value, loading: true, error: '' }
  schedulePreview.value = await runSafeOpsPreview('schedule.block.preview', {
    target: {
      deviceId: selectedSlot.value?.deviceId || '',
      assetNo: selectedSlot.value?.assetNo || '',
      date: selectedSlot.value?.date || '',
    },
    payload: {
      reason,
      source: 'schedule-page',
    },
  })
}

function availabilityNumber(deviceId, date) {
  const index = schedule.value.findIndex((item) => item.deviceId === deviceId && item.date === date)
  return Math.max(2, 26 - (index % 19))
}

function slotPercent(deviceId, date) {
  const slot = slotFor(deviceId, date)
  if (!slot) return ''
  if (slot.status === '可租') return `${Math.max(7, 82 - (availabilityNumber(deviceId, date) % 61))}%`
  if (slot.status === '占用') return '已预订'
  if (slot.status === '冲突') return '余量不足'
  return '不可用'
}

function buildDevicesFromSchedule(slots = []) {
  const rows = new Map()
  for (const slot of slots) {
    if (!slot?.deviceId || rows.has(slot.deviceId)) continue
    rows.set(slot.deviceId, {
      id: slot.deviceId,
      assetNo: slot.assetNo || slot.deviceId,
      model: slot.model || '未填写型号',
    })
  }
  return Array.from(rows.values())
}

async function loadSchedule() {
  loading.value = true
  loadError.value = ''
  try {
    const nextSchedule = await uiV2Adapter.getSchedule()
    schedule.value = Array.isArray(nextSchedule) ? nextSchedule : []
    const nextDates = await uiV2Adapter.getScheduleDates()
    sevenDates.value = (Array.isArray(nextDates) ? nextDates : []).slice(0, 7)
    devices.value = buildDevicesFromSchedule(schedule.value)
    const nextOptions = await uiV2Adapter.getOptions()
    const models = Array.from(new Set(devices.value.map((device) => device.model).filter(Boolean)))
    options.value = { deviceModels: [], ...nextOptions, deviceModels: models.length ? models : nextOptions?.deviceModels || [] }
    selectedSlot.value = schedule.value[0] || null
    sourceMeta.value = uiV2Adapter.getLastMeta('getSchedule')
  } catch (error) {
    schedule.value = []
    devices.value = []
    sevenDates.value = []
    selectedSlot.value = null
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '档期只读数据读取失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadSchedule)
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-12);
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
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-pill);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 760;
}

.adapter-source.is-real {
  border-color: var(--brand-primary-border);
  background: rgba(232, 247, 243, 0.86);
  color: var(--color-primary);
}

.adapter-source.is-mock-fallback,
.adapter-source__reason {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 251, 235, 0.9);
  color: #92400e;
}

.adapter-source__error {
  border-color: rgba(239, 68, 68, 0.24);
  background: rgba(254, 242, 242, 0.9);
  color: #b42318;
}

.adapter-state {
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
  background: #f8fbfa;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 760;
}

.filter-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr repeat(2, minmax(160px, 0.7fr));
  gap: var(--space-12);
  align-items: end;
}

.schedule-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 14px;
  align-items: start;
}

.legend-row {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fff;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.legend-row i {
  width: 10px;
  height: 10px;
  display: inline-flex;
  margin-right: 6px;
  border-radius: 3px;
  vertical-align: -1px;
}

.legend-row .ok { background: #10b981; }
.legend-row .mid { background: #34d399; }
.legend-row .low { background: #f59e0b; }
.legend-row .full { background: #ef4444; }
.legend-row .off { background: #cbd5e1; }

.schedule-board {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-16);
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
}

.date-head,
.schedule-row {
  display: grid;
  grid-template-columns: minmax(210px, 1.2fr) repeat(7, minmax(88px, 1fr));
  gap: 1px;
  min-width: 900px;
  background: rgba(229, 235, 232, 0.92);
}

.date-head span,
.date-head strong,
.device-cell,
.slot-cell {
  background: var(--color-surface);
}

.date-head span,
.date-head strong {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 11px 12px;
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
  background: #f8fbfa;
}

.device-cell {
  display: grid;
  gap: 2px;
  padding: var(--space-12);
  background: #fff;
}

.device-cell span,
.slot-cell small {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-cell {
  min-height: 62px;
  display: grid;
  align-content: center;
  gap: 2px;
  padding: 8px;
  border: 1px solid transparent;
  text-align: center;
  transition: transform var(--duration-fast) var(--ease-standard),
              border-color var(--duration-fast) var(--ease-standard),
              box-shadow var(--duration-fast) var(--ease-standard);
}

.slot-cell:hover {
  border-color: rgba(0, 127, 109, 0.26);
  box-shadow: inset 0 0 0 1px rgba(0, 127, 109, 0.08);
  transform: translateY(-1px);
}

.slot-cell strong {
  font-size: 12px;
}

.slot-可租 { color: #0f7a4e; background: #eaf8f1; }
.slot-占用 { color: #b45309; background: #fff4df; }
.slot-冲突 { color: #be123c; background: #fff1f2; }
.slot-维修 { color: #667085; background: #f1f5f9; }

.schedule-side {
  position: sticky;
  top: 76px;
}

.safeops-note {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 680;
}

@media (max-width: 1280px) {
  .schedule-layout {
    grid-template-columns: 1fr;
  }
}
</style>
