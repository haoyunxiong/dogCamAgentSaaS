<template>
  <UiV2Page title="客户中心" description="查看客户复租、渠道、风险标签和最近订单。">
    <template #actions><BaseButton variant="secondary">导出客户列表</BaseButton></template>
    <div class="adapter-source-row">
      <span class="adapter-source" :class="`is-${sourceMeta.source || 'mock'}`">{{ sourceLabel }}</span>
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
      :rows="pagedCustomers"
      row-key="id"
      :selected-key="selectedCustomer?.id || ''"
      compact
      :empty-title="loading ? '客户只读数据读取中' : '暂无匹配客户'"
      @row-click="openCustomer"
    >
      <template #name="{ row }"><div class="ui-v2-cell-stack"><strong>{{ row.name }}</strong><small>{{ row.sourceLabel }}</small></div></template>
      <template #phoneLabel="{ row }">{{ row.phoneLabel }}</template>
      <template #riskDisplay="{ row }"><StatusBadge :label="row.riskDisplay" size="sm" /></template>
      <template #tags="{ row }"><div class="ui-v2-tag-row"><StatusBadge v-for="tag in row.tags" :key="tag" :label="tag" variant="neutral" size="sm" /></div></template>
      <template #totalRent="{ row }">{{ row.totalRentLabel }}</template>
    </DataTable>
    <Pagination v-model:page="page" :total="filteredCustomers.length" :page-size="pageSize" />
    <BaseDrawer v-model="drawerOpen" :title="selectedCustomer?.name || '客户详情'" :subtitle="selectedCustomer?.phoneMasked || selectedCustomer?.maskedPhone || ''" width="600" test-id="customer-detail-drawer">
      <div v-if="selectedCustomer" class="ui-v2-stack">
        <DrawerSummary :status="selectedCustomer.riskDisplay" :title="selectedCustomer.name" :description="`${selectedCustomer.city} · ${selectedCustomer.depositPreference}`" :meta="`${selectedCustomer.sourceLabel} · ${selectedCustomer.phoneLabel}`" primary-label="查看最近订单" secondary-label="标记已联系" />
        <section class="final-drawer-card ui-v2-detail-grid">
          <div><span>累计订单</span><strong>{{ selectedCustomer.orderCount }} 单</strong></div>
          <div><span>累计租金</span><strong>{{ selectedCustomer.totalRentLabel }}</strong></div>
          <div><span>最近订单</span><strong>{{ selectedCustomer.lastOrderLabel }}</strong></div>
          <div><span>最近活跃</span><strong>{{ selectedCustomer.lastOrderAtLabel }}</strong></div>
          <div><span>设备偏好</span><strong>{{ selectedCustomer.devicePreference }}</strong></div>
          <div><span>下一步</span><strong>{{ selectedCustomer.nextAction }}</strong></div>
        </section>
        <UiV2Section title="派生风险依据"><p>{{ selectedCustomer.profileNote }}</p></UiV2Section>
      </div>
    </BaseDrawer>
  </UiV2Page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseDrawer from '../../../components/BaseDrawer.vue'
import BaseInput from '../../../components/BaseInput.vue'
import BaseSelect from '../../../components/BaseSelect.vue'
import DataTable from '../../../components/DataTable.vue'
import FilterBar from '../../../components/FilterBar.vue'
import StatusBadge from '../../../components/StatusBadge.vue'
import { DrawerSummary, MetricCard, Pagination } from '../../../components/ui'
import { uiV2Adapter } from '../../../adapters/uiV2'
import {
  buildCustomerMetrics,
  filterCustomerProfiles,
  paginateCustomerProfiles,
} from '../../../adapters/uiV2/customerProfileMapper.js'
import UiV2Page from '../shared/UiV2Page.vue'
import UiV2Section from '../shared/UiV2Section.vue'
import '../shared/uiV2View.css'

const customers = ref([])
const options = ref({ channels: [] })
const keyword = ref('')
const risk = ref('全部风险')
const channel = ref('全部渠道')
const page = ref(1)
const pageSize = 20
const selectedCustomer = ref(null)
const drawerOpen = ref(false)
const loading = ref(false)
const loadError = ref('')
const sourceMeta = ref(uiV2Adapter.getMeta())
const columns = [
  { key: 'name', label: '客户' },
  { key: 'phoneLabel', label: '联系方式' },
  { key: 'city', label: '城市' },
  { key: 'channel', label: '来源渠道' },
  { key: 'orderCount', label: '订单数' },
  { key: 'totalRent', label: '累计租金' },
  { key: 'lastOrderLabel', label: '最近订单' },
  { key: 'riskDisplay', label: '派生风险' },
  { key: 'tags', label: '标签' },
  { key: 'nextAction', label: '下一步' },
]

const sourceLabel = computed(() => {
  if (sourceMeta.value.source === 'real') return '本地数据库'
  return '本地演示数据'
})

const customerMetrics = computed(() => buildCustomerMetrics(customers.value))
const filteredCustomers = computed(() => filterCustomerProfiles(customers.value, {
  keyword: keyword.value,
  risk: risk.value,
  channel: channel.value,
}))
const pagedCustomers = computed(() => paginateCustomerProfiles(filteredCustomers.value, page.value, pageSize))

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

watch([keyword, risk, channel], () => {
  page.value = 1
})
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
