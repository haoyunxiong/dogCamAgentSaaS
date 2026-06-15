<template>
  <MobileShell>
    <div class="mobile-page">
      <header class="mobile-header">
        <div>
          <span>设备快查</span>
          <h1>设备中心</h1>
        </div>
        <BaseButton variant="secondary" size="sm" @click="keyword = 'DEV-001'">扫码 mock</BaseButton>
      </header>

      <section class="overview-grid">
        <article v-for="item in overview" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.note }}</small>
        </article>
      </section>

      <BaseInput v-model="keyword" placeholder="搜索设备编号、型号或序列号" />
      <StatusTabs v-model="status" :items="statusTabs" />

      <section class="stack">
        <DeviceCard v-for="device in filteredDevices" :key="device.id" :device="device" />
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import MobileShell from '../../components/MobileShell.vue'
import BaseButton from '../../components/BaseButton.vue'
import BaseInput from '../../components/BaseInput.vue'
import DeviceCard from '../../components/DeviceCard.vue'
import StatusTabs from '../../components/StatusTabs.vue'
import { devices, deviceStatuses } from '../../mock/devices.js'

const keyword = ref('')
const status = ref('全部')
const primaryStatuses = ['全部', '可租', '在租', '维修中', '待清洁']

const overview = computed(() => [
  { label: '可用', value: devices.filter((item) => item.status === '可租').length, note: '可立即分配' },
  { label: '在租', value: devices.filter((item) => item.status === '在租').length, note: '关注归还' },
  { label: '维修', value: devices.filter((item) => ['维修中', '异常'].includes(item.status)).length, note: '不可分配' }
])

const statusTabs = computed(() => primaryStatuses.map((item) => ({
  label: item,
  value: item,
  count: item === '全部' ? devices.length : devices.filter((device) => device.status === item).length
})).concat(deviceStatuses
  .filter((item) => !primaryStatuses.includes(item))
  .map((item) => ({ label: item, value: item, count: devices.filter((device) => device.status === item).length }))))

const filteredDevices = computed(() => devices.filter((device) => {
  const matchStatus = status.value === '全部' || device.status === status.value
  const text = `${device.id}${device.assetNo}${device.model}${device.serialNo}`
  return matchStatus && (!keyword.value || text.includes(keyword.value))
}).slice(0, 12))
</script>

<style scoped>
.mobile-page {
  display: grid;
  gap: var(--space-12);
}

.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.mobile-header span {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
  font-weight: 720;
}

.mobile-header h1 {
  margin: var(--space-4) 0 0;
  font-size: var(--font-mobile-nav-title-size);
  line-height: var(--font-mobile-nav-title-line);
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-8);
}

.overview-grid article {
  min-height: 92px;
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-12);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
  display: grid;
  align-content: space-between;
}

.overview-grid span,
.overview-grid small {
  color: var(--text-muted);
  font-size: var(--font-caption-size);
}

.overview-grid strong {
  color: var(--brand-strong);
  font-size: 24px;
  line-height: 1;
}
</style>
