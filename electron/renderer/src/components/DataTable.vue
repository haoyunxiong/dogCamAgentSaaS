<template>
  <div class="data-table-shell" :class="{ compact: isDense, loading, empty }">
    <div class="data-table-shell__scroll" :style="{ minWidth }">
      <table class="data-table-shell__table">
        <template v-if="hasColumns">
          <thead>
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                :style="{ width: column.width || undefined }"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row[rowKey]"
              :class="{ 'is-selected': selectedKey && row[rowKey] === selectedKey }"
              :aria-selected="selectedKey && row[rowKey] === selectedKey ? 'true' : undefined"
              @click="$emit('row-click', row)"
            >
              <td v-for="column in columns" :key="column.key">
                <slot :name="column.key" :row="row" :value="row[column.key]">
                  {{ row[column.key] }}
                </slot>
              </td>
            </tr>
          </tbody>
        </template>
        <slot v-else />
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
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  rowKey: { type: String, default: 'id' },
  selectedKey: { type: [String, Number], default: '' },
})

defineEmits(['row-click'])

const isDense = computed(() => props.compact || props.dense)
const hasColumns = computed(() => props.columns.length > 0)
const empty = computed(() => props.empty || (hasColumns.value && !props.loading && props.rows.length === 0))
</script>

<style scoped>
.data-table-shell {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-12, 12px);
  background: var(--color-surface, #fff);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.035);
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
  height: 38px;
  padding: 0 12px;
  background: linear-gradient(180deg, #fbfcfd, #f5f7f8);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-muted, #6b7280);
  font-size: 11px;
  font-weight: 760;
  text-align: left;
  letter-spacing: 0;
  white-space: nowrap;
}

:deep(td) {
  min-height: 52px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(229, 235, 232, 0.82);
  color: var(--color-text, #111827);
  font-size: 13px;
  vertical-align: middle;
  white-space: nowrap;
}

:deep(tbody tr:hover td) {
  background: rgba(232, 247, 243, 0.52);
}

.data-table-shell__table tbody tr {
  cursor: pointer;
  transition: background var(--duration-fast, 100ms) var(--ease-standard, ease);
}

.data-table-shell__table tbody tr[aria-selected],
.data-table-shell__table tbody tr:hover {
  cursor: pointer;
}

:deep(tbody tr.selected td),
:deep(tbody tr.is-selected td),
:deep(tbody tr[aria-selected='true'] td) {
  background: rgba(0, 127, 109, 0.095);
}

:deep(tbody tr:hover td:first-child),
:deep(tbody tr[aria-selected='true'] td:first-child) {
  box-shadow: inset 3px 0 0 var(--color-primary, #007f6d);
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
