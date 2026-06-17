<template>
  <MobileShell>
    <div class="ui-v2-mobile-page">
      <MobileAppBar title="设备中心" subtitle="">
        <template #actions><BaseButton variant="secondary" size="sm" @click="scanMock = true">{{ scanMock ? '已扫码' : '扫码' }}</BaseButton></template>
      </MobileAppBar>
      <section class="mobile-dark-hero">
        <div class="mobile-stat-grid is-four">
          <div v-for="item in deviceStats" :key="item.label" class="mobile-stat">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
            <em>{{ item.trend }}</em>
          </div>
        </div>
      </section>
      <section class="mobile-content-sheet">
        <div class="mobile-tabs">
          <button v-for="item in statuses" :key="item" type="button" class="mobile-tab" :class="{ 'is-active': status === item }" @click="status = item">{{ item }}</button>
        </div>
        <BaseInput v-model="keyword" search clearable placeholder="搜索资产编号、型号、位置" />
        <div class="ui-v2-stack">
          <DeviceCard v-for="device in filteredDevices" :key="device.id" :device="device" />
          <EmptyState v-if="filteredDevices.length === 0" state="no-result" compact />
        </div>
      </section>
    </div>
  </MobileShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseButton from '../../../components/BaseButton.vue'
import BaseInput from '../../../components/BaseInput.vue'
import EmptyState from '../../../components/EmptyState.vue'
import { DeviceCard } from '../../../components/business'
import { MobileAppBar, MobileShell } from '../../../components/mobile'
import { uiV2MockAdapter } from '../../../adapters/uiV2'
import '../shared/uiV2View.css'

const devices = uiV2MockAdapter.getDevices()
const statuses = ['全部', '可租', '在租', '待清洁', '维修中', '异常']
const keyword = ref('')
const status = ref('全部')
const scanMock = ref(false)
const deviceStats = [
  { label: '设备总数', value: 182, trend: '较昨日 +4' },
  { label: '在租', value: 128, trend: '较昨日 +6' },
  { label: '可用', value: 42, trend: '较昨日 -2' },
  { label: '维修/异常', value: 12, trend: '较昨日 +1' },
]
const filteredDevices = computed(() => devices.filter((device) => {
  const text = `${device.assetNo}${device.model}${device.location}${device.serialNo}`
  return (status.value === '全部' || device.status === status.value) && (!keyword.value || text.includes(keyword.value))
}).slice(0, 18))
</script>

<style scoped>
</style>
