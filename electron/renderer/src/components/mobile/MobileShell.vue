<template>
  <div class="mobile-shell">
    <main class="mobile-shell__content">
      <slot />
    </main>
    <MobileBottomNav v-if="showNav" :items="navItems" />
  </div>
</template>

<script setup>
import MobileBottomNav from './MobileBottomNav.vue'

defineProps({
  showNav: { type: Boolean, default: true },
  navItems: { type: Array, default: undefined },
})
</script>

<style scoped>
.mobile-shell {
  position: relative;
  max-width: 430px;
  min-height: 100vh;
  margin: 0 auto;
  background:
    radial-gradient(circle at 100% 0%, var(--color-bg-wash), transparent 32%),
    var(--color-bg-page);
  border-left: 1px solid var(--ui-border);
  border-right: 1px solid var(--ui-border);
}

.mobile-shell__content {
  min-height: calc(100vh - 70px);
  padding: 14px 14px 92px;
}
</style>
