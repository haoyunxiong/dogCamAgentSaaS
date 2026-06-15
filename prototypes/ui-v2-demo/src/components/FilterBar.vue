<template>
  <section class="filter-bar">
    <div class="filter-main">
      <slot />
    </div>
    <div v-if="$slots.actions" class="filter-actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.filter-bar {
  padding: var(--space-12);
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  box-shadow: var(--shadow-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}

.filter-main,
.filter-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.filter-main {
  flex: 1;
}

@media (max-width: 760px) {
  .filter-bar {
    display: grid;
  }
}
</style>
