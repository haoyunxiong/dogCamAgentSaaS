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
  padding-bottom: 2px;
}
</style>
