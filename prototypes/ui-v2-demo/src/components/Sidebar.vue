<template>
  <aside class="sidebar">
    <RouterLink to="/" class="brand">
      <span class="brand-mark">XG</span>
      <span>
        <strong>小狗相机助手商户版</strong>
        <small>Rental Merchant OS</small>
      </span>
    </RouterLink>

    <nav class="nav">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item">
        <span class="nav-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar-note">
      <span>Design System v1</span>
      <strong>P1 页面补齐</strong>
      <p>15 个核心页面均使用本地 mock 数据。</p>
    </div>
  </aside>
</template>

<script setup>
const navItems = [
  { to: '/', label: '经营工作台', icon: 'D' },
  { to: '/orders', label: '订单中心', icon: 'O' },
  { to: '/schedule', label: '档期中心', icon: 'S' },
  { to: '/devices', label: '设备中心', icon: 'A' },
  { to: '/customers', label: '客户中心', icon: 'C' },
  { to: '/deposit', label: '免押管理', icon: 'P' },
  { to: '/logistics', label: '物流发货', icon: 'L' },
  { to: '/reports', label: '报表中心', icon: 'R' },
  { to: '/settings', label: '系统设置', icon: 'G' }
]
</script>

<style scoped>
.sidebar {
  min-height: 100vh;
  padding: var(--space-16) var(--space-12);
  background:
    radial-gradient(circle at 32px 24px, rgba(0, 168, 137, 0.16), transparent 128px),
    var(--sidebar);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  background: var(--sidebar-active);
  color: var(--sidebar);
  font-size: 11px;
  font-weight: 820;
  letter-spacing: 0.04em;
}

.brand strong,
.brand small {
  display: block;
}

.brand strong {
  font-size: 14px;
  letter-spacing: 0;
}

.brand small {
  margin-top: 2px;
  color: var(--sidebar-muted);
  font-size: 12px;
}

.nav {
  display: grid;
  gap: 3px;
}

.nav-item {
  height: 39px;
  padding: 0 10px 0 9px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--sidebar-muted);
  font-weight: 660;
  position: relative;
}

.nav-item:hover {
  background: var(--sidebar-soft);
  color: #fff;
}

.nav-item.router-link-active {
  background: color-mix(in srgb, var(--sidebar-active) 11%, transparent);
  color: #f7fbf8;
}

.nav-item.router-link-active::before {
  content: "";
  position: absolute;
  left: -2px;
  top: 9px;
  width: 3px;
  height: 21px;
  border-radius: 999px;
  background: var(--sidebar-active);
}

.nav-icon {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-8);
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.18);
  color: var(--sidebar-muted);
  font-size: 10px;
  font-weight: 820;
}

.nav-item.router-link-active .nav-icon {
  background: var(--sidebar-active);
  color: var(--sidebar);
}

.sidebar-note {
  margin-top: auto;
  padding: 10px 9px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  background: transparent;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;
}

.sidebar-note span {
  color: color-mix(in srgb, var(--sidebar-active) 70%, var(--sidebar-text));
  font-size: 11px;
  font-weight: 760;
}

.sidebar-note strong {
  display: block;
  margin-top: 3px;
}

.sidebar-note p {
  margin: 6px 0 0;
  color: var(--sidebar-muted);
  font-size: 12px;
}
</style>
