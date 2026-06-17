<template>
  <nav class="mobile-bottom-nav" aria-label="移动端主导航" data-testid="mobile-bottom-nav">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="mobile-bottom-nav__item"
      :data-testid="`mobile-bottom-nav-${item.label}`"
    >
      <span class="mobile-bottom-nav__icon">
        <component :is="item.icon" class="mobile-bottom-nav__svg" aria-hidden="true" />
      </span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
import { CalendarCheck, ClipboardList, Home, PackageCheck, UserRound } from '@lucide/vue'

defineProps({
  items: {
    type: Array,
    default: () => [
      { to: '/ui-v2/mobile', label: '工作台', icon: Home },
      { to: '/ui-v2/mobile/orders', label: '订单', icon: ClipboardList },
      { to: '/ui-v2/mobile/schedule', label: '档期', icon: CalendarCheck },
      { to: '/ui-v2/mobile/devices', label: '设备', icon: PackageCheck },
      { to: '/ui-v2/mobile/mine', label: '我的', icon: UserRound },
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
  height: 78px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: rgba(255, 255, 255, 0.97);
  border-top: 1px solid #e7edf2;
  box-shadow: 0 -10px 26px rgba(16, 24, 40, 0.06);
  z-index: 30;
}

.mobile-bottom-nav__item {
  position: relative;
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
  color: var(--ui-brand-strong);
}

.mobile-bottom-nav__item.router-link-active::before,
.mobile-bottom-nav__item.router-link-exact-active::before {
  display: none;
}

.mobile-bottom-nav__icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: transparent;
}

.router-link-active .mobile-bottom-nav__icon,
.router-link-exact-active .mobile-bottom-nav__icon {
  background: var(--ui-brand-soft);
  box-shadow: inset 0 0 0 1px rgba(0, 127, 109, 0.16);
}

.mobile-bottom-nav__svg {
  width: 21px;
  height: 21px;
  stroke-width: 2.1;
}
</style>
