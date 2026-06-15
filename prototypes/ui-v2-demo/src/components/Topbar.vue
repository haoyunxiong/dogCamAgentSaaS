<template>
  <header class="topbar">
    <div class="command-search">
      <span>搜索订单、客户、设备编号、运单</span>
      <kbd>⌘K</kbd>
    </div>
    <div class="topbar-actions">
      <button class="context-button">深圳总仓</button>
      <button class="context-button">06/14 今日</button>
      <button class="notification-button"><span /> 风险 5</button>
      <div class="avatar">运营</div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 58px;
  padding: 10px 22px 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 20;
}

.command-search {
  width: min(560px, 48vw);
  height: 36px;
  padding: 0 10px 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface-soft);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 640;
}

kbd {
  padding: 2px 6px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 11px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.context-button,
.notification-button {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-8);
  background: var(--surface);
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 650;
}

.notification-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.notification-button span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--danger);
}

.avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--ink);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

</style>
