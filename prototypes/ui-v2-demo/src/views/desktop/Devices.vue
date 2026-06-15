<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">设备中心</h1>
          <p class="page-desc">租赁资产台账：位置、订单、预约、收益和维护状态集中管理。</p>
        </div>
        <BaseButton variant="secondary">导入设备台账</BaseButton>
      </header>

      <section class="asset-health">
        <div>
          <BaseBadge :label="`方案 ${variantMeta.label} · ${variantMeta.shortName}`" tone="info" />
          <h2>{{ deviceHeadline }}</h2>
          <p>{{ deviceCopy }}</p>
        </div>
        <div class="health-meter">
          <span :style="{ width: `${healthyRate}%` }" />
        </div>
      </section>

      <section class="asset-lanes">
        <article v-for="item in assetLanes" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.note }}</small>
        </article>
      </section>

      <section class="metric-grid asset-metrics">
        <MetricCard v-for="metric in deviceMetrics" :key="metric.key" :metric="metric" />
      </section>

      <section class="panel">
        <div class="panel-body device-toolbar">
          <div class="toolbar">
            <FilterChip v-for="item in statusChips" :key="item" :label="item" :active="status === item" @click="status = item" />
          </div>
          <BaseInput v-model="keyword" placeholder="搜索设备编号、型号、序列号" />
        </div>
      </section>

      <section class="device-grid asset-ledger">
        <DeviceCard v-for="device in filteredDevices" :key="device.id" :device="device" @click="selectedDevice = device" />
      </section>
    </div>

    <Drawer
      :open="Boolean(selectedDevice)"
      :title="selectedDevice?.assetNo || '设备详情'"
      :description="selectedDevice?.model || ''"
      @close="selectedDevice = null"
    >
      <div v-if="selectedDevice" class="drawer-stack">
        <section class="detail-hero">
          <div>
            <BaseBadge :label="selectedDevice.status" />
            <h3>{{ selectedDevice.model }}</h3>
            <p>{{ selectedDevice.location }} · 序列号 {{ selectedDevice.serialNo }}</p>
          </div>
          <BaseButton variant="secondary">标记清洁完成</BaseButton>
        </section>
        <section class="detail-grid">
          <div><span>当前订单</span><strong>{{ selectedDevice.currentOrderId || '无' }}</strong></div>
          <div><span>下一预约</span><strong>{{ selectedDevice.nextBookingDate }}</strong></div>
          <div><span>维护状态</span><strong>{{ selectedDevice.maintenanceStatus }}</strong></div>
          <div><span>利用率</span><strong>{{ selectedDevice.utilization }}%</strong></div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h3 class="section-title">操作建议</h3>
            <BaseBadge :label="selectedDevice.status" />
          </div>
          <div class="panel-body action-note">
            {{ deviceAction }}
          </div>
        </section>
        <section v-if="selectedDevice.conditionNote" class="panel">
          <div class="panel-body danger-note">{{ selectedDevice.conditionNote }}</div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h3 class="section-title">近 7 天档期</h3>
          </div>
          <div class="panel-body mini-slots">
            <span v-for="slot in deviceSlots" :key="slot.id" :class="slot.status">{{ slot.date.slice(5) }} {{ slot.label }}</span>
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h3 class="section-title">维护记录</h3>
          </div>
          <div class="panel-body maintenance-list">
            <p>06/13 外观复检 · {{ selectedDevice.maintenanceStatus }}</p>
            <p>06/10 配件核对 · 电池、充电线、收纳包齐全</p>
            <p>06/08 入库清洁 · 已完成</p>
          </div>
        </section>
      </div>
    </Drawer>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseBadge from '../../components/BaseBadge.vue'
import BaseInput from '../../components/BaseInput.vue'
import FilterChip from '../../components/FilterChip.vue'
import MetricCard from '../../components/MetricCard.vue'
import DeviceCard from '../../components/DeviceCard.vue'
import Drawer from '../../components/Drawer.vue'
import { devices, deviceStatuses } from '../../mock/devices.js'
import { schedule, scheduleDates } from '../../mock/schedule.js'
import { useExperienceVariant } from '../../composables/useExperienceVariant.js'

const { variant, variantMeta } = useExperienceVariant()
const statusChips = ['全部', ...deviceStatuses]
const status = ref('全部')
const keyword = ref('')
const selectedDevice = ref(null)

const healthyCount = computed(() => devices.filter((item) => ['可租', '已预订', '在租'].includes(item.status)).length)
const healthyRate = computed(() => Math.round((healthyCount.value / devices.length) * 100))

const deviceMetrics = computed(() => [
  { key: 'all', label: '设备总数', value: devices.length, unit: '台', trend: '含配件套装', tone: 'info' },
  { key: 'free', label: '可租', value: devices.filter((item) => item.status === '可租').length, unit: '台', trend: '可立即分配', tone: 'success' },
  { key: 'rented', label: '在租', value: devices.filter((item) => item.status === '在租').length, unit: '台', trend: '租期中', tone: 'info' },
  { key: 'clean', label: '待清洁', value: devices.filter((item) => item.status === '待清洁').length, unit: '台', trend: '归还后处理', tone: 'warning' },
  { key: 'repair', label: '维修中', value: devices.filter((item) => item.status === '维修中').length, unit: '台', trend: '不可分配', tone: 'warning' },
  { key: 'abnormal', label: '异常', value: devices.filter((item) => item.status === '异常').length, unit: '台', trend: '需跟进', tone: 'danger' }
])

