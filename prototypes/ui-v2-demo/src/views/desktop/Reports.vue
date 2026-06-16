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

      <section class="report-pulse">
        <article v-for="item in reportPulse" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.note }}</small>
        </article>
      </section>

      <section class="report-grid">
        <ChartCard
          title="近 7 日租金趋势"
          subtitle="周末订单带动收入上行"
          tag="收入"
          variant="trend"
          value="¥86,420"
          note="7日累计"
          footer="06/14 为本周期峰值，发货和短租订单同步增长。"
          :data="revenueTrend"
        />
        <ChartCard
          title="设备利用率"
          subtitle="按核心型号查看资产周转"
          tag="利用率"
          value="76%"
          note="平均利用率"
          footer="Pocket 3 已接近高水位，后续接单需要先看档期。"
          :data="utilizationTrend"
        />
        <InsightPanel title="经营洞察" :items="reportInsights" />
      </section>

      <section class="report-grid secondary">
        <ChartCard
          title="渠道订单分布"
          subtitle="闲鱼和私域贡献稳定订单"
          tag="渠道"
          value="214"
          note="本周期订单"
          footer="私域订单稳定，但高价值设备仍集中在小红书与闲鱼。"
          :data="channelTrend"
        />
        <section class="panel ranking-cards">
          <div class="panel-header">
            <h3 class="section-title">型号经营排行</h3>
            <StatusTag label="Mock" tone="info" />
          </div>
          <div class="panel-body ranking-list">
            <article v-for="row in modelRanking.slice(0, 4)" :key="row.model">
              <span>#{{ row.rank }}</span>
              <div>
                <strong>{{ row.model }}</strong>
                <small>{{ row.orders }} 单 · ¥{{ row.revenue }} · {{ row.utilization }}</small>
              </div>
              <b>{{ row.signal }}</b>
            </article>
          </div>
        </section>
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
import { channelTrend, modelRanking, reportInsights, reportKpis, reportPulse, revenueTrend, utilizationTrend } from '../../mock/reports.js'

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

.report-grid.secondary {
  grid-template-columns: minmax(0, 0.7fr) minmax(440px, 1fr);
}

.report-pulse {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-12);
}

.report-pulse article {
  min-height: 92px;
  padding: var(--space-14, 14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
  display: grid;
  align-content: space-between;
  position: relative;
  overflow: hidden;
}

.report-pulse article::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--brand);
}

.report-pulse article:nth-child(2)::before { background: var(--warning); }
.report-pulse article:nth-child(3)::before { background: var(--info); }
.report-pulse article:nth-child(4)::before { background: var(--danger); }

.report-pulse span,
.report-pulse small {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
  font-weight: 720;
}

.report-pulse strong {
  color: var(--text);
  font-size: 24px;
  line-height: 1;
}

.ranking-cards {
  min-height: 304px;
}

.ranking-list {
  display: grid;
  gap: var(--space-8);
}

.ranking-list article {
  min-height: 64px;
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) minmax(120px, auto);
  gap: var(--space-12);
  align-items: center;
}

.ranking-list span {
  color: var(--brand);
  font-weight: 820;
}

.ranking-list strong,
.ranking-list small {
  display: block;
}

.ranking-list small {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.ranking-list b {
  color: var(--text-soft);
  font-size: var(--font-caption-size);
  text-align: right;
}

.rank-cell {
  color: var(--brand);
}

.signal-text {
  color: var(--text-soft);
  font-weight: 720;
}

@media (max-width: 1220px) {
  .report-grid,
  .report-grid.secondary,
  .report-pulse {
    grid-template-columns: 1fr;
  }
}
</style>
