<template>
  <div class="data-table-shell" :class="{ compact: isDense, loading, empty }">
    <div class="data-table-shell__scroll" :style="{ minWidth }">
      <table class="data-table-shell__table">
        <slot />
      </table>
    </div>
    <div v-if="loading" class="data-table-state data-table-state--loading" aria-live="polite">
      <div class="data-table-skeleton">
        <span v-for="i in 4" :key="i"></span>
      </div>
      <span>{{ loadingText }}</span>
    </div>
    <div v-else-if="empty" class="data-table-state data-table-state--empty">
      <strong>{{ emptyTitle }}</strong>
      <span v-if="emptyHint">{{ emptyHint }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  minWidth: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  dense: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: '加载中' },
  empty: { type: Boolean, default: false },
  emptyTitle: { type: String, default: '暂无数据' },
  emptyHint: { type: String, default: '' },
})

const isDense = computed(() => props.compact || props.dense)
</script>

<style scoped>
.data-table-shell {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-8, 8px);
  background: var(--color-surface, #fff);
}

.data-table-shell__scroll {
  overflow: auto;
}

.data-table-shell__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface, #fff);
}

:deep(th) {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 40px;
  padding: 0 12px;
  background: #f8fafc;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-muted, #6b7280);
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
}

:deep(td) {
  min-height: 52px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.72);
  color: var(--color-text, #111827);
  font-size: 13px;
  vertical-align: middle;
  white-space: nowrap;
}

:deep(tbody tr:hover td) {
  background: #f8fafc;
}

:deep(tbody tr.selected td),
:deep(tbody tr.is-selected td),
:deep(tbody tr[aria-selected='true'] td) {
  background: rgba(0, 127, 109, 0.08);
}

.compact :deep(td) {
  min-height: 44px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.data-table-state {
  display: grid;
  place-items: center;
  gap: var(--space-token-8, 8px);
  min-height: 132px;
  padding: var(--space-24, 24px);
  border-top: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-muted, #6b7280);
  font-size: 13px;
  text-align: center;
}

.data-table-state strong {
  color: var(--color-text, #111827);
  font-size: 14px;
}

.data-table-skeleton {
  display: grid;
  gap: var(--space-token-8, 8px);
  width: min(420px, 100%);
}

.data-table-skeleton span {
  height: 10px;
  border-radius: var(--radius-4, 4px);
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.12) 0%,
    rgba(148, 163, 184, 0.22) 50%,
    rgba(148, 163, 184, 0.12) 100%
  );
  background-size: 200% 100%;
  animation: data-table-skeleton 1.4s ease-in-out infinite;
}

@keyframes data-table-skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
