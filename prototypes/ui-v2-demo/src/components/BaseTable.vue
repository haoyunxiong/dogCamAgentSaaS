<template>
  <div class="base-table">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" :style="{ width: column.width || undefined }">
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length">
            <BaseEmpty title="暂无匹配订单" description="调整筛选条件后再查看当前队列。" />
          </td>
        </tr>
        <tr
          v-for="row in rows"
          v-else
          :key="row[rowKey] || row.id || row.orderNo"
          :class="{ selected: selectedKey && (row[rowKey] || row.id || row.orderNo) === selectedKey }"
          @click="$emit('row-click', row)"
        >
          <td v-for="column in columns" :key="column.key">
            <slot :name="column.key" :row="row">{{ row[column.key] }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import BaseEmpty from './BaseEmpty.vue'

defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  selectedKey: { type: String, default: '' }
})

defineEmits(['row-click'])
</script>

<style scoped>
.base-table {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}

th,
td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  height: 42px;
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: var(--font-caption-size);
  line-height: var(--font-caption-line);
  font-weight: 760;
}

td {
  height: 52px;
  color: var(--text-soft);
  font-size: var(--font-pc-table-size);
  line-height: var(--font-pc-table-line);
}

tbody tr {
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

tbody tr:hover {
  background: var(--color-bg-muted);
}

tbody tr.selected {
  background: var(--brand-soft);
  box-shadow: inset 3px 0 0 var(--brand);
}

tbody tr:last-child td {
  border-bottom: 0;
}
</style>
