<template>
  <div class="schedule-legend">
    <span v-for="item in items" :key="item.label" :class="item.status">
      <i aria-hidden="true" />
      {{ item.label }}
    </span>
  </div>
</template>

<script setup>
const items = [
  { label: '可安排', status: '可租' },
  { label: '满租 / 占用', status: '占用' },
  { label: '余量不足 / 冲突', status: '冲突' },
  { label: '维修不可用', status: '维修' }
]
</script>

<style scoped>
.schedule-legend {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

i {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-pill);
  background: currentColor;
}

.可租 { color: var(--success); }
.占用 { color: var(--info); }
.冲突 { color: var(--danger); }
.维修 { color: var(--warning); }
</style>
