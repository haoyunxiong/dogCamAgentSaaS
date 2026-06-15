<template>
  <AppShell>
    <div class="page">
      <header class="page-header">
        <div>
          <h1 class="page-title">客户中心</h1>
          <p class="page-desc">查看客户复租、渠道、风险标签和最近订单。</p>
        </div>
        <BaseButton variant="secondary">导出客户列表</BaseButton>
      </header>

      <section class="metric-grid">
        <MetricCard v-for="metric in customerKpis" :key="metric.key" :metric="metric" />
      </section>

      <FilterBar>
        <BaseInput v-model="keyword" placeholder="搜索客户、手机号、订单号" />
        <BaseSelect v-model="risk" label="风险" :options="riskOptions" />
        <StatusTabs v-model="channel" :items="channelTabs" />
      </FilterBar>

      <BaseTable
        :columns="columns"
        :rows="filteredCustomers"
        row-key="id"
        :selected-key="selectedCustomer?.id || ''"
        @row-click="selectedCustomer = $event"
      >
        <template #name="{ row }">
          <div class="cell-stack">
            <strong>{{ row.name }}</strong>
            <small>{{ row.phoneMasked }} · {{ row.city }}</small>
          </div>
        </template>
        <template #riskLevel="{ row }">
          <StatusTag :label="row.riskLevel" />
        </template>
        <template #tags="{ row }">
          <div class="tag-row">
            <StatusTag v-for="tag in row.tags" :key="tag" :label="tag" tone="neutral" />
          </div>
        </template>
        <template #totalRent="{ row }">
          ¥{{ row.totalRent.toLocaleString() }}
        </template>
      </BaseTable>
    </div>

    <Drawer
      :open="Boolean(selectedCustomer)"
      :title="selectedCustomer?.name || '客户详情'"
      :description="selectedCustomer ? `${selectedCustomer.channel} · ${selectedCustomer.phoneMasked}` : ''"
      @close="selectedCustomer = null"
    >
      <div v-if="selectedCustomer" class="drawer-stack">
        <section class="detail-hero">
          <StatusTag :label="selectedCustomer.riskLevel" />
          <h3>{{ selectedCustomer.name }}</h3>
          <p>{{ selectedCustomer.city }} · {{ selectedCustomer.depositPreference }}</p>
        </section>
        <section class="detail-grid">
          <div><span>累计订单</span><strong>{{ selectedCustomer.orderCount }} 单</strong></div>
          <div><span>累计租金</span><strong>¥{{ selectedCustomer.totalRent.toLocaleString() }}</strong></div>
          <div><span>最近订单</span><strong>{{ selectedCustomer.lastOrderNo }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedCustomer.nextAction }}</strong></div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h3 class="section-title">风险备注</h3>
          </div>
          <div class="panel-body note-text">{{ selectedCustomer.note }}</div>
        </section>
      </div>
    </Drawer>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppShell from '../../components/AppShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseInput from '../../components/BaseInput.vue'
import BaseSelect from '../../components/BaseSelect.vue'
import BaseTable from '../../components/BaseTable.vue'
import Drawer from '../../components/Drawer.vue'
import FilterBar from '../../components/FilterBar.vue'
import MetricCard from '../../components/MetricCard.vue'
import StatusTabs from '../../components/StatusTabs.vue'
import StatusTag from '../../components/StatusTag.vue'
import { customerKpis, customers } from '../../mock/customers.js'

const keyword = ref('')
const risk = ref('全部风险')
const channel = ref('全部渠道')
const selectedCustomer = ref(null)
const riskOptions = ['全部风险', '正常', '低风险', '中风险', '高风险']
const columns = [
  { key: 'name', label: '客户' },
  { key: 'channel', label: '来源渠道' },
  { key: 'riskLevel', label: '风险' },
  { key: 'tags', label: '标签' },
  { key: 'orderCount', label: '订单数' },
  { key: 'totalRent', label: '累计租金' },
  { key: 'lastOrderNo', label: '最近订单' },
  { key: 'nextAction', label: '下一步' }
]

const channelTabs = computed(() => ['全部渠道', '闲鱼', '小红书', '抖音', '私域'].map((item) => ({
  label: item,
  value: item,
  count: item === '全部渠道' ? customers.length : customers.filter((customer) => customer.channel === item).length
})))

const filteredCustomers = computed(() => customers.filter((customer) => {
  const text = `${customer.name}${customer.phoneMasked}${customer.lastOrderNo}${customer.city}`
  const matchRisk = risk.value === '全部风险' || customer.riskLevel === risk.value
  const matchChannel = channel.value === '全部渠道' || customer.channel === channel.value
  return matchRisk && matchChannel && (!keyword.value || text.includes(keyword.value))
}))
</script>

<style scoped>
.cell-stack strong,
.cell-stack small {
  display: block;
}

.cell-stack small {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.tag-row {
  display: flex;
  gap: var(--space-4);
}

.drawer-stack {
  display: grid;
  gap: var(--space-12);
}

.detail-hero {
  padding: var(--space-16);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
}

.detail-hero h3 {
  margin: var(--space-12) 0 var(--space-4);
}

.detail-hero p {
  margin: 0;
  color: var(--text-muted);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-10, 10px);
}

.detail-grid div {
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
}

.detail-grid span {
  display: block;
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.detail-grid strong {
  display: block;
  margin-top: var(--space-4);
}

.note-text {
  color: var(--text-soft);
}
</style>
