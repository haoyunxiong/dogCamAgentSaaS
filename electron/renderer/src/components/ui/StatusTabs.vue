<template>
  <div class="status-tabs" role="tablist" :aria-label="ariaLabel">
    <FilterChip
      v-for="item in normalizedItems"
      :key="item.value"
      :label="item.label"
      :count="item.count"
      :selected="modelValue === item.value"
      role="tab"
      :aria-selected="modelValue === item.value ? 'true' : 'false'"
      @click="$emit('update:modelValue', item.value)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import FilterChip from '../FilterChip.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '状态筛选' },
})

defineEmits(['update:modelValue'])

const normalizedItems = computed(() => props.items.map((item) => {
  if (typeof item === 'string') return { label: item, value: item, count: null }
  return {
    label: item.label || String(item.value || ''),
    value: item.value || item.label,
    count: item.count ?? null,
  }
}))
</script>

<style scoped>
.status-tabs {
  display: flex;
  align-items: center;
  gap: var(--ui-space-8);
  overflow-x: auto;
  padding: 2px 0 var(--ui-space-4);
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}

.status-tabs::-webkit-scrollbar {
  display: none;
}

.status-tabs :deep(.filter-chip) {
  flex: 0 0 auto;
  min-height: 34px;
  scroll-snap-align: start;
}
</style>
