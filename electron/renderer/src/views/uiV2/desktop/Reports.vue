<template>
  <UiV2Page title="报表中心" description="仅展示 mock 经营分析，不接真实统计接口。">
    <template #actions><BaseButton variant="secondary">导出 Mock 报表</BaseButton></template>
    <section class="ui-v2-metric-grid"><MetricCard v-for="metric in report.kpis" :key="metric.key" :metric="metric" /></section>
    <section class="ui-v2-grid-2">
      <ChartCard title="租金收入趋势" subtitle="近 7 日 mock 趋势" tag="Mock" value="¥86,420" note="周环比 +12.4%" :data="report.revenueTrend" variant="trend" />
      <ChartCard title="渠道订单分布" subtitle="多渠道询单转租赁" tag="Mock" value="214 单" note="闲鱼仍为最大入口" :data="report.channelTrend" />
    </section>
    <section class="ui-v2-grid-2">
      <UiV2Section title="型号排行" hint="租赁业务核心机型表现">
        <DataTable :columns="columns" :rows="report.modelRanking" row-key="rank" compact>
          <template #rank="{ row }"><strong>#{{ row.rank }}</strong></template>
          <template #revenue="{ row }">¥{{ row.revenue }}</template>
        </DataTable>
      </UiV2Section>
      <InsightPanel title="经营洞察" :items="report.insights" />
    </section>
  </UiV2Page>
</template>

<script setup>
import BaseButton from '../../../components/BaseButton.vue'
import DataTable from '../../../components/DataTable.vue'
import { ChartCard, InsightPanel, MetricCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const report = uiV2MockAdapter.getReport()
const columns = [
  { key: 'rank', label: '排名' },
  { key: 'model', label: '型号' },
  { key: 'orders', label: '订单' },
  { key: 'revenue', label: '收入' },
  { key: 'utilization', label: '利用率' },
  { key: 'signal', label: '信号' },
]
</script>
