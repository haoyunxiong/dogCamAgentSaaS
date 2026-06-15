<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length">
            <div class="empty-state">暂无匹配数据，可以清除筛选后重试。</div>
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
defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  selectedKey: { type: String, default: '' }
})

defineEmits(['row-click'])
</script>

<style scoped>
.table-wrap {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  background: rgba(247, 248, 245, 0.86);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 760;
}

td {
  color: var(--text-soft);
  font-size: 13px;
  height: 44px;
}

tbody tr {
  transition: background 0.15s ease;
}

tbody tr:hover {
  background: #f7faf8;
}

tbody tr.selected {
  background: var(--brand-soft);
  box-shadow: inset 3px 0 0 var(--brand);
}

tbody tr:last-child td {
  border-bottom: 0;
}
</style>
