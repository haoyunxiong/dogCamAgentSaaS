<template>
  <BaseDrawer v-model="model" :title="title" :width="width">
    <div class="advanced-filter-drawer">
      <p v-if="hint" class="advanced-filter-drawer__hint">{{ hint }}</p>
      <slot />
    </div>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </BaseDrawer>
</template>

<script setup>
import { computed } from 'vue'
import BaseDrawer from './BaseDrawer.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '高级筛选' },
  hint: { type: String, default: '' },
  width: { type: Number, default: 420 },
})

const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<style scoped>
.advanced-filter-drawer {
  display: grid;
  gap: 14px;
}

.advanced-filter-drawer__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary, #6b7280);
}
</style>