const deviceHeadline = computed(() => variant.value === 'c'
  ? `36 台设备里，先把 ${devices.filter((item) => item.status === '待清洁').length} 台待清洁推回可租池`
  : `36 台设备中，${healthyCount.value} 台可立即流转`
)

const deviceCopy = computed(() => variant.value === 'c'
  ? '门店视角更强调下一步动作：清洁、复检、联系客户、准备发货。'
  : '维修和异常设备已从可分配队列中隔离，避免档期误分配。'
)

const assetLanes = computed(() => variant.value === 'c'
  ? [
      { label: '待清洁回池', value: devices.filter((item) => item.status === '待清洁').length, note: '清洁完成即可接单' },
      { label: '今天在租', value: devices.filter((item) => item.status === '在租').length, note: '盯归还提醒' },
      { label: '异常插队', value: devices.filter((item) => item.status === '异常').length, note: '先复检再上架' },
      { label: '下一批发货', value: devices.filter((item) => item.status === '已预订').length, note: '准备配件套装' }
    ]
  : [
      { label: '资产池', value: devices.length, note: '统一编号和位置' },
      { label: '可分配池', value: devices.filter((item) => item.status === '可租').length, note: '可立即接单' },
      { label: '占用池', value: devices.filter((item) => item.status === '在租').length, note: '关联当前订单' },
      { label: '隔离池', value: devices.filter((item) => ['维修中', '异常', '停用'].includes(item.status)).length, note: '不可误分配' }
    ]
)

const filteredDevices = computed(() => devices.filter((device) => {
  const matchStatus = status.value === '全部' || device.status === status.value
  const text = `${device.assetNo}${device.model}${device.serialNo}`
  return matchStatus && (!keyword.value || text.includes(keyword.value))
}))

const deviceSlots = computed(() => {
  if (!selectedDevice.value) return []
  return schedule.filter((item) => item.deviceId === selectedDevice.value.id && scheduleDates.slice(0, 7).includes(item.date))
})

const deviceAction = computed(() => {
  if (!selectedDevice.value) return ''
  const map = {
    可租: '设备可直接分配给新订单，建议优先匹配今日待分配订单。',
    已预订: '设备已有预约，请核对归还与发货间隔。',
    在租: '设备租赁中，重点关注归还时间和客户提醒。',
    待清洁: '归还后待清洁，完成清洁后可重新进入可租池。',
    维修中: '维修中设备不可分配，需等待维护完成。',
    异常: '异常设备需先处理赔付或复检，暂不建议分配。',
    停用: '停用设备不进入履约分配。'
  }
  return map[selectedDevice.value.status] || '查看设备状态。'
})
</script>

<style scoped>
.asset-health {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 30%),
    linear-gradient(90deg, color-mix(in srgb, var(--brand-soft) 72%, transparent), color-mix(in srgb, var(--surface) 96%, transparent) 48%),
    var(--surface);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: center;
}

.asset-health h2 {
  margin: 10px 0 4px;
  font-size: 24px;
}

.asset-health p {
  margin: 0;
  color: var(--text-soft);
}

.asset-lanes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.asset-lanes article {
  min-height: 92px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  display: grid;
  align-content: space-between;
  position: relative;
  overflow: hidden;
}

.asset-lanes article::after {
  content: "";
  position: absolute;
  right: -22px;
  bottom: -36px;
  width: 86px;
  height: 86px;
  border: 1px solid color-mix(in srgb, var(--brand) 18%, transparent);
  border-radius: 999px;
}

.asset-lanes span,
.asset-lanes small {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.asset-lanes strong {
  margin-top: 5px;
  font-size: 25px;
  line-height: 1;
}

.health-meter {
  height: 12px;
  border-radius: 999px;
  background: rgba(20, 28, 28, 0.08);
  overflow: hidden;
}

.health-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--brand);
}

.device-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.drawer-stack {
  display: grid;
  gap: 12px;
}

.detail-hero {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.detail-hero h3 {
  margin: 10px 0 4px;
}

.detail-hero p {
  margin: 0;
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.detail-grid div {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.detail-grid span {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
}

.detail-grid strong {
  display: block;
  margin-top: 4px;
}

.danger-note {
  color: var(--danger);
  background: var(--danger-soft);
}

.action-note {
  color: var(--text-soft);
  background: rgba(247, 248, 245, 0.72);
}

.mini-slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mini-slots span {
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 720;
}

.mini-slots .可租 { background: var(--success-soft); color: var(--success); }
.mini-slots .占用 { background: var(--info-soft); color: var(--info); }
.mini-slots .冲突 { background: var(--danger-soft); color: var(--danger); }
.mini-slots .维修 { background: var(--warning-soft); color: var(--warning); }

.maintenance-list {
  display: grid;
  gap: 0;
}

.maintenance-list p {
  margin: 0;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-soft);
}

.maintenance-list p:last-child {
  border-bottom: 0;
}

:global([data-experience="c"]) .asset-health,
:global([data-experience="c"]) .asset-lanes article {
  border-radius: 18px;
}

:global([data-experience="c"]) .asset-lanes article:nth-child(even) {
  transform: translateY(6px);
}
</style>
