<template>
  <UiV2Page title="报表中心" description="仅展示 mock 经营分析，不接真实统计接口。">
    <template #actions><BaseButton variant="secondary">导出 Mock 报表</BaseButton></template>
    <section class="ui-v2-metric-grid"><MetricCard v-for="metric in report.kpis" :key="metric.key" :metric="metric" /></section>

    <FilterBar title="报表筛选" hint="仅前端 mock 统计，不接真实统计接口">
      <div class="report-filter-row">
        <BaseSelect model-value="深圳南山店" label="门店" :options="['深圳南山店']" />
        <BaseSelect model-value="2025-06-01 ~ 2025-06-14" label="时间范围" :options="['2025-06-01 ~ 2025-06-14']" />
        <BaseSelect model-value="全部渠道" label="渠道" :options="['全部渠道', '闲鱼', '小红书', '抖音', '私域']" />
        <BaseSelect model-value="全部类型" label="设备类型" :options="['全部类型', '相机', '稳定器', '补光灯']" />
        <BaseButton variant="secondary">重置</BaseButton>
      </div>
    </FilterBar>

    <section class="reports-layout">
      <ChartCard class="reports-trend" title="收入趋势" subtitle="收入金额（元）" value="¥285,560.00" note="较上月 +12.6%" :data="report.revenueTrend" variant="trend" />
      <div class="final-panel">
        <div class="final-panel__head"><div><h2>订单来源占比</h2><p>按渠道统计订单量</p></div></div>
        <div class="final-panel__body channel-card">
          <div class="donut">1,286<span>订单总量</span></div>
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
        <div class="final-panel__head"><div><h2>洞察与建议</h2><p>基于 mock 指标生成</p></div></div>
        <div class="final-panel__body"><InsightPanel title="建议行动" tag="" :items="report.insights" /></div>
      </div>
      <div class="final-panel">
        <div class="final-panel__head"><div><h2>设备租赁时长分布</h2><p>按租期分布</p></div></div>
        <div class="final-panel__body duration-card">
          <div class="donut small">1,286<span>订单量</span></div>
          <div class="channel-list">
            <div v-for="item in durationRows" :key="item.label"><i></i><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div>
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
        <div class="final-panel__head"><div><h2>门店对比（收入）</h2><p>2025-06-01 ~ 2025-06-14</p></div></div>
        <div class="final-panel__body store-bars">
          <div v-for="store in stores" :key="store.name">
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
import BaseButton from '../../../components/BaseButton.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import { ChartCard, InsightPanel, MetricCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const report = uiV2MockAdapter.getReport()
const durationRows = [
  { label: '1-3天', value: '38.6%' },
  { label: '4-7天', value: '24.3%' },
  { label: '8-15天', value: '17.8%' },
  { label: '16-30天', value: '11.2%' },
  { label: '30天以上', value: '8.1%' },
]
const stores = [
  { name: '深圳南山店', value: '285,560', percent: 100 },
  { name: '广州天河店', value: '236,780', percent: 83 },
  { name: '上海静安店', value: '198,450', percent: 69 },
  { name: '北京朝阳店', value: '165,230', percent: 58 },
  { name: '成都武侯店', value: '123,680', percent: 43 },
]
const columns = [
  { key: 'rank', label: '排名' },
  { key: 'model', label: '型号' },
  { key: 'orders', label: '订单' },
  { key: 'revenue', label: '收入' },
  { key: 'utilization', label: '利用率' },
  { key: 'signal', label: '信号' },
]
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

@media (max-width: 1380px) {
  .reports-layout {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
