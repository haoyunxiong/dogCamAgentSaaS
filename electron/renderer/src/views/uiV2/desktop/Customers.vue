<template>
  <UiV2Page title="客户中心" description="查看客户复租、渠道、风险标签和最近订单。">
    <template #actions><BaseButton variant="secondary">导出客户列表</BaseButton></template>
    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
      <span v-if="sourceMeta.fallbackReason" class="adapter-source__reason">{{ sourceMeta.fallbackReason }}</span>
      <span v-if="loadError" class="adapter-source__error">{{ loadError }}</span>
    </div>
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
    <div v-if="loading" class="adapter-state">客户只读数据读取中...</div>

    <DataTable
      :columns="columns"
      :rows="filteredCustomers"
      row-key="id"
      :selected-key="selectedCustomer?.id || ''"
      compact
      :empty-title="loading ? '客户只读数据读取中' : '暂无匹配客户'"
      @row-click="openCustomer"
    >
      <template #name="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.name }}</strong><small>{{ row.phoneMasked || row.maskedPhone }} · {{ row.city }}</small></div></template>
      <template #riskLevel="{ row }"><StatusBadge :label="row.riskLevel" size="sm" /></template>
      <template #tags="{ row }"><div class="ui-v2-tag-row"><StatusBadge v-for="tag in row.tags" :key="tag" :label="tag" variant="neutral" size="sm" /></div></template>
      <template #totalRent="{ row }">¥{{ Number(row.totalRent || row.totalAmount || 0).toLocaleString() }}</template>
    </DataTable>
    <BaseDrawer v-model="drawerOpen" :title="selectedCustomer?.name || '客户详情'" :subtitle="selectedCustomer?.phoneMasked || selectedCustomer?.maskedPhone || ''" width="600" test-id="customer-detail-drawer">
      <div v-if="selectedCustomer" class="ui-v2-stack">
        <DrawerSummary :status="selectedCustomer.riskLevel" :title="selectedCustomer.name" :description="`${selectedCustomer.city} · ${selectedCustomer.depositPreference}`" :meta="`${selectedCustomer.channel || selectedCustomer.source} · ${selectedCustomer.phoneMasked || selectedCustomer.maskedPhone}`" primary-label="查看最近订单" secondary-label="标记已联系" />
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>累计订单</span><strong>{{ selectedCustomer.orderCount }} 单</strong></div>
          <div><span>累计租金</span><strong>¥{{ Number(selectedCustomer.totalRent || selectedCustomer.totalAmount || 0).toLocaleString() }}</strong></div>
          <div><span>最近订单</span><strong>{{ selectedCustomer.lastOrderNo }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedCustomer.nextAction }}</strong></div>
        </section>
        <UiV2Section title="风险备注"><p>{{ selectedCustomer.note || selectedCustomer.notes }}</p></UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const customers = ref([])
const options = ref({ channels: [] })
const keyword = ref('')
const risk = ref('全部风险')
const channel = ref('全部渠道')
const selectedCustomer = ref(null)
const drawerOpen = ref(false)
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
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

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '真实只读'
  if (sourceMeta.value.source === 'mock-fallback') return 'Mock fallback'
  return 'Mock 预览'
})

const customerMetrics = computed(() => [
  { key: 'customers', label: '客户总数', value: customers.value.length, unit: '', trend: sourceLabel.value, tone: 'info' },
  { key: 'active', label: '活跃客户', value: activeCustomers.value, unit: '', trend: '只读派生', tone: 'success' },
  { key: 'repeat', label: '复购客户', value: repeatCustomers.value, unit: '', trend: '订单聚合', tone: 'warning' },
  { key: 'risk', label: '风险客户', value: riskCustomers.value, unit: '', trend: '启发式派生', tone: 'danger' },
  { key: 'deposit', label: '免押客户', value: depositFreeCustomers.value, unit: '', trend: '本地缓存补充', tone: 'success' },
  { key: 'price', label: '平均客单价', value: `¥${averageCustomerAmount.value.toLocaleString()}`, unit: '', trend: '只读汇总', tone: 'info' },
])

const activeCustomers = computed(() => customers.value.filter((customer) => Number(customer.orderCount || 0) > 0).length)
const repeatCustomers = computed(() => customers.value.filter((customer) => Number(customer.orderCount || 0) >= 2).length)
const riskCustomers = computed(() => customers.value.filter((customer) => ['中', '高'].includes(customer.riskLevel)).length)
const depositFreeCustomers = computed(() => customers.value.filter((customer) => String(customer.depositStatus || customer.depositPreference || '').includes('免押')).length)
const averageCustomerAmount = computed(() => {
  if (!customers.value.length) return 0
  const total = customers.value.reduce((sum, customer) => sum + Number(customer.totalRent || customer.totalAmount || 0), 0)
  return Math.round(total / customers.value.length)
})

const filteredCustomers = computed(() => customers.value.filter((customer) => {
  const text = `${customer.name}${customer.phoneMasked || customer.maskedPhone}${customer.lastOrderNo}${customer.city}`
  return (risk.value === '全部风险' || customer.riskLevel === risk.value)
    && (channel.value === '全部渠道' || customer.channel === channel.value || customer.source === channel.value)
    && (!keyword.value || text.includes(keyword.value))
}))

async function loadCustomers() {
  loading.value = true
  loadError.value = ''
  try {
    const nextCustomers = await uiV2Adapter.getCustomers()
    customers.value = Array.isArray(nextCustomers) ? nextCustomers : []
    const nextOptions = await uiV2Adapter.getOptions()
    const channels = Array.from(new Set(customers.value.map((customer) => customer.channel || customer.source).filter(Boolean)))
    options.value = { channels: [], ...nextOptions, channels: channels.length ? channels : nextOptions?.channels || [] }
    sourceMeta.value = uiV2Adapter.getLastMeta('getCustomers')
  } catch (error) {
    customers.value = []
    sourceMeta.value = uiV2Adapter.getMeta()
    loadError.value = error?.message || '客户只读数据读取失败'
  } finally {
    loading.value = false
  }
}

function openCustomer(customer) {
  selectedCustomer.value = customer
  drawerOpen.value = true
}

onMounted(loadCustomers)
</script>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(2, minmax(180px, 0.6fr));
  gap: var(--space-12);
  align-items: end;
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
</style>
