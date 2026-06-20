<template>
  <UiV2Page title="报表中心" description="基础经营统计只读聚合，不包含利润、税务和对账。">
    <template #actions><BaseButton variant="secondary">导出报表</BaseButton></template>

    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>

    <section class="ui-v2-metric-grid"><MetricCard v-for="metric in report.kpis" :key="metric.key" :metric="metric" /></section>

    <div v-if="loading" class="adapter-state">报表只读聚合读取中...</div>

    <FilterBar title="报表筛选" hint="基础只读聚合，字段缺失时自动降级">
      <div class="report-filter-row">
        <BaseSelect v-model="reportStore" label="门店" :options="storeOptions" />
        <BaseSelect v-model="reportRange" label="时间范围" :options="rangeOptions" />
        <BaseSelect v-model="reportChannel" label="渠道" :options="channelOptions" />
        <BaseSelect v-model="reportDeviceType" label="设备类型" :options="deviceTypeOptions" />
        <BaseButton variant="secondary" @click="resetFilters">重置</BaseButton>
      </div>
    </FilterBar>

    <section class="reports-layout">
      <ChartCard class="reports-trend" title="订单金额趋势" subtitle="近 7 日基础金额（元）" :value="reportAmountLabel" note="只读汇总" :data="report.revenueTrend" variant="trend" />
      <div class="final-panel">
        <div class="final-panel__head"><div><h2>订单来源占比</h2><p>按渠道统计订单量</p></div></div>
        <div class="final-panel__body channel-card">
          <div class="donut">{{ orderTotalLabel }}<span>订单总量</span></div>
          <div class="channel-list">
            <div v-for="item in report.channelTrend" :key="item.label">
              <i></i>
              <span>{{ item.label }}</span>
              <strong>{{ item.valueLabel }}</strong>
            </div>
          </div>
        </div>
      </div>
      <div class="final-panel">
        <div class="final-panel__head"><div><h2>洞察与建议</h2><p>基于只读指标生成</p></div></div>
        <div class="final-panel__body"><InsightPanel title="建议行动" tag="" :items="report.insights" /></div>
      </div>
      <div class="final-panel">
        <div class="final-panel__head"><div><h2>免押状态分布</h2><p>本地缓存优先，缺失时按订单押金字段降级</p></div></div>
        <div class="final-panel__body duration-card">
          <div class="donut small">{{ depositTotalLabel }}<span>记录数</span></div>
          <div class="channel-list">
            <div v-for="item in depositRows" :key="item.label"><i></i><span>{{ item.label }}</span><strong>{{ item.valueLabel }}</strong></div>
          </div>
        </div>
      </div>
      <UiV2Section title="设备热租 TOP5" hint="租赁业务核心机型表现">
        <DataTable :columns="columns" :rows="report.modelRanking" row-key="rank" compact>
          <template #rank="{ row }"><strong>#{{ row.rank }}</strong></template>
          <template #revenue="{ row }">¥{{ row.revenue }}</template>
        </DataTable>
      </UiV2Section>
      <div class="final-panel">
        <div class="final-panel__head"><div><h2>门店金额排行</h2><p>基础订单金额汇总</p></div></div>
        <div class="final-panel__body store-bars">
          <div v-for="store in storeRows" :key="store.name">
            <span>{{ store.name }}</span>
            <i :style="{ width: `${store.percent}%` }"></i>
            <strong>¥{{ store.value }}</strong>
          </div>
        </div>
      </div>
    </section>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import { ChartCard, InsightPanel, MetricCard } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const emptyReport = {
  kpis: [],
  revenueTrend: [],
  channelTrend: [],
  depositTrend: [],
  durationRows: [],
  storeRanking: [],
  modelRanking: [],
  insights: [],
}

