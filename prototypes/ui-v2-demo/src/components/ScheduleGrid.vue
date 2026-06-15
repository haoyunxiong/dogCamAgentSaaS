<template>
  <div class="schedule-grid">
    <div class="schedule-header">
      <div class="model-head">设备 / 日期</div>
      <div v-for="date in dates" :key="date" class="date-head">
        <strong>{{ formatDay(date) }}</strong>
        <span>{{ formatWeek(date) }}</span>
      </div>
    </div>

    <div v-for="group in groups" :key="group.model" class="model-group">
      <div class="group-title">{{ group.model }}</div>
      <div v-for="device in group.devices" :key="device.id" class="device-row">
        <div class="device-name">
          <strong>{{ device.assetNo }}</strong>
          <span>{{ device.status }}</span>
        </div>
        <button
          v-for="date in dates"
          :key="`${device.id}-${date}`"
          :class="['slot', slotFor(device.id, date)?.status]"
          type="button"
          @click="$emit('slot-click', slotFor(device.id, date))"
        >
          <span>{{ slotFor(device.id, date)?.label }}</span>
          <small v-if="slotFor(device.id, date)?.orderId">{{ shortOrder(slotFor(device.id, date)?.orderId) }}</small>
          <small v-else-if="slotFor(device.id, date)?.status === '维修'">复检</small>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  dates: { type: Array, required: true },
  groups: { type: Array, required: true },
  schedule: { type: Array, required: true }
})

defineEmits(['slot-click'])

function slotFor(deviceId, date) {
  return props.schedule.find((item) => item.deviceId === deviceId && item.date === date)
}

function formatDay(date) {
  return date.slice(5)
}

function formatWeek(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六']
  return `周${week[new Date(`${date}T00:00:00`).getDay()]}`
}

function shortOrder(orderId) {
  return orderId?.replace('ORD-', '#')
}
</script>

<style scoped>
.schedule-grid {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: rgba(251, 251, 250, 0.9);
}

.schedule-header,
.device-row {
  display: grid;
  grid-template-columns: 172px repeat(7, minmax(86px, 1fr));
}

.model-head,
.date-head,
.device-name,
.slot {
  border-bottom: 1px solid var(--border);
  border-right: 1px solid rgba(220, 223, 216, 0.68);
}

.model-head,
.date-head {
  min-height: 50px;
  padding: 9px 10px;
  background: rgba(238, 241, 235, 0.88);
}

.date-head strong,
.date-head span {
  display: block;
}

.date-head span {
  color: var(--text-muted);
  font-size: 12px;
}

.group-title {
  padding: 9px 12px;
  background: #e6ebe5;
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 780;
  border-bottom: 1px solid var(--border);
}

.device-name {
  min-width: 0;
  padding: 9px 10px;
  display: grid;
  gap: 2px;
}

.device-name strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.device-name span {
  color: var(--text-muted);
  font-size: 11px;
}

.slot {
  min-height: 48px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 760;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 2px;
  border-radius: 0;
}

.slot:hover {
  outline: 2px solid rgba(15, 104, 97, 0.18);
  outline-offset: -2px;
}

.slot span,
.slot small {
  display: block;
}

.slot small {
  font-size: 10px;
  color: currentColor;
  opacity: 0.72;
}

.slot.可租 {
  color: var(--success);
  background: rgba(231, 242, 236, 0.86);
}

.slot.占用 {
  color: var(--info);
  background: rgba(231, 238, 245, 0.92);
}

.slot.冲突 {
  color: var(--danger);
  background: repeating-linear-gradient(135deg, rgba(248, 232, 229, 0.95), rgba(248, 232, 229, 0.95) 8px, rgba(255, 255, 255, 0.72) 8px, rgba(255, 255, 255, 0.72) 16px);
  box-shadow: inset 0 0 0 1px rgba(163, 63, 63, 0.16);
}

.slot.维修 {
  color: var(--warning);
  background: rgba(247, 237, 216, 0.92);
}
</style>
