<template>
  <div class="status-tabs">
    <FilterChip
      v-for="item in normalizedItems"
      :key="item.value"
      :label="item.label"
      :count="item.count"
      :active="modelValue === item.value"
      @click="$emit('update:modelValue', item.value)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import FilterChip from './FilterChip.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  items: { type: Array, default: () => [] }
})

defineEmits(['update:modelValue'])

const normalizedItems = computed(() => props.items.map((item) => (
  typeof item === 'string'
    ? { label: item, value: item }
    : { label: item.label, value: item.value || item.label, count: item.count }
)))
</script>

<style scoped>
.status-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  overflow-x: auto;
  padding: 2px 0 var(--space-4);
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}

.status-tabs::-webkit-scrollbar {
  display: none;
}

.status-tabs :deep(.filter-chip) {
  flex: 0 0 auto;
  min-height: 36px;
  scroll-snap-align: start;
}
</style>
