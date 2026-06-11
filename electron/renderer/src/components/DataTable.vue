<template>
  <div class="data-table-shell" :class="{ compact }">
    <div class="data-table-shell__scroll" :style="{ minWidth }">
      <table class="data-table-shell__table">
        <slot />
      </table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  minWidth: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
</script>

<style scoped>
.data-table-shell {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  background: #fff;
}

.data-table-shell__scroll {
  overflow: auto;
}

.data-table-shell__table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}

:deep(th) {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 40px;
  padding: 0 12px;
  background: #f8fafc;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  color: var(--text-secondary, #6b7280);
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
}

:deep(td) {
  min-height: 52px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  color: var(--text-primary, #111827);
  font-size: 13px;
  vertical-align: middle;
  white-space: nowrap;
}

:deep(tbody tr:hover td) {
  background: #f8fafc;
}

.compact :deep(td) {
  min-height: 44px;
  padding-top: 8px;
  padding-bottom: 8px;
}
</style>
