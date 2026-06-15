<template>
  <section class="base-card">
    <slot />
  </section>
</template>

<style scoped>
.base-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
</style>