const report = ref(emptyReport)
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const reportStore = ref('深圳南山店')
const reportRange = ref('近 7 天')
const reportChannel = ref('全部渠道')
const reportDeviceType = ref('全部类型')
const storeOptions = ['深圳南山店', '广州天河店', '上海徐汇店']
const rangeOptions = ['今日', '近 7 天', '本月', '下月', '自定义演示范围']
const channelOptions = ['全部渠道', '闲鱼', '小红书', '抖音', '私域']
const deviceTypeOptions = ['全部类型', '相机', '稳定器', '补光灯']

const columns = [
  { key: 'rank', label: '排名' },
  { key: 'model', label: '型号' },
  { key: 'orders', label: '订单' },
  { key: 'revenue', label: '收入' },
  { key: 'utilization', label: '利用率' },
  { key: 'signal', label: '信号' },
]

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})

const reportAmountLabel = computed(() => {
  const metric = report.value.kpis.find((item) => item.key === 'revenue' || item.key === 'orderAmount')
  return metric ? `¥${metric.value}` : '¥0'
})

const orderTotalLabel = computed(() => {
  const total = report.value.channelTrend.reduce((sum, item) => sum + Number(item.value || 0), 0)
  return total.toLocaleString()
})

const depositRows = computed(() => {
  const rows = report.value.depositTrend || []
  return rows.length ? rows : [{ label: '暂无数据', value: 0, valueLabel: '0单' }]
})

const depositTotalLabel = computed(() => depositRows.value.reduce((sum, item) => sum + Number(item.value || 0), 0).toLocaleString())
const storeRows = computed(() => {
  const rows = report.value.storeRanking || []
  return rows.length ? rows : [{ name: '暂无数据', value: '0', percent: 6 }]
})

async function loadReport() {
  loading.value = true
  loadError.value = ''
  try {
    const nextReport = await uiV2Adapter.getReport()
    report.value = { ...emptyReport, ...(nextReport || {}) }
    sourceMeta.value = uiV2Adapter.getLastMeta('getReport')
  } catch (error) {
    report.value = emptyReport
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '报表只读聚合读取失败'
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  reportStore.value = '深圳南山店'
  reportRange.value = '近 7 天'
  reportChannel.value = '全部渠道'
  reportDeviceType.value = '全部类型'
}

onMounted(loadReport)
</script>

<style scoped>
.report-filter-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
  gap: 10px;
  align-items: end;
}

.reports-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(340px, 0.8fr) 320px;
  gap: 14px;
  align-items: start;
}

.reports-trend {
  min-height: 360px;
}

.channel-card,
.duration-card {
  min-height: 256px;
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.donut {
  width: 148px;
  height: 148px;
  display: grid;
  place-items: center;
  align-content: center;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #fff 0 48%, transparent 49%),
    conic-gradient(#00a889 0 42%, #3b82f6 42% 66%, #f59e0b 66% 82%, #34d399 82% 92%, #e5e7eb 92% 100%);
  color: var(--ui-text);
  font-size: 26px;
  font-weight: 850;
}

.donut.small {
  width: 138px;
  height: 138px;
}

.donut span {
  display: block;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.channel-list {
  display: grid;
  gap: 12px;
}

.channel-list div,
.store-bars div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.channel-list i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--ui-brand);
}

.channel-list div:nth-child(2) i { background: #3b82f6; }
.channel-list div:nth-child(3) i { background: #f59e0b; }
.channel-list div:nth-child(4) i { background: #34d399; }
.channel-list strong,
.store-bars strong {
  color: var(--ui-text);
}

.store-bars {
  display: grid;
  gap: 14px;
}

.store-bars div {
  grid-template-columns: 90px minmax(0, 1fr) 86px;
}

.store-bars i {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, #00a889, #7dd3c7);
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
  padding: 10px 12px;
  border: 1px solid var(--ui-border);
  border-radius: var(--radius-12);
  background: var(--ui-surface);
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 680;
}

@media (max-width: 1380px) {
  .reports-layout {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
