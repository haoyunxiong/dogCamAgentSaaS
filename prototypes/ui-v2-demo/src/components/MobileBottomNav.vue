<template>
  <nav class="bottom-nav">
    <RouterLink v-for="item in items" :key="item.to" :to="item.to" class="bottom-item">
      <span class="bottom-icon">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup>
const items = [
  { to: '/mobile', label: '工作台', icon: '台' },
  { to: '/mobile/orders', label: '订单', icon: '单' },
  { to: '/mobile/schedule', label: '档期', icon: '期' },
  { to: '/mobile/devices', label: '设备', icon: '备' },
  { to: '/mobile/mine', label: '我的', icon: '我' }
]
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: min(430px, 100vw);
  margin: 0 auto;
  height: 70px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--border);
  z-index: 30;
}

.bottom-item {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.bottom-item.router-link-active {
  color: var(--brand);
}

.bottom-icon {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: var(--surface-soft);
  font-size: 11px;
}

.router-link-active .bottom-icon {
  background: var(--brand-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand) 16%, white);
}
</style>
