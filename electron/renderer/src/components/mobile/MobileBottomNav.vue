<template>
  <nav class="mobile-bottom-nav" aria-label="移动端主导航">
    <RouterLink v-for="item in items" :key="item.to" :to="item.to" class="mobile-bottom-nav__item">
      <span class="mobile-bottom-nav__icon">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [
      { to: '/ui-v2/mobile', label: '工作台', icon: '台' },
      { to: '/ui-v2/mobile/orders', label: '订单', icon: '单' },
      { to: '/ui-v2/mobile/schedule', label: '档期', icon: '期' },
      { to: '/ui-v2/mobile/devices', label: '设备', icon: '备' },
      { to: '/ui-v2/mobile/mine', label: '我的', icon: '我' },
    ],
  },
})
</script>

<style scoped>
.mobile-bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: min(430px, 100vw);
  height: 70px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--ui-border);
  z-index: 30;
}

.mobile-bottom-nav__item {
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--ui-space-4);
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 700;
}

.mobile-bottom-nav__item.router-link-active,
.mobile-bottom-nav__item.router-link-exact-active {
  color: var(--ui-brand);
}

.mobile-bottom-nav__icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: var(--ui-surface-soft);
  font-size: 11px;
}

.router-link-active .mobile-bottom-nav__icon,
.router-link-exact-active .mobile-bottom-nav__icon {
  background: var(--ui-brand-soft);
  box-shadow: inset 0 0 0 1px rgba(0, 127, 109, 0.16);
}
</style>
