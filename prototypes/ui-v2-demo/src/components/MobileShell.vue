<template>
  <div class="mobile-frame">
    <main class="mobile-content">
      <slot />
    </main>
    <MobileBottomNav />
  </div>
</template>

<script setup>
import MobileBottomNav from './MobileBottomNav.vue'
</script>

<style scoped>
.mobile-frame {
  min-height: 100vh;
  position: relative;
  background: var(--color-bg-page);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.mobile-content {
  min-height: calc(100vh - 70px);
  padding: var(--space-12) var(--space-14, 14px) 92px;
}
</style>
