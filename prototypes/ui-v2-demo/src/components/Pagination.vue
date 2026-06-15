<template>
  <nav class="pagination" aria-label="分页">
    <span>共 {{ total }} 条</span>
    <div class="page-actions">
      <button type="button" :disabled="page <= 1" @click="$emit('update:page', page - 1)">上一页</button>
      <strong>{{ page }} / {{ pageCount }}</strong>
      <button type="button" :disabled="page >= pageCount" @click="$emit('update:page', page + 1)">下一页</button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  total: { type: Number, default: 0 }
})

defineEmits(['update:page'])

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
</script>

<style scoped>
.pagination {
  min-height: 40px;
  padding: var(--space-8) 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  color: var(--text-muted);
  font-size: 13px;
}

.page-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
}

button {
  height: 32px;
  padding: 0 var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  color: var(--text-soft);
  font-weight: 680;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

strong {
  color: var(--text);
  font-weight: 700;
}
</style>
