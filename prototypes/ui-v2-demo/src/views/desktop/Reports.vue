<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">报表中心</h1>
          <p class="page-desc">查看订单、收入、设备利用率和经营洞察。</p>
        </div>
        <BaseButton variant="secondary">导出报表</BaseButton>
      </header>

      <section class="metric-grid">
        <MetricCard v-for="metric in reportKpis" :key="metric.key" :metric="metric" />
      </section>

      <section class="report-grid">
        <ChartCard title="近 7 日租金趋势" subtitle="周末订单带动收入上行" tag="收入" :data="revenueTrend" />
        <ChartCard title="渠道订单分布" subtitle="闲鱼和私域贡献稳定订单" tag="渠道" :data="channelTrend" />
        <InsightPanel title="经营洞察" :items="reportInsights" />
      </section>

      <section class="panel">
        <div class="panel-header">
          <h3 class="section-title">设备型号排行</h3>
          <StatusTag label="Mock" tone="info" />
        </div>
        <div class="panel-body">
          <BaseTable :columns="columns" :rows="modelRanking" row-key="model">
            <template #rank="{ row }">
              <strong class="rank-cell">#{{ row.rank }}</strong>
            </template>
            <template #revenue="{ row }">
              ¥{{ row.revenue }}
            </template>
            <template #signal="{ row }">
              <span class="signal-text">{{ row.signal }}</span>
            </template>
          </BaseTable>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseTable from '../../components/BaseTable.vue'
import ChartCard from '../../components/ChartCard.vue'
import InsightPanel from '../../components/InsightPanel.vue'
import MetricCard from '../../components/MetricCard.vue'
import StatusTag from '../../components/StatusTag.vue'
import { channelTrend, modelRanking, reportInsights, reportKpis, revenueTrend } from '../../mock/reports.js'

const columns = [
  { key: 'rank', label: '排名' },
  { key: 'model', label: '设备型号' },
  { key: 'orders', label: '订单数' },
  { key: 'revenue', label: '租金收入' },
  { key: 'utilization', label: '利用率' },
  { key: 'signal', label: '经营信号' }
]
</script>

<style scoped>
.report-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 340px;
  gap: var(--space-16);
  align-items: stretch;
}

.rank-cell {
  color: var(--brand);
}

.signal-text {
  color: var(--text-soft);
  font-weight: 720;
}

@media (max-width: 1220px) {
  .report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
