<template>
  <nav class="pagination" aria-label="分页">
    <span>共 {{ total }} 条</span>
    <div class="pagination__actions">
      <BaseButton
        variant="secondary"
        size="sm"
        :disabled="page <= 1"
        @click="$emit('update:page', page - 1)"
      >
        上一页
      </BaseButton>
      <strong>{{ page }} / {{ pageCount }}</strong>
      <BaseButton
        variant="secondary"
        size="sm"
        :disabled="page >= pageCount"
        @click="$emit('update:page', page + 1)"
      >
        下一页
      </BaseButton>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import BaseButton from '../BaseButton.vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  total: { type: Number, default: 0 },
})

defineEmits(['update:page'])

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<style scoped>
.pagination {
  min-height: 40px;
  padding: var(--ui-space-8) 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-12);
  color: var(--ui-text-muted);
  font-size: 13px;
}

.pagination__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-8);
}

.pagination strong {
  color: var(--ui-text);
  font-weight: 700;
}
</style>
