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
  background: #f3f5f7;
  border-left: 1px solid #e7edf2;
  border-right: 1px solid #e7edf2;
  box-shadow: 0 0 0 1px rgba(16, 24, 40, 0.02);
}

.mobile-shell__content {
  min-height: calc(100vh - 70px);
  padding: 12px 12px 92px;
}
</style>
