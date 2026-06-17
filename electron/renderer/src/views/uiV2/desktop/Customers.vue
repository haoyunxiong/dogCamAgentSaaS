<template>
  <UiV2Page title="客户中心" description="查看客户复租、渠道、风险标签和最近订单。">
    <template #actions><BaseButton variant="secondary">导出客户列表</BaseButton></template>
    <section class="ui-v2-metric-grid">
      <MetricCard v-for="metric in customerMetrics" :key="metric.key" :metric="metric" />
    </section>
    <FilterBar title="客户筛选" hint="按来源、会员、风险、门店和最近活跃筛选">
      <div class="filter-row">
        <BaseInput v-model="keyword" search clearable placeholder="搜索客户、手机号、订单号" />
        <BaseSelect v-model="risk" label="风险" :options="['全部风险', '正常', '低', '中', '高']" />
        <BaseSelect v-model="channel" label="渠道" :options="['全部渠道', ...options.channels]" />
      </div>
    </FilterBar>
    <DataTable :columns="columns" :rows="filteredCustomers" row-key="id" :selected-key="selectedCustomer?.id || ''" compact @row-click="openCustomer">
      <template #name="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.name }}</strong><small>{{ row.phoneMasked }} · {{ row.city }}</small></div></template>
      <template #riskLevel="{ row }"><StatusBadge :label="row.riskLevel" size="sm" /></template>
      <template #tags="{ row }"><div class="ui-v2-tag-row"><StatusBadge v-for="tag in row.tags" :key="tag" :label="tag" variant="neutral" size="sm" /></div></template>
      <template #totalRent="{ row }">¥{{ row.totalRent.toLocaleString() }}</template>
    </DataTable>
    <BaseDrawer v-model="drawerOpen" :title="selectedCustomer?.name || '客户详情'" :subtitle="selectedCustomer?.phoneMasked || ''" width="600" test-id="customer-detail-drawer">
      <div v-if="selectedCustomer" class="ui-v2-stack">
        <DrawerSummary :status="selectedCustomer.riskLevel" :title="selectedCustomer.name" :description="`${selectedCustomer.city} · ${selectedCustomer.depositPreference}`" :meta="`${selectedCustomer.channel} · ${selectedCustomer.phoneMasked}`" primary-label="查看最近订单" secondary-label="标记已联系" />
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>累计订单</span><strong>{{ selectedCustomer.orderCount }} 单</strong></div>
          <div><span>累计租金</span><strong>¥{{ selectedCustomer.totalRent.toLocaleString() }}</strong></div>
          <div><span>最近订单</span><strong>{{ selectedCustomer.lastOrderNo }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedCustomer.nextAction }}</strong></div>
        </section>
        <UiV2Section title="风险备注"><p>{{ selectedCustomer.note }}</p></UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard } from '../../../components/ui'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const customers = uiV2MockAdapter.getCustomers()
const options = uiV2MockAdapter.getOptions()
const keyword = ref('')
const risk = ref('全部风险')
const channel = ref('全部渠道')
const selectedCustomer = ref(null)
const drawerOpen = ref(false)
const columns = [
  { key: 'name', label: '客户' },
  { key: 'channel', label: '来源渠道' },
  { key: 'riskLevel', label: '风险' },
  { key: 'tags', label: '标签' },
  { key: 'orderCount', label: '订单数' },
  { key: 'totalRent', label: '累计租金' },
  { key: 'lastOrderNo', label: '最近订单' },
  { key: 'nextAction', label: '下一步' },
]
const customerMetrics = computed(() => [
  { key: 'customers', label: '客户总数', value: '2,568', unit: '', trend: '较昨日 +32', tone: 'info' },
  { key: 'active', label: '活跃客户', value: '1,382', unit: '', trend: '较昨日 +18', tone: 'success' },
  { key: 'repeat', label: '复购客户', value: 986, unit: '', trend: '较昨日 +21', tone: 'warning' },
  { key: 'risk', label: '风险客户', value: 87, unit: '', trend: '较昨日 +3', tone: 'danger' },
  { key: 'member', label: '会员转化率', value: '38.6', unit: '%', trend: '较昨日 +3.2%', tone: 'success' },
  { key: 'price', label: '平均客单价', value: '¥1,856.00', unit: '', trend: '较昨日 +126.5', tone: 'info' },
])
const filteredCustomers = computed(() => customers.filter((customer) => {
  const text = `${customer.name}${customer.phoneMasked}${customer.lastOrderNo}${customer.city}`
  return (risk.value === '全部风险' || customer.riskLevel === risk.value)
    && (channel.value === '全部渠道' || customer.channel === channel.value)
    && (!keyword.value || text.includes(keyword.value))
}))
function openCustomer(customer) {
  selectedCustomer.value = customer
  drawerOpen.value = true
}
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(2, minmax(180px, 0.6fr));
  gap: var(--space-12);
  align-items: end;
}
</style>
